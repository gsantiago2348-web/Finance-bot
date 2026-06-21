// src/server.js
//
// Ponto de entrada do sistema. Sobe um servidor Express que recebe
// o webhook da Z-API toda vez que uma mensagem chega no WhatsApp.

import 'dotenv/config';
import express from 'express';
import { processarMensagem } from './handlers/messageHandler.js';
import { enviarMensagem } from './services/zapService.js';

const app = express();
app.use(express.json());

const MEU_NUMERO = process.env.MEU_NUMERO;

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

    // Filtro de segurança: só processa mensagens do seu próprio número,
    // pra evitar que outras pessoas usem seu bot sem querer.
    if (MEU_NUMERO && telefoneRemetente !== MEU_NUMERO) {
      console.log(`Mensagem ignorada de número não autorizado: ${telefoneRemetente}`);
      return;
    }

    const resposta = await processarMensagem(texto, telefoneRemetente);
    await enviarMensagem(telefoneRemetente, resposta);
  } catch (err) {
    console.error('Erro ao processar webhook:', err);
    try {
      await enviarMensagem(MEU_NUMERO, '⚠️ Ocorreu um erro ao processar sua mensagem. Tente novamente.');
    } catch (_) {
      // Se nem o aviso de erro conseguir enviar, só loga e segue.
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Finance Bot rodando na porta ${PORT}`);
});
