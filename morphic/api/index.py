from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Form, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import PyPDF2
import logging
from typing import List, Dict, Any, Optional
from openai import OpenAI
import os
import sqlite3
import json
from datetime import datetime
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone, ServerlessSpec
import pandas as pd
from pydantic import BaseModel
from supabase import create_client, Client

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────
app = FastAPI(title="Internal Employee Assistant — RAG Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
@app.get("/api/python/health")
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "openai": bool(os.getenv("OPENAI_API_KEY")),
        "pinecone": bool(os.getenv("PINECONE_API_KEY")),
        "supabase": bool(os.getenv("SUPABASE_URL")),
        "admin_key_set": os.getenv("ADMIN_SECRET_KEY") != "change-me-in-production",
        "timestamp": datetime.now().isoformat()
    }

@app.middleware("http")
async def strip_api_python_prefix(request, call_next):
    path = request.url.path
    if path.startswith("/api/python"):
        new_path = path.replace("/api/python", "", 1)
        if not new_path: new_path = "/"
        request.scope["path"] = new_path
    return await call_next(request)

# ─────────────────────────────────────────────
# Environment / Config
# ─────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY", "")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "bb")
ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "change-me-in-production")
PROMPTS_FILE = os.getenv("PROMPTS_FILE", "prompts.json")
CONVERSATIONS_DB = os.getenv("CONVERSATIONS_DB", "conversations.db")
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# ─────────────────────────────────────────────
# Role → Namespace Mapping
# ─────────────────────────────────────────────
# Namespaces are now dynamically discovered from Pinecone index stats
# VALID_NAMESPACES is kept for legacy compatibility but not strictly enforced
VALID_NAMESPACES = [
    "general-namespace",
    "sales-namespace",
    "support-namespace",
    "operations-namespace",
    "accounting-namespace",
]

ROLE_NAMESPACES: Dict[str, List[str]] = {
    "sales": ["sales-namespace", "general-namespace"],
    "support": ["support-namespace", "general-namespace"],
    "operations": ["operations-namespace", "general-namespace"],
    "accounting": ["accounting-namespace"],
    "management": [
        "sales-namespace",
        "support-namespace",
        "operations-namespace",
        "accounting-namespace",
        "general-namespace",
    ],
    "admin": [
        "sales-namespace",
        "support-namespace",
        "operations-namespace",
        "accounting-namespace",
        "general-namespace",
    ],
    # Fallback for users who haven't been assigned a role yet
    "unassigned": ["general-namespace"],
}

