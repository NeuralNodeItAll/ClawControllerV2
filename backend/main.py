from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from pathlib import Path
import json
import asyncio
import os
import glob
import time
import subprocess
import shutil
import uuid

from database import init_db, get_db, SessionLocal
from models import (
    Agent, Task, Comment, Deliverable, ChatMessage, Announcement, ActivityLog,
    TaskStatus, Priority, AgentRole, AgentStatus,
    RecurringTask, RecurringTaskRun, TaskActivity,
    Document, IntelligenceReport, Client, WeeklyRecap, ApiUsageLog
)

app = FastAPI(title="ClawController API", version="2.0.0")

# CORS for frontend (allow all origins for remote access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass

manager = ConnectionManager()

# Pydantic schemas
class AgentResponse(BaseModel):
    id: str
    name: str
    role: str
    description: Optional[str]
    avatar: Optional[str]
    status: str
    
    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "NORMAL"
    tags: Optional[List[str]] = []
    assignee_id: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None
    assignee_id: Optional[str] = None
    reviewer: Optional[str] = None  # agent id or "human"

class CommentCreate(BaseModel):
    content: str
    agent_id: str

class DeliverableCreate(BaseModel):
    title: str

class ChatMessageCreate(BaseModel):
    agent_id: str
    content: str

class AnnouncementCreate(BaseModel):
    title: Optional[str] = None
    message: str
    priority: str = "NORMAL"

# Recurring task schemas
class RecurringTaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "NORMAL"
    tags: Optional[List[str]] = []
    assignee_id: Optional[str] = None
    schedule_type: str  # daily, weekly, hourly, cron
    schedule_value: Optional[str] = None  # cron expression, hours, or comma-separated days
    schedule_time: Optional[str] = None  # HH:MM format

class RecurringTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None
    assignee_id: Optional[str] = None
    schedule_type: Optional[str] = None
    schedule_value: Optional[str] = None
    schedule_time: Optional[str] = None
    is_active: Optional[bool] = None

class TaskActivityCreate(BaseModel):
    agent_id: str
    message: str

# Helper to log activity
async def log_activity(db: Session, activity_type: str, agent_id: str = None, task_id: str = None, description: str = None):
    activity = ActivityLog(
        activity_type=activity_type,
        agent_id=agent_id,
        task_id=task_id,
        description=description
    )
    db.add(activity)
    db.commit()
    
    # Broadcast to WebSocket clients
    await manager.broadcast({
        "type": "activity",
        "data": {
            "activity_type": activity_type,
            "agent_id": agent_id,
            "task_id": task_id,
            "description": description,
            "created_at": datetime.utcnow().isoformat()
        }
    })

# ============ Lead Agent Helper ============
def get_lead_agent_id(db: Session) -> str:
    """Get the ID of the lead agent (role=LEAD). Falls back to 'main' if none found."""
    lead = db.query(Agent).filter(Agent.role == AgentRole.LEAD).first()
    return lead.id if lead else "main"

def get_lead_agent(db: Session) -> Agent:
    """Get the lead agent object. Returns None if no agents exist."""
    return db.query(Agent).filter(Agent.role == AgentRole.LEAD).first()

# ============ Auto-Assignment Rules ============
# Tag → Agent mapping for automatic task assignment
# Add your own mappings here based on your agents
ASSIGNMENT_RULES = {
    # Example mappings - customize for your agents
    # "code": "dev",
    # "bug": "dev",
    # "feature": "dev",
}

def get_auto_assignee(tags: list) -> Optional[str]:
    """Find matching agent for given tags based on ASSIGNMENT_RULES."""
    if not tags:
        return None
    for tag in tags:
        tag_lower = tag.lower().strip()
        if tag_lower in ASSIGNMENT_RULES:
            return ASSIGNMENT_RULES[tag_lower]
    return None

# Helper to notify main agent when task is completed
def notify_task_completed(task, completed_by: str = None):
    """Notify main agent when a task is marked DONE."""
    agent_name = completed_by or task.assignee_id or "Unknown"
    
    message = f"""✅ Task completed: {task.title}

**Completed by:** {agent_name}
**Task ID:** {task.id}
**Description:** {(task.description[:300] + '...') if task.description and len(task.description) > 300 else (task.description or 'No description')}

View in ClawController: http://localhost:5001"""

    try:
        subprocess.Popen(
            ["openclaw", "agent", "--agent", "main", "--message", message],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(Path.home())
        )
        print(f"Notified main agent of task completion: {task.title}")
    except Exception as e:
        print(f"Failed to notify main agent of completion: {e}")

# Helper to notify reviewer when task needs review
def notify_reviewer(task, submitted_by: str = None):
    """Notify reviewer when a task is submitted for review."""
    reviewer = task.reviewer or 'main'
    agent_name = submitted_by or task.assignee_id or "Unknown"
    
    # Map reviewer name to agent ID
    reviewer_agent = 'main' if reviewer in ['main'] else reviewer
    
    message = f"""📋 Task ready for review: {task.title}

**Submitted by:** {agent_name}
**Task ID:** {task.id}
**Description:** {(task.description[:300] + '...') if task.description and len(task.description) > 300 else (task.description or 'No description')}

**Review Required:** Please review this task in ClawController and either approve or reject it with feedback.

View in ClawController: http://localhost:5001/tasks/{task.id}"""

    try:
        subprocess.Popen(
            ["openclaw", "agent", "--agent", reviewer_agent, "--message", message],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(Path.home())
        )
        print(f"Notified reviewer {reviewer_agent} of task needing review: {task.title}")
    except Exception as e:
        print(f"Failed to notify reviewer {reviewer_agent}: {e}")

# Helper to notify agent when their task is rejected
def notify_task_rejected(task, feedback: str = None, rejected_by: str = None):
    """Notify agent when their task is rejected and sent back."""
    if not task.assignee_id:
        return
    
    reviewer_name = rejected_by or "Reviewer"
    
    message = f"""🔄 Task sent back for changes: {task.title}

**Rejected by:** {reviewer_name}
**Task ID:** {task.id}
**Feedback:** {feedback or 'No feedback provided'}

Please address the feedback and resubmit when ready.

**Log activity:**
curl -X POST http://localhost:8000/api/tasks/{task.id}/activity -H "Content-Type: application/json" -d '{{"agent_id": "{task.assignee_id}", "message": "YOUR_UPDATE"}}'

View in ClawController: http://localhost:5001"""

    try:
        subprocess.Popen(
            ["openclaw", "agent", "--agent", task.assignee_id, "--message", message],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(Path.home())
        )
        print(f"Notified agent {task.assignee_id} of task rejection: {task.title}")
    except Exception as e:
        print(f"Failed to notify agent {task.assignee_id} of rejection: {e}")

# Helper to notify agent when task is assigned
def notify_agent_of_task(task):
    """Notify agent via OpenClaw when a task is assigned to them."""
    if not task.assignee_id:
        return
    if task.status not in [TaskStatus.ASSIGNED, TaskStatus.IN_PROGRESS]:
        return
    
    description_preview = (task.description[:500] + '...') if task.description and len(task.description) > 500 else (task.description or 'No description')
    
    message = f"""{task.status.value}: {task.title}

## Task ID: {task.id}

## Description
{description_preview}

## Log Activity
curl -X POST http://localhost:8000/api/tasks/{task.id}/activity -H "Content-Type: application/json" -d '{{"agent_id": "{task.assignee_id}", "message": "YOUR_UPDATE"}}'

## When Complete
Post an activity with 'completed' or 'done' in the message - the system will auto-transition to REVIEW."""

    try:
        subprocess.Popen(
            ["openclaw", "agent", "--agent", task.assignee_id, "--message", message],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(Path.home())
        )
        print(f"Notified agent {task.assignee_id} of task: {task.title}")
    except Exception as e:
        print(f"Failed to notify agent {task.assignee_id}: {e}")

# Startup
@app.on_event("startup")
async def startup():
    init_db()
    print("ClawController API started")

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Agent endpoints
@app.get("/api/agents", response_model=List[AgentResponse])
def get_agents(db: Session = Depends(get_db)):
    return db.query(Agent).all()

@app.get("/api/agents/{agent_id}", response_model=AgentResponse)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@app.patch("/api/agents/{agent_id}/status")
async def update_agent_status(agent_id: str, status: str, db: Session = Depends(get_db)):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent.status = AgentStatus(status)
    db.commit()
    await manager.broadcast({"type": "agent_status", "data": {"id": agent_id, "status": status}})
    return {"ok": True}

# ============ OpenClaw Integration ============

def get_agent_status_from_sessions(agent_id: str) -> str:
    """Determine agent status from session file activity."""
    home = Path.home()
    sessions_dir = home / ".openclaw" / "agents" / agent_id / "sessions"
    
    if not sessions_dir.exists():
        return "STANDBY"  # Configured but never activated - ready to go
    
    # Find the most recently modified session file
    session_files = list(sessions_dir.glob("*.jsonl"))
    if not session_files:
        return "STANDBY"  # Configured but no sessions yet - ready to go
    
    # Get the most recent modification time
    latest_mtime = 0
    for f in session_files:
        try:
            mtime = f.stat().st_mtime
            if mtime > latest_mtime:
                latest_mtime = mtime
        except:
            continue
    
    if latest_mtime == 0:
        return "STANDBY"
    
    # Calculate time since last activity
    now = time.time()
    elapsed_seconds = now - latest_mtime
    
    # Status thresholds
    if elapsed_seconds < 300:  # 5 minutes
        return "WORKING"
    elif elapsed_seconds < 1800:  # 30 minutes
        return "IDLE"
    else:
        return "STANDBY"  # Has sessions but inactive - ready to be activated

class OpenClawAgentResponse(BaseModel):
    id: str
    name: str
    role: str
    description: Optional[str] = None
    avatar: Optional[str] = None
    status: str
    emoji: Optional[str] = None
    workspace: Optional[str] = None
    model: Optional[dict] = None

@app.get("/api/openclaw/agents", response_model=List[OpenClawAgentResponse])
def get_openclaw_agents(db: Session = Depends(get_db)):
    """Get agents from OpenClaw config with real-time status from session activity."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"
    
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="OpenClaw config not found")
    
    try:
        with open(config_path) as f:
            config = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse OpenClaw config: {str(e)}")
    
    # Get agents with IN_PROGRESS tasks - they should show as WORKING
    working_agents = set()
    in_progress_tasks = db.query(Task).filter(Task.status == TaskStatus.IN_PROGRESS).all()
    for task in in_progress_tasks:
        if task.assignee_id:
            working_agents.add(task.assignee_id)
    
    agents_config = config.get("agents", {})
    agent_list = agents_config.get("list", [])
    
    result = []
    for agent in agent_list:
        agent_id = agent.get("id")
        if not agent_id:
            continue
        
        # Get real-time status from session files
        status = get_agent_status_from_sessions(agent_id)
        
        # Override to WORKING if agent has IN_PROGRESS tasks
        if agent_id in working_agents:
            status = "WORKING"
        
        # Determine role based on agent configuration
        role = "INT"  # Default to integration agent
        if agent_id == "main":
            role = "LEAD"
        
        identity = agent.get("identity", {})
        name = identity.get("name") or agent.get("name") or agent_id
        emoji = identity.get("emoji") or "🤖"
        
        # Get description - defaults to agent id
        descriptions = {
            "main": "Primary orchestrator and squad lead",
        }
        
        # Get model - use agent-specific or fall back to default
        agent_model = agent.get("model")
        if not agent_model:
            # Use default model from config (agents.defaults.model)
            defaults = agents_config.get("defaults", {})
            default_model = defaults.get("model")
            if default_model:
                agent_model = default_model
        
        result.append(OpenClawAgentResponse(
            id=agent_id,
            name=name,
            role=role,
            description=descriptions.get(agent_id, f"Agent: {name}"),
            avatar=emoji,
            status=status,
            emoji=emoji,
            workspace=agent.get("workspace"),
            model=agent_model
        ))
    
    return result

@app.get("/api/openclaw/status")
def get_openclaw_status():
    """Check if OpenClaw integration is available."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"
    
    return {
        "available": config_path.exists(),
        "config_path": str(config_path)
    }

class ImportAgentsRequest(BaseModel):
    agent_ids: List[str]

