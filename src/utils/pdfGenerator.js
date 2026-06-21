// src/utils/pdfGenerator.js
//
// Gera o relatório mensal em PDF: totais, status do limite, gráfico de
// pizza por categoria, gráfico de barras por dia, e tabela detalhada
// com data/hora de cada gasto.
//
// Usa PDFKit puro (sem libs de gráfico externas) para manter o projeto
// leve o suficiente para rodar no plano gratuito do Railway.

import PDFDocument from 'pdfkit';
import { formatarMoeda, formatarDataBR, formatarHora } from './formatadores.js';
import { agruparPorCategoria, somarGastos } from './formatadores.js';

const CORES_CATEGORIAS = [
  '#378ADD', '#1D9E75', '#D85A30', '#D4537E',
  '#BA7517', '#888780', '#7F77DD', '#639922', '#993556'
];

const NOME_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function gerarRelatorioPDF({ usuario, gastos, ano, mes }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const total = somarGastos(gastos);
    const porCategoria = agruparPorCategoria(gastos);
    const limite = usuario.limite_mensal ? parseFloat(usuario.limite_mensal) : null;
    const tituloMes = `${NOME_MES[mes - 1]} ${ano}`;

    desenharCabecalho(doc, tituloMes, total, limite);
    desenharGraficoPizza(doc, porCategoria, total);
    desenharGraficoBarras(doc, gastos, ano, mes);
    desenharTabelaDetalhada(doc, gastos);

    doc.end();
  });
}

