-- =========================================
-- MIGRATION: Relatório mensal automático
-- =========================================

-- A tabela relatorios_enviados foi criada sem coluna de telefone
-- (na época, o controle de limite era global, não por usuário).
-- Agora que cada usuário tem seu próprio relatório, precisamos
-- isolar o controle de "já enviado" por telefone também.

ALTER TABLE relatorios_enviados ADD COLUMN telefone TEXT;

-- Remove a constraint antiga (mes, ano) que impedia duas pessoas
-- diferentes de terem um relatório no mesmo mês.
ALTER TABLE relatorios_enviados DROP CONSTRAINT IF EXISTS relatorios_enviados_mes_ano_key;

-- Nova constraint: um relatório por usuário, por mês.
ALTER TABLE relatorios_enviados ADD CONSTRAINT relatorios_enviados_telefone_mes_ano_key UNIQUE (telefone, mes, ano);

-- Garante que a tabela não está bloqueada por RLS, igual já fizemos
-- com usuarios, gastos e config.
ALTER TABLE relatorios_enviados DISABLE ROW LEVEL SECURITY;
