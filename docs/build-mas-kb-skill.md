# Build Instructions: `mas-kb` Skill

## Context for the Builder Agent

You are being asked to build an Agent Skill called `mas-kb` for the OpenClaw AI agent platform. This skill will enable document search across MAS (a knowledge base). The skill will live in a standalone GitHub repository (`https://github.com/alhoqbani/agent-skills`) and be installed on target machines either globally or per-workspace.

Read this entire document before starting. It contains everything you need: the goal, the spec constraints, OpenClaw-specific configuration, the deployment workflow, and recommendations for structuring the skill contents.

---

## 1. Goal

Build a self-contained Agent Skill that lets the OpenClaw agent search MAS knowledge base documents on behalf of the user. The skill should:

- Accept natural language search queries from the agent
- Execute a Python script that queries the MAS document search backend
- Return structured results (titles, snippets, relevance scores, document links)
- Handle pagination, filtering, and error cases gracefully

The actual search implementation (which API to call, what library to use, how to authenticate) is up to you. Design whatever makes sense for querying a document knowledge base. The user will iterate on the implementation after the initial version.

---

## 2. Agent Skills Specification

This skill **must** adhere to the [Agent Skills spec](https://agentskills.io/specification). Key requirements:

### 2.1 Directory Structure

```
mas-kb/
├── SKILL.md              # Required. YAML frontmatter + markdown instructions.
├── scripts/
│   └── search.py         # Main search script (Python)
├── references/
│   ├── api-schema.md     # Search API request/response schema documentation
│   └── filters.md        # Available filter types, field names, valid values
└── assets/
    └── example-output.json  # Example of what a successful search result looks like
```

### 2.2 SKILL.md Frontmatter

The frontmatter has two required fields:

```yaml
---
name: mas-kb
description: |
  Search MAS knowledge base documents by keyword, semantic query, or metadata filters.
  Use when the user asks about MAS documents, policies, guidelines, references,
  or needs to find specific information in the knowledge base.
---
```

Rules:
- `name` must be lowercase, letters/digits/hyphens only, max 64 chars, must match the directory name
- `description` is the **only** thing the agent reads to decide when to activate the skill. It must be comprehensive about what the skill does AND when to trigger it. Do NOT put "when to use" guidance in the body -- the body only loads after triggering
- Do not add fields beyond `name` and `description` in frontmatter unless OpenClaw-specific metadata is needed (see section 4 below)

### 2.3 SKILL.md Body

The markdown body contains instructions the agent reads after deciding to use the skill. Rules:

- Keep under 500 lines. Move detailed docs to `references/`
- Use imperative form ("Search documents with...", not "This skill searches...")
- Reference scripts using `{baseDir}` placeholder: `uv run {baseDir}/scripts/search.py`
- Reference files in `references/` and `assets/` with relative paths from skill root
- Do not create README.md, CHANGELOG.md, INSTALLATION_GUIDE.md, or any auxiliary docs

### 2.4 Progressive Disclosure

The spec uses three-level loading to manage context efficiently:

1. **Metadata** (~100 tokens): `name` + `description` -- always in context for all skills
2. **Instructions** (<5000 tokens): SKILL.md body -- loaded when skill triggers
3. **Resources** (as needed): `scripts/`, `references/`, `assets/` -- loaded only when required

This means: keep SKILL.md lean. Put detailed API schemas in `references/api-schema.md`, not inline.

---

## 3. Skill Contents: What to Put Where

### 3.1 `scripts/` -- Executable Code

This is where the Python search script lives. The agent executes it via the `exec` tool.

**`scripts/search.py`** -- The main search entry point.

Design considerations:
- Accept arguments via CLI flags (e.g., `--query`, `--limit`, `--filter-type`, `--page`)
- Print results as JSON to stdout so the agent can parse them
- Print errors to stderr with helpful messages
- Be self-contained or clearly document dependencies (e.g., `requests` library)
- Include a `--help` flag
- Handle edge cases: empty results, network errors, auth failures, rate limits
- Exit with non-zero codes on failure

Example invocation pattern for the SKILL.md to document:

```bash
uv run {baseDir}/scripts/search.py --query "safety guidelines" --limit 10
uv run {baseDir}/scripts/search.py --query "compliance requirements" --filter-type policy --limit 5
uv run {baseDir}/scripts/search.py --query "training materials" --page 2
```

You may split into multiple scripts if needed (e.g., `search.py`, `auth.py`, `utils.py`), but prefer a single script if possible to keep things simple.

### 3.2 `references/` -- Documentation for the Agent

These files are read into context **only when the agent determines it needs them**. Use them to keep SKILL.md lean while making detailed info discoverable.

Recommended files:

**`references/api-schema.md`** -- Document the search API request/response schema:
- Endpoint URL(s) and HTTP methods
- Request parameters with types and descriptions
- Response JSON structure with field definitions
- Authentication method (API key, token, etc.)
- Rate limits and pagination details
- Include a table of contents if longer than 100 lines

**`references/filters.md`** -- Document available search filters:
- Filter field names and what they mean
- Valid values for each filter
- How to combine multiple filters
- Examples of common filter combinations

Reference these from SKILL.md like:

```markdown
For the full API request/response schema, see [api-schema.md](references/api-schema.md).
For available filter types and values, see [filters.md](references/filters.md).
```

### 3.3 `assets/` -- Static Resources

Assets are files used in output, NOT loaded into context. They help the agent understand expected formats without verbose inline documentation.

Recommended:

**`assets/example-output.json`** -- A concrete example of search results JSON:

```json
{
  "query": "safety guidelines",
  "total_results": 42,
  "page": 1,
  "per_page": 10,
  "results": [
    {
      "id": "DOC-1234",
      "title": "Safety Guidelines v3.2",
      "snippet": "...relevant excerpt...",
      "score": 0.95,
      "url": "https://...",
      "metadata": {
        "type": "policy",
        "last_updated": "2025-11-01",
        "department": "operations"
      }
    }
  ]
}
```

This gives the agent (and future developers) a concrete reference for the output format without bloating SKILL.md.

---

## 4. OpenClaw-Specific Configuration

OpenClaw extends the Agent Skills spec with its own metadata under `metadata.openclaw` in the frontmatter. This controls gating (whether the skill loads), environment injection, and UI presentation.

### 4.1 When You Need OpenClaw Metadata

Add `metadata.openclaw` if the skill:
- Requires specific binaries on PATH (e.g., `python3`)
- Requires environment variables (e.g., an API key)
- Should only run on certain OSes
- Needs installation instructions for the OpenClaw macOS UI

### 4.2 Metadata Format

The metadata field must be a **single-line JSON object** in the YAML frontmatter. Example for `mas-kb`:

```yaml
---
name: mas-kb
description: |
  Search MAS knowledge base documents by keyword, semantic query, or metadata filters.
  Use when the user asks about MAS documents, policies, guidelines, references,
  or needs to find specific information in the knowledge base.
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["uv"] },
        "install":
          [
            {
              "id": "uv-brew",
              "kind": "brew",
              "formula": "uv",
              "bins": ["uv"],
              "label": "Install uv (brew)",
            },
          ],
      },
  }
---
```

### 4.3 Gating Fields Reference

Fields under `metadata.openclaw`:

| Field | Purpose |
|---|---|
| `emoji` | Visual indicator in the macOS Skills UI |
| `requires.bins` | List of binaries that must exist on PATH. Checked at load time. |
| `requires.env` | List of env vars that must be set (or provided via config). |
| `requires.config` | List of `openclaw.json` config paths that must be truthy. |
| `primaryEnv` | The main env var name. Maps to `skills.entries.<name>.apiKey` in config. |
| `os` | Restrict to platforms: `["darwin"]`, `["linux"]`, `["darwin", "linux"]` |
| `install` | Array of installer specs for the macOS UI (brew/node/go/uv/download) |
| `always: true` | Always include the skill, skip other gates |

If the skill needs NO special binaries, NO API keys, and runs everywhere -- you can omit `metadata.openclaw` entirely and the skill will always be eligible.

### 4.4 Config Overrides (`~/.openclaw/openclaw.json`)

On each machine, the user configures skills in `~/.openclaw/openclaw.json`:

```json5
{
  skills: {
    entries: {
      "mas-kb": {
        enabled: true,
        env: {
          MAS_ES_HOST: "http://localhost:9200",
          MAS_PG_HOST: "localhost",
          MAS_PG_PORT: "5432",
          MAS_OLLAMA_HOST: "http://localhost:11434"
        }
      }
    }
  }
}
```

**How env injection works** (important for understanding the multi-machine setup):

1. When an agent run starts, OpenClaw reads `skills.entries.<name>.env` from config
2. For each key-value pair, it checks: is `process.env[key]` already set?
3. **Only if the var is NOT already set**, it injects the config value into `process.env`
4. Child processes (Python scripts via Bash tool) inherit `process.env` automatically
5. When the agent run ends, OpenClaw restores the original environment

This means:
- Config env vars **do NOT override** existing system environment variables
- If you `export MAS_ES_HOST=...` in your shell profile, that takes precedence over config
- The `apiKey` shortcut sets whichever env var `primaryEnv` points to (same precedence rules)
- `config` is an optional bag for custom fields; NOT injected as env vars
- `enabled: false` disables the skill entirely

### 4.5 Multi-Machine Setup (mac-mini + MacBook Pro)

The skill connects to three services: Elasticsearch, PostgreSQL, and Ollama. These run on the mac-mini. Two machines need to reach them:

| Machine | Role | How it reaches services |
|---|---|---|
| **mac-mini** | Production host | `localhost` (services run here) |
| **MacBook Pro** | Development | Tailscale tailnet URLs |

#### Environment Variables

The Python script must read all connection details from environment variables with **sensible defaults for mac-mini** (localhost). This way mac-mini needs zero config and MacBook Pro just overrides the URLs.

Define these env vars in the script:

```python
# Connection defaults (suitable for mac-mini where services run locally)
ES_HOST     = os.environ.get("MAS_ES_HOST",     "http://localhost:9200")
PG_HOST     = os.environ.get("MAS_PG_HOST",     "localhost")
PG_PORT     = int(os.environ.get("MAS_PG_PORT", "5432"))
PG_DB       = os.environ.get("MAS_PG_DB",       "mas")
PG_USER     = os.environ.get("MAS_PG_USER",     "mas")
PG_PASSWORD = os.environ.get("MAS_PG_PASSWORD",  "")
OLLAMA_HOST = os.environ.get("MAS_OLLAMA_HOST", "http://localhost:11434")
```

All vars are prefixed with `MAS_` to avoid collisions with other skills or system vars.

#### mac-mini Config (`~/.openclaw/openclaw.json`)

No env overrides needed -- the script defaults to localhost:

```json5
{
  skills: {
    entries: {
      "mas-kb": {
        enabled: true
        // No env block needed: script defaults to localhost
      }
    }
  }
}
```

#### MacBook Pro Config (`~/.openclaw/openclaw.json`)

Override the hosts to use Tailscale tailnet addresses:

```json5
{
  skills: {
    entries: {
      "mas-kb": {
        enabled: true,
        env: {
          MAS_ES_HOST: "https://mac-mini.spotted-temperature.ts.net:9200",
          MAS_PG_HOST: "mac-mini.spotted-temperature.ts.net",
          MAS_PG_PORT: "5432",
          MAS_OLLAMA_HOST: "http://mac-mini.spotted-temperature.ts.net:11434"
        }
      }
    }
  }
}
```

#### SKILL.md Must Document All Env Vars

In the SKILL.md body, include a clear table of all environment variables:

```markdown
## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MAS_ES_HOST` | `http://localhost:9200` | Elasticsearch endpoint |
| `MAS_PG_HOST` | `localhost` | PostgreSQL hostname |
| `MAS_PG_PORT` | `5432` | PostgreSQL port |
| `MAS_PG_DB` | `mas` | PostgreSQL database name |
| `MAS_PG_USER` | `mas` | PostgreSQL username |
| `MAS_PG_PASSWORD` | *(empty)* | PostgreSQL password |
| `MAS_OLLAMA_HOST` | `http://localhost:11434` | Ollama API endpoint |

Defaults are suitable for the mac-mini where services run locally.
Override via `skills.entries.mas-kb.env` in `~/.openclaw/openclaw.json` for remote access (e.g., via Tailscale).
```

#### SKILL.md Metadata: Do NOT Require These Env Vars

Since the script has sensible defaults, do NOT list the connection vars in `metadata.openclaw.requires.env`. If you did, the skill would refuse to load on mac-mini where they're intentionally unset. Only require vars that have no valid default:

```yaml
metadata:
  {"openclaw": {"requires": {"bins": ["uv"]}}}
```

The `requires.env` gate means "skill won't load without this var". Connection vars with defaults should NOT be gated -- they're optional overrides.

---

## 5. Deployment Workflow

This is how the skill gets from the GitHub repo to a running OpenClaw instance.

### 5.1 Repository Structure

The repo `https://github.com/alhoqbani/agent-skills` will contain one or more skills:

```
agent-skills/               # Git repository root
├── mas-kb/                 # This skill
│   ├── SKILL.md
│   ├── scripts/
│   │   └── search.py
│   ├── references/
│   │   ├── api-schema.md
│   │   └── filters.md
│   └── assets/
│       └── example-output.json
└── other-skill/            # Future skills can live here too
    └── SKILL.md
```

Each top-level directory is an independent skill. The directory name must match the `name` field in SKILL.md frontmatter.

### 5.2 Installation: Per-Machine (Nebras Only)

To install on a specific machine (the "Nebras" machine):

**Option A: Clone into managed skills directory**

```bash
# On the Nebras machine:
cd ~/.openclaw/skills
git clone https://github.com/alhoqbani/agent-skills.git _agent-skills-repo

# Symlink the skill so OpenClaw discovers it:
ln -s ~/.openclaw/skills/_agent-skills-repo/mas-kb ~/.openclaw/skills/mas-kb
```

OpenClaw discovers skills as top-level directories under `~/.openclaw/skills/`. The symlink makes `mas-kb` appear as a direct child.

**Option B: Use `skills.load.extraDirs` config**

In `~/.openclaw/openclaw.json` on the Nebras machine:

```json5
{
  skills: {
    load: {
      extraDirs: ["/path/to/cloned/agent-skills"]
    }
  }
}
```

This tells OpenClaw to scan the cloned repo directory for skills. Each subdirectory with a `SKILL.md` becomes a skill. This is the cleanest approach for a multi-skill repo.

**Option C: Clone into workspace skills**

```bash
# For a specific workspace only:
cp -r /path/to/agent-skills/mas-kb <workspace>/skills/mas-kb
```

This gives highest precedence (workspace > managed > bundled).

### 5.3 Installation: Global (All Machines)

For all machines, use Option A or B above on each machine, or automate with a setup script.

### 5.4 Post-Installation Config

After installing the skill files, configure the API credentials on the target machine:

```bash
# Edit ~/.openclaw/openclaw.json and add the skills.entries.mas-kb block
# (see section 4.4 above for the full example)
```

### 5.5 Verification

After installation:
1. Start a new OpenClaw session (skills snapshot is built at session start)
2. Ask the agent something like "search MAS documents for safety guidelines"
3. The agent should activate the `mas-kb` skill, read the SKILL.md body, and run the search script

### 5.6 Updating

To update the skill after changes:

```bash
cd ~/.openclaw/skills/_agent-skills-repo  # or wherever you cloned
git pull
```

If `skills.load.watch` is enabled in config, OpenClaw hot-reloads on the next agent turn. Otherwise, restart the session.

---

## 6. SKILL.md Writing Guidelines

Follow these when writing the body of SKILL.md:

1. **Imperative form**: "Search documents with..." not "This skill searches..."
2. **Concise**: The context window is shared. Challenge each line: "Does the agent really need this?"
3. **Concrete examples over verbose explanations**: Show a command, not a paragraph
4. **`{baseDir}` for all paths**: Never hardcode absolute paths to skill files
5. **Link to references, don't duplicate**: Put API schemas in `references/`, link from SKILL.md
6. **No "When to Use" section in body**: That belongs in the `description` frontmatter field
7. **Document script flags clearly**: The agent needs to know what arguments to pass
8. **Include example outputs**: Show what successful and failed responses look like (brief inline examples are fine; detailed schemas go in references)

### Example SKILL.md Body Structure

```markdown
# MAS Knowledge Base Search

Search MAS documents using keyword or semantic queries.

## Quick Start

```bash
uv run {baseDir}/scripts/search.py --query "your search terms" --limit 10
```

## Parameters

| Flag | Required | Default | Description |
|---|---|---|---|
| `--query` | Yes | -- | Search query (natural language or keywords) |
| `--limit` | No | 10 | Max results to return (1-50) |
| `--page` | No | 1 | Page number for pagination |
| `--filter-type` | No | -- | Filter by document type |
| `--output` | No | json | Output format: json, text |

## Examples

[Show 3-4 common usage patterns with expected output summaries]

## Error Handling

[Brief note on what error codes mean and how to retry]

## References

- Full API schema: [references/api-schema.md](references/api-schema.md)
- Available filters and values: [references/filters.md](references/filters.md)
- Example output: [assets/example-output.json](assets/example-output.json)
```

---

## 7. Python Environment & Dependencies

### The Three Patterns in OpenClaw

OpenClaw skills use one of three patterns for Python. Choose based on whether external packages are needed:

**Pattern A: Standard Library Only** -- Used by most skills (`openai-image-gen`, `skill-creator`, `model-usage`). No dependency management needed.

```bash
uv run {baseDir}/scripts/search.py --query "..."
```

**Pattern B: PEP 723 Inline Metadata + `uv run`** -- Used by `nano-banana-pro`. Dependencies declared inline in the script file itself. `uv` reads the PEP 723 block and auto-installs into an isolated environment. No `requirements.txt`, no manual venv setup.

```python
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "elasticsearch>=8.0.0",
#     "psycopg2-binary>=2.9.0",
# ]
# ///
```

```bash
uv run {baseDir}/scripts/search.py --query "..."
```

**Pattern C: Full `pyproject.toml` Project** -- Used by `local-places` (a FastAPI server). Only for complex multi-file applications with test suites.

### Use Pattern B for `mas-kb`

The `mas-kb` skill needs external packages (`elasticsearch`, `psycopg2`, `requests`, etc.) but is a single search script, not a full application. **Use Pattern B (PEP 723 + `uv run`).**

Key requirements when using Pattern B:

1. **Declare `uv` in metadata**: Add `"bins": ["uv"]` to `metadata.openclaw.requires` in the SKILL.md frontmatter so OpenClaw gates the skill on `uv` being available
2. **All script invocations use `uv run`**: In SKILL.md body, always show `uv run {baseDir}/scripts/search.py`, never `uv run {baseDir}/scripts/search.py`
3. **PEP 723 block at top of script**: Right after the shebang line, before any imports
4. **No `requirements.txt` or `pyproject.toml`**: Dependencies live in the script itself
5. **Pin minimum versions**: Use `>=` not `==` for flexibility

Example of the complete script header:

```python
#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "elasticsearch>=8.0.0",
# ]
# ///
"""Search MAS knowledge base documents."""

import argparse
import json
import os
import sys

from elasticsearch import Elasticsearch
```

### Updated Metadata for `mas-kb`

Because the script uses `uv run`, declare `uv` as a required binary:

```yaml
metadata:
  {"openclaw": {"requires": {"bins": ["uv"]}, "install": [{"id": "uv-brew", "kind": "brew", "formula": "uv", "bins": ["uv"], "label": "Install uv (brew)"}]}}
```

### Do NOT Use

- **System python with pip install** -- Skills must not modify the system Python environment
- **`requirements.txt`** -- No skill in OpenClaw uses this pattern
- **Manual venv creation** -- `uv run` with PEP 723 handles isolation automatically
- **Poetry/pipenv/conda** -- Not used in any OpenClaw skill

---

## 8. Python Script Guidelines

For `scripts/search.py`:

1. **PEP 723 dependency block** at the top declaring all external packages
2. **Execute via `uv run`**, never direct `python3`
3. **Read config from environment variables**: `MAS_API_KEY`, `MAS_API_ENDPOINT`, etc.
4. **Output JSON to stdout**: The agent parses this to understand results
5. **Output errors to stderr**: Keep stdout clean for parsing
6. **Use `argparse`** for CLI argument handling with `--help` support
7. **Exit codes**: 0 for success, 1 for user error, 2 for server/network error
8. **Test the script** by running it before finalizing -- scripts must work
9. **Include a shebang line**: `#!/usr/bin/env python3`
10. **Make it executable**: `chmod +x scripts/search.py`

---

## 8. Checklist Before Finalizing

- [ ] `SKILL.md` frontmatter has `name: mas-kb` and comprehensive `description`
- [ ] Directory name `mas-kb/` matches the `name` field
- [ ] `SKILL.md` body is under 500 lines
- [ ] All script references use `{baseDir}/scripts/...`
- [ ] `scripts/search.py` runs successfully with `--help` and a test query
- [ ] `references/` files have a table of contents if over 100 lines
- [ ] No extraneous files (no README.md, no CHANGELOG.md, no tests directory)
- [ ] No deeply nested references (all reference files linked directly from SKILL.md)
- [ ] OpenClaw metadata declares required bins and env vars (if any)
- [ ] Example output in `assets/` matches what the script actually produces
