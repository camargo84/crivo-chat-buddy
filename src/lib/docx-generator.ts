import { 
  Document, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Header,
  Footer,
  Packer
} from 'docx';
import { SynthesisData } from './synthesis-service';

export async function generateCenarioReport(
  synthesis: SynthesisData,
  projectTitle: string
): Promise<Blob> {
  
  const doc = new Document({
    creator: "Framework CRIVO",
    title: `Relatório de Cenário - ${projectTitle}`,
    description: "Etapa 1 - Cenário da Demanda",
    
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 24
          },
          paragraph: {
            spacing: {
              line: 360,
              before: 120,
              after: 120
            }
          }
        }
      },
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          run: { font: "Times New Roman", size: 24 },
          paragraph: {
            spacing: { line: 360, before: 120, after: 120 },
            alignment: AlignmentType.JUSTIFIED
          }
        },
        {
          id: "Heading1",
          name: "Heading 1",
          run: {
            font: "Times New Roman",
            size: 28,
            bold: true,
            color: "1F4E78"
          },
          paragraph: {
            spacing: { before: 480, after: 240 }
          }
        },
        {
          id: "Heading2",
          name: "Heading 2",
          run: {
            font: "Times New Roman",
            size: 26,
            bold: true,
            color: "2E5C8A"
          },
          paragraph: {
            spacing: { before: 360, after: 180 }
          }
        }
      ]
    },
    
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1134,
            right: 1134,
            bottom: 1134,
            left: 1701
          }
        }
      },
      
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: synthesis.identificacao.orgaoNome,
                  size: 20,
                  color: "808080"
                })
              ]
            })
          ]
        })
      },
      
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "Framework CRIVO | Relatório de Cenário",
                  size: 20,
                  color: "808080"
                })
              ]
            })
          ]
        })
      },
      
      children: [
        ...generateCoverPage(synthesis, projectTitle),
        new Paragraph({ text: "", pageBreakBefore: true }),
        ...generateTableOfContents(),
        ...generateContent(synthesis)
      ]
    }]
  });

  return await Packer.toBlob(doc);
}

