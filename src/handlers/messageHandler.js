// src/handlers/messageHandler.js
//
// Recebe o texto bruto da mensagem do WhatsApp e decide o que fazer:
// - Se for um comando conhecido (resumo, limite, ajuda...), executa o comando.
// - Caso contrário, tenta extrair um gasto da mensagem e salvar no banco.
//
// Todos os dados são isolados por número de telefone de quem enviou,
// permitindo que múltiplos usuários usem o mesmo bot sem misturar dados.

import { extrairGasto } from '../services/extractorService.js';
import {
  salvarGasto,
  buscarGastosDoDia,
  buscarGastosDoMes,
  buscarUltimoGasto,
  editarGasto,
  definirLimiteUsuario,
  criarOuReativarUsuario,
  revogarUsuario
} from '../services/supabaseService.js';
import { formatarMoeda, formatarDataBR, formatarHora, somarGastos, agruparPorCategoria } from '../utils/formatadores.js';
import { listarCategorias } from '../utils/categorias.js';
import { gerarRelatorioPDF } from '../utils/pdfGenerator.js';
import { enviarDocumentoPDF } from '../services/zapService.js';

const MENSAGEM_AJUDA = `🤖 *Comandos disponíveis:*

Envie um gasto naturalmente, ex:
_"mercado 50"_ ou _"corte de cabelo 35"_

📊 *resumo hoje* — gastos de hoje
📊 *resumo mes* — gastos do mês atual
📄 *relatorio* — gera o PDF do mês atual
📄 *relatorio 05/2026* — gera o PDF de um mês específico
💰 *limite 3000* — define seu limite mensal
✏️ *editar último [campo] [valor]* — corrige o último gasto
❓ *ajuda* — mostra esta mensagem`;

const MENSAGEM_AJUDA_ADMIN = `\n\n👑 *Comandos de admin:*
➕ *liberar 5511999998888 Nome* — autoriza um novo número
🚫 *revogar 5511999998888* — remove o acesso de um número`;

// `usuario` é o registro vindo da tabela `usuarios` (já validado como autorizado e ativo).
//
// Retorna sempre um objeto { tipo, ... }:
//   { tipo: 'texto', texto }
//   { tipo: 'pdf', texto, pdfBuffer, nomeArquivo }
// O chamador (server.js) decide como enviar cada tipo pelo WhatsApp.
export async function processarMensagem(texto, usuario) {
  const textoLimpo = texto.trim();
  const textoLower = textoLimpo.toLowerCase();
  const telefone = usuario.telefone;

  if (textoLower === 'ajuda' || textoLower === 'help') {
    const ajuda = usuario.admin ? MENSAGEM_AJUDA + MENSAGEM_AJUDA_ADMIN : MENSAGEM_AJUDA;
    return { tipo: 'texto', texto: ajuda };
  }

  if (textoLower === 'resumo hoje') {
    return { tipo: 'texto', texto: await gerarResumoHoje(telefone) };
  }

  if (textoLower === 'resumo mes' || textoLower === 'resumo mês') {
    return { tipo: 'texto', texto: await gerarResumoMes(usuario) };
  }

  if (textoLower === 'relatorio' || textoLower === 'relatório' || textoLower.startsWith('relatorio ') || textoLower.startsWith('relatório ')) {
    return await gerarRelatorioComando(textoLimpo, usuario);
  }

  if (textoLower.startsWith('limite ')) {
    return { tipo: 'texto', texto: await definirLimite(textoLower, telefone) };
  }

  if (textoLower.startsWith('editar')) {
    return { tipo: 'texto', texto: await editarUltimoGasto(textoLimpo, telefone) };
  }

  if (textoLower.startsWith('liberar ')) {
    return { tipo: 'texto', texto: await liberarUsuario(textoLimpo, usuario) };
  }

  if (textoLower.startsWith('revogar ')) {
    return { tipo: 'texto', texto: await revogarAcessoUsuario(textoLimpo, usuario) };
  }

  // Caso padrão: tenta extrair um gasto da mensagem
  return await registrarGasto(textoLimpo, usuario);
}

