import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Any, Dict, List

class SubscriptionTierOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    price_monthly: float
    features: List[Any] | Dict[str, Any]
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

class UserSubscriptionOut(BaseModel):
    id: uuid.UUID
    tier_id: uuid.UUID
    status: str
    start_date: datetime
    end_date: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

class UserSubscriptionWithTierOut(UserSubscriptionOut):
    tier: SubscriptionTierOut
