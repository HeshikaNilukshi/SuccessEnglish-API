import sys
import json
import os
import warnings
import numpy as np

warnings.filterwarnings("ignore")

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import joblib
from utils import extract_features

MODEL_PATH = os.path.join(os.path.dirname(__file__), "grading_model.pkl")

trained_model = None
if os.path.exists(MODEL_PATH):
    try:
        trained_model = joblib.load(MODEL_PATH)
    except Exception:
        pass

def grade_single_answer(data):
    student_answer = data.get("studentAnswer", "")
    model_answer = data.get("modelAnswer", "")
    max_marks = float(data.get("maxMarks", 0))

    if not student_answer.strip():
        return {
            "similarity": 0.0,
            "marks": 0,
            "feedback": "Incomplete: The student did not provide an answer."
        }

    vectorizer = TfidfVectorizer(stop_words='english')
    
    try:
        tfidf_matrix = vectorizer.fit_transform([model_answer, student_answer])
        similarity_score = float(cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0])
    except ValueError:
        similarity_score = 0.0

    if trained_model is not None:
        try:
            features = extract_features(student_answer, model_answer, max_marks, similarity_score)
            
            X = np.array([features])
            predicted_ratio = float(trained_model.predict(X)[0])
            
            predicted_ratio = max(0.0, min(1.0, predicted_ratio))
            earned_marks = round(predicted_ratio * max_marks)
        except Exception:
            earned_marks = round(similarity_score * max_marks)
    else:
        earned_marks = round(similarity_score * max_marks)

    marks_ratio = earned_marks / max_marks if max_marks > 0 else 0.0

    if marks_ratio >= 0.9:
        feedback = "Excellent: The answer captures the core concepts accurately and aligns well with the model answer."
    elif marks_ratio >= 0.7:
        feedback = "Good: The answer demonstrates a solid understanding with minor gaps in detail or terminology."
    elif marks_ratio >= 0.5:
        feedback = "Moderate: The answer is on the right track but lacks some key details or precise terminology."
    elif marks_ratio >= 0.25:
        feedback = "Needs Improvement: The answer shows some understanding but misses several important points."
    else:
        feedback = "Incomplete: The answer misses the main points. Please review the material and the model answer."

    return {
        "similarity": round(similarity_score, 4),
        "marks": int(earned_marks),
        "feedback": feedback
    }

def evaluate():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input data provided"}))
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])
        
        if isinstance(input_data, list):
            results = [grade_single_answer(item) for item in input_data]
            print(json.dumps(results))
        else:
            result = grade_single_answer(input_data)
            print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    evaluate()
