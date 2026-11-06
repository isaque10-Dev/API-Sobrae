import alimentos from './controller/alimentosController.js';
import contaempresarial from './controller/contaempreserialController.js';
import contapessoal from './controller/contapessoalController.js';
import statusempresa from './controller/statusempresaController.js';
import statuspessoal from './controller/statuspessoalController.js';
import doacoes from './controller/doacoesController.js';
import auth from './controller/authController.js';
import solicitacoes from './controller/solicitacoesController.js';
import atividades from './controller/atividadesController.js';
export function addRoutes(api) {
  for (const router of [auth, alimentos, contaempresarial, contapessoal, statusempresa, statuspessoal, doacoes, solicitacoes, atividades]) api.use(router);
}
