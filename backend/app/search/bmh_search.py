import re
import unicodedata
from typing import List, Dict, Any, Tuple

def normalize_text(text: str) -> str:
    """
    Normalizes text by converting to lowercase, removing accents/diacritics,
    and stripping punctuation.
    """
    if not text:
        return ""
    # Convert to lowercase
    text = text.lower()
    # Normalize unicode accents
    text = "".join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    )
    # Retain alphanumeric and spaces
    text = re.sub(r'[^a-z0-9\s]', '', text)
    # Collapse multiple spaces
    return " ".join(text.split())

class AdvancedBMHSearch:
    @staticmethod
    def build_shift_table(pattern: str) -> Dict[str, int]:
        """
        Builds the Bad Character Shift table for Boyer-Moore-Horspool.
        """
        m = len(pattern)
        shift = {}
        for i in range(m - 1):
            shift[pattern[i]] = m - 1 - i
        return shift

    @classmethod
    def search_token(cls, text: str, pattern: str) -> List[Tuple[int, int]]:
        """
        Performs Boyer-Moore-Horspool search with dynamic k-mismatches.
        Returns a list of tuples: (start_index, mismatch_count).
        """
        n = len(text)
        m = len(pattern)
        if m == 0 or n < m:
            return []

        # Determine k-mismatch threshold based on pattern length
        if m >= 7:
            k = 2
        elif m >= 4:
            k = 1
        else:
            k = 0  # Exact matching for short tokens

        shift = cls.build_shift_table(pattern)
        matches = []
        i = 0

        while i <= n - m:
            mismatches = 0
            j = m - 1
            while j >= 0:
                if text[i + j] != pattern[j]:
                    mismatches += 1
                    if mismatches > k:
                        break
                j -= 1
            
            if j < 0:
                matches.append((i, mismatches))
            
            # Shift using bad character table based on character aligned with last character of pattern
            last_char = text[i + m - 1]
            i += max(1, shift.get(last_char, m))

        return matches

    @classmethod
    def score_field(cls, field_text: str, query_tokens: List[str], field_weight: float) -> Tuple[float, int]:
        """
        Scores a specific text field against a list of query tokens.
        Returns a tuple: (score, number_of_matched_tokens).
        """
        if not field_text or not query_tokens:
            return 0.0, 0
        
        normalized_field = normalize_text(field_text)
        matched_count = 0
        total_score = 0.0

        for token in query_tokens:
            matches = cls.search_token(normalized_field, token)
            if not matches:
                continue

            matched_count += 1
            token_score = 0.0

            # Score each occurrence
            for start_idx, mismatches in matches:
                # Base score penalized by mismatches
                match_purity = 1.0 - (mismatches * 0.2)
                occurrence_score = field_weight * match_purity

                # Bonus for matching at word boundaries (start of words)
                is_start_of_word = (start_idx == 0 or normalized_field[start_idx - 1] == ' ')
                if is_start_of_word:
                    occurrence_score *= 1.2
                
                # Bonus for exact full word matches
                is_end_of_word = (start_idx + len(token) == len(normalized_field) or normalized_field[start_idx + len(token)] == ' ')
                if is_start_of_word and is_end_of_word:
                    occurrence_score *= 1.3

                # Match closeness to the start of the text bonus
                position_bonus = max(0.5, 1.0 - (start_idx / len(normalized_field)))
                occurrence_score *= (1.0 + 0.1 * position_bonus)

                token_score = max(token_score, occurrence_score)

            total_score += token_score

        return total_score, matched_count

    @classmethod
    def search_entities(cls, query: str, books: List[Dict[str, Any]], authors: List[Dict[str, Any]], categories: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """
        Performs a unified search across books, authors, and genres using the Advanced BMH algorithm.
        """
        normalized_query = normalize_text(query)
        if not normalized_query:
            return {"books": [], "authors": [], "genres": []}

        query_tokens = normalized_query.split()
        num_tokens = len(query_tokens)

        matched_books = []
        matched_authors = []
        matched_genres = []

        # 1. Search Books
        for book in books:
            # Fields weights: Title=100, Subtitle=40, Authors=80, Categories=50, Description=15
            score_title, matches_t = cls.score_field(book.get("title", ""), query_tokens, 100.0)
            score_subtitle, matches_sub = cls.score_field(book.get("subtitle", ""), query_tokens, 40.0)
            
            # Combine author lists and category lists
            authors_str = " ".join(book.get("authors", []))
            categories_str = " ".join(book.get("categories", []))
            
            score_authors, matches_a = cls.score_field(authors_str, query_tokens, 80.0)
            score_categories, matches_c = cls.score_field(categories_str, query_tokens, 50.0)
            score_desc, matches_d = cls.score_field(book.get("description", ""), query_tokens, 15.0)

            total_score = score_title + score_subtitle + score_authors + score_categories + score_desc
            total_matches = max(matches_t, matches_sub, matches_a, matches_c, matches_d)

            if total_score > 0:
                # Multi-token complete match bonus
                if total_matches == num_tokens and num_tokens > 1:
                    total_score *= 1.5
                
                # Boost based on average rating to favor higher rated items slightly
                rating_boost = 1.0 + (float(book.get("average_rating") or 0.0) / 10.0)
                total_score *= rating_boost

                book_result = book.copy()
                book_result["score"] = round(total_score, 2)
                matched_books.append(book_result)

        # 2. Search Authors
        for author in authors:
            score, matched = cls.score_field(author.get("name", ""), query_tokens, 150.0)
            if score > 0:
                if matched == num_tokens and num_tokens > 1:
                    score *= 1.5
                author_result = author.copy()
                author_result["score"] = round(score, 2)
                matched_authors.append(author_result)

        # 3. Search Genres (Categories)
        for cat in categories:
            score, matched = cls.score_field(cat.get("name", ""), query_tokens, 150.0)
            if score > 0:
                if matched == num_tokens and num_tokens > 1:
                    score *= 1.5
                genre_result = cat.copy()
                genre_result["score"] = round(score, 2)
                matched_genres.append(genre_result)

        # Sort all by match score descending
        matched_books.sort(key=lambda x: x["score"], reverse=True)
        matched_authors.sort(key=lambda x: x["score"], reverse=True)
        matched_genres.sort(key=lambda x: x["score"], reverse=True)

        return {
            "books": matched_books[:20],
            "authors": matched_authors[:10],
            "genres": matched_genres[:10]
        }
