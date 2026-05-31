import os
import json
import warnings
import pandas as pd
import numpy as np
import geoip2.database
from scipy.stats import rankdata
from sklearn.preprocessing import RobustScaler
from pyod.models.iforest import IForest
from pyod.models.ecod import ECOD
from pyod.models.copod import COPOD
from pyod.models.hbos import HBOS
import shap
import anthropic

warnings.filterwarnings("ignore")

# ── Global cache ──────────────────────────────────────────────────────────────
GEO_READER = None
SCORED_DF_CACHE = None
SHAP_VALUES_CACHE = None
X_SCALED_DF_CACHE = None
FEATURES_USED = None

# ── GeoIP ─────────────────────────────────────────────────────────────────────

def _load_geo():
    global GEO_READER
    if GEO_READER is not None:
        return GEO_READER
    db_path = os.path.join(os.path.dirname(__file__), "..", "..", "GeoLite2-Country.mmdb")
    db_path = os.path.abspath(db_path)
    if os.path.exists(db_path):
        try:
            GEO_READER = geoip2.database.Reader(db_path)
        except Exception:
            GEO_READER = None
    return GEO_READER


def _get_country(ip: str):
    if pd.isna(ip):
        return None
    try:
        reader = _load_geo()
        if reader:
            return reader.country(ip).country.iso_code
    except Exception:
        pass
    return None


# ── Feature engineering ───────────────────────────────────────────────────────

def _rolling_count(df: pd.DataFrame, group_col: str, ts_col: str, window_seconds: int) -> pd.Series:
    result = pd.Series(0, index=df.index, dtype=int)
    df_sorted = df.sort_values([group_col, ts_col])
    for _, grp in df_sorted.groupby(group_col):
        ts = grp[ts_col].values.astype("int64") // 10**9
        for i, idx in enumerate(grp.index):
            t = ts[i]
            result[idx] = int(np.searchsorted(ts[:i], t - window_seconds, side="left"))
            if i > 0:
                result[idx] = i - int(np.searchsorted(ts[:i], t - window_seconds, side="left"))
    return result


def _rolling_nunique(df: pd.DataFrame, group_col: str, ts_col: str, val_col: str, window_seconds: int) -> pd.Series:
    result = pd.Series(0, index=df.index, dtype=int)
    df_sorted = df.sort_values([group_col, ts_col])
    for _, grp in df_sorted.groupby(group_col):
        ts = grp[ts_col].values.astype("int64") // 10**9
        vals = grp[val_col].values
        for i, idx in enumerate(grp.index):
            t = ts[i]
            lo = int(np.searchsorted(ts[:i], t - window_seconds, side="left"))
            window_vals = vals[lo:i]
            result[idx] = len(set(v for v in window_vals if v is not None and not (isinstance(v, float) and np.isnan(v))))
    return result


