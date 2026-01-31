// --- DADOS ---
let transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
let parcelamentos = JSON.parse(localStorage.getItem('parcelamentos')) || [];
let fixas = JSON.parse(localStorage.getItem('fixas')) || [];
let anoVisivel = new Date().getFullYear();
let mesSelecionadoIndex = new Date().getMonth();

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    gerarBotoesMeses();
    resetarFormulario();
    atualizarTudo();
});

// --- UI E UTILITÁRIOS ---
const formatarBRL = (v) => Number(v || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const gerarId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

function gerarBotoesMeses() {
    const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
    const container = document.getElementById('grid-meses');
    container.innerHTML = '';
    
    meses.forEach((m, i) => {
        const btn = document.createElement('button');
        btn.innerText = m;
        btn.className = "border rounded p-1 bg-white hover:bg-gray-200 focus:bg-blue-100 focus:border-blue-500 uppercase transition";
        btn.onclick = () => selecionarMes(i);
        container.appendChild(btn);
    });
}

function atualizarDataList() {
    const list = document.getElementById('cat-suggestions');
    const categorias = [...new Set(transacoes.map(d => d.categoria))];
    list.innerHTML = categorias.map(c => `<option value="${c}">`).join('');
}

function trocarAba(aba){
    // Atualizado para refletir a nova ordem visual
    ['geral','meses','parcelas'].forEach(a=>{
        document.getElementById('aba-'+a).classList.add('hidden');
        document.getElementById('tab-'+a).classList.remove('bg-blue-600','text-white');
    });
    document.getElementById('aba-'+aba).classList.remove('hidden');
    document.getElementById('tab-'+aba).classList.add('bg-blue-600','text-white');
    
    if (aba === 'meses') { // Aba Histórico
        atualizarDisplayAno();
        selecionarMes(mesSelecionadoIndex);
    }
}

function toggleConfig() {
    const box = document.getElementById('config-box');
    box.classList.toggle('hidden');
}

function mudarCorFormulario() {
    const tipo = document.getElementById('input-tipo').value;
    const btn = document.getElementById('btn-salvar');
    const box = document.getElementById('form-box');
    
    let borderColor = 'border-red-500';
    let btnClass = 'bg-red-500 hover:bg-red-600';
    let btnText = 'Adicionar Despesa';

    if(tipo === 'receita') {
        borderColor = 'border-green-500';
        btnClass = 'bg-green-500 hover:bg-green-600';
        btnText = 'Adicionar Receita';
    } else if (tipo === 'fixa') {
        borderColor = 'border-blue-500';
        btnClass = 'bg-blue-500 hover:bg-blue-600';
        btnText = 'Agendar Fixa Mensal';
    }

    box.className = `bg-white p-4 rounded-xl shadow border-l-4 ${borderColor} transition-all`;
    btn.className = `w-full ${btnClass} text-white p-3 rounded font-bold transition shadow-md active:transform active:scale-95`;
    btn.innerText = btnText;
}

function resetarFormulario(){
    const hoje = new Date().toISOString().split('T')[0];
    
    // Formulário Geral
    document.getElementById('input-descricao').value = '';
    document.getElementById('input-valor').value = '';
    document.getElementById('input-categoria').value = ''; 
    document.getElementById('input-data').value = hoje; 
    
    // Formulário Parcelamento
    document.getElementById('p-descricao').value = '';
    document.getElementById('p-valor').value = '';
    document.getElementById('p-qtd').value = '';
    document.getElementById('p-data').value = hoje;
}

// --- CONTROLE DE ANO ---
function mudarAno(delta) {
    anoVisivel += delta;
    atualizarDisplayAno();
    selecionarMes(mesSelecionadoIndex);
}

function atualizarDisplayAno() {
    document.getElementById('ano-display').innerText = anoVisivel;
}

// --- BACKUP ---
function baixarBackup() {
    const dados = { transacoes, parcelamentos, fixas };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dados));
    const el = document.createElement('a');
    el.setAttribute("href", dataStr);
    el.setAttribute("download", "financeiro_backup.json");
    document.body.appendChild(el); el.click(); el.remove();
}

function carregarBackup(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        if(confirm("Substituir dados atuais?")) {
            try {
                const d = JSON.parse(e.target.result);
                transacoes = d.transacoes || [];
                parcelamentos = d.parcelamentos || [];
                fixas = d.fixas || [];
                salvarDados();
                localStorage.setItem('parcelamentos', JSON.stringify(parcelamentos));
                localStorage.setItem('fixas', JSON.stringify(fixas));
                atualizarTudo();
                alert("Carregado!");
                toggleConfig();
            } catch(e) { alert("Erro no arquivo."); }
        }
    };
    reader.readAsText(file);
    input.value = '';
}

