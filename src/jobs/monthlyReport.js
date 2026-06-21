// src/jobs/monthlyReport.js
//
// Roda diariamente (agendado pelo node-cron a partir de server.js).
// Se hoje for o último dia do mês, gera e envia o relatório em PDF
// automaticamente para todos os usuários ativos que tiveram gastos
// no mês — sem precisar que ninguém peça.
//
// Idempotente: se o cron rodar mais de uma vez no mesmo dia (ex: o
// servidor reiniciou), não reenvia o relatório pra quem já recebeu.

import {
  listarUsuariosAtivos,
  buscarGastosDoMes,
  relatorioJaEnviado,
  marcarRelatorioEnviado
} from '../services/supabaseService.js';
import { enviarMensagem, enviarDocumentoPDF } from '../services/zapService.js';
import { gerarRelatorioPDF } from '../utils/pdfGenerator.js';
import { somarGastos } from '../utils/formatadores.js';

function ehUltimoDiaDoMes(data) {
  const amanha = new Date(data);
  amanha.setDate(amanha.getDate() + 1);
  return amanha.getMonth() !== data.getMonth();
}

export async function executarEnvioMensalSeNecessario() {
  const hoje = new Date();

  if (!ehUltimoDiaDoMes(hoje)) {
    return;
  }

  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  console.log(`[relatorio-mensal] Último dia do mês detectado (${mes}/${ano}). Iniciando envio automático.`);

  const usuarios = await listarUsuariosAtivos();

  for (const usuario of usuarios) {
    try {
      await enviarRelatorioParaUsuario(usuario, ano, mes);
    } catch (err) {
      // Um erro em um usuário não pode travar o envio para os demais.
      console.error(`[relatorio-mensal] Falha ao enviar para ${usuario.telefone}:`, err.message);
    }
  }

  console.log('[relatorio-mensal] Envio automático concluído.');
}

async function enviarRelatorioParaUsuario(usuario, ano, mes) {
  const telefone = usuario.telefone;

  const jaEnviado = await relatorioJaEnviado(telefone, ano, mes);
  if (jaEnviado) {
    console.log(`[relatorio-mensal] Já enviado anteriormente para ${telefone}, pulando.`);
    return;
  }

  const gastos = await buscarGastosDoMes(telefone, ano, mes);

  if (gastos.length === 0) {
    console.log(`[relatorio-mensal] Sem gastos no mês para ${telefone}, não há relatório a enviar.`);
    return;
  }

  const total = somarGastos(gastos);
  const pdfBuffer = await gerarRelatorioPDF({ usuario, gastos, ano, mes });
  const nomeArquivo = `relatorio-${String(mes).padStart(2, '0')}-${ano}.pdf`;

  await enviarMensagem(
    telefone,
    `📊 Fechamos o mês! Aqui está seu relatório financeiro de ${String(mes).padStart(2, '0')}/${ano}.`
  );
  await enviarDocumentoPDF(telefone, pdfBuffer, nomeArquivo);

  await marcarRelatorioEnviado(telefone, ano, mes, total);
  console.log(`[relatorio-mensal] Relatório enviado com sucesso para ${telefone}.`);
}
