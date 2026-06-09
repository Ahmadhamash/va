import pytest
import uuid
from fastapi import status
from httpx import AsyncClient, ASGITransport
from main import app
from database import get_db
from middleware.auth_middleware import get_current_user
from models import User, ChatSession

@pytest.mark.asyncio
async def test_chat_client_role_read_only(client: AsyncClient, db_session):
    # Create client user and a session
    client_user = User(
        id=uuid.uuid4(),
        username="client_user",
        email="client@example.com",
        hashed_password="hashed_password_placeholder",
        role="client",
        business_name="Test Business"
    )
    db_session.add(client_user)
    
    session = ChatSession(
        id=uuid.uuid4(),
        user_id=client_user.id,
        title="Test Session",
        channel="whatsapp"
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(client_user)
    await db_session.refresh(session)

    # Dependency overrides to simulate client logged in
    app.dependency_overrides[get_current_user] = lambda: client_user

    # Endpoints to test
    session_id = session.id
    
    # 1. notes PUT
    res_notes = await client.put(
        f"/api/chat/sessions/{session_id}/notes",
        json={"note": "dangerous edit"}
    )
    assert res_notes.status_code == status.HTTP_403_FORBIDDEN
    assert "Client role is read-only" in res_notes.text

    # 2. takeover POST
    res_takeover = await client.post(f"/api/chat/sessions/{session_id}/takeover")
    assert res_takeover.status_code == status.HTTP_403_FORBIDDEN
    assert "Client role is read-only" in res_takeover.text

    # 3. return-to-ai POST
    res_return = await client.post(f"/api/chat/sessions/{session_id}/return-to-ai")
    assert res_return.status_code == status.HTTP_403_FORBIDDEN
    assert "Client role is read-only" in res_return.text

    # 4. close POST
    res_close = await client.post(f"/api/chat/sessions/{session_id}/close")
    assert res_close.status_code == status.HTTP_403_FORBIDDEN
    assert "Client role is read-only" in res_close.text

    # 5. agent-message POST
    res_msg = await client.post(
        f"/api/chat/sessions/{session_id}/agent-message",
        data={"message": "hello customer"}
    )
    assert res_msg.status_code == status.HTTP_403_FORBIDDEN
    assert "Client role is read-only" in res_msg.text

    # Clear overrides
    app.dependency_overrides.clear()
