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

export async function buscarGastosDoMes(ano, mes) {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const proximoMes = mes === 12 ? 1 : mes + 1;
  const anoProximo = mes === 12 ? ano + 1 : ano;
  const fim = `${anoProximo}-${String(proximoMes).padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .gte('data', inicio)
    .lt('data', fim)
    .order('data', { ascending: true });

  if (error) throw error;
  return data;
}

export async function buscarGastosDoDia(dataISO) {
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('data', dataISO);

  if (error) throw error;
  return data;
}

export async function buscarUltimoGasto() {
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
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
