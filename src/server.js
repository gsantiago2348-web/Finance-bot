// src/server.js
//
// Ponto de entrada do sistema. Sobe um servidor Express que recebe
// o webhook da Z-API toda vez que uma mensagem chega no WhatsApp.
//
// O número do WhatsApp conectado na Z-API é o "número do bot" — ele
// pode receber mensagens de qualquer pessoa. Cada remetente só é
// atendido se estiver cadastrado e ativo na tabela `usuarios`.

import 'dotenv/config';
import express from 'express';
import cron from 'node-cron';
import { processarMensagem } from './handlers/messageHandler.js';
import { enviarMensagem, enviarDocumentoPDF } from './services/zapService.js';
import { buscarUsuario } from './services/supabaseService.js';
import { executarEnvioMensalSeNecessario } from './jobs/monthlyReport.js';

const app = express();
app.use(express.json());

const MENSAGEM_NAO_AUTORIZADO =
  '🔒 Esse número ainda não tem acesso a este bot. Fale com quem te indicou para solicitar liberação.';

app.get('/', (req, res) => {
  res.send('Finance Bot está no ar 🤖💰');
});

// Webhook chamado pela Z-API a cada mensagem recebida no WhatsApp
app.post('/webhook', async (req, res) => {
  // Responde rápido pra Z-API não re-enviar o webhook por timeout
  res.status(200).send('ok');

  try {
    const corpo = req.body;

    // A Z-API envia eventos variados (mensagem recebida, status de entrega, etc).
    // Só nos interessa mensagem de texto recebida.
    const ehMensagemRecebida = corpo.type === 'ReceivedCallback' && corpo.text?.message;
    if (!ehMensagemRecebida) return;

    const telefoneRemetente = corpo.phone;
    const texto = corpo.text.message;

    const usuario = await buscarUsuario(telefoneRemetente);

    if (!usuario) {
      console.log(`Mensagem recusada — número não cadastrado/ativo: ${telefoneRemetente}`);
      await enviarMensagem(telefoneRemetente, MENSAGEM_NAO_AUTORIZADO);
      return;
    }

    const resposta = await processarMensagem(texto, usuario);

    if (resposta.tipo === 'pdf') {
      await enviarMensagem(telefoneRemetente, resposta.texto);
      await enviarDocumentoPDF(telefoneRemetente, resposta.pdfBuffer, resposta.nomeArquivo);
    } else {
      await enviarMensagem(telefoneRemetente, resposta.texto);
    }
  } catch (err) {
    console.error('Erro ao processar webhook:', err);
    try {
      const telefoneRemetente = req.body?.phone;
      if (telefoneRemetente) {
        await enviarMensagem(telefoneRemetente, '⚠️ Ocorreu um erro ao processar sua mensagem. Tente novamente.');
      }
    } catch (_) {
      // Se nem o aviso de erro conseguir enviar, só loga e segue.
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Finance Bot rodando na porta ${PORT}`);
});

// Roda todo dia às 20h (horário de São Paulo). O job em si verifica se
// hoje é o último dia do mês antes de fazer qualquer envio — então na
// prática só dispara o relatório de verdade uma vez por mês.
cron.schedule('0 20 * * *', () => {
  executarEnvioMensalSeNecessario().catch((err) => {
    console.error('[relatorio-mensal] Erro inesperado no cron:', err);
  });
}, {
  timezone: 'America/Sao_Paulo'
});
