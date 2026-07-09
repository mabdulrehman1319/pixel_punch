from flask import Flask, request, jsonify, send_from_directory, session
from dotenv import load_dotenv
from flask_cors import CORS
import pyodbc
import hashlib
import os
from benchmark_algorithm import BenchmarkCalculator

app = Flask(__name__, static_folder='../frontend')
load_dotenv()
app.secret_key = os.environ.get('FLASK_SECRET_KEY')
CORS(app, supports_credentials=True)


def get_db_connection():
    conn = pyodbc.connect(
        'DRIVER={ODBC Driver 17 for SQL Server};'
        'SERVER=abdulrehman\\SQLEXPRESS;'  #your own sql server name        
        'DATABASE=PixelPunchDB;'
        'Trusted_Connection=yes;'   
    )
    return conn


def hash_password(password: str) -> str:
    """Return SHA-256 hex digest of the given password."""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()



SUPPORTED_GAMES = [
    "Grand Theft Auto V",
    "Red Dead Redemption 2",
    "Elden Ring",
    "Fortnite",
    "Assassin's Creed Mirage",
    "Mafia 3",
    "Forza Horizon 5",
    "Ghost of Tsushima",
    "Resident Evil 4 Remake",
    "Valorant",
    "Cyberpunk 2077",
    "The Witcher 3: Wild Hunt",
    "Minecraft",
    "Counter-Strike 2",
    "Baldur's Gate 3",
    "Hades",
    "Hogwarts Legacy",
    "Kingdom Come: Deliverance II",
    "Marvel Rivals",
    "Black Myth: Wukong",
]


# Serves the frontend's index page and static assets directly from Flask
@app.route('/')
def serve_index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)



