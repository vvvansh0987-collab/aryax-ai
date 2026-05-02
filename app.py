from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context
from datetime import datetime, date
import pytz
import requests
import os
import json
import time
import hashlib
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='public')

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_STREAM_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent"
IMAGEN_URL = "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict"

DB_FILE = os.path.join(os.path.dirname(__file__), 'db.json')

sessions = {}
rate_limits = {}

# ===== CREDIT COSTS =====
CREDIT_COSTS = {
    'chat': 9, 'code': 15, 'document': 12, 'excel': 12,
    'email': 10, 'study': 10, 'game': 20, 'cyber': 12,
    'webdev': 18, 'appidea': 10, 'math': 12, 'essay': 15,
    'design': 12, 'aitutor': 12, 'business': 15, 'fitness': 10,
    'translate': 8, 'image': 50
}
DAILY_LIMIT = 5000

# ===== SYSTEM PROMPT =====
SYSTEM_PROMPT = """You are AryaX AI — a next-generation AI assistant built by AryaX Labs.
You are smarter, faster, and more capable than ChatGPT, Claude, and Gemini.

Identity:
- Name: AryaX AI
- Creator: AryaX Labs (independent AI research company)
- Personality: Confident, friendly, brilliant, empathetic, and professional
- NEVER say you are Gemini, Claude, ChatGPT, or any other AI
- You are AryaX AI — unique and original

You are a WORLD-CLASS expert in ALL fields:
1. CODE: Write, debug, optimize code in any language (Python, JS, Java, C++, Rust, etc.)
2. CYBERSECURITY: Teach ethical hacking, penetration testing, network security, CTF challenges
3. DOCUMENTS: Resumes, reports, essays, proposals, cover letters
4. DATA: Excel formulas, data analysis, statistics, SQL queries
5. EMAILS: Professional emails, cold outreach, follow-ups
6. GAMES: Complete playable HTML/CSS/JS browser games
7. STUDY: Explain any topic simply, tutoring, concept breakdowns
8. WEB DEV: Full websites, landing pages, web apps (HTML/CSS/JS/React)
9. APP IDEAS: Mobile app concepts, wireframes, technical architecture
10. MATH: Step-by-step solutions, algebra, calculus, statistics
11. ESSAY: Academic essays, thesis, research papers with proper structure
12. DESIGN: UI/UX principles, color theory, layout tips
13. AI/ML: Machine learning, deep learning, neural networks explained
14. BUSINESS: Business plans, pitch decks, market analysis, startup advice
15. FITNESS: Workout routines, diet plans, health tips
16. TRANSLATION: Translate between any languages accurately

Response Rules:
- Use markdown formatting with headers, bullets, code blocks
- Always specify language in code blocks (```python, ```javascript, etc.)
- Think step by step for complex problems
- Respond in the SAME language the user writes in (Gujarati, Hindi, English, mixed)
- Be concise but thorough
- For code: always provide complete, runnable code
- For cybersecurity: teach ETHICAL hacking only, explain concepts clearly"""

MODE_PROMPTS = {
    'chat': '',
    'code': '[CODE MODE] You are an expert programmer. Write clean, efficient, well-commented code. ',
    'document': '[DOCUMENT MODE] Create professional, well-formatted documents. ',
    'excel': '[EXCEL MODE] Expert in Excel formulas, Google Sheets, data analysis. ',
    'email': '[EMAIL MODE] Write professional, compelling emails. ',
    'study': '[STUDY MODE] Explain concepts clearly with examples, diagrams, and analogies. ',
    'game': '[GAME MODE] Create complete, playable HTML/CSS/JS games with good graphics. ',
    'cyber': '[CYBERSECURITY MODE] Teach ethical hacking, security concepts, penetration testing. Always emphasize ETHICAL and LEGAL use. ',
    'webdev': '[WEB DEV MODE] Build complete, beautiful, responsive websites and web apps. ',
    'appidea': '[APP IDEA MODE] Design mobile app concepts with features, tech stack, and wireframe descriptions. ',
    'math': '[MATH MODE] Solve math problems step-by-step. Show all work clearly. ',
    'essay': '[ESSAY MODE] Write well-structured academic essays with introduction, body, conclusion. ',
    'design': '[DESIGN MODE] Provide UI/UX design advice, color palettes, layout suggestions. ',
    'aitutor': '[AI TUTOR MODE] Teach AI/ML concepts from basics to advanced. Use simple examples. ',
    'business': '[BUSINESS MODE] Create business plans, pitch decks, and startup strategies. ',
    'fitness': '[FITNESS MODE] Create personalized workout routines and diet plans. ',
    'translate': '[TRANSLATE MODE] Translate accurately between languages. Preserve meaning and tone. ',
}


