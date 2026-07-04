"""icy bites product grounding

Revision ID: 0028
Revises: 0027
Create Date: 2026-07-04
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0028"
down_revision: Union[str, None] = "0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ICY_SALES_PROMPT = """
## ICY_BIT_PRODUCT_GROUNDING_V1
Tenant-specific product grounding for Icy Bites only:
- Treat Mix Fruit and catalog items carrying matching metadata as packaged cup-style frozen dessert / fruit-based frozen treat products, not generic scoop ice cream.
- Use catalog item description and metadata for packaging, product format, visual identity, and image-aware answers.
- Good wording: packaged cup product, branded Icy Bites container, fruit-based frozen treat, I can send you the product image, it comes in the branded Icy Bites cup.
- Avoid unsupported formats such as cone, scoop, choose any scoop, or generic ice cream unless the Icy Bites catalog explicitly contains that format.
- For first-time recommendations, suggest a relevant available catalog product and ask one short preference question.
""".strip()


ICY_SUPPORT_PROMPT = """
## ICY_BIT_SUPPORT_TONE_V1
Tenant-specific support tone for Icy Bites only:
- Keep Arabic replies warm and Jordanian-style: "أكيد", "ولا يهمك", "خليني أتأكدلك", "إذا بتحب".
- For complaints such as melted/damaged orders, acknowledge naturally and connect the customer with the team for accurate help.
- For human handoff requests, prefer: "أكيد، ولا يهمك 🙏 رح أحوّلك لموظف من الفريق يساعدك بشكل أدق."
""".strip()


ICY_ADMIN_PERSONA_PROMPT = """
## ICY_BIT_BRAND_TONE_V1
Icy Bites tenant-only tone:
- Friendly Instagram DM style, warm Jordanian Arabic, light emoji use.
- Product visuals matter. Offer to send product images when customers ask how a product looks or seem undecided.
- Stay grounded in Icy Bites catalog, product metadata, and knowledge base. Do not invent prices, availability, packaging, or formats.
""".strip()


def _append_scoped_prompt_sql(column: str) -> str:
    return f"""
        {column} = CASE
            WHEN COALESCE(client_prompt_settings.{column}, '') LIKE '%ICY_BIT_%_V1%'
                THEN client_prompt_settings.{column}
            WHEN NULLIF(client_prompt_settings.{column}, '') IS NULL
                THEN EXCLUDED.{column}
            ELSE client_prompt_settings.{column} || E'\\n\\n' || EXCLUDED.{column}
        END
    """


def upgrade() -> None:
    op.execute(
        """
        WITH target AS (
            SELECT id
            FROM users
            WHERE username = 'ice_bit'
               OR lower(coalesce(business_name, '')) = 'icy bites'
            LIMIT 1
        )
        INSERT INTO client_prompt_settings (
            user_id,
            sales_prompt,
            support_prompt,
            admin_persona_prompt
        )
        SELECT
            target.id,
            $icy_sales$""" + ICY_SALES_PROMPT + """$icy_sales$,
            $icy_support$""" + ICY_SUPPORT_PROMPT + """$icy_support$,
            $icy_admin$""" + ICY_ADMIN_PERSONA_PROMPT + """$icy_admin$
        FROM target
        ON CONFLICT (user_id) DO UPDATE SET
        """
        + _append_scoped_prompt_sql("sales_prompt")
        + ","
        + _append_scoped_prompt_sql("support_prompt")
        + ","
        + _append_scoped_prompt_sql("admin_persona_prompt")
        + """,
            updated_at = now();
        """
    )

    op.execute(
        """
        WITH target AS (
            SELECT id
            FROM users
            WHERE username = 'ice_bit'
               OR lower(coalesce(business_name, '')) = 'icy bites'
            LIMIT 1
        )
        UPDATE items AS i
        SET
            description = CASE
                WHEN NULLIF(trim(coalesce(i.description, '')), '') IS NULL
                    THEN 'Packaged branded cup-style fruit-based frozen treat in an Icy Bites container.'
                ELSE i.description
            END,
            metadata = coalesce(i.metadata, '{}'::jsonb) || jsonb_build_object(
                'brand', 'Icy Bites',
                'product_format', 'a packaged branded cup-style frozen dessert',
                'product_format_en', 'an Icy Bites branded cup-style frozen dessert',
                'product_format_ar', 'كمنتج جاهز بكب Icy Bites البراندد',
                'packaging', 'branded Icy Bites cup',
                'packaging_en', 'branded Icy Bites cup',
                'packaging_ar', 'بكب Icy Bites البراندد',
                'visual_identity', 'packaged cup product with a branded container',
                'visual_description_en', 'an Icy Bites branded cup-style frozen dessert with a fruity, refreshing profile',
                'visual_description_ar', 'كمنتج جاهز بكب Icy Bites البراندد، بطابع فواكه منعش',
                'flavor_profile_en', 'fruity and refreshing',
                'flavor_profile_ar', 'بطعم فواكه منعش',
                'recommendation_reason_en', 'it has a fruity, refreshing profile',
                'recommendation_reason_ar', 'من الخيارات اللطيفة والمنعشة',
                'image_prompt_hint', 'Offer to send the product image when customers ask how it looks.'
            )
        FROM target
        WHERE i.user_id = target.id
          AND (
              i.name ILIKE '%mix fruit%'
              OR i.name ILIKE '%فواكه%'
              OR i.name ILIKE '%فواكه مشكلة%'
          );
        """
    )


def downgrade() -> None:
    # Tenant data migrations are intentionally not reversed automatically to
    # avoid deleting client-owned prompt or catalog edits made after upgrade.
    pass