def engineer_features(df_input: pd.DataFrame) -> pd.DataFrame:
    df = df_input.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values(["card_id", "timestamp"]).reset_index(drop=True)

    # IP country
    df["ip_country"] = df["ip_address"].apply(_get_country)

    # Country / IP mismatches
    df["country_mismatch"] = (df["merchant_country"] != df["cardholder_country"]).astype(int)
    df["ip_mismatch"] = df.apply(
        lambda r: int(r["ip_country"] is not None and r["ip_country"] != r["cardholder_country"]),
        axis=1,
    )

    # Hour of day
    df["hour_of_day"] = df["timestamp"].dt.hour

    # Time since last tx per card
    df["time_since_last_transaction"] = (
        df.groupby("card_id")["timestamp"].diff().dt.total_seconds()
    )
    df["is_first_transaction"] = df["time_since_last_transaction"].isna().astype(int)
    median_gap = df["time_since_last_transaction"].median()
    df["time_since_last_transaction"] = df["time_since_last_transaction"].fillna(median_gap)

    # Impossible travel (in-person only, < 6h gap, country changed)
    prev_country = df.groupby("card_id")["cardholder_country"].shift(1)
    prev_channel = df.groupby("card_id")["channel"].shift(1)
    df["is_impossible_travel"] = (
        (df["channel"] == "in_person")
        & (prev_channel == "in_person")
        & (df["time_since_last_transaction"] < 6 * 3600)
        & (df["merchant_country"] != prev_country)
    ).astype(int)

    # IP / device sharing across cards
    ip_card_counts = df.groupby("ip_address")["card_id"].nunique()
    df["unique_cards_on_ip"] = df["ip_address"].map(ip_card_counts).fillna(0).astype(int)
    df["ip_shared_with_multiple_cards"] = (
        (df["unique_cards_on_ip"] > 1) & df["ip_address"].notna()
    ).astype(int)

    device_card_counts = df.groupby("device_id")["card_id"].nunique()
    df["unique_cards_on_device"] = df["device_id"].map(device_card_counts).fillna(0).astype(int)
    df["device_shared_with_multiple_cards"] = (
        (df["unique_cards_on_device"] > 1) & df["device_id"].notna()
    ).astype(int)

    # Per-card baselines
    card_stats = df.groupby("card_id")["amount"].median().rename("card_avg_transaction_amount")
    df = df.join(card_stats, on="card_id")
    df["amount_vs_avg_ratio"] = df["amount"] / (df["card_avg_transaction_amount"] + 1e-9)

    card_mode_cat = df.groupby("card_id")["merchant_category"].agg(lambda x: x.mode()[0])
    df["preferred_category"] = df["card_id"].map(card_mode_cat)
    df["is_preferred_category"] = (df["merchant_category"] == df["preferred_category"]).astype(int)

    card_tx_counts = df.groupby("card_id").cumcount()
    df["total_tx_count_per_card"] = card_tx_counts + 1
    df["unique_merchants_per_card"] = df.groupby("card_id")["merchant_name"].transform("nunique")

    # Velocity windows
    windows = {"30min": 1800, "1hr": 3600, "1day": 86400}
    for label, secs in windows.items():
        col = f"tx_velocity_{label}"
        result = pd.Series(0, index=df.index, dtype=int)
        for cid, grp in df.groupby("card_id"):
            ts = grp["timestamp"].values.astype("int64") // 10**9
            for i, idx in enumerate(grp.index):
                t = ts[i]
                lo = int(np.searchsorted(ts[:i], t - secs, side="left"))
                result[idx] = i - lo
        df[col] = result

    # Rolling unique IPs per card
    for label, secs in {"30min": 1800, "60min": 3600, "12h": 43200, "24h": 86400}.items():
        col = f"card_unique_ips_{label}"
        result = pd.Series(0, index=df.index, dtype=int)
        for cid, grp in df.groupby("card_id"):
            ts = grp["timestamp"].values.astype("int64") // 10**9
            ips = grp["ip_address"].values
            for i, idx in enumerate(grp.index):
                t = ts[i]
                lo = int(np.searchsorted(ts[:i], t - secs, side="left"))
                result[idx] = len(set(v for v in ips[lo:i] if v is not None and not (isinstance(v, float) and np.isnan(v))))
        df[col] = result

    # Rolling unique merchant countries per card
    for label, secs in {"30min": 1800, "60min": 3600, "12h": 43200, "24h": 86400}.items():
        col = f"card_unique_merchant_countries_{label}"
        result = pd.Series(0, index=df.index, dtype=int)
        for cid, grp in df.groupby("card_id"):
            ts = grp["timestamp"].values.astype("int64") // 10**9
            ctrs = grp["merchant_country"].values
            for i, idx in enumerate(grp.index):
                t = ts[i]
                lo = int(np.searchsorted(ts[:i], t - secs, side="left"))
                result[idx] = len(set(ctrs[lo:i]))
        df[col] = result

    # Rolling unique IP countries per card
    for label, secs in {"30min": 1800, "60min": 3600, "12h": 43200, "24h": 86400}.items():
        col = f"card_unique_ip_countries_{label}"
        result = pd.Series(0, index=df.index, dtype=int)
        for cid, grp in df.groupby("card_id"):
            ts = grp["timestamp"].values.astype("int64") // 10**9
            ipc = grp["ip_country"].values
            for i, idx in enumerate(grp.index):
                t = ts[i]
                lo = int(np.searchsorted(ts[:i], t - secs, side="left"))
                result[idx] = len(set(v for v in ipc[lo:i] if v is not None and not (isinstance(v, float) and np.isnan(v))))
        df[col] = result

    # Opposite channel switches per card
    for label, secs in {"30min": 1800, "60min": 3600, "12h": 43200, "24h": 86400}.items():
        col = f"opposite_channel_{label}"
        result = pd.Series(0, index=df.index, dtype=int)
        for cid, grp in df.groupby("card_id"):
            ts = grp["timestamp"].values.astype("int64") // 10**9
            chans = grp["channel"].values
            for i, idx in enumerate(grp.index):
                t = ts[i]
                lo = int(np.searchsorted(ts[:i], t - secs, side="left"))
                cur = chans[i]
                if cur == "online":
                    opp = "in_person"
                elif cur == "in_person":
                    opp = "online"
                else:
                    opp = None
                if opp:
                    result[idx] = int(np.sum(chans[lo:i] == opp))
        df[col] = result

    # Merchant burst: unique cards per merchant in last 1hr
    result = pd.Series(0, index=df.index, dtype=int)
    for mname, grp in df.groupby("merchant_name"):
        ts = grp["timestamp"].values.astype("int64") // 10**9
        cards = grp["card_id"].values
        for i, idx in enumerate(grp.index):
            t = ts[i]
            lo = int(np.searchsorted(ts[:i], t - 3600, side="left"))
            result[idx] = len(set(cards[lo:i]))
    df["merchant_unique_cards_1hr"] = result

    return df


