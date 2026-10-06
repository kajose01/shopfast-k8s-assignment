import uuid
from flask import Flask, jsonify, request
app = Flask(__name__)

@app.get("/health")
def health():
    return "ok"

@app.post("/pay")
def pay():
    d = request.get_json(silent=True) or {}
    return jsonify(status="approved", txn=str(uuid.uuid4()), item=d.get("item"), amount=d.get("amount"))
