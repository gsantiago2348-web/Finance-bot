-- =========================================
-- MIGRATION: Comandos de admin (liberar/revogar)
-- =========================================

-- Marca quem pode usar os comandos "liberar" e "revogar" pelo WhatsApp.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS admin BOOLEAN DEFAULT false;

-- Torna você o primeiro admin (ajuste o telefone se necessário).
UPDATE usuarios SET admin = true WHERE telefone = '5511963599692';
