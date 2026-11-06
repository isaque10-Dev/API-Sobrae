export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function ensure(condition, status, message) {
  if (!condition) throw new ApiError(status, message);
}
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message;
  if (error.code === 'ER_DUP_ENTRY') { status = 409; message = 'E-mail ou documento já cadastrado para esse tipo de conta.'; }
  if (error.code === 'ER_ROW_IS_REFERENCED_2') { status = 409; message = 'Este registro possui vínculos e não pode ser excluído.'; }
  if (error.type === 'entity.parse.failed') { status = 400; message = 'O corpo da requisição deve ser um JSON válido.'; }
  if (error.type === 'entity.too.large') { status = 413; message = 'Requisição muito grande.'; }
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code)) {
    status = 503; message = 'Banco indisponível ou não preparado. Confira a configuração e execute npm run db:setup.';
  }
  if (status >= 500 && status !== 503) {
    console.error('Falha interna:', error.code || error.name);
    message = 'Não foi possível concluir a operação.';
  }
  res.status(status).json({ erro: message });
}
