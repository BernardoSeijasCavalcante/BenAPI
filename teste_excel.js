// teste_excel.js

const path = require('path');

// >>> MUDANÇA AQUI: Aponta para o novo arquivo 'esteira-json.js'
const { lerExcelETransformarParaJSON } = require('./esteira-json.js');

const diretorioDeDownload = path.join(__dirname, 'esteira ranking geral');

console.log('--- INICIANDO TESTE ISOLADO DA FUNÇÃO DE LEITURA DO EXCEL ---');
lerExcelETransformarParaJSON(diretorioDeDownload);
console.log('--- TESTE ISOLADO CONCLUÍDO ---');