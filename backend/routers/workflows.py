import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import BusinessWorkflow, User
from schemas.workflow import WorkflowCreate, WorkflowOut, WorkflowUpdate

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("", response_model=list[WorkflowOut])
async def list_workflows(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(BusinessWorkflow)
        .where(BusinessWorkflow.user_id == current_user.id)
        .order_by(BusinessWorkflow.created_at.desc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=WorkflowOut, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    payload: WorkflowCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = BusinessWorkflow(
        user_id=current_user.id,
        trigger_event=payload.trigger_event,
        action_type=payload.action_type,
        content=payload.content,
        is_active=payload.is_active,
    )
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return workflow


@router.put("/{workflow_id}", response_model=WorkflowOut)
async def update_workflow(
    workflow_id: uuid.UUID,
    payload: WorkflowUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BusinessWorkflow).where(
            BusinessWorkflow.id == workflow_id,
            BusinessWorkflow.user_id == current_user.id,
        )
    )
    workflow = result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(workflow, field, value)

    await db.commit()
    await db.refresh(workflow)
    return workflow


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BusinessWorkflow).where(
            BusinessWorkflow.id == workflow_id,
            BusinessWorkflow.user_id == current_user.id,
        )
    )
    workflow = result.scalar_one_or_none()
    if workflow is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found"
        )

    await db.delete(workflow)
    await db.commit()