# ── Model training & scoring ───────────────────────────────────────────────────

MODEL_FEATURES = [
    "tx_velocity_30min", "tx_velocity_1hr", "tx_velocity_1day",
    "country_mismatch", "ip_mismatch", "is_impossible_travel",
    "card_unique_ips_30min", "card_unique_ips_60min", "card_unique_ips_12h", "card_unique_ips_24h",
    "card_unique_merchant_countries_30min", "card_unique_merchant_countries_60min",
    "card_unique_merchant_countries_12h", "card_unique_merchant_countries_24h",
    "card_unique_ip_countries_30min", "card_unique_ip_countries_60min",
    "card_unique_ip_countries_12h", "card_unique_ip_countries_24h",
    "opposite_channel_30min", "opposite_channel_60min", "opposite_channel_12h", "opposite_channel_24h",
    "ip_shared_with_multiple_cards", "device_shared_with_multiple_cards",
    "merchant_unique_cards_1hr",
    "amount_vs_avg_ratio", "is_preferred_category",
    "time_since_last_transaction", "is_first_transaction",
    "total_tx_count_per_card", "unique_merchants_per_card",
    "hour_of_day",
]

DETECTORS = {
    "iforest": IForest(n_estimators=200, contamination=0.07, random_state=42),
    "ecod":    ECOD(contamination=0.07),
    "copod":   COPOD(contamination=0.07),
    "hbos":    HBOS(contamination=0.07),
}

CONFIDENCE_MAP = {0: "normal", 1: "ignore", 2: "low", 3: "medium", 4: "high"}


def _rank_normalize(scores: np.ndarray) -> np.ndarray:
    return (rankdata(scores) - 1) / (len(scores) - 1) * 1000


def _get_top_shap_features(shap_row, feature_names, feature_values, n: int = 5):
    indexed = sorted(enumerate(shap_row), key=lambda x: abs(x[1]), reverse=True)[:n]
    return [
        {
            "feature": feature_names[i],
            "value": float(feature_values[i]),
            "impact": float(v),
            "direction": "fraud" if v > 0 else "normal",
        }
        for i, v in indexed
    ]


