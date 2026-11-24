#!/usr/bin/env python3
"""Builds extensions/bitsy-auto-theme/blocks/*.liquid.

Shopify limits each app block and app embed to 75 settings and 6 headers/paragraphs.
So the settings are split the way themes split theme settings and section settings:

- "Bitsy Auto design" (app embed): fonts, colours, dropdown and button style, wording – once
  for every Bitsy block.
- "Bitsy Auto product cards" (app embed): card look and content for results and collections.
- Each block: its own layout, spacing, colour overrides (blank = use the design embed),
  vehicle form options, content.

Edit this file, then run:  python3 scripts/build-theme-blocks.py
"""
import json
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "extensions" / "bitsy-auto-theme" / "blocks"
MAX_SETTINGS, MAX_STATIC = 75, 6


# ---------- setting helpers ----------
def header(text):
    return {"type": "header", "content": text}


def para(text):
    return {"type": "paragraph", "content": text}


def rng(id, label, lo, hi, step, default, unit="px"):
    steps = round((hi - lo) / step, 6)
    assert 3 <= steps <= 101 and steps == int(steps), (id, "range needs 3-101 whole steps")
    assert lo <= default <= hi, (id, "default outside range")
    assert abs((default - lo) / step - round((default - lo) / step)) < 1e-9, (id, "default must be on a step")
    assert len(str(step).split(".")[1]) <= 1 if "." in str(step) else True, (id, "step: max 1 decimal")
    s = {"type": "range", "id": id, "label": label, "min": lo, "max": hi, "step": step, "default": default}
    if unit:
        s["unit"] = unit
    return s


def chk(id, label, default):
    return {"type": "checkbox", "id": id, "label": label, "default": default}


def txt(id, label, default=None, info=None):
    s = {"type": "text", "id": id, "label": label}
    if default is not None:
        s["default"] = default
    if info:
        s["info"] = info
    return s


def sel(id, label, options, default):
    return {"type": "select", "id": id, "label": label, "default": default,
            "options": [{"value": v, "label": l} for v, l in options]}


def col(id, label, default=None, info=None):
    assert default is None or (default.startswith("#") and len(default) in (4, 7)), (id, "colour default must be #hex")
    s = {"type": "color", "id": id, "label": label}
    if default:
        s["default"] = default
    if info:
        s["info"] = info
    return s


CASES = [("none", "As typed"), ("uppercase", "UPPERCASE"), ("capitalize", "Capitalised")]
BLANK = "Leave blank to use Bitsy Auto design."


# ---------- per-block groups ----------
def layout(d):
    return [
        header("Layout"),
        chk("full_width", "Full width", d.get("full", False)),
        rng("max_width", "Content max width", 600, 1600, 20, d.get("max", 1200)),
        rng("pad_top", "Padding top", 0, 160, 4, d.get("pt", 16)),
        rng("pad_bottom", "Padding bottom", 0, 160, 4, d.get("pb", 16)),
        rng("pad_top_m", "Padding top (mobile)", 0, 120, 4, d.get("ptm", 12)),
        rng("pad_bottom_m", "Padding bottom (mobile)", 0, 120, 4, d.get("pbm", 12)),
        rng("pad_x", "Padding left and right", 0, 80, 2, d.get("px", 24)),
        rng("pad_x_m", "Padding left and right (mobile)", 0, 40, 2, d.get("pxm", 16)),
        rng("margin_top", "Margin top", 0, 120, 4, d.get("mt", 0)),
        rng("margin_bottom", "Margin bottom", 0, 120, 4, d.get("mb", 0)),
        sel("align", "Alignment", [("left", "Left"), ("center", "Centre"), ("right", "Right")], d.get("align", "left")),
        rng("gap", "Space between elements", 0, 40, 2, d.get("gap", 10)),
        rng("heading_size", "Heading size", 12, 72, 1, d.get("hs", 22)),
        rng("heading_size_m", "Heading size (mobile)", 12, 48, 1, d.get("hsm", 18)),
        chk("show_desktop", "Show on desktop", True),
        chk("show_mobile", "Show on mobile", True),
        txt("css_class", "Extra CSS class"),
    ]


def colours(d):
    return [
        header("Colours"),
        col("color_bg", "Background", d.get("bg"), BLANK),
        {"type": "color_background", "id": "bg_gradient", "label": "Background gradient", "info": "Overrides the background colour."},
        col("color_heading", "Heading", d.get("heading")),
        col("color_text", "Text", d.get("text")),
        col("color_label", "Labels", d.get("label")),
        col("color_link", "Links", d.get("link")),
        col("btn_bg", "Button background", d.get("btn_bg")),
        col("btn_text", "Button text", d.get("btn_text")),
        col("btn2_text", "Secondary button and garage text", d.get("btn2_text")),
        col("btn2_border", "Secondary button and garage border", d.get("btn2_border")),
        col("garage_icon", "Garage icon", d.get("garage")),
    ]


