// src/handlers/messageHandler.js
//
// Recebe o texto bruto da mensagem do WhatsApp e decide o que fazer:
// - Se for um comando conhecido (resumo, limite, ajuda...), executa o comando.
// - Caso contrário, tenta extrair um gasto da mensagem e salvar no banco.

import { extrairGasto } from '../services/extractorService.js';
import {
  salvarGasto,
  buscarGastosDoDia,
  buscarGastosDoMes,
  buscarUltimoGasto,
  editarGasto,
  getConfig,
  setConfig
} from '../services/supabaseService.js';
import { formatarMoeda, formatarDataBR, somarGastos, agruparPorCategoria } from '../utils/formatadores.js';
import { listarCategorias } from '../utils/categorias.js';

const MENSAGEM_AJUDA = `🤖 *Comandos disponíveis:*

Envie um gasto naturalmente, ex:
_"mercado 50"_ ou _"corte de cabelo 35"_

📊 *resumo hoje* — gastos de hoje
📊 *resumo mes* — gastos do mês atual
💰 *limite 3000* — define seu limite mensal
✏️ *editar último [campo] [valor]* — corrige o último gasto
❓ *ajuda* — mostra esta mensagem`;

export async function processarMensagem(texto, telefone) {
  const textoLimpo = texto.trim();
  const textoLower = textoLimpo.toLowerCase();

  if (textoLower === 'ajuda' || textoLower === 'help') {
    return MENSAGEM_AJUDA;
  }

  if (textoLower === 'resumo hoje') {
    return await gerarResumoHoje();
  }

  if (textoLower === 'resumo mes' || textoLower === 'resumo mês') {
    return await gerarResumoMes();
  }

  if (textoLower.startsWith('limite ')) {
    return await definirLimite(textoLower);
  }

  if (textoLower.startsWith('editar')) {
    return await editarUltimoGasto(textoLimpo);
  }

  // Caso padrão: tenta extrair um gasto da mensagem
  return await registrarGasto(textoLimpo, telefone);
}

async function registrarGasto(texto, telefone) {
  const extraido = await extrairGasto(texto);

  if (!extraido.sucesso) {
    return `🤔 Não consegui identificar um gasto nessa mensagem.\n\n${extraido.motivo || ''}\n\nExemplo: _"mercado 50"_ ou digite *ajuda* para ver os comandos.`;
  }

  const gasto = await salvarGasto({
    valor: extraido.valor,
    categoria: extraido.categoria,
    data: extraido.data,
    estabelecimento: extraido.estabelecimento,
    mensagem_original: extraido.mensagem_original,
    telefone
  });

  const limiteStr = await getConfig('limite_mensal');
  const limite = limiteStr ? parseFloat(limiteStr) : null;

  let avisoLimite = '';
  if (limite) {
    const hoje = new Date();
    const gastosDoMes = await buscarGastosDoMes(hoje.getFullYear(), hoje.getMonth() + 1);
    const totalMes = somarGastos(gastosDoMes);
    const percentual = Math.round((totalMes / limite) * 100);

    if (totalMes > limite) {
      avisoLimite = `\n\n🔴 Atenção: você já ultrapassou seu limite mensal! (${percentual}% usado)`;
    } else if (percentual >= 80) {
      avisoLimite = `\n\n🟡 Você já usou ${percentual}% do seu limite mensal.`;
    }
  }

  const local = extraido.estabelecimento ? ` (${extraido.estabelecimento})` : '';
  return `✅ Registrado! ${formatarMoeda(extraido.valor)} em *${extraido.categoria}*${local} — ${formatarDataBR(extraido.data)}${avisoLimite}`;
}

async function gerarResumoHoje() {
  const hoje = new Date().toISOString().split('T')[0];
  const gastos = await buscarGastosDoDia(hoje);

  if (gastos.length === 0) {
    return '📊 Nenhum gasto registrado hoje ainda.';
  }

  const total = somarGastos(gastos);
  const linhas = gastos.map(g => `• ${formatarMoeda(g.valor)} — ${g.categoria}${g.estabelecimento ? ` (${g.estabelecimento})` : ''}`);

  return `📊 *Resumo de hoje*\n\n${linhas.join('\n')}\n\n*Total: ${formatarMoeda(total)}*`;
}

async function gerarResumoMes() {
  const hoje = new Date();
  const gastos = await buscarGastosDoMes(hoje.getFullYear(), hoje.getMonth() + 1);

  if (gastos.length === 0) {
    return '📊 Nenhum gasto registrado este mês ainda.';
  }

  const total = somarGastos(gastos);
  const porCategoria = agruparPorCategoria(gastos);

  const linhas = Object.entries(porCategoria)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, valor]) => `• ${cat}: ${formatarMoeda(valor)}`);

  const limiteStr = await getConfig('limite_mensal');
  let linhaLimite = '';
  if (limiteStr) {
    const limite = parseFloat(limiteStr);
    const restante = limite - total;
    linhaLimite = restante >= 0
      ? `\n\n💰 Limite: ${formatarMoeda(limite)} — restam ${formatarMoeda(restante)}`
      : `\n\n🔴 Limite: ${formatarMoeda(limite)} — excedeu em ${formatarMoeda(Math.abs(restante))}`;
  }

  return `📊 *Resumo do mês*\n\n${linhas.join('\n')}\n\n*Total: ${formatarMoeda(total)}*${linhaLimite}`;
}

async function definirLimite(textoLower) {
  const match = textoLower.match(/limite\s+(\d+(?:[.,]\d{1,2})?)/);
  if (!match) {
    return '🤔 Use o formato: *limite 3000*';
  }

  const valor = parseFloat(match[1].replace(',', '.'));
  await setConfig('limite_mensal', String(valor));

  return `✅ Limite mensal definido em ${formatarMoeda(valor)}`;
}

async function editarUltimoGasto(texto) {
  const ultimo = await buscarUltimoGasto();
  if (!ultimo) {
    return '🤔 Nenhum gasto registrado ainda para editar.';
  }

  const textoLower = texto.toLowerCase();

  // editar último categoria Saúde
  const matchCategoria = textoLower.match(/categoria\s+(.+)/);
  if (matchCategoria) {
    const novaCategoria = listarCategorias().find(
      c => c.toLowerCase() === matchCategoria[1].trim().toLowerCase()
    );
    if (!novaCategoria) {
      return `🤔 Categoria não reconhecida. Use uma destas: ${listarCategorias().join(', ')}`;
    }
    await editarGasto(ultimo.id, { categoria: novaCategoria });
    return `✅ Categoria do último gasto (${formatarMoeda(ultimo.valor)}) alterada para *${novaCategoria}*`;
  }

  // editar último valor 45,90
  const matchValor = textoLower.match(/valor\s+(\d+(?:[.,]\d{1,2})?)/);
  if (matchValor) {
    const novoValor = parseFloat(matchValor[1].replace(',', '.'));
    await editarGasto(ultimo.id, { valor: novoValor });
    return `✅ Valor do último gasto alterado para ${formatarMoeda(novoValor)}`;
  }

  return '🤔 Use: *editar último categoria Saúde* ou *editar último valor 45,90*';
}
