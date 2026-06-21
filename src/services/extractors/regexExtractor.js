// src/services/extractors/regexExtractor.js
//
// Extrai valor, categoria e estabelecimento de uma mensagem de texto
// usando expressões regulares + dicionário de palavras-chave.
// Não tem custo nenhum, mas só entende mensagens razoavelmente estruturadas.
//
// Funciona bem com:
//   "mercado 50"
//   "gastei 30 na farmacia"
//   "corte de cabelo 35,90"
//   "uber 18.50 ontem"
//
// Retorna SEMPRE o mesmo formato que o claudeExtractor, para que
// o resto do sistema não precise saber qual dos dois foi usado.

import { detectarCategoriaPorPalavra } from '../../utils/categorias.js';

function extrairValor(texto) {
  // Pega números como: 50  50,90  50.90  R$50  R$ 50,90
  const match = texto.match(/(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)/i);
  if (!match) return null;

  const valorStr = match[1].replace(',', '.');
  return parseFloat(valorStr);
}

function extrairData(texto) {
  const hoje = new Date();
  const textoLower = texto.toLowerCase();

  if (textoLower.includes('ontem')) {
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    return ontem.toISOString().split('T')[0];
  }

  // Tenta achar uma data explícita tipo 19/06 ou 19/06/2026
  const matchData = texto.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (matchData) {
    const dia = matchData[1].padStart(2, '0');
    const mes = matchData[2].padStart(2, '0');
    const ano = matchData[3]
      ? (matchData[3].length === 2 ? `20${matchData[3]}` : matchData[3])
      : hoje.getFullYear();
    return `${ano}-${mes}-${dia}`;
  }

  // Padrão: hoje
  return hoje.toISOString().split('T')[0];
}

function extrairEstabelecimento(texto, valorEncontrado) {
  // Remove o valor numérico e palavras de data/comando do texto
  // pra tentar sobrar algo que pareça nome de estabelecimento.
  let limpo = texto
    .replace(/(?:r\$\s*)?\d+(?:[.,]\d{1,2})?/gi, '')
    .replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, '')
    .replace(/\b(gastei|gasto|paguei|comprei|na|no|em|ontem|hoje|de|reais|conto|pila)\b/gi, '')
    .trim();

  // Capitaliza a primeira letra de cada palavra restante
  if (!limpo) return null;
  return limpo
    .split(' ')
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function extractorRegex(mensagem) {
  const textoLower = mensagem.toLowerCase();

  const valor = extrairValor(mensagem);
  if (valor === null) {
    return {
      sucesso: false,
      motivo: 'Não consegui identificar um valor (R$) na mensagem.'
    };
  }

  const categoria = detectarCategoriaPorPalavra(textoLower);
  const data = extrairData(mensagem);
  let estabelecimento = extrairEstabelecimento(mensagem, valor);

  // Se o "estabelecimento" extraído for só o nome da própria categoria
  // (ex: mensagem "mercado 50" → sobra só "Mercado"), não é uma informação
  // nova — melhor deixar null do que repetir a categoria.
  if (estabelecimento && estabelecimento.toLowerCase() === categoria.toLowerCase()) {
    estabelecimento = null;
  }

  return {
    sucesso: true,
    valor,
    categoria,
    data,
    estabelecimento: estabelecimento || null,
    mensagem_original: mensagem
  };
}
