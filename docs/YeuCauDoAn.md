# PROJECT SPECIFICATION & REQUIREMENTS: AGENTIC AI SYSTEM

> **Design Philosophy:** `Agent = Model + Harness`  
> **Core Objective:** _"Transform the capabilities of a non-deterministic LLM into a controllable, verifiable, observable, and safely operable Agentic AI system."_

---

## TABLE OF CONTENTS

1. [Core Project Objective](#1-core-project-objective)
2. [Program Learning Outcomes (PLOs / CLOs)](#2-program-learning-outcomes)
3. [12-Session Syllabus & Project Alignment](#3-12-session-syllabus--project-alignment)
4. [Detailed Technical Requirements (PR-01 → PR-13)](#4-detailed-technical-requirements)
5. [Minimum Project Checklist (Definition of Done)](#5-minimum-project-checklist)
6. [Defense & Oral Examination Questions](#6-defense--oral-examination-questions)
7. [Evidence Required Across Three Evaluation Stages](#7-evidence-required-across-three-evaluation-stages)
8. [Standard Project Objective Statement Template](#8-standard-project-objective-statement-template)

---

## 1. Core Project Objective

> _“Transform the capabilities of a non-deterministic LLM into a controllable, verifiable, observable, and safely operable Agentic AI system.”_

The capstone project must solve a **concrete, real-world problem**, enabling the model to make **at least one meaningful decision at runtime**, while utilizing a **harness** to:

- Enforce the principle of least privilege.
- Manage execution state and context windows.
- Independently verify output results (beyond model self-attestation).
- Record comprehensive execution traces (Observability).
- Handle and recover gracefully from failures.

### 🔍 Three Questions to Identify an Agentic System

| Qualifying Question            | Traditional Deterministic Workflow                      | Agentic System                                                                    |
| :----------------------------- | :------------------------------------------------------ | :-------------------------------------------------------------------------------- |
| **Who decides the next step?** | Hardcoded logic (pre-defined if/else, static pipelines) | **The model decides at runtime** within predefined, bounded parameters            |
| **Who maintains state?**       | Application variables / Database / State graph          | **The system maintains explicit state**; never relies solely on raw chat history  |
| **Who decides to terminate?**  | Completion of coded pipeline steps                      | **The agent identifies completion**, constrained by **strict system hard limits** |

---

## 2. Program Learning Outcomes

### 2.1 General Learning Outcomes (PLOs)

|  Code  | Significance to the Project                                                                                 |
| :----: | :---------------------------------------------------------------------------------------------------------- |
| **G1** | Foundations of LLMs, AI agents, and the architectural components of Agentic AI systems.                     |
| **G2** | Requirements analysis and architectural design grounded in the `Agent = Model + Harness` paradigm.          |
| **G3** | Construction and integration of agents with tools, data sources, memory systems, and knowledge retrieval.   |
| **G4** | Workflow design: explicit state, orchestration, multi-agent collaboration, and/or MCP protocol.             |
| **G5** | Testing, evaluation (evals), observability, and iterative optimization of reliability and operational cost. |
| **G6** | Responsible, safe, secure, and accountable design and governance of Agentic AI.                             |

### 2.2 Detailed Course Learning Outcomes (CLOs)

| CLO Code | Competency to be Proven                                                                                                          |
| :------: | :------------------------------------------------------------------------------------------------------------------------------- |
| **G1.1** | Explain LLMs, AI agents, agent loop, context window mechanics, structured output, function calling, and tool usage.              |
| **G1.2** | Analyze Agentic AI architectures under the `Model + Harness` paradigm and articulate the roles of the 12 harness layers.         |
| **G2.1** | Design the agent loop, tool execution mechanisms, state control policies, termination conditions, and error recovery.            |
| **G2.2** | Architect domain-appropriate retrieval, memory, context management, and workflow strategies.                                     |
| **G2.3** | Design agent skills with structured descriptions, instructions, input/output contracts, procedural steps, and validation checks. |
| **G3.1** | Build agents using LLM APIs, structured outputs, and function calling for multi-step workflows.                                  |
| **G3.2** | Integrate APIs, databases, file systems, CLI tools, or external services with rigorous input validation and error handling.      |
| **G3.3** | Build end-to-end RAG pipelines: ingestion, chunking, embedding, vector store management, retrieval, grounding, and citation.     |
| **G4.1** | Implement workflows with explicit state, routing, checkpointing, recovery, and Human-in-the-Loop (HITL) gates when required.     |
| **G4.2** | Build multi-agent workflows or integrate external tools/resources via Model Context Protocol (MCP) at a prototype level.         |
| **G5.1** | Develop test suites, eval datasets, and quantitative metrics; capture execution logs/traces; drive data-backed improvements.     |
| **G6.1** | Analyze and mitigate risks: prompt/tool injection, data leakage, privilege escalation, and unsafe tool execution.                |
| **G6.2** | Ensure compliance with responsible AI principles, data privacy, secret management, access control, and attribution transparency. |

---

## 3. 12-Session Syllabus & Project Alignment

| Session | Core Focus                          | Required Project Evidence                                                                                    |
| :-----: | :---------------------------------- | :----------------------------------------------------------------------------------------------------------- |
|  **1**  | Overview of LLMs & Agentic AI       | Proper system classification; `Model + Harness` paradigm; 12 harness layers.                                 |
|  **2**  | LLM Foundations for Agents          | Tokenization/context limits; prompt/context engineering; structured output; function calling; validation.    |
|  **3**  | Agent Fundamentals                  | Goal, observation, reasoning/action cycle (ReAct), planning, termination, and failure modes.                 |
|  **4**  | Harness Engineering                 | Intentional harness design; moving beyond simple, unconstrained model calls.                                 |
|  **5**  | Tool Use & Agent Skills             | Tool schemas, permission scoping, skill design, retry/timeout/error handling, human approval gates.          |
|  **6**  | RAG / Knowledge Harness             | Ingestion, embeddings, vector DB, chunking strategies, metadata, retrieval, reranking, grounding, citations. |
|  **7**  | Memory, State, Context              | Short/long-term memory; session/task state; compaction/summarization; data privacy & retention.              |
|  **8**  | Workflow Orchestration              | State graph, nodes, edges, conditional routing; checkpointing; error recovery; HITL; long-running tasks.     |
|  **9**  | Verification & Evaluation           | Hallucination mitigation; validation; definition of done; unit/integration/E2E testing; trajectory evals.    |
| **10**  | Multi-Agent & MCP                   | Supervisor-worker, planner-executor, critic-reviewer; handoff protocols; MCP interoperability.               |
| **11**  | Security, Governance, Observability | Prompt/tool injection, least privilege, sandboxing, audit logs, distributed tracing, latency & token costs.  |
| **12**  | Capstone Review & Defense           | Final prototype delivery, technical documentation, live demo, and oral examination.                          |

---

## 4. Detailed Technical Requirements

> **Priority Conventions:**
>
> - `[MUST]`: Mandatory core requirements. Essential for meeting base project criteria.
> - `[SHOULD]`: Highly recommended to fully cover advanced learning outcomes.
> - `[CONDITIONAL]`: Required if the domain problem or chosen architecture demands it.

---

### PR-01 — Problem & Agentic Justification

`MUST` | **Target CLOs:** G1.2, G2.1

- **Purpose:** Prove that the problem requires an agentic architecture rather than a static, deterministic script wrapping an LLM.
- **Requirements:**
  - Clearly define: User/Actor, Input, Output, Goal, Definition of Done, and Failure conditions.
  - Specify the exact runtime decisions delegated to the model.
  - Delineate the boundary between deterministic workflow logic and non-deterministic agentic decisions.
- **Acceptance Criteria:**
  - Provide a workflow diagram showing at least one dynamic execution branch that cannot be predetermined at compile time.
  - Successfully answer the 3 core questions: _Who decides the next step? Who maintains state? Who terminates execution?_
- **Repository Evidence:** `docs/problem.md`, `docs/architecture.md`, system flow diagrams.

---

### PR-02 — Structured LLM Interface

`MUST` | **Target CLOs:** G1.1, G3.1

- **Purpose:** Transform free-form LLM outputs into strictly typed interfaces that the host application can validate programmatically.
- **Requirements:**
  - Decouple instructions, contextual inputs, and output constraints using standardized prompt templates.
  - Enforce JSON Schema / Pydantic models (or equivalent native Structured Output guarantees) across all critical interfaces.
  - Implement runtime schema validation for missing fields, type mismatches, and enum bounds; handle `insufficient_data` or `out_of_scope` signals.
- **Acceptance Criteria:**
  - No reliance on brittle string parsing or raw regex to extract business-critical actions or statuses.
  - Automated unit tests confirming that schema violations are trapped and handled cleanly without system crashes.
  - Differentiate between syntactic schema conformance and semantic content validity.
- **Repository Evidence:** `src/schemas/`, `src/llm/`, `tests/schema/`.

---

### PR-03 — Context Engineering

`MUST` | **Target CLOs:** G1.1, G2.2

- **Purpose:** Regulate information feeding into the context window to minimize distraction, latency, hallucination, and inference costs.
- **Requirements:**
  - Explicitly identify the origin of context elements: system prompt, current state, interaction history, retrieval chunks, tool outputs, and user prompts.
  - Implement intentional context management strategies: selection, truncation, summarization, compaction, or retrieval-based filtering.
  - Track token consumption across individual execution steps.
- **Acceptance Criteria:**
  - Demonstrate a test case showing how the system resolves excessively long or noisy context scenarios.
  - No unfiltered dumping of raw data into prompt payloads without documented justification.
- **Repository Evidence:** `src/context/`, `docs/context-strategy.md`, token usage traces.

---

### PR-04 — Tool Integration & Agent Skills

`MUST` | **Target CLOs:** G2.3, G3.2, G6.1

- **Purpose:** Empower the agent to interact with real-world systems via well-defined, secure application-governed interfaces.
- **Requirements:**
  - Integrate at least 2 distinct domain tools (or 1 complex domain tool + 1 auxiliary retrieval/utility tool).
  - Every tool must define: `name`, `description`, a strongly-typed `argument schema`, and semantic validation rules.
  - Tool execution must remain under application control; include structured try/catch blocks, timeouts, and retry policies.
  - If adopting an Agent Skills pattern: document instructions, I/O contracts, operational constraints, and verification hooks.
- **Acceptance Criteria:**
  - Execution traces capture the full lifecycle: `tool_call` → `validate` → `execute` → `tool_result` → `model/application`.
  - Malformed arguments or unauthorized tool calls are intercepted and rejected safely.
- **Repository Evidence:** `src/tools/`, `src/skills/`, `tests/tools/`, sample execution traces.

---

### PR-05 — Agent Loop & Termination

`MUST` | **Target CLOs:** G2.1, G3.1

- **Purpose:** Ensure the system runs an authentic, multi-step observe-reason-act cycle with bounded termination guarantees.
- **Requirements:**
  - Implement a closed-loop execution cycle: `Goal` → `Observe` → `Decide/Reason` → `Act` → `Observe result` → `Update state` → `Continue/Stop`.
  - Ensure at least one runtime decision directs dynamic tool selection or execution branching.
  - Enforce explicit termination conditions paired with non-negotiable hard limits: `max_steps`, absolute wall-clock `timeout`, and token/cost thresholds.
- **Acceptance Criteria:**
  - Test executions demonstrate variable step counts and tool sequences based on varying inputs.
  - Infinite loops are mathematically impossible; unit tests confirm clean termination upon hitting hard constraints.
- **Repository Evidence:** `src/agent/loop.*`, `tests/agent_loop/`, multi-step trace logs.

---

### PR-06 — State, Memory & Context Separation

`SHOULD` | **Target CLOs:** G2.2, G4.1, G6.2

- **Purpose:** Decouple ephemeral context, transient task state, and persistent memory to support recovery and secure data retention.
- **Requirements:**
  - Implement an explicit task state schema: goal, current phase, observations, pending/completed tasks, and retry counts.
  - For cross-session memory: define explicit policies for reading, writing, updating, and data retention/pruning.
  - Do not treat raw chat history as the application's sole source of truth or state store.
- **Acceptance Criteria:**
  - The runtime state can be serialized, inspected, and dumped at any arbitrary step.
  - Support resuming execution from a saved checkpoint following an abrupt system interruption.
- **Repository Evidence:** `src/state/`, `src/memory/`, `docs/state-model.md`.

---

### PR-07 — RAG / Retrieval Harness

`SHOULD` | **Target CLOs:** G2.2, G3.3, G5.1

- **Purpose:** Provide grounded external knowledge when the target domain requires information beyond parametric LLM memory.
- **Requirements:**
  - Implement a structured RAG pipeline: `Ingest` → `Chunk` → `Embed/Index` → `Retrieve` → _(Rerank if applicable)_ → `Ground` → `Cite`.
  - Track document metadata to enable provenance verification and backward traceability.
  - Expose retrieval to the agent as an orchestrated tool or harness layer; avoid conflating simple RAG with agentic systems.
- **Acceptance Criteria:**
  - Maintain an evaluation dataset testing retrieval precision, recall, and grounding faithfulness.
  - Synthesized outputs cite reference documents accurately; the system gracefully handles "information not found" states.
- **Repository Evidence:** `src/retrieval/`, `data/`, `evals/rag/`, grounded output citations.

---

### PR-08 — Workflow Orchestration, Checkpoint & Recovery

`MUST` | **Target CLOs:** G4.1, G5.1

- **Purpose:** Blend deterministic graph workflows with agentic runtime nodes to guarantee system resilience and control.
- **Requirements:**
  - Define an explicit state graph: nodes, directed edges, and conditional routing logic.
  - Implement structured failure branches: retries, fallbacks, compensating actions, or safe shutdowns.
  - Provide state checkpointing and recovery for long-running workflows.
  - Introduce Human-in-the-Loop (HITL) review gates prior to executing irreversible, high-impact actions.
- **Acceptance Criteria:**
  - Demonstrate a live execution failure and the resulting automated recovery path.
  - State charts and architectural flow diagrams match implementation code and execution traces 1:1.
- **Repository Evidence:** `src/workflow/`, `docs/state-graph.md`, recovery test cases.

---

### PR-09 — Verification & Definition of Done

`MUST` | **Target CLOs:** G5.1

- **Purpose:** Eliminate unverified trust in model self-reporting by delegating verification to deterministic application checks.
- **Requirements:**
  - Formulate an objective, programmatic Definition of Done (DoD).
  - Combine structural validation (schema, type bounds) with domain-specific semantic verification (business invariants, evaluators).
- **Acceptance Criteria:**
  - Provide a test case where the agent incorrectly claims task success, but the independent verifier catches the flaw and rejects the output.
  - The system transitions to a terminal `SUCCESS` state exclusively after passing external verification.
- **Repository Evidence:** `src/verification/`, `tests/verification/`, evaluation run outputs.

---

### PR-10 — Evaluation, Logging & Observability

`MUST` | **Target CLOs:** G5.1, G6.2

- **Purpose:** Quantitatively benchmark system performance and enable granular root-cause analysis during agent failures.
- **Requirements:**
  - Maintain an evaluation dataset comprising 3 tiers: standard scenarios, edge/failure cases, and adversarial/security cases.
  - Track core operational metrics: task completion rate, domain-specific accuracy, tool call correctness, latency, and token consumption.
  - Record structured traces covering: input prompts, state transitions, LLM responses, tool calls/results, errors, verification outputs, and exit codes.
- **Acceptance Criteria:**
  - Deliver a quantitative evaluation report containing metrics and distributions (moving beyond qualitative video demos).
  - Demonstrate the ability to inspect an arbitrary failed trace log and identify the root-cause failure step.
- **Repository Evidence:** `evals/`, `reports/eval.md`, `logs/sample-traces/`.

---

### PR-11 — Security, Permission & Responsible AI

`MUST` | **Target CLOs:** G6.1, G6.2

- **Purpose:** Minimize the system blast radius against adversarial manipulation and enforce ethical AI standards.
- **Requirements:**
  - Enforce least privilege access across all tools and external APIs; apply strict allow-lists.
  - Manage secrets securely: provide a clean `.env.example`; never commit credentials to version control.
  - Conduct threat modeling covering: prompt injection, tool injection, data leakage, privilege escalation, and unsafe tool execution.
  - Enforce approval gates for critical state mutations; persist immutable audit logs for sensitive operations.
  - Include an AI Transparency Disclosure detailing which development components utilized AI, along with verification methods and citations.
- **Acceptance Criteria:**
  - Provide a concise threat model document accompanied by at least 2 security test cases.
  - Verify that unauthorized actions and malicious prompt injections are safely intercepted and logged.
- **Repository Evidence:** `docs/threat-model.md`, `src/policy/`, `tests/security/`, `.env.example`.

---

### PR-12 — Multi-Agent or Model Context Protocol (MCP)

`SHOULD` | **Target CLOs:** G4.2

- **Purpose:** Promote modularity, clean architectural separation, and standard tool interoperability without adding needless complexity.
- **Requirements (Choose A or B):**
  - **Option A (Multi-Agent):** Multi-agent coordination with specialized responsibilities (e.g., Planner - Worker - Critic) and explicit handoff protocols.
  - **Option B (MCP):** Implementation of the Model Context Protocol to decouple and access external tools or knowledge resources.
  - Document the architectural justification explaining why multi-agent or MCP improves outcomes over a single-agent design.
- **Acceptance Criteria:**
  - Execution traces confirm end-to-end multi-agent handoffs or standard MCP server communication.
  - No arbitrary agent proliferation; each agent must own an isolated scope of responsibility and context window.
- **Repository Evidence:** `src/agents/` or `src/mcp/`, `docs/design-decision.md`.

---

### PR-13 — Token, Cost & Operational Efficiency

`MUST` | **Target CLOs:** G1.1, G5.1

- **Purpose:** Translate technical context management into realistic financial and operational metrics.
- **Requirements:**
  - Instrument token usage: record input tokens, output tokens, and total tokens per interaction.
  - Measure round-trip latency and count model/tool invocations across evaluation benchmarks.
  - Model operational cost projections for hypothetical production scales (e.g., 1,000 and 10,000 requests/month).
  - Analyze trade-offs between model tier, context payload size, step counts, latency, and output quality.
- **Acceptance Criteria:**
  - Document cost projections with clear assumptions in `reports/cost-analysis.md`.
  - Formulate at least one data-driven architectural optimization recommendation based on benchmark metrics.
- **Repository Evidence:** `reports/cost-analysis.md`, evaluation metrics, token tracking logs.

---

## 5. Minimum Project Checklist

### 5.1 MUST — Capstone Definition of Done

- [ ] Define the problem statement, primary actors, goals, inputs/outputs, definition of done, and failure conditions.
- [ ] Establish explicit justification for an agentic architecture; demonstrate dynamic runtime decision-making.
- [ ] Implement Structured Outputs accompanied by runtime schema validation on all critical system interfaces.
- [ ] Apply an intentional Context Engineering strategy: selection, pruning, truncation, or summarization.
- [ ] Integrate tools using strict JSON schemas, input validation, structured error/timeout handlers, and scoped permissions.
- [ ] Run a multi-step Agent Loop with explicit state updates and non-negotiable hard termination limits.
- [ ] Build workflow routing featuring failure/recovery paths; incorporate checkpoints or HITL gates where appropriate.
- [ ] Implement an independent Verification layer that operates separate from LLM self-reporting.
- [ ] Maintain an evaluation dataset with quantitative metrics and end-to-end execution tracing.
- [ ] Apply secure secret management, threat modeling, and an ethical AI transparency disclosure.
- [ ] Measure token consumption, latency, and cost per task, including a production cost projection.

### 5.2 SHOULD — Advanced Implementation Criteria

- [ ] Build a grounded RAG pipeline featuring source attribution, reranking, and citation generation.
- [ ] Maintain explicit separation between Memory, Task State, and Context; support process resumption.
- [ ] Enforce human approval gates for destructive, risky, or irreversible operations.
- [ ] Implement a prototype multi-agent workflow or integrate tools via the Model Context Protocol (MCP).
- [ ] Run baseline comparisons (Agent vs. Static Workflow, Pure RAG, or Direct Chat) to justify architectural complexity.
- [ ] Implement adversarial security tests and regression evaluation pipelines.

---

## 6. Defense & Oral Examination Questions

1. What is the agent's **explicit Goal** and its objective **Definition of Done**?
2. Why does this problem **require an agent** instead of a deterministic workflow or conventional procedural script?
3. What specific decisions is the model **authorized to make at runtime**, and what business rules remain **strictly deterministic in code**?
4. Where is **state persisted**? How do **Context**, **State**, and **Memory** differ within your architecture?
5. Which **tools** are exposed to the agent? How are their permissions scoped and arguments validated?
6. Under what conditions does the agent terminate? What specific **hard guardrails** prevent runaway execution?
7. What **independent mechanism** verifies that the agent has completed the task correctly?
8. When an LLM generates invalid output, a tool fails, or RAG times out, how does the system **recover**?
9. Which **datasets and quantitative metrics** evaluate system quality? What are your current benchmark scores?
10. Open an arbitrary **failed execution trace** from your logs: at what step did the failure occur, and what was the root cause?
11. How does the architecture protect against **Prompt Injection**, **Data Leakage**, or **Privilege Escalation**?
12. What is the **average cost per task**? Where are the primary bottlenecks in token consumption and execution latency?
13. _(If utilizing Multi-Agent or MCP)_: Why was this architectural complexity necessary? What specific problem does it solve that a single agent cannot?
14. Which portions of the codebase were generated using **AI development tools**? How were they validated, reviewed, and cited?

---

## 7. Evidence Required Across Three Evaluation Stages
