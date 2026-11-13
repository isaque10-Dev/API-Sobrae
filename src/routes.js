
import alimentos from "./controller/alimentosController.js";
import contaempresarial from "./controller/contaempreserialController.js";
import contapessoal from "./controller/contapessoalController.js";
import statusempresa from "./controller/statusempresaController.js";
import statuspessoal from "./controller/statuspessoalController.js";
import doacoes from "./controller/doacoesController.js";
import auth from "./controller/authController.js";
import solicitacoes from "./controller/solicitacoesController.js";
import atividades from "./controller/atividadesController.js";
import admin from "./controller/adminController.js";
import eventos from "./controller/eventosController.js";

export function addRoutes(api) {

    api.use(alimentos);

    api.use(contaempresarial);

    api.use(contapessoal);

    api.use(statusempresa);

    api.use(statuspessoal);

    api.use(doacoes);

    api.use(auth);

    api.use(solicitacoes);

    api.use(atividades);
    api.use(eventos);
    api.use(admin);

}
