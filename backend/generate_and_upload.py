import pandas as pd
import numpy as np
import random
import asyncio
from datetime import datetime, timedelta, timezone
from app.services.ml_pipeline import run_full_pipeline
from app.database import transactions_collection

async def main():
    print("Generating 1000 synthetic transactions...")
    merchants = ['Amazon.ca', 'Tim Hortons', 'QuickPay Online', 'Netflix', 'Uber', 'Shell', 'Walmart', 'Apple Store']
    categories = ['grocery', 'gas', 'restaurant', 'online_retail', 'electronics', 'travel', 'subscription', 'entertainment', 'utilities', 'atm', 'gift_card']
    channels = ['online', 'in_person', 'atm']
    
    data = []
    # Use timezone-aware datetime to avoid deprecation warning
    start_time = datetime.now(timezone.utc) - timedelta(days=30)
    cards = [f'card_{i:03d}' for i in range(50)]

    for i in range(1000):
        timestamp = start_time + timedelta(hours=random.randint(1, 720))
        card = random.choice(cards)
        is_fraud = random.random() < 0.07
        
        if is_fraud:
            amount = random.uniform(1000, 5000)
            m_country = 'FR'
            c_country = 'CA'
            ip = '82.10.15.22'
            device = 'DEV-FRAUD'
        else:
            amount = random.uniform(5, 150)
            m_country = 'CA'
            c_country = 'CA'
            ip = f'142.23.44.{random.randint(1,50)}'
            device = f'DEV-NORM-{random.randint(1,10)}'

        data.append({
            'transaction_id': f'tx_{i:06d}',
            'timestamp': timestamp.isoformat(),
            'card_id': card,
            'amount': amount,
            'merchant_name': random.choice(merchants),
            'merchant_category': random.choice(categories),
            'channel': random.choice(channels),
            'cardholder_country': c_country,
            'merchant_country': m_country,
            'device_id': device if random.choice(channels) == 'online' else None,
            'ip_address': ip if random.choice(channels) == 'online' else None
        })

    df = pd.DataFrame(data)
    print("Running ML Pipeline...")
    scored_df = run_full_pipeline(df)
    
    records = scored_df.to_dict('records')
    for record in records:
        record['status'] = 'Review'
        if isinstance(record['timestamp'], pd.Timestamp):
            record['timestamp'] = record['timestamp'].isoformat()
            
    print("Clearing old db and inserting...")
    await transactions_collection.delete_many({})
    await transactions_collection.insert_many(records)
    print("Done! Check your frontend.")

if __name__ == "__main__":
    asyncio.run(main())