async function registrarGasto(texto, usuario) {
  const telefone = usuario.telefone;
  const extraido = await extrairGasto(texto);

  if (!extraido.sucesso) {
    return { tipo: 'texto', texto: `🤔 Não consegui identificar um gasto nessa mensagem.\n\n${extraido.motivo || ''}\n\nExemplo: _"mercado 50"_ ou digite *ajuda* para ver os comandos.` };
  }

  await salvarGasto({
    valor: extraido.valor,
    categoria: extraido.categoria,
    data: extraido.data,
    estabelecimento: extraido.estabelecimento,
    mensagem_original: extraido.mensagem_original,
    telefone
  });

  const limite = usuario.limite_mensal ? parseFloat(usuario.limite_mensal) : null;

  let avisoLimite = '';
  if (limite) {
    const hoje = new Date();
    const gastosDoMes = await buscarGastosDoMes(telefone, hoje.getFullYear(), hoje.getMonth() + 1);
    const totalMes = somarGastos(gastosDoMes);
    const percentual = Math.round((totalMes / limite) * 100);

    if (totalMes > limite) {
      avisoLimite = `\n\n🔴 Atenção: você já ultrapassou seu limite mensal! (${percentual}% usado)`;
    } else if (percentual >= 80) {
      avisoLimite = `\n\n🟡 Você já usou ${percentual}% do seu limite mensal.`;
    }
  }

  const local = extraido.estabelecimento ? ` (${extraido.estabelecimento})` : '';
  const texto2 = `✅ Registrado! ${formatarMoeda(extraido.valor)} em *${extraido.categoria}*${local} — ${formatarDataBR(extraido.data)}${avisoLimite}`;
  return { tipo: 'texto', texto: texto2 };
}

async function gerarResumoHoje(telefone) {
  const hoje = new Date().toISOString().split('T')[0];
  const gastos = await buscarGastosDoDia(telefone, hoje);

  if (gastos.length === 0) {
    return '📊 Nenhum gasto registrado hoje ainda.';
  }

  const total = somarGastos(gastos);
  const linhas = [...gastos]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(g => `${formatarHora(g.created_at)} — ${formatarMoeda(g.valor)} · ${g.categoria}${g.estabelecimento ? ` (${g.estabelecimento})` : ''}`);

  return `📊 *Resumo de hoje*\n\n${linhas.join('\n')}\n\n*Total: ${formatarMoeda(total)}*`;
}

async function gerarResumoMes(usuario) {
  const telefone = usuario.telefone;
  const hoje = new Date();
  const gastos = await buscarGastosDoMes(telefone, hoje.getFullYear(), hoje.getMonth() + 1);

  if (gastos.length === 0) {
    return '📊 Nenhum gasto registrado este mês ainda.';
  }

  const total = somarGastos(gastos);
  const porCategoria = agruparPorCategoria(gastos);

  const resumoCategorias = Object.entries(porCategoria)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, valor]) => `• ${cat}: ${formatarMoeda(valor)}`);

  // Lista detalhada, mais recente primeiro, com data e hora de cada gasto
  const detalhado = [...gastos]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(g => {
      const local = g.estabelecimento ? ` (${g.estabelecimento})` : '';
      return `${formatarDataBR(g.data)} ${formatarHora(g.created_at)} — ${formatarMoeda(g.valor)} · ${g.categoria}${local}`;
    });

  const limite = usuario.limite_mensal ? parseFloat(usuario.limite_mensal) : null;
  let linhaLimite = '';
  if (limite) {
    const restante = limite - total;
    linhaLimite = restante >= 0
      ? `\n\n💰 Limite: ${formatarMoeda(limite)} — restam ${formatarMoeda(restante)}`
      : `\n\n🔴 Limite: ${formatarMoeda(limite)} — excedeu em ${formatarMoeda(Math.abs(restante))}`;
  }

  return `📊 *Resumo do mês*\n\n*Por categoria:*\n${resumoCategorias.join('\n')}\n\n*Detalhado:*\n${detalhado.join('\n')}\n\n*Total: ${formatarMoeda(total)}*${linhaLimite}`;
}

