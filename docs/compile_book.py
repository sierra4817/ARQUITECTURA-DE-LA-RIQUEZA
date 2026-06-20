import os
import re

docs_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(docs_dir, "libro_completo_imprimible.html")

# Get sorted list of markdown files in docs
files = sorted([f for f in os.listdir(docs_dir) if f.endswith(".md")])

def parse_markdown_to_html(md_content, file_name):
    html = ""
    lines = md_content.split("\n")
    in_list = False
    in_table = False
    table_header = True

    # Identify if it is the cover page (00_portada.md) for custom layout
    is_cover = "00_portada" in file_name
    is_dedication = "02_dedicatoria" in file_name
    
    wrapper_class = "book-page"
    if is_cover:
        wrapper_class = "book-page cover-page"
    elif is_dedication:
        wrapper_class = "book-page dedication-page"

    html += f'<div class="{wrapper_class}">'

    for i, line in enumerate(lines):
        line = line.strip()

        # Handle lists
        if line.startswith("* ") or line.startswith("- "):
            if not in_list:
                html += "<ul>"
                in_list = True
            content = line[2:]
            html += f"<li>{parse_inline(content)}</li>"
            continue
        elif in_list and not (line.startswith("* ") or line.startswith("- ")) and line != "":
            html += "</ul>"
            in_list = False

        # Handle tables
        if line.startswith("|"):
            if not in_table:
                html += "<table>"
                in_table = True
                table_header = True
            if "---" in line or ":---" in line:
                continue
            cells = [c.strip() for c in line.split("|")[1:-1]]
            html += "<tr>"
            for cell in cells:
                tag = "th" if table_header else "td"
                html += f"<{tag}>{parse_inline(cell)}</{tag}>"
            html += "</tr>"
            table_header = False
            continue
        elif in_table and not line.startswith("|"):
            html += "</table>"
            in_table = False

        if line == "":
            # Add spaces for layout if requested by cover or dedication
            if is_cover or is_dedication:
                html += "<br>"
            continue

        # Headers
        if line.startswith("# "):
            html += f"<h1>{parse_inline(line[2:])}</h1>"
        elif line.startswith("## "):
            html += f"<h2>{parse_inline(line[3:])}</h2>"
        elif line.startswith("### "):
            html += f"<h3>{parse_inline(line[4:])}</h3>"
        # Blockquotes / Alerts
        elif line.startswith(">"):
            clean_line = line[1:].strip()
            # Remove alert tag like [!IMPORTANT]
            clean_line = re.sub(r"\[!.*?\]", "", clean_line).strip()
            html += f"<blockquote><p>{parse_inline(clean_line)}</p></blockquote>"
        # HR
        elif line == "---":
            html += '<hr class="section-divider">'
        # Standard paragraph
        else:
            # Code block skip
            if line.startswith("```"):
                code_content = ""
                i += 1
                while i < len(lines) and not lines[i].startswith("```"):
                    code_content += lines[i] + "\n"
                    i += 1
                html += f"<pre><code>{code_content}</code></pre>"
            else:
                html += f"<p>{parse_inline(line)}</p>"

    if in_list:
        html += "</ul>"
    if in_table:
        html += "</table>"

    html += "</div>"
    return html

def parse_inline(text):
    # Bold
    text = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", text)
    # LaTeX
    text = re.sub(r"\$(.*?)\$", r'<code class="latex">\1</code>', text)
    # Links
    text = re.sub(r"\[(.*?)\]\((.*?)\)", r'<span class="link-styled">\1</span>', text)
    return text

# Compile content
compiled_body = ""
for file in files:
    file_path = os.path.join(docs_dir, file)
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        compiled_body += parse_markdown_to_html(content, file)