def _build_evidence_snapshot(row) -> dict:
    def _int(val, default=0):
        try:
            v = val
            if isinstance(v, float) and np.isnan(v):
                return default
            return int(v)
        except Exception:
            return default

    def _bool(val):
        try:
            if isinstance(val, float) and np.isnan(val):
                return False
            return bool(val)
        except Exception:
            return False

    return {
        "velocity": {
            "last_30min": _int(row.get("tx_velocity_30min")),
            "last_1hr":   _int(row.get("tx_velocity_1hr")),
            "last_day":   _int(row.get("tx_velocity_1day")),
        },
        "geo": {
            "cardholder_country":  str(row.get("cardholder_country", "")),
            "merchant_country":    str(row.get("merchant_country", "")),
            "ip_country":          str(row.get("ip_country", "")) if row.get("ip_country") else None,
            "country_mismatch":    _bool(row.get("country_mismatch")),
            "ip_mismatch":         _bool(row.get("ip_mismatch")),
            "impossible_travel":   _bool(row.get("is_impossible_travel")),
        },
        "spending": {
            "amount":    float(row.get("amount", 0)),
            "card_avg":  float(row.get("card_avg_transaction_amount", 0)),
            "ratio":     float(row.get("amount_vs_avg_ratio", 1)),
        },
        "device_ip": {
            "device_shared":           _bool(row.get("device_shared_with_multiple_cards")),
            "ip_shared":               _bool(row.get("ip_shared_with_multiple_cards")),
            "unique_cards_on_device":  _int(row.get("unique_cards_on_device")),
            "unique_cards_on_ip":      _int(row.get("unique_cards_on_ip")),
        },
        "channel": {
            "channel":                row.get("channel", ""),
            "opposite_count_30min":   _int(row.get("opposite_channel_30min")),
        },
        "merchant": {
            "unique_cards_1hr": _int(row.get("merchant_unique_cards_1hr")),
        },
    }


def _build_signals(row, shap_features: list) -> list:
    signals = []
    ev = _build_evidence_snapshot(row)

    if ev["geo"]["country_mismatch"]:
        signals.append(f"Merchant country ({ev['geo']['merchant_country']}) differs from cardholder country ({ev['geo']['cardholder_country']})")
    if ev["geo"]["ip_mismatch"] and ev["geo"]["ip_country"]:
        signals.append(f"IP resolved to {ev['geo']['ip_country']}, card is {ev['geo']['cardholder_country']}")
    if ev["geo"]["impossible_travel"]:
        signals.append("Impossible travel: in-person transaction in different country within 6 hours")
    if ev["spending"]["ratio"] > 5:
        signals.append(f"Amount {ev['spending']['ratio']:.1f}× this card's median spend")
    if ev["velocity"]["last_30min"] >= 3:
        signals.append(f"{ev['velocity']['last_30min']} transactions from this card in the last 30 minutes")
    if ev["device_ip"]["device_shared"]:
        signals.append(f"Device shared across {ev['device_ip']['unique_cards_on_device']} cards")
    if ev["device_ip"]["ip_shared"]:
        signals.append(f"IP address shared across {ev['device_ip']['unique_cards_on_ip']} cards")
    if ev["merchant"]["unique_cards_1hr"] >= 5:
        signals.append(f"{ev['merchant']['unique_cards_1hr']} different cards used at this merchant in the last hour")
    if ev["channel"]["opposite_count_30min"] > 0:
        signals.append("Unusual channel switch detected in the last 30 minutes")

    if not signals and shap_features:
        top = shap_features[0]
        signals.append(f"Top anomaly signal: {top['feature'].replace('_', ' ')}")

    return signals[:4]