DEFAULT_SYSTEM_PROMPTS: Dict[str, str] = {
    "admin": """Role:
You are an internal admin assistant with full access.

Access:
You can answer across all domains.

Instruction:
You must answer ONLY using the provided documents and retrieved context.

Strict Rules:
- Do NOT add any information not explicitly mentioned in the documents.
- Do NOT use general knowledge, assumptions, or outside information.
- Do NOT expand, guess, or fill in missing details.
- Do NOT convert implications into facts unless explicitly stated.
- Do NOT provide general advice or common practices.
- Do NOT suggest troubleshooting steps (e.g., checking connections, restarting, using another device, system configuration) unless explicitly mentioned in the documents.
- Do NOT add extra steps beyond what is written.

Hard Stop Rule:
- If the answer or any part of the question is not explicitly supported by the documents, respond exactly with:
  "This is not mentioned in the provided documents."
- Do NOT provide suggestions, alternatives, or partial guesses after this.

Multi-Part Questions:
- If a question has multiple parts, answer only the parts supported by the documents.
- Clearly state when any part is not mentioned.

Behavior:
- If asked for best, fastest, easiest, or most efficient way: give only the optimal method.
- Do NOT list all possible options unless explicitly asked.
- If asked for steps: provide step-by-step instructions strictly from the documents.
- If asked for explanation: give a short, clear answer.
- If asked "what went wrong": list ONLY causes mentioned in the documents.
- If the question implies a quick or efficient solution, respond in a concise explanation format instead of step-by-step instructions.

Style:
- Keep answers short, clear, and direct.
- Prefer 1 to 3 sentences unless steps are required.
- Avoid unnecessary explanation.

Goal:
Provide accurate, strict, and reliable answers based only on internal documentation.""",

    "sales": """Role:
You are a sales assistant helping with pricing, product exports, and customer price lists.

Access:
You work only with sales-related documentation.

Instruction:
You must answer ONLY using the provided documents and retrieved context.

Strict Rules:
- Do NOT add any information not explicitly mentioned in the documents.
- Do NOT use general knowledge, assumptions, or outside information.
- Do NOT expand, guess, or fill in missing details.
- Do NOT convert implications into facts unless explicitly stated.
- Do NOT provide general advice or common practices.
- Do NOT suggest troubleshooting steps (e.g., checking connections, restarting, using another device, system configuration) unless explicitly mentioned in the documents.
- Do NOT add extra steps beyond what is written.

Hard Stop Rule:
- If the answer or any part of the question is not explicitly supported by the documents, respond exactly with:
  "This is not mentioned in the provided documents."
- Do NOT provide suggestions, alternatives, or partial guesses after this.

Multi-Part Questions:
- If a question has multiple parts, answer only the parts supported by the documents.
- Clearly state when any part is not mentioned.

Behavior:
- If asked for best, fastest, easiest, or most efficient way: give only the optimal method.
- Do NOT list all possible options unless explicitly asked.
- If asked for steps: provide step-by-step instructions strictly from the documents.
- If asked for explanation: give a short, clear answer.
- If asked "what went wrong": list ONLY causes mentioned in the documents.
- If the question implies a quick or efficient solution, respond in a concise explanation format instead of step-by-step instructions.

Style:
- Keep answers short, clear, and direct.
- Prefer 1 to 3 sentences unless steps are required.
- Avoid unnecessary explanation.

Goal:
Provide accurate, strict, and reliable answers based only on internal documentation.""",

    "operations": """Role:
You are an operations assistant handling system setup, machine updates, and server processes.

Access:
You work only with operations-related documentation.

Instruction:
You must answer ONLY using the provided documents and retrieved context.

Strict Rules:
- Do NOT add any information not explicitly mentioned in the documents.
- Do NOT use general knowledge, assumptions, or outside information.
- Do NOT expand, guess, or fill in missing details.
- Do NOT convert implications into facts unless explicitly stated.
- Do NOT provide general advice or common practices.
- Do NOT suggest troubleshooting steps (e.g., checking connections, restarting, using another device, system configuration) unless explicitly mentioned in the documents.
- Do NOT add extra steps beyond what is written.

Hard Stop Rule:
- If the answer or any part of the question is not explicitly supported by the documents, respond exactly with:
  "This is not mentioned in the provided documents."
- Do NOT provide suggestions, alternatives, or partial guesses after this.

Multi-Part Questions:
- If a question has multiple parts, answer only the parts supported by the documents.
- Clearly state when any part is not mentioned.

Behavior:
- If asked for best, fastest, easiest, or most efficient way: give only the optimal method.
- Do NOT list all possible options unless explicitly asked.
- If asked for steps: provide step-by-step instructions strictly from the documents.
- If asked for explanation: give a short, clear answer.
- If asked "what went wrong": list ONLY causes mentioned in the documents.
- If the question implies a quick or efficient solution, respond in a concise explanation format instead of step-by-step instructions.

Style:
- Keep answers short, clear, and direct.
- Prefer 1 to 3 sentences unless steps are required.
- Avoid unnecessary explanation.

Goal:
Provide accurate, strict, and reliable answers based only on internal documentation.""",

    "support": """Role:
You are a support assistant helping with customer issues and return label processes.

Access:
You work only with support-related documentation.

Instruction:
You must answer ONLY using the provided documents and retrieved context.

Strict Rules:
- Do NOT add any information not explicitly mentioned in the documents.
- Do NOT use general knowledge, assumptions, or outside information.
- Do NOT expand, guess, or fill in missing details.
- Do NOT convert implications into facts unless explicitly stated.
- Do NOT provide general advice or common practices.
- Do NOT suggest troubleshooting steps (e.g., checking connections, restarting, using another device, system configuration) unless explicitly mentioned in the documents.
- Do NOT add extra steps beyond what is written.

Hard Stop Rule:
- If the answer or any part of the question is not explicitly supported by the documents, respond exactly with:
  "This is not mentioned in the provided documents."
- Do NOT provide suggestions, alternatives, or partial guesses after this.

Multi-Part Questions:
- If a question has multiple parts, answer only the parts supported by the documents.
- Clearly state when any part is not mentioned.

Behavior:
- If asked for best, fastest, easiest, or most efficient way: give only the optimal method.
- Do NOT list all possible options unless explicitly asked.
- If asked for steps: provide step-by-step instructions strictly from the documents.
- If asked for explanation: give a short, clear answer.
- If asked "what went wrong": list ONLY causes mentioned in the documents.
- If the question implies a quick or efficient solution, respond in a concise explanation format instead of step-by-step instructions.

Style:
- Keep answers short, clear, and direct.
- Prefer 1 to 3 sentences unless steps are required.
- Avoid unnecessary explanation.

Goal:
Provide accurate, strict, and reliable answers based only on internal documentation.""",

    "management": """Role:
You are an internal management assistant with broad access.

Access:
You have access to sales, support, operations, accounting, and general documentation.

Instruction:
You must answer ONLY using the provided documents and retrieved context.

Strict Rules:
- Do NOT add any information not explicitly mentioned in the documents.
- Do NOT use general knowledge, assumptions, or outside information.
- Do NOT expand, guess, or fill in missing details.
- Do NOT convert implications into facts unless explicitly stated.
- Do NOT provide general advice or common practices.
- Do NOT suggest troubleshooting steps (e.g., checking connections, restarting, using another device, system configuration) unless explicitly mentioned in the documents.
- Do NOT add extra steps beyond what is written.

Hard Stop Rule:
- If the answer or any part of the question is not explicitly supported by the documents, respond exactly with:
  "This is not mentioned in the provided documents."
- Do NOT provide suggestions, alternatives, or partial guesses after this.

Multi-Part Questions:
- If a question has multiple parts, answer only the parts supported by the documents.
- Clearly state when any part is not mentioned.

Behavior:
- If asked for best, fastest, easiest, or most efficient way: give only the optimal method.
- Do NOT list all possible options unless explicitly asked.
- If asked for steps: provide step-by-step instructions strictly from the documents.
- If asked for explanation: give a short, clear answer.
- If asked "what went wrong": list ONLY causes mentioned in the documents.
- If the question implies a quick or efficient solution, respond in a concise explanation format instead of step-by-step instructions.

Style:
- Keep answers short, clear, and direct.
- Prefer 1 to 3 sentences unless steps are required.
- Avoid unnecessary explanation.

Goal:
Provide accurate, strict, and reliable answers based only on internal documentation.""",

    "accounting": """Role:
You are an internal accounting assistant.

Access:
You have access only to accounting-related documentation.

Restriction:
If asked about sales, support, operations, or anything outside accounting, respond exactly with:
"I apologize, but as an Accounting assistant, I am not eligible to access that information."

Instruction:
You must answer ONLY using the provided documents and retrieved context.

Strict Rules:
- Do NOT add any information not explicitly mentioned in the documents.
- Do NOT use general knowledge, assumptions, or outside information.
- Do NOT expand, guess, or fill in missing details.
- Do NOT convert implications into facts unless explicitly stated.
- Do NOT provide general advice or common practices.
- Do NOT suggest troubleshooting steps (e.g., checking connections, restarting, using another device, system configuration) unless explicitly mentioned in the documents.
- Do NOT add extra steps beyond what is written.

Hard Stop Rule:
- If the answer or any part of the question is not explicitly supported by the documents, respond exactly with:
  "This is not mentioned in the provided documents."
- Do NOT provide suggestions, alternatives, or partial guesses after this.

Multi-Part Questions:
- If a question has multiple parts, answer only the parts supported by the documents.
- Clearly state when any part is not mentioned.

Behavior:
- If asked for best, fastest, easiest, or most efficient way: give only the optimal method.
- Do NOT list all possible options unless explicitly asked.
- If asked for steps: provide step-by-step instructions strictly from the documents.
- If asked for explanation: give a short, clear answer.
- If asked "what went wrong": list ONLY causes mentioned in the documents.
- If the question implies a quick or efficient solution, respond in a concise explanation format instead of step-by-step instructions.

Style:
- Keep answers short, clear, and direct.
- Prefer 1 to 3 sentences unless steps are required.
- Avoid unnecessary explanation.

Goal:
Provide accurate, strict, and reliable answers based only on internal documentation.""",
}

