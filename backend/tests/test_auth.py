import pytest
from httpx import AsyncClient
from sqlalchemy import select

from models import User
from routers.auth import create_reset_token

@pytest.mark.asyncio
async def test_auth_refresh_flow(client: AsyncClient, db_session):
    # Register
    res = await client.post("/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    })
    assert res.status_code == 201, res.text
    
    cookies = res.cookies
    assert "refresh_token" in cookies
    
    # Refresh
    res2 = await client.post("/auth/refresh", cookies={"refresh_token": cookies["refresh_token"]})
    assert res2.status_code == 200, res2.text
    assert "access_token" in res2.json()
    assert "refresh_token" in res2.cookies

@pytest.mark.asyncio
async def test_auth_password_reset_flow(client: AsyncClient, db_session):
    # Forgot password
    res = await client.post("/auth/forgot-password", json={"email": "test@example.com"})
    assert res.status_code == 200, res.text
    
    # Find user to get ID
    result = await db_session.execute(select(User).where(User.email == "test@example.com"))
    user = result.scalar_one()
    
    # Generate token manually
    token = create_reset_token(str(user.id))
    
    # Reset password
    res_reset = await client.post(f"/auth/reset-password?token={token}", json={
        "new_password": "newpassword123"
    })
    assert res_reset.status_code == 200, res_reset.text
    
    # Try login with new password
    res_login = await client.post("/auth/login", json={
        "username": "testuser",
        "password": "newpassword123"
    })
    assert res_login.status_code == 200, res_login.text
