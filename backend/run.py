"""Dev entry point: `python run.py` launches Uvicorn with reload (merged app: port 8001)."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
