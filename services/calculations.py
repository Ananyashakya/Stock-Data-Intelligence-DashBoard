import pandas as pd
import numpy as np


def calculate_daily_return(df: pd.DataFrame) -> pd.Series:
    return (df['close'] - df['open_price']) / df['open_price']


def calculate_ma_7(df: pd.DataFrame) -> pd.Series:
    return df['close'].rolling(window=7).mean()


def calculate_volatility(df: pd.DataFrame, window: int = 30) -> float:
    # annualized volatility — standard deviation of daily returns * sqrt(252)
    if len(df) < window:
        return 0.0
    returns = df['daily_return'].dropna()
    return float(returns.tail(window).std() * np.sqrt(252))


def calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = -delta.where(delta < 0, 0).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))