def vehicle_form(d):
    return [
        header("Vehicle form"),
        sel("sel_layout", "Dropdown layout", [("row", "One row"), ("grid", "2 × 2 grid"), ("stacked", "Stacked")], d.get("layout", "row")),
        chk("show_labels", "Show labels above dropdowns", d.get("labels", False)),
        txt("btn_label", "Button text", d.get("btn_label", "Find parts")),
        chk("btn_icon", "Show search icon on button", False),
        sel("btn_width", "Button width", [("auto", "Fit text"), ("full", "Full width")], d.get("bw", "auto")),
        sel("btn_width_m", "Button width (mobile)", [("auto", "Fit text"), ("full", "Full width")], "full"),
        chk("show_vin", "Show VIN search", True),
        chk("show_garage", "Show My Garage button", True),
        chk("garage_icon_only", "Garage icon only (no text)", d.get("icon_only", False)),
        chk("show_badge", "Show garage vehicle count", True),
        chk("prefill", "Show the shopper's selected garage vehicle", True),
    ]


def box(d):
    return [
        sel("box_style", "Box style", [("none", "None"), ("card", "Card"), ("outlined", "Outlined")], d.get("box", "card")),
        col("box_bg", "Box background", d.get("box_bg", "#F6F7F9")),
        col("box_text", "Box text", d.get("box_text")),
        col("box_border", "Box border", "#DADDE3"),
        rng("box_radius", "Box corner radius", 0, 32, 1, 10),
        rng("box_pad", "Box padding", 0, 48, 2, 16),
        chk("box_shadow", "Box shadow", False),
    ]


def grid():
    return [
        header("Product grid"),
        rng("cols", "Columns (desktop)", 2, 5, 1, 4, unit=None),
        sel("cols_m", "Columns (mobile)", [("1", "1"), ("2", "2")], "2"),
        sel("per_page", "Products per page", [("app", "Use the app setting"), ("12", "12"), ("24", "24"), ("36", "36"), ("48", "48")], "app"),
        chk("allow_cols", "Let shoppers change columns", True),
        chk("allow_per_page", "Let shoppers change products per page", True),
        sel("pagination", "Pagination", [("numbers", "Page numbers"), ("more", "Load more button"), ("infinite", "Infinite scroll")], "numbers"),
        txt("more_text", "Load more text", "Load more"),
        chk("show_sort", "Show sorting", True),
        sel("default_sort", "Default sort", [("stock", "In stock first"), ("best", "Best match"), ("price-asc", "Price, low to high"),
                                              ("price-desc", "Price, high to low"), ("title-asc", "Name, A–Z"), ("brand-asc", "Brand, A–Z")], "stock"),
        sel("filters_layout", "Filter layout", [("sidebar", "Sidebar"), ("drawer", "Drawer (button)")], "sidebar"),
        sel("filters_position", "Sidebar position", [("left", "Left"), ("right", "Right")], "left"),
        chk("filter_counts", "Show product counts in filters", True),
        txt("filters_text", "Filters heading", "Filters"),
        txt("clear_text", "Clear filters text", "Clear all"),
        para("Which filters show (Price, In stock, Product type, Brand) is set in the Bitsy Auto app › Settings. Card look: the Bitsy Auto product cards app embed."),
    ]


def block_settings(d, extra_top=(), extra_end=()):
    return list(extra_top) + layout(d) + colours(d) + vehicle_form(d) + list(extra_end)


# ---------- shared Liquid ----------
ROOT_LIQUID = """{%- liquid
  assign s = block.settings
  assign bid = 'bitsy-' | append: block.id
  assign cls = 'bitsy __EXTRA_CLASS__'
  if s.full_width
    assign cls = cls | append: ' bitsy--full'
  endif
  unless s.show_mobile
    assign cls = cls | append: ' bitsy--hide-mobile'
  endunless
  unless s.show_desktop
    assign cls = cls | append: ' bitsy--hide-desktop'
  endunless
  if s.css_class != blank
    assign cls = cls | append: ' ' | append: s.css_class
  endif
  assign sel_id = '#' | append: bid
-%}
<script src="{{ 'bitsy.js' | asset_url }}" defer></script>
"""

GRID_ATTRS = """data-cols="{{ s.cols }}" data-cols-m="{{ s.cols_m }}"{% if s.per_page != 'app' %} data-per-page="{{ s.per_page }}"{% endif %}
    data-allow-cols="{{ s.allow_cols }}" data-allow-per-page="{{ s.allow_per_page }}" data-pagination="{{ s.pagination }}"
    data-show-sort="{{ s.show_sort }}" data-default-sort="{{ s.default_sort }}" data-filters-layout="{{ s.filters_layout }}"
    data-filter-counts="{{ s.filter_counts }}" data-t-count="{{ s.count_text | escape }}" data-t-clear="{{ s.clear_text | escape }}"
    data-t-filters="{{ s.filters_text | escape }}" data-t-more="{{ s.more_text | escape }}\""""

BOX_VARS = """{%- capture box_vars -%}
--b-box-bg:{{ s.box_bg }};--b-box-border:{{ s.box_border }};{% if s.box_text != blank %}--b-box-text:{{ s.box_text }};{% endif %}--b-box-r:{{ s.box_radius }}px;--b-box-pad:{{ s.box_pad }}px;
{% if s.box_shadow %}--b-box-shadow:0 6px 20px rgba(0,0,0,.08);{% endif %}
{%- endcapture -%}
"""

HEADING = """{%- if s.heading != blank -%}<h2 class="bitsy__heading">{{ s.heading }}</h2>{%- endif -%}"""


