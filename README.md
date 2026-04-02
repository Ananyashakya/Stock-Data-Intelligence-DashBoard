# Stock Data Intelligence Dashboard

A full-stack financial data dashboard that collects, processes, and visualizes stock market data with interactive analytics and insights.

---

## Overview

This project demonstrates the ability to work with financial datasets, build REST APIs using FastAPI, perform data analysis using Pandas and NumPy, and design an interactive dashboard interface. It reflects a structured approach to backend development, data processing, and frontend visualization.

---

## Features

### Data Processing

* Cleaned and structured stock data using Pandas
* Implemented key financial metrics:

  * Daily Return
  * 7-Day Moving Average
  * 52-Week High and Low
  * Volatility
  * Relative Strength Index (RSI)

---

### Backend APIs

| Endpoint            | Description                             |
| ------------------- | --------------------------------------- |
| `/companies`        | Returns list of available companies     |
| `/data/{symbol}`    | Returns last 30 days of stock data      |
| `/summary/{symbol}` | Returns 52-week statistics and insights |
| `/compare`          | Compares two stocks                     |
| `/gainers_losers`   | Returns top performing stocks           |

* Built using FastAPI with modular structure
* Efficient database queries using SQLAlchemy
* Interactive API documentation available via Swagger

---

### Visualization Dashboard

* Sidebar for selecting companies
* Interactive stock price chart using Chart.js
* Time filters (30, 90, 180 days)
* Moving average overlay
* RSI visualization
* 52-week range indicator
* Top gainers and losers panel
* Stock comparison interface
* Trend-based prediction display

---

### Prediction Feature

A lightweight trend-based forecasting approach is implemented using linear regression with NumPy to estimate the next closing price.

---

## Technology Stack

* Backend: FastAPI (Python)
* Database: SQLite
* Data Processing: Pandas, NumPy
* Frontend: HTML, CSS, JavaScript
* Visualization: Chart.js
* Deployment: Render (optional)
* Containerization: Docker

---

## Project Structure

```
stock-dashboard/
├── app/
│   ├── main.py
│   ├── models.py
│   ├── database.py
├── services/
│   ├── data_fetcher.py
│   ├── calculations.py
├── static/
│   ├── index.html
│   ├── script.js
│   ├── styles.css
├── fetch_data.py
├── requirements.txt
├── Dockerfile
```

---

## Setup Instructions

### 1. Clone the repository

```
git clone https://github.com/Ananyashakya/Stock-Data-Intelligence-DashBoard.
cd stock-dashboard
```

### 2. Install dependencies

```
pip install -r requirements.txt
```

### 3. Run data preparation script

```
python fetch_data.py
```

### 4. Start the application

```
uvicorn app.main:app --reload
```

### 5. Access the application

```
http://127.0.0.1:8000
```

---

## API Documentation

Swagger UI is available at:

```
http://127.0.0.1:8000/docs
```

---

## Key Highlights

* Clean and modular backend architecture
* Efficient handling of financial data
* Feature-rich and interactive dashboard
* Implementation of analytical metrics such as RSI and volatility
* Includes prediction logic for trend estimation

---

## Future Enhancements

* Integration of real-time stock data APIs
* Advanced prediction models using machine learning libraries
* Performance improvements through caching
* User authentication and personalization