def run_full_pipeline(df_raw: pd.DataFrame) -> pd.DataFrame:
    global SCORED_DF_CACHE, SHAP_VALUES_CACHE, X_SCALED_DF_CACHE, FEATURES_USED

    df = engineer_features(df_raw)
    FEATURES_USED = MODEL_FEATURES

    X = df[MODEL_FEATURES].fillna(0).values
    scaler = RobustScaler()
    X_scaled = scaler.fit_transform(X)
    X_scaled_df = pd.DataFrame(X_scaled, columns=MODEL_FEATURES, index=df.index)

    # Fit all 4 models
    raw_scores, labels = {}, {}
    for name, det in DETECTORS.items():
        det.fit(X_scaled)
        raw_scores[name] = det.decision_scores_
        labels[name]     = det.labels_

    # Rank-normalize each model's scores to 0–1000
    norm_scores = {name: _rank_normalize(s) for name, s in raw_scores.items()}

    # Ensemble: average of rank-normalized scores
    ensemble = np.mean(np.stack(list(norm_scores.values())), axis=0)

    # Majority vote: 3 of 4 models required
    votes = np.sum(np.stack(list(labels.values())), axis=0)
    is_fraud = (votes >= 3).astype(int)

    df["anomaly_score"]    = ensemble
    df["votes"]            = votes
    df["is_fraud"]         = is_fraud
    df["fraud_confidence"] = [CONFIDENCE_MAP.get(int(v), "normal") for v in votes]

    # Per-model scores and votes stored per row
    df["model_scores"] = [
        {
            "iforest": float(norm_scores["iforest"][i]),
            "ecod":    float(norm_scores["ecod"][i]),
            "copod":   float(norm_scores["copod"][i]),
            "hbos":    float(norm_scores["hbos"][i]),
        }
        for i in range(len(df))
    ]
    df["model_votes"] = [
        {
            "iforest": int(labels["iforest"][i]),
            "ecod":    int(labels["ecod"][i]),
            "copod":   int(labels["copod"][i]),
            "hbos":    int(labels["hbos"][i]),
        }
        for i in range(len(df))
    ]

    # SHAP on Isolation Forest
    explainer = shap.TreeExplainer(DETECTORS["iforest"].detector_)
    shap_vals = explainer.shap_values(X_scaled_df)

    df["shap_top_features"] = [
        _get_top_shap_features(shap_vals[i], MODEL_FEATURES, X_scaled_df.iloc[i].values)
        for i in range(len(df))
    ]

    df["evidence_snapshot"] = [
        _build_evidence_snapshot(df.iloc[i])
        for i in range(len(df))
    ]

    df["signals"] = [
        _build_signals(df.iloc[i], df.iloc[i]["shap_top_features"])
        for i in range(len(df))
    ]

    # Cache
    SCORED_DF_CACHE   = df.copy()
    SHAP_VALUES_CACHE = shap_vals
    X_SCALED_DF_CACHE = X_scaled_df

    return df


# ── Claude explanation ─────────────────────────────────────────────────────────

_FEATURE_LABELS = {
    "tx_velocity_30min":                    "Transaction velocity (30 min)",
    "tx_velocity_1hr":                      "Transaction velocity (1 hr)",
    "tx_velocity_1day":                     "Transaction velocity (1 day)",
    "country_mismatch":                     "Country mismatch",
    "ip_mismatch":                          "IP country mismatch",
    "is_impossible_travel":                 "Impossible travel",
    "card_unique_ips_30min":                "Unique IPs (30 min)",
    "card_unique_ips_60min":                "Unique IPs (1 hr)",
    "card_unique_ips_12h":                  "Unique IPs (12 hr)",
    "card_unique_ips_24h":                  "Unique IPs (24 hr)",
    "card_unique_merchant_countries_30min": "Unique merchant countries (30 min)",
    "card_unique_merchant_countries_60min": "Unique merchant countries (1 hr)",
    "card_unique_merchant_countries_12h":   "Unique merchant countries (12 hr)",
    "card_unique_merchant_countries_24h":   "Unique merchant countries (24 hr)",
    "card_unique_ip_countries_30min":       "Unique IP countries (30 min)",
    "card_unique_ip_countries_60min":       "Unique IP countries (1 hr)",
    "card_unique_ip_countries_12h":         "Unique IP countries (12 hr)",
    "card_unique_ip_countries_24h":         "Unique IP countries (24 hr)",
    "opposite_channel_30min":               "Channel switches (30 min)",
    "opposite_channel_60min":               "Channel switches (1 hr)",
    "opposite_channel_12h":                 "Channel switches (12 hr)",
    "opposite_channel_24h":                 "Channel switches (24 hr)",
    "ip_shared_with_multiple_cards":        "IP shared across cards",
    "device_shared_with_multiple_cards":    "Device shared across cards",
    "merchant_unique_cards_1hr":            "Merchant card burst (1 hr)",
    "amount_vs_avg_ratio":                  "Unusual spend amount",
    "is_preferred_category":                "Preferred category",
    "time_since_last_transaction":          "Time since last transaction",
    "is_first_transaction":                 "First transaction for card",
    "total_tx_count_per_card":              "Total transactions per card",
    "unique_merchants_per_card":            "Unique merchants per card",
    "hour_of_day":                          "Hour of day",
}