def schema(obj):
    return "{% schema %}\n" + json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace('},{"type"', '},\n{"type"') + "\n{% endschema %}\n"


def write(name, liquid, sch):
    (OUT / name).write_text(liquid + "\n" + schema(sch), encoding="utf-8")


# ---------- 1. Bitsy Auto design (app embed) ----------
design_settings = [
    header("Typography"),
    chk("use_theme_fonts", "Use the theme's fonts", True),
    {"type": "font_picker", "id": "heading_font", "label": "Heading font", "default": "assistant_n7", "info": "Used when 'Use the theme's fonts' is off."},
    {"type": "font_picker", "id": "body_font", "label": "Body font", "default": "assistant_n4"},
    rng("body_size", "Text size", 11, 22, 1, 15),
    rng("label_size", "Label size", 10, 18, 1, 12),
    rng("button_size", "Button text size", 11, 22, 1, 15),
    rng("letter_spacing", "Heading letter spacing", -1, 5, 0.1, 0),
    rng("line_height", "Line height", 1, 2, 0.1, 1.5, unit=None),
    sel("heading_case", "Heading text case", CASES, "none"),
    sel("label_case", "Label text case", CASES, "none"),
    sel("button_case", "Button text case", CASES, "none"),
    header("Colours"),
    col("color_heading", "Heading", "#1A1A1A"),
    col("color_text", "Text", "#1A1A1A"),
    col("color_label", "Labels", "#1A1A1A"),
    col("color_link", "Links", "#1F2A44"),
    col("sel_bg", "Dropdown background", "#FFFFFF"),
    col("sel_text", "Dropdown text", "#1A1A1A"),
    col("sel_border", "Dropdown border", "#BDBDBD"),
    col("sel_dis_bg", "Dropdown background (not ready)", "#EEEEEE"),
    col("sel_dis_text", "Dropdown text (not ready)", "#6B6B6B"),
    col("focus", "Focus ring", "#005BD3"),
    col("btn_bg", "Button background", "#F2B705"),
    col("btn_text", "Button text", "#1A1A1A"),
    col("btn_border", "Button border"),
    col("btn_hover_bg", "Button background (hover)"),
    col("btn_hover_text", "Button text (hover)"),
    col("btn2_bg", "Secondary button background"),
    col("btn2_text", "Secondary button text"),
    col("btn2_border", "Secondary button border"),
    col("btn2_hover_bg", "Secondary button background (hover)"),
    col("btn2_hover_text", "Secondary button text (hover)"),
    col("badge_bg", "Garage count background", "#F2B705"),
    col("badge_text", "Garage count text", "#1A1A1A"),
    col("success", "'Fits' and success messages", "#1E6B3A"),
    col("error", "Error messages", "#B3261E"),
    header("Dropdowns"),
    rng("sel_height", "Height", 32, 64, 2, 44),
    rng("sel_radius", "Corner radius", 0, 32, 1, 6),
    rng("sel_border_width", "Border width", 0, 4, 1, 1),
    rng("sel_pad", "Inner padding", 4, 24, 1, 12),
    chk("auto_advance", "Move to the next dropdown automatically", True),
    txt("label_make", "Make label", "Make"), txt("label_model", "Model label", "Model"),
    txt("label_year", "Year label", "Year"), txt("label_engine", "Engine label", "Engine"),
    txt("ph_make", "Make placeholder", "Select make"), txt("ph_model", "Model placeholder", "Select model"),
    txt("ph_year", "Year placeholder", "Select year"), txt("ph_engine", "Engine placeholder", "Select engine"),
    txt("msg_incomplete", "Message when not all are chosen", "Choose Make, Model, Year and Engine."),
    header("Buttons"),
    rng("btn_height", "Height", 32, 64, 2, 44),
    rng("btn_radius", "Corner radius", 0, 32, 1, 6),
    rng("btn_border_width", "Border width", 0, 4, 1, 0),
    rng("btn_pad", "Side padding", 8, 48, 2, 18),
    sel("btn_weight", "Font weight", [("400", "Regular"), ("500", "Medium"), ("600", "Semibold"), ("700", "Bold"), ("800", "Extra bold")], "700"),
    header("VIN search and My Garage"),
    txt("vin_link", "VIN link text", "Search by VIN"),
    txt("vin_back", "Back-to-dropdowns text", "Use Make and Model"),
    txt("vin_placeholder", "VIN placeholder", "Enter your 17-character VIN"),
    txt("vin_paused", "Message when the monthly VIN limit is reached", "VIN search is paused for now. Please choose your vehicle by Make and Model."),
    txt("garage_label", "My Garage button text", "My Garage"),
    rng("icon_size", "Garage icon size", 16, 40, 1, 22),
    {"type": "textarea", "id": "custom_css", "label": "Custom CSS for all Bitsy blocks", "info": "Example: .bitsy-btn { letter-spacing: 1px; }"},
]

