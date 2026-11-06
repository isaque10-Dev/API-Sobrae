import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../src/utils/validation.js';
import { hashPassword, verifyPassword } from '../src/utils/security.js';

test('quantidade do formulário React aceita unidades e decimais', () => {
  const value = v.food({ nome: 'Arroz', categoria: 'Outro', quantidade: '2,5 kg', validade: '2099-12-31' });
  assert.equal(value.quantidade, 2.5); assert.equal(value.unidade, 'kg');
  assert.equal(value.tipo, 'Outro');
});
test('validação rejeita quantidades inválidas, datas inexistentes e IDs malformados', () => {
  for (const quantidade of [0, -1, '5 kg lixo 3', {}, 0.0001, Infinity]) assert.throws(() => v.food({ nome: 'Arroz', categoria: 'Outro', quantidade, validade: '2099-12-31' }));
  for (const date of ['2020-01-01', '2099-02-30', '2099-13-01', 'qualquer']) assert.throws(() => v.date(date));
  for (const id of ['1 OR 1=1', '0', '-1', '1.5', [], [1], '9007199254740993']) assert.throws(() => v.id(id));
});
test('documentos formatados são normalizados e conferidos', () => {
  assert.equal(v.document('529.982.247-25', 'CPF'), '52998224725');
  assert.equal(v.document('11.222.333/0001-81', 'CNPJ', true), '11222333000181');
  assert.throws(() => v.document('11111111111', 'CPF'));
  assert.throws(() => v.document('11222333000182', 'CNPJ'));
});
test('senhas usam sal individual e verificação segura', async () => {
  const first = await hashPassword('Teste123!');
  const second = await hashPassword('Teste123!');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('Teste123!', first), true);
  assert.equal(await verifyPassword('SenhaErrada!', first), false);
  assert.equal(await verifyPassword('Teste123!', 'Teste123!'), false);
});