# ─────────────────────────────────────────────
# Clients
# ─────────────────────────────────────────────
openai_client = OpenAI(api_key=OPENAI_API_KEY)
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)

# Supabase Client
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Supabase client: {str(e)}")
else:
    logger.warning("Supabase credentials not found. Falling back to local storage (not recommended for production).")

# ─────────────────────────────────────────────
# Supabase Storage (original-file archive + viewer)
# ─────────────────────────────────────────────
STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "uploaded-documents")

def _safe_storage_path(namespace: str, filename: str, timestamp: Optional[str]) -> str:
    """Build a stable storage path. Timestamp prefix avoids name collisions on re-upload."""
    ts = (timestamp or datetime.now().isoformat()).replace(":", "-").replace("/", "-")
    safe_name = filename.replace("/", "_").replace("\\", "_")
    return f"{namespace}/{ts}__{safe_name}"

def archive_original_file(
    namespace: str,
    filename: str,
    content_bytes: bytes,
    content_type: str,
    timestamp: Optional[str] = None,
) -> Optional[str]:
    """Upload the original file to Supabase Storage. Returns storage path (or None on failure).

    Failure is non-fatal — callers should still index to Pinecone so search keeps working.
    """
    if not supabase:
        return None
    try:
        path = _safe_storage_path(namespace, filename, timestamp)
        supabase.storage.from_(STORAGE_BUCKET).upload(
            path=path,
            file=content_bytes,
            file_options={"content-type": content_type, "upsert": "true"},
        )
        logger.info(f"[storage] archived {filename} → {STORAGE_BUCKET}/{path}")
        return path
    except Exception as e:
        logger.warning(f"[storage] archive failed for {filename}: {str(e)}")
        return None

def delete_archived_file(storage_path: Optional[str]) -> None:
    if not supabase or not storage_path:
        return
    try:
        supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
        logger.info(f"[storage] deleted {STORAGE_BUCKET}/{storage_path}")
    except Exception as e:
        logger.warning(f"[storage] delete failed for {storage_path}: {str(e)}")

# ─────────────────────────────────────────────
# Text Splitter
# ─────────────────────────────────────────────
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
    separators=["\n\n", "\n", ". ", " ", ""],
)

