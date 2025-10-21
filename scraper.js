// scraper.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { processarTodosOsRelatorios } = require('./esteira-json.js');

const downloadEsteiraPath = path.join(__dirname, 'esteira ranking geral');
if (!fs.existsSync(downloadEsteiraPath)){ fs.mkdirSync(downloadEsteiraPath); }

// ==========================================================
// FUNÇÕES AUXILIARES
// ==========================================================

// FUNÇÃO FINAL PARA SELECIONAR A OPÇÃO DE DATA
async function selecionarOpcaoData(page, opcaoDesejada) {
    const seletorTextoExibido = '#select2-tipodata-container';
    const seletorMenuClicavel = 'span[aria-labelledby="select2-tipodata-container"]';

    const tituloAtual = await page.$eval(seletorTextoExibido, el => el.getAttribute('title').trim().replace(/\s+/g, ' '));
    console.log(`[VALIDAÇÃO] Opção de data atual: "${tituloAtual}". Desejada: "${opcaoDesejada}".`);

    if (tituloAtual !== opcaoDesejada) {
        console.log(`[AÇÃO] Alterando para "${opcaoDesejada}"...`);
        
        await page.click(seletorMenuClicavel);
        await page.waitForSelector('.select2-results__option', { visible: true });

        // --- LÓGICA FINAL E MAIS FORTE (HOVER + MOUSEDOWN + MOUSEUP) ---
        const foiInteragidoComSucesso = await page.evaluate((texto) => {
            const xpath = `//li[contains(@class, 'select2-results__option') and normalize-space() = '${texto}']`;
            const elemento = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

            if (elemento) {
                // Criamos os eventos de mouse
                const hoverEvent = new MouseEvent('mouseover', { view: window, bubbles: true, cancelable: true });
                const downEvent = new MouseEvent('mousedown', { view: window, bubbles: true, cancelable: true });
                const upEvent = new MouseEvent('mouseup', { view: window, bubbles: true, cancelable: true });

                // Disparamos a sequência completa
                elemento.dispatchEvent(hoverEvent); // 1. Passa o mouse por cima
                elemento.dispatchEvent(downEvent);  // 2. Pressiona o botão do mouse
                elemento.dispatchEvent(upEvent);    // 3. Solta o botão do mouse
                
                return true;
            }
            return false;
        }, opcaoDesejada);

        if (!foiInteragidoComSucesso) {
            throw new Error(`A opção "${opcaoDesejada}" não foi encontrada na lista.`);
        }
        
        // Espera a confirmação visual da mudança no título do campo
        console.log('Aguardando a atualização visual do título do campo...');
        await page.waitForFunction(
            (selector, texto) => document.querySelector(selector)?.getAttribute('title').trim().replace(/\s+/g, ' ') === texto,
            { timeout: 5000 },
            seletorTextoExibido,
            opcaoDesejada
        );
        console.log(`Campo de data atualizado com sucesso para "${opcaoDesejada}".`);
    } else {
        console.log(`[INFO] Opção "${opcaoDesejada}" já está selecionada.`);
    }
}

