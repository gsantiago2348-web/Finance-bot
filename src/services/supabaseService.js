// src/services/supabaseService.js
//
// Toda comunicação com o banco de dados (Supabase) passa por aqui.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function salvarGasto({ valor, categoria, data, estabelecimento, mensagem_original, telefone }) {
  const { data: row, error } = await supabase
    .from('gastos')
    .insert([{ valor, categoria, data, estabelecimento, mensagem_original, telefone }])
    .select()
    .single();

  if (error) throw error;
  return row;
}

export async function buscarGastosDoMes(telefone, ano, mes) {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const proximoMes = mes === 12 ? 1 : mes + 1;
  const anoProximo = mes === 12 ? ano + 1 : ano;
  const fim = `${anoProximo}-${String(proximoMes).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('telefone', telefone)
    .gte('data', inicio)
    .lt('data', fim)
    .order('data', { ascending: true });

  if (error) throw error;
  return data;
}

export async function buscarGastosDoDia(telefone, dataISO) {
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('telefone', telefone)
    .eq('data', dataISO);

  if (error) throw error;
  return data;
}

export async function buscarUltimoGasto(telefone) {
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('telefone', telefone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function editarGasto(id, campos) {
  const { data, error } = await supabase
    .from('gastos')
    .update(campos)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getConfig(chave) {
  const { data, error } = await supabase
    .from('config')
    .select('valor')
    .eq('chave', chave)
    .maybeSingle();

  if (error) throw error;
  return data?.valor ?? null;
}

export async function setConfig(chave, valor) {
  const { data, error } = await supabase
    .from('config')
    .upsert({ chave, valor, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- Multi-usuário ---

export async function buscarUsuario(telefone) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('telefone', telefone)
    .eq('ativo', true)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function definirLimiteUsuario(telefone, limite) {
  const { data, error } = await supabase
    .from('usuarios')
    .update({ limite_mensal: limite })
    .eq('telefone', telefone)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listarUsuariosAtivos() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('ativo', true);

  if (error) throw error;
  return data;
}

// --- Administração (comandos liberar/revogar via WhatsApp) ---

export async function criarOuReativarUsuario(telefone, nome) {
  const existente = await supabase
    .from('usuarios')
    .select('*')
    .eq('telefone', telefone)
    .maybeSingle();

  if (existente.error) throw existente.error;

  if (existente.data) {
    const { data, error } = await supabase
      .from('usuarios')
      .update({ ativo: true, nome: nome || existente.data.nome })
      .eq('telefone', telefone)
      .select()
      .single();

    if (error) throw error;
    return { usuario: data, jaExistia: true };
  }

  const { data, error } = await supabase
    .from('usuarios')
    .insert([{ telefone, nome, ativo: true, limite_mensal: 3000 }])
    .select()
    .single();

  if (error) throw error;
  return { usuario: data, jaExistia: false };
}

export async function revogarUsuario(telefone) {
  const { data, error } = await supabase
    .from('usuarios')
    .update({ ativo: false })
    .eq('telefone', telefone)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// --- Controle de envio automático mensal ---
// Evita reenviar o mesmo relatório duas vezes (ex: se o cron rodar mais
// de uma vez no mesmo dia por algum reinício do servidor).

export async function relatorioJaEnviado(telefone, ano, mes) {
  const { data, error } = await supabase
    .from('relatorios_enviados')
    .select('id')
    .eq('telefone', telefone)
    .eq('ano', ano)
    .eq('mes', mes)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function marcarRelatorioEnviado(telefone, ano, mes, totalGasto) {
  const { error } = await supabase
    .from('relatorios_enviados')
    .insert([{ telefone, ano, mes, total_gasto: totalGasto }]);

  if (error) throw error;
}
