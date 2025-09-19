from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.db import Engine

client = TestClient(app)

def reset_db():
    with Engine.begin() as conn:
        conn.execute(text("DELETE FROM leads"))

def test_full_flow():
    reset_db()

    # создать лида
    r = client.post("/leads", json={"name": "John", "email": "john@example.com"})
    assert r.status_code == 201
    lid = r.json()["id"]

    # принять лида
    r = client.post(f"/leads/{lid}/accept", json={"user": "manager1"})
    assert r.status_code == 200
    assert r.json()["accepted_by"] == "manager1"
    assert r.json()["accepted_at"] is not None

    # список принятых
    r = client.get("/leads", params={"accepted": True})
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()]
    assert lid in ids

    # снять принятие
    r = client.post(f"/leads/{lid}/unaccept")
    assert r.status_code == 200
    assert r.json()["accepted_by"] is None
    assert r.json()["accepted_at"] is None

    # список непринятых
    r = client.get("/leads", params={"accepted": False})
    assert r.status_code == 200
    ids = [x["id"] for x in r.json()]
    assert lid in ids