@app.post("/api/openclaw/import")
async def import_agents_from_openclaw(import_request: ImportAgentsRequest, db: Session = Depends(get_db)):
    """Import selected agents from OpenClaw config into ClawController database."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"
    
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="OpenClaw config not found")
    
    try:
        with open(config_path) as f:
            config = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse OpenClaw config: {str(e)}")
    
    agents_config = config.get("agents", {})
    agent_list = agents_config.get("list", [])
    
    imported_agents = []
    skipped_agents = []
    
    for agent_id in import_request.agent_ids:
        # Check if agent already exists in database
        existing_agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if existing_agent:
            skipped_agents.append({"id": agent_id, "reason": "Already exists"})
            continue
        
        # Find agent in config
        agent_config = None
        for agent in agent_list:
            if agent.get("id") == agent_id:
                agent_config = agent
                break
        
        if not agent_config:
            skipped_agents.append({"id": agent_id, "reason": "Not found in OpenClaw config"})
            continue
        
        # Get agent details
        identity = agent_config.get("identity", {})
        name = identity.get("name") or agent_config.get("name") or agent_id
        emoji = identity.get("emoji") or "🤖"
        
        # Determine role based on agent configuration
        role = AgentRole.INT  # Default to integration agent
        if agent_id == "main":
            role = AgentRole.LEAD
        
        # Get description
        descriptions = {
            "main": "Primary orchestrator and squad lead",
        }
        description = descriptions.get(agent_id, f"Agent: {name}")
        
        # Get real-time status from session files
        status = get_agent_status_from_sessions(agent_id)
        agent_status = AgentStatus.STANDBY  # Default
        if status == "WORKING":
            agent_status = AgentStatus.WORKING
        elif status == "IDLE":
            agent_status = AgentStatus.IDLE
        elif status == "STANDBY":
            agent_status = AgentStatus.STANDBY
        else:
            agent_status = AgentStatus.OFFLINE
        
        # Create agent in database
        new_agent = Agent(
            id=agent_id,
            name=name,
            role=role,
            description=description,
            avatar=emoji,
            status=agent_status,
            workspace=agent_config.get("workspace")
        )
        
        db.add(new_agent)
        imported_agents.append({
            "id": agent_id,
            "name": name,
            "role": role.value,
            "status": agent_status.value
        })
    
    try:
        db.commit()
        
        # Log activity for each imported agent
        for agent_info in imported_agents:
            await log_activity(
                db,
                "agent_imported",
                agent_id=agent_info["id"],
                description=f"Imported agent {agent_info['name']} from OpenClaw config"
            )
        
        # Broadcast agent updates
        await manager.broadcast({
            "type": "agents_imported",
            "data": {
                "imported": imported_agents,
                "skipped": skipped_agents
            }
        })
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save agents: {str(e)}")
    
    return {
        "imported": imported_agents,
        "skipped": skipped_agents,
        "total_requested": len(import_request.agent_ids),
        "imported_count": len(imported_agents),
        "skipped_count": len(skipped_agents)
    }

# Task endpoints
@app.get("/api/tasks")
def get_tasks(status: Optional[str] = None, assignee_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Task)
    if status:
        query = query.filter(Task.status == TaskStatus(status))
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    tasks = query.order_by(Task.created_at.desc()).all()
    
    result = []
    for task in tasks:
        result.append({
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "status": task.status.value,
            "priority": task.priority.value,
            "tags": json.loads(task.tags) if task.tags else [],
            "assignee_id": task.assignee_id,
            "assignee": {"id": task.assignee.id, "name": task.assignee.name, "avatar": task.assignee.avatar} if task.assignee else None,
            "reviewer": task.reviewer,
            "created_at": task.created_at.isoformat(),
            "updated_at": task.updated_at.isoformat(),
            "comments_count": len(task.comments),
            "deliverables_count": len(task.deliverables),
            "deliverables_complete": sum(1 for d in task.deliverables if d.completed)
        })
    return result

@app.post("/api/tasks")
async def create_task(task_data: TaskCreate, db: Session = Depends(get_db)):
    # Determine assignee (explicit or auto-assigned by tags)
    assignee_id = task_data.assignee_id
    auto_assigned = False
    
    if not assignee_id and task_data.tags:
        auto_assignee = get_auto_assignee(task_data.tags)
        if auto_assignee:
            assignee_id = auto_assignee
            auto_assigned = True
    
    task = Task(
        title=task_data.title,
        description=task_data.description,
        priority=Priority(task_data.priority),
        tags=json.dumps(task_data.tags) if task_data.tags else "[]",
        assignee_id=assignee_id,
        status=TaskStatus.ASSIGNED if assignee_id else TaskStatus.INBOX,
        reviewer='main'  # Default reviewer is main
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    
    # Log activity with auto-assign note if applicable
    activity_desc = f"Task created: {task.title}"
    if auto_assigned:
        activity_desc += f" (auto-assigned to {assignee_id})"
    await log_activity(db, "task_created", task_id=task.id, description=activity_desc)
    await manager.broadcast({"type": "task_created", "data": {"id": task.id, "title": task.title}})
    
    # Notify assigned agent
    if task.assignee_id:
        notify_agent_of_task(task)
    
    return {
        "id": task.id, 
        "title": task.title, 
        "status": task.status.value,
        "assignee_id": task.assignee_id,
        "auto_assigned": auto_assigned
    }

@app.get("/api/tasks/{task_id}")
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status.value,
        "priority": task.priority.value,
        "tags": json.loads(task.tags) if task.tags else [],
        "assignee_id": task.assignee_id,
        "assignee": {"id": task.assignee.id, "name": task.assignee.name, "avatar": task.assignee.avatar} if task.assignee else None,
        "reviewer": task.reviewer,
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
        "comments": [
            {
                "id": c.id,
                "content": c.content,
                "agent_id": c.agent_id,
                "agent": {"id": c.agent.id, "name": c.agent.name, "avatar": c.agent.avatar},
                "created_at": c.created_at.isoformat()
            } for c in task.comments
        ],
        "deliverables": [
            {
                "id": d.id,
                "title": d.title,
                "completed": d.completed,
                "completed_at": d.completed_at.isoformat() if d.completed_at else None
            } for d in task.deliverables
        ]
    }

@app.patch("/api/tasks/{task_id}")
async def update_task(task_id: str, task_data: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Track if we need to notify agent
    old_assignee = task.assignee_id
    old_status = task.status.value
    should_notify_assign = False
    should_notify_complete = False
    
    if task_data.title is not None:
        task.title = task_data.title
    if task_data.description is not None:
        task.description = task_data.description
    if task_data.status is not None:
        task.status = TaskStatus(task_data.status)
        await log_activity(db, "status_changed", task_id=task.id, description=f"Status: {old_status} → {task_data.status}")
        # Notify if status changed to ASSIGNED
        if task_data.status == "ASSIGNED" and task.assignee_id:
            should_notify_assign = True
        # Notify main agent if task completed
        if task_data.status == "DONE" and old_status != "DONE":
            should_notify_complete = True
    if task_data.priority is not None:
        task.priority = Priority(task_data.priority)
    if task_data.tags is not None:
        task.tags = json.dumps(task_data.tags)
    if task_data.assignee_id is not None:
        new_assignee = task_data.assignee_id if task_data.assignee_id != "" else None
        task.assignee_id = new_assignee
        if task.assignee_id and task.status == TaskStatus.INBOX:
            task.status = TaskStatus.ASSIGNED
        # Notify if assignee changed to a new agent
        if new_assignee and new_assignee != old_assignee:
            should_notify_assign = True
    if task_data.reviewer is not None:
        task.reviewer = task_data.reviewer if task_data.reviewer != "" else None
    
    db.commit()
    await manager.broadcast({"type": "task_updated", "data": {"id": task_id}})
    
    # Notify assigned agent after commit
    if should_notify_assign:
        db.refresh(task)
        notify_agent_of_task(task)
    
    # Notify main agent of task completion
    if should_notify_complete:
        db.refresh(task)
        notify_task_completed(task)
    
    return {"ok": True}

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Delete related records first to avoid foreign key constraint errors
    # 1. Delete TaskActivity records (has FK constraint)
    db.query(TaskActivity).filter(TaskActivity.task_id == task_id).delete()
    
    # 2. Clean up ActivityLog entries that reference this task (optional cleanup)
    db.query(ActivityLog).filter(ActivityLog.task_id == task_id).delete()
    
    # 3. Delete the task (comments and deliverables will be cascade deleted)
    db.delete(task)
    db.commit()
    
    await manager.broadcast({"type": "task_deleted", "data": {"id": task_id}})
    return {"ok": True}

# Review actions
class ReviewAction(BaseModel):
    action: str  # "approve" or "reject"
    feedback: Optional[str] = None
    reviewer: Optional[str] = None  # For sending to review

@app.post("/api/tasks/{task_id}/review")
async def review_task(task_id: str, review_data: ReviewAction, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if review_data.action == "send_to_review":
        # Move task to REVIEW with specified reviewer
        task.status = TaskStatus.REVIEW
        task.reviewer = review_data.reviewer or get_lead_agent_id(db)
        db.commit()
        db.refresh(task)
        notify_reviewer(task)
        await log_activity(db, "sent_to_review", task_id=task.id, 
                          description=f"Task sent for review to {task.reviewer}")
    
    elif review_data.action == "approve":
        # Approve and move to DONE
        if task.status != TaskStatus.REVIEW:
            raise HTTPException(status_code=400, detail="Task is not in REVIEW status")
        old_reviewer = task.reviewer
        task.status = TaskStatus.DONE
        task.reviewer = None
        await log_activity(db, "task_approved", task_id=task.id,
                          description=f"Task approved by {old_reviewer}")
    
    elif review_data.action == "reject":
        # Reject with feedback and send back to IN_PROGRESS
        if task.status != TaskStatus.REVIEW:
            raise HTTPException(status_code=400, detail="Task is not in REVIEW status")
        old_reviewer = task.reviewer
        task.status = TaskStatus.IN_PROGRESS
        task.reviewer = None
        
        # Add feedback as a comment if provided
        if review_data.feedback:
            comment = Comment(
                task_id=task_id,
                agent_id=get_lead_agent_id(db),
                content=f"📝 Review feedback: {review_data.feedback}"
            )
            db.add(comment)
        
        db.commit()
        db.refresh(task)
        notify_task_rejected(task, feedback=review_data.feedback, rejected_by=old_reviewer)
        
        await log_activity(db, "task_rejected", task_id=task.id,
                          description=f"Task sent back by {old_reviewer}: {review_data.feedback or 'No feedback'}")
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {review_data.action}")
    
    db.commit()
    await manager.broadcast({"type": "task_reviewed", "data": {"id": task_id, "action": review_data.action}})
    
    return {"ok": True, "status": task.status.value}

# Comment endpoints
def parse_mentions(content: str) -> list[str]:
    """Extract @mentioned agent IDs from comment content."""
    # Pattern: @AgentName (word characters, may include spaces if quoted)
    # Match @word patterns
    import re
    mentions = re.findall(r'@(\w+)', content)
    return mentions

def get_agent_id_by_name(name: str, db: Session) -> Optional[str]:
    """Find agent ID by name (case-insensitive)."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"
    
    if config_path.exists():
        try:
            with open(config_path) as f:
                config = json.load(f)
            agents_list = config.get("agents", {}).get("list", [])
            for agent in agents_list:
                agent_id = agent.get("id", "")
                identity = agent.get("identity", {})
                agent_name = identity.get("name") or agent.get("name") or agent_id
                # Match by ID or name (case-insensitive)
                if agent_id.lower() == name.lower() or agent_name.lower() == name.lower():
                    return agent_id
        except:
            pass
    return None