design_liquid = """{%- liquid
  assign s = block.settings
-%}
{%- render 'bitsy-style', s: s, selector: ':root', extra: '' -%}
<script type="application/json" data-bitsy-config>
{"texts": {
  "labels": {"make": {{ s.label_make | json }}, "model": {{ s.label_model | json }}, "year": {{ s.label_year | json }}, "engine": {{ s.label_engine | json }}},
  "placeholders": {"make": {{ s.ph_make | json }}, "model": {{ s.ph_model | json }}, "year": {{ s.ph_year | json }}, "engine": {{ s.ph_engine | json }}},
  "incomplete": {{ s.msg_incomplete | json }}, "vinLink": {{ s.vin_link | json }}, "vinBack": {{ s.vin_back | json }},
  "vinPlaceholder": {{ s.vin_placeholder | json }}, "vinPaused": {{ s.vin_paused | json }}, "garageLabel": {{ s.garage_label | json }},
  "autoAdvance": {{ s.auto_advance | json }}
}}
</script>"""

design_schema = {"name": "Bitsy Auto design", "target": "head", "settings": design_settings}

# ---------- 2. Product cards (app embed) ----------
cards_settings = [
    header("Product cards"),
    sel("card_ratio", "Image ratio", [("1/1", "Square"), ("3/4", "Portrait"), ("4/3", "Landscape"), ("16/9", "Wide")], "1/1"),
    sel("img_fit", "Image fit", [("contain", "Show whole image"), ("cover", "Fill and crop")], "contain"),
    chk("card_hover", "Show second image on hover", True),
    chk("card_brand", "Show brand", True),
    chk("card_sku", "Show part number (SKU)", True),
    chk("card_stock", "Show stock status", True),
    chk("card_fit", "Show fit label", True),
    chk("card_atc", "Show add to cart", True),
    sel("after_add", "After add to cart", [("stay", "Stay on the page"), ("cart", "Go to the cart")], "stay"),
    sel("card_align", "Text alignment", [("left", "Left"), ("center", "Centre")], "left"),
    rng("grid_gap", "Space between products", 4, 40, 2, 16),
    rng("card_pad", "Card padding", 0, 24, 1, 0),
    rng("card_radius", "Card corner radius", 0, 24, 1, 8),
    rng("card_border_width", "Card border width", 0, 3, 1, 0),
    chk("card_shadow", "Card shadow", False),
    header("Card text"),
    txt("fit_text", "Fit label", "Fits your vehicle"),
    txt("atc_text", "Add to cart", "Add to cart"),
    txt("added_text", "Added", "Added to cart"),
    txt("sold_text", "Out of stock", "Out of stock"),
    txt("instock_text", "In stock", "In stock"),
    txt("sku_prefix", "Part number prefix", "SKU"),
    header("Card colours"),
    col("img_bg", "Image background", "#F2F2F2"),
    col("card_bg", "Card background"),
    col("card_border", "Card border", "#E5E5E5"),
    col("card_title", "Title"),
    col("card_price", "Price"),
    col("card_btn_bg", "Button background", "#1F2A44"),
    col("card_btn_text", "Button text", "#FFFFFF"),
    col("fit_bg", "Fit label background", "#E8F5EC"),
    col("fit_text_color", "Fit label text", "#1E6B3A"),
    col("out_color", "Out of stock text", "#8A2B1D"),
]

cards_liquid = """{%- liquid
  assign s = block.settings
-%}
<style>:root{
--b-ratio:{{ s.card_ratio }};--b-img-fit:{{ s.img_fit }};--b-img-bg:{{ s.img_bg }};--b-grid-gap:{{ s.grid_gap }}px;
--b-card-pad:{{ s.card_pad }}px;--b-card-r:{{ s.card_radius }}px;--b-card-img-r:{{ s.card_radius }}px;--b-card-bw:{{ s.card_border_width }}px;
--b-card-border:{{ s.card_border }};{% if s.card_bg != blank %}--b-card-bg:{{ s.card_bg }};{% endif %}
{% if s.card_title != blank %}--b-card-title:{{ s.card_title }};{% endif %}{% if s.card_price != blank %}--b-card-price:{{ s.card_price }};{% endif %}
{% if s.card_shadow %}--b-card-shadow:0 4px 14px rgba(0,0,0,.08);{% endif %}--b-card-align:{{ s.card_align }};
{% if s.card_align == 'center' %}--b-fit-align:center;{% endif %}--b-fit-bg:{{ s.fit_bg }};--b-fit-text:{{ s.fit_text_color }};
--b-card-btn-bg:{{ s.card_btn_bg }};--b-card-btn-text:{{ s.card_btn_text }};--b-out:{{ s.out_color }};
}</style>
<script type="application/json" data-bitsy-config>
{"cards": {"brand": {{ s.card_brand | json }}, "sku": {{ s.card_sku | json }}, "stock": {{ s.card_stock | json }}, "fit": {{ s.card_fit | json }},
  "atc": {{ s.card_atc | json }}, "hover": {{ s.card_hover | json }}, "afterAdd": {{ s.after_add | json }},
  "t": {"fit": {{ s.fit_text | json }}, "atc": {{ s.atc_text | json }}, "added": {{ s.added_text | json }}, "sold": {{ s.sold_text | json }},
        "inStock": {{ s.instock_text | json }}, "sku": {{ s.sku_prefix | json }}}}}
</script>"""

cards_schema = {"name": "Bitsy Auto product cards", "target": "head", "settings": cards_settings}

