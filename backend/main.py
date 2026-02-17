from dotenv import load_dotenv
load_dotenv('config.env')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import db_models
from routers import journal

# Create Tables
db_models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Trading Journal API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(journal.router)

from fastapi.staticfiles import StaticFiles
import os

if not os.path.exists("uploads"):
    os.makedirs("uploads")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def root():
    return {"message": "Trading Journal API Running"}
