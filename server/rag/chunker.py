import logging
import traceback

logger = logging.getLogger(__name__)

def chunk_text_generator(text: str, chunk_size: int = 500, overlap: int = 50):
    lines = text.split('\n')
    current_chunk = []
    current_size = 0
    for line in lines:
        if current_size + len(line) > chunk_size and current_chunk:
            yield '\n'.join(current_chunk)

            # Build overlap from trailing lines, capped by `overlap` chars
            overlap_lines = []
            overlap_size = 0
            for l in reversed(current_chunk):
                if overlap_size + len(l) > overlap:
                    break
                overlap_lines.insert(0, l)
                overlap_size += len(l)

            current_chunk = overlap_lines
            current_size = overlap_size

        current_chunk.append(line)
        current_size += len(line)

    if current_chunk:
        yield '\n'.join(current_chunk)

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    Split text into chunks by line boundaries, never cutting mid-line.
    `overlap` controls how many trailing characters of context carry
    into the next chunk.
    """
    try:
        if not text:
            return []
        return list(chunk_text_generator(text, chunk_size, overlap))
    except Exception as e:
        logger.error("Error in chunk_text: %s", e)
        traceback.print_exc()
        return []
