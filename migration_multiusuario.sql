-- =========================================
-- MIGRATION: Multi-usuário (preparando para monetização)
-- =========================================

-- Tabela de usuários autorizados a usar o bot
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT UNIQUE NOT NULL,
  nome TEXT,
  ativo BOOLEAN DEFAULT true,
  limite_mensal DECIMAL(10,2) DEFAULT 3000,
  plano TEXT DEFAULT 'gratis',  -- futuro: 'gratis', 'pro', etc
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adiciona seu próprio número como primeiro usuário autorizado
-- (troque o telefone abaixo pelo seu número pessoal, sem o "+")
INSERT INTO usuarios (telefone, nome, limite_mensal)
VALUES ('5511963599692', 'Gabriel', 3000);

-- Índice para consultas rápidas por telefone
CREATE INDEX idx_usuarios_telefone ON usuarios(telefone);

-- A tabela "config" antiga (limite_mensal global) não será mais usada
-- para limite — cada usuário agora tem o seu próprio na tabela usuarios.
-- Não precisa apagar, só não vamos mais usar a chave 'limite_mensal' dela.
