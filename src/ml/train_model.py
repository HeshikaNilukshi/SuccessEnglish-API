import os
import sys
import glob
import commentjson
import warnings
import numpy as np

warnings.filterwarnings("ignore")

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
TRAINING_DATA_DIR = os.path.join(BASE_DIR, "training data")
MODEL_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "grading_model.pkl")

from utils import extract_features

def load_data():
    files = glob.glob(os.path.join(TRAINING_DATA_DIR, "*.jsonc"))
    
    all_records = []
    for file_path in files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = commentjson.load(f)
                if isinstance(data, list):
                    all_records.extend(data)
        except Exception:
            pass

    return all_records

def prepare_dataset(records):
    X, y = [], []
    vectorizer = TfidfVectorizer(stop_words="english")

    for record in records:
        model_answer = record.get("modelAnswer", "")
        student_answer = record.get("studentAnswer", "")
        max_marks = float(record.get("maxMarks", 0))
        teacher_marks = float(record.get("teacherMarks", 0))

        if not str(student_answer).strip():
            continue

        try:
            tfidf_matrix = vectorizer.fit_transform([model_answer, student_answer])
            sim = float(cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0])
        except ValueError:
            sim = 0.0

        features = extract_features(student_answer, model_answer, max_marks, sim)
        target = max(0.0, min(1.0, teacher_marks / max(max_marks, 1.0)))

        X.append(features)
        y.append(target)

    return np.array(X), np.array(y)

def train():
    print("Training AI Grading Model...")
    
    records = load_data()
    if not records:
        print("Error: No training data found.")
        sys.exit(1)

    X, y = prepare_dataset(records)
    if len(X) < 10:
        print("Error: Not enough valid data to train (need at least 10 samples).")
        sys.exit(1)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = GradientBoostingRegressor(n_estimators=200, max_depth=4, learning_rate=0.1, random_state=42)
    model.fit(X_train, y_train)

    predictions = np.clip(model.predict(X_test), 0.0, 1.0)
    mae = mean_absolute_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)

    print(f"Training Complete. MAE: {mae:.4f} | R²: {r2:.4f}")
    
    joblib.dump(model, MODEL_OUTPUT_PATH)
    print("Model saved successfully.")

if __name__ == "__main__":
    train()
