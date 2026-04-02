from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import StockData
from services.data_fetcher import COMPANIES, fetch_and_store_stock_data

# IMPORTANT: Create tables before doing anything
Base.metadata.create_all(bind=engine)

db: Session = SessionLocal()

print("Starting data fetch process...")

for symbol in list(COMPANIES.keys()):
    # Clear previous data for this symbol
    db.query(StockData).filter(StockData.symbol == symbol).delete()
    db.commit()   # commit the delete
    
    print(f"Fetching data for {symbol}...")
    fetch_and_store_stock_data(db, symbol, period="1y")

db.close()
print("Data loading completed successfully.")