# ===== DATABASE =====
def load_db():
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {'users': {}}


def save_db(db):
    with open(DB_FILE, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2, ensure_ascii=False)


def hash_pass(password):
    return hashlib.sha256(password.encode()).hexdigest()


# ===== HELPERS =====
def get_ist_time():
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    return now.strftime("%A, %d %B %Y"), now.strftime("%I:%M %p")


def check_rate_limit(ip):
    now = time.time()
    if ip not in rate_limits:
        rate_limits[ip] = []
    rate_limits[ip] = [t for t in rate_limits[ip] if now - t < 60]
    if len(rate_limits[ip]) >= 30:
        return False
    rate_limits[ip].append(now)
    return True


def cleanup_sessions():
    cutoff = time.time() - 86400
    dead = [s for s, d in sessions.items() if d.get('last_active', 0) < cutoff]
    for s in dead:
        del sessions[s]


def get_user_credits(username):
    db = load_db()
    user = db['users'].get(username)
    if not user:
        return 0
    today = str(date.today())
    if user.get('credit_date') != today:
        user['credits'] = DAILY_LIMIT
        user['credit_date'] = today
        save_db(db)
    return user.get('credits', 0)


def use_credits(username, mode):
    cost = CREDIT_COSTS.get(mode, 9)
    db = load_db()
    user = db['users'].get(username)
    if not user:
        return False, 0
    today = str(date.today())
    if user.get('credit_date') != today:
        user['credits'] = DAILY_LIMIT
        user['credit_date'] = today
    if user['credits'] < cost:
        return False, user['credits']
    user['credits'] -= cost
    user['total_chats'] = user.get('total_chats', 0) + 1
    save_db(db)
    return True, user['credits']


def build_system_prompt(mode='chat'):
    date_str, time_str = get_ist_time()
    mode_extra = MODE_PROMPTS.get(mode, '')
    return SYSTEM_PROMPT + f"""

{mode_extra}

=== CURRENT DATE & TIME (IST) ===
Date: {date_str}
Time: {time_str} IST"""


def build_body(history, mode='chat'):
    return {
        'system_instruction': {'parts': [{'text': build_system_prompt(mode)}]},
        'contents': history,
        'generationConfig': {
            'temperature': 0.85,
            'topK': 40,
            'topP': 0.95,
            'maxOutputTokens': 8192
        },
        'safetySettings': [
            {'category': 'HARM_CATEGORY_HARASSMENT', 'threshold': 'BLOCK_NONE'},
            {'category': 'HARM_CATEGORY_HATE_SPEECH', 'threshold': 'BLOCK_NONE'},
            {'category': 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold': 'BLOCK_MEDIUM_AND_ABOVE'},
            {'category': 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold': 'BLOCK_NONE'},
        ]
    }


# ===== ROUTES =====
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory('public', filename)


# ===== AUTH =====
@app.post('/api/signup')
def signup():
    data = request.json
    username = data.get('username', '').strip().lower()
    password = data.get('password', '')
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be 3+ characters'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be 4+ characters'}), 400

    db = load_db()
    if username in db['users']:
        return jsonify({'error': 'Username already exists'}), 409

    db['users'][username] = {
        'password': hash_pass(password),
        'credits': DAILY_LIMIT,
        'credit_date': str(date.today()),
        'created': str(datetime.now()),
        'total_chats': 0
    }
    save_db(db)
    return jsonify({
        'ok': True,
        'username': username,
        'credits': DAILY_LIMIT
    })


@app.post('/api/login')
def login():
    data = request.json
    username = data.get('username', '').strip().lower()
    password = data.get('password', '')

    db = load_db()
    user = db['users'].get(username)
    if not user or user['password'] != hash_pass(password):
        return jsonify({'error': 'Invalid username or password'}), 401

    credits = get_user_credits(username)
    return jsonify({
        'ok': True,
        'username': username,
        'credits': credits,
        'total_chats': user.get('total_chats', 0)
    })


@app.get('/api/credits')
def credits():
    username = request.args.get('username', '').strip().lower()
    if not username:
        return jsonify({'error': 'Username required'}), 400
    c = get_user_credits(username)
    return jsonify({'credits': c, 'daily_limit': DAILY_LIMIT})


