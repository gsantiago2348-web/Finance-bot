// src/services/zapService.js
//
// Envio de mensagens de texto e documentos via Z-API.

const BASE_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`;

export async function enviarMensagem(telefone, mensagem) {
  const response = await fetch(`${BASE_URL}/send-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': process.env.ZAPI_CLIENT_TOKEN || ''
    },
    body: JSON.stringify({
      phone: telefone,
      message: mensagem
    })
  });

  if (!response.ok) {
    const erro = await response.text();
    console.error('Erro ao enviar mensagem Z-API:', erro);
    throw new Error('Falha ao enviar mensagem via Z-API');
  }

  return response.json();
}

// Envia um arquivo PDF como documento no WhatsApp.
// `pdfBuffer` é o conteúdo binário do PDF, `nomeArquivo` aparece no chat.
export async function enviarDocumentoPDF(telefone, pdfBuffer, nomeArquivo) {
  const base64 = pdfBuffer.toString('base64');
  const documentoBase64 = `data:application/pdf;base64,${base64}`;

  const response = await fetch(`${BASE_URL}/send-document/pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': process.env.ZAPI_CLIENT_TOKEN || ''
    },
    body: JSON.stringify({
      phone: telefone,
      document: documentoBase64,
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