# Auth routes: register, login, logout, and session check
@app.route('/api/register', methods=['POST'])
def register():
    """Register a new user and insert into the Users table."""
    try:
        data = request.get_json()

        # Validate required fields
        username = (data.get('username') or '').strip()
        email    = (data.get('email')    or '').strip()
        password = (data.get('password') or '').strip()

        if not username or not email or not password:
            return jsonify({"error": "Username, email, and password are required."}), 400

        if len(username) < 3:
            return jsonify({"error": "Username must be at least 3 characters."}), 400

        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters."}), 400

        # Hash password before storing it
        password_hash = hash_password(password)

        # Insert into DB
        conn   = get_db_connection()
        cursor = conn.cursor()

        # Check if username already exists
        cursor.execute("SELECT UserID FROM Users WHERE Username = ?", (username,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": "Username already taken. Please choose another."}), 409

        # Check if email already exists
        cursor.execute("SELECT UserID FROM Users WHERE Email = ?", (email,))
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": "An account with this email already exists."}), 409

        # Insert new user
        cursor.execute(
            "INSERT INTO Users (Username, Email, PasswordHash) VALUES (?, ?, ?)",
            (username, email, password_hash)
        )
        conn.commit()

        # Get the newly created UserID
        cursor.execute("SELECT UserID FROM Users WHERE Username = ?", (username,))
        user = cursor.fetchone()
        conn.close()

        # Auto-login after registration
        session['user_id']  = user.UserID
        session['username'] = username

        return jsonify({
            "message": "Account created successfully! Welcome to Pixel Punch.",
            "username": username,
            "user_id":  user.UserID
        }), 201

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    """Login an existing user."""
    try:
        data = request.get_json()

        username = (data.get('username') or '').strip()
        password = (data.get('password') or '').strip()

        if not username or not password:
            return jsonify({"error": "Username and password are required."}), 400

        password_hash = hash_password(password)

        conn   = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "SELECT UserID, Username FROM Users WHERE Username = ? AND PasswordHash = ?",
            (username, password_hash)
        )
        user = cursor.fetchone()
        conn.close()

        if not user:
            return jsonify({"error": "Invalid username or password."}), 401

        # Store user info in session
        session['user_id']  = user.UserID
        session['username'] = user.Username

        return jsonify({
            "message": f"Welcome back, {user.Username}!",
            "username": user.Username,
            "user_id":  user.UserID
        }), 200

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/logout', methods=['POST'])
def logout():
    """Clear the user session."""
    session.clear()
    return jsonify({"message": "Logged out successfully."}), 200


@app.route('/api/me', methods=['GET'])
def me():
    """Return the currently logged-in user (used by frontend on page load)."""
    if 'user_id' in session:
        return jsonify({
            "logged_in": True,
            "username":  session['username'],
            "user_id":   session['user_id']
        }), 200
    return jsonify({"logged_in": False}), 200


# DB helper functions - get an existing row or create it if it doesn't exist yet

def get_or_create_cpu(cursor, cpu_name, cpu_speed):
    """
    Return CPUID for given CPU, inserting a new row if it doesn't exist.
    CPU_Brand is derived from cpu_name (e.g. 'Intel Core i7' → brand='Intel').
    PerformanceTier is mapped from cpu_name tier (i3=3, i5=5, i7=7, i9=9).
    """
    cursor.execute(
        "SELECT CPUID FROM CPUs WHERE CPU_Name = ? AND BaseClock = ?",
        (cpu_name, cpu_speed)
    )
    row = cursor.fetchone()
    if row:
        return row.CPUID

    # Derive brand and tier from name
    brand = 'Intel'
    tier  = 5
    cores = 8
    if 'i3' in cpu_name:
        tier, cores = 3, 4
    elif 'i5' in cpu_name:
        tier, cores = 5, 6
    elif 'i7' in cpu_name:
        tier, cores = 7, 8
    elif 'i9' in cpu_name:
        tier, cores = 9, 16
    if 'AMD' in cpu_name or 'Ryzen' in cpu_name:
        brand = 'AMD'
        # Ryzen-specific tier and core mapping
        if 'Ryzen 3' in cpu_name:
            tier, cores = 3, 4
        elif 'Ryzen 5' in cpu_name:
            tier, cores = 5, 6
        elif 'Ryzen 7' in cpu_name:
            tier, cores = 7, 8
        elif 'Ryzen 9' in cpu_name:
            tier, cores = 9, 16

    cursor.execute(
        """INSERT INTO CPUs (CPU_Name, CPU_Brand, Cores, BaseClock, PerformanceTier)
           VALUES (?, ?, ?, ?, ?)""",
        (cpu_name, brand, cores, cpu_speed, tier)
    )
    cursor.execute(
        "SELECT CPUID FROM CPUs WHERE CPU_Name = ? AND BaseClock = ?",
        (cpu_name, cpu_speed)
    )
    return cursor.fetchone().CPUID


def get_or_create_gpu(cursor, gpu_name, gpu_memory):
    """
    Return GPUID for given GPU, inserting a new row if it doesn't exist.
    ScoreMultiplier and Tier are estimated from VRAM size.
    """
    cursor.execute(
        "SELECT GPUID FROM GPUs WHERE GPU_Name = ? AND VRAM = ?",
        (gpu_name, gpu_memory)
    )
    row = cursor.fetchone()
    if row:
        return row.GPUID

    # Derive brand
    brand = 'NVIDIA'
    if 'AMD' in gpu_name or 'Radeon' in gpu_name or 'RX' in gpu_name:
        brand = 'AMD'
    elif 'Intel' in gpu_name or 'Arc' in gpu_name:
        brand = 'Intel'

    # Estimate tier and multiplier from VRAM
    if gpu_memory >= 16:
        tier, multiplier = 9, 1.8
    elif gpu_memory >= 12:
        tier, multiplier = 8, 1.5
    elif gpu_memory >= 8:
        tier, multiplier = 6, 1.2
    elif gpu_memory >= 4:
        tier, multiplier = 4, 1.0
    else:
        tier, multiplier = 2, 0.7

    cursor.execute(
        """INSERT INTO GPUs (GPU_Name, GPU_Brand, VRAM, ScoreMultiplier, Tier)
           VALUES (?, ?, ?, ?, ?)""",
        (gpu_name, brand, gpu_memory, multiplier, tier)
    )
    cursor.execute(
        "SELECT GPUID FROM GPUs WHERE GPU_Name = ? AND VRAM = ?",
        (gpu_name, gpu_memory)
    )
    return cursor.fetchone().GPUID


def get_or_create_game(cursor, game_title):
    """
    Return GameID for a game title, inserting if not found.
    DifficultyMultiplier is pulled from BenchmarkCalculator's own dictionary.
    """
    cursor.execute("SELECT GameID FROM Games WHERE Title = ?", (game_title,))
    row = cursor.fetchone()
    if row:
        return row.GameID

    difficulty_map = {
        "Grand Theft Auto V": 0.7,
        "Red Dead Redemption 2": 1.0,
        "Elden Ring": 0.8,
        "Fortnite": 0.5,
        "Assassin's Creed Mirage": 0.75,
        "Mafia 3": 0.65,
        "Forza Horizon 5": 0.85,
        "Ghost of Tsushima": 0.9,
        "Resident Evil 4 Remake": 0.8,
        "Valorant": 0.3,
        # New games
        "Cyberpunk 2077": 1.1,
        "The Witcher 3: Wild Hunt": 0.75,
        "Minecraft": 0.25,
        "Counter-Strike 2": 0.35,
        "Baldur's Gate 3": 0.85,
        "Hades": 0.3,
        "Hogwarts Legacy": 1.05,
        "Kingdom Come: Deliverance II": 1.0,
        "Marvel Rivals": 0.6,
        "Black Myth: Wukong": 1.15,
    }
    genre_map = {
        "Grand Theft Auto V": "Action-Adventure",
        "Red Dead Redemption 2": "Action-Adventure",
        "Elden Ring": "RPG",
        "Fortnite": "Battle Royale",
        "Assassin's Creed Mirage": "Action-Adventure",
        "Mafia 3": "Action-Adventure",
        "Forza Horizon 5": "Racing",
        "Ghost of Tsushima": "Action-Adventure",
        "Resident Evil 4 Remake": "Survival Horror",
        "Valorant": "FPS",
        # New games
        "Cyberpunk 2077": "RPG",
        "The Witcher 3: Wild Hunt": "RPG",
        "Minecraft": "Sandbox",
        "Counter-Strike 2": "FPS",
        "Baldur's Gate 3": "RPG",
        "Hades": "Roguelike",
        "Hogwarts Legacy": "Action RPG",
        "Kingdom Come: Deliverance II": "RPG",
        "Marvel Rivals": "Hero Shooter",
        "Black Myth: Wukong": "Action RPG",
    }
    min_vram_map = {
        "Grand Theft Auto V": 2, "Red Dead Redemption 2": 8,
        "Elden Ring": 4, "Fortnite": 4, "Assassin's Creed Mirage": 8,
        "Mafia 3": 2, "Forza Horizon 5": 8, "Ghost of Tsushima": 8,
        "Resident Evil 4 Remake": 8, "Valorant": 1,
        # New games
        "Cyberpunk 2077": 8, "The Witcher 3: Wild Hunt": 4,
        "Minecraft": 2, "Counter-Strike 2": 2,
        "Baldur's Gate 3": 8, "Hades": 2,
        "Hogwarts Legacy": 8, "Kingdom Come: Deliverance II": 8,
        "Marvel Rivals": 8, "Black Myth: Wukong": 8,
    }
    min_ram_map = {
        "Grand Theft Auto V": 8, "Red Dead Redemption 2": 12,
        "Elden Ring": 12, "Fortnite": 8, "Assassin's Creed Mirage": 16,
        "Mafia 3": 8, "Forza Horizon 5": 16, "Ghost of Tsushima": 16,
        "Resident Evil 4 Remake": 16, "Valorant": 4,
        # New games
        "Cyberpunk 2077": 16, "The Witcher 3: Wild Hunt": 8,
        "Minecraft": 8, "Counter-Strike 2": 8,
        "Baldur's Gate 3": 16, "Hades": 8,
        "Hogwarts Legacy": 16, "Kingdom Come: Deliverance II": 16,
        "Marvel Rivals": 16, "Black Myth: Wukong": 16,
    }

    cursor.execute(
        """INSERT INTO Games (Title, Genre, DifficultyMultiplier, MinVRAM, MinRAM)
           VALUES (?, ?, ?, ?, ?)""",
        (
            game_title,
            genre_map.get(game_title, 'Action'),
            difficulty_map.get(game_title, 0.7),
            min_vram_map.get(game_title, 4),
            min_ram_map.get(game_title, 8)
        )
    )
    cursor.execute("SELECT GameID FROM Games WHERE Title = ?", (game_title,))
    return cursor.fetchone().GameID


# Runs a benchmark and saves the result to the DB if the user is logged in
@app.route('/api/benchmark', methods=['POST'])
def benchmark():
    """Handle benchmark requests. Saves results to DB if user is logged in."""

    # Block guests — user must be logged in
    if 'user_id' not in session:
        return jsonify({"error": "You must be logged in to run a benchmark."}), 401

    try:
        data = request.get_json()

        required_fields = ['cpu_name', 'cpu_speed', 'ram_size', 'gpu_name', 'gpu_memory', 'game']
        for field in required_fields:
            if field not in data:
                return jsonify({"error": f"Missing required field: {field}"}), 400

        if data['game'] not in SUPPORTED_GAMES:
            return jsonify({"error": "Invalid game selection"}), 400

        try:
            cpu_speed  = float(data['cpu_speed'])
            ram_size   = int(data['ram_size'])
            gpu_memory = int(data['gpu_memory'])
        except ValueError:
            return jsonify({"error": "Invalid numeric values"}), 400

        # Calculate benchmark results
        calculator = BenchmarkCalculator(
            cpu_name   = data['cpu_name'],
            cpu_speed  = cpu_speed,
            ram_size   = ram_size,
            gpu_name   = data['gpu_name'],
            gpu_memory = gpu_memory,
            game       = data['game']
        )
        results = calculator.get_results()

        # Save to database
        conn   = get_db_connection()
        cursor = conn.cursor()

        cpu_id  = get_or_create_cpu(cursor, data['cpu_name'], cpu_speed)
        gpu_id  = get_or_create_gpu(cursor, data['gpu_name'], gpu_memory)
        game_id = get_or_create_game(cursor, data['game'])

        # Average of avg_cpu and avg_gpu temperatures for Avg_Temp / Peak_Temp
        avg_temp  = (results['temperature']['avg_cpu'] + results['temperature']['avg_gpu']) / 2
        peak_temp = max(results['temperature']['max_cpu'], results['temperature']['max_gpu'])

        cursor.execute(
            """INSERT INTO BenchmarkResults
               (UserID, GameID, CPUID, GPUID, RAM,
                MinFPS, AvgFPS, MaxFPS,
                CPU_Usage, GPU_Usage, RAM_Usage,
                Avg_Temp, Peak_Temp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                session['user_id'], game_id, cpu_id, gpu_id, ram_size,
                results['fps']['min'], results['fps']['avg'], results['fps']['max'],
                results['usage']['cpu'], results['usage']['gpu'], results['usage']['ram'],
                avg_temp, peak_temp
            )
        )
        conn.commit()

        # Get the ResultID just inserted
        cursor.execute("SELECT MAX(ResultID) AS rid FROM BenchmarkResults WHERE UserID = ?", (session['user_id'],))
        result_id = cursor.fetchone().rid

        # Notify user
        create_notification(cursor, session['user_id'],
            f"✅ Benchmark saved for {data['game']} — Avg FPS: {results['fps']['avg']}")
        conn.commit()
        conn.close()

        # Add result_id to response so frontend can reference it
        results['result_id'] = result_id
        results['saved'] = True
        return jsonify(results), 200

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Returns the logged-in user's last 10 benchmark results
@app.route('/api/benchmark/history', methods=['GET'])
def benchmark_history():
    """Return the last 10 benchmark results for the logged-in user."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401

    try:
        conn   = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """SELECT TOP 10
                br.ResultID, g.Title AS Game,
                c.CPU_Name, gp.GPU_Name,
                br.RAM, br.MinFPS, br.AvgFPS, br.MaxFPS,
                br.CPU_Usage, br.GPU_Usage, br.RAM_Usage,
                br.Avg_Temp, br.Peak_Temp, br.Time_Stamp
               FROM BenchmarkResults br
               JOIN Games  g  ON br.GameID = g.GameID
               JOIN CPUs   c  ON br.CPUID  = c.CPUID
               JOIN GPUs   gp ON br.GPUID  = gp.GPUID
               WHERE br.UserID = ?
               ORDER BY br.Time_Stamp DESC""",
            (session['user_id'],)
        )
        rows = cursor.fetchall()
        conn.close()

        history = []
        for r in rows:
            history.append({
                "result_id":  r.ResultID,
                "game":       r.Game,
                "cpu":        r.CPU_Name,
                "gpu":        r.GPU_Name,
                "ram":        r.RAM,
                "fps": {"min": float(r.MinFPS), "avg": float(r.AvgFPS), "max": float(r.MaxFPS)},
                "usage": {"cpu": float(r.CPU_Usage), "gpu": float(r.GPU_Usage), "ram": float(r.RAM_Usage)},
                "temperature": {"avg": float(r.Avg_Temp), "peak": float(r.Peak_Temp)},
                "timestamp":  str(r.Time_Stamp)
            })

        return jsonify({"history": history}), 200

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/supported-games', methods=['GET'])
def get_supported_games():
    return jsonify({"games": SUPPORTED_GAMES}), 200


# Hardware profile routes - save, list, and delete a user's PC specs

@app.route('/api/profiles', methods=['GET'])
def get_profiles():
    """Return all saved hardware profiles for the logged-in user."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT hp.ProfileID, hp.ProfileName, hp.RAM,
                      c.CPU_Name, c.BaseClock,
                      g.GPU_Name, g.VRAM
               FROM HardwareProfiles hp
               JOIN CPUs c ON hp.CPUID = c.CPUID
               JOIN GPUs g ON hp.GPUID = g.GPUID
               WHERE hp.UserID = ?
               ORDER BY hp.ProfileID DESC""",
            (session['user_id'],)
        )
        rows = cursor.fetchall()
        conn.close()
        profiles = []
        for r in rows:
            profiles.append({
                "profile_id":   r.ProfileID,
                "profile_name": r.ProfileName,
                "cpu_name":     r.CPU_Name,
                "cpu_speed":    float(r.BaseClock),
                "ram":          r.RAM,
                "gpu_name":     r.GPU_Name,
                "gpu_memory":   r.VRAM
            })
        return jsonify({"profiles": profiles}), 200
    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/profiles', methods=['POST'])