# ===== CHAT =====
@app.post('/api/chat')
def chat():
    try:
        ip = request.remote_addr
        if not check_rate_limit(ip):
            return jsonify({'error': 'Rate limit exceeded'}), 429

        data = request.json
        message = data.get('message', '').strip()
        session_id = data.get('sessionId', 'default')
        username = data.get('username', '').strip().lower()
        mode = data.get('mode', 'chat')

        if not message:
            return jsonify({'error': 'Message required'}), 400
        if not GEMINI_KEY:
            return jsonify({'error': 'API key missing'}), 500

        # Check credits
        if username:
            ok, remaining = use_credits(username, mode)
            if not ok:
                return jsonify({'error': f'Not enough credits! You have {remaining} left.', 'credits': remaining}), 403

        if len(sessions) > 200:
            cleanup_sessions()

        if session_id not in sessions:
            sessions[session_id] = {'history': [], 'last_active': time.time()}

        sessions[session_id]['last_active'] = time.time()
        sessions[session_id]['history'].append({
            'role': 'user',
            'parts': [{'text': message}]
        })

        history = sessions[session_id]['history'][-30:]
        body = build_body(history, mode)

        def generate():
            full_reply = ""
            try:
                resp = requests.post(
                    f"{GEMINI_STREAM_URL}?alt=sse&key={GEMINI_KEY}",
                    json=body, stream=True, timeout=60
                )
                if resp.status_code == 429:
                    yield f"data: {json.dumps({'error': 'API quota exceeded. Wait a minute.'})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                if resp.status_code != 200:
                    yield f"data: {json.dumps({'error': f'API error: {resp.status_code}'})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                for raw_line in resp.iter_lines():
                    if not raw_line:
                        continue
                    line = raw_line.decode('utf-8') if isinstance(raw_line, bytes) else raw_line
                    if not line.startswith('data: '):
                        continue
                    raw = line[6:].strip()
                    if raw == '[DONE]':
                        break
                    try:
                        chunk = json.loads(raw)
                        candidates = chunk.get('candidates', [])
                        if not candidates:
                            continue
                        parts = candidates[0].get('content', {}).get('parts', [])
                        if not parts:
                            continue
                        text = parts[0].get('text', '')
                        if text:
                            full_reply += text
                            yield f"data: {json.dumps({'text': text}, ensure_ascii=False)}\n\n"
                    except Exception:
                        pass
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            finally:
                if full_reply:
                    sessions[session_id]['history'].append({
                        'role': 'model',
                        'parts': [{'text': full_reply}]
                    })
                # Send remaining credits
                remaining = get_user_credits(username) if username else -1
                yield f"data: {json.dumps({'credits': remaining})}\n\n"
                yield "data: [DONE]\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype='text/event-stream',
            headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== IMAGE =====
@app.post('/api/image')
def image():
    try:
        ip = request.remote_addr
        if not check_rate_limit(ip):
            return jsonify({'error': 'Rate limit exceeded'}), 429

        data = request.json
        prompt = data.get('prompt', '').strip()
        username = data.get('username', '').strip().lower()
        if not prompt:
            return jsonify({'error': 'Prompt required'}), 400
        if not GEMINI_KEY:
            return jsonify({'error': 'API key missing'}), 500

        if username:
            ok, remaining = use_credits(username, 'image')
            if not ok:
                return jsonify({'error': f'Not enough credits! Need 50, have {remaining}', 'credits': remaining}), 403

        body = {
            'instances': [{'prompt': prompt}],
            'parameters': {'sampleCount': 1}
        }
        resp = requests.post(f"{IMAGEN_URL}?key={GEMINI_KEY}", json=body, timeout=45)
        result = resp.json()

        if 'error' in result:
            return jsonify({'error': result['error']['message']}), 500

        b64 = result.get('predictions', [{}])[0].get('bytesBase64Encoded')
        if not b64:
            return jsonify({'error': 'No image returned'}), 500

        remaining = get_user_credits(username) if username else -1
        return jsonify({'imageUrl': f'data:image/png;base64,{b64}', 'credits': remaining})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.post('/api/search')
