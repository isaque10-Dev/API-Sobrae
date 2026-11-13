# API Sobraê

Backend Express + MySQL para as telas do projeto React `TCC/sobrae`.
Implementa contas pessoais e empresariais, login, perfil, alimentos, doações,
solicitações, aprovação pelo doador, retirada, histórico e notificações.

## Executar

Requisitos: Node.js 22 ou superior e MySQL 8.0.16 ou superior.

1. Abra a pasta `API-Sobrae` no VS Code.
2. Instale as dependências com `npm install` se ainda não estiverem instaladas.
3. Configure `.env.local` usando `.env.example` como referência. Preserve seu `PORT` atual.
   O projeto existente usa `PORT=50100` no `.env`; esse valor tem prioridade.
   `DB_PASSWORD` deve ser a senha do seu MySQL. `.env.local` é ignorado pelo Git.
4. Com o MySQL ligado, execute `npm run db:setup`.
5. Execute `npm run dev` (reinicia ao salvar) ou `npm start`.
6. Consulte `GET http://localhost:50100/health`, ajustando a porta ao seu `.env`.

`db:setup` cria o banco se necessário e atualiza a estrutura antiga sem excluir
tabelas ou registros. Pode ser repetido. Acrescenta proprietários aos alimentos,
local de retirada, descrição, sessões, notificações e propostas de eventos solidários;
permite quantidades decimais.
Senhas antigas em texto são convertidas para hash, mantendo a senha utilizada no login.
Faça backup do banco antes de migrar dados importantes; alterações de estrutura MySQL
não são revertidas por transação. Alimentos antigos sem dono permanecem sem dono:
a API não atribui os registros a um usuário arbitrário.

O arquivo `script.sql` cria uma instalação nova no banco `TCC_alimento`.
Para atualizar uma instalação antiga ou usar outro `DB_NAME`, use `npm run db:setup`.
As tabelas antigas `status_pessoal` e `status_empresa` são preservadas, mas os
indicadores da API são calculados a partir das doações e solicitações reais.

## Autenticação

Cadastro e login retornam `{ token, expira_em, usuario }`. Nas rotas privadas,
envie `Authorization: Bearer SEU_TOKEN`. O token expira em 24 horas e o logout o
revoga. A troca de senha revoga todas as sessões da conta. Senhas nunca aparecem
nas respostas e tokens são armazenados somente como hash no banco.

Cadastro de pessoa física (CPF e telefone são opcionais, conforme o formulário React):

```json
{
  "tipo": "pessoa",
  "nome": "Seu nome",
  "email": "voce@example.com",
  "senha": "UmaSenhaForte123!"
}
```

Cadastro de empresa usa `tipo: "empresa"`, `nome_empresa`, `cnpj_empresa`,
`email`, `senha` e, opcionalmente, `num_telefone`. CPF/CNPJ são conferidos pelos
dígitos verificadores; isso não consulta a existência do documento na Receita.

Login: `POST /auth/login` com `{ "email": "...", "senha": "..." }`.
Como o banco original tem duas tabelas de contas, um mesmo e-mail pode existir
uma vez em cada tipo. Nesse caso, envie também `tipo: "pessoa"` ou `"empresa"`.
Novas senhas precisam ter entre 8 e 128 caracteres. O login aceita senhas legadas
mais curtas para não bloquear contas existentes após a migração.

## Rotas