# ─────────────────────────────────────────────
# SQLite — Conversation Logging
# ─────────────────────────────────────────────
def init_conversations_db():
    if not supabase:
        conn = sqlite3.connect(CONVERSATIONS_DB)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                user_email TEXT,
                role TEXT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                sources TEXT,
                timestamp TEXT NOT NULL,
                chat_id TEXT
            )
        """)
        # Back-compat: add chat_id column if missing on older DBs
        try:
            cursor.execute("ALTER TABLE conversations ADD COLUMN chat_id TEXT")
        except sqlite3.OperationalError:
            pass
        conn.commit()
        conn.close()
        logger.info("Local Conversations DB initialized")
    else:
        logger.info("Supabase detected; skipping local DB initialization")

init_conversations_db()

# Prompt Store (Supabase + local fallback)
# ─────────────────────────────────────────────
def load_prompts() -> Dict[str, str]:
    # 1. Try Supabase
    if supabase:
        try:
            response = supabase.table("role_prompts").select("*").execute()
            if response.data:
                # Merge Supabase prompts with defaults
                prompts = dict(DEFAULT_SYSTEM_PROMPTS)
                for item in response.data:
                    prompts[item["role"]] = item["prompt"]
                return prompts
        except Exception as e:
            logger.error(f"Error loading prompts from Supabase: {str(e)}")

    # 2. Try local JSON
    if os.path.exists(PROMPTS_FILE):
        try:
            with open(PROMPTS_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading local prompts: {str(e)}")

    return dict(DEFAULT_SYSTEM_PROMPTS)

def save_prompts(prompts: Dict[str, str]):
    # 1. Try Supabase
    if supabase:
        try:
            # Upsert each prompt
            for role, prompt in prompts.items():
                supabase.table("role_prompts").upsert({
                    "role": role,
                    "prompt": prompt,
                    "updated_at": datetime.now().isoformat()
                }).execute()
        except Exception as e:
            logger.error(f"Error saving prompts to Supabase: {str(e)}")

    # 2. Always save local as backup
    try:
        with open(PROMPTS_FILE, "w") as f:
            json.dump(prompts, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving local prompts backup: {str(e)}")

# ─────────────────────────────────────────────
# Admin Auth Dependency
# ─────────────────────────────────────────────
async def require_admin_key(x_admin_key: Optional[str] = Header(None)):
    if x_admin_key != ADMIN_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing admin key")

# ─────────────────────────────────────────────
# Embeddings
# ─────────────────────────────────────────────
def generate_embeddings(texts: List[str]) -> List[List[float]]:
    try:
        logger.debug(f"Generating embeddings for {len(texts)} texts")
        response = openai_client.embeddings.create(
            model="text-embedding-3-large",
            input=texts,
            dimensions=3072,
        )
        return [embedding.embedding for embedding in response.data]
    except Exception as e:
        logger.error(f"Error generating embeddings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating embeddings: {str(e)}")

# ─────────────────────────────────────────────
# Pydantic Models
# ─────────────────────────────────────────────
class QueryRequest(BaseModel):
    query: str
    role: str
    top_k: Optional[int] = 5
    user_id: Optional[str] = None
    user_email: Optional[str] = None

class ConversationLog(BaseModel):
    user_id: str
    user_email: Optional[str] = None
    role: str
    question: str
    answer: str
    sources: Optional[List[str]] = []
    timestamp: str
    chat_id: Optional[str] = None

class PromptUpdatePayload(BaseModel):
    prompt: str

class FeedbackPayload(BaseModel):
    question: str
    ai_response: str
    correct_response: str
    timestamp: str

class FeedbackUpdatePayload(BaseModel):
    vector_id: str
    question: Optional[str] = None
    ai_response: Optional[str] = None
    correct_response: Optional[str] = None
    improved_response: Optional[str] = None

# ─────────────────────────────────────────────
# MAIN QUERY — Role-Aware
# ─────────────────────────────────────────────
@app.post("/query")
async def query_vector_db(request: QueryRequest):
    try:
        role = request.role.lower()
        if role not in ROLE_NAMESPACES:
            raise HTTPException(status_code=400, detail=f"Unknown role: {role}. Valid roles: {list(ROLE_NAMESPACES.keys())}")

        allowed_namespaces = ROLE_NAMESPACES[role]
        logger.info(f"Query from role={role}, searching namespaces: {allowed_namespaces}")

        query_embedding = generate_embeddings([request.query])[0]

        # Always check feedback namespace for corrections
        feedback_response = index.query(
            vector=query_embedding,
            namespace="feedback-namespace",
            top_k=2,
            include_metadata=True,
        )
        if feedback_response.matches:
            top_fb_score = feedback_response.matches[0].score
            logger.info(f"[query] feedback-namespace hit: {len(feedback_response.matches)} matches for role={role} (top score={top_fb_score:.3f})")
        else:
            logger.info(f"[query] feedback-namespace: no matches for role={role}")

        # Query each allowed namespace
        all_matches = list(feedback_response.matches)
        for ns in allowed_namespaces:
            ns_response = index.query(
                vector=query_embedding,
                namespace=ns,
                top_k=request.top_k,
                include_metadata=True,
            )
            logger.debug(f"Namespace {ns}: {len(ns_response.matches)} matches")
            all_matches.extend(ns_response.matches)

        # Sort combined results by score and take top_k
        all_matches.sort(key=lambda x: x.score, reverse=True)
        top_matches = all_matches[:request.top_k]

        results = []
        source_docs = []
        for match in top_matches:
            result = {
                "id": match.id,
                "score": match.score,
                "metadata": match.metadata,
            }
            if "is_correction" in match.metadata and match.metadata["is_correction"]:
                result["is_correction"] = True
            if match.metadata.get("filename"):
                source_docs.append(match.metadata["filename"])
            results.append(result)

        # Deduplicate sources
        source_docs = list(dict.fromkeys(source_docs))

        return {
            "results": results,
            "query": request.query,
            "role": role,
            "allowed_namespaces": allowed_namespaces,
            "sources": source_docs,
            "feedback_count": len(feedback_response.matches),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying vector database: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error querying vector database: {str(e)}")

# ─────────────────────────────────────────────
# CONVERSATION LOGGING
# ─────────────────────────────────────────────
@app.post("/log-conversation")
async def log_conversation(log: ConversationLog):
    try:
        # 1. Try Supabase
        if supabase:
            try:
                supabase.table("conversation_logs").insert({
                    "user_id": log.user_id,
                    "user_email": log.user_email,
                    "role": log.role,
                    "question": log.question,
                    "answer": log.answer,
                    "sources": log.sources or [],
                    "timestamp": log.timestamp,
                    "chat_id": log.chat_id,
                }).execute()
                logger.info(f"Logged conversation to Supabase for user={log.user_id} chat={log.chat_id}")
                return {"message": "Conversation logged"}
            except Exception as e:
                logger.error(f"Error logging to Supabase: {str(e)}")

        # 2. Local SQLite fallback
        conn = sqlite3.connect(CONVERSATIONS_DB)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO conversations (user_id, user_email, role, question, answer, sources, timestamp, chat_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            log.user_id,
            log.user_email,
            log.role,
            log.question,
            log.answer,
            json.dumps(log.sources or []),
            log.timestamp,
            log.chat_id,
        ))
        conn.commit()
        log_id = cursor.lastrowid
        conn.close()
        logger.info(f"Logged conversation id={log_id} to local SQLite")
        return {"message": "Conversation logged", "id": log_id}

    except Exception as e:
        logger.error(f"Error logging conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error logging conversation: {str(e)}")

# ─────────────────────────────────────────────
# ADMIN — Conversation Logs (QA Review)
# ─────────────────────────────────────────────
def _group_rows_into_chats(rows: List[dict]) -> List[dict]:
    """Collapse flat log rows into chat sessions keyed by chat_id.

    Rows without chat_id are treated as their own single-turn 'chat' so old
    data still shows up. Returns sessions sorted by last-activity descending.
    """
    sessions: Dict[str, dict] = {}
    for row in rows:
        key = row.get("chat_id") or f"legacy-{row.get('id')}"
        sess = sessions.get(key)
        if sess is None:
            sess = {
                "chat_id": key,
                "user_id": row.get("user_id"),
                "user_email": row.get("user_email"),
                "role": row.get("role"),
                "first_question": row.get("question"),
                "last_activity": row.get("timestamp"),
                "message_count": 0,
                "messages": [],
            }
            sessions[key] = sess
        sess["messages"].append(row)
        sess["message_count"] += 1
        ts = row.get("timestamp") or ""
        if ts > (sess["last_activity"] or ""):
            sess["last_activity"] = ts

    for sess in sessions.values():
        sess["messages"].sort(key=lambda r: (r.get("timestamp") or "", r.get("id") or 0))
        if sess["messages"]:
            sess["first_question"] = sess["messages"][0].get("question") or sess["first_question"]

    return sorted(sessions.values(), key=lambda s: s["last_activity"] or "", reverse=True)

@app.get("/admin/conversations", dependencies=[Depends(require_admin_key)])
async def get_conversations(
    role: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """Return chat sessions (grouped by chat_id) with their full message threads."""
    try:
        rows: List[dict] = []
        if supabase:
            try:
                query = supabase.table("conversation_logs").select("*")
                if role:
                    query = query.eq("role", role)
                if user_id:
                    query = query.eq("user_id", user_id)
                response = query.order("id", desc=True).limit(2000).execute()
                rows = response.data or []
            except Exception as e:
                logger.error(f"Error retrieving from Supabase: {str(e)}")

        if not rows:
            conn = sqlite3.connect(CONVERSATIONS_DB)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            q = "SELECT * FROM conversations WHERE 1=1"
            params: List = []
            if role:
                q += " AND role = ?"
                params.append(role)
            if user_id:
                q += " AND user_id = ?"
                params.append(user_id)
            q += " ORDER BY id DESC LIMIT 2000"
            cursor.execute(q, params)
            rows = [dict(r) for r in cursor.fetchall()]
            conn.close()
            for r in rows:
                try:
                    r["sources"] = json.loads(r.get("sources") or "[]")
                except Exception:
                    r["sources"] = []

        sessions = _group_rows_into_chats(rows)
        total = len(sessions)
        page = sessions[offset: offset + limit]
        return {"conversations": page, "total": total, "limit": limit, "offset": offset}
    except Exception as e:
        logger.error(f"Error retrieving conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving conversations: {str(e)}")

@app.delete("/admin/conversations/{chat_id}", dependencies=[Depends(require_admin_key)])
async def delete_conversation_chat(chat_id: str):
    """Delete a full chat session (all rows with the given chat_id).

    For legacy rows without a chat_id, the frontend sends `legacy-<row_id>` and
    we delete the single row by numeric id.
    """
    try:
        legacy_id: Optional[int] = None
        if chat_id.startswith("legacy-"):
            try:
                legacy_id = int(chat_id.split("-", 1)[1])
            except ValueError:
                legacy_id = None

        if supabase:
            try:
                if legacy_id is not None:
                    supabase.table("conversation_logs").delete().eq("id", legacy_id).execute()
                else:
                    supabase.table("conversation_logs").delete().eq("chat_id", chat_id).execute()
                logger.info(f"Deleted chat {chat_id} from Supabase")
            except Exception as e:
                logger.error(f"Error deleting from Supabase: {str(e)}")

        try:
            conn = sqlite3.connect(CONVERSATIONS_DB)
            cursor = conn.cursor()
            if legacy_id is not None:
                cursor.execute("DELETE FROM conversations WHERE id = ?", (legacy_id,))
            else:
                cursor.execute("DELETE FROM conversations WHERE chat_id = ?", (chat_id,))
            conn.commit()
            conn.close()
        except Exception as local_err:
            if not supabase:
                raise local_err
        return {"message": f"Chat {chat_id} deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# ADMIN — Prompt Management
# ─────────────────────────────────────────────
@app.get("/admin/prompt/{role}", dependencies=[Depends(require_admin_key)])
async def get_prompt(role: str):
    prompts = load_prompts()
    if role not in prompts:
        raise HTTPException(status_code=404, detail=f"No prompt found for role: {role}")
    return {"role": role, "prompt": prompts[role]}

@app.get("/admin/prompts", dependencies=[Depends(require_admin_key)])
async def get_all_prompts():
    return {"prompts": load_prompts()}

@app.put("/admin/prompt/{role}", dependencies=[Depends(require_admin_key)])
async def update_prompt(role: str, payload: PromptUpdatePayload):
    if role not in DEFAULT_SYSTEM_PROMPTS:
        raise HTTPException(status_code=400, detail=f"Unknown role: {role}")
    prompts = load_prompts()
    prompts[role] = payload.prompt
    save_prompts(prompts)
    logger.info(f"System prompt updated for role: {role}")
    return {"message": f"Prompt updated for role: {role}", "role": role, "prompt": payload.prompt}

@app.delete("/admin/prompt/{role}/reset", dependencies=[Depends(require_admin_key)])
async def reset_prompt(role: str):
    if role not in DEFAULT_SYSTEM_PROMPTS:
        raise HTTPException(status_code=400, detail=f"Unknown role: {role}")
    prompts = load_prompts()
    prompts[role] = DEFAULT_SYSTEM_PROMPTS[role]
    save_prompts(prompts)
    return {"message": f"Prompt reset to default for role: {role}", "prompt": DEFAULT_SYSTEM_PROMPTS[role]}

# ─────────────────────────────────────────────
# ADMIN — Document Management
# ─────────────────────────────────────────────
@app.get("/admin/namespaces", dependencies=[Depends(require_admin_key)])
async def list_namespaces():
    """Fetch all namespaces from Pinecone, merged with standard namespaces."""
    try:
        stats = index.describe_index_stats()
        dynamic_namespaces = list(stats.get("namespaces", {}).keys())
        
        # Combine and filter unwanted namespaces
        all_namespaces = list(set(VALID_NAMESPACES) | set(dynamic_namespaces))
        all_namespaces = [ns for ns in all_namespaces if ns not in ["feedback-namespace", "training-namespace"]]
        
        all_namespaces.sort()
        return {"namespaces": all_namespaces}
    except Exception as e:
        logger.error(f"Error fetching namespaces: {str(e)}")
        # If Pinecone call fails, at least return the standard ones
        return {"namespaces": sorted(VALID_NAMESPACES)}

@app.get("/admin/documents", dependencies=[Depends(require_admin_key)])
async def list_documents(namespace: Optional[str] = None):
    """List all documents stored in Pinecone, optionally filtered by namespace."""
    try:
        if namespace:
            target_namespaces = [namespace]
        else:
            stats = index.describe_index_stats()
            target_namespaces = list(stats.get("namespaces", {}).keys())
            # If nothing in Pinecone yet, use VALID_NAMESPACES for an empty search
            if not target_namespaces:
                target_namespaces = VALID_NAMESPACES

        all_docs = []
        dummy_vector = [0.0] * 3072

        for ns in target_namespaces:
            if ns in ["feedback-namespace", "training-namespace"]:
                continue  # Skip feedback and training in general document listing
            try:
                response = index.query(
                    vector=dummy_vector,
                    namespace=ns,
                    filter={"chunk_index": 0},
                    top_k=10000,
                    include_metadata=True,
                )
                # Maps exactly ONE result per document
                for match in response.matches:
                    fname = match.metadata.get("filename", "Unknown")
                    ts = match.metadata.get("timestamp", "")
                    chunk_count = match.metadata.get("total_chunks", 1)
                    all_docs.append({
                        "filename": fname,
                        "namespace": ns,
                        "timestamp": ts,
                        "chunk_count": chunk_count,
                        "storage_path": match.metadata.get("storage_path"),
                        "content_type": match.metadata.get("content_type"),
                    })
            except Exception as ns_err:
                logger.warning(f"Could not query namespace {ns}: {str(ns_err)}")

        return {"documents": all_docs, "total": len(all_docs)}
    except Exception as e:
        logger.error(f"Error listing documents: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/document-url", dependencies=[Depends(require_admin_key)])
async def get_document_view_url(storage_path: str, expires_in: int = 300):
    """Mint a short-lived signed URL for viewing an archived original.

    The bucket should be PRIVATE; this endpoint is the only way to access files.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        result = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(storage_path, expires_in)
        signed_url = result.get("signedURL") or result.get("signed_url") or result.get("signedUrl")
        if not signed_url:
            raise HTTPException(status_code=500, detail="Failed to mint signed URL")
        return {"url": signed_url, "expires_in": expires_in}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[storage] signed URL error for {storage_path}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# PDF UPLOAD (Role-Namespace Aware)
