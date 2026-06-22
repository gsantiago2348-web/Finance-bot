// src/services/zapService.js
//
// Envio de mensagens de texto e documentos via Z-API.

const BASE_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`;

// Monta os headers da requisição — inclui o Client-Token apenas se estiver configurado.
// Quando vazio, a Z-API rejeita a chamada com "your client-token is not configured".
function montarHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.ZAPI_CLIENT_TOKEN) {
    headers['Client-Token'] = process.env.ZAPI_CLIENT_TOKEN;
  }
  return headers;
}

export async function enviarMensagem(telefone, mensagem) {
  const response = await fetch(`${BASE_URL}/send-text`, {
    method: 'POST',
    headers: montarHeaders(),
    body: JSON.stringify({ phone: telefone, message: mensagem })
  });

  if (!response.ok) {
    const erro = await response.text();
    console.error('Erro ao enviar mensagem Z-API:', erro);
    throw new Error('Falha ao enviar mensagem via Z-API');
  }

  return response.json();
}

// Envia um arquivo PDF como documento no WhatsApp.
export async function enviarDocumentoPDF(telefone, pdfBuffer, nomeArquivo) {
  const base64 = pdfBuffer.toString('base64');

  const response = await fetch(`${BASE_URL}/send-document/pdf`, {
    method: 'POST',
    headers: montarHeaders(),
    body: JSON.stringify({
      phone: telefone,
      document: `data:application/pdf;base64,${base64}`,
      fileName: nomeArquivo
    })
  });

  if (!response.ok) {
    const erro = await response.text();
    console.error('Erro ao enviar documento Z-API:', erro);
    throw new Error('Falha ao enviar documento via Z-API');
  }

  return response.json();
}
