import os
import sys
import glob
import json
import re
import warnings
import numpy as np

# Suppress warnings from scikit-learn
warnings.filterwarnings("ignore")

try:
    from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error, r2_score
    import joblib
except ImportError as e:
    print(f"Error: Missing required dependency: {str(e)}")
    sys.exit(1)

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__))) # api directory
TRAINING_DATA_DIR = os.path.join(BASE_DIR, "training data")
MODEL_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "grading_model.pkl")

# ---------------------------------------------------------
# Feature Extraction (Mirrored exactly from evaluate.py)
# ---------------------------------------------------------
def get_words(text):
    return re.findall(r'\b\w+\b', str(text).lower())

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

# ---------------------------------------------------------
# Data Loading and Processing
# ---------------------------------------------------------
def remove_comments(json_str):
    pattern = r'("(?:\\.|[^"\\])*")|(/\*.*?\*/|//[^\r\n]*)'
    regex = re.compile(pattern, re.MULTILINE | re.DOTALL)
    def _replacer(match):
        if match.group(2) is not None:
            return ""
        else:
            return match.group(1)
    return regex.sub(_replacer, json_str)

def load_data():
    all_records = []
    
    # Try multiple patterns to catch .json and .jsonc
    patterns = [
        "training_data *.json", "training_data *.jsonc",
        "*.json", "*.jsonc"
    ]
    
    files = []
    for pattern in patterns:
        files.extend(glob.glob(os.path.join(TRAINING_DATA_DIR, pattern)))
        
    # Remove duplicates
    files = list(set(files))
        
    print(f"Found {len(files)} JSON files in {TRAINING_DATA_DIR}")
    
    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                clean_content = remove_comments(content)
                data = json.loads(clean_content)
                
                if isinstance(data, list):
                    all_records.extend(data)
                else:
                    print(f"Warning: {file_path} is not a JSON array, skipping.")
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            
    print(f"Total records loaded: {len(all_records)}")
    return all_records

def prepare_dataset(records):
    X = []
    y = []
    
    # We need to pre-compute TF-IDF for all pairs first
    # Using the same approach as evaluate.py (vectorizing each pair individually)
    vectorizer = TfidfVectorizer(stop_words='english')
    
    valid_count = 0
    skipped_count = 0
    
    for i, record in enumerate(records):
        model_answer = record.get("modelAnswer", "")
        student_answer = record.get("studentAnswer", "")
        max_marks = float(record.get("maxMarks", 0))
        teacher_marks = float(record.get("teacherMarks", 0))
        
        # Skip empty student answers (evaluate.py handles these directly)
        if not str(student_answer).strip():
            skipped_count += 1
            continue
            
        try:
            tfidf_matrix = vectorizer.fit_transform([model_answer, student_answer])
            similarity_score = float(cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0])
        except ValueError:
            similarity_score = 0.0
            
        features = extract_features(student_answer, model_answer, max_marks, similarity_score)
        
        # Target is the normalized mark ratio (0.0 to 1.0)
        target_ratio = teacher_marks / max(max_marks, 1.0)
        target_ratio = max(0.0, min(1.0, target_ratio)) # clamp just in case
        
        X.append(features)
        y.append(target_ratio)
        valid_count += 1
        
        if valid_count % 200 == 0:
            print(f"Processed {valid_count} valid records...")
            
    print(f"Dataset preparation complete. Valid: {valid_count}, Skipped (empty): {skipped_count}")
    return np.array(X), np.array(y)

# ---------------------------------------------------------
# Training and Evaluation
# ---------------------------------------------------------
def train_and_evaluate():
    print("--- Starting AI Grading Model Training ---")
    
    records = load_data()
    if not records:
        print("No training data found. Exiting.")
        sys.exit(1)
        
    X, y = prepare_dataset(records)
    
    if len(X) < 10:
        print("Not enough valid data to train (need at least 10 records). Exiting.")
        sys.exit(1)
        
    print(f"\nSplitting data (80% train, 20% test)...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training GradientBoostingRegressor...")
    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        random_state=42
    )
    
    model.fit(X_train, y_train)
    
    print("\n--- Evaluation Results ---")
    predictions = model.predict(X_test)
    
    # Clamp predictions to valid ratio range
    predictions = np.clip(predictions, 0.0, 1.0)
    
    mae = mean_absolute_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)
    
    print(f"Mean Absolute Error (ratio): {mae:.4f}")
    print(f"R² Score: {r2:.4f}")
    
    print("\nSample Predictions vs Actual Ratios:")
    for i in range(min(10, len(predictions))):
        print(f"Predicted Ratio: {predictions[i]:.2f}  |  Actual Ratio: {y_test[i]:.2f}")
        
    print(f"\nSaving trained model to: {MODEL_OUTPUT_PATH}")
    joblib.dump(model, MODEL_OUTPUT_PATH)
    print("Model saved successfully. evaluate.py will now use this model for grading!")

if __name__ == "__main__":
    train_and_evaluate()