Salvo as rotas marcadas como públicas, todas exigem autenticação.
Listagens retornam arrays; `pagina` começa em 1 e `limite` vai de 1 a 100 (padrão 20).

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/health` | Verifica conexão com o banco (pública) |
| POST | `/auth/cadastro` | Cadastra conta e inicia sessão (pública) |
| POST | `/auth/login` | Inicia sessão (pública) |
| POST | `/auth/logout` | Encerra sessão atual |
| GET | `/auth/me` ou `/perfil` | Dados da própria conta |
| PATCH / PUT | `/perfil` | Atualiza nome, e-mail, documento, telefone e preferências |
| PATCH | `/perfil/senha` | Troca senha com `senha_atual` e `nova_senha` |
| POST | `/contapessoal` | Cadastro pessoal alternativo (pública) |
| POST | `/contaempresarial` | Cadastro empresarial alternativo (pública) |
| GET / PUT | `/contapessoal/:id` | Consulta/atualiza a própria conta pessoal |
| GET / PUT | `/contaempresarial/:id` | Consulta/atualiza a própria conta empresarial |
| GET / POST | `/alimentos` | Lista alimentos próprios / cria alimento avulso |
| GET / PUT / DELETE | `/alimentos/:id` | Consulta, altera ou exclui alimento próprio avulso |
| GET | `/doacoes` | Catálogo público de doações disponíveis e não vencidas |
| GET | `/doacoes/:id` | Detalhe público de doação disponível |
| GET | `/doacoes/minhas` | Doações da própria conta, incluindo encerradas |
| POST | `/doacoes` | Publica alimento e doação numa única transação |
| PUT | `/doacoes/:id` | Edita doação disponível sem solicitações abertas |
| DELETE | `/doacoes/:id` | Cancela doação e suas solicitações; preserva histórico |
| POST | `/doacoes/:id/solicitacoes` | Solicita reserva |
| POST | `/solicitacoes` | Solicita reserva com `{ "id_doacao": 1 }` |
| GET | `/solicitacoes` | Minhas solicitações |
| GET | `/solicitacoes?recebidas=true` | Solicitações recebidas nas minhas doações |
| PATCH | `/solicitacoes/:id/status` | Aprova, recusa, cancela ou confirma retirada |
| GET | `/atividades/resumo` | Indicadores da própria conta |
| GET | `/statuspessoal` ou `/statuspessoal/:id` | Indicadores pessoais (somente própria conta) |
| GET | `/statusempresa` ou `/statusempresa/:id` | Indicadores empresariais (somente própria conta) |
| GET | `/historico` | Doações e solicitações da própria conta |
| GET | `/notificacoes` | Avisos da própria conta |
| PATCH | `/notificacoes/:id/lida` | Marca um aviso próprio como lido |
| DELETE | `/notificacoes` | Limpa os avisos da própria conta |
| POST | `/eventos-solidarios` | Envia uma proposta de evento solidário |
| GET | `/eventos-solidarios/minhas` | Lista as próprias propostas e seus status |
| GET | `/eventos-solidarios/:id` | Consulta uma proposta própria |

Atualização do perfil: troca de e-mail exige `senha_atual`. Não é possível mudar
o tipo de uma conta existente. Preferências: `usar_localizacao` booleano e
`distancia_km` com 5, 10 ou 20.

## Eventos solidários e administração

`npm run db:setup` executa a migração incremental
`scripts/migrations/001-eventos-solidarios.js`. Ela cria somente a tabela
`propostas_eventos` quando ela ainda não existe, portanto pode ser executada mais
de uma vez sem apagar propostas nem dados das tabelas antigas. `script.sql` não é
alterado por essa atualização.

Para liberar o painel administrativo, configure uma conta real no `.env.local`:

```env
ADMIN_CONTAS=pessoa:1
```

O formato é `pessoa:ID` ou `empresa:ID`; a verificação ocorre na API, não no
navegador. Somente essa conta pode usar as rotas abaixo:

| Método | Rota | Função |
| --- | --- | --- |
| GET | `/admin/eventos-solidarios` | Lista todas as propostas, com dados para análise |
| PATCH | `/admin/eventos-solidarios/:id/status` | Aprova ou recusa com `{ "status": "aprovada"|"recusada", "justificativa": "opcional" }` |

## Publicação e reserva

`POST /doacoes` aceita os mesmos nomes do formulário React:

```json
{
  "nome": "Arroz",
  "categoria": "Outro",
  "quantidade": "2,5 kg",
  "validade": "2027-12-31",
  "retirada": "Portaria, Rua Exemplo, 123",
  "descricao": "Pacotes fechados"
}
```

Também aceita `tipo`, `data_vencimento`, `local_retirada` e quantidade numérica
com `unidade` separada. Para publicar um alimento avulso já criado, envie
`id_alimento` e `retirada`. O alimento deve ser seu e ainda não estar vinculado
a outra doação. O proprietário sempre vem da sessão, nunca de IDs enviados no corpo.

Filtros: `/doacoes?categoria=Pães&busca=padaria&pagina=1&limite=20`.
Em `/doacoes/minhas`, também pode filtrar `status=disponivel|reservado|concluido|cancelado`.
`situacao` apresenta `expirado` quando a validade passou, sem modificar o histórico.
Datas de validade seguem o dia em `America/Sao_Paulo`.

1. Um usuário publica uma doação: `disponivel`.
2. Outra conta solicita: solicitação `pendente`; ainda não é reserva confirmada.
3. O doador envia `{ "status": "aprovada" }`: doação `reservado`.
   As outras solicitações pendentes são recusadas e notificadas.
4. Após a retirada, o doador envia `{ "status": "concluida" }`:
   doação `concluido`, alimento `doado`.
5. O solicitante pode enviar `cancelada` enquanto pendente/aprovada;
   cancelar uma aprovada libera a doação novamente (se não estiver vencida).
6. O doador pode recusar uma pendente ou cancelar a doação inteira.

Uma solicitação vale para o lote inteiro. Não há retirada parcial. A doação
é travada dentro de uma transação para impedir aprovação dupla concorrente.
Contagem de doações é por lote; `impacto_kg` soma somente lotes concluídos em
kg/quilo/quilos ou g/grama/gramas. Cestas, sacos e unidades não são convertidos
em peso sem uma medida real.

Erros retornam `{ "erro": "mensagem" }`: 400 dados inválidos, 401 sessão inválida,
403 acesso indevido, 404 inexistente, 409 conflito, 429 excesso de tentativas,
503 banco indisponível. Use `response.ok` no React; não trate todo retorno como sucesso.

## O que muda no React

O React existente ainda não chama esta API. Nenhuma tela foi modificada nesta
etapa. O backend está preparado para substituir os dados fictícios e o uso de
`localStorage` como banco. O arquivo `examples/api-client.js` oferece um cliente
`fetch` para copiar ao frontend e usar nos eventos dos formulários.

| Tela | Integração necessária |
| --- | --- |
| Cadastro | Enviar formulário a `/auth/cadastro` e guardar a sessão |
| Login | Chamar `/auth/login`, mostrar erros e navegar após sucesso |
| Doações | Buscar catálogo, publicar pelo POST e solicitar reserva pelo ID real |
| Atividades | Buscar `/doacoes/minhas` e `/solicitacoes`; adicionar visão de solicitações recebidas para aprovação/retirada |
| Perfil | Buscar `/perfil`, salvar alterações e carregar `/atividades/resumo` |
| Histórico | Buscar `/historico` |
| Notificações | Buscar `/notificacoes`, marcar leitura ou limpar |
| Sair / senha | Chamar logout ou troca de senha e limpar sessão no navegador |

Pontos que dependem de serviços ou trabalho adicional fora desta API:

- Recuperação de senha por e-mail: precisa configurar um serviço de envio e
  uma tela de redefinição. O link atual "Esqueceu sua senha?" ainda não funciona.
- Busca por distância: as preferências são salvas, mas ainda faltam coordenadas
  das doações e integração de localização no React; a API não filtra por quilômetros.
- Fotos: o React usa imagens estáticas; não foi criado serviço de upload.
- Publicação na internet: requer hospedagem, HTTPS, banco de produção e configuração
  das origens permitidas. O limite de tentativas atual é em memória por processo;
  múltiplas instâncias precisam de armazenamento compartilhado para esse limite.

## Testes

- `npm test`: validação de dados e proteção de senhas; não precisa de banco.
- `npm run test:integration`: usa as credenciais MySQL do `.env`/`.env.local`, cria bancos
  temporários `sobrae_test_*` e os remove ao terminar. Precisa de permissão para
  criar/remover esses bancos. Nunca limpa `DB_NAME` do aplicativo.

Os testes exercitam rotas HTTP reais, concorrência, isolamento entre usuários,
expiração/revogação de sessões e atualização repetida do esquema antigo.

Referências de implementação: [Express — erros assíncronos](https://expressjs.com/guide/error-handling/)
e [MySQL — locking reads](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html).