# HTML/CSS template designed for premium book print
html_template = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Arquitectura de la Riqueza — Edición Premium</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap');

        :root {{
            --bg-color: #ffffff;
            --text-color: #1a1a1a;
            --border-color: #e0e0e0;
            --gold: #aa8210;
        }}

        * {{
            box-sizing: border-box;
        }}

        body {{
            background-color: #f0f0f0;
            color: var(--text-color);
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 11.5pt;
            line-height: 1.6;
            margin: 0;
            padding: 0;
        }}

        .book-container {{
            background-color: var(--bg-color);
            width: 210mm; /* A4 width */
            margin: 40px auto;
            padding: 30mm 25mm 25mm 25mm; /* Classic editorial margins */
            box-shadow: 0 0 30px rgba(0,0,0,0.15);
            border-radius: 4px;
        }}

        .book-page {{
            page-break-after: always;
            position: relative;
            min-height: 240mm; /* Approximate print height */
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
        }}

        /* COVER PAGE STYLING */
        .cover-page {{
            justify-content: center;
            align-items: center;
            text-align: center;
            border: 2px solid var(--border-color);
            padding: 40px;
            margin-bottom: 20px;
        }}

        .cover-page h1 {{
            font-family: 'Cinzel', serif;
            font-size: 2.8rem;
            font-weight: 700;
            letter-spacing: 2px;
            margin-bottom: 20px;
            color: #000000;
        }}

        .cover-page h2 {{
            font-family: 'Inter', sans-serif;
            font-size: 1.1rem;
            font-weight: 400;
            color: #555;
            max-width: 80%;
            margin: 0 auto 80px auto;
            line-height: 1.5;
            letter-spacing: 0.5px;
        }}

        .cover-page h3 {{
            font-family: 'Cinzel', serif;
            font-size: 1.4rem;
            font-weight: 500;
            letter-spacing: 3px;
            color: var(--gold);
            margin-top: auto;
        }}

        .cover-page h4 {{
            font-family: 'Inter', sans-serif;
            font-size: 0.85rem;
            font-weight: 600;
            letter-spacing: 2px;
            color: #777;
        }}

        /* DEDICATION PAGE */
        .dedication-page {{
            justify-content: center;
            align-items: center;
            text-align: center;
            font-style: italic;
            padding: 60px;
        }}

        .dedication-page h1 {{
            font-family: 'Cinzel', serif;
            font-size: 1.4rem;
            letter-spacing: 2px;
            margin-bottom: 40px;
            font-style: normal;
        }}

        .dedication-page blockquote {{
            border: none;
            background: none;
            padding: 0;
            font-size: 1.25rem;
            line-height: 1.8;
            max-width: 80%;
            margin: 0 auto;
        }}

        /* STANDARD PAGES */
        h1, h2, h3 {{
            font-family: 'Cinzel', Georgia, serif;
            color: #000;
            page-break-after: avoid;
        }}

        h1 {{
            font-size: 1.8rem;
            font-weight: 700;
            margin-top: 40px;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 10px;
            letter-spacing: 1px;
            text-transform: uppercase;
        }}

        h2 {{
            font-size: 1.35rem;
            margin-top: 30px;
            margin-bottom: 12px;
            color: #222;
        }}

        h3 {{
            font-size: 1.1rem;
            margin-top: 20px;
            margin-bottom: 10px;
            color: #444;
        }}

        p {{
            margin-bottom: 16px;
            text-align: justify;
            text-indent: 1.5em; /* Classic book indent */
        }}

        /* Remove text indent for headers, quotes, lists, etc. */
        h1 + p, h2 + p, h3 + p, blockquote + p, pre + p, table + p {{
            text-indent: 0;
        }}

        blockquote {{
            border-left: 2.5px solid var(--gold);
            margin: 24px 0;
            padding: 8px 0 8px 24px;
            font-style: italic;
            color: #333;
        }}

        blockquote p {{
            text-indent: 0;
        }}

        /* Lists */
        ul, ol {{
            margin-left: 30px;
            margin-bottom: 16px;
            text-align: justify;
        }}

        li {{
            margin-bottom: 6px;
        }}

        /* Tables */
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 24px 0;
            font-family: 'Inter', sans-serif;
            font-size: 9.5pt;
            page-break-inside: avoid;
        }}

        th, td {{
            padding: 10px 12px;
            border-bottom: 1px solid var(--border-color);
            text-align: left;
        }}

        th {{
            color: var(--gold);
            font-weight: 600;
            border-bottom: 2px solid var(--gold);
        }}

        /* Code blocks */
        pre {{
            background: #f7f7f7;
            border: 1px solid var(--border-color);
            padding: 16px;
            border-radius: 4px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 9pt;
            overflow-x: auto;
            margin: 24px 0;
            page-break-inside: avoid;
        }}

        code {{
            font-family: 'Courier New', Courier, monospace;
            background-color: #f7f7f7;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 90%;
        }}

        code.latex {{
            font-family: 'Inter', sans-serif;
            font-style: italic;
            background: none;
            color: var(--gold);
        }}

        hr.section-divider {{
            border: 0;
            border-top: 1px solid var(--border-color);
            margin: 30px 0;
        }}

        /* PRINT STYLING FOR PDF EXPORT */
        @media print {{
            body {{
                background-color: #fff;
                font-size: 11pt;
            }}

            .book-container {{
                width: 100%;
                margin: 0;
                padding: 0;
                box-shadow: none;
            }}

            .book-page {{
                min-height: 100%;
                page-break-after: always;
            }}

            /* Exclude visual displays or handle headers/footers */
            @page {{
                size: A4;
                margin: 20mm 20mm 20mm 20mm;
            }}
        }}
    </style>
</head>
<body>

    <div class="book-container">
        {compiled_body}
    </div>

</body>
</html>
"""

with open(output_path, "w", encoding="utf-8") as f:
    f.write(html_template)

print(f"Compiled printable book successfully to {output_path}.")
