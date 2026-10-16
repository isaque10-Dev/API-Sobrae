import * as TCC_alimento from '../repository/alimentosRepository.js';


import { Router } from "express";
const endpoints = Router();



endpoints.get('/alimentos', async (req, resp) => {
  let alimentos = await TCC_alimento.listAlimentos();
  resp.send(alimentos);
});

endpoints.get('/alimentos/:id', async (req, resp) => {
    let id = req.params.id

    let alimento = await TCC_alimento.getAlimentos(id)
    resp.send(alimentos)
})

endpoints.post('/alimentos', async (req, resp) => {
    let alimento = req.body;
    
    let id = await TCC_alimento.saveAlimento(alimento);
    resp.send({ id });
})


export default endpoints;