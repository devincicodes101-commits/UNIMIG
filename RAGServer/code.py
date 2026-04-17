from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
import os
import json
import sqlite3
from datetime import datetime

from openai import OpenAI
from pinecone import Pinecone

# ================================
# CONFIG
# ================================
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_HOST = os.getenv("PINECONE_HOST")
ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "change-me")

CHAT_MODEL = "gpt-4.1-mini"
EMBED_MODEL = "text-embedding-3-small"

# ================================
# CLIENTS
# ================================
openai_client = OpenAI(api_key=OPENAI_API_KEY)

pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(host=PINECONE_HOST)

# ================================
# APP
# ================================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================================
# ROLE → NAMESPACE
# ================================
ROLE_NAMESPACES = {
    "sales": ["sales-namespace", "general-namespace"],
    "support": ["support-namespace", "general-namespace"],
    "operations": ["operations-namespace", "general-namespace"],
    "accounting": ["accounting-namespace"],
    "management": ["sales-namespace","support-namespace","operations-namespace","accounting-namespace","general-namespace"],
    "admin": ["sales-namespace","support-namespace","operations-namespace","accounting-namespace","general-namespace"],
    "unassigned": ["general-namespace"]
}

# ================================
# MODELS
# ================================
class ChatRequest(BaseModel):
    message: str
    role: str = "unassigned"
    top_k: int = 5

class QueryRequest(BaseModel):
    query: str
    role: Optional[str] = "unassigned"
    top_k: int = 5
    user_id: Optional[str] = None
    user_email: Optional[str] = None

class LogConversationRequest(BaseModel):
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    role: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    sources: Optional[List[str]] = None
    timestamp: Optional[str] = None

# ================================
# HELPERS
# ================================
def get_embedding(text: str):
    res = openai_client.embeddings.create(
        model=EMBED_MODEL,
        input=[text]
    )
    return res.data[0].embedding

def search_pinecone_matches(query: str, role: str, top_k: int):
    vector = get_embedding(query)
    namespaces = ROLE_NAMESPACES.get(role, ["general-namespace"])

    all_matches = []

    for ns in namespaces:
        res = index.query(
            vector=vector,
            top_k=top_k,
            namespace=ns,
            include_metadata=True
        )
        for m in res.matches:
            meta = dict(m.metadata or {})
            meta.setdefault("namespace", ns)
            all_matches.append({
                "id": m.id,
                "score": m.score,
                "metadata": meta
            })

    all_matches.sort(key=lambda x: x["score"], reverse=True)
    return all_matches[:top_k]

def search_pinecone(query: str, role: str, top_k: int):
    matches = search_pinecone_matches(query, role, top_k)
    docs = [m["metadata"].get("text", "") for m in matches]
    sources = list({m["metadata"].get("filename", "Unknown") for m in matches})
    return docs, sources

def build_prompt(context_docs: List[str], question: str):
    context = "\n\n".join(context_docs)

    return [
        {
            "role": "system",
            "content": "You are an internal company assistant. Answer ONLY from provided context. If not found, say you don't know."
        },
        {
            "role": "user",
            "content": f"Context:\n{context}\n\nQuestion:\n{question}"
        }
    ]

# ================================
# MAIN CHAT
# ================================
@app.post("/chat")
async def chat(req: ChatRequest):
    try:
        docs, sources = search_pinecone(req.message, req.role, req.top_k)

        if not docs:
            return {
                "answer": "I could not find relevant information in the knowledge base.",
                "sources": []
            }

        messages = build_prompt(docs, req.message)

        response = openai_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            temperature=0.2
        )

        answer = response.choices[0].message.content

        return {
            "answer": answer,
            "sources": sources
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================
# RAW RETRIEVAL (for morphic frontend)
# ================================
@app.post("/query")
async def query(req: QueryRequest):
    try:
        role = (req.role or "unassigned").lower()
        matches = search_pinecone_matches(req.query, role, req.top_k)
        sources = list({m["metadata"].get("filename", "Unknown") for m in matches})
        return {
            "query": req.query,
            "results": matches,
            "sources": sources
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================
# CONVERSATION LOGGING
# ================================
@app.post("/log-conversation")
async def log_conversation(req: LogConversationRequest):
    try:
        conn = sqlite3.connect(os.getenv("CONVERSATIONS_DB", "conversations.db"))
        conn.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                user_email TEXT,
                role TEXT,
                question TEXT,
                answer TEXT,
                sources TEXT,
                timestamp TEXT
            )
        """)
        conn.execute(
            "INSERT INTO conversations (user_id, user_email, role, question, answer, sources, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                req.user_id,
                req.user_email,
                req.role,
                req.question,
                req.answer,
                json.dumps(req.sources or []),
                req.timestamp or datetime.utcnow().isoformat()
            )
        )
        conn.commit()
        conn.close()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

# ================================
# HEALTH CHECK
# ================================
@app.get("/")
def health():
    return {"status": "ok"}