// FUNÇÃO PARA SELECIONAR AS ETAPAS
// FUNÇÃO PARA SELECIONAR AS ETAPAS (COM FECHAMENTO SEGURO)
async function selecionarOpcoesEtapa(page, seletorBotao, opcoesDesejadas) {
    console.log('Iniciando seleção inteligente de etapas...');
    await page.waitForSelector(seletorBotao, { visible: true });
    await page.click(seletorBotao);
    await page.waitForSelector('ul.multiselect-container.dropdown-menu', { visible: true });
    console.log('Menu de etapas aberto.');
    
    console.log('Limpando seleções anteriores...');
    const seletorCliqueTodas = '#etapa ~ .btn-group li.multiselect-all a';
    await page.waitForSelector(seletorCliqueTodas, { visible: true });
    await page.click(seletorCliqueTodas);
    await page.click(seletorCliqueTodas);
    console.log('Seleções limpas. Marcando as desejadas...');
    
    const seletorDasOpcoes = '#etapa ~ .btn-group ul.multiselect-container li:not(.multiselect-all, .multiselect-filter)';
    const todasAsOpcoes = await page.$$(seletorDasOpcoes);

    for (const optionHandle of todasAsOpcoes) {
        const info = await optionHandle.evaluate(el => ({ texto: el.innerText.trim() }));
        if (opcoesDesejadas.includes(info.texto)) {
            console.log(`- Marcando a opção: "${info.texto}"`);
            await optionHandle.click();
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    // --- CORREÇÃO DO CLIQUE FANTASMA ---
    // Fechamos o menu clicando no mesmo botão que o abriu, de forma segura.
    console.log('Fechando o menu de Etapas de forma segura...');
    await page.click(seletorBotao);
    console.log('Seleção de etapas ajustada.');
}

async function preencherFiltrosComuns(page, tipoPeriodo) {
    console.log('Preenchendo filtros comuns (Datas e Equipes)...');
    
    // --- LÓGICA DE DATAS (LIMPAR E DIGITAR) ---
    try {
        // --- MUDANÇA 2: Lógica de Datas agora é flexível ---
            let dataInicio, dataFim;
            const hoje = new Date();
            const formataData = (data) => { return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`; };

            if (tipoPeriodo === 'diario') {
                console.log('Calculando período: diário (somente hoje).');
                dataInicio = formataData(hoje);
                dataFim = formataData(hoje);
            } else { // Padrão é 'mensal'
                console.log('Calculando período: mensal (início do mês até hoje).');
                const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                dataInicio = formataData(primeiroDiaDoMes);
                dataFim = formataData(hoje);
            }
            // --------------------------------------------------

            await page.click('#data_inicial', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('#data_inicial', dataInicio);
            await page.click('#data_final', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('#data_final', dataFim);
            console.log(`Datas preenchidas: de ${dataInicio} a ${dataFim}.`);

    } catch (e) {
        console.error('❌ Erro ao preencher as datas:', e.message);
        throw e;
    }

    // --- LÓGICA DE EQUIPES (GARANTIR QUE "TODAS" ESTEJA MARCADO) ---
    try {
        console.log('Ajustando seleção de equipes...');
        const seletorBotaoEquipes = '#cod_equipe ~ .btn-group button';
        const seletorDivPaiEquipes = '#cod_equipe ~ .btn-group';
        
        // 1. Abrir o menu
        await page.evaluate((selector) => {
            const el = document.querySelector(selector);
            if (el) el.click(); else throw new Error(`Botão de equipes ('${selector}') não foi encontrado.`);
        }, seletorBotaoEquipes);

        // 2. Esperar o menu ser considerado "aberto" (pela classe 'open')
        await page.waitForFunction((selector) => document.querySelector(selector)?.classList.contains('open'), { timeout: 5000 }, seletorDivPaiEquipes);
        console.log('Menu de equipes aberto.');

        // 3. Esperar a opção "Todas" ficar visível
        const seletorLiTodasEquipes = '#cod_equipe ~ .btn-group li.multiselect-all';
        await page.waitForSelector(seletorLiTodasEquipes, { visible: true, timeout: 5000 });
        
        // 4. Verificar o estado atual
        const todasJaSelecionadas = await page.$eval(seletorLiTodasEquipes, li => li.classList.contains('active'));
        
        // 5. Clicar somente se necessário
        if (!todasJaSelecionadas) {
            console.log('Ação: Clicando em "Todas" para selecionar as equipes...');
            const seletorCliqueTodasEquipes = '#cod_equipe ~ .btn-group li.multiselect-all label';
            await page.evaluate((selector) => {
                document.querySelector(selector).click();
            }, seletorCliqueTodasEquipes);
        } else {
            console.log('Ação: Todas as equipes já estão selecionadas.');
        }

        // 6. Fechar o menu
        await page.click('body');
        console.log('Seleção de equipes concluída.');
    } catch (e) {
        console.error('❌ Erro ao selecionar as equipes:', e.message);
        await page.screenshot({ path: 'erro_selecao_equipes.png' });
        console.log('Screenshot do erro salvo em erro_selecao_equipes.png.');
        throw e;
    }
}
// Função para buscar e baixar o relatório
async function buscarEBaixarRelatorio(page, diretorioDeDownload, nomeDoArquivo) {
    await page.click('button[name="enviarfiltro"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: diretorioDeDownload });
    await page.click('button[data-original-title="Extrair Excel"]');
    console.log(`Comando de download enviado. Aguardando 15 segundos...`);
    await new Promise(resolve => setTimeout(resolve, 15000));

    const files = fs.readdirSync(diretorioDeDownload);
    if (files.length > 0) {
        const downloadedFile = files.sort((a, b) => fs.statSync(path.join(diretorioDeDownload, b)).mtime.getTime() - fs.statSync(path.join(diretorioDeDownload, a)).mtime.getTime())[0];
        fs.renameSync(path.join(diretorioDeDownload, downloadedFile), path.join(diretorioDeDownload, nomeDoArquivo));
        console.log(`Arquivo renomeado para: ${nomeDoArquivo}`);
    }
}

async function executarTodosOsRankings() {
    console.log('Iniciando o robô orquestrador...');
    const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    const cenarios = [
        { nome: 'Json_vendaConcluidaMensal', etapas: [], tipoData: 'Data Pagamento', pasta: 'concluida', tipoPeriodo: 'mensal' },
        { nome: 'Json_vendasGeralHoje', etapas: ['Andamento', 'Pendente', 'Pago'], tipoData: 'Data Cadastro', pasta: 'geral', tipoPeriodo: 'diario' },
        { nome: 'Json_vendaConcluidaHoje', etapas: ['Andamento', 'Pago'], tipoData: 'Data Cadastro', pasta: 'concluida', tipoPeriodo: 'diario' },
        { nome: 'Json_vendaPendenteHoje', etapas: ['Pendente'], tipoData: 'Data Cadastro', pasta: 'pendente', tipoPeriodo: 'diario' }
    ];

    try {
        await page.goto(process.env.SITE_URL, { waitUntil: 'networkidle2' });
        await page.type('#exten', process.env.MEU_USUARIO);
        await page.type('#password', process.env.MINHA_SENHA);
        await Promise.all([ page.click('#button-sigin'), page.waitForNavigation({ waitUntil: 'networkidle2' }) ]);
        const urlEsteira = 'https://gestao.sistemacorban.com.br/index.php/esteira';
        
        for (const cenario of cenarios) {
            console.log(`\n--- BAIXANDO RELATÓRIO PARA CENÁRIO: ${cenario.nome} ---`);
            const diretorioCenario = path.join(__dirname, cenario.pasta);
            if (!fs.existsSync(diretorioCenario)) { fs.mkdirSync(diretorioCenario); }

            await page.goto(urlEsteira, { waitUntil: 'networkidle2' });
            
            await selecionarOpcaoData(page, cenario.tipoData);
            await preencherFiltrosComuns(page, cenario.tipoPeriodo);
            await selecionarOpcoesEtapa(page, '#etapa + .btn-group button', cenario.etapas);
            await buscarEBaixarRelatorio(page, diretorioCenario, `${cenario.nome}.csv`);
        }
        
        console.log("\n--- DOWNLOADS CONCLUÍDOS. INICIANDO PROCESSAMENTO FINAL. ---");
        const resultadoFinal = processarTodosOsRelatorios();

        return { success: true, message: "Todos os relatórios foram baixados e processados.", data: resultadoFinal };
    }
         catch (error) {
        console.error('!!!!!!!!!! OCORREU UM ERRO DURANTE A EXECUÇÃO !!!!!!!!!!', error.message);
        return { success: false, message: error.message };
    } finally {
        if (browser) await browser.close();
        console.log('Navegador fechado.');
    }
}

module.exports = { executarTodosOsRankings };