from sqlalchemy import Column, Integer, String, Float, Date
from app.database import Base
from datetime import date

class StockData(Base):
    __tablename__ = "stock_data"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True, nullable=False)
    date = Column(Date, index=True, nullable=False)
    open_price = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    daily_return = Column(Float, nullable=False)   # (close - open_price) / open_price
    ma_7 = Column(Float)                           # 7-day moving average
    volatility = Column(Float)                     # annualized volatility (custom metric)
    rsi = Column(Float)                            # 14-day RSI (additional technical indicator)