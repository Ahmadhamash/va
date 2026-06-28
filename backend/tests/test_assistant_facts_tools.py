import pytest

from models import BusinessPolicy, User
from services.ai_tools import (
    _exec_get_business_info,
    _exec_get_catalog,
    _exec_get_offers,
    _exec_get_packages,
)
from services.ai_prompts import INTENT_PROMPTS
from services.humanizer import HUMANIZER_SYSTEM_PROMPT
from services.retrieval_plan import supplemental_tool_plan
from services.router import heuristic_intent_for_message


@pytest.mark.asyncio
async def test_sales_points_assistant_fact_is_returned_by_business_info(db_session):
    user = User(
        username="facts_user",
        email="facts_user@example.com",
        hashed_password="x",
        business_name="Facts Brand",
    )
    db_session.add(user)
    await db_session.flush()
    user_id = user.id
    db_session.add(
        BusinessPolicy(
            user_id=user_id,
            policy_type="sales_points",
            title="نقاط البيع",
            content="نقطة البيع الرئيسية: سيتي مول - الطابق الأول.",
            is_active=True,
        )
    )
    db_session.add(
        BusinessPolicy(
            user_id=user_id,
            policy_type="FAQs",
            title="سؤال متكرر",
            content="نعم، هذه معلومة قديمة من واجهة المعرفة السابقة.",
            is_active=True,
        )
    )
    await db_session.commit()

    result = await _exec_get_business_info(user_id, db_session)

    facts = result["business_info"]["assistant_facts"]
    assert result["note"] == ""
    assert "sales_points" in result["business_info"]["fact_categories"]
    assert any("سيتي مول" in fact["content"] for fact in facts)
    assert any("واجهة المعرفة السابقة" in fact["content"] for fact in facts)


@pytest.mark.asyncio
async def test_offer_assistant_fact_is_returned_by_offer_and_package_tools(db_session):
    user = User(
        username="offers_facts_user",
        email="offers_facts_user@example.com",
        hashed_password="x",
        business_name="Offers Brand",
    )
    db_session.add(user)
    await db_session.flush()
    user_id = user.id
    db_session.add(
        BusinessPolicy(
            user_id=user_id,
            policy_type="offers",
            title="البوكس العائلي - Gathering Box",
            content="اسم العرض: البوكس العائلي - Gathering Box. صندوق كرتوني مخصص للمناسبات والجمعات.",
            is_active=True,
        )
    )
    await db_session.commit()

    offers_result = await _exec_get_offers(user_id, db_session)
    packages_result = await _exec_get_packages(user_id, db_session)

    assert offers_result["offers"]
    assert offers_result["offers"][0]["source"] == "assistant_facts"
    assert "بوكس اللمه" in offers_result["offers"][0]["aliases"]
    assert "تقصد البوكس العائلي" in offers_result["offers"][0]["clarification_hint"]
    assert any("البوكس العائلي" in fact["content"] for fact in offers_result["assistant_facts"])
    assert packages_result["packages"]
    assert packages_result["packages"][0]["source"] == "assistant_facts"
    assert "بوكس اللمة" in packages_result["packages"][0]["aliases"]
    assert "تقصد البوكس العائلي" in packages_result["packages"][0]["clarification_hint"]
    assert any("البوكس العائلي" in fact["content"] for fact in packages_result["assistant_facts"])


@pytest.mark.asyncio
async def test_lammeh_box_catalog_miss_requires_package_lookup(db_session):
    user = User(
        username="lammeh_box_user",
        email="lammeh_box_user@example.com",
        hashed_password="x",
        business_name="Lammeh Brand",
    )
    db_session.add(user)
    await db_session.flush()
    user_id = user.id
    await db_session.commit()

    result = await _exec_get_catalog({"query": "في بوكس اللمه؟"}, user_id, db_session)

    assert result["matched"] is False
    assert "get_packages" in result["instruction"]
    assert "Do not say it is unavailable" in result["instruction"]


def test_sales_points_question_routes_to_support_tools():
    assert heuristic_intent_for_message("وين نقاط البيع؟") == "support"


def test_repair_plan_fetches_business_info_for_sales_points():
    calls = supplemental_tool_plan("وين نقاط البيع؟", "support")

    assert any(call.name == "get_business_info" for call in calls)


def test_lammeh_box_rules_are_in_prompts():
    assert "بوكس اللمه" in INTENT_PROMPTS["sales"]
    assert "تقصد البوكس العائلي" in INTENT_PROMPTS["sales"]
    assert "تقصد البوكس العائلي" in HUMANIZER_SYSTEM_PROMPT
