// teste_processamento.js

// 1. Importa a função que queremos testar do nosso arquivo esteira-json.js
const { processarTodosOsRelatorios } = require('./esteira-json.js');

// 2. Imprime uma mensagem para sabermos que o teste começou
console.log('--- INICIANDO TESTE ISOLADO DO PROCESSAMENTO DE DADOS ---');

// 3. Executa a função
processarTodosOsRelatorios();

// 4. Imprime uma mensagem para sabermos que o teste terminou de ser chamado
console.log('--- TESTE ISOLADO CONCLUÍDO ---');