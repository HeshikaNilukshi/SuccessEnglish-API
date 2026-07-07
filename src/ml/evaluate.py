import sys
import json
import os
import re
import warnings

# Suppress warnings from scikit-learn
warnings.filterwarnings("ignore")

try:
    from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS
    from sklearn.metrics.pairwise import cosine_similarity
    import joblib
    import numpy as np
except ImportError as e:
    print(json.dumps({"error": f"Missing required dependency: {str(e)}"}))
    sys.exit(1)

# Path to the trained model relative to this script
MODEL_PATH = os.path.join(os.path.dirname(__file__), "grading_model.pkl")

# Attempt to load the model once at module level
trained_model = None
if os.path.exists(MODEL_PATH):
    try:
        trained_model = joblib.load(MODEL_PATH)
    except Exception:
        # If model fails to load, we will fallback to TF-IDF formula
        pass

def get_words(text):
    return re.findall(r'\b\w+\b', text.lower())

def get_ngrams(words, n):
    return set(zip(*[words[i:] for i in range(n)]))

def extract_features(student_text, model_text, max_marks, tfidf_cosine_sim):
    student_words = get_words(student_text)
    model_words = get_words(model_text)
    
    # 1. tfidf_cosine
    f_tfidf = float(tfidf_cosine_sim)
    
    # 2. jaccard
    s_set = set(student_words)
    m_set = set(model_words)
    union = s_set.union(m_set)
    f_jaccard = len(s_set.intersection(m_set)) / len(union) if union else 0.0
    
    # 3. length_ratio
    f_length = len(student_text) / max(len(model_text), 1)
    
    # 4. word_count_ratio
    f_word_count = len(student_words) / max(len(model_words), 1)
    
    # 5. keyword_overlap
    s_keywords = set([w for w in student_words if w not in ENGLISH_STOP_WORDS])
    m_keywords = set([w for w in model_words if w not in ENGLISH_STOP_WORDS])
    f_keyword_overlap = len(s_keywords.intersection(m_keywords)) / max(len(m_keywords), 1)
    
    # 6. bigram_overlap
    s_bigrams = get_ngrams(student_words, 2)
    m_bigrams = get_ngrams(model_words, 2)
    f_bigram = len(s_bigrams.intersection(m_bigrams)) / max(len(m_bigrams), 1)
    
    # 7. trigram_overlap
    s_trigrams = get_ngrams(student_words, 3)
    m_trigrams = get_ngrams(model_words, 3)
    f_trigram = len(s_trigrams.intersection(m_trigrams)) / max(len(m_trigrams), 1)
    
    # 8. max_marks
    f_max_marks = float(max_marks)
    
    return [f_tfidf, f_jaccard, f_length, f_word_count, f_keyword_overlap, f_bigram, f_trigram, f_max_marks]

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

    # Vectorization for similarity score (always calculated for reference)
    vectorizer = TfidfVectorizer(stop_words='english')
    
    try:
        tfidf_matrix = vectorizer.fit_transform([model_answer, student_answer])
        similarity_score = float(cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0])
    except ValueError:
        similarity_score = 0.0

    # ML Model Prediction vs Fallback Formula
    if trained_model is not None:
        try:
            # Extract 8 features
            features = extract_features(student_answer, model_answer, max_marks, similarity_score)
            
            # Predict the normalized mark ratio (0.0 to 1.0)
            X = np.array([features])
            predicted_ratio = float(trained_model.predict(X)[0])
            
            # Clamp between 0 and 1 just in case
            predicted_ratio = max(0.0, min(1.0, predicted_ratio))
            earned_marks = round(predicted_ratio * max_marks)
        except Exception as e:
            # Fallback to formula if feature extraction or prediction fails
            earned_marks = round(similarity_score * max_marks)
    else:
        # Fallback to direct formula if model is not loaded
        earned_marks = round(similarity_score * max_marks)

    # Categorize feedback based on the base similarity score (can be adjusted later if needed)
    if similarity_score >= 0.8:
        feedback = "Excellent: The answer captures the core concepts accurately and aligns well with the model answer."
    elif similarity_score >= 0.4:
        feedback = "Moderate: The answer is on the right track but lacks some key details or precise terminology."
    else:
        feedback = "Incomplete: The answer misses the main points. Please review the material and the model answer."

    # Output JSON
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