// --- LÓGICA DE NEGÓCIO ---
function processarFixas() {
    const hoje = new Date();
    const mesAtualStr = hoje.toISOString().slice(0, 7); 
    let salvou = false;

    fixas.forEach(f => {
        const mesInicio = f.inicio ? f.inicio.slice(0, 7) : '0000-00';
        if (mesAtualStr >= mesInicio) {
            const existe = transacoes.some(t => t.parentId === f.id && t.data.startsWith(mesAtualStr));
            if (!existe) {
                const dia = f.inicio ? f.inicio.split('-')[2] : '01';
                transacoes.push({
                    id: gerarId(),
                    parentId: f.id,
                    descricao: f.descricao + " (Fixa)",
                    valor: Number(f.valor),
                    data: mesAtualStr + '-' + dia,
                    categoria: f.categoria,
                    tipo: 'fixa_gerada' 
                });
                salvou = true;
            }
        }
    });
    if(salvou) salvarDados();
}

function salvarTransacao(){
    const tipo = document.getElementById('input-tipo').value;
    const desc = document.getElementById('input-descricao').value.trim();
    const val = Number(document.getElementById('input-valor').value);
    const data = document.getElementById('input-data').value;
    const cat = document.getElementById('input-categoria').value.trim();

    if(!desc || !val || !data || !cat || val <= 0) return alert("Preencha tudo.");

    if(tipo === 'fixa') {
        fixas.push({ id: gerarId(), descricao: desc, valor: val, inicio: data, categoria: cat });
        localStorage.setItem('fixas', JSON.stringify(fixas));
        processarFixas();
    } else {
        transacoes.push({ id: gerarId(), descricao: desc, valor: val, data, categoria: cat, tipo });
        salvarDados();
    }
    resetarFormulario();
    atualizarTudo();
}

function salvarParcelamento(){
    const desc = document.getElementById('p-descricao').value.trim();
    const valor = Number(document.getElementById('p-valor').value);
    const qtd = Number(document.getElementById('p-qtd').value);
    const data = document.getElementById('p-data').value;

    if(!desc || !valor || !qtd || !data) return alert("Preencha tudo.");

    const parentId = gerarId();
    parcelamentos.push({id: parentId, desc, valor, qtd, data});
    localStorage.setItem('parcelamentos', JSON.stringify(parcelamentos));

    for(let i=0;i<qtd;i++){
        const d = new Date(data);
        d.setMonth(d.getMonth()+i);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        transacoes.push({
            id: gerarId(), parentId, descricao: `${desc} (${i+1}/${qtd})`,
            valor, data: d.toISOString().split('T')[0],
            categoria: 'Parcelamento', tipo: 'despesa'
        });
    }
    salvarDados();
    resetarFormulario();
    atualizarTudo();
}

function deletarItem(id) {
    if(!confirm("Apagar?")) return;
    transacoes = transacoes.filter(t => t.id !== id);
    salvarDados();
    atualizarTudo();
}
function deletarFixa(id) {
    if(!confirm("Parar recorrência?")) return;
    fixas = fixas.filter(f => f.id !== id);
    localStorage.setItem('fixas', JSON.stringify(fixas));
    atualizarTudo();
}
function deletarParcelamento(id) {
    if(!confirm("Apagar tudo?")) return;
    parcelamentos = parcelamentos.filter(p => p.id !== id);
    localStorage.setItem('parcelamentos', JSON.stringify(parcelamentos));
    transacoes = transacoes.filter(t => t.parentId !== id);
    salvarDados();
    atualizarTudo();
}

function salvarDados() { localStorage.setItem('transacoes', JSON.stringify(transacoes)); }

// --- RENDERIZAÇÃO ---
function renderizarLista(containerId, lista) {
    const c = document.getElementById(containerId);
    c.innerHTML = '';
    if(lista.length === 0) return c.innerHTML = '<p class="text-gray-400 text-center text-sm">Vazio.</p>';

    lista.sort((a,b) => new Date(b.data) - new Date(a.data));
    const dias = [...new Set(lista.map(i => i.data))];

    dias.forEach(dia => {
        const itensDia = lista.filter(i => i.data === dia);
        const diaFmt = dia.split('-').reverse().slice(0,2).join('/');
        
        const itensHtml = itensDia.map(item => {
            let classe = item.tipo === 'receita' ? 'border-green-400 text-green-600' : 'border-red-400 text-red-500';
            let sinal = item.tipo === 'receita' ? '+' : '-';
            let extra = '';
            
            if(item.tipo === 'fixa_gerada' || item.tipo === 'previsao' || item.descricao.includes('(Fixa)')) {
                classe = 'border-blue-400 text-blue-500';
            }
            if(item.tipo === 'previsao') extra = 'item-previsao bg-gray-50';

            return `
            <div class="bg-white border-l-4 ${classe.split(' ')[0]} ${extra} p-2 rounded shadow-sm flex justify-between items-center mb-1 transition hover:shadow-md">
                <div>
                    <div class="font-semibold text-gray-700 text-sm">${item.descricao}</div>
                    <div class="text-xs text-gray-400">${item.categoria}</div>
                </div>
                <div class="flex items-center">
                    <span class="font-mono font-bold ${classe.split(' ')[1]} mr-2">${sinal} ${formatarBRL(item.valor)}</span>
                    ${item.tipo !== 'previsao' ? `<span class="btn-delete text-gray-300" onclick="deletarItem('${item.id}')">×</span>` : ''}
                </div>
            </div>`;
        }).join('');

        c.innerHTML += `<div class="mb-2"><p class="text-xs font-bold text-gray-400 mb-1">${diaFmt}</p>${itensHtml}</div>`;
    });
}