function desenharCabecalho(doc, tituloMes, total, limite) {
  doc
    .fontSize(20)
    .fillColor('#1a1a1a')
    .text(`Relatório financeiro — ${tituloMes}`, { align: 'left' });

  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .fillColor('#666666')
    .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`);

  doc.moveDown(1);

  const yMetricas = doc.y;
  const larguraCard = 150;

  desenharCardMetrica(doc, 50, yMetricas, larguraCard, 'Total gasto', formatarMoeda(total));

  if (limite) {
    const restante = limite - total;
    const corRestante = restante >= 0 ? '#3B6D11' : '#A32D2D';
    desenharCardMetrica(doc, 50 + larguraCard + 15, yMetricas, larguraCard, 'Limite mensal', formatarMoeda(limite));
    desenharCardMetrica(
      doc, 50 + (larguraCard + 15) * 2, yMetricas, larguraCard,
      restante >= 0 ? 'Saldo restante' : 'Excedeu em',
      formatarMoeda(Math.abs(restante)), corRestante
    );
  }

  doc.y = yMetricas + 70;
  doc.moveDown(1);
}

function desenharCardMetrica(doc, x, y, largura, label, valor, corValor = '#1a1a1a') {
  doc.roundedRect(x, y, largura, 55, 4).fillColor('#f5f4f0').fill();
  doc
    .fontSize(9)
    .fillColor('#666666')
    .text(label, x + 12, y + 10, { width: largura - 24 });
  doc
    .fontSize(15)
    .fillColor(corValor)
    .text(valor, x + 12, y + 26, { width: largura - 24 });
}

function desenharGraficoPizza(doc, porCategoria, total) {
  if (total === 0) return;

  doc.fontSize(13).fillColor('#1a1a1a').text('Gastos por categoria', 50, doc.y);
  doc.moveDown(0.5);

  const categorias = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
  const centroX = 130;
  const centroY = doc.y + 70;
  const raio = 60;

  let anguloInicial = -Math.PI / 2;

  categorias.forEach(([_, valor], i) => {
    const fatia = (valor / total) * 2 * Math.PI;
    const anguloFinal = anguloInicial + fatia;
    const cor = CORES_CATEGORIAS[i % CORES_CATEGORIAS.length];

    doc.save();
    doc.moveTo(centroX, centroY);
    doc.lineTo(centroX + raio * Math.cos(anguloInicial), centroY + raio * Math.sin(anguloInicial));
    desenharArco(doc, centroX, centroY, raio, anguloInicial, anguloFinal);
    doc.lineTo(centroX, centroY);
    doc.fillColor(cor).fill();
    doc.restore();

    anguloInicial = anguloFinal;
  });

  // Legenda ao lado do gráfico
  const xLegenda = centroX + raio + 40;
  let yLegenda = centroY - raio;

  categorias.forEach(([categoria, valor], i) => {
    const cor = CORES_CATEGORIAS[i % CORES_CATEGORIAS.length];
    const percentual = Math.round((valor / total) * 100);

    doc.rect(xLegenda, yLegenda, 10, 10).fillColor(cor).fill();
    doc
      .fontSize(9)
      .fillColor('#1a1a1a')
      .text(`${categoria} — ${formatarMoeda(valor)} (${percentual}%)`, xLegenda + 16, yLegenda - 1);

    yLegenda += 16;
  });

  doc.y = centroY + raio + 30;
  doc.moveDown(0.5);
}

function desenharArco(doc, cx, cy, raio, anguloInicial, anguloFinal) {
  const passos = 40;
  const delta = (anguloFinal - anguloInicial) / passos;
  for (let i = 0; i <= passos; i++) {
    const angulo = anguloInicial + delta * i;
    const x = cx + raio * Math.cos(angulo);
    const y = cy + raio * Math.sin(angulo);
    if (i === 0) doc.lineTo(x, y);
    else doc.lineTo(x, y);
  }
}

function desenharGraficoBarras(doc, gastos, ano, mes) {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const totalPorDia = new Array(diasNoMes + 1).fill(0);

  gastos.forEach(g => {
    const dia = parseInt(g.data.split('-')[2], 10);
    totalPorDia[dia] += parseFloat(g.valor);
  });

  const maiorValor = Math.max(...totalPorDia, 1);

  if (doc.y > 620) doc.addPage();

  doc.fontSize(13).fillColor('#1a1a1a').text('Gastos por dia', 50, doc.y);
  doc.moveDown(0.5);

  const xInicial = 50;
  const yBase = doc.y + 110;
  const alturaMax = 100;
  const larguraGrafico = 495;
  const larguraBarra = larguraGrafico / diasNoMes;

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const valor = totalPorDia[dia];
    const alturaBarra = valor > 0 ? Math.max((valor / maiorValor) * alturaMax, 3) : 0;
    const x = xInicial + (dia - 1) * larguraBarra;

    if (valor > 0) {
      doc
        .rect(x, yBase - alturaBarra, Math.max(larguraBarra - 1, 2), alturaBarra)
        .fillColor('#378ADD')
        .fill();
    }
  }

  // Eixo com marcações a cada 5 dias, alinhadas ao centro de cada barra
  doc
    .moveTo(xInicial, yBase)
    .lineTo(xInicial + larguraGrafico, yBase)
    .strokeColor('#dddddd')
    .stroke();

  for (let dia = 1; dia <= diasNoMes; dia++) {
    if (dia % 5 === 0 || dia === 1) {
      const x = xInicial + (dia - 1) * larguraBarra;
      doc
        .fontSize(7)
        .fillColor('#888888')
        .text(String(dia), x, yBase + 5, { width: larguraBarra, align: 'center' });
    }
  }

  doc.y = yBase + 20;
  doc.moveDown(1);
}

function desenharTabelaDetalhada(doc, gastos) {
  if (doc.y > 650) doc.addPage();

  doc.fontSize(13).fillColor('#1a1a1a').text('Gastos detalhados', 50, doc.y);
  doc.moveDown(0.5);

  const colunas = [
    { titulo: 'Data', largura: 60 },
    { titulo: 'Hora', largura: 45 },
    { titulo: 'Categoria', largura: 90 },
    { titulo: 'Estabelecimento', largura: 165 },
    { titulo: 'Valor', largura: 80 }
  ];

  const xInicial = 50;
  let y = doc.y;

  desenharLinhaTabela(doc, colunas, xInicial, y, true);
  y += 20;

  const ordenados = [...gastos].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  ordenados.forEach((g, i) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
      desenharLinhaTabela(doc, colunas, xInicial, y, true);
      y += 20;
    }

    if (i % 2 === 0) {
      doc.rect(xInicial, y - 3, 440, 18).fillColor('#f9f8f5').fill();
    }

    const valores = [
      formatarDataBR(g.data),
      formatarHora(g.created_at),
      g.categoria,
      g.estabelecimento || '—',
      formatarMoeda(g.valor)
    ];

    desenharLinhaTabela(doc, colunas, xInicial, y, false, valores);
    y += 18;
  });
}

function desenharLinhaTabela(doc, colunas, xInicial, y, cabecalho, valores = null) {
  let x = xInicial;
  colunas.forEach((col, i) => {
    doc
      .fontSize(8.5)
      .fillColor(cabecalho ? '#666666' : '#1a1a1a')
      .text(cabecalho ? col.titulo : valores[i], x, y, { width: col.largura - 5 });
    x += col.largura;
  });

  if (cabecalho) {
    doc
      .moveTo(xInicial, y + 14)
      .lineTo(xInicial + 440, y + 14)
      .strokeColor('#dddddd')
      .stroke();
  }
}