# ---------- 3. Vehicle nav bar + My Garage (app embed) ----------
TEMPLATES = [("index", "home page"), ("product", "product pages"), ("collection", "collection pages"), ("search", "search"),
             ("cart", "cart"), ("page", "other pages"), ("blog", "blog"), ("article", "articles"), ("list-collections", "collection list")]

bar_liquid = ROOT_LIQUID.replace("__EXTRA_CLASS__", "bitsy-embed") + """{%- liquid
  assign hide_key = 'hide_' | append: template.name | replace: '-', '_'
  assign o = s.overlay_opacity | divided_by: 100.0
  assign overlay = s.overlay_color | color_modify: 'alpha', o
  assign bar_cls = 'bitsy-bar'
  if s.sticky
    assign bar_cls = bar_cls | append: ' bitsy-bar--sticky'
  endif
  if s.mobile_style == 'collapse'
    assign bar_cls = bar_cls | append: ' bitsy-bar--collapse'
  endif
-%}
{%- capture extra -%}
--b-border-w:{{ s.border_width }}px;--b-border-c:{{ s.border_color }};--b-modal-w:{{ s.modal_width }}px;--b-modal-r:{{ s.modal_radius }}px;
--b-overlay:{{ overlay }};--b-modal-bg:{{ s.modal_bg }};--b-modal-text:{{ s.modal_text }};
{%- endcapture -%}
{%- render 'bitsy-config', s: s -%}
{%- unless s[hide_key] -%}
{%- render 'bitsy-style', s: s, selector: '#bitsy-bar', extra: extra -%}
<div id="bitsy-bar" class="{{ cls }}" data-bitsy-modal-host>
  <div class="{{ bar_cls }}" data-bitsy-bar data-position="{{ s.position }}"{% if s.stuck_shadow %} data-stuck-shadow{% endif %}>
    <div class="bitsy__inner">
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--b-gap,10px)">
        {%- if s.heading != blank -%}<span class="bitsy-bar__title{% unless s.heading_mobile %} bitsy--hide-mobile{% endunless %}">{{ s.heading }}</span>{%- endif -%}
        <button type="button" class="bitsy-btn bitsy-bar__toggle" aria-expanded="false">{{ s.collapse_label }}</button>
        <div class="bitsy-bar__form" style="flex:1 1 640px;min-width:0">{%- render 'bitsy-ymm', s: s -%}</div>
      </div>
    </div>
  </div>
</div>
{%- endunless -%}"""

bar_schema = {
    "name": "Vehicle nav bar",
    "target": "body",
    "stylesheet": "bitsy.css",
    "settings": [
        header("Nav bar"),
        sel("position", "Position", [("below", "Below the theme header"), ("above", "Above the theme header")], "below"),
        chk("sticky", "Stick to the top when scrolling", True),
        chk("stuck_shadow", "Shadow while stuck", True),
        txt("heading", "Heading", "Find parts for your vehicle"),
        chk("heading_mobile", "Show heading on mobile", False),
        sel("mobile_style", "On mobile", [("full", "Show the full bar"), ("collapse", "Collapse to a button")], "collapse"),
        txt("collapse_label", "Collapsed button text", "Select vehicle"),
        rng("border_width", "Bottom border width", 0, 4, 1, 0),
        col("border_color", "Bottom border colour", "#000000"),
    ] + [chk("hide_" + k.replace("-", "_"), "Hide on " + l, False) for k, l in TEMPLATES]
    + block_settings({"pt": 8, "pb": 8, "ptm": 8, "pbm": 8, "bg": "#1F2A44", "heading": "#FFFFFF", "text": "#FFFFFF",
                      "label": "#FFFFFF", "link": "#FFFFFF", "btn2_text": "#FFFFFF", "btn2_border": "#FFFFFF", "garage": "#FFFFFF",
                      "hs": 16, "hsm": 15, "icon_only": True})
    + [
        header("My Garage popup"),
        txt("garage_title", "Title", "My Garage"),
        txt("garage_empty", "Empty garage message", "No vehicles saved yet. Add one to see only the parts that fit."),
        txt("garage_add", "Add vehicle text", "+ Add a vehicle"),
        txt("garage_save", "Save vehicle text", "Save to garage"),
        txt("garage_cancel", "Cancel text", "Cancel"),
        txt("garage_selected", "Selected label", "Selected"),
        txt("garage_shop", "Shop button text", "Shop parts for selected vehicle"),
        txt("garage_full", "Garage full message", "Garage full: remove a vehicle to add one"),
        chk("garage_show_ktype", "Show the TecDoc KType line", True),
        chk("garage_show_vin", "Show 'VIN saved' line", True),
        rng("modal_width", "Popup width", 360, 720, 10, 520),
        rng("modal_radius", "Popup corner radius", 0, 24, 1, 12),
        col("modal_bg", "Popup background", "#FFFFFF"),
        col("modal_text", "Popup text", "#1A1A1A"),
        col("overlay_color", "Overlay colour", "#000000"),
        rng("overlay_opacity", "Overlay opacity", 0, 90, 5, 50, unit="%"),
    ],
}