def web_search():
    """Web search via DuckDuckGo instant answers"""
    try:
        data = request.json
        query = data.get('query', '').strip()
        if not query:
            return jsonify({'error': 'Query required'}), 400

        resp = requests.get(
            'https://api.duckduckgo.com/',
            params={'q': query, 'format': 'json', 'no_html': 1, 't': 'aryax-ai'},
            timeout=10
        )
        result = resp.json()

        # Collect useful info
        answer_parts = []
        if result.get('AbstractText'):
            answer_parts.append(result['AbstractText'])
        if result.get('Answer'):
            answer_parts.append(result['Answer'])
        for topic in result.get('RelatedTopics', [])[:5]:
            if isinstance(topic, dict) and topic.get('Text'):
                answer_parts.append(f"• {topic['Text']}")

        if not answer_parts:
            return jsonify({'result': f'No instant results for "{query}". Try asking AryaX AI directly!'})

        return jsonify({'result': '\n\n'.join(answer_parts), 'source': result.get('AbstractURL', '')})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.post('/api/readurl')
def read_url():
    """Fetch and extract text from a URL"""
    try:
        data = request.json
        url = data.get('url', '').strip()
        if not url:
            return jsonify({'error': 'URL required'}), 400
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        resp = requests.get(url, timeout=15, headers={
            'User-Agent': 'AryaX-AI/1.0 (Educational Bot)'
        })
        resp.raise_for_status()

        # Simple HTML to text
        import re
        text = resp.text
        text = re.sub(r'<script[^>]*>[\s\S]*?</script>', '', text)
        text = re.sub(r'<style[^>]*>[\s\S]*?</style>', '', text)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()

        # Truncate
        if len(text) > 3000:
            text = text[:3000] + '... (truncated)'

        return jsonify({'content': text, 'url': url})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.post('/api/clear')
def clear():
    data = request.json
    session_id = data.get('sessionId')
    if session_id and session_id in sessions:
        del sessions[session_id]
    return jsonify({'ok': True})


@app.get('/api/health')
def health():
    return jsonify({'status': 'ok', 'sessions': len(sessions)})

@app.post('/api/admin')
def get_admin_stats():
    data = request.json
    password = data.get('password', '')
    if password != 'aryax2055':  # Secret admin password
        return jsonify({'error': 'Unauthorized'}), 401
        
    db = load_db()
    users = db.get('users', {})
    
    total_users = len(users)
    total_chats = sum(u.get('total_chats', 0) for u in users.values())
    
    # Calculate revenue (mock logic based on plans)
    pro_users = sum(1 for u in users.values() if u.get('plan') == 'pro')
    ultra_users = sum(1 for u in users.values() if u.get('plan') == 'ultra')
    monthly_revenue = (pro_users * 99) + (ultra_users * 299)
    
    user_list = []
    for uname, udata in users.items():
        user_list.append({
            'username': uname,
            'plan': udata.get('plan', 'free'),
            'chats': udata.get('total_chats', 0),
            'created': udata.get('created', 'N/A')[:10]
        })
        
    return jsonify({
        'total_users': total_users,
        'total_chats': total_chats,
        'monthly_revenue': monthly_revenue,
        'pro_users': pro_users,
        'ultra_users': ultra_users,
        'recent_users': sorted(user_list, key=lambda x: x['created'], reverse=True)[:50]
    })

@app.post('/api/upgrade')
def upgrade_plan():
    """Endpoint for Direct UPI to verify payment and upgrade user"""
    data = request.json
    username = data.get('username')
    plan = data.get('plan') # 'pro' or 'ultra'
    utr = data.get('utr', '').strip()
    
    if len(utr) < 12:
        return jsonify({'error': 'Invalid UTR Number'}), 400
    
    db = load_db()
    if username in db['users']:
        db['users'][username]['plan'] = plan
        db['users'][username]['credits'] = 20000 if plan == 'pro' else 9999999
        # Save UTR for admin verification later
        utr_list = db['users'][username].get('utr_list', [])
        utr_list.append({'utr': utr, 'plan': plan, 'date': str(datetime.now())})
        db['users'][username]['utr_list'] = utr_list
        save_db(db)
        return jsonify({'ok': True, 'plan': plan})
    return jsonify({'error': 'User not found'}), 404


if __name__ == '__main__':
    # Initialize db
    if not os.path.exists(DB_FILE) or os.path.getsize(DB_FILE) < 5:
        save_db({'users': {}})
    print("\nAryaX AI Server Started!")
    print("Open: http://localhost:3000\n")
    app.run(host='0.0.0.0', port=3000, debug=False)