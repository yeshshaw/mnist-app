# app.py
from fastapi import FastAPI
from fastapi.responses import FileResponse
from pydantic import BaseModel
import numpy as np
import pickle

from fastapi.middleware.cors import CORSMiddleware


from fastapi.staticfiles import StaticFiles
import os



# ======================
# Load trained weights
# ======================
with open("scratch_model.pkl", "rb") as f:
    W1, W2, B1, B2 = pickle.load(f)

# ======================
# Model functions
# ======================
def relu(Z):
    return np.maximum(0, Z)

def relu_derivative(Z):
    return (Z > 0).astype(float)

def softmax(Z):
    expZ = np.exp(Z - np.max(Z, axis=1, keepdims=True))
    return expZ / np.sum(expZ, axis=1, keepdims=True)

def forwardpropagation(X, W1, W2, B1, B2):
    Z1 = np.dot(X, W1) + B1
    A1 = relu(Z1)
    Z2 = np.dot(A1, W2) + B2
    A2 = softmax(Z2)
    return Z1, A1, Z2, A2

def make_predictions(X):
    _, _, _, A2 = forwardpropagation(X, W1, W2, B1, B2)
    predictions = np.argmax(A2, axis=1)
    return predictions.tolist()

# ======================
# FastAPI app
# ======================



app = FastAPI(title="MNIST Digit Recognition API")

# Static folder mount kar do
if not os.path.exists("static"):
    os.makedirs("static")

app.mount("/static", StaticFiles(directory="static"), name="static")

# Allow all origins (development ke liye)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ya specific origin: ["http://127.0.0.1:5500"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint -> serves index.html
@app.get("/")
async def read_root():
    return FileResponse(os.path.join("static", "index.html"))

# Define expected input structure
class InputData(BaseModel):
    pixels: list  # Flattened 28x28 image → 784 numbers



@app.post("/predict")
def predict(data: InputData):
    if len(data.pixels) != 784:
        return {"error": "Input must have 784 pixels!"}
    X_input = np.array(data.pixels).reshape(1, -1)
    prediction = make_predictions(X_input)  # only 1 argument
    return {"prediction": prediction[0]}

# ======================
# Run with:
# uvicorn app:app --reload
# ======================