# ---------- 4. Vehicle selector (app block) ----------
selector_liquid = ROOT_LIQUID.replace("__EXTRA_CLASS__", "bitsy-selector") + BOX_VARS + """{%- render 'bitsy-config' -%}
{%- render 'bitsy-style', s: s, selector: sel_id, extra: box_vars -%}
<div id="{{ bid }}" class="{{ cls }}" {{ block.shopify_attributes }}>
  <div class="bitsy__inner bitsy-box bitsy-box--{{ s.box_style }}">
    """ + HEADING + """
    {%- if s.subheading != blank -%}<div class="bitsy__sub">{{ s.subheading }}</div>{%- endif -%}
    {%- render 'bitsy-ymm', s: s -%}
  </div>
</div>"""

selector_schema = {
    "name": "Vehicle selector",
    "target": "content",
    "stylesheet": "bitsy.css",
    "settings": [header("Content"), txt("heading", "Heading", "Find parts for your vehicle"),
                 {"type": "richtext", "id": "subheading", "label": "Subheading"}] + box({})
    + block_settings({"pt": 24, "pb": 24, "labels": True, "btn_bg": "#1F2A44", "btn_text": "#FFFFFF"}),
}

# ---------- 5. Hero banner (app block) ----------
hero_liquid = ROOT_LIQUID.replace("__EXTRA_CLASS__", "bitsy-hero-wrap") + """{%- liquid
  assign heights = 'small:420,medium:560,large:720' | split: ','
  assign h = s.height_custom | append: 'px'
  for p in heights
    assign kv = p | split: ':'
    if s.height == kv[0]
      assign h = kv[1] | append: 'px'
    endif
  endfor
  if s.height == 'full'
    assign h = '100vh'
  endif
  assign hm = s.height_m_custom | append: 'px'
  for p in heights
    assign kv = p | split: ':'
    if s.height_m == kv[0]
      assign hm = kv[1] | append: 'px'
    endif
  endfor
  if s.height_m == 'full'
    assign hm = '100svh'
  endif
  if s.height_m == 'same'
    assign hm = h
  endif
  assign o = s.overlay_opacity | divided_by: 100.0
  assign po = s.panel_opacity | divided_by: 100.0
  assign panel_bg = s.panel_bg | color_modify: 'alpha', po
  case s.v_align
    when 'top'
      assign va = 'flex-start'
    when 'bottom'
      assign va = 'flex-end'
    else
      assign va = 'center'
  endcase
  case s.h_align
    when 'center'
      assign ha = 'center'
    when 'right'
      assign ha = 'flex-end'
    else
      assign ha = 'flex-start'
  endcase
-%}
{%- capture extra -%}
--b-hero-h:{{ h }};--b-hero-h-m:{{ hm }};--b-valign:{{ va }};--b-halign:{{ ha }};--b-content-w:{{ s.content_width }}px;
--b-overlay-c:{{ s.overlay_color }};--b-overlay-o:{{ o }};--b-panel-bg:{{ panel_bg }};--b-panel-text:{{ s.panel_text }};
--b-panel-pad:{{ s.panel_pad }}px;--b-panel-r:{{ s.panel_radius }}px;{% if s.panel_shadow %}--b-panel-shadow:0 18px 40px rgba(0,0,0,.25);{% endif %}
{%- endcapture -%}
{%- render 'bitsy-config' -%}
{%- render 'bitsy-style', s: s, selector: sel_id, extra: extra -%}
<div id="{{ bid }}" class="{{ cls }}" {{ block.shopify_attributes }} style="padding:0">
  <section class="bitsy-hero" style="padding:var(--b-pt,0) var(--b-px,0) var(--b-pb,0)">
    {%- if s.image != blank -%}
      <div class="bitsy-hero__media bitsy-hero__media--desktop{% if s.image_mobile != blank %} bitsy-hero__media--has-mobile{% endif %}">
        {%- assign focal = 'object-position:' | append: s.image.presentation.focal_point -%}
        {{ s.image | image_url: width: 2400 | image_tag: loading: 'eager', fetchpriority: 'high', sizes: '100vw', widths: '750,1100,1500,1920,2400', alt: s.image.alt, style: focal }}
      </div>
    {%- endif -%}
    {%- if s.image_mobile != blank -%}
      <div class="bitsy-hero__media bitsy-hero__media--mobile">
        {%- assign focal_m = 'object-position:' | append: s.image_mobile.presentation.focal_point -%}
        {{ s.image_mobile | image_url: width: 1200 | image_tag: loading: 'eager', sizes: '100vw', widths: '450,750,1000,1200', alt: s.image_mobile.alt, style: focal_m }}
      </div>
    {%- endif -%}
    <div class="bitsy-hero__overlay" aria-hidden="true"></div>
    <div class="bitsy__inner">
      <div class="bitsy-hero__content">
        """ + HEADING + """
        {%- if s.subheading != blank -%}<div class="bitsy__sub">{{ s.subheading }}</div>{%- endif -%}
        <div class="bitsy-hero__panel bitsy-hero__panel--{{ s.panel_style }}">
          {%- render 'bitsy-ymm', s: s -%}
        </div>
        {%- if s.link_text != blank and s.link_url != blank -%}<a class="bitsy-link" href="{{ s.link_url }}">{{ s.link_text }}</a>{%- endif -%}
      </div>
    </div>
  </section>
</div>"""

