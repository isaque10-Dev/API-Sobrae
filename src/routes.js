import alimentos from '../src/controller/alimentosController.js'     
import contaempreserial from '../src/controller/contaempreserialController.js'  
import contapessoal from '../src/controller/contapessoalController.js'    
import statusempresa from '../src/controller/statusempresaController.js' 
import statuspessoal from '../src/controller/statuspessoalController.js'
import doacoes from '../src/controller/doacoesController.js'


export function addRoutes(api) {   
  api.use(alimentos);          
  api.use(contaempreserial);          
  api.use(contapessoal);    
  api.use(statusempresa);
  api.use(statuspessoal);
  api.use(doacoes);
}