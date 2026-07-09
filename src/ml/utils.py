import re
import warnings

warnings.filterwarnings("ignore")

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

def get_words(text):
    return re.findall(r'\b\w+\b', str(text).lower())

def get_ngrams(words, n):
    return set(zip(*[words[i:] for i in range(n)]))

def extract_features(student_text, model_text, max_marks, tfidf_cosine_sim):
    # Get words
    student_words = get_words(student_text)
    model_words = get_words(model_text)

    # Semantic similarity
    f_tfidf = float(tfidf_cosine_sim)

    # Jaccard similarity
    s_set, m_set = set(student_words), set(model_words)
    union = s_set | m_set
    f_jaccard = len(s_set & m_set) / len(union) if union else 0.0

    # Character length ratio
    f_length = len(student_text) / max(len(model_text), 1)
    
    # Word count ratio
    f_word_count = len(student_words) / max(len(model_words), 1)

    # Keyword overlap
    s_keywords = {w for w in student_words if w not in ENGLISH_STOP_WORDS}
    m_keywords = {w for w in model_words if w not in ENGLISH_STOP_WORDS}
    f_keyword_overlap = len(s_keywords & m_keywords) / max(len(m_keywords), 1)

    # Bigram overlap
    s_bigrams = get_ngrams(student_words, 2)
    m_bigrams = get_ngrams(model_words, 2)
    f_bigram = len(s_bigrams & m_bigrams) / max(len(m_bigrams), 1)

    # Trigram overlap
    s_trigrams = get_ngrams(student_words, 3)
    m_trigrams = get_ngrams(model_words, 3)
    f_trigram = len(s_trigrams & m_trigrams) / max(len(m_trigrams), 1)

    # Max marks
    f_max_marks = float(max_marks)

    return [f_tfidf, f_jaccard, f_length, f_word_count,
            f_keyword_overlap, f_bigram, f_trigram, f_max_marks]