function generateCoverPage(data: SynthesisData, title: string): Paragraph[] {
  return [
    new Paragraph({
      text: data.identificacao.orgaoNome.toUpperCase(),
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000 }
    }),
    new Paragraph({ text: "", spacing: { before: 800 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "RELATÓRIO DE CENÁRIO DA DEMANDA",
          bold: true,
          size: 28
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: "Framework CRIVO - Lei nº 14.133/2021",
          size: 24,
          italics: true,
          color: "666666"
        })
      ]
    }),
    new Paragraph({ text: "", spacing: { before: 1200 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: title,
          size: 26,
          bold: true
        })
      ]
    }),
    new Paragraph({ text: "", spacing: { before: 2000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Elaborado por: ${data.identificacao.responsavel}`,
          size: 24
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
      children: [
        new TextRun({
          text: `Cargo: ${data.identificacao.cargo}`,
          size: 24
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240 },
      children: [
        new TextRun({
          text: `Data: ${data.identificacao.data}`,
          size: 24
        })
      ]
    })
  ];
}

function generateTableOfContents(): Paragraph[] {
  return [
    new Paragraph({
      text: "SUMÁRIO",
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      pageBreakBefore: true
    }),
    new Paragraph({ text: "", spacing: { after: 240 } }),
    new Paragraph({ text: "1. INTRODUÇÃO ............................................... 3" }),
    new Paragraph({ text: "2. IDENTIFICAÇÃO ............................................ 4" }),
    new Paragraph({ text: "3. NECESSIDADE DA CONTRATAÇÃO ............................... 5" }),
    new Paragraph({ text: "4. JUSTIFICATIVA ............................................ 6" }),
    new Paragraph({ text: "5. HIPÓTESES DE SOLUÇÃO ..................................... 8" }),
    new Paragraph({ text: "6. REQUISITOS PRELIMINARES .................................. 9" }),
    new Paragraph({ text: "7. PLANEJAMENTO ............................................ 11" }),
    new Paragraph({ text: "8. RISCOS .................................................. 13" }),
    new Paragraph({ text: "9. CONCLUSÕES .............................................. 15" })
  ];
}

function generateContent(data: SynthesisData): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  paragraphs.push(
    new Paragraph({
      text: "1. INTRODUÇÃO",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true
    }),
    new Paragraph({
      text: "Este relatório apresenta o cenário completo da demanda de contratação, elaborado conforme metodologia Framework CRIVO, em conformidade com Lei nº 14.133/2021.",
      alignment: AlignmentType.JUSTIFIED
    })
  );
  
  paragraphs.push(
    new Paragraph({
      text: "2. IDENTIFICAÇÃO",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 480 }
    })
  );
  
  const identTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      createTableRow("Órgão/Entidade:", data.identificacao.orgaoNome),
      createTableRow("CNPJ:", data.identificacao.orgaoCNPJ),
      createTableRow("Órgão Demandante:", data.identificacao.orgaoDemandante),
      ...(data.identificacao.uasg ? [createTableRow("UASG:", data.identificacao.uasg)] : []),
      createTableRow("Endereço:", data.identificacao.endereco),
      createTableRow("Responsável:", data.identificacao.responsavel),
      createTableRow("Cargo:", data.identificacao.cargo),
      createTableRow("Data:", data.identificacao.data)
    ]
  });
  
  paragraphs.push(new Paragraph({ children: [identTable] as any }));
  
  paragraphs.push(
    new Paragraph({
      text: "3. NECESSIDADE DA CONTRATAÇÃO",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 480 }
    }),
    new Paragraph({
      text: data.necessidade.descricao,
      alignment: AlignmentType.JUSTIFIED
    })
  );
  
  paragraphs.push(
    new Paragraph({
      text: "4. JUSTIFICATIVA",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 480 }
    }),
    new Paragraph({
      text: "4.1. Problema Identificado",
      heading: HeadingLevel.HEADING_2
    }),
    new Paragraph({
      text: data.justificativa.problemaDetalhado,
      alignment: AlignmentType.JUSTIFIED
    }),
    new Paragraph({
      text: "4.2. Situação Atual",
      heading: HeadingLevel.HEADING_2
    }),
    new Paragraph({
      text: data.justificativa.situacaoAtual,
      alignment: AlignmentType.JUSTIFIED
    }),
    new Paragraph({
      text: "4.3. Impacto",
      heading: HeadingLevel.HEADING_2
    }),
    new Paragraph({
      text: data.justificativa.impacto,
      alignment: AlignmentType.JUSTIFIED
    })
  );
  
  paragraphs.push(
    new Paragraph({
      text: "5. HIPÓTESES DE SOLUÇÃO",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 480 }
    }),
    new Paragraph({
      text: "5.1. Hipótese Principal",
      heading: HeadingLevel.HEADING_2
    }),
    new Paragraph({
      text: data.hipotesesSolucao.principal,
      alignment: AlignmentType.JUSTIFIED
    })
  );
  
  paragraphs.push(
    new Paragraph({
      text: "6. REQUISITOS PRELIMINARES",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 480 }
    }),
    new Paragraph({
      text: data.requisitos.quantitativos,
      alignment: AlignmentType.JUSTIFIED
    })
  );
  
  paragraphs.push(
    new Paragraph({
      text: "7. PLANEJAMENTO",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 480 }
    }),
    new Paragraph({
      text: `Prazo: ${data.planejamento.prazo}`,
      alignment: AlignmentType.JUSTIFIED
    }),
    new Paragraph({
      text: `Orçamento: ${data.planejamento.orcamento}`,
      alignment: AlignmentType.JUSTIFIED
    })
  );
  
  paragraphs.push(
    new Paragraph({
      text: "8. RISCOS",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 480 }
    }),
    new Paragraph({
      text: data.riscos.naoContratar,
      alignment: AlignmentType.JUSTIFIED
    })
  );
  
  paragraphs.push(
    new Paragraph({
      text: "9. CONCLUSÕES",
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 480 }
    }),
    new Paragraph({
      text: "Com base nas informações coletadas, evidencia-se necessidade da contratação e alinhamento com objetivos estratégicos do órgão.",
      alignment: AlignmentType.JUSTIFIED
    })
  );
  
  return paragraphs;
}

function createTableRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: label, bold: true, size: 22 })
            ]
          })
        ]
      }),
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: value, size: 22 })
            ]
          })
        ]
      })
    ]
  });
}
