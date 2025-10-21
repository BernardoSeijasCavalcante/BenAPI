// esteira-json.js
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// ==========================================================
//                      CONFIGURAÇÃO
// ==========================================================
const colunas = {
    agente: 'Agente',
    equipe: 'Equipe',
    status: 'Status',
    valor: 'Valor Contrato'
};
const mapeamentoEquipeSupervisor = {
    'ROBSON PAULINO JUNIOR': 'DIEGO JIMINEZ RIBEIRO',
    'Robson Paulino Junior': 'NAUALLY CHRYSTHINNA SANTOS FABRI',
    'FABIO PAES COELHO': 'GUILHERME NEVES DE ALMEIDA',
    'KAROL FERNANDA FORTES': 'KAROL FERNANDA FORTES'
};
const listaExclusao = ['JOCI KELLY MENDES DE SOUZA'];

// --- NOVA CONSTANTE ---
const META_MENSAL_VENDEDOR = 450000;
// ==========================================================

// --- Funções Auxiliares ---
function lerArquivo(caminhoCompleto) {
    if (!fs.existsSync(caminhoCompleto)) {
        console.warn(`Aviso: Arquivo não encontrado em ${caminhoCompleto}. Os dados para este campo ficarão zerados.`);
        return [];
    }
    console.log(`Lendo arquivo: ${path.basename(caminhoCompleto)}`);
    const workbook = XLSX.readFile(caminhoCompleto);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet, { raw: false });
}

function parseCurrency(value) {
    if (!value) return 0;
    const stringValue = String(value);
    const cleaned = stringValue.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}

const inicializarPessoa = (nome) => ({ nome, totalDeVendas: 0, vendasConcluidas: 0, vendasPendentes: 0 });

/**
 * --- NOVA FUNÇÃO AUXILIAR ---
 * Calcula os dias úteis (Seg-Sex) do mês corrente.
 * Ignora feriados (conforme lógica solicitada).
 * @returns {object} { passados: número de dias úteis que já passaram, total: total de dias úteis no mês }
 */
function getDiasUteis() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth(); // 0-11
    const diaAtual = hoje.getDate();

    let diasUteisPassados = 0;
    let diasUteisTotais = 0;

    // Descobre o último dia do mês
    const ultimoDiaDoMes = new Date(ano, mes + 1, 0).getDate();

    // Itera por todos os dias do mês
    for (let dia = 1; dia <= ultimoDiaDoMes; dia++) {
        const dataIteracao = new Date(ano, mes, dia);
        const diaDaSemana = dataIteracao.getDay(); // 0 = Domingo, 6 = Sábado

        // Verifica se é um dia útil (Segunda a Sexta)
        if (diaDaSemana !== 0 && diaDaSemana !== 6) {
            diasUteisTotais++;
            
            // Se for um dia útil e já passou (ou é hoje), conta como "passado"
            if (dia <= diaAtual) {
                diasUteisPassados++;
            }
        }
    }
    return { passados: diasUteisPassados, total: diasUteisTotais };
}


