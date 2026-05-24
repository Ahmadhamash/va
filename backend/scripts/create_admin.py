"""Create or promote a platform admin.

Usage (from the backend/ dir, or inside the backend container):

    python -m scripts.create_admin --username admin --email a@x.com --password secret

If the user exists it is promoted to role='admin'; otherwise it is created.
"""
import argparse
import asyncio

from sqlalchemy import or_, select

from database import AsyncSessionLocal
from models import User
from services.auth_service import hash_password


async def _run(username: str, email: str, password: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(
                or_(User.username == username, User.email == email)
            )
        )
        user = result.scalar_one_or_none()

        if user is None:
            user = User(
                username=username,
                email=email,
                hashed_password=hash_password(password),
                role="admin",
                business_name="Platform Admin",
            )
            db.add(user)
            await db.commit()
            print(f"Created admin '{username}'.")
        else:
            user.role = "admin"
            if password:
                user.hashed_password = hash_password(password)
            await db.commit()
            print(f"Promoted '{user.username}' to admin.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or promote an admin user")
    parser.add_argument("--username", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()
    asyncio.run(_run(args.username, args.email, args.password))


if __name__ == "__main__":
    main()