hero_schema = {
    "name": "Vehicle search hero",
    "target": "content",
    "stylesheet": "bitsy.css",
    "settings": [
        header("Image and size"),
        {"type": "image_picker", "id": "image", "label": "Desktop image", "info": "Set the focal point in the image picker."},
        {"type": "image_picker", "id": "image_mobile", "label": "Mobile image", "info": "Optional. Uses the desktop image when empty."},
        col("overlay_color", "Overlay colour", "#000000"),
        rng("overlay_opacity", "Overlay opacity", 0, 90, 5, 45, unit="%"),
        sel("height", "Height (desktop)", [("small", "Small"), ("medium", "Medium"), ("large", "Large"), ("full", "Full screen"), ("custom", "Custom")], "medium"),
        rng("height_custom", "Custom height (desktop)", 300, 1000, 10, 640),
        sel("height_m", "Height (mobile)", [("same", "Same as desktop"), ("small", "Small"), ("medium", "Medium"), ("large", "Large"), ("full", "Full screen"), ("custom", "Custom")], "small"),
        rng("height_m_custom", "Custom height (mobile)", 240, 900, 10, 480),
        sel("h_align", "Content position (horizontal)", [("left", "Left"), ("center", "Centre"), ("right", "Right")], "left"),
        sel("v_align", "Content position (vertical)", [("top", "Top"), ("middle", "Middle"), ("bottom", "Bottom")], "middle"),
        rng("content_width", "Content width", 400, 1200, 20, 760),
        header("Content and panel"),
        txt("heading", "Heading", "The right part, first time"),
        {"type": "richtext", "id": "subheading", "label": "Subheading", "default": "<p>Choose your vehicle and we'll show only the parts that fit.</p>"},
        txt("link_text", "Secondary link text"),
        {"type": "url", "id": "link_url", "label": "Secondary link"},
        sel("panel_style", "Panel style", [("card", "Card"), ("glass", "Glass (blurred)"), ("none", "None")], "card"),
        col("panel_bg", "Panel background", "#FFFFFF"),
        rng("panel_opacity", "Panel opacity", 0, 100, 5, 100, unit="%"),
        col("panel_text", "Panel text", "#1A1A1A"),
        rng("panel_pad", "Panel padding", 8, 48, 2, 18),
        rng("panel_radius", "Panel corner radius", 0, 32, 1, 12),
        chk("panel_shadow", "Panel shadow", False),
    ] + block_settings({"pt": 56, "pb": 56, "ptm": 40, "pbm": 40, "bg": "#39434F", "heading": "#FFFFFF", "text": "#FFFFFF",
                        "link": "#FFFFFF", "hs": 46, "hsm": 30, "layout": "grid", "labels": True, "gap": 16,
                        "garage": "#1A1A1A", "btn2_text": "#1A1A1A", "btn2_border": "#BDBDBD"}),
}

# ---------- 6. Collection vehicle bar (app block) ----------
coll_liquid = ROOT_LIQUID.replace("__EXTRA_CLASS__", "bitsy-coll") + BOX_VARS + """{%- render 'bitsy-config' -%}
{%- render 'bitsy-style', s: s, selector: sel_id, extra: box_vars -%}
<div id="{{ bid }}" class="{{ cls }}" {{ block.shopify_attributes }}{% if s.sticky %} style="position:sticky;top:0;z-index:30"{% endif %}>
  <div class="bitsy__inner bitsy-results{% if s.filters_layout == 'drawer' %} bitsy-results--drawer{% endif %}{% if s.filters_position == 'right' %} bitsy-results--filters-right{% endif %}"
    data-bitsy-results data-mode="collection" data-collection-id="{{ collection.id }}" data-auto="{{ s.auto_filter }}"
    data-theme-grid="{{ s.theme_grid | escape }}" data-t-fits="{{ s.fits_text | escape }}" """ + GRID_ATTRS + """>
    <div class="bitsy-box bitsy-box--{{ s.box_style }}" style="display:flex;flex-direction:column;gap:var(--b-gap,10px)">
      <div class="bitsy-coll__state" data-coll-state hidden>
        <span class="bitsy-coll__fits"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg><span data-coll-vehicle></span></span>
        <span class="bitsy-coll__count" data-results-count></span>
        <span class="bitsy-spacer"></span>
        <button type="button" class="bitsy-btn bitsy-btn--secondary" data-coll-change>{{ s.change_text }}</button>
        <button type="button" class="bitsy-link" data-coll-clear>{{ s.clear_vehicle_text }}</button>
      </div>
      <div data-coll-picker>
        """ + HEADING + """
        {%- render 'bitsy-ymm', s: s -%}
      </div>
    </div>
    <div data-results-out></div>
    <template data-empty>{{ s.no_results }}</template>
  </div>
</div>"""

