const express = require('express');
const fs = require('fs'); // Módulo para ler arquivos
const path = require('path'); // Módulo para lidar com caminhos de arquivos
require('dotenv').config();

const { executarTodosOsRankings } = require('./scraper.js'); // Importa a nova função




const app = express();

const PORT = process.env.PORT || 3000;

app.post('/iniciar-processo-completo', async (req, res) => {

    console.log('Requisição recebida para iniciar o processo completo de rankings...');

    try {

        const result = await executarTodosOsRankings();

        if (result.success) {

            res.status(200).json(result);

        } else {

            res.status(500).json(result);

        }

    } catch (error) {

        res.status(500).json({ success: false, message: 'Erro catastrófico no servidor.', error: error.message });

    }

});


/**
 * Função genérica para ler e retornar um arquivo JSON de ranking.
 * @param {string} nomeArquivo - O nome do arquivo a ser lido (ex: 'ranking_mensal.json').
 * @param {object} res - O objeto de resposta do Express.
 */
function retornarRanking(nomeArquivo, res) {
    const caminhoArquivo = path.join(__dirname, nomeArquivo);
    try {
        // Verifica se o arquivo existe antes de tentar ler
        if (fs.existsSync(caminhoArquivo)) {
            const dadosArquivo = fs.readFileSync(caminhoArquivo, 'utf-8');
            const dadosJson = JSON.parse(dadosArquivo);
            res.status(200).json(dadosJson);
        } else {
            // Se o arquivo não existe, retorna um erro 404 claro
            res.status(404).json({ success: false, message: `Arquivo ${nomeArquivo} não encontrado. Execute o processo de geração primeiro via POST em /iniciar-processo-completo.` });
        }
    } catch (error) {
        // Captura erros de leitura ou de parsing do JSON
        console.error(`Erro ao processar o arquivo ${nomeArquivo}:`, error);
        res.status(500).json({ success: false, message: `Erro ao ler ou processar o arquivo ${nomeArquivo}.`, error: error.message });
    }
}

// NOVO ENDPOINT: Rota GET para obter o ranking mensal
app.get('/ranking/mensal', (req, res) => {
    console.log('Requisição recebida para GET /ranking/mensal');
    retornarRanking('ranking_mensal.json', res);
});

// NOVO ENDPOINT: Rota GET para obter o ranking diário
app.get('/ranking/hoje', (req, res) => {
    console.log('Requisição recebida para GET /ranking/hoje');
    retornarRanking('ranking_hoje.json', res);
});


app.listen(PORT, () => {
    console.log('------------------------------------------------------------------');
    console.log('Para GERAR os arquivos de ranking, envie um POST para:');
    console.log(`http://localhost:${PORT}/iniciar-processo-completo`);
    console.log('------------------------------------------------------------------');
    console.log('Para LER os dados, envie um GET para:');
    console.log(`http://localhost:${PORT}/ranking/mensal`);
    console.log(`http://localhost:${PORT}/ranking/hoje`);
    console.log('------------------------------------------------------------------');
});