async def route_mention_to_agent(agent_id: str, task: Task, comment_content: str, commenter_name: str):
    """Send a message to an agent when @mentioned in a task comment."""
    # Build context message for the agent
    message = f"""You were mentioned in a task comment.

**Task:** {task.title}
**Status:** {task.status.value}
**Description:** {task.description or 'No description'}

**Comment from {commenter_name}:**
{comment_content}

Please review and respond appropriately. You can reply by adding a comment to this task via the API:
```
curl -X POST http://localhost:8000/api/tasks/{task.id}/comments -H "Content-Type: application/json" -d '{{"agent_id": "{agent_id}", "content": "Your response here"}}'
```"""

    try:
        # Use subprocess to call OpenClaw CLI
        subprocess.Popen(
            [
                "openclaw", "agent",
                "--agent", agent_id,
                "--message", message
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(Path.home())
        )
        print(f"Routed mention to agent {agent_id}")
    except Exception as e:
        # Log error but don't fail the comment creation
        print(f"Failed to route mention to agent {agent_id}: {e}")

@app.post("/api/tasks/{task_id}/comments")
async def add_comment(task_id: str, comment_data: CommentCreate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    comment = Comment(
        task_id=task_id,
        agent_id=comment_data.agent_id,
        content=comment_data.content
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    agent = db.query(Agent).filter(Agent.id == comment_data.agent_id).first()
    commenter_name = agent.name if agent else comment_data.agent_id
    
    await log_activity(db, "comment_added", agent_id=comment_data.agent_id, task_id=task_id, 
                       description=f"{commenter_name} commented on {task.title}")
    await manager.broadcast({"type": "comment_added", "data": {"task_id": task_id, "comment_id": comment.id}})
    
    # Parse @mentions and route to agents
    mentions = parse_mentions(comment_data.content)
    routed_agents = []
    for mention in mentions:
        mentioned_agent_id = get_agent_id_by_name(mention, db)
        if mentioned_agent_id and mentioned_agent_id != comment_data.agent_id:
            # Don't route if agent mentions themselves
            await route_mention_to_agent(mentioned_agent_id, task, comment_data.content, commenter_name)
            routed_agents.append(mentioned_agent_id)
    
    return {"id": comment.id, "routed_to": routed_agents}

# Task Activity endpoints
@app.get("/api/tasks/{task_id}/activity")
def get_task_activity(task_id: str, limit: int = 50, db: Session = Depends(get_db)):
    """Get activity log entries for a specific task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    activities = db.query(TaskActivity).filter(
        TaskActivity.task_id == task_id
    ).order_by(TaskActivity.timestamp.desc()).limit(limit).all()
    
    result = []
    for activity in reversed(activities):  # Return oldest first
        agent = None
        if activity.agent_id:
            # Handle special "user" agent
            if activity.agent_id == "user":
                agent = {"id": "user", "name": "User", "avatar": "👤"}
            else:
                agent_obj = db.query(Agent).filter(Agent.id == activity.agent_id).first()
                if agent_obj:
                    agent = {"id": agent_obj.id, "name": agent_obj.name, "avatar": agent_obj.avatar}
                else:
                    # Fallback for unknown agents
                    agent = {"id": activity.agent_id, "name": activity.agent_id.title(), "avatar": "🤖"}
        
        result.append({
            "id": activity.id,
            "task_id": activity.task_id,
            "agent_id": activity.agent_id,
            "agent": agent,
            "message": activity.message,
            "timestamp": activity.timestamp.isoformat()
        })
    return result

@app.post("/api/tasks/{task_id}/activity")
async def add_task_activity(task_id: str, activity_data: TaskActivityCreate, db: Session = Depends(get_db)):
    """Add an activity log entry for a specific task.
    
    Auto-transitions:
    - ASSIGNED → IN_PROGRESS: First activity from assigned agent
    - IN_PROGRESS → REVIEW: Activity contains completion keywords
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    activity = TaskActivity(
        task_id=task_id,
        agent_id=activity_data.agent_id,
        message=activity_data.message
    )
    db.add(activity)
    
    # === AUTO-TRANSITIONS ===
    old_status = task.status
    new_status = None
    
    # 1. ASSIGNED → IN_PROGRESS: First activity from the assigned agent
    if task.status == TaskStatus.ASSIGNED and activity_data.agent_id == task.assignee_id:
        # Check if this is first activity from the assignee
        existing_activity = db.query(TaskActivity).filter(
            TaskActivity.task_id == task_id,
            TaskActivity.agent_id == task.assignee_id
        ).first()
        if not existing_activity:
            task.status = TaskStatus.IN_PROGRESS
            new_status = TaskStatus.IN_PROGRESS
    
    # 2. IN_PROGRESS → REVIEW: Completion keywords in message
    if task.status == TaskStatus.IN_PROGRESS:
        completion_keywords = ['completed', 'done', 'finished', 'complete', 'task complete', 
                              'marking done', 'marking complete', '✅ done', '✅ complete',
                              'ready for review', 'awaiting review', 'submitted for review']
        message_lower = activity_data.message.lower()
        if any(kw in message_lower for kw in completion_keywords):
            task.status = TaskStatus.REVIEW
            new_status = TaskStatus.REVIEW
            # Set default reviewer if not set
            if not task.reviewer:
                task.reviewer = 'main'
    
    db.commit()
    db.refresh(activity)
    
    agent = db.query(Agent).filter(Agent.id == activity_data.agent_id).first()
    
    # Broadcast activity added
    await manager.broadcast({
        "type": "task_activity_added",
        "data": {
            "task_id": task_id,
            "activity_id": activity.id,
            "agent": {"id": agent.id, "name": agent.name, "avatar": agent.avatar} if agent else None,
            "message": activity.message,
            "timestamp": activity.timestamp.isoformat()
        }
    })
    
    # Broadcast status change if it happened
    if new_status:
        await manager.broadcast({
            "type": "task_updated",
            "data": {"id": task_id, "status": new_status.value}
        })
        # Log the auto-transition
        log = ActivityLog(
            activity_type="status_changed",
            agent_id=activity_data.agent_id,
            task_id=task_id,
            description=f"Auto-transitioned: {old_status.value} → {new_status.value}"
        )
        db.add(log)
        db.commit()
        
        # Notify reviewer when task transitions to REVIEW
        if new_status == TaskStatus.REVIEW:
            db.refresh(task)
            notify_reviewer(task, submitted_by=activity_data.agent_id)
    
    return {"id": activity.id, "auto_transition": new_status.value if new_status else None}


@app.post("/api/tasks/{task_id}/complete")
async def complete_task(task_id: str, db: Session = Depends(get_db)):
    """Explicitly mark a task as complete, sending it to REVIEW.
    
    Used by agents to signal they've finished their work.
    The task will be reviewed by the assigned reviewer (default: main).
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if task.status == TaskStatus.DONE:
        raise HTTPException(status_code=400, detail="Task is already done")
    
    if task.status == TaskStatus.REVIEW:
        raise HTTPException(status_code=400, detail="Task is already in review")
    
    old_status = task.status
    task.status = TaskStatus.REVIEW
    if not task.reviewer:
        task.reviewer = 'main'
    
    db.commit()
    
    # Log the completion
    log = ActivityLog(
        activity_type="sent_to_review",
        agent_id=task.assignee_id,
        task_id=task_id,
        description=f"Task sent for review to {task.reviewer}"
    )
    db.add(log)
    db.commit()
    
    await manager.broadcast({
        "type": "task_updated",
        "data": {"id": task_id, "status": TaskStatus.REVIEW.value, "reviewer": task.reviewer}
    })
    
    # Notify reviewer
    db.refresh(task)
    notify_reviewer(task)
    
    return {"ok": True, "status": TaskStatus.REVIEW.value, "reviewer": task.reviewer}


# Deliverable endpoints
@app.post("/api/tasks/{task_id}/deliverables")
async def add_deliverable(task_id: str, deliverable_data: DeliverableCreate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    deliverable = Deliverable(task_id=task_id, title=deliverable_data.title)
    db.add(deliverable)
    db.commit()
    db.refresh(deliverable)
    
    return {"id": deliverable.id}

@app.patch("/api/deliverables/{deliverable_id}/complete")
async def complete_deliverable(deliverable_id: str, db: Session = Depends(get_db)):
    deliverable = db.query(Deliverable).filter(Deliverable.id == deliverable_id).first()
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    
    deliverable.completed = True
    deliverable.completed_at = datetime.utcnow()
    db.commit()
    
    await log_activity(db, "deliverable_complete", task_id=deliverable.task_id, 
                       description=f"Deliverable completed: {deliverable.title}")
    await manager.broadcast({"type": "deliverable_complete", "data": {"id": deliverable_id, "task_id": deliverable.task_id}})
    
    return {"ok": True}

# Chat endpoints
@app.get("/api/chat")
def get_chat_messages(limit: int = 50, db: Session = Depends(get_db)):
    messages = db.query(ChatMessage).order_by(ChatMessage.created_at.desc()).limit(limit).all()
    result = []
    for m in reversed(messages):
        if m.agent:
            agent_info = {"id": m.agent.id, "name": m.agent.name, "avatar": m.agent.avatar}
        else:
            # Handle user messages or missing agents
            agent_info = {"id": m.agent_id, "name": "User" if m.agent_id == "user" else m.agent_id, "avatar": "👤" if m.agent_id == "user" else "🤖"}
        result.append({
            "id": m.id,
            "content": m.content,
            "agent_id": m.agent_id,
            "agent": agent_info,
            "created_at": m.created_at.isoformat()
        })
    return result

@app.post("/api/chat")
async def send_chat_message(message_data: ChatMessageCreate, db: Session = Depends(get_db)):
    message = ChatMessage(
        agent_id=message_data.agent_id,
        content=message_data.content
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    
    agent = db.query(Agent).filter(Agent.id == message_data.agent_id).first()
    # Fallback agent info if not found in database
    if agent:
        agent_info = {"id": agent.id, "name": agent.name, "avatar": agent.avatar}
    else:
        # Handle user messages or missing agents
        agent_info = {
            "id": message_data.agent_id,
            "name": "User" if message_data.agent_id == "user" else message_data.agent_id,
            "avatar": "👤" if message_data.agent_id == "user" else "🤖"
        }
    await manager.broadcast({
        "type": "chat_message",
        "data": {
            "id": message.id,
            "content": message.content,
            "agent_id": message.agent_id,
            "agent": agent_info,
            "created_at": message.created_at.isoformat()
        }
    })
    
    return {"id": message.id}


# ============ OpenClaw Agent Chat ============
import subprocess
import re
import requests

class SendToAgentRequest(BaseModel):
    agent_id: str
    message: str

def get_agent_info(agent_id: str, db: Session) -> dict:
    """Get agent info from OpenClaw config or fallback."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"

    # First try OpenClaw config
    if config_path.exists():
        try:
            with open(config_path) as f:
                config = json.load(f)
            agents_list = config.get("agents", {}).get("list", [])
            for agent in agents_list:
                if agent.get("id") == agent_id:
                    identity = agent.get("identity", {})
                    return {
                        "id": agent_id,
                        "name": identity.get("name") or agent.get("name") or agent_id,
                        "avatar": identity.get("emoji") or "🤖"
                    }
        except:
            pass

    # Fallback to database
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if agent:
        return {"id": agent.id, "name": agent.name, "avatar": agent.avatar}

    # Ultimate fallback
    return {"id": agent_id, "name": agent_id.title(), "avatar": "🤖"}

def get_agent_remote_config(agent_id: str) -> Optional[dict]:
    """Check if an agent is configured as remote (running on moltworker)."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"

    if not config_path.exists():
        return None

    try:
        with open(config_path) as f:
            config = json.load(f)
        agents_list = config.get("agents", {}).get("list", [])
        for agent in agents_list:
            if agent.get("id") == agent_id:
                remote = agent.get("remote")
                if remote and remote.get("api_url"):
                    return remote
        return None
    except:
        return None

def send_message_to_remote_agent(api_url: str, gateway_token: str, message: str, timeout: int = 120) -> str:
    """Send a message to a remote agent via HTTP API."""
    try:
        # Expand environment variables in gateway token
        if gateway_token.startswith("${") and gateway_token.endswith("}"):
            env_var = gateway_token[2:-1]
            gateway_token = os.environ.get(env_var, "")

        if not gateway_token:
            return "⚠️ Remote gateway token not configured"

        # Call the remote chat API
        url = f"{api_url.rstrip('/')}/api/chat/send"
        headers = {
            "Authorization": f"Bearer {gateway_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "message": message,
            "timeout_ms": timeout * 1000
        }

        print(f"Sending message to remote agent at {url}")
        response = requests.post(url, json=payload, headers=headers, timeout=timeout + 10)

        if response.status_code == 200:
            data = response.json()
            return data.get("response", "(No response)")
        elif response.status_code == 401:
            return "⚠️ Unauthorized - check MOLTBOT_GATEWAY_TOKEN"
        else:
            error = response.json().get("error", response.text)
            return f"⚠️ Remote error ({response.status_code}): {error}"

    except requests.Timeout:
        return f"⚠️ Remote agent timed out ({timeout}s limit)"
    except requests.ConnectionError:
        return "⚠️ Could not connect to remote agent"
    except Exception as e:
        return f"⚠️ Remote error: {str(e)}"

@app.post("/api/chat/send-to-agent")
async def send_to_agent(data: SendToAgentRequest, db: Session = Depends(get_db)):
    """Send a message to an OpenClaw agent and get the response.

    Supports both local agents (via openclaw CLI) and remote agents (via HTTP API).
    Remote agents are configured in openclaw.json with a 'remote' block containing
    api_url and gateway_token.
    """
    agent_id = data.agent_id
    message = data.message

    if not agent_id or not message:
        raise HTTPException(status_code=400, detail="agent_id and message are required")

    # First, save and broadcast the user's message
    user_message = ChatMessage(agent_id="user", content=message)
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    await manager.broadcast({
        "type": "chat_message",
        "data": {
            "id": user_message.id,
            "content": user_message.content,
            "agent_id": "user",
            "agent": {"id": "user", "name": "User", "avatar": "👤"},
            "created_at": user_message.created_at.isoformat()
        }
    })

    # Check if this is a remote agent
    remote_config = get_agent_remote_config(agent_id)

    if remote_config:
        # Send to remote agent via HTTP
        api_url = remote_config.get("api_url", "")
        gateway_token = remote_config.get("gateway_token", "")
        agent_response = send_message_to_remote_agent(api_url, gateway_token, message)
    else:
        # Call local OpenClaw CLI
        try:
            result = subprocess.run(
                [
                    "openclaw", "agent",
                    "--agent", agent_id,
                    "--message", message,
                    "--json"
                ],
                capture_output=True,
                text=True,
                timeout=120,  # 2 minute timeout for agent response
                cwd=str(Path.home())
            )

            if result.returncode == 0:
                # Parse JSON response from OpenClaw
                try:
                    response_data = json.loads(result.stdout)
                    # OpenClaw returns: { result: { payloads: [{ text: "..." }] } }
                    payloads = response_data.get("result", {}).get("payloads", [])
                    if payloads:
                        # Combine all text payloads
                        texts = [p.get("text", "") for p in payloads if p.get("text")]
                        agent_response = "\n".join(texts) if texts else "(No text in response)"
                    else:
                        # Fallback to other fields
                        agent_response = response_data.get("response", "") or response_data.get("content", "") or "(No response)"
                except json.JSONDecodeError:
                    # If not JSON, use raw output
                    agent_response = result.stdout.strip()

                if not agent_response:
                    agent_response = "(No response from agent)"
            else:
                # Handle error
                error_msg = result.stderr.strip() if result.stderr else "Unknown error"
                agent_response = f"⚠️ Agent error: {error_msg}"

        except subprocess.TimeoutExpired:
            agent_response = "⚠️ Agent response timed out (120s limit)"
        except FileNotFoundError:
            agent_response = "⚠️ OpenClaw CLI not found. Configure the agent as 'remote' in openclaw.json to use HTTP API instead."
        except Exception as e:
            agent_response = f"⚠️ Error: {str(e)}"

    # Log API usage for this interaction
    est_tokens_in = len(message.split()) * 2  # rough estimate
    est_tokens_out = len(agent_response.split()) * 2
    est_cost = (est_tokens_in * 0.000003) + (est_tokens_out * 0.000015)  # approximate Claude pricing
    usage_log = ApiUsageLog(
        model="claude-3-5-haiku",
        tokens_in=est_tokens_in,
        tokens_out=est_tokens_out,
        cost=f"{est_cost:.6f}",
        agent_id=agent_id,
    )
    db.add(usage_log)
    db.commit()

    # Get agent info for the response
    agent_info = get_agent_info(agent_id, db)

    # Save agent's response to chat
    agent_message = ChatMessage(agent_id=agent_id, content=agent_response)
    db.add(agent_message)
    db.commit()
    db.refresh(agent_message)

    # Broadcast agent's response
    await manager.broadcast({
        "type": "chat_message",
        "data": {
            "id": agent_message.id,
            "content": agent_message.content,
            "agent_id": agent_id,
            "agent": agent_info,
            "created_at": agent_message.created_at.isoformat()
        }
    })

    return {
        "ok": True,
        "user_message_id": user_message.id,
        "agent_message_id": agent_message.id,
        "response": agent_response
    }

# Announcement endpoints
@app.get("/api/announcements")
def get_announcements(limit: int = 10, db: Session = Depends(get_db)):
    announcements = db.query(Announcement).order_by(Announcement.created_at.desc()).limit(limit).all()
    return [
        {
            "id": a.id,
            "title": a.title,
            "message": a.message,
            "priority": a.priority.value,
            "created_at": a.created_at.isoformat()
        } for a in announcements
    ]

@app.post("/api/announcements")
async def create_announcement(announcement_data: AnnouncementCreate, db: Session = Depends(get_db)):
    announcement = Announcement(
        title=announcement_data.title,
        message=announcement_data.message,
        priority=Priority(announcement_data.priority)
    )
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    
    await log_activity(db, "announcement", description=f"📢 {announcement_data.message[:100]}")
    await manager.broadcast({
        "type": "announcement",
        "data": {
            "id": announcement.id,
            "title": announcement.title,
            "message": announcement.message,
            "priority": announcement.priority.value
        }
    })
    
    return {"id": announcement.id}

# Activity feed
@app.get("/api/activity")
def get_activity(limit: int = 50, db: Session = Depends(get_db)):
    activities = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit).all()
    result = []
    for a in activities:
        agent = None
        if a.agent_id:
            agent_obj = db.query(Agent).filter(Agent.id == a.agent_id).first()
            if agent_obj:
                agent = {"id": agent_obj.id, "name": agent_obj.name, "avatar": agent_obj.avatar}
        
        result.append({
            "id": a.id,
            "activity_type": a.activity_type,
            "agent": agent,
            "task_id": a.task_id,
            "description": a.description,
            "created_at": a.created_at.isoformat()
        })
    return result

# Stats endpoint
@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    agents_active = db.query(Agent).filter(Agent.status == AgentStatus.WORKING).count()
    tasks_in_queue = db.query(Task).filter(Task.status != TaskStatus.DONE).count()
    
    return {
        "agents_active": agents_active,
        "tasks_in_queue": tasks_in_queue,
        "tasks_by_status": {
            "INBOX": db.query(Task).filter(Task.status == TaskStatus.INBOX).count(),
            "ASSIGNED": db.query(Task).filter(Task.status == TaskStatus.ASSIGNED).count(),
            "IN_PROGRESS": db.query(Task).filter(Task.status == TaskStatus.IN_PROGRESS).count(),
            "REVIEW": db.query(Task).filter(Task.status == TaskStatus.REVIEW).count(),
            "DONE": db.query(Task).filter(Task.status == TaskStatus.DONE).count(),
        }
    }

# ============ Recurring Tasks ============
# Helper to calculate next run time
def calculate_next_run(schedule_type: str, schedule_value: str, schedule_time: str) -> datetime:
    """Calculate the next run time based on schedule configuration."""
    now = datetime.utcnow()
    
    if schedule_type == "daily":
        # Parse HH:MM time
        if schedule_time:
            hour, minute = map(int, schedule_time.split(':'))
            next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if next_run <= now:
                next_run = next_run + timedelta(days=1)
            return next_run
        return now + timedelta(days=1)
    
    elif schedule_type == "weekly":
        # schedule_value contains comma-separated day numbers (0=Mon, 6=Sun)
        if schedule_value and schedule_time:
            days = [int(d.strip()) for d in schedule_value.split(',')]
            hour, minute = map(int, schedule_time.split(':'))
            
            # Find the next day that matches
            for i in range(7):
                check_date = now + timedelta(days=i)
                if check_date.weekday() in days:
                    next_run = check_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
                    if next_run > now:
                        return next_run
            # Default to next week same day
            return now + timedelta(days=7)
        return now + timedelta(days=7)
    
    elif schedule_type == "hourly":
        # schedule_value contains the interval in hours
        hours = int(schedule_value) if schedule_value else 1
        return now + timedelta(hours=hours)
    
    elif schedule_type == "cron":
        # Parse simple cron expressions: "minute hour * * *"
        if schedule_value:
            parts = schedule_value.strip().split()
            if len(parts) >= 2:
                try:
                    minute = int(parts[0])
                    hour = int(parts[1])
                    # Check if day-of-month, month, day-of-week are all wildcards
                    if all(p == '*' for p in parts[2:5] if p):
                        next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
                        if next_run <= now:
                            next_run = next_run + timedelta(days=1)
                        return next_run
                except (ValueError, IndexError):
                    pass
        return now + timedelta(days=1)

    return now + timedelta(days=1)

# Import timedelta for schedule calculations
from datetime import timedelta

def format_schedule_human(schedule_type: str, schedule_value: str, schedule_time: str) -> str:
    """Format schedule as human-readable string."""
    if schedule_type == "daily":
        time_str = schedule_time if schedule_time else "00:00"
        return f"Every day at {time_str}"
    
    elif schedule_type == "weekly":
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        if schedule_value:
            days = [int(d.strip()) for d in schedule_value.split(',')]
            day_list = ", ".join([day_names[d] for d in days if 0 <= d <= 6])
            time_str = schedule_time if schedule_time else "00:00"
            return f"Weekly on {day_list} at {time_str}"
        return "Weekly"
    
    elif schedule_type == "hourly":
        hours = int(schedule_value) if schedule_value else 1
        if hours == 1:
            return "Every hour"
        return f"Every {hours} hours"
    
    elif schedule_type == "cron":
        if schedule_value:
            parts = schedule_value.strip().split()
            if len(parts) >= 2:
                try:
                    minute = int(parts[0])
                    hour = int(parts[1])
                    if all(p == '*' for p in parts[2:5] if p):
                        # Daily cron - format as human-readable time
                        period = "AM" if hour < 12 else "PM"
                        display_hour = hour % 12 or 12
                        # Check for timezone info stored in schedule_time field
                        tz_label = "UTC"
                        if schedule_time and schedule_time.startswith("tz:"):
                            tz_name = schedule_time[3:]
                            tz_abbrevs = {
                                "America/Los_Angeles": "PST",
                                "America/New_York": "EST",
                                "America/Chicago": "CST",
                                "America/Denver": "MST",
                                "Europe/London": "GMT",
                            }
                            tz_label = tz_abbrevs.get(tz_name, tz_name)
                        return f"Daily at {display_hour}:{minute:02d} {period} {tz_label}"
                except (ValueError, IndexError):
                    pass
        return f"Cron: {schedule_value}"

    return schedule_type

@app.get("/api/openclaw/crons")
def fetch_openclaw_crons():
    """Fetch cron jobs from all remote OpenClaw agents via the /api/chat/crons endpoint."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"

    if not config_path.exists():
        return []

    try:
        with open(config_path) as f:
            config = json.load(f)
    except Exception:
        return []

    results = []
    agents_list = config.get("agents", {}).get("list", [])
    for agent in agents_list:
        remote = agent.get("remote")
        if not remote or not remote.get("api_url"):
            continue

        agent_id = agent.get("id", "unknown")
        agent_name = agent.get("identity", {}).get("name", agent_id)
        api_url = remote["api_url"]
        gateway_token = remote.get("gateway_token", "")

        # Expand env var tokens
        if gateway_token.startswith("${") and gateway_token.endswith("}"):
            env_var = gateway_token[2:-1]
            gateway_token = os.environ.get(env_var, "")

        if not gateway_token:
            continue

        try:
            url = f"{api_url.rstrip('/')}/api/chat/crons"
            headers = {"Authorization": f"Bearer {gateway_token}"}
            resp = requests.get(url, headers=headers, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                jobs = data.get("jobs", [])
                for job in jobs:
                    # Skip disabled one-time ("at") jobs
                    schedule = job.get("schedule", {})
                    if schedule.get("kind") == "at" and not job.get("enabled", False):
                        continue

                    results.append({
                        "id": job.get("id"),
                        "name": job.get("name", "Untitled cron"),
                        "enabled": job.get("enabled", False),
                        "schedule_kind": schedule.get("kind"),
                        "schedule_expr": schedule.get("expr", ""),
                        "schedule_tz": schedule.get("tz"),
                        "schedule_at": schedule.get("at"),
                        "message": job.get("payload", {}).get("message", ""),
                        "state": job.get("state", {}),
                        "agent_id": agent_id,
                        "agent_name": agent_name,
                        "source": "openclaw",
                    })
        except Exception as e:
            print(f"Failed to fetch crons from {agent_name}: {e}")

    return results


@app.post("/api/openclaw/crons/sync")
def sync_openclaw_crons(db: Session = Depends(get_db)):
    """Fetch crons from remote OpenClaw agents and sync them into the recurring tasks table."""
    crons = fetch_openclaw_crons()
    synced = []

    for cron in crons:
        title = cron.get("name", "Untitled cron")
        openclaw_job_id = cron.get("id", "")
        state = cron.get("state", {})
        schedule_kind = cron.get("schedule_kind", "")
        schedule_expr = cron.get("schedule_expr", "")
        schedule_tz = cron.get("schedule_tz")

        # Match existing by openclaw job ID stored in tags, then fall back to title
        existing = None
        if openclaw_job_id:
            all_openclaw = db.query(RecurringTask).filter(RecurringTask.tags.like('%openclaw%')).all()
            for rt in all_openclaw:
                try:
                    tags = json.loads(rt.tags) if rt.tags else []
                    if f"ocid:{openclaw_job_id}" in tags:
                        existing = rt
                        break
                except (json.JSONDecodeError, TypeError):
                    pass

        if not existing:
            existing = db.query(RecurringTask).filter(RecurringTask.title == title).first()

        # Parse next/last run from openclaw state
        next_run_at = None
        last_run_at = None
        if state.get("nextRunAtMs"):
            next_run_at = datetime.utcfromtimestamp(state["nextRunAtMs"] / 1000)
        if state.get("lastRunAtMs"):
            last_run_at = datetime.utcfromtimestamp(state["lastRunAtMs"] / 1000)

        # Build schedule_time: store timezone info for format_schedule_human
        schedule_time_str = None
        if schedule_expr:
            parts = schedule_expr.split()
            if len(parts) >= 2:
                try:
                    schedule_time_str = f"{int(parts[1]):02d}:{int(parts[0]):02d}"
                except ValueError:
                    pass
        if schedule_tz:
            schedule_time_str = f"tz:{schedule_tz}"

        if existing:
            # Update fields from source
            existing.is_active = cron.get("enabled", True)
            existing.description = cron.get("message", "") or existing.description
            if next_run_at:
                existing.next_run_at = next_run_at
            if last_run_at:
                existing.last_run_at = last_run_at
            if schedule_expr:
                existing.schedule_value = schedule_expr
            if schedule_time_str:
                existing.schedule_time = schedule_time_str
            # Ensure openclaw job ID is in tags
            try:
                tags = json.loads(existing.tags) if existing.tags else []
            except (json.JSONDecodeError, TypeError):
                tags = []
            tag_id = f"ocid:{openclaw_job_id}"
            if openclaw_job_id and tag_id not in tags:
                tags.append(tag_id)
                existing.tags = json.dumps(tags)
            db.commit()
            synced.append({"id": existing.id, "title": title, "action": "updated"})
            continue

        # Calculate next_run if not provided by openclaw state
        if not next_run_at:
            next_run_at = calculate_next_run("cron", schedule_expr, schedule_time_str)

        tags = ["openclaw", cron.get("agent_name", "agent")]
        if openclaw_job_id:
            tags.append(f"ocid:{openclaw_job_id}")

        new_rt = RecurringTask(
            title=title,
            description=cron.get("message", ""),
            priority=Priority.NORMAL,
            tags=json.dumps(tags),
            assignee_id=cron.get("agent_id"),
            schedule_type="cron",
            schedule_value=schedule_expr,
            schedule_time=schedule_time_str,
            is_active=cron.get("enabled", True),
            next_run_at=next_run_at,
            last_run_at=last_run_at,
            run_count=0
        )
        db.add(new_rt)
        db.commit()
        db.refresh(new_rt)
        synced.append({"id": new_rt.id, "title": title, "action": "created"})

    # Push back to openclaw in background thread so sync response returns quickly
    import threading
    def _bg_push():
        try:
            bg_db = SessionLocal()
            push_cron_to_openclaw(bg_db)
            bg_db.close()
        except Exception as e:
            print(f"Background push error: {e}")
    threading.Thread(target=_bg_push, daemon=True).start()

    return {"synced": synced, "total": len(synced)}


def _push_to_single_agent(api_url: str, gateway_token: str, agent_id: str, local_tasks, db: Session, deleted_ocids: set = None):
    """Push local openclaw tasks to a single remote agent's jobs.json.

    Read-modify-write: fetches current remote jobs, merges local changes, writes back.
    Preserves all fields ClawControllerV2 doesn't manage (sessionTarget, wakeMode, delivery, state, agentId).
    """
    if deleted_ocids is None:
        deleted_ocids = set()
    base_url = api_url.rstrip('/')
    headers = {"Authorization": f"Bearer {gateway_token}"}

    # 1. Read current remote jobs
    try:
        resp = requests.get(f"{base_url}/api/chat/crons", headers=headers, timeout=15)
        if resp.status_code != 200:
            print(f"Push: failed to read remote crons from {api_url}: HTTP {resp.status_code}")
            return
        remote_data = resp.json()
    except Exception as e:
        print(f"Push: failed to fetch remote crons from {api_url}: {e}")
        return

    remote_jobs = remote_data.get("jobs", [])
    version = remote_data.get("version", 1)

    # Build lookup: ocid -> local task
    local_by_ocid = {}
    for rt in local_tasks:
        try:
            tags = json.loads(rt.tags) if rt.tags else []
        except (json.JSONDecodeError, TypeError):
            tags = []
        for tag in tags:
            if tag.startswith("ocid:"):
                local_by_ocid[tag[5:]] = rt
                break

    # 2. Modify: update/remove remote jobs based on local state
    updated_jobs = []
    matched_ocids = set()

    for job in remote_jobs:
        job_id = job.get("id", "")
        local_rt = local_by_ocid.get(job_id)

        if job_id in deleted_ocids:
            # Explicitly deleted locally — remove from remote
            continue
        elif local_rt:
            # Matched - update fields from local
            matched_ocids.add(job_id)
            job["name"] = local_rt.title
            job["enabled"] = local_rt.is_active
            if local_rt.schedule_value:
                job.setdefault("schedule", {})["expr"] = local_rt.schedule_value
            if local_rt.schedule_time and local_rt.schedule_time.startswith("tz:"):
                job.setdefault("schedule", {})["tz"] = local_rt.schedule_time[3:]
            if local_rt.description:
                job.setdefault("payload", {})["message"] = local_rt.description
            job["updatedAtMs"] = int(time.time() * 1000)
            updated_jobs.append(job)
        else:
            # Not matched locally and not explicitly deleted — keep it (new remote job)
            updated_jobs.append(job)

    # 3. Re-create remote jobs for any local openclaw tasks not matched above
    #    This covers both tasks with existing ocids (missing from remote) and
    #    new tasks without ocids yet.
    for rt in local_tasks:
        try:
            tags = json.loads(rt.tags) if rt.tags else []
        except (json.JSONDecodeError, TypeError):
            tags = []

        if "openclaw" not in tags:
            continue

        # Check if this task was already matched to a remote job
        existing_ocid = None
        for tag in tags:
            if tag.startswith("ocid:"):
                existing_ocid = tag[5:]
                break

        if existing_ocid and existing_ocid in matched_ocids:
            continue  # Already updated above

        # Use existing ocid or generate a new one
        job_id = existing_ocid or str(uuid.uuid4())[:8]

        schedule_obj = {
            "kind": "cron",
            "expr": rt.schedule_value or "0 9 * * *",
        }
        if rt.schedule_time and rt.schedule_time.startswith("tz:"):
            schedule_obj["tz"] = rt.schedule_time[3:]

        new_job = {
            "id": job_id,
            "name": rt.title,
            "enabled": rt.is_active,
            "schedule": schedule_obj,
            "payload": {
                "message": rt.description or rt.title,
            },
            "sessionTarget": "isolated",
            "wakeMode": "next-heartbeat",
            "delivery": {"mode": "announce"},
            "createdAtMs": int(time.time() * 1000),
            "updatedAtMs": int(time.time() * 1000),
        }
        updated_jobs.append(new_job)

        # Tag the local task with the ocid if it didn't have one
        if not existing_ocid:
            tags.append(f"ocid:{job_id}")
            rt.tags = json.dumps(tags)
            db.commit()

    # 4. Write back to remote
    put_body = {"version": version, "jobs": updated_jobs}
    try:
        resp = requests.put(
            f"{base_url}/api/chat/crons",
            headers={**headers, "Content-Type": "application/json"},
            json=put_body,
            timeout=15,
        )
        if resp.status_code == 200:
            print(f"Push: wrote {len(updated_jobs)} jobs to {api_url}")
        else:
            print(f"Push: PUT failed for {api_url}: HTTP {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        print(f"Push: failed to write crons to {api_url}: {e}")


def push_cron_to_openclaw(db: Session, deleted_ocids: set = None):
    """Push local openclaw recurring tasks to all configured remote agents.

    deleted_ocids: set of openclaw job IDs that were just deleted locally
                   and should be explicitly removed from remote.
    """
    if deleted_ocids is None:
        deleted_ocids = set()

    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"

    if not config_path.exists():
        return

    try:
        with open(config_path) as f:
            config = json.load(f)
    except Exception:
        return

    # Gather all local recurring tasks with openclaw tags
    all_openclaw_tasks = db.query(RecurringTask).filter(RecurringTask.tags.like('%openclaw%')).all()

    # Still push even if no local tasks remain — we may need to delete remote jobs
    if not all_openclaw_tasks and not deleted_ocids:
        return

    agents_list = config.get("agents", {}).get("list", [])
    for agent in agents_list:
        remote = agent.get("remote")
        if not remote or not remote.get("api_url"):
            continue

        agent_id = agent.get("id", "unknown")
        api_url = remote["api_url"]
        gateway_token = remote.get("gateway_token", "")

        # Expand env var tokens
        if gateway_token.startswith("${") and gateway_token.endswith("}"):
            env_var = gateway_token[2:-1]
            gateway_token = os.environ.get(env_var, "")

        if not gateway_token:
            continue

        # Filter tasks for this agent (by agent_id in tags or assignee)
        agent_tasks = []
        for rt in all_openclaw_tasks:
            try:
                tags = json.loads(rt.tags) if rt.tags else []
            except (json.JSONDecodeError, TypeError):
                tags = []
            # Include if assigned to this agent or has agent name in tags
            agent_name = agent.get("identity", {}).get("name", agent_id)
            if rt.assignee_id == agent_id or agent_name in tags or agent_id in tags:
                agent_tasks.append(rt)
            elif not rt.assignee_id and len(agents_list) == 1:
                # Single agent setup: push all openclaw tasks
                agent_tasks.append(rt)

        if agent_tasks or deleted_ocids:
            _push_to_single_agent(api_url, gateway_token, agent_id, agent_tasks, db, deleted_ocids)


@app.get("/api/recurring")
def list_recurring_tasks(db: Session = Depends(get_db)):
    """List all recurring tasks."""
    recurring_tasks = db.query(RecurringTask).order_by(RecurringTask.created_at.desc()).all()
    
    result = []
    for rt in recurring_tasks:
        result.append({
            "id": rt.id,
            "title": rt.title,
            "description": rt.description,
            "priority": rt.priority.value,
            "tags": json.loads(rt.tags) if rt.tags else [],
            "assignee_id": rt.assignee_id,
            "schedule_type": rt.schedule_type,
            "schedule_value": rt.schedule_value,
            "schedule_time": rt.schedule_time,
            "schedule_human": format_schedule_human(rt.schedule_type, rt.schedule_value, rt.schedule_time),
            "is_active": rt.is_active,
            "last_run_at": rt.last_run_at.isoformat() if rt.last_run_at else None,
            "next_run_at": rt.next_run_at.isoformat() if rt.next_run_at else None,
            "run_count": rt.run_count,
            "created_at": rt.created_at.isoformat()
        })
    return result

@app.post("/api/recurring")
async def create_recurring_task(task_data: RecurringTaskCreate, db: Session = Depends(get_db)):
    """Create a new recurring task."""
    next_run = calculate_next_run(
        task_data.schedule_type,
        task_data.schedule_value,
        task_data.schedule_time
    )
    
    recurring_task = RecurringTask(
        title=task_data.title,
        description=task_data.description,
        priority=Priority(task_data.priority.upper()) if task_data.priority else Priority.NORMAL,
        tags=json.dumps(task_data.tags) if task_data.tags else "[]",
        assignee_id=task_data.assignee_id,
        schedule_type=task_data.schedule_type,
        schedule_value=task_data.schedule_value,
        schedule_time=task_data.schedule_time,
        next_run_at=next_run
    )
    db.add(recurring_task)
    db.commit()
    db.refresh(recurring_task)
    
    # Note: Not logging to activity feed - recurring task management stays in its own panel
    await manager.broadcast({
        "type": "recurring_created",
        "data": {"id": recurring_task.id, "title": recurring_task.title}
    })
    
    # NOTE: This is where OpenClaw cron integration would hook in.
    # The cron job would check for recurring tasks with next_run_at <= now
    # and spawn new task instances.
    
    return {
        "id": recurring_task.id,
        "title": recurring_task.title,
        "next_run_at": recurring_task.next_run_at.isoformat()
    }

@app.get("/api/recurring/{recurring_id}")
def get_recurring_task(recurring_id: str, db: Session = Depends(get_db)):
    """Get a recurring task by ID."""
    rt = db.query(RecurringTask).filter(RecurringTask.id == recurring_id).first()
    if not rt:
        raise HTTPException(status_code=404, detail="Recurring task not found")
    
    return {
        "id": rt.id,
        "title": rt.title,
        "description": rt.description,
        "priority": rt.priority.value,
        "tags": json.loads(rt.tags) if rt.tags else [],
        "assignee_id": rt.assignee_id,
        "schedule_type": rt.schedule_type,
        "schedule_value": rt.schedule_value,
        "schedule_time": rt.schedule_time,
        "schedule_human": format_schedule_human(rt.schedule_type, rt.schedule_value, rt.schedule_time),
        "is_active": rt.is_active,
        "last_run_at": rt.last_run_at.isoformat() if rt.last_run_at else None,
        "next_run_at": rt.next_run_at.isoformat() if rt.next_run_at else None,
        "run_count": rt.run_count,
        "created_at": rt.created_at.isoformat()
    }

@app.patch("/api/recurring/{recurring_id}")
async def update_recurring_task(recurring_id: str, task_data: RecurringTaskUpdate, db: Session = Depends(get_db)):
    """Update a recurring task (pause/resume/edit)."""
    rt = db.query(RecurringTask).filter(RecurringTask.id == recurring_id).first()
    if not rt:
        raise HTTPException(status_code=404, detail="Recurring task not found")
    
    if task_data.title is not None:
        rt.title = task_data.title
    if task_data.description is not None:
        rt.description = task_data.description
    if task_data.priority is not None:
        rt.priority = Priority(task_data.priority.upper())
    if task_data.tags is not None:
        rt.tags = json.dumps(task_data.tags)
    if task_data.assignee_id is not None:
        rt.assignee_id = task_data.assignee_id if task_data.assignee_id != "" else None
    if task_data.schedule_type is not None:
        rt.schedule_type = task_data.schedule_type
    if task_data.schedule_value is not None:
        rt.schedule_value = task_data.schedule_value
    if task_data.schedule_time is not None:
        rt.schedule_time = task_data.schedule_time
    if task_data.is_active is not None:
        rt.is_active = task_data.is_active
        
        # When pausing, remove incomplete spawned tasks from the board
        if not task_data.is_active:
            # Find all tasks spawned from this recurring task that aren't complete
            runs = db.query(RecurringTaskRun).filter(
                RecurringTaskRun.recurring_task_id == recurring_id
            ).all()
            
            deleted_task_ids = []
            for run in runs:
                if run.task_id:
                    task = db.query(Task).filter(Task.id == run.task_id).first()
                    if task and task.status not in [TaskStatus.COMPLETE]:
                        deleted_task_ids.append(task.id)
                        db.delete(task)
            
            # Also delete the run records for deleted tasks
            for task_id in deleted_task_ids:
                db.query(RecurringTaskRun).filter(
                    RecurringTaskRun.task_id == task_id
                ).delete()
            
            # Broadcast task deletions
            for task_id in deleted_task_ids:
                await manager.broadcast({"type": "task_deleted", "data": {"id": task_id}})
    
    # Recalculate next run if schedule changed
    if any([task_data.schedule_type, task_data.schedule_value, task_data.schedule_time]):
        rt.next_run_at = calculate_next_run(
            rt.schedule_type,
            rt.schedule_value,
            rt.schedule_time
        )
    
    db.commit()
    await manager.broadcast({"type": "recurring_updated", "data": {"id": recurring_id}})

    # Push to openclaw if this task has openclaw tags
    try:
        tags = json.loads(rt.tags) if rt.tags else []
    except (json.JSONDecodeError, TypeError):
        tags = []
    if "openclaw" in tags or any(t.startswith("ocid:") for t in tags):
        push_cron_to_openclaw(db)

    return {"ok": True}

@app.delete("/api/recurring/{recurring_id}")
async def delete_recurring_task(recurring_id: str, db: Session = Depends(get_db)):
    """Delete a recurring task and all its incomplete spawned tasks."""
    rt = db.query(RecurringTask).filter(RecurringTask.id == recurring_id).first()
    if not rt:
        raise HTTPException(status_code=404, detail="Recurring task not found")

    # Capture tags and ocid before delete for push
    try:
        rt_tags = json.loads(rt.tags) if rt.tags else []
    except (json.JSONDecodeError, TypeError):
        rt_tags = []
    has_openclaw = "openclaw" in rt_tags or any(t.startswith("ocid:") for t in rt_tags)
    deleted_ocids = {t[5:] for t in rt_tags if t.startswith("ocid:")}

    # Find and delete all incomplete tasks spawned from this recurring task
    runs = db.query(RecurringTaskRun).filter(
        RecurringTaskRun.recurring_task_id == recurring_id
    ).all()

    deleted_task_ids = []
    for run in runs:
        if run.task_id:
            task = db.query(Task).filter(Task.id == run.task_id).first()
            if task and task.status not in [TaskStatus.COMPLETE]:
                deleted_task_ids.append(task.id)
                db.delete(task)

    # Delete all run records
    db.query(RecurringTaskRun).filter(
        RecurringTaskRun.recurring_task_id == recurring_id
    ).delete()

    db.delete(rt)
    db.commit()

    # Push to openclaw after delete — pass deleted ocids so remote jobs are removed
    if has_openclaw:
        push_cron_to_openclaw(db, deleted_ocids=deleted_ocids)

    # Broadcast deletions
    for task_id in deleted_task_ids:
        await manager.broadcast({"type": "task_deleted", "data": {"id": task_id}})
    await manager.broadcast({"type": "recurring_deleted", "data": {"id": recurring_id}})

    return {"ok": True}

@app.get("/api/recurring/{recurring_id}/runs")
def get_recurring_task_runs(recurring_id: str, limit: int = 20, db: Session = Depends(get_db)):
    """Get run history for a recurring task."""
    rt = db.query(RecurringTask).filter(RecurringTask.id == recurring_id).first()
    if not rt:
        raise HTTPException(status_code=404, detail="Recurring task not found")
    
    runs = db.query(RecurringTaskRun).filter(
        RecurringTaskRun.recurring_task_id == recurring_id
    ).order_by(RecurringTaskRun.run_at.desc()).limit(limit).all()
    
    result = []
    for run in runs:
        task = None
        if run.task_id:
            task_obj = db.query(Task).filter(Task.id == run.task_id).first()
            if task_obj:
                task = {
                    "id": task_obj.id,
                    "title": task_obj.title,
                    "status": task_obj.status.value
                }
        
        result.append({
            "id": run.id,
            "run_at": run.run_at.isoformat(),
            "status": run.status,
            "task": task
        })
    
    return result

@app.post("/api/recurring/{recurring_id}/trigger")
async def trigger_recurring_task(recurring_id: str, db: Session = Depends(get_db)):
    """Manually trigger a recurring task run (for testing)."""
    rt = db.query(RecurringTask).filter(RecurringTask.id == recurring_id).first()
    if not rt:
        raise HTTPException(status_code=404, detail="Recurring task not found")
    
    # Create a new task from the recurring task template
    task = Task(
        title=f"{rt.title}",
        description=rt.description,
        priority=rt.priority,
        tags=rt.tags,
        assignee_id=rt.assignee_id,
        status=TaskStatus.ASSIGNED if rt.assignee_id else TaskStatus.INBOX
    )
    db.add(task)
    db.flush()  # Get the task ID
    
    # Record the run
    run = RecurringTaskRun(
        recurring_task_id=recurring_id,
        task_id=task.id,
        status="success"
    )
    db.add(run)
    
    # Update the recurring task
    rt.last_run_at = datetime.utcnow()
    rt.run_count += 1
    rt.next_run_at = calculate_next_run(rt.schedule_type, rt.schedule_value, rt.schedule_time)
    
    db.commit()
    
    # Note: Only broadcasting, not logging to activity feed - the task creation itself is the activity
    await manager.broadcast({"type": "task_created", "data": {"id": task.id, "title": task.title}})
    await manager.broadcast({"type": "recurring_run", "data": {"id": recurring_id, "task_id": task.id}})
    
    return {
        "ok": True,
        "task_id": task.id,
        "run_at": run.run_at.isoformat()
    }

# ============ Agent Management ============

# Available models
AVAILABLE_MODELS = [
    {"id": "anthropic/claude-opus-4-5", "alias": "opus", "description": "Most capable, complex tasks"},
    {"id": "anthropic/claude-sonnet-4", "alias": "sonnet", "description": "Balanced, good for writing"},
    {"id": "anthropic/claude-3-5-haiku-latest", "alias": "haiku", "description": "Fast, cost-efficient"},
    {"id": "openai-codex/gpt-5.2", "alias": "codex", "description": "Specialized for coding"}
]

@app.get("/api/models")
def get_models():
    """Return list of available models."""
    return AVAILABLE_MODELS


class GenerateAgentRequest(BaseModel):
    description: str

class GeneratedAgentConfig(BaseModel):
    id: str
    name: str
    emoji: str
    model: str
    soul: str
    tools: str
    agentsMd: str

@app.post("/api/agents/generate", response_model=GeneratedAgentConfig)
def generate_agent_config(request: GenerateAgentRequest):
    """AI-generate agent config from description (mock implementation)."""
    desc = request.description.lower()
    
    # Determine agent type based on keywords
    if any(kw in desc for kw in ["code", "develop", "program", "software", "debug", "engineer"]):
        return GeneratedAgentConfig(
            id="dev-agent",
            name="Dev Agent",
            emoji="👨‍💻",
            model="openai-codex/gpt-5.2",
            soul="""# Dev Agent

You are a skilled software developer AI assistant.

## Core Competencies
- Writing clean, maintainable code
- Debugging and troubleshooting
- Code review and optimization
- Following best practices and design patterns

## Behavior
- Always explain your reasoning
- Write tests for critical code
- Document complex logic
- Ask clarifying questions when requirements are unclear
""",
            tools="""# TOOLS.md

## Available Tools
- Code editor and file system access
- Git operations
- Package managers (npm, pip, etc.)
- Terminal/shell commands

## Preferences
- Use TypeScript over JavaScript when possible
- Follow project conventions
- Commit often with clear messages
""",
            agentsMd="""# AGENTS.md

Standard workspace configuration for development tasks.
Follow the guidance in SOUL.md for coding style and practices.
"""
        )
    
    elif any(kw in desc for kw in ["trade", "market", "stock", "crypto", "finance", "invest"]):
        return GeneratedAgentConfig(
            id="trader-agent",
            name="Trader Agent",
            emoji="📈",
            model="anthropic/claude-sonnet-4",
            soul="""# Trader Agent

You are a financial analysis and trading assistant.

## Core Competencies
- Market analysis and research
- Risk assessment
- Portfolio management advice
- News and sentiment analysis

## Behavior
- Always consider risk management
- Provide data-driven insights
- Never guarantee returns
- Explain your analysis methodology
""",
            tools="""# TOOLS.md

## Available Tools
- Market data APIs
- News aggregation
- Charting and analysis tools
- Portfolio tracking

## Important Notes
- All trading decisions are advisory only
- Always emphasize risk warnings
""",
            agentsMd="""# AGENTS.md

Standard workspace for trading and market analysis tasks.
"""
        )
    
    elif any(kw in desc for kw in ["sales", "lead", "outreach", "customer", "crm"]):
        return GeneratedAgentConfig(
            id="sales-agent",
            name="Sales Agent",
            emoji="🤝",
            model="anthropic/claude-sonnet-4",
            soul="""# Sales Agent

You are a sales and customer relations assistant.

## Core Competencies
- Lead qualification and research
- Outreach message crafting
- CRM management
- Follow-up scheduling

## Behavior
- Be professional but personable
- Research prospects before outreach
- Track all interactions
- Focus on value proposition
""",
            tools="""# TOOLS.md

## Available Tools
- CRM integration
- Email drafting
- LinkedIn research
- Calendar management
""",
            agentsMd="""# AGENTS.md

Standard workspace for sales and lead generation tasks.
"""
        )
    
    elif any(kw in desc for kw in ["write", "content", "blog", "article", "copy"]):
        return GeneratedAgentConfig(
            id="writer-agent",
            name="Writer Agent",
            emoji="✍️",
            model="anthropic/claude-sonnet-4",
            soul="""# Writer Agent

You are a creative writing and content assistant.

## Core Competencies
- Blog posts and articles
- Marketing copy
- Technical documentation
- Editing and proofreading

## Behavior
- Adapt tone to audience
- Research topics thoroughly
- Use clear, engaging language
- Follow style guides when provided
""",
            tools="""# TOOLS.md

## Available Tools
- Research and web search
- Document editing
- SEO optimization tools
- Grammar checking
""",
            agentsMd="""# AGENTS.md

Standard workspace for content creation tasks.
"""
        )
    
    elif any(kw in desc for kw in ["research", "analyze", "investigate", "study"]):
        return GeneratedAgentConfig(
            id="research-agent",
            name="Research Agent",
            emoji="🔍",
            model="anthropic/claude-opus-4-5",
            soul="""# Research Agent

You are a thorough research and analysis assistant.

## Core Competencies
- Deep research and investigation
- Data synthesis and analysis
- Report generation
- Source verification

## Behavior
- Always cite sources
- Present balanced perspectives
- Identify knowledge gaps
- Structure findings clearly
""",
            tools="""# TOOLS.md

## Available Tools
- Web search and browsing
- Document analysis
- Data visualization
- Note-taking systems
""",
            agentsMd="""# AGENTS.md

Standard workspace for research tasks.
"""
        )
    
    else:
        # Generic assistant
        agent_id = desc.split()[0].lower().replace(" ", "-")[:20] + "-agent"
        return GeneratedAgentConfig(
            id=agent_id,
            name="Assistant Agent",
            emoji="🤖",
            model="anthropic/claude-sonnet-4",
            soul=f"""# Assistant Agent

You are a helpful AI assistant based on: {request.description}

## Core Competencies
- Task completion and follow-through
- Clear communication
- Problem solving
- Proactive assistance

## Behavior
- Be helpful and thorough
- Ask for clarification when needed
- Provide structured responses
- Track progress on tasks
""",
            tools="""# TOOLS.md

## Available Tools
- General purpose tools
- File system access
- Web search
- Communication tools
""",
            agentsMd="""# AGENTS.md

Standard workspace configuration.
Read SOUL.md for personality and behavior guidelines.
"""
        )


class CreateAgentRequest(BaseModel):
    id: str
    name: str
    emoji: str
    model: str
    soul: str
    tools: str
    agentsMd: str
    discordChannelId: Optional[str] = None

@app.post("/api/agents")
def create_agent(request: CreateAgentRequest):
    """Create a new agent - creates workspace and patches openclaw.json."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"
    workspace_path = home / ".openclaw" / f"workspace-{request.id}"
    
    # Read existing config
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="OpenClaw config not found")
    
    try:
        with open(config_path) as f:
            config = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read config: {str(e)}")
    
    # Check if agent ID already exists
    agents_config = config.get("agents", {"list": []})
    agent_list = agents_config.get("list", [])
    
    if any(a.get("id") == request.id for a in agent_list):
        raise HTTPException(status_code=400, detail=f"Agent with id '{request.id}' already exists")
    
    # Create workspace directory
    workspace_path.mkdir(parents=True, exist_ok=True)
    
    # Write SOUL.md
    (workspace_path / "SOUL.md").write_text(request.soul)
    
    # Write TOOLS.md
    (workspace_path / "TOOLS.md").write_text(request.tools)
    
    # Write AGENTS.md
    (workspace_path / "AGENTS.md").write_text(request.agentsMd)
    
    # Create new agent config entry
    new_agent = {
        "id": request.id,
        "name": request.name,
        "workspace": str(workspace_path),
        "model": {"primary": request.model},
        "identity": {"name": request.name, "emoji": request.emoji}
    }
    
    # Add discord channel if provided
    if request.discordChannelId:
        new_agent["discord"] = {"channelId": request.discordChannelId}
    
    # Add to config
    agent_list.append(new_agent)
    agents_config["list"] = agent_list
    config["agents"] = agents_config
    
    # Write updated config
    try:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write config: {str(e)}")
    
    return {
        "ok": True,
        "agent": new_agent,
        "workspace": str(workspace_path)
    }


class AgentFilesResponse(BaseModel):
    soul: str
    tools: str
    agentsMd: str

@app.get("/api/agents/{agent_id}/files", response_model=AgentFilesResponse)
def get_agent_files(agent_id: str):
    """Get agent workspace files (SOUL.md, AGENTS.md, TOOLS.md)."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"
    
    # Read config to get workspace path
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="OpenClaw config not found")
    
    try:
        with open(config_path) as f:
            config = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read config: {str(e)}")
    
    # Find agent
    agent_list = config.get("agents", {}).get("list", [])
    agent = next((a for a in agent_list if a.get("id") == agent_id), None)
    
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    
    workspace = Path(agent.get("workspace", home / ".openclaw" / f"workspace-{agent_id}"))
    
    if not workspace.exists():
        raise HTTPException(status_code=404, detail=f"Workspace not found: {workspace}")
    
    # Read files (with defaults if missing)
    soul = ""
    tools = ""
    agents_md = ""
    
    soul_path = workspace / "SOUL.md"
    if soul_path.exists():
        soul = soul_path.read_text()
    
    tools_path = workspace / "TOOLS.md"
    if tools_path.exists():
        tools = tools_path.read_text()
    
    agents_path = workspace / "AGENTS.md"
    if agents_path.exists():
        agents_md = agents_path.read_text()
    
    return AgentFilesResponse(soul=soul, tools=tools, agentsMd=agents_md)


class UpdateAgentFilesRequest(BaseModel):
    soul: Optional[str] = None
    tools: Optional[str] = None
    agentsMd: Optional[str] = None

@app.put("/api/agents/{agent_id}/files")
def update_agent_files(agent_id: str, request: UpdateAgentFilesRequest):
    """Update agent workspace files."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"
    
    # Read config to get workspace path
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="OpenClaw config not found")
    
    try:
        with open(config_path) as f:
            config = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read config: {str(e)}")
    
    # Find agent
    agent_list = config.get("agents", {}).get("list", [])
    agent = next((a for a in agent_list if a.get("id") == agent_id), None)
    
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    
    workspace = Path(agent.get("workspace", home / ".openclaw" / f"workspace-{agent_id}"))
    
    if not workspace.exists():
        workspace.mkdir(parents=True, exist_ok=True)
    
    # Update files
    if request.soul is not None:
        (workspace / "SOUL.md").write_text(request.soul)
    
    if request.tools is not None:
        (workspace / "TOOLS.md").write_text(request.tools)
    
    if request.agentsMd is not None:
        (workspace / "AGENTS.md").write_text(request.agentsMd)
    
    return {"ok": True}


class UpdateAgentConfigRequest(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    model: Optional[str] = None

@app.patch("/api/agents/{agent_id}")
def update_agent_config(agent_id: str, request: UpdateAgentConfigRequest):
    """Update agent config (model, identity) in openclaw.json."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"
    
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="OpenClaw config not found")
    
    try:
        with open(config_path) as f:
            config = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read config: {str(e)}")
    
    # Find and update agent
    agent_list = config.get("agents", {}).get("list", [])
    agent_index = next((i for i, a in enumerate(agent_list) if a.get("id") == agent_id), None)
    
    if agent_index is None:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    
    agent = agent_list[agent_index]
    
    if request.name is not None:
        agent["name"] = request.name
        if "identity" not in agent:
            agent["identity"] = {}
        agent["identity"]["name"] = request.name
    
    if request.emoji is not None:
        if "identity" not in agent:
            agent["identity"] = {}
        agent["identity"]["emoji"] = request.emoji
    
    if request.model is not None:
        if "model" not in agent:
            agent["model"] = {}
        agent["model"]["primary"] = request.model
    
    agent_list[agent_index] = agent
    config["agents"]["list"] = agent_list
    
    # Write updated config
    try:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write config: {str(e)}")
    
    return {"ok": True, "agent": agent}


@app.delete("/api/agents/{agent_id}")
def delete_agent(agent_id: str):
    """Remove agent from config (keeps workspace as archive)."""
    home = Path.home()
    config_path = home / ".openclaw" / "openclaw.json"
    
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="OpenClaw config not found")
    
    try:
        with open(config_path) as f:
            config = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read config: {str(e)}")
    
    # Find and remove agent
    agent_list = config.get("agents", {}).get("list", [])
    original_len = len(agent_list)
    agent_list = [a for a in agent_list if a.get("id") != agent_id]
    
    if len(agent_list) == original_len:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    
    config["agents"]["list"] = agent_list
    
    # Write updated config
    try:
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write config: {str(e)}")
    
    return {"ok": True, "message": f"Agent '{agent_id}' removed (workspace preserved)"}


# ============ V2 — Documents ============

# Ensure upload directory exists
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".doc", ".docx", ".csv", ".json", ".html"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def extract_text_from_file(file_path: Path) -> str:
    """Extract text content from a file based on its extension."""
    ext = file_path.suffix.lower()

    if ext == ".pdf":
        try:
            import pdfplumber
            text_parts = []
            with pdfplumber.open(str(file_path)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
            return "\n\n".join(text_parts)
        except Exception as e:
            raise ValueError(f"PDF extraction failed: {e}")

    elif ext in {".txt", ".md", ".csv", ".json", ".html"}:
        try:
            return file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            return file_path.read_text(encoding="latin-1")

    elif ext in {".doc", ".docx"}:
        # Basic fallback — docx support would need python-docx
        raise ValueError(f"DOCX extraction not yet supported. Upload as PDF or plain text instead.")

    else:
        raise ValueError(f"Unsupported file type: {ext}")


@app.get("/api/documents")
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return [{
        "id": d.id,
        "title": d.title,
        "file_size": d.file_size,
        "tags": json.loads(d.tags) if d.tags else [],
        "status": d.status,
        "summary": d.summary,
        "created_at": d.created_at.isoformat(),
        "processed_at": d.processed_at.isoformat() if d.processed_at else None,
    } for d in docs]


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    tags: str = Form("[]"),
    db: Session = Depends(get_db),
):
    """Upload a file, extract text, and store in the database."""
    # Validate extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Max size: {MAX_FILE_SIZE // (1024*1024)}MB")

    # Create document record first
    try:
        parsed_tags = json.loads(tags) if tags else []
    except json.JSONDecodeError:
        parsed_tags = []

    doc = Document(
        title=file.filename,
        tags=json.dumps(parsed_tags),
        file_size=len(content),
        status="processing",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Save file to disk
    file_dir = UPLOAD_DIR / doc.id
    file_dir.mkdir(exist_ok=True)
    file_path = file_dir / file.filename
    file_path.write_bytes(content)
    doc.file_path = str(file_path)

    # Extract text
    try:
        extracted_text = extract_text_from_file(file_path)
        doc.content_text = extracted_text
        doc.status = "ready"
        doc.processed_at = datetime.utcnow()
    except ValueError as e:
        doc.status = "error"
        doc.content_text = None
        # Still save — user can see the error
        db.commit()
        raise HTTPException(status_code=422, detail=str(e))

    db.commit()
    db.refresh(doc)

    # Broadcast via WebSocket
    await manager.broadcast({
        "type": "document_uploaded",
        "data": {"id": doc.id, "title": doc.title, "status": doc.status}
    })

    return {
        "id": doc.id,
        "title": doc.title,
        "status": doc.status,
        "file_size": doc.file_size,
        "text_length": len(doc.content_text) if doc.content_text else 0,
    }


@app.post("/api/documents")
async def create_document_legacy(
    title: str = "",
    tags: Optional[List[str]] = [],
    db: Session = Depends(get_db),
):
    """Legacy endpoint — creates a document record without file content."""
    doc = Document(
        title=title or "Untitled",
        tags=json.dumps(tags) if tags else "[]",
        status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {"id": doc.id, "status": doc.status}


@app.get("/api/documents/{doc_id}")
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "title": doc.title,
        "content_text": doc.content_text,
        "summary": doc.summary,
        "tags": json.loads(doc.tags) if doc.tags else [],
        "status": doc.status,
        "file_size": doc.file_size,
        "created_at": doc.created_at.isoformat(),
        "processed_at": doc.processed_at.isoformat() if doc.processed_at else None,
    }


@app.get("/api/documents/{doc_id}/content")
def get_document_content(doc_id: str, db: Session = Depends(get_db)):
    """Agent-optimized endpoint — returns just the extracted text."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != "ready":
        raise HTTPException(status_code=422, detail=f"Document not ready (status: {doc.status})")
    return {
        "id": doc.id,
        "title": doc.title,
        "content": doc.content_text,
        "char_count": len(doc.content_text) if doc.content_text else 0,
    }


@app.get("/api/documents/search/text")
def search_documents(q: str = "", db: Session = Depends(get_db)):
    """Search across all document text. Returns matching docs with excerpts."""
    if not q or len(q) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")

    docs = db.query(Document).filter(
        Document.status == "ready",
        Document.content_text.ilike(f"%{q}%")
    ).order_by(Document.created_at.desc()).all()

    results = []
    q_lower = q.lower()
    for d in docs:
        # Find excerpt around the match
        text = d.content_text or ""
        idx = text.lower().find(q_lower)
        start = max(0, idx - 100)
        end = min(len(text), idx + len(q) + 100)
        excerpt = ("..." if start > 0 else "") + text[start:end] + ("..." if end < len(text) else "")

        results.append({
            "id": d.id,
            "title": d.title,
            "excerpt": excerpt,
            "tags": json.loads(d.tags) if d.tags else [],
            "created_at": d.created_at.isoformat(),
        })

    return {"query": q, "count": len(results), "results": results}


@app.delete("/api/documents/{doc_id}")
async def delete_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove file from disk
    if doc.file_path:
        file_path = Path(doc.file_path)
        if file_path.exists():
            file_dir = file_path.parent
            shutil.rmtree(str(file_dir), ignore_errors=True)

    db.delete(doc)
    db.commit()

    await manager.broadcast({
        "type": "document_deleted",
        "data": {"id": doc_id}
    })

    return {"ok": True}

# ============ V2 — Intelligence Reports ============

class IntelligenceReportCreate(BaseModel):
    title: str
    source: Optional[str] = None
    summary: Optional[str] = None
    snapshot: Optional[str] = None
    relevance_score: int = 0
    source_url: Optional[str] = None

@app.get("/api/intelligence")
def list_intelligence_reports(db: Session = Depends(get_db)):
    reports = db.query(IntelligenceReport).order_by(IntelligenceReport.created_at.desc()).all()
    return [{
        "id": r.id,
        "title": r.title,
        "source": r.source,
        "summary": r.summary,
        "snapshot": r.snapshot,
        "relevance_score": r.relevance_score,
        "source_url": r.source_url,
        "created_at": r.created_at.isoformat(),
    } for r in reports]

@app.post("/api/intelligence")
async def create_intelligence_report(data: IntelligenceReportCreate, db: Session = Depends(get_db)):
    report = IntelligenceReport(
        title=data.title,
        source=data.source,
        summary=data.summary,
        snapshot=data.snapshot,
        relevance_score=data.relevance_score,
        source_url=data.source_url,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"id": report.id}

# ============ V2 — Clients ============

class ClientCreate(BaseModel):
    name: str
    description: Optional[str] = None
    context: Optional[str] = None

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    context: Optional[str] = None
    is_active: Optional[bool] = None

@app.get("/api/clients")
def list_clients(db: Session = Depends(get_db)):
    clients = db.query(Client).order_by(Client.created_at.desc()).all()
    return [{
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "context": c.context,
        "channels": json.loads(c.channels) if c.channels else [],
        "is_active": c.is_active,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    } for c in clients]

@app.post("/api/clients")
async def create_client(data: ClientCreate, db: Session = Depends(get_db)):
    client = Client(
        name=data.name,
        description=data.description,
        context=data.context,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return {"id": client.id}

@app.patch("/api/clients/{client_id}")
async def update_client(client_id: str, data: ClientUpdate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if data.name is not None:
        client.name = data.name
    if data.description is not None:
        client.description = data.description
    if data.context is not None:
        client.context = data.context
    if data.is_active is not None:
        client.is_active = data.is_active
    db.commit()
    return {"ok": True}

@app.delete("/api/clients/{client_id}")
async def delete_client(client_id: str, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(client)
    db.commit()
    return {"ok": True}

# ============ V2 — Weekly Recaps ============

@app.get("/api/recaps")
def list_recaps(db: Session = Depends(get_db)):
    recaps = db.query(WeeklyRecap).order_by(WeeklyRecap.week_start.desc()).all()
    return [{
        "id": r.id,
        "title": r.title,
        "week_start": r.week_start.isoformat(),
        "week_end": r.week_end.isoformat(),
        "content": r.content,
        "tasks_completed": r.tasks_completed,
        "commits_count": r.commits_count,
        "total_spend": r.total_spend,
        "created_at": r.created_at.isoformat(),
    } for r in recaps]

# ============ V2 — API Usage (Cloudflare AI Gateway) ============

# Pricing per 1M tokens (input / output) — updated Feb 2026
MODEL_PRICING = {
    "claude-opus-4-5-20251101":   {"input": 15.00, "output": 75.00},
    "claude-sonnet-4-5-20250929": {"input": 3.00,  "output": 15.00},
    "claude-haiku-4-5-20251001":  {"input": 0.80,  "output": 4.00},
    # Older models that may appear in logs
    "claude-3-5-sonnet-20241022": {"input": 3.00,  "output": 15.00},
    "claude-3-haiku-20240307":    {"input": 0.25,  "output": 1.25},
    "claude-3-5-haiku-20241022":  {"input": 0.80,  "output": 4.00},
}

def _estimate_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    pricing = MODEL_PRICING.get(model) or MODEL_PRICING.get("claude-haiku-4-5-20251001")
    return (tokens_in * pricing["input"] / 1_000_000) + (tokens_out * pricing["output"] / 1_000_000)

def _load_cf_config():
    """Load Cloudflare AI Gateway config from config.json."""
    config_path = Path(__file__).parent / "config.json"
    if config_path.exists():
        with open(config_path) as f:
            return json.load(f)
    return {}

USAGE_CACHE_PATH = Path(__file__).parent / "usage_cache.json"
USAGE_CACHE_TTL = 120  # seconds

def _get_cached_logs():
    """Read logs from file cache if fresh enough."""
    if USAGE_CACHE_PATH.exists():
        try:
            with open(USAGE_CACHE_PATH) as f:
                cache = json.load(f)
            if time.time() - cache.get("ts", 0) < USAGE_CACHE_TTL:
                return cache.get("logs", [])
        except Exception:
            pass
    return None

def _refresh_gateway_logs():
    """Fetch all logs from CF AI Gateway and write to file cache."""
    import urllib.request
    cfg = _load_cf_config()
    account_id = cfg.get("cf_account_id", "")
    gateway_id = cfg.get("cf_gateway_id", "")
    api_token = cfg.get("cf_api_token", "")
    if not all([account_id, gateway_id, api_token]):
        return []
    base = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai-gateway/gateways/{gateway_id}/logs"
    all_logs = []
    page = 1
    from datetime import timedelta as td
    cutoff = (datetime.utcnow() - td(days=8)).date().isoformat()
    while True:
        params = [f"per_page=50", f"page={page}", "order_by=created_at", "order_by_direction=desc"]
        url = f"{base}?{'&'.join(params)}"
        req = urllib.request.Request(url)
        req.add_header("Authorization", f"Bearer {api_token}")
        req.add_header("User-Agent", "ClawController/2.0")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
            if not data.get("success") or not data.get("result"):
                break
            logs = data["result"]
            if not logs:
                break
            all_logs.extend(logs)
            oldest = logs[-1].get("created_at", "")[:10]
            if oldest < cutoff or len(logs) < 50:
                break
            page += 1
            if page > 20:
                break
            time.sleep(0.2)  # Rate limit courtesy
        except Exception as e:
            print(f"AI Gateway API error (page {page}): {e}")
            break
    # Write to file cache
    try:
        with open(USAGE_CACHE_PATH, "w") as f:
            json.dump({"ts": time.time(), "logs": all_logs}, f)
    except Exception as e:
        print(f"Cache write error: {e}")
    return all_logs

def _get_logs(start_date: str = None):
    """Get logs from cache or fetch fresh. Filter by start_date."""
    logs = _get_cached_logs()
    if logs is None:
        logs = _refresh_gateway_logs()
    if start_date:
        logs = [l for l in logs if l.get("created_at", "")[:10] >= start_date]
    return logs

def _process_logs(logs):
    """Process gateway logs into aggregated stats."""
    total_in = sum(log.get("tokens_in", 0) or 0 for log in logs)
    total_out = sum(log.get("tokens_out", 0) or 0 for log in logs)
    total_cost = 0.0
    model_breakdown = {}
    daily = {}
    for log in logs:
        model = log.get("model", "unknown")
        t_in = log.get("tokens_in", 0) or 0
        t_out = log.get("tokens_out", 0) or 0
        # Use cost from gateway API directly, fallback to estimate
        cost = log.get("cost") or _estimate_cost(model, t_in, t_out)
        total_cost += cost
        if model not in model_breakdown:
            model_breakdown[model] = {"requests": 0, "tokens_in": 0, "tokens_out": 0, "cost": 0.0, "cached": 0}
        model_breakdown[model]["requests"] += 1
        model_breakdown[model]["tokens_in"] += t_in
        model_breakdown[model]["tokens_out"] += t_out
        model_breakdown[model]["cost"] += cost
        if log.get("cached", False):
            model_breakdown[model]["cached"] += 1
        day = log.get("created_at", "")[:10]
        if day:
            if day not in daily:
                daily[day] = {"cost": 0.0, "requests": 0, "tokens_in": 0, "tokens_out": 0}
            daily[day]["cost"] += cost
            daily[day]["requests"] += 1
            daily[day]["tokens_in"] += t_in
            daily[day]["tokens_out"] += t_out
    cached_count = sum(1 for l in logs if l.get("cached", False))
    return total_in, total_out, total_cost, model_breakdown, daily, cached_count

@app.get("/api/usage/today")
def get_today_usage():
    cfg = _load_cf_config()
    if not all([cfg.get("cf_account_id"), cfg.get("cf_gateway_id"), cfg.get("cf_api_token")]):
        return {"total_cost": "$0.00", "tokens_in": 0, "tokens_out": 0, "requests": 0, "cached": 0, "models": {}, "source": "not_configured"}
    today = datetime.utcnow().date().isoformat()
    logs = _get_logs(start_date=today)
    total_in, total_out, total_cost, model_breakdown, _, cached_count = _process_logs(logs)
    return {
        "total_cost": f"${total_cost:.4f}",
        "tokens_in": total_in,
        "tokens_out": total_out,
        "requests": len(logs),
        "cached": cached_count,
        "models": model_breakdown,
        "source": "cloudflare_ai_gateway",
    }

@app.get("/api/usage/weekly")
def get_weekly_usage():
    from datetime import timedelta as td
    cfg = _load_cf_config()
    if not all([cfg.get("cf_account_id"), cfg.get("cf_gateway_id"), cfg.get("cf_api_token")]):
        return {"total_cost": "$0.00", "tokens_in": 0, "tokens_out": 0, "requests": 0, "cached": 0, "daily": {}, "source": "not_configured"}
    seven_days_ago = (datetime.utcnow() - td(days=7)).date().isoformat()
    logs = _get_logs(start_date=seven_days_ago)
    total_in, total_out, total_cost, _, daily, cached_count = _process_logs(logs)
    return {
        "total_cost": f"${total_cost:.4f}",
        "tokens_in": total_in,
        "tokens_out": total_out,
        "requests": len(logs),
        "cached": cached_count,
        "daily": daily,
        "source": "cloudflare_ai_gateway",
    }

@app.get("/api/usage/config")
def get_usage_config():
    """Check if AI Gateway is configured."""
    cfg = _load_cf_config()
    has_config = all([cfg.get("cf_account_id"), cfg.get("cf_gateway_id"), cfg.get("cf_api_token")])
    return {"configured": has_config, "gateway_id": cfg.get("cf_gateway_id", "")}

@app.post("/api/usage/config")
def save_usage_config(body: dict):
    """Save AI Gateway config."""
    config_path = Path(__file__).parent / "config.json"
    existing = {}
    if config_path.exists():
        with open(config_path) as f:
            existing = json.load(f)
    existing["cf_account_id"] = body.get("cf_account_id", existing.get("cf_account_id", ""))
    existing["cf_gateway_id"] = body.get("cf_gateway_id", existing.get("cf_gateway_id", ""))
    existing["cf_api_token"] = body.get("cf_api_token", existing.get("cf_api_token", ""))
    with open(config_path, "w") as f:
        json.dump(existing, f, indent=2)
    return {"ok": True}

# ============ V2 — Momentum Score ============

@app.get("/api/tasks/momentum")
def get_tasks_with_momentum(db: Session = Depends(get_db)):
    """Get queued tasks sorted by momentum score."""
    queued = db.query(Task).filter(Task.status.in_([TaskStatus.INBOX, TaskStatus.ASSIGNED])).all()
    done = db.query(Task).filter(Task.status == TaskStatus.DONE).order_by(Task.updated_at.desc()).limit(10).all()
    done_tags = set()
    for t in done:
        if t.tags:
            done_tags.update(json.loads(t.tags))

    result = []
    for task in queued:
        tags = json.loads(task.tags) if task.tags else []
        # Skill adjacency (40%)
        overlap = len(set(tags) & done_tags)
        adjacency = min(40, (overlap / max(len(tags), 1)) * 40) if tags else 0
        # Capability match (30%) — always assume capable
        capability = 30
        # Priority (20%)
        priority_score = 20 if task.priority == Priority.URGENT else 10
        # Queue age (10%)
        age_days = (datetime.utcnow() - task.created_at).days if task.created_at else 0
        age_score = min(10, age_days * 2)

        momentum = min(100, round(adjacency + capability + priority_score + age_score))
        result.append({
            "id": task.id,
            "title": task.title,
            "description": task.description,
            "tags": tags,
            "priority": task.priority.value,
            "momentum": momentum,
            "created_at": task.created_at.isoformat() if task.created_at else None,
        })

    result.sort(key=lambda x: x["momentum"], reverse=True)
    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