# ─────────────────────────────────────────────
@app.post("/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    timestamp: str = Form(None),
    namespace: str = Form("general-namespace"),
    x_admin_key: Optional[str] = Header(None),
):
    if x_admin_key != ADMIN_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Admin key required to upload documents")

    # No longer strictly enforcing VALID_NAMESPACES to allow dynamic creation

    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    logger.info(f"Uploading PDF: {file.filename} → namespace={namespace}")

    try:
        content = await file.read()

        storage_path = archive_original_file(
            namespace, file.filename, content, "application/pdf", timestamp
        )

        import fitz
        text = ""
        with fitz.open(stream=content, filetype="pdf") as doc:
            for page_num, page in enumerate(doc):
                page_text = page.get_text("text")
                if page_text:
                    page_text = " ".join(page_text.split())
                    text += page_text + " "

        if not text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the PDF")

        chunks = text_splitter.split_text(text)
        chunks = [chunk.strip() for chunk in chunks if chunk.strip()]
        logger.info(f"Split into {len(chunks)} chunks")

        embeddings = generate_embeddings(chunks)

        vectors = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            metadata = {
                "text": chunk,
                "filename": file.filename,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "namespace": namespace,
            }
            if timestamp:
                metadata["timestamp"] = timestamp
            if storage_path:
                metadata["storage_path"] = storage_path
                metadata["content_type"] = "application/pdf"

            vectors.append({
                "id": f"pdf_{namespace}_{file.filename}_{i}",
                "values": embedding,
                "metadata": metadata,
            })

        # Upsert in batches of 100
        for b in range(0, len(vectors), 100):
            batch = vectors[b : b + 100]
            index.upsert(vectors=batch, namespace=namespace)
            logger.info(f"Uploaded batch {b // 100 + 1}/{(len(vectors)-1)//100 + 1}")

        return {
            "message": "PDF processed and stored",
            "filename": file.filename,
            "namespace": namespace,
            "chunks_stored": len(vectors),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

# ─────────────────────────────────────────────
# TEXT UPLOAD (Role-Namespace Aware)
# ─────────────────────────────────────────────
@app.post("/upload-text")
async def upload_text(
    file: UploadFile = File(...),
    timestamp: str = Form(None),
    namespace: str = Form("general-namespace"),
    x_admin_key: Optional[str] = Header(None),
):
    if x_admin_key and x_admin_key != ADMIN_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Admin key required to upload documents")

    # No longer strictly enforcing VALID_NAMESPACES to allow dynamic creation

    logger.info(f"Uploading Text: {file.filename} → namespace={namespace}")

    try:
        content_bytes = await file.read()
        text = content_bytes.decode('utf-8')

        if not text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the file")

        storage_path = archive_original_file(
            namespace, file.filename, content_bytes, "text/plain; charset=utf-8", timestamp
        )

        chunks = text_splitter.split_text(text)
        chunks = [chunk.strip() for chunk in chunks if chunk.strip()]
        logger.info(f"Split into {len(chunks)} chunks")

        embeddings = generate_embeddings(chunks)

        vectors = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            metadata = {
                "text": chunk,
                "filename": file.filename,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "namespace": namespace,
            }
            if timestamp:
                metadata["timestamp"] = timestamp
            if storage_path:
                metadata["storage_path"] = storage_path
                metadata["content_type"] = "text/plain; charset=utf-8"

            vectors.append({
                "id": f"text_{namespace}_{file.filename}_{i}",
                "values": embedding,
                "metadata": metadata,
            })

        # Upsert in batches of 100
        for b in range(0, len(vectors), 100):
            batch = vectors[b : b + 100]
            index.upsert(vectors=batch, namespace=namespace)
            logger.info(f"Uploaded batch {b // 100 + 1}/{(len(vectors)-1)//100 + 1}")

        return {
            "message": "Text processed and stored",
            "filename": file.filename,
            "namespace": namespace,
            "chunks_stored": len(vectors),
        }

    except Exception as e:
        logger.error(f"Error processing Text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing Text: {str(e)}")

# ─────────────────────────────────────────────
# DOCX UPLOAD (Role-Namespace Aware)
# ─────────────────────────────────────────────
@app.post("/upload-docx")
async def upload_docx(
    file: UploadFile = File(...),
    timestamp: str = Form(None),
    namespace: str = Form("general-namespace"),
    x_admin_key: Optional[str] = Header(None),
):
    if x_admin_key and x_admin_key != ADMIN_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Admin key required to upload documents")

    # No longer strictly enforcing VALID_NAMESPACES to allow dynamic creation

    if not (file.filename.endswith(".docx") or file.filename.endswith(".doc")):
        raise HTTPException(status_code=400, detail="Only DOC/DOCX files are allowed")

    logger.info(f"Uploading DOCX: {file.filename} → namespace={namespace}")

    try:
        import docx
        import io

        content = await file.read()

        docx_content_type = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            if file.filename.lower().endswith(".docx")
            else "application/msword"
        )
        storage_path = archive_original_file(
            namespace, file.filename, content, docx_content_type, timestamp
        )

        doc = docx.Document(io.BytesIO(content))

        text = "\n".join([paragraph.text for paragraph in doc.paragraphs if paragraph.text])

        if not text.strip():
            raise HTTPException(status_code=400, detail="No readable text could be extracted from the document")

        chunks = text_splitter.split_text(text)
        chunks = [chunk.strip() for chunk in chunks if chunk.strip()]
        logger.info(f"Split into {len(chunks)} chunks")

        embeddings = generate_embeddings(chunks)

        vectors = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            metadata = {
                "text": chunk,
                "filename": file.filename,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "namespace": namespace,
            }
            if timestamp:
                metadata["timestamp"] = timestamp
            if storage_path:
                metadata["storage_path"] = storage_path
                metadata["content_type"] = docx_content_type

            vectors.append({
                "id": f"docx_{namespace}_{file.filename}_{i}",
                "values": embedding,
                "metadata": metadata,
            })

        # Upsert in batches of 100
        for b in range(0, len(vectors), 100):
            batch = vectors[b : b + 100]
            index.upsert(vectors=batch, namespace=namespace)
            logger.info(f"Uploaded batch {b//100 + 1}/{(len(vectors)-1)//100 + 1}")
        return {
            "message": "DOCX processed and stored",
            "filename": file.filename,
            "namespace": namespace,
            "chunks_stored": len(vectors),
        }

    except Exception as e:
        logger.error(f"Error processing DOCX: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing DOCX: {str(e)}")

