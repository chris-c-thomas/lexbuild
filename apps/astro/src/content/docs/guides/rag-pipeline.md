---
title: "RAG Pipeline Integration"
description: "Build a retrieval-augmented generation pipeline with LexBuild output, including chunking strategies, embedding workflows, and vector database integration."
order: 1
---

# RAG Pipeline Integration

LexBuild output is structured specifically for AI and RAG ingestion. Every file is a standalone Markdown document with YAML frontmatter containing structured metadata, making it straightforward to load into embedding pipelines and vector databases.

## Why LexBuild Output Works for RAG

Three properties make LexBuild output well-suited for retrieval-augmented generation:

1. **Pre-chunked by legal structure.** Each section is a self-contained document with a clear topic boundary. You do not need to split arbitrary pages or paragraphs.
2. **Rich metadata in frontmatter.** Fields like `identifier`, `source`, `title_number`, and `section_number` enable precise filtering at query time.
3. **Consistent format across sources.** USC, eCFR, and FR all produce the same frontmatter schema, so one ingestion pipeline handles all three.

## Chunking Strategy

At section granularity (the default), each file represents one legal section. Most sections fall in the 1,000 to 5,000 token range, which fits comfortably within typical embedding model context windows (512 to 8,192 tokens).

The `token_estimate` field in frontmatter gives an approximate token count for each file, calculated using a character/4 heuristic. Use this to decide whether a section needs further splitting:

```yaml
---
identifier: "/us/usc/t17/s107"
token_estimate: 1842
---
```

For sections that exceed your embedding model's context window, split on Markdown heading boundaries (H2, H3) within the file. Each heading corresponds to a subsection or paragraph in the legal hierarchy.

### Granularity Tradeoffs

You can convert the same source at different granularity levels to support different use cases:

| Granularity | Typical Chunk Size | Best For |
|---|---|---|
| `section` (default) | 1-5k tokens | Precise retrieval, question answering |
| `chapter` / `part` | 10-100k tokens | Topic-level context, summarization with large context models |
| `title` | 100k-2M tokens | Whole-title analysis, full corpus summarization |

Generate multiple granularities to different output directories:

```bash
lexbuild convert-usc --all -g section -o ./output/section
lexbuild convert-usc --all -g chapter -o ./output/chapter
lexbuild convert-usc --all -g title -o ./output/title
```

## Parsing Frontmatter

