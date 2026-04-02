from fastapi import FastAPI, Depends, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
import numpy as np

from app.database import engine, Base, get_db
from app.models import StockData
from services.data_fetcher import COMPANIES

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Stock Data Intelligence Dashboard",
    description="NSE Stock Analysis — Internship Assignment",
    version="1.0.0"
)

app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    with open("static/index.html", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.get("/companies")
def get_companies(db: Session = Depends(get_db)):
    symbols = db.query(StockData.symbol).distinct().all()
    return [
        {"symbol": s[0], "name": COMPANIES.get(s[0], "Unknown")}
        for s in symbols
    ]


@app.get("/data/{symbol}")
def get_stock_data(symbol: str, days: int = 30, db: Session = Depends(get_db)):
    # fetch most recent N records, then reverse so chart renders left-to-right
    records = db.query(StockData)\
        .filter(StockData.symbol == symbol)\
        .order_by(StockData.date.desc())\
        .limit(days).all()

    if not records:
        return {"error": "No data found"}

    records = list(reversed(records))

    return [
        {
            "date": str(r.date),
            "open": r.open_price,
            "high": r.high,
            "low": r.low,
            "close": r.close,
            "volume": r.volume,
            "daily_return": r.daily_return,
            "ma_7": r.ma_7,
            "volatility": getattr(r, "volatility", None),
            "rsi": getattr(r, "rsi", None)
        }
        for r in records
    ]


@app.get("/summary/{symbol}")
def get_summary(symbol: str, db: Session = Depends(get_db)):
    # 52-week window — only last 365 days
    cutoff = date.today() - timedelta(days=365)

    result = db.query(
        func.max(StockData.close),
        func.min(StockData.close),
        func.avg(StockData.close)
    ).filter(
        StockData.symbol == symbol,
        StockData.date >= cutoff
    ).first()

    if not result or result[0] is None:
        return {"error": "No data found for symbol"}

    # get all records for prediction and latest metrics
    records = db.query(StockData)\
        .filter(StockData.symbol == symbol)\
        .order_by(StockData.date.asc())\
        .all()

    closes = [r.close for r in records]

    # simple linear regression for next-day estimate
    prediction = None
    if len(closes) >= 10:
        x = np.arange(len(closes))
        slope, _ = np.polyfit(x, closes, 1)
        prediction = closes[-1] + slope

    return {
        "symbol": symbol,
        "week_52_high": float(result[0]),
        "week_52_low": float(result[1]),
        "avg_close": float(result[2]),
        "volatility": float(getattr(records[-1], "volatility", 0.0)) if records else 0.0,
        "rsi": float(getattr(records[-1], "rsi", 0.0)) if records else 0.0,
        "predicted_next_close": round(prediction, 2) if prediction is not None else None
    }


@app.get("/gainers_losers")
def get_gainers_losers(db: Session = Depends(get_db)):
    # compare latest close vs close 30 days ago for each symbol
    results = []
    for symbol in COMPANIES:
        recent = db.query(StockData)\
            .filter(StockData.symbol == symbol)\
            .order_by(StockData.date.desc())\
            .limit(31).all()

        if len(recent) < 2:
            continue

        latest_close = recent[0].close
        old_close = recent[-1].close
        change_pct = ((latest_close - old_close) / old_close) * 100

        results.append({
            "symbol": symbol,
            "name": COMPANIES.get(symbol, symbol),
            "latest_close": round(latest_close, 2),
            "change_pct": round(change_pct, 2)
        })

    results.sort(key=lambda x: x["change_pct"], reverse=True)
    return {
        "gainers": results[:3],
        "losers": results[-3:][::-1]
    }


@app.get("/compare")
def compare_stocks(
    symbol1: str = Query(...),
    symbol2: str = Query(...),
    db: Session = Depends(get_db)
):
    def get_metrics(symbol):
        cutoff = date.today() - timedelta(days=365)
        result = db.query(
            func.max(StockData.close),
            func.min(StockData.close),
            func.avg(StockData.close)
        ).filter(
            StockData.symbol == symbol,
            StockData.date >= cutoff
        ).first()

        records = db.query(StockData)\
            .filter(StockData.symbol == symbol)\
            .order_by(StockData.date.desc())\
            .limit(30).all()

        if not records or not result[0]:
            return None

        avg_return = sum(r.daily_return for r in records) / len(records)

        return {
            "symbol": symbol,
            "name": COMPANIES.get(symbol, symbol),
            "week_52_high": round(float(result[0]), 2),
            "week_52_low": round(float(result[1]), 2),
            "avg_close": round(float(result[2]), 2),
            "volatility": round(float(getattr(records[0], "volatility", 0.0)), 4),
            "rsi": round(float(getattr(records[0], "rsi", 0.0)), 2),
            "avg_daily_return_pct": round(avg_return * 100, 4)
        }

    return {
        "stock1": get_metrics(symbol1),
        "stock2": get_metrics(symbol2)
    }