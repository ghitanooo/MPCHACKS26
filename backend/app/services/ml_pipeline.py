import pandas as pd
import numpy as np
import os
import urllib.request
import geoip2.database
from sklearn.preprocessing import RobustScaler
from scipy.stats import rankdata
from pyod.models.iforest import IForest
from pyod.models.ecod import ECOD
from pyod.models.copod import COPOD
from pyod.models.hbos import HBOS
import shap
import warnings

warnings.filterwarnings('ignore', category=DeprecationWarning)

# We will cache the reader, models, explainer and baseline globally so they aren't re-initialized.
GEO_READER = None
MODELS = None
SCALER = None
EXPLAINER = None
BASELINE_EXPECTED_VALUE = None
FEATURES_USED = None

def load_geoip_database():
    global GEO_READER
    if GEO_READER is not None:
        return GEO_READER
        
    db_path = 'GeoLite2-Country.mmdb'
    if not os.path.exists(db_path):
        print("Downloading GeoLite2-Country.mmdb...")
        # Using a reliable mirror for the mmdb file
        url = "https://git.io/GeoLite2-Country.mmdb"
        urllib.request.urlretrieve(url, db_path)
    
    try:
        GEO_READER = geoip2.database.Reader(db_path)
        print("Local GeoIP database loaded successfully.")
    except Exception as e:
        print(f"Error loading GeoIP database: {e}")
        GEO_READER = None
    return GEO_READER

def get_country(ip):
    if pd.isna(ip):
        return None
    try:
        reader = load_geoip_database()
        if reader:
            response = reader.country(ip)
            return response.country.iso_code
    except:
        pass
    return None

