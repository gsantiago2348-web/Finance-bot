// src/services/extractors/claudeExtractor.js
//
// Extrai valor, categoria e estabelecimento usando a Claude API.
// Entende texto livre e notificações de banco coladas direto, sem
// precisar de um formato fixo. Tem custo por uso (poucos centavos
// por mensagem), por isso fica DESATIVADO até você decidir ativar.
//
// Para ativar: defina no .env
//   MODO_EXTRACAO=ia
//   ANTHROPIC_API_KEY=sk-ant-...
//
// Retorna EXATAMENTE o mesmo formato que o regexExtractor, então
// o resto do sistema funciona sem nenhuma alteração.

import Anthropic from '@anthropic-ai/sdk';
import { listarCategorias } from '../../utils/categorias.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const SYSTEM_PROMPT = `Você extrai dados de gastos financeiros de mensagens de WhatsApp em português do Brasil.

As mensagens podem ser:
- Texto livre informal ("gastei 50 conto no mercado")
- Notificações de banco coladas ("Compra aprovada VISA final 1234 R$47,90 EXTRA SUPERMERCADO 19/06")

Categorias disponíveis (escolha SEMPRE uma destas): ${listarCategorias().join(', ')}, Outros

Responda APENAS com um JSON, sem nenhum texto antes ou depois, no formato:
{
  "sucesso": true,
  "valor": 47.90,
  "categoria": "Mercado",
  "data": "2026-06-19",
  "estabelecimento": "Extra Supermercados"
}

Se não conseguir identificar um valor monetário na mensagem, responda:
{
  "sucesso": false,
  "motivo": "breve explicação"
}

Regras:
- "data" sempre no formato YYYY-MM-DD. Se não houver data explícita, use a data de hoje: {{HOJE}}.
- "valor" sempre como número (não string), com ponto decimal.
- "estabelecimento" pode ser null se não for identificável.
- Nunca invente um estabelecimento que não esteja implícito no texto.`;

export async function extractorClaude(mensagem) {
  const hoje = new Date().toISOString().split('T')[0];
  const systemPrompt = SYSTEM_PROMPT.replace('{{HOJE}}', hoje);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: 'user', content: mensagem }]
    });

    const textoResposta = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    const limpo = textoResposta.replace(/```json|```/g, '').trim();
    const resultado = JSON.parse(limpo);

    if (!resultado.sucesso) {
      return resultado;
    }

    return {
      sucesso: true,
      valor: resultado.valor,
      categoria: resultado.categoria,
      data: resultado.data,
      estabelecimento: resultado.estabelecimento || null,
      mensagem_original: mensagem
    };
  } catch (err) {
    console.error('Erro no extractorClaude:', err);
    return {
      sucesso: false,
      motivo: 'Erro ao processar com IA. Tente novamente.'
    };
  }
}