async function definirLimite(textoLower, telefone) {
  const match = textoLower.match(/limite\s+(\d+(?:[.,]\d{1,2})?)/);
  if (!match) {
    return '🤔 Use o formato: *limite 3000*';
  }

  const valor = parseFloat(match[1].replace(',', '.'));
  await definirLimiteUsuario(telefone, valor);

  return `✅ Limite mensal definido em ${formatarMoeda(valor)}`;
}

// Comando "relatorio" ou "relatorio MM/AAAA" — gera o PDF do mês informado
// (ou do mês atual, se nenhum for especificado) e devolve para envio como documento.
async function gerarRelatorioComando(textoLimpo, usuario) {
  const telefone = usuario.telefone;
  const hoje = new Date();

  let ano = hoje.getFullYear();
  let mes = hoje.getMonth() + 1;

  const match = textoLimpo.match(/(\d{1,2})\/(\d{4})/);
  if (match) {
    mes = parseInt(match[1], 10);
    ano = parseInt(match[2], 10);

    if (mes < 1 || mes > 12) {
      return { tipo: 'texto', texto: '🤔 Mês inválido. Use o formato: *relatorio 06/2026*' };
    }
  }

  const gastos = await buscarGastosDoMes(telefone, ano, mes);

  if (gastos.length === 0) {
    return { tipo: 'texto', texto: `📄 Nenhum gasto encontrado para ${String(mes).padStart(2, '0')}/${ano}.` };
  }

  const pdfBuffer = await gerarRelatorioPDF({ usuario, gastos, ano, mes });
  const nomeArquivo = `relatorio-${String(mes).padStart(2, '0')}-${ano}.pdf`;

  return {
    tipo: 'pdf',
    texto: `📄 Relatório de ${String(mes).padStart(2, '0')}/${ano} gerado!`,
    pdfBuffer,
    nomeArquivo
  };
}

async function editarUltimoGasto(texto, telefone) {
  const ultimo = await buscarUltimoGasto(telefone);
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

const MENSAGEM_SEM_PERMISSAO = '🚫 Esse comando é restrito a administradores.';

// liberar 5511999998888 Nome da pessoa
async function liberarUsuario(textoLimpo, usuarioSolicitante) {
  if (!usuarioSolicitante.admin) {
    return MENSAGEM_SEM_PERMISSAO;
  }

  const match = textoLimpo.match(/^liberar\s+(\d{10,15})\s*(.*)$/i);
  if (!match) {
    return '🤔 Use o formato: *liberar 5511999998888 Nome da pessoa*';
  }

  const telefoneNovo = match[1];
  const nome = match[2].trim() || null;

  const { usuario, jaExistia } = await criarOuReativarUsuario(telefoneNovo, nome);

  if (jaExistia) {
    return `✅ Acesso reativado para ${usuario.nome || telefoneNovo} (${telefoneNovo}).`;
  }
  return `✅ Número liberado! ${usuario.nome || telefoneNovo} (${telefoneNovo}) já pode usar o bot. Limite inicial: ${formatarMoeda(usuario.limite_mensal)}.`;
}

// revogar 5511999998888
async function revogarAcessoUsuario(textoLimpo, usuarioSolicitante) {
  if (!usuarioSolicitante.admin) {
    return MENSAGEM_SEM_PERMISSAO;
  }

  const match = textoLimpo.match(/^revogar\s+(\d{10,15})\s*$/i);
  if (!match) {
    return '🤔 Use o formato: *revogar 5511999998888*';
  }

  const telefoneAlvo = match[1];

  if (telefoneAlvo === usuarioSolicitante.telefone) {
    return '🤔 Você não pode revogar o seu próprio acesso por aqui.';
  }

  const usuario = await revogarUsuario(telefoneAlvo);

  if (!usuario) {
    return `🤔 Número ${telefoneAlvo} não encontrado.`;
  }
  return `🚫 Acesso revogado para ${usuario.nome || telefoneAlvo} (${telefoneAlvo}).`;
}