coll_schema = {
    "name": "Collection vehicle bar",
    "target": "content",
    "stylesheet": "bitsy.css",
    "enabled_on": {"templates": ["collection"]},
    "settings": [
        header("Content and box"),
        txt("heading", "Heading", "Shop this collection by vehicle"),
        txt("fits_text", "Fits message", "Showing parts that fit {vehicle}", "{vehicle} is replaced with the shopper's vehicle."),
        txt("count_text", "Count text", "{count} products fit", "{count} is replaced with the number of fitting products."),
        txt("change_text", "Change vehicle text", "Change vehicle"),
        txt("clear_vehicle_text", "Clear vehicle text", "Clear vehicle, show all"),
        {"type": "richtext", "id": "no_results", "label": "Message when nothing in this collection fits",
         "default": "<p>Nothing in this collection fits your vehicle. Try another collection or clear the vehicle.</p>"},
        chk("auto_filter", "Filter automatically when a vehicle is selected in My Garage", True),
        chk("sticky", "Stick to the top when scrolling", False),
        txt("theme_grid", "Theme product grid to hide while filtering",
            "#ProductGridContainer, #product-grid, .product-grid-container, .collection-product-grid, .collection__products, .pagination-wrapper, .facets-container",
            "CSS selectors of the theme's own collection grid, separated by commas."),
    ] + box({"box": "card"}) + grid()
    + block_settings({"pt": 8, "pb": 16, "hs": 16, "hsm": 15, "btn_bg": "#1F2A44", "btn_text": "#FFFFFF", "icon_only": True}),
}

# ---------- 7. Results (app block) ----------
results_liquid = ROOT_LIQUID.replace("__EXTRA_CLASS__", "bitsy-results-wrap") + BOX_VARS + """{%- render 'bitsy-config' -%}
{%- render 'bitsy-style', s: s, selector: sel_id, extra: box_vars -%}
<div id="{{ bid }}" class="{{ cls }}" {{ block.shopify_attributes }}>
  <div class="bitsy__inner bitsy-results{% if s.filters_layout == 'drawer' %} bitsy-results--drawer{% endif %}{% if s.filters_position == 'right' %} bitsy-results--filters-right{% endif %}"
    data-bitsy-results data-mode="page" data-t-choose="{{ s.choose_text | escape }}" """ + GRID_ATTRS + """>
    {%- if s.show_vehicle_bar -%}
      <div class="bitsy-box bitsy-box--{{ s.box_style }}" style="display:flex;flex-direction:column;gap:var(--b-gap,10px)">
        {%- if s.vehicle_heading != blank -%}<span class="bitsy__label" style="font-size:var(--b-body-size)">{{ s.vehicle_heading }}</span>{%- endif -%}
        {%- render 'bitsy-ymm', s: s, after: 'results' -%}
      </div>
    {%- endif -%}
    <div>
      """ + HEADING + """
      <p class="bitsy__sub" data-results-count></p>
    </div>
    <div data-results-out></div>
    <template data-empty>{{ s.no_results }}{% if s.contact_url != blank %}<p><a href="{{ s.contact_url }}">{{ s.contact_text }}</a></p>{% endif %}</template>
  </div>
</div>"""

results_schema = {
    "name": "Vehicle parts results",
    "target": "content",
    "stylesheet": "bitsy.css",
    "enabled_on": {"templates": ["page"]},
    "settings": [
        header("Content and box"),
        chk("show_vehicle_bar", "Show the vehicle bar at the top", True),
        txt("vehicle_heading", "Vehicle bar heading", "Your vehicle"),
        txt("heading", "Heading", "Parts for your vehicle"),
        txt("count_text", "Count text", "{count} parts fit", "{count} is replaced with the number of fitting products."),
        txt("choose_text", "Message when no vehicle is chosen", "Choose your vehicle above to see the parts that fit."),
        {"type": "richtext", "id": "no_results", "label": "Message when nothing fits",
         "default": "<p>We don't have parts listed for this vehicle yet. Contact us and we'll help you find them.</p>"},
        txt("contact_text", "Contact link text", "Contact us"),
        {"type": "url", "id": "contact_url", "label": "Contact link"},
    ] + box({"box": "card", "box_bg": "#1F2A44", "box_text": "#FFFFFF"}) + grid()
    + block_settings({"pt": 0, "pb": 40, "hs": 28, "hsm": 22, "btn_bg": "#FFFFFF", "btn_text": "#1A1A1A", "labels": True,
                      "btn_label": "Update parts"}),
}


ALL = [("design.liquid", design_liquid, design_schema), ("cards.liquid", cards_liquid, cards_schema),
       ("vehicle-bar.liquid", bar_liquid, bar_schema), ("vehicle-selector.liquid", selector_liquid, selector_schema),
       ("hero.liquid", hero_liquid, hero_schema), ("collection-bar.liquid", coll_liquid, coll_schema),
       ("results.liquid", results_liquid, results_schema)]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.liquid"):
        f.unlink()
    stale = OUT.parent / "locales" / "en.default.schema.json"
    if stale.exists():
        stale.unlink()
    for name, liquid, sch in ALL:
        st = sch["settings"]
        ids = [x["id"] for x in st if "id" in x]
        static = [x for x in st if x["type"] in ("header", "paragraph")]
        assert len(ids) == len(set(ids)), (name, sorted({i for i in ids if ids.count(i) > 1}))
        assert len(ids) <= MAX_SETTINGS, (name, len(ids))
        assert len(static) <= MAX_STATIC, (name, len(static))
        assert len(sch["name"]) <= 25, sch["name"]
        write(name, liquid, sch)
        print(f"{name}: {len(ids)} settings, {len(static)} headers")


if __name__ == "__main__":
    main()
