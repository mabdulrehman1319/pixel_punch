# pixel_punch

A full-stack PC gaming benchmark web app that predicts FPS, resource usage, and thermal performance based on user hardware specs. Built by adding persistent data, user accounts, and social features backed by SQL Server.

## Features
- User authentication and hardware profile management
- FPS, CPU/GPU/RAM usage, and thermal performance predictions via a custom weighted-scoring algorithm
- Benchmark history tracking
- PC-to-PC comparisons
- Game reviews and comments
- Notifications

## Tech Stack
- **Backend:** Flask (Python), pyodbc
- **Database:** SQL Server (Windows Authentication) — 12 normalized tables with stored procedures, triggers, and user-defined functions
- **Frontend:** HTML, CSS, JavaScript

## Project Structure
pixel_punch/
├── backend/
│   ├── app.py
│   ├── benchmark_algorithm.py
│   └── requirements.txt
├── frontend/
│   └── (HTML, CSS, JS files)
└── PixelPunchDB.sql

## Setup
1. **Clone the repository**
```bash
   git clone https://github.com/mabdulrehman1319/pixel_punch.git
   cd pixel_punch
```

2. **Set up the database**
   - Open SQL Server Management Studio
   - Run `PixelPunchDB.sql` to create the database, tables, stored procedures, triggers, and functions

3. **Set up the backend**
```bash
   cd backend
   pip install -r requirements.txt
```
   Create a `.env` file in the `backend/` folder with:
   FLASK_SECRET_KEY=your-own-generated-secret-key
   Generate a key with:
```bash
   python -c "import secrets; print(secrets.token_hex(32))"
```

4. **Run the app**
```bash
   python app.py
```

5. **Open the frontend**
   - Visit `http://localhost:5000` in your browser

## Requirements
- Python 3.x
- SQL Server with Windows Authentication enabled
- ODBC Driver for SQL Server

## Author
Muhammad Abdul Rehman