def explain_transaction_with_claude(transaction_id: str) -> dict:
    global SCORED_DF_CACHE

    if SCORED_DF_CACHE is None:
        return _fallback_explanation("No data loaded. Please ingest transactions first.")

    matches = SCORED_DF_CACHE[SCORED_DF_CACHE["transaction_id"] == transaction_id]
    if matches.empty:
        return _fallback_explanation(f"Transaction {transaction_id} not found in cache.")

    row = matches.iloc[0]
    ev = row.get("evidence_snapshot", {})
    shap_top = row.get("shap_top_features", [])
    model_votes = row.get("model_votes", {})
    model_scores = row.get("model_scores", {})

    signals_text = "\n".join(
        f"  - {_FEATURE_LABELS.get(f['feature'], f['feature'])}: "
        f"impact={f['impact']:+.3f} ({'fraud' if f['direction']=='fraud' else 'normal'})"
        for f in shap_top[:5]
    )

    model_text = "\n".join(
        f"  - {name.upper()}: score={model_scores.get(name, 0):.0f}/1000, vote={'FRAUD' if model_votes.get(name) else 'NORMAL'}"
        for name in ["iforest", "ecod", "copod", "hbos"]
    )

    prompt = f"""You are a senior fraud analyst AI. Analyze this suspicious credit card transaction and provide a structured JSON assessment.

Transaction ID: {transaction_id}
Amount: ${row['amount']:.2f} CAD
Merchant: {row['merchant_name']} ({row['merchant_category']})
Channel: {row['channel']}
Cardholder country: {ev.get('geo', {}).get('cardholder_country', 'N/A')}
Merchant country: {ev.get('geo', {}).get('merchant_country', 'N/A')}
IP country: {ev.get('geo', {}).get('ip_country', 'N/A')}
Ensemble anomaly score: {row['anomaly_score']:.0f}/1000
Models flagging fraud: {row['votes']}/4 ({row['fraud_confidence']} confidence)

Model verdicts:
{model_text}

Top SHAP signals driving the anomaly score:
{signals_text}

Velocity: {ev.get('velocity', {}).get('last_30min', 0)} txns/30min, {ev.get('velocity', {}).get('last_1hr', 0)} txns/1hr
Spending: ${row['amount']:.2f} vs card avg ${ev.get('spending', {}).get('card_avg', 0):.2f} ({ev.get('spending', {}).get('ratio', 1):.1f}× baseline)
Device shared: {ev.get('device_ip', {}).get('device_shared', False)}, IP shared: {ev.get('device_ip', {}).get('ip_shared', False)}

Respond ONLY with valid JSON in this exact format (no markdown, no extra text):
{{
  "summary": "<one concise sentence executive summary>",
  "why_suspicious": ["<reason 1>", "<reason 2>", "<reason 3>"],
  "key_signals": ["<signal name 1>", "<signal name 2>", "<signal name 3>"],
  "recommended_action": "BLOCK",
  "reason": "<one sentence justification for the recommended action>"
}}

recommended_action must be exactly one of: APPROVE, BLOCK, ESCALATE"""

    try:
        client = anthropic.Anthropic()
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        return {
            "summary":            data.get("summary", ""),
            "why_suspicious":     data.get("why_suspicious", []),
            "key_signals":        data.get("key_signals", []),
            "recommended_action": data.get("recommended_action", "ESCALATE"),
            "reason":             data.get("reason", ""),
        }
    except Exception as e:
        signals = row.get("signals", [])
        return {
            "summary":            f"Anomaly score {row['anomaly_score']:.0f}/1000 — {row['votes']}/4 models flagged fraud.",
            "why_suspicious":     signals[:3] if signals else ["Multiple fraud signals detected"],
            "key_signals":        [f["feature"] for f in shap_top[:3]],
            "recommended_action": "ESCALATE",
            "reason":             f"Claude API unavailable ({e}); manual review required.",
        }


def _fallback_explanation(msg: str) -> dict:
    return {
        "summary":            msg,
        "why_suspicious":     [],
        "key_signals":        [],
        "recommended_action": "ESCALATE",
        "reason":             "Unable to generate explanation.",
    }
