"""Read the user-selected local PDFs; preserve originals outside the mini-program bundle."""
import argparse
import hashlib
import json
import pathlib
import re
import shutil
import fitz

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'references' / 'paper-import'

def clean(text):
    text = text.replace('\u00ad', '').translate(str.maketrans({'ﬀ':'ff','ﬁ':'fi','ﬂ':'fl','ﬃ':'ffi','ﬄ':'ffl','ﬅ':'st','ﬆ':'st'}))
    text = re.sub(r'([A-Za-z])-\s*\n\s*([a-z])', r'\1\2', text)
    return re.sub(r'[ \t]+', ' ', text).strip()

def page_text(page):
    blocks = [b for b in page.get_text('blocks') if b[6] == 0 and b[4].strip()]
    mid = page.rect.width / 2
    # Read the left column before the right; full-width headings remain above them.
    left = [b for b in blocks if b[0] < mid - 15 and b[2] < mid + 35]
    right = [b for b in blocks if b[0] >= mid - 15]
    if len(left) > 1 and len(right) > 1:
        wide = [b for b in blocks if b not in left and b not in right]
        top = min([b[1] for b in left + right])
        headings = [b for b in wide if b[1] <= top + 100]
        tail = [b for b in wide if b not in headings]
        blocks = sorted(headings, key=lambda b: (b[1], b[0])) + sorted(left, key=lambda b: (b[1], b[0])) + sorted(right, key=lambda b: (b[1], b[0])) + sorted(tail, key=lambda b: (b[1], b[0]))
    else:
        blocks.sort(key=lambda b: (b[1], b[0]))
    return '\n\n'.join(clean(b[4]) for b in blocks)

def needs_ocr(text):
    controls = sum(1 for c in text if ord(c) < 32 and c not in '\n\r\t')
    return controls > max(12, len(text) * .015)

def ocr_columns(page, first):
    width, height = page.rect.width, page.rect.height
    start = 120 if first else 48
    clips = [fitz.Rect(0, 0, width, start), fitz.Rect(0, start, width / 2, height), fitz.Rect(width / 2, start, width, height)]
    result = []
    for clip in clips:
        image = page.get_pixmap(matrix=fitz.Matrix(300 / 72, 300 / 72), clip=clip)
        data = image.pdfocr_tobytes(language='eng', tessdata=str(OUT / 'tessdata'))
        with fitz.open('pdf', data) as temporary:
            result.append(clean(temporary[0].get_text()))
    return '\n\n'.join(result)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=pathlib.Path)
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'originals').mkdir(exist_ok=True)
    seen, records, duplicates = {}, [], []
    for source in sorted(args.source.glob('*.pdf')):
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if digest in seen:
            duplicates.append({'file': source.name, 'sameAs': seen[digest]})
            continue
        seen[digest] = source.name
        doc = fitz.open(source)
        if doc.needs_pass:
            raise RuntimeError('Encrypted PDF: ' + source.name)
        pages = []
        for i, page in enumerate(doc):
            text = page_text(page)
            ocr = needs_ocr(text)
            if ocr:
                text = ocr_columns(page, i == 0)
            pages.append({'number': i + 1, 'text': text, 'ocr': ocr})
        if not any(len(p['text']) > 100 for p in pages):
            raise RuntimeError('No extractable text: ' + source.name)
        match = re.match(r'(\d+)-([A-Za-z0-9-]+)-(\d{4})', source.stem)
        ident = match.group(2).lower() if match else ('csf' if source.stem == 'CSF' else 'sparse-iqa')
        record = {'id': ident, 'filename': source.name, 'sha256': digest, 'bytes': source.stat().st_size,
                  'yearFromFilename': int(match.group(3)) if match else None,
                  'method': match.group(2) if match else ('CSF' if ident == 'csf' else '稀疏表征 IQA'),
                  'pdfMetadata': doc.metadata, 'pageCount': len(pages), 'pages': pages}
        records.append(record)
        shutil.copy2(source, OUT / 'originals' / source.name)
        doc.close()
    if len({r['id'] for r in records}) != len(records):
        raise RuntimeError('Duplicate paper ID')
    (OUT / 'extracted.json').write_text(json.dumps({'papers': records, 'duplicates': duplicates}, ensure_ascii=False, indent=2), encoding='utf8')
    (OUT / 'first-pages.txt').write_text('\n\n'.join('=== ' + r['filename'] + ' | ' + str(r['pageCount']) + ' pages ===\n' + r['pages'][0]['text'][:10500] for r in records), encoding='utf8')
    print(json.dumps({'pdfFiles': len(records) + len(duplicates), 'uniquePapers': len(records), 'duplicates': duplicates,
                      'pdfBytes': sum(r['bytes'] for r in records), 'pages': sum(r['pageCount'] for r in records),
                      'textCharacters': sum(len(p['text']) for r in records for p in r['pages'])}, ensure_ascii=True))

if __name__ == '__main__':
    main()
