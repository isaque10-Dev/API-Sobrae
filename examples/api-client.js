// Exemplo para copiar para src/services/api.js no projeto React.
// Configure REACT_APP_API_URL com a porta usada no .env da API.
const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:50100';
let token = sessionStorage.getItem('sobraeToken');

export function guardarSessao(session) {
  token = session.token;
  sessionStorage.setItem('sobraeToken', token);
}

export function limparSessao() {
  token = null;
  sessionStorage.removeItem('sobraeToken');
}

export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  const result = await response.json();
  if (response.status === 401) limparSessao();
  if (!response.ok) throw new Error(result.erro || 'Não foi possível concluir a operação.');
  return result;
}

// const sessao = await api('/auth/login', { method: 'POST', body: { email, senha } });
// guardarSessao(sessao);
// const doacoes = await api('/doacoes');
// await api('/doacoes', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
// await api(`/doacoes/${id}/solicitacoes`, { method: 'POST' });
// await api('/auth/logout', { method: 'POST' });
// limparSessao();