function calcularSaldos() {
    const hojeStr = new Date().toISOString().split('T')[0];
    let real = 0; // Removida a variável futuro
    transacoes.forEach(t => {
        let v = t.tipo === 'receita' ? t.valor : -t.valor;
        // Removido cálculo de projeção
        if(t.data <= hojeStr) real += v;
    });
    const el = document.getElementById('saldo-acumulado');
    el.innerText = formatarBRL(real);
    el.className = real>=0?"text-3xl font-bold text-white":"text-3xl font-bold text-red-200";
    
    // Removido document.getElementById('saldo-futuro') pois não existe mais no HTML
    
    const mesAtual = new Date().toISOString().slice(0,7);
    renderizarLista('lista-recentes', transacoes.filter(t => t.data.startsWith(mesAtual)));
}

function selecionarMes(mIndex) {
    mesSelecionadoIndex = mIndex;
    const mesStr = `${anoVisivel}-${String(mIndex+1).padStart(2,'0')}`; 
    
    let lista = transacoes.filter(t => t.data.startsWith(mesStr));

    fixas.forEach(f => {
        const mesInicio = f.inicio ? f.inicio.slice(0, 7) : '0000-00';
        if (mesStr >= mesInicio) {
            const jaTem = lista.some(t => t.parentId === f.id);
            if(!jaTem) {
                const dia = f.inicio ? f.inicio.split('-')[2] : '01';
                lista.push({
                    id: 'temp', descricao: f.descricao + " (Previsto)", valor: Number(f.valor),
                    data: mesStr + '-' + dia, categoria: f.categoria, tipo: 'previsao'
                });
            }
        }
    });

    // REMOVIDO: Cálculo de saldo do mês para não exibir no histórico
    // Apenas mostramos o label do mês (Ex: 01/2026)
    document.getElementById('conteudo-mes-info').innerHTML = 
        `${mesStr.split('-').reverse().slice(0,2).join('/')}`;

    renderizarLista('conteudo-mes', lista);
}

function atualizarListasAuxiliares() {
    const listaFixas = document.getElementById('lista-fixas');
    listaFixas.innerHTML = fixas.map(f => {
        let inicio = f.inicio ? f.inicio.split('-').reverse().join('/') : "Imediato";
        return `<div class="border p-2 rounded mb-2 flex justify-between bg-blue-50 text-sm border-blue-200">
            <div><span class="font-bold text-blue-700">${f.descricao}</span><div class="text-xs text-gray-500">${formatarBRL(f.valor)} | Início: ${inicio}</div></div>
            <button class="text-red-500 font-bold" onclick="deletarFixa('${f.id}')">Parar</button></div>`;
    }).join('') || '<p class="text-gray-400 text-xs">Vazio.</p>';

    const listaP = document.getElementById('lista-parcelamentos');
    listaP.innerHTML = parcelamentos.map(p => {
        let inicio = p.data.split('-').reverse().join('/');
        return `<div class="border p-2 rounded mb-2 flex justify-between bg-gray-50 text-sm">
            <div><span class="font-bold text-gray-700">${p.desc}</span><div class="text-xs text-gray-500">${p.qtd}x ${formatarBRL(p.valor)} | Início: ${inicio}</div></div>
            <button class="text-red-500 font-bold" onclick="deletarParcelamento('${p.id}')">Excluir</button></div>`;
    }).join('') || '<p class="text-gray-400 text-xs">Vazio.</p>';
}

function atualizarTudo(){
    processarFixas();
    calcularSaldos();
    atualizarDataList();
    atualizarListasAuxiliares();
    atualizarDisplayAno();
    if(!document.getElementById('aba-meses').classList.contains('hidden')) selecionarMes(mesSelecionadoIndex);
}