// --- FUNÇÃO PRINCIPAL (MODIFICADA) ---
function processarConjuntoDeRelatorios(arquivos, nomeArquivoSaida) {
    console.log(`\n--- INICIANDO PROCESSAMENTO PARA GERAR: ${nomeArquivoSaida} ---`);
    
    const listaExclusaoLower = listaExclusao.map(nome => nome.toLowerCase());

    if (nomeArquivoSaida === 'ranking_mensal.json') {
        try {
            const arquivoEntrada = path.join(__dirname, 'concluida', arquivos.concluido);
            const dadosConcluidos = lerArquivo(arquivoEntrada);

            if (dadosConcluidos.length === 0) {
                 console.log(`✅ Arquivo "${nomeArquivoSaida}" não gerado pois não haviam dados de entrada.`);
                 return;
            }

            // --- LÓGICA DA META PROPORCIONAL ---
            const { passados, total } = getDiasUteis();
            let metaProporcional = 0;
            if (total > 0 && passados > 0) {
                // (Meta / Dias Totais) * Dias Passados
                metaProporcional = (META_MENSAL_VENDEDOR / total) * passados;
                console.log(`Info: Dias úteis passados: ${passados}, Total no mês: ${total}.`);
                console.log(`Info: Meta proporcional calculada: ${metaProporcional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`);
            } else {
                console.warn(`Aviso: Dias úteis não calculados (passados: ${passados}, total: ${total}). Porcentagem será 0%.`);
            }
            // --- FIM DA LÓGICA DA META ---

            const vendedores = {};
            const supervisores = {};
            const nomesSupervisores = Object.values(mapeamentoEquipeSupervisor).map(nome => nome.trim().toLowerCase());

            for (const row of dadosConcluidos) {
                const nomeAgente = String(row[colunas.agente] || '').trim();
                const nomeEquipe = String(row[colunas.equipe] || '').trim();
                if (!nomeAgente || !nomeEquipe) continue;

                const valorVenda = parseCurrency(row[colunas.valor]);

                if (!listaExclusaoLower.includes(nomeAgente.toLowerCase()) && !nomesSupervisores.includes(nomeAgente.toLowerCase())) {
                    vendedores[nomeAgente] = (vendedores[nomeAgente] || 0) + valorVenda;
                }

                const nomeSupervisor = mapeamentoEquipeSupervisor[nomeEquipe];
                if (nomeSupervisor) {
                    const nomeSupervisorLimpo = nomeSupervisor.trim();
                    supervisores[nomeSupervisorLimpo] = (supervisores[nomeSupervisorLimpo] || 0) + valorVenda;
                }
            }
            
            // Modificado para aceitar um argumento de meta (apenas para vendedores)
            const formatarRankingSimples = (pessoasObjeto, meta = 0) => {
                return Object.keys(pessoasObjeto)
                    .map(nome => ({ nome, vendasConcluidas: pessoasObjeto[nome] }))
                    .sort((a, b) => b.vendasConcluidas - a.vendasConcluidas)
                    .map((pessoa, index) => {
                        const valorVendido = pessoa.vendasConcluidas;
                        
                        // Objeto base do ranking
                        const rankingItem = {
                            ranking: `${index + 1}º`,
                            nome: pessoa.nome,
                            vendasConcluidas: valorVendido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        };

                        // Se uma meta > 0 foi passada (só para vendedores), calcula a porcentagem
                        if (meta > 0) {
                            const porcentagemValor = (valorVendido / meta) * 100;
                            // Adiciona a chave "porcentagem" ao objeto
                            rankingItem.porcentagem = `${porcentagemValor.toFixed(2).replace('.', ',')}%`;
                        } else if (meta === 0 && Object.keys(pessoasObjeto).length > 0) {
                            // Se a meta for 0 (para vendedores), define como 0%
                            // (Evita adicionar a chave para supervisores)
                            if (Object.keys(vendedores).includes(pessoa.nome)) {
                                rankingItem.porcentagem = '0,00%';
                            }
                        }

                        return rankingItem;
                    });
            };
            
            // Passa a metaProporcional apenas para o ranking de vendedores
            const rankingVendedores = formatarRankingSimples(vendedores, metaProporcional);
            const rankingSupervisores = formatarRankingSimples(supervisores); // Não passa meta
            
            const resultadoFinal = { supervisores: rankingSupervisores, vendedores: rankingVendedores };
            const caminhoSaida = path.join(__dirname, nomeArquivoSaida);
            fs.writeFileSync(caminhoSaida, JSON.stringify(resultadoFinal, null, 2));
            console.log(`✅ Sucesso! Arquivo "${nomeArquivoSaida}" gerado com porcentagem.`);
            return resultadoFinal;

        } catch (error) {
            console.error(`❌ Ocorreu um erro ao processar para ${nomeArquivoSaida}:`, error.message);
        }

    } else { // Lógica para o ranking diário (SEM ALTERAÇÕES)
        try {
            const dadosGeral = lerArquivo(path.join(__dirname, 'geral', arquivos.geral));
            const dadosConcluido = lerArquivo(path.join(__dirname, 'concluida', arquivos.concluido));
            const dadosPendente = lerArquivo(path.join(__dirname, 'pendente', arquivos.pendente));

            const vendedores = {};
            const supervisores = {};
            const nomesSupervisores = Object.values(mapeamentoEquipeSupervisor).map(nome => nome.trim().toLowerCase());

            const processarDados = (dados, campoAlvo) => {
                for (const row of dados) {
                    const nomeAgente = String(row[colunas.agente] || '').trim();
                    const nomeEquipe = String(row[colunas.equipe] || '').trim();
                    if (!nomeAgente || !nomeEquipe) continue;
                    const valor = parseCurrency(row[colunas.valor]);

                    if (!listaExclusaoLower.includes(nomeAgente.toLowerCase()) && !nomesSupervisores.includes(nomeAgente.toLowerCase())) {
                        if (!vendedores[nomeAgente]) vendedores[nomeAgente] = inicializarPessoa(nomeAgente);
                        vendedores[nomeAgente][campoAlvo] += valor;
                    }
                    
                    const nomeSupervisor = mapeamentoEquipeSupervisor[nomeEquipe];
                    if (nomeSupervisor) {
                        const nomeSupervisorLimpo = nomeSupervisor.trim();
                        if (!supervisores[nomeSupervisorLimpo]) supervisores[nomeSupervisorLimpo] = inicializarPessoa(nomeSupervisorLimpo);
                        supervisores[nomeSupervisorLimpo][campoAlvo] += valor;
                    }
                }
            };

            processarDados(dadosGeral, 'totalDeVendas');
            processarDados(dadosConcluido, 'vendasConcluidas');
            processarDados(dadosPendente, 'vendasPendentes');

            const formatarRanking = (pessoasObjeto, isSupervisor = false) => {
                return Object.values(pessoasObjeto)
                    .sort((a, b) => b.vendasConcluidas - a.vendasConcluidas)
                    .map((pessoa, index) => {
                        const rankingItem = {
                            ranking: `${index + 1}º`,
                            nome: pessoa.nome,
                            totalDeVendas: pessoa.totalDeVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                            vendasConcluidas: pessoa.vendasConcluidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                            vendasPendentes: pessoa.vendasPendentes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                        };
                        if (isSupervisor) {
                            const ticketMedioValue = pessoa.totalDeVendas > 0 ? pessoa.totalDeVendas / 8 : 0;
                            rankingItem.ticketMedio = ticketMedioValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        }
                        return rankingItem;
                    });
            };

            const rankingVendedores = formatarRanking(vendedores, false);
            const rankingSupervisores = formatarRanking(supervisores, true);
            const resultadoFinal = { supervisores: rankingSupervisores, vendedores: rankingVendedores, };
            const caminhoSaida = path.join(__dirname, nomeArquivoSaida);
            fs.writeFileSync(caminhoSaida, JSON.stringify(resultadoFinal, null, 2));
            console.log(`✅ Sucesso! Arquivo "${nomeArquivoSaida}" gerado.`);
            return resultadoFinal;

        } catch (error) {
            console.error(`❌ Ocorreu um erro ao processar para ${nomeArquivoSaida}:`, error.message);
        }
    }
}

function processarTodosOsRelatorios() {
    processarConjuntoDeRelatorios({
        geral: 'Json_vendasGeralMensal.csv',
        concluido: 'Json_vendaConcluidaMensal.csv',
        pendente: 'Json_vendaPendenteMensal.csv'
    }, 'ranking_mensal.json');

    processarConjuntoDeRelatorios({
        geral: 'Json_vendasGeralHoje.csv',
        concluido: 'Json_vendaConcluidaHoje.csv',
        pendente: 'Json_vendaPendenteHoje.csv'
    }, 'ranking_hoje.json');
}

module.exports = { processarTodosOsRelatorios };