def save_profile():
    """Save a new hardware profile for the logged-in user."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401
    try:
        data = request.get_json()
        profile_name = (data.get('profile_name') or '').strip()
        cpu_name     = (data.get('cpu_name')     or '').strip()
        gpu_name     = (data.get('gpu_name')     or '').strip()
        if not profile_name:
            return jsonify({"error": "Profile name is required."}), 400
        if not cpu_name or not gpu_name:
            return jsonify({"error": "CPU and GPU are required."}), 400
        try:
            cpu_speed  = float(data['cpu_speed'])
            ram        = int(data['ram'])
            gpu_memory = int(data['gpu_memory'])
        except (ValueError, KeyError):
            return jsonify({"error": "Invalid numeric values."}), 400

        conn   = get_db_connection()
        cursor = conn.cursor()

        # Check duplicate profile name for this user
        cursor.execute(
            "SELECT ProfileID FROM HardwareProfiles WHERE UserID = ? AND ProfileName = ?",
            (session['user_id'], profile_name)
        )
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": f"You already have a profile named '{profile_name}'."}), 409

        cpu_id = get_or_create_cpu(cursor, cpu_name, cpu_speed)
        gpu_id = get_or_create_gpu(cursor, gpu_name, gpu_memory)

        cursor.execute(
            """INSERT INTO HardwareProfiles (UserID, CPUID, GPUID, RAM, ProfileName)
               VALUES (?, ?, ?, ?, ?)""",
            (session['user_id'], cpu_id, gpu_id, ram, profile_name)
        )
        conn.commit()

        cursor.execute(
            "SELECT ProfileID FROM HardwareProfiles WHERE UserID = ? AND ProfileName = ?",
            (session['user_id'], profile_name)
        )
        new_id = cursor.fetchone().ProfileID
        conn.close()

        return jsonify({
            "message":    f"Profile '{profile_name}' saved successfully!",
            "profile_id": new_id
        }), 201

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/profiles/<int:profile_id>', methods=['DELETE'])
def delete_profile(profile_id):
    """Delete a hardware profile (only if it belongs to the logged-in user)."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT ProfileID FROM HardwareProfiles WHERE ProfileID = ? AND UserID = ?",
            (profile_id, session['user_id'])
        )
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Profile not found."}), 404
        cursor.execute("DELETE FROM HardwareProfiles WHERE ProfileID = ?", (profile_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Profile deleted."}), 200
    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Comparison routes - compare two saved benchmark results side by side

@app.route('/api/compare', methods=['POST'])
def compare_benchmarks():
    """Compare two benchmark results and save the comparison."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401
    try:
        data = request.get_json()
        result_id_a = data.get('result_id_a')
        result_id_b = data.get('result_id_b')

        if not result_id_a or not result_id_b:
            return jsonify({"error": "Two result IDs are required."}), 400
        if result_id_a == result_id_b:
            return jsonify({"error": "Please select two different results."}), 400

        conn   = get_db_connection()
        cursor = conn.cursor()

        def fetch_result(rid):
            cursor.execute(
                """SELECT br.ResultID, g.Title AS Game,
                          c.CPU_Name, c.BaseClock,
                          gp.GPU_Name, gp.VRAM,
                          br.RAM, br.MinFPS, br.AvgFPS, br.MaxFPS,
                          br.CPU_Usage, br.GPU_Usage, br.RAM_Usage,
                          br.Avg_Temp, br.Peak_Temp, br.Time_Stamp
                   FROM BenchmarkResults br
                   JOIN Games  g  ON br.GameID = g.GameID
                   JOIN CPUs   c  ON br.CPUID  = c.CPUID
                   JOIN GPUs   gp ON br.GPUID  = gp.GPUID
                   WHERE br.ResultID = ? AND br.UserID = ?""",
                (rid, session['user_id'])
            )
            return cursor.fetchone()

        r_a = fetch_result(result_id_a)
        r_b = fetch_result(result_id_b)

        if not r_a:
            conn.close()
            return jsonify({"error": "Result A not found or does not belong to you."}), 404
        if not r_b:
            conn.close()
            return jsonify({"error": "Result B not found or does not belong to you."}), 404

        # Save comparison to BenchmarkComparisons table
        cursor.execute(
            """INSERT INTO BenchmarkComparisons (ResultID_A, ResultID_B, UserID)
               VALUES (?, ?, ?)""",
            (result_id_a, result_id_b, session['user_id'])
        )
        conn.commit()

        def row_to_dict(r):
            return {
                "result_id":  r.ResultID,
                "game":       r.Game,
                "cpu":        f"{r.CPU_Name} @ {float(r.BaseClock)}GHz",
                "gpu":        f"{r.GPU_Name} ({r.VRAM}GB)",
                "ram":        r.RAM,
                "fps": {
                    "min": float(r.MinFPS),
                    "avg": float(r.AvgFPS),
                    "max": float(r.MaxFPS)
                },
                "usage": {
                    "cpu": float(r.CPU_Usage),
                    "gpu": float(r.GPU_Usage),
                    "ram": float(r.RAM_Usage)
                },
                "temperature": {
                    "avg":  float(r.Avg_Temp),
                    "peak": float(r.Peak_Temp)
                },
                "timestamp": str(r.Time_Stamp)
            }

        conn.close()
        return jsonify({
            "message":  "Comparison saved!",
            "result_a": row_to_dict(r_a),
            "result_b": row_to_dict(r_b)
        }), 200

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/compare/history', methods=['GET'])
def compare_history():
    """Return past comparisons for the logged-in user."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """SELECT TOP 5
                bc.ComparisonID, bc.CreatedAt,
                ga.Title AS GameA, gc.Title AS GameB,
                brA.AvgFPS AS AvgFPS_A, brB.AvgFPS AS AvgFPS_B,
                ca.CPU_Name AS CPU_A,  cb.CPU_Name AS CPU_B,
                gpA.GPU_Name AS GPU_A, gpB.GPU_Name AS GPU_B
               FROM BenchmarkComparisons bc
               JOIN BenchmarkResults brA ON bc.ResultID_A = brA.ResultID
               JOIN BenchmarkResults brB ON bc.ResultID_B = brB.ResultID
               JOIN Games  ga  ON brA.GameID = ga.GameID
               JOIN Games  gc  ON brB.GameID = gc.GameID
               JOIN CPUs   ca  ON brA.CPUID  = ca.CPUID
               JOIN CPUs   cb  ON brB.CPUID  = cb.CPUID
               JOIN GPUs   gpA ON brA.GPUID  = gpA.GPUID
               JOIN GPUs   gpB ON brB.GPUID  = gpB.GPUID
               WHERE bc.UserID = ?
               ORDER BY bc.CreatedAt DESC""",
            (session['user_id'],)
        )
        rows = cursor.fetchall()
        conn.close()

        history = []
        for r in rows:
            history.append({
                "comparison_id": r.ComparisonID,
                "created_at":    str(r.CreatedAt),
                "a": {"game": r.GameA, "cpu": r.CPU_A, "gpu": r.GPU_A, "avg_fps": float(r.AvgFPS_A)},
                "b": {"game": r.GameB, "cpu": r.CPU_B, "gpu": r.GPU_B, "avg_fps": float(r.AvgFPS_B)}
            })

        return jsonify({"history": history}), 200

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Game requirements route - checks a user's specs against a game's requirements

# Full requirements data for all supported games
GAME_REQUIREMENTS_DATA = {
    "Grand Theft Auto V": {
        "min_ram": 8, "recommended_ram": 16,
        "min_vram": 2, "recommended_vram": 4
    },
    "Red Dead Redemption 2": {
        "min_ram": 12, "recommended_ram": 16,
        "min_vram": 4, "recommended_vram": 8
    },
    "Elden Ring": {
        "min_ram": 12, "recommended_ram": 16,
        "min_vram": 4, "recommended_vram": 8
    },
    "Fortnite": {
        "min_ram": 8, "recommended_ram": 16,
        "min_vram": 2, "recommended_vram": 8
    },
    "Assassin's Creed Mirage": {
        "min_ram": 8, "recommended_ram": 16,
        "min_vram": 8, "recommended_vram": 12
    },
    "Mafia 3": {
        "min_ram": 8, "recommended_ram": 16,
        "min_vram": 2, "recommended_vram": 4
    },
    "Forza Horizon 5": {
        "min_ram": 8, "recommended_ram": 16,
        "min_vram": 4, "recommended_vram": 8
    },
    "Ghost of Tsushima": {
        "min_ram": 16, "recommended_ram": 16,
        "min_vram": 8, "recommended_vram": 8
    },
    "Resident Evil 4 Remake": {
        "min_ram": 8, "recommended_ram": 16,
        "min_vram": 4, "recommended_vram": 8
    },
    "Valorant": {
        "min_ram": 4, "recommended_ram": 8,
        "min_vram": 1, "recommended_vram": 4
    },
    # New games
    "Cyberpunk 2077": {
        "min_ram": 12, "recommended_ram": 16,
        "min_vram": 8, "recommended_vram": 12
    },
    "The Witcher 3: Wild Hunt": {
        "min_ram": 8, "recommended_ram": 16,
        "min_vram": 4, "recommended_vram": 8
    },
    "Minecraft": {
        "min_ram": 8, "recommended_ram": 16,
        "min_vram": 2, "recommended_vram": 4
    },
    "Counter-Strike 2": {
        "min_ram": 8, "recommended_ram": 16,
        "min_vram": 2, "recommended_vram": 8
    },
    "Baldur's Gate 3": {
        "min_ram": 8, "recommended_ram": 16,
        "min_vram": 8, "recommended_vram": 12
    },
    "Hades": {
        "min_ram": 8, "recommended_ram": 16,
        "min_vram": 2, "recommended_vram": 4
    },
    "Hogwarts Legacy": {
        "min_ram": 12, "recommended_ram": 16,
        "min_vram": 8, "recommended_vram": 12
    },
    "Kingdom Come: Deliverance II": {
        "min_ram": 16, "recommended_ram": 32,
        "min_vram": 8, "recommended_vram": 12
    },
    "Marvel Rivals": {
        "min_ram": 16, "recommended_ram": 16,
        "min_vram": 8, "recommended_vram": 8
    },
    "Black Myth: Wukong": {
        "min_ram": 16, "recommended_ram": 16,
        "min_vram": 8, "recommended_vram": 12
    },
}


@app.route('/api/requirements', methods=['POST'])
def check_requirements():
    """
    Check if user specs meet game requirements.
    Inserts into GameRequirements table if not already there,
    then compares user RAM/VRAM against min and recommended values.
    """
    try:
        data     = request.get_json()
        game     = (data.get('game') or '').strip()
        user_ram  = int(data.get('ram',  0))
        user_vram = int(data.get('vram', 0))

        if not game or game not in SUPPORTED_GAMES:
            return jsonify({"error": "Invalid game selection."}), 400
        if user_ram <= 0 or user_vram <= 0:
            return jsonify({"error": "Please select your RAM and VRAM."}), 400

        conn   = get_db_connection()
        cursor = conn.cursor()

        # Get or create Game row
        game_id = get_or_create_game(cursor, game)

        # Check if GameRequirements row already exists for this game
        cursor.execute(
            "SELECT ReqID, MinRAM, Recommended_RAM, Recommended_VRAM FROM GameRequirements WHERE GameID = ?",
            (game_id,)
        )
        req_row = cursor.fetchone()

        req_data = GAME_REQUIREMENTS_DATA[game]

        if not req_row:
            # Insert into GameRequirements table
            cursor.execute(
                """INSERT INTO GameRequirements
                   (GameID, MinRAM, Recommended_RAM, Recommended_VRAM)
                   VALUES (?, ?, ?, ?)""",
                (
                    game_id,
                    req_data['min_ram'],
                    req_data['recommended_ram'],
                    req_data['recommended_vram']
                )
            )
            conn.commit()
            min_ram  = req_data['min_ram']
            rec_ram  = req_data['recommended_ram']
            rec_vram = req_data['recommended_vram']
        else:
            min_ram  = req_row.MinRAM
            rec_ram  = req_row.Recommended_RAM
            rec_vram = req_row.Recommended_VRAM

        # Also get MinVRAM from Games table
        cursor.execute("SELECT MinVRAM, DifficultyMultiplier, Genre FROM Games WHERE GameID = ?", (game_id,))
        game_row = cursor.fetchone()
        min_vram = game_row.MinVRAM
        difficulty = float(game_row.DifficultyMultiplier)
        genre = game_row.Genre
        conn.close()

        # Build comparison results
        checks = {
            "min": {
                "ram":  {"required": min_ram,  "yours": user_ram,  "meets": user_ram  >= min_ram},
                "vram": {"required": min_vram,  "yours": user_vram, "meets": user_vram >= min_vram},
            },
            "recommended": {
                "ram":  {"required": rec_ram,  "yours": user_ram,  "meets": user_ram  >= rec_ram},
                "vram": {"required": rec_vram, "yours": user_vram, "meets": user_vram >= rec_vram},
            }
        }

        meets_min = checks["min"]["ram"]["meets"] and checks["min"]["vram"]["meets"]
        meets_rec = checks["recommended"]["ram"]["meets"] and checks["recommended"]["vram"]["meets"]

        if meets_rec:
            verdict = "recommended"
        elif meets_min:
            verdict = "minimum"
        else:
            verdict = "below"

        return jsonify({
            "game":       game,
            "genre":      genre,
            "difficulty": difficulty,
            "checks":     checks,
            "verdict":    verdict
        }), 200

    except (ValueError, TypeError):
        return jsonify({"error": "Invalid input values."}), 400
    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Settings routes - get and save a user's theme, resolution, and default game

@app.route('/api/settings', methods=['GET'])
def get_settings():
    """Return saved settings for the logged-in user."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """SELECT s.Theme, s.Resolution, g.Title AS DefaultGame
               FROM Settings s
               LEFT JOIN Games g ON s.Default_Game = g.GameID
               WHERE s.UserID = ?""",
            (session['user_id'],)
        )
        row = cursor.fetchone()
        conn.close()

        if not row:
            # Return defaults if no settings saved yet
            return jsonify({
                "theme":        "Dark",
                "resolution":   "1920x1080",
                "default_game": None
            }), 200

        return jsonify({
            "theme":        row.Theme,
            "resolution":   row.Resolution,
            "default_game": row.DefaultGame
        }), 200

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/settings', methods=['POST'])
def save_settings():
    """Insert or update settings for the logged-in user (one row per user)."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401
    try:
        data       = request.get_json()
        theme      = data.get('theme',      'Dark')
        resolution = data.get('resolution', '1920x1080')
        game_title = data.get('default_game', None)

        # Validate theme
        if theme not in ('Light', 'Dark'):
            return jsonify({"error": "Invalid theme. Must be Light or Dark."}), 400

        conn   = get_db_connection()
        cursor = conn.cursor()

        # Resolve default game to GameID (nullable)
        game_id = None
        if game_title and game_title in SUPPORTED_GAMES:
            game_id = get_or_create_game(cursor, game_title)

        # Check if settings row already exists for this user
        cursor.execute(
            "SELECT SettingID FROM Settings WHERE UserID = ?",
            (session['user_id'],)
        )
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                """UPDATE Settings
                   SET Theme = ?, Resolution = ?, Default_Game = ?
                   WHERE UserID = ?""",
                (theme, resolution, game_id, session['user_id'])
            )
        else:
            cursor.execute(
                """INSERT INTO Settings (UserID, Default_Game, Theme, Resolution)
                   VALUES (?, ?, ?, ?)""",
                (session['user_id'], game_id, theme, resolution)
            )

        conn.commit()
        conn.close()

        return jsonify({
            "message":      "Settings saved successfully!",
            "theme":        theme,
            "resolution":   resolution,
            "default_game": game_title
        }), 200

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Review routes - submit and fetch star ratings + written reviews for a game

@app.route('/api/reviews', methods=['POST'])
def submit_review():
    """Submit a game review. One review per user per game."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401
    try:
        data        = request.get_json()
        game        = (data.get('game') or '').strip()
        star_rating = int(data.get('star_rating', 0))
        review_text = (data.get('review_text') or '').strip()

        if not game or game not in SUPPORTED_GAMES:
            return jsonify({"error": "Invalid game selection."}), 400
        if star_rating < 1 or star_rating > 5:
            return jsonify({"error": "Rating must be between 1 and 5."}), 400
        if not review_text:
            return jsonify({"error": "Review text cannot be empty."}), 400

        conn   = get_db_connection()
        cursor = conn.cursor()

        game_id = get_or_create_game(cursor, game)

        # One review per user per game — check if already reviewed
        cursor.execute(
            "SELECT ReviewID FROM Reviews WHERE UserID = ? AND GameID = ?",
            (session['user_id'], game_id)
        )
        if cursor.fetchone():
            conn.close()
            return jsonify({"error": "You have already reviewed this game. Each user can only submit one review per game."}), 409

        cursor.execute(
            """INSERT INTO Reviews (UserID, GameID, StarRating, ReviewText)
               VALUES (?, ?, ?, ?)""",
            (session['user_id'], game_id, star_rating, review_text)
        )
        # Notify user
        create_notification(cursor, session['user_id'],
            f"⭐ Your {star_rating}-star review for {game} was submitted successfully.")
        conn.commit()
        conn.close()

        return jsonify({"message": "Review submitted successfully!"}), 201

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/reviews/<path:game>', methods=['GET'])
def get_reviews(game):
    """Get all reviews for a specific game."""
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()

        # Check game exists
        cursor.execute("SELECT GameID FROM Games WHERE Title = ?", (game,))
        game_row = cursor.fetchone()
        if not game_row:
            conn.close()
            return jsonify({"reviews": [], "avg_rating": None, "total": 0}), 200

        cursor.execute(
            """SELECT r.ReviewID, u.Username, r.StarRating,
                      r.ReviewText, r.CreatedAt
               FROM Reviews r
               JOIN Users u ON r.UserID = u.UserID
               WHERE r.GameID = ?
               ORDER BY r.CreatedAt DESC""",
            (game_row.GameID,)
        )
        rows = cursor.fetchall()

        # Calculate average rating
        cursor.execute(
            "SELECT AVG(CAST(StarRating AS FLOAT)) AS avg_r, COUNT(*) AS total FROM Reviews WHERE GameID = ?",
            (game_row.GameID,)
        )
        stats = cursor.fetchone()
        conn.close()

        reviews = []
        for r in rows:
            reviews.append({
                "review_id":   r.ReviewID,
                "username":    r.Username,
                "star_rating": r.StarRating,
                "review_text": r.ReviewText,
                "created_at":  str(r.CreatedAt)
            })

        return jsonify({
            "reviews":    reviews,
            "avg_rating": round(float(stats.avg_r), 1) if stats.avg_r else None,
            "total":      stats.total
        }), 200

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Comment routes - post and fetch comments on a specific benchmark result

@app.route('/api/comments', methods=['POST'])
def submit_comment():
    """Post a comment on a benchmark result."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401
    try:
        data         = request.get_json()
        result_id    = int(data.get('result_id', 0))
        comment_text = (data.get('comment_text') or '').strip()

        if not result_id:
            return jsonify({"error": "Invalid result ID."}), 400
        if not comment_text:
            return jsonify({"error": "Comment cannot be empty."}), 400
        if len(comment_text) > 1000:
            return jsonify({"error": "Comment too long (max 1000 characters)."}), 400

        conn   = get_db_connection()
        cursor = conn.cursor()

        # Verify the benchmark result exists
        cursor.execute("SELECT ResultID FROM BenchmarkResults WHERE ResultID = ?", (result_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Benchmark result not found."}), 404

        cursor.execute(
            """INSERT INTO Comments (UserID, ResultID, CommentText)
               VALUES (?, ?, ?)""",
            (session['user_id'], result_id, comment_text)
        )
        # Notify user
        create_notification(cursor, session['user_id'],
            f"💬 Your comment was posted on benchmark result #{result_id}.")
        conn.commit()
        conn.close()

        return jsonify({
            "message":  "Comment posted!",
            "username": session['username']
        }), 201

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/comments/<int:result_id>', methods=['GET'])
def get_comments(result_id):
    """Get all comments for a specific benchmark result."""
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """SELECT c.CommentID, u.Username, c.CommentText, c.CreatedAt
               FROM Comments c
               JOIN Users u ON c.UserID = u.UserID
               WHERE c.ResultID = ?
               ORDER BY c.CreatedAt ASC""",
            (result_id,)
        )
        rows = cursor.fetchall()
        conn.close()

        comments = []
        for r in rows:
            comments.append({
                "comment_id":   r.CommentID,
                "username":     r.Username,
                "comment_text": r.CommentText,
                "created_at":   str(r.CreatedAt)
            })

        return jsonify({"comments": comments}), 200

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Notifications - insert a notification after key actions, list and mark them read

def create_notification(cursor, user_id, message):
    """Insert a notification row for a user. Called internally after key actions."""
    cursor.execute(
        "INSERT INTO Notifications (UserID, Message) VALUES (?, ?)",
        (user_id, message)
    )


@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    """Return all notifications for the logged-in user, newest first."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            """SELECT NotifID, Message, IsRead, CreatedAt
               FROM Notifications
               WHERE UserID = ?
               ORDER BY CreatedAt DESC""",
            (session['user_id'],)
        )
        rows = cursor.fetchall()

        # Count unread
        cursor.execute(
            "SELECT COUNT(*) AS cnt FROM Notifications WHERE UserID = ? AND IsRead = 0",
            (session['user_id'],)
        )
        unread_count = cursor.fetchone().cnt
        conn.close()

        notifications = []
        for r in rows:
            notifications.append({
                "notif_id":   r.NotifID,
                "message":    r.Message,
                "is_read":    bool(r.IsRead),
                "created_at": str(r.CreatedAt)
            })

        return jsonify({
            "notifications": notifications,
            "unread_count":  unread_count
        }), 200

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/notifications/read', methods=['POST'])
def mark_notifications_read():
    """Mark all notifications as read for the logged-in user."""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in."}), 401
    try:
        conn   = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE Notifications SET IsRead = 1 WHERE UserID = ? AND IsRead = 0",
            (session['user_id'],)
        )
        conn.commit()
        conn.close()
        return jsonify({"message": "All notifications marked as read."}), 200

    except pyodbc.Error as db_err:
        return jsonify({"error": f"Database error: {str(db_err)}"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
