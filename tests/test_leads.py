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

    # создать 3 лида
    ids = []
    for i in range(3):
        r = client.post("/leads", json={"name": f"User{i}", "email": f"user{i}@example.com"})
        assert r.status_code == 201
        ids.append(r.json()["id"])

    # пагинация
    r = client.get("/leads", params={"limit": 2, "offset": 0, "order": "created"})
    assert r.status_code == 200
    data = r.json()
    assert {"items","total","limit","offset","page","pages"} <= data.keys()
    assert data["limit"] == 2
    assert data["page"] == 1

    # обновление
    lid = ids[0]
    r = client.patch(f"/leads/{lid}", json={"phone": "123"})
    assert r.status_code == 200
    assert r.json()["phone"] == "123"

    # принять и проверить фильтр accepted
    r = client.post(f"/leads/{lid}/accept", json={"user": "mgr"})
    assert r.status_code == 200
    r = client.get("/leads", params={"accepted": True})
    assert r.status_code == 200
    assert any(it["id"] == lid for it in r.json()["items"])

    # экспорт CSV
    r = client.get("/leads/export.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")

    # удалить
    r = client.delete(f"/leads/{lid}")
    assert r.status_code == 204
