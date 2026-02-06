# ClawController Agent Instructions

Add this to your agent's TOOLS.md or AGENTS.md so they know how to use ClawController.

---

## ClawController Integration

**API Base:** `http://localhost:8000/api`

### Creating Tasks
```bash
curl -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Task title", "description": "Details", "tags": ["coding"], "assignee_id": "dev"}'
```

### Logging Activity (REQUIRED while working)
```bash
curl -X POST http://localhost:8000/api/tasks/{TASK_ID}/activity \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "YOUR_AGENT_ID", "message": "What you did or found"}'
```

### Task Lifecycle
- **ASSIGNED** → Task given to you
- **IN_PROGRESS** → Auto-triggers on first activity
- **REVIEW** → Say "completed" or "done" in activity to trigger
- **DONE** → Human approves (don't set this yourself)

### Workflow
1. Check for assigned tasks: `GET /api/tasks?assignee_id={your_id}&status=ASSIGNED`
2. Log progress as you work (every significant step)
3. When finished, post activity with "completed" or "done"
4. Wait for human to approve → DONE

### Key Rules
- **Always log activity** — ClawController tracks progress via activity logs
- **Don't skip REVIEW** — Humans approve work before DONE
- **Use tags** — Tasks auto-assign based on tags (coding→dev, trading→trader, etc.)

---

Copy this section into your agent workspace files.