Use [gray-matter](https://github.com/jonschlinkert/gray-matter) (JavaScript) or any YAML frontmatter parser to separate metadata from body text.

### JavaScript / TypeScript

```js
import matter from "gray-matter";
import { readFileSync } from "fs";

const raw = readFileSync("output/usc/sections/title-17/chapter-01/section-107.md", "utf-8");
const { data, content } = matter(raw);

console.log(data.identifier);    // "/us/usc/t17/s107"
console.log(data.source);        // "usc"
console.log(data.title_number);  // 17
console.log(data.section_number); // "107"
console.log(content.slice(0, 100)); // Markdown body text
```

### Python

```python
import frontmatter

with open("output/usc/sections/title-17/chapter-01/section-107.md") as f:
    post = frontmatter.load(f)

metadata = post.metadata  # dict with identifier, source, title_number, etc.
body = post.content        # Markdown body text
```

> [!NOTE]
> When processing files in a loop, pass `{ cache: false }` to gray-matter in JavaScript to prevent unbounded memory growth.

## Embedding Workflow

A typical pipeline follows four steps: load files, parse frontmatter, generate embeddings, and upsert into a vector database.

### Step 1: Load and Parse

Walk the output directory and parse each `.md` file. Skip sidecar files (`_meta.json`, `README.md`):

```python
import os
import frontmatter

def load_documents(root_dir):
    docs = []
    for dirpath, _, filenames in os.walk(root_dir):
        for fname in filenames:
            if not fname.endswith(".md") or fname in ("README.md",):
                continue
            path = os.path.join(dirpath, fname)
            post = frontmatter.load(path)
            docs.append({
                "id": post.metadata["identifier"],
                "source": post.metadata["source"],
                "title_number": post.metadata.get("title_number"),
                "section_number": post.metadata.get("section_number"),
                "text": post.content,
                "metadata": post.metadata,
            })
    return docs
```

### Step 2: Generate Embeddings

Use any embedding provider. The body text is plain Markdown, which most models handle well:

```python
from openai import OpenAI

client = OpenAI()

def embed_documents(docs):
    texts = [doc["text"] for doc in docs]
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    for doc, embedding in zip(docs, response.data):
        doc["embedding"] = embedding.embedding
    return docs
```

### Step 3: Upsert into a Vector Database

Store embeddings with metadata fields for filtering at query time. Here are examples for three popular vector databases.

**Pinecone:**

```python
from pinecone import Pinecone

pc = Pinecone(api_key="YOUR_KEY")
index = pc.Index("legal-docs")

vectors = [
    {
        "id": doc["id"],
        "values": doc["embedding"],
        "metadata": {
            "source": doc["source"],
            "title_number": doc["title_number"],
            "section_number": doc["section_number"],
        },
    }
    for doc in docs
]

index.upsert(vectors=vectors, batch_size=100)
```

**ChromaDB:**

```python
import chromadb

client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection("legal-docs")

collection.add(
    ids=[doc["id"] for doc in docs],
    embeddings=[doc["embedding"] for doc in docs],
    documents=[doc["text"] for doc in docs],
    metadatas=[{
        "source": doc["source"],
        "title_number": doc["title_number"] or 0,
        "section_number": doc["section_number"] or "",
    } for doc in docs],
)
```

**pgvector (SQL):**

```sql
CREATE TABLE legal_docs (
    identifier TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title_number INTEGER,
    section_number TEXT,
    body TEXT NOT NULL,
    embedding vector(1536)
);

CREATE INDEX ON legal_docs USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON legal_docs (source, title_number);
```

## Querying with Metadata Filters

The frontmatter fields become powerful filters at query time. Instead of searching the entire corpus, narrow results to a specific source or title:

```python
# Search only within CFR Title 17 (Securities regulations)
results = index.query(
    vector=query_embedding,
    top_k=10,
    filter={
        "source": {"$eq": "ecfr"},
        "title_number": {"$eq": 17},
    },
)
```

Useful filter combinations:

| Use Case | Filter |
|---|---|
| All federal statutes | `source = "usc"` |
| Securities regulations | `source = "ecfr"`, `title_number = 17` |
| Environmental law + regulations | `source in ("usc", "ecfr")`, `title_number = 42` (USC) or `40` (CFR) |
| Recent regulatory actions | `source = "fr"`, `publication_date >= "2026-01-01"` |

## Using the API Instead of Local Files

If you prefer not to manage local files, you can fetch content programmatically from the LexBuild API:

```bash
# List USC sections in Title 17
curl "https://lexbuild.dev/api/usc/documents?title_number=17&limit=100"

# Get a single section as raw Markdown
curl -H "Accept: text/markdown" \
  "https://lexbuild.dev/api/usc/documents/t17/s107"
```

The API returns the same content and metadata as the local files. Use the `format=markdown` query parameter or `Accept: text/markdown` header to get the raw Markdown with frontmatter.

See [API Overview](/docs/api/overview) and [Document Endpoints](/docs/api/endpoints/documents) for authentication and pagination details.

## Preserving Cross-References

LexBuild output includes cross-reference links between legal documents. To preserve these in your RAG pipeline, convert with `--link-style relative`:

```bash
lexbuild convert-usc --all --link-style relative
```

Relative links let you resolve references between chunks in your vector database. For example, a USC section referencing "section 107 of title 17" will contain a link to `../../title-17/chapter-01/section-107.md`, which maps to the identifier `/us/usc/t17/s107`.

When a cross-reference points outside the converted corpus (e.g., a USC section referencing a CFR regulation), the link falls back to an external URL on the official government website.

## Next Steps

- [Output Format](/docs/cli/output-format) -- Full frontmatter schema and file structure reference
- [Bulk Download](/docs/guides/bulk-download) -- Download and convert the full corpus
- [Document Endpoints](/docs/api/endpoints/documents) -- API access for programmatic ingestion
