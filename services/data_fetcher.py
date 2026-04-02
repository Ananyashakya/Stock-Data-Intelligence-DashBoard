import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import StockData
from services.calculations import (
    calculate_daily_return,
    calculate_ma_7,
    calculate_volatility,
    calculate_rsi
)

COMPANIES = {
    "RELIANCE.NS": "Reliance Industries",
    "TCS.NS": "Tata Consultancy Services",
    "INFY.NS": "Infosys Limited",
    "HDFCBANK.NS": "HDFC Bank",
    "ICICIBANK.NS": "ICICI Bank",
    "BHARTIARTL.NS": "Bharti Airtel",
    "SBIN.NS": "State Bank of India",
    "LT.NS": "Larsen & Toubro",
}


def generate_mock_stock_data(symbol: str, days: int = 400):
    # using a fixed seed per symbol so data is consistent across restarts
    np.random.seed(hash(symbol) % 10000)

    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days)
    dates = pd.date_range(start=start_date, end=end_date, freq='B')

    base_price = np.random.uniform(100, 3000)
    trend = np.linspace(0, np.random.uniform(-0.3, 0.6), len(dates))
    noise = np.random.normal(0, 0.015, len(dates)).cumsum()

    close = base_price * (1 + trend + noise)
    close = np.maximum(close, 10)

    open_price = close * np.random.uniform(0.98, 1.02, len(dates))
    high = np.maximum(open_price, close) * np.random.uniform(1.001, 1.03, len(dates))
    low = np.minimum(open_price, close) * np.random.uniform(0.97, 0.999, len(dates))
    volume = np.random.randint(100000, 5000000, len(dates))

    df = pd.DataFrame({
        'date': dates.date,
        'open_price': open_price,
        'high': high,
        'low': low,
        'close': close,
        'volume': volume
    })

    return df


def fetch_and_store_stock_data(db: Session, symbol: str, period: str = "1y"):
    print(f"Generating data for {symbol}...")

    df = generate_mock_stock_data(symbol)

    df['daily_return'] = calculate_daily_return(df)
    df['ma_7'] = calculate_ma_7(df)
    df['daily_return'] = df['daily_return'].fillna(0.0)
    df['ma_7'] = df['ma_7'].ffill().bfill()
    df['volatility'] = calculate_volatility(df)
    df['rsi'] = calculate_rsi(df['close'])
    df['rsi'] = df['rsi'].ffill().bfill()

    count = 0
    for _, row in df.iterrows():
        record = StockData(
            symbol=symbol,
            date=row['date'],
            open_price=float(row['open_price']),
            high=float(row['high']),
            low=float(row['low']),
            close=float(row['close']),
            volume=float(row['volume']),
            daily_return=float(row['daily_return']),
            ma_7=float(row['ma_7']),
            volatility=float(row['volatility']),
            rsi=float(row['rsi'])
        )
        db.add(record)
        count += 1

    db.commit()
    print(f"Stored {count} records for {symbol}")