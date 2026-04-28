# Vibe Archive Data Standard v0.4

> **Schema ID**: `vibe-archive.task.v0.4`  
> **Status**: Candidate (Open Standard Ready)  
> **Goal**: Open, verifiable, extensible standard for AI Coding data

---

# 1. Overview

Vibe Archive v0.4 defines a **task-centric data model** for AI-assisted software development.

It supports:
- Multi-session AI workflows
- Code diffs and execution traces
- Training dataset export (SFT / DPO / Agent)
- Enterprise privacy & compliance

---

# 2. Standard Layers

| Layer | Description |
|------|------------|
| Core | Minimal interoperable schema |
| Extended | Advanced fields (agent, eval, training) |
| Enterprise | Privacy, compliance, governance |

---

# 3. JSON Schema (Core)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://vibe-archive.dev/schema/task/v0.4.json",
  "type": "object",
  "required": ["schema", "id", "created_at", "source", "task", "sessions"],
  "properties": {
    "schema": {
      "const": "vibe-archive.task.v0.4"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-zA-Z0-9_-]+$"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "source": {
      "type": "object",
      "required": ["app", "capture_mode", "ai_tool"],
      "properties": {
        "app": {"type": "string"},
        "capture_mode": {"type": "string"},
        "ai_tool": {"type": "string"}
      }
    },
    "task": {
      "type": "object",
      "required": ["intent"],
      "properties": {
        "intent": {"type": "string"}
      }
    },
    "sessions": {
      "type": "array",
      "minItems": 1
    }
  }
}
```

---

# 4. Validation Rules

## 4.1 Structural Validation
- Must conform to JSON Schema
- Required fields must exist
- Enum values must match spec

## 4.2 Semantic Validation

| Rule | Description |
|------|------------|
| session_order | sessions must be time-ordered |
| final_session | must exist if outcome.completed |
| diff_integrity | patch must match before/after hash |
| tool_call_link | tool_call_id must match |

---

# 5. CLI Validator (Node.js)

```bash
npm install ajv
```

```js
import Ajv from "ajv";
import schema from "./schema.json";

const ajv = new Ajv();
const validate = ajv.compile(schema);

const valid = validate(data);
if (!valid) console.log(validate.errors);
```

---

# 6. TypeScript SDK

```ts
export interface VibeTask {
  schema: "vibe-archive.task.v0.4";
  id: string;
  created_at: string;
  source: {
    app: string;
    capture_mode: string;
    ai_tool: string;
  };
  task: {
    intent: string;
  };
  sessions: Session[];
}

export interface Session {
  session_id: string;
  conversation: Message[];
}

export interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
}
```

---

# 7. Python SDK

```python
from pydantic import BaseModel
from typing import List

class Message(BaseModel):
    role: str
    content: str

class Session(BaseModel):
    session_id: str
    conversation: List[Message]

class Task(BaseModel):
    schema: str
    id: str
    created_at: str
    source: dict
    task: dict
    sessions: List[Session]
```

---

# 8. Export Profiles

- SFT (messages)
- Alpaca (instruction)
- DPO (preference)
- Diff-edit
- Agent trajectory

---

# 9. Versioning Strategy

- v0.x → experimental
- v1.0 → stable spec
- backward compatibility via migration scripts

---

# 10. Conclusion

Vibe Archive v0.4 defines:

> A fully verifiable, extensible, and production-ready AI coding data standard.

