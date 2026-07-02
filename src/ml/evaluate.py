import sys
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def grade_single_answer(data):
    student_answer = data.get("studentAnswer", "")
    model_answer = data.get("modelAnswer", "")
    max_marks = float(data.get("maxMarks", 0))

    # Handle empty student answer
    if not student_answer.strip():
        return {
            "similarity": 0.0,
            "marks": 0,
            "feedback": "Incomplete: The student did not provide an answer."
        }

    # Vectorization
    vectorizer = TfidfVectorizer(stop_words='english')
    
    # Fit and transform the model answer and student answer
    try:
        tfidf_matrix = vectorizer.fit_transform([model_answer, student_answer])
        # Calculate cosine similarity between the two vectors
        similarity_score = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
    except ValueError:
        # Fallback if text is too short or contains only stop words
        similarity_score = 0.0

    # Calculate proportional marks (rounded)
    earned_marks = round(similarity_score * max_marks)

    # Categorize feedback
    if similarity_score >= 0.8:
        feedback = "Excellent: The answer captures the core concepts accurately and aligns well with the model answer."
    elif similarity_score >= 0.4:
        feedback = "Moderate: The answer is on the right track but lacks some key details or precise terminology."
    else:
        feedback = "Incomplete: The answer misses the main points. Please review the material and the model answer."

    # Output JSON
    return {
        "similarity": round(float(similarity_score), 4),
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
            # Process multiple answers
            results = [grade_single_answer(item) for item in input_data]
            print(json.dumps(results))
        else:
            # Process a single answer
            result = grade_single_answer(input_data)
            print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    evaluate()
