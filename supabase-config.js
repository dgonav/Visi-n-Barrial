// ══════════════════════════════════════════════════════════════
// CONFIGURACIÓN SUPABASE - VISIÓN BARRIAL
// ══════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://ghkjqoenmrcuvdxeecdo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdoa2pxb2VubXJjdXZkeGVlY2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NDk3MjcsImV4cCI6MjA5MzUyNTcyN30.MJNox4lXkeEvEoy50OmrRJwnHqTttU0NO0uwZ4HN8CI';

// Crear el cliente
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Verificar conexión
window.supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('❌ Error conectando:', error);
  } else {
    console.log('✅ Supabase conectado correctamente');
  }
});