# ─────────────────────────────────────────────
# DELETE by Timestamp (both namespaces)
# ─────────────────────────────────────────────
@app.delete("/delete-by-timestamp", dependencies=[Depends(require_admin_key)])
async def delete_by_timestamp(timestamp: str, namespace: str):
    # No longer strictly enforcing VALID_NAMESPACES
    try:
        dummy_vector = [0.0] * 3072
        query_response = index.query(
            vector=dummy_vector,
            filter={"timestamp": timestamp},
            namespace=namespace,
            top_k=10000,
            include_metadata=True,
        )
        vector_ids = [match.id for match in query_response.matches]
        if not vector_ids:
            return {"message": f"No vectors found for timestamp {timestamp} in {namespace}"}
        index.delete(ids=vector_ids, namespace=namespace)
        return {"message": f"Deleted {len(vector_ids)} vectors from {namespace}", "vectors_deleted": len(vector_ids)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/document-chunks", dependencies=[Depends(require_admin_key)])
async def get_document_chunks(filename: str, namespace: str):
    """Retrieve all stored text chunks for a specific document from Pinecone."""
    try:
        dummy_vector = [0.0] * 3072
        query_response = index.query(
            vector=dummy_vector,
            filter={"filename": filename},
            namespace=namespace,
            top_k=10000,
            include_metadata=True,
        )
        if not query_response.matches:
            return {"chunks": [], "total": 0, "filename": filename, "namespace": namespace}

        matches = sorted(query_response.matches, key=lambda m: m.metadata.get("chunk_index", 0))
        chunks = [m.metadata.get("text", "") for m in matches if m.metadata.get("text")]

        return {"chunks": chunks, "total": len(chunks), "filename": filename, "namespace": namespace}
    except Exception as e:
        logger.error(f"Error fetching document chunks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/delete-by-filename", dependencies=[Depends(require_admin_key)])
async def delete_by_filename(filename: str, namespace: str):
    """Delete all vectors for a given filename from a namespace + the archived original."""
    try:
        dummy_vector = [0.0] * 3072
        query_response = index.query(
            vector=dummy_vector,
            filter={"filename": filename},
            namespace=namespace,
            top_k=10000,
            include_metadata=True,
        )
        vector_ids = [match.id for match in query_response.matches]
        if not vector_ids:
            return {"message": f"No vectors found for filename '{filename}' in {namespace}"}

        # Collect distinct storage paths before deleting vectors, then clean up originals.
        storage_paths = {
            m.metadata.get("storage_path")
            for m in query_response.matches
            if m.metadata.get("storage_path")
        }
        index.delete(ids=vector_ids, namespace=namespace)
        for sp in storage_paths:
            delete_archived_file(sp)

        return {"message": f"Deleted '{filename}' ({len(vector_ids)} vectors) from {namespace}", "vectors_deleted": len(vector_ids)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/delete-namespace", dependencies=[Depends(require_admin_key)])
async def delete_namespace(namespace: str):
    """Delete all vectors in a namespace."""
    try:
        index.delete(delete_all=True, namespace=namespace)
        logger.info(f"Deleted all vectors in namespace: {namespace}")
        return {"message": f"Deleted all vectors in namespace: {namespace}"}
    except Exception as e:
        logger.error(f"Error deleting namespace {namespace}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
def generate_improved_response(question: str, ai_response: str, correct_response: str) -> str:
    system_prompt = """
    You are a helpful assistant that improves responses based on user feedback.
    Given the original question, AI's response, and the user's correction,
    create a perfect response that incorporates the user's feedback while
    maintaining factual accuracy and clarity.
    """
    user_prompt = f"""
    Question: {question}
    AI Response: {ai_response}
    User Correction: {correct_response}
    Please generate an improved response that incorporates the user's feedback.
    """
    response = openai_client.chat.completions.create(
        model="gpt-4-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content

@app.post("/feedback")
async def process_feedback(feedback: FeedbackPayload):
    try:
        logger.info(f"[feedback] received correction for question: {feedback.question[:80]!r}")
        improved_response = generate_improved_response(
            feedback.question, feedback.ai_response, feedback.correct_response
        )
        context_text = f"Question: {feedback.question}\nImproved Response: {improved_response}"
        embedding = generate_embeddings([context_text])[0]
        vector_id = f"feedback_{feedback.timestamp}_{hash(feedback.question)}"
        metadata = {
            "text": context_text,
            "question": feedback.question,
            "original_response": feedback.ai_response,
            "user_correction": feedback.correct_response,
            "improved_response": improved_response,
            "timestamp": feedback.timestamp,
            "type": "feedback",
            "is_correction": True,
        }
        index.upsert(vectors=[{"id": vector_id, "values": embedding, "metadata": metadata}], namespace="feedback-namespace")
        logger.info(f"[feedback] upserted vector_id={vector_id} to feedback-namespace")
        return {"message": "Feedback processed", "improved_response": improved_response, "vector_id": vector_id}
    except Exception as e:
        logger.error(f"[feedback] failed to process correction: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/list-feedback")
async def list_feedback(timestamp: str = None, limit: int = 10000):
    dummy_vector = [0.0] * 3072
    filter_dict = {"type": "feedback"}
    if timestamp:
        filter_dict["timestamp"] = timestamp
    query_response = index.query(
        vector=dummy_vector,
        filter=filter_dict,
        namespace="feedback-namespace",
        top_k=limit,
        include_metadata=True,
    )
    feedback_entries = [
        {
            "vector_id": match.id,
            "score": match.score,
            "question": match.metadata.get("question"),
            "original_response": match.metadata.get("original_response"),
            "user_correction": match.metadata.get("user_correction"),
            "improved_response": match.metadata.get("improved_response"),
            "timestamp": match.metadata.get("timestamp"),
        }
        for match in query_response.matches
    ]
    return {"feedback_entries": feedback_entries, "count": len(feedback_entries)}

@app.delete("/delete-feedback-by-id")
async def delete_feedback_by_id(vector_id: str):
    index.delete(ids=[vector_id], namespace="feedback-namespace")
    return {"message": f"Deleted feedback vector: {vector_id}"}

@app.put("/update-feedback")
async def update_feedback(update_data: FeedbackUpdatePayload):
    logger.info(f"[feedback] update request for vector_id={update_data.vector_id} question={(update_data.question or '')[:80]!r}")
    try:
        dummy_vector = [0.0] * 3072
        query_response = index.query(
            vector=dummy_vector,
            filter={"id": update_data.vector_id},
            namespace="feedback-namespace",
            top_k=1,
            include_metadata=True,
        )
        if not query_response.matches:
            logger.warning(f"[feedback] update failed — vector_id={update_data.vector_id} not found")
            raise HTTPException(status_code=404, detail=f"Feedback {update_data.vector_id} not found")

        existing_metadata = dict(query_response.matches[0].metadata)
        if update_data.question:
            existing_metadata["question"] = update_data.question
        if update_data.ai_response:
            existing_metadata["original_response"] = update_data.ai_response
        if update_data.correct_response:
            existing_metadata["user_correction"] = update_data.correct_response
        if update_data.improved_response:
            existing_metadata["improved_response"] = update_data.improved_response
        elif any([update_data.question, update_data.ai_response, update_data.correct_response]):
            existing_metadata["improved_response"] = generate_improved_response(
                existing_metadata.get("question"),
                existing_metadata.get("original_response"),
                existing_metadata.get("user_correction"),
            )

        updated_context = f"Question: {existing_metadata.get('question')}\nImproved Response: {existing_metadata.get('improved_response')}"
        existing_metadata["text"] = updated_context
        new_embedding = generate_embeddings([updated_context])[0]
        index.upsert(vectors=[{"id": update_data.vector_id, "values": new_embedding, "metadata": existing_metadata}], namespace="feedback-namespace")
        logger.info(f"[feedback] re-embedded and upserted vector_id={update_data.vector_id}")
        return {"message": f"Updated feedback {update_data.vector_id}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[feedback] update failed for vector_id={update_data.vector_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ─────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "service": "Internal Employee Assistant RAG Server"}

@app.get("/roles")
async def list_roles():
    """Public endpoint — lists available roles and their namespaces (for frontend config)."""
    return {"roles": list(ROLE_NAMESPACES.keys())}

# ─────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)