def engineer_features(df_input: pd.DataFrame) -> pd.DataFrame:
    """
    Engineers all features EXACTLY as they were done in the Jupyter Notebook.
    """
    df = df_input.copy()
    
    # 1. IP Country
    df['ip_country'] = df['ip_address'].apply(get_country)

    # 2. Country Mismatches
    df['country_mismatch'] = df['merchant_country'] != df['cardholder_country']
    
    def check_ip_mismatch(row):
        if pd.isna(row['ip_country']):
            return False
        return row['ip_country'] != row['cardholder_country']
    df['ip_mismatch'] = df.apply(check_ip_mismatch, axis=1)

    # 3. Time since last transaction
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values(['card_id', 'timestamp'])
    df['time_since_last_transaction'] = df.groupby('card_id')['timestamp'].diff().dt.total_seconds()
    df['is_first_transaction'] = df['time_since_last_transaction'].isna()
    median_gap = df['time_since_last_transaction'].median()
    df['time_since_last_transaction'] = df['time_since_last_transaction'].fillna(median_gap)

    # 4. IP/Device sharing across cards
    ip_card_counts = df.groupby('ip_address')['card_id'].nunique()
    df['unique_cards_on_ip'] = df['ip_address'].map(ip_card_counts)
    df['ip_shared_with_multiple_cards'] = (df['unique_cards_on_ip'] > 1) & (df['ip_address'].notna())

    device_card_counts = df.groupby('device_id')['card_id'].nunique()
    df['unique_cards_on_device'] = df['device_id'].map(device_card_counts)
    df['device_shared_with_multiple_cards'] = (df['unique_cards_on_device'] > 1) & (df['device_id'].notna())

    # 5. Rolling unique IPs per card
    def get_rolling_unique_ips_per_card(group, window_str):
        group = group.sort_values('timestamp')
        results = []
        window_td = pd.Timedelta(window_str)
        for current_time in group['timestamp']:
            start_time = current_time - window_td
            mask = (group['timestamp'] > start_time) & (group['timestamp'] <= current_time)
            unique_count = group.loc[mask, 'ip_address'].nunique()
            results.append(unique_count)
        return pd.Series(results, index=group.index)

    windows = {'30min': 'card_unique_ips_30min', '60min': 'card_unique_ips_60min', '12h': 'card_unique_ips_12hr', '24h': 'card_unique_ips_1day'}
    for window_str, col_name in windows.items():
        df[col_name] = df.groupby('card_id', group_keys=False).apply(lambda x: get_rolling_unique_ips_per_card(x, window_str), include_groups=False)

    # 6. Rolling unique IP and Merchant countries per card
    def get_rolling_unique_values_per_card(group, column, window_str):
        group = group.sort_values('timestamp')
        results = []
        window_td = pd.Timedelta(window_str)
        for current_time in group['timestamp']:
            start_time = current_time - window_td
            mask = (group['timestamp'] > start_time) & (group['timestamp'] <= current_time)
            unique_count = group.loc[mask, column].nunique()
            results.append(unique_count)
        return pd.Series(results, index=group.index)

    country_windows = {'30min': '30min', '60min': '60min', '12h': '12hr', '24h': '1day'}
    for window_str, label in country_windows.items():
        df[f'card_unique_ip_countries_{label}'] = df.groupby('card_id', group_keys=False).apply(
            lambda x: get_rolling_unique_values_per_card(x, 'ip_country', window_str), include_groups=False)
        df[f'card_unique_merchant_countries_{label}'] = df.groupby('card_id', group_keys=False).apply(
            lambda x: get_rolling_unique_values_per_card(x, 'merchant_country', window_str), include_groups=False)

    # 7. Rolling transaction velocity
    def get_rolling_count_per_card(group, window_str):
        group = group.sort_values('timestamp')
        window_td = pd.Timedelta(window_str)
        counts = []
        for current_time in group['timestamp']:
            start_time = current_time - window_td
            mask = (group['timestamp'] > start_time) & (group['timestamp'] <= current_time)
            counts.append(len(group.loc[mask]))
        return pd.Series(counts, index=group.index)

    velocity_windows = {'30min': 'tx_velocity_30min', '1h': 'tx_velocity_1hr', '24h': 'tx_velocity_1day'}
    for window_str, col_name in velocity_windows.items():
        df[col_name] = df.groupby('card_id', group_keys=False).apply(lambda x: get_rolling_count_per_card(x, window_str), include_groups=False)

    # 8. Spending habits & time of day
    df['hour_of_day'] = df['timestamp'].dt.hour
    card_avg_spend = df.groupby('card_id')['amount'].mean().rename('card_avg_transaction_amount')
    df = df.merge(card_avg_spend, on='card_id', how='left')
    df['amount_vs_avg_ratio'] = df['amount'] / df['card_avg_transaction_amount']

    fav_category = df.groupby('card_id')['merchant_category'].agg(lambda x: x.value_counts().index[0]).rename('card_preferred_category')
    df = df.merge(fav_category, on='card_id', how='left')
    df['is_preferred_category'] = df['merchant_category'] == df['card_preferred_category']

    # 9. Opposite channel counts
    def get_opposite_channel_counts(group, window_str):
        group = group.sort_values('timestamp')
        window_td = pd.Timedelta(window_str)
        results = []
        for i, row in group.iterrows():
            current_time = row['timestamp']
            current_channel = row['channel']
            opposite_channel = 'online' if current_channel == 'in_person' else 'in_person'
            start_time = current_time - window_td
            mask = (group['timestamp'] > start_time) & (group['timestamp'] <= current_time) & (group['channel'] == opposite_channel)
            results.append(len(group.loc[mask]))
        return pd.Series(results, index=group.index)

    opposite_windows = {'30min': 'opposite_channel_30min', '60min': 'opposite_channel_60min', '12h': 'opposite_channel_12hr', '24h': 'opposite_channel_1day'}
    for window_str, col_name in opposite_windows.items():
        df[col_name] = df.groupby('card_id', group_keys=False).apply(lambda x: get_opposite_channel_counts(x, window_str), include_groups=False)

    # 10. Impossible Travel
    def calculate_travel_metrics(group):
        group = group.sort_values('timestamp')
        group['is_impossible_travel'] = False
        group['hour_gap'] = np.nan
        group['prev_merchant_country'] = None
        in_person = group[group['channel'] == 'in_person'].copy()
        if len(in_person) > 1:
            in_person['prev_merchant_country_val'] = in_person['merchant_country'].shift(1)
            in_person['prev_timestamp'] = in_person['timestamp'].shift(1)
            in_person['hour_gap_val'] = (in_person['timestamp'] - in_person['prev_timestamp']).dt.total_seconds() / 3600
            in_person['is_impossible_travel_val'] = (in_person['merchant_country'] != in_person['prev_merchant_country_val']) & \
                                                   (in_person['prev_merchant_country_val'].notna()) & \
                                                   (in_person['hour_gap_val'] < 6)
            group.loc[in_person.index, 'is_impossible_travel'] = in_person['is_impossible_travel_val']
            group.loc[in_person.index, 'hour_gap'] = in_person['hour_gap_val']
            group.loc[in_person.index, 'prev_merchant_country'] = in_person['prev_merchant_country_val']
        return group

    df['card_id_copy'] = df['card_id']
    df = df.groupby('card_id_copy', group_keys=False).apply(calculate_travel_metrics, include_groups=False)

    # 11. Merchant-Card Density
    def get_merchant_card_density(group):
        group = group.sort_values('timestamp')
        window_td = pd.Timedelta('1h')
        results = []
        for current_time in group['timestamp']:
            mask = (group['timestamp'] > (current_time - window_td)) & (group['timestamp'] <= current_time)
            results.append(group.loc[mask, 'card_id'].nunique())
        return pd.Series(results, index=group.index)

    df['merchant_unique_cards_1hr'] = df.groupby('merchant_name', group_keys=False).apply(get_merchant_card_density, include_groups=False)

    # 12. Transaction count / unique merchants
    df['total_tx_count_per_card'] = df.groupby('card_id')['transaction_id'].transform('count')
    df['unique_merchants_per_card'] = df.groupby('card_id')['merchant_name'].transform('nunique')

    return df

def run_anomaly_detection(df: pd.DataFrame) -> pd.DataFrame:
    global MODELS, SCALER, EXPLAINER, BASELINE_EXPECTED_VALUE, FEATURES_USED
    
    model_features = [
        'amount', 'time_since_last_transaction', 'amount_vs_avg_ratio', 'card_avg_transaction_amount',
        'tx_velocity_30min', 'tx_velocity_1hr', 'tx_velocity_1day',
        'card_unique_ips_30min', 'card_unique_ips_60min', 'card_unique_ips_12hr', 'card_unique_ips_1day',
        'card_unique_ip_countries_30min', 'card_unique_ip_countries_60min', 'card_unique_ip_countries_12hr', 'card_unique_ip_countries_1day',
        'card_unique_merchant_countries_30min', 'card_unique_merchant_countries_60min', 'card_unique_merchant_countries_12hr', 'card_unique_merchant_countries_1day',
        'opposite_channel_30min', 'opposite_channel_60min', 'opposite_channel_12hr', 'opposite_channel_1day',
        'merchant_unique_cards_1hr', 'total_tx_count_per_card', 'unique_merchants_per_card',
        'hour_of_day', 'country_mismatch', 'ip_mismatch', 'is_impossible_travel',
        'is_preferred_category', 'ip_shared_with_multiple_cards', 'is_first_transaction'
    ]
    FEATURES_USED = model_features

    X = df[model_features].copy()
    
    for col in X.select_dtypes(include=['bool']).columns:
        X[col] = X[col].astype(int)
        
    X = X.fillna(X.median())
    
    SCALER = RobustScaler()
    X_scaled = SCALER.fit_transform(X)
    X_scaled_df = pd.DataFrame(X_scaled, columns=model_features, index=df.index)
    
    MODELS = {
        'iforest': IForest(contamination=0.07, n_estimators=200, random_state=42),
        'ecod': ECOD(contamination=0.07),
        'copod': COPOD(contamination=0.07),
        'hbos': HBOS(contamination=0.07, n_bins='auto')
    }
    
    raw_scores = {}
    binary_labels = {}
    
    for name, det in MODELS.items():
        det.fit(X_scaled)
        raw_scores[name] = det.decision_scores_
        binary_labels[name] = det.labels_
        
    labels_df = pd.DataFrame(binary_labels)
    labels_df['votes'] = labels_df.sum(axis=1)
    
    ranked_scores = np.column_stack([
        rankdata(raw_scores[name]) for name in MODELS.keys()
    ])
    ensemble_score = ranked_scores.mean(axis=1)
    
    df['anomaly_score'] = ensemble_score
    df['votes'] = labels_df['votes'].values
    
    confidence_mapping = {
        0: 'normal',
        1: 'ignore',
        2: 'low confidence',
        3: 'medium confidence',
        4: 'high confidence'
    }
    df['fraud_confidence'] = df['votes'].map(confidence_mapping)
    df['is_fraud'] = (df['votes'] >= 3).astype(int)

    # Calculate SHAP values on IForest for explainability
    EXPLAINER = shap.TreeExplainer(MODELS['iforest'].detector_)
    shap_values = EXPLAINER.shap_values(X_scaled)
    if isinstance(shap_values, list):
        shap_values = shap_values[1]
        
    BASELINE_EXPECTED_VALUE = EXPLAINER.expected_value
    
    # Store top SHAP reasons for each row directly in the dataframe
    top_reasons_list = []
    for idx in range(len(X_scaled_df)):
        feat_importance = sorted(
            zip(model_features, shap_values[idx]),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:3]  # top 3 reasons
        
        reasons = []
        for feat, contrib in feat_importance:
            if abs(contrib) > 0.05: # Only include if it has a meaningful impact
                direction = "increases" if contrib > 0 else "decreases"
                val = X_scaled_df.iloc[idx][feat]
                if feat == "is_impossible_travel" and val > 0:
                    reasons.append("Impossible travel detected (country changed within 6h)")
                elif feat == "country_mismatch" and val > 0:
                    reasons.append("Merchant and Cardholder country mismatch")
                elif feat == "ip_mismatch" and val > 0:
                    reasons.append("IP country and Cardholder country mismatch")
                elif feat == "amount_vs_avg_ratio" and contrib > 0:
                    reasons.append(f"Amount is unusually high for this card")
                elif "tx_velocity" in feat and contrib > 0:
                    reasons.append(f"High transaction velocity detected")
                elif "opposite_channel" in feat and contrib > 0:
                    reasons.append(f"Mixed in-person/online channel activity")
                elif feat == "ip_shared_with_multiple_cards" and val > 0:
                    reasons.append(f"IP address shared across multiple cards")
                else:
                    # Generic fallback
                    if contrib > 0:
                        reasons.append(f"Anomalous {feat}")
        
        # Ensure there's at least one reason if it's flagged as fraud
        if df.iloc[idx]['is_fraud'] == 1 and not reasons:
            reasons.append("Multiple anomalous behavior patterns detected")
            
        top_reasons_list.append(reasons)
        
    df['signals'] = top_reasons_list

    return df

def run_full_pipeline(df: pd.DataFrame) -> pd.DataFrame:
    df_engineered = engineer_features(df)
    df_scored = run_anomaly_detection(df_engineered)
    return df_scored
