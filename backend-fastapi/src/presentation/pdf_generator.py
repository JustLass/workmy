import io
from datetime import datetime
from PIL import Image as PILImage
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def get_image_flowable(image_bytes, max_width=340):
    """Retorna um objeto Flowable Image do ReportLab com proporções originais mantidas."""
    if not image_bytes:
        return None
    try:
        img = PILImage.open(io.BytesIO(image_bytes))
        width, height = img.size
        aspect = height / width
        display_width = min(max_width, width)
        display_height = display_width * aspect
        return Image(io.BytesIO(image_bytes), width=display_width, height=display_height)
    except Exception as e:
        print(f"[PDF Generator] Erro ao carregar imagem: {e}")
        return None

def generate_commercial_pdf(servico, usuario) -> bytes:
    """
    Gera um PDF comercial elegante de portfólio usando ReportLab.
    Retorna os bytes do PDF.
    """
    buffer = io.BytesIO()
    
    # Configuração da página A4 com margens de 36pt (0.5 inch) para layout aproveitado
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    # Paleta de Cores Premium (WorkMy Green & Slate Slate)
    color_primary = colors.HexColor("#2E5A44")    # Verde Floresta WorkMy
    color_secondary = colors.HexColor("#1E293B")  # Slate-800
    color_text = colors.HexColor("#334155")       # Slate-700 (Corpo)
    color_light_bg = colors.HexColor("#F8FAFC")   # Slate-50 para cards
    color_border = colors.HexColor("#E2E8F0")     # Slate-200 para linhas sutis
    color_accent = colors.HexColor("#0F766E")     # Dark Teal accent
    
    # Tipografia e Estilos Customizados
    style_title = ParagraphStyle(
        name="PremiumTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=color_primary,
        spaceAfter=6
    )
    
    style_subtitle = ParagraphStyle(
        name="PremiumSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=color_secondary,
        spaceAfter=4
    )
    
    style_body = ParagraphStyle(
        name="PremiumBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=color_text
    )
    
    style_meta_title = ParagraphStyle(
        name="MetaTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=color_accent
    )
    
    style_meta_value = ParagraphStyle(
        name="MetaValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=12,
        textColor=color_text
    )

    style_header_brand = ParagraphStyle(
        name="HeaderBrand",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=14,
        textColor=color_primary
    )
    
    story = []
    
    # 1. Cabeçalho / Branding Superior
    header_data = [
        [
            Paragraph("WorkMy — Central de Comando", style_header_brand),
            Paragraph("PORTFÓLIO COMERCIAL DE SERVIÇOS", ParagraphStyle(
                name="HeaderRight",
                fontName="Helvetica",
                fontSize=8.5,
                leading=10,
                textColor=colors.HexColor("#64748B"),
                alignment=2  # Right-aligned
            ))
        ]
    ]
    header_table = Table(header_data, colWidths=[260, 260])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(header_table)
    
    # Linha decorativa de cabeçalho
    accent_bar = Table([[""]], colWidths=[522], rowHeights=[2.5])
    accent_bar.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), color_primary),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(accent_bar)
    story.append(Spacer(1, 15))
    
    # 2. Layout Principal de 2 Colunas (Assimétrico: Esquerda para Conteúdo, Direita para Metadados)
    left_column_flowables = []
    
    # Título do Serviço
    left_column_flowables.append(Paragraph(servico.nome, style_title))
    
    # Linha sutil separadora
    line_dec = Table([[""]], colWidths=[340], rowHeights=[1])
    line_dec.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), color_border),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    left_column_flowables.append(line_dec)
    left_column_flowables.append(Spacer(1, 12))
    
    # Proposta de Valor / Descrição
    left_column_flowables.append(Paragraph("Proposta de Valor / Descrição", style_subtitle))
    
    desc_text = servico.descricao if servico.descricao else "Nenhuma proposta de valor descrita para este serviço."
    desc_paragraph = Paragraph(desc_text, style_body)
    
    # Card elegante para a descrição
    desc_card = Table([[desc_paragraph]], colWidths=[340])
    desc_card.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), color_light_bg),
        ('PADDING', (0,0), (0,0), 12),
        ('BOX', (0,0), (0,0), 0.5, color_border),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
    ]))
    left_column_flowables.append(desc_card)
    left_column_flowables.append(Spacer(1, 16))
    
    # Imagem de Capa (se houver)
    img_flowable = get_image_flowable(servico.imagem_bytes, max_width=340)
    if img_flowable:
        left_column_flowables.append(Paragraph("Apresentação Visual / Screenshot", style_subtitle))
        left_column_flowables.append(Spacer(1, 4))
        
        # Envelopa imagem em card sutil
        img_table = Table([[img_flowable]], colWidths=[340])
        img_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,0), colors.white),
            ('ALIGN', (0,0), (0,0), 'CENTER'),
            ('VALIGN', (0,0), (0,0), 'MIDDLE'),
            ('PADDING', (0,0), (0,0), 6),
            ('BOX', (0,0), (0,0), 0.5, color_border),
            ('ROUNDEDCORNERS', [8, 8, 8, 8]),
        ]))
        left_column_flowables.append(img_table)

    # Coluna da Direita (Metadados Técnicos / Contato)
    right_column_flowables = []
    
    right_column_flowables.append(Paragraph("ESPECIFICAÇÕES TÉCNICAS", style_meta_title))
    right_column_flowables.append(Spacer(1, 6))
    
    # Monta a ficha técnica
    data_criacao = servico.criado_em.strftime("%d/%m/%Y") if servico.criado_em else datetime.now().strftime("%d/%m/%Y")
    
    meta_items = [
        ("Prestador", usuario.username),
        ("E-mail", usuario.email),
        ("Criado Em", data_criacao),
    ]
    
    if servico.ferramentas:
        meta_items.append(("Ferramentas / Techs", servico.ferramentas))
    if servico.tags:
        meta_items.append(("Tags", servico.tags))
    if servico.github_repo:
        meta_items.append(("Repositório GitHub", f"<a href='{servico.github_repo}' color='#2E5A44'><u>Ver no GitHub</u></a>"))
        
    meta_table_data = []
    for label, val in meta_items:
        meta_table_data.append([
            Paragraph(f"<b>{label}:</b>", style_meta_value),
            Paragraph(val, style_meta_value)
        ])
        
    meta_table = Table(meta_table_data, colWidths=[150])
    meta_table.setStyle(TableStyle([
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    
    # Envelopa ficha técnica em card elegante
    meta_card = Table([[meta_table]], colWidths=[162])
    meta_card.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), color_light_bg),
        ('PADDING', (0,0), (0,0), 10),
        ('BOX', (0,0), (0,0), 0.5, color_border),
        ('ROUNDEDCORNERS', [8, 8, 8, 8]),
    ]))
    
    right_column_flowables.append(meta_card)
    right_column_flowables.append(Spacer(1, 15))
    
    # Slogan / Rodapé da coluna lateral
    slogan_style = ParagraphStyle(
        name="SloganStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#64748B"),
        alignment=1
    )
    
    right_column_flowables.append(Paragraph(
        "Gerado automaticamente pela Central de Comando WorkMy — Otimizando o fluxo de caixa de freelancers.",
        slogan_style
    ))
    
    # 3. Monta Tabela Master de 2 colunas para colocar tudo lado a lado
    master_table_data = [[left_column_flowables, right_column_flowables]]
    master_table = Table(master_table_data, colWidths=[350, 172])
    master_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('RIGHTPADDING', (0,0), (0,0), 10),
        ('LEFTPADDING', (1,0), (1,0), 10),
    ]))
    
    story.append(master_table)
    
    # Constrói o PDF
    doc.build(story)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
