# thebase

## Установка и запуск

> Совет: перед установкой зависимостей убедитесь, что у вас активна последняя версия `pip`.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
