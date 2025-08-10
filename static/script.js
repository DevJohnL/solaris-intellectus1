document.addEventListener('DOMContentLoaded', function() {
    const addBtn = document.getElementById('add-equipment-btn');
    const equipmentList = document.getElementById('equipment-list');
    const form = document.getElementById('dimensioning-form');
    let equipmentCount = 0;

    // Adiciona o primeiro equipamento
    addEquipment(); 

    addBtn.addEventListener('click', addEquipment);

    function addEquipment() {
        equipmentCount++;
        const newItem = document.createElement('div');
        newItem.classList.add('equipment-item');
        newItem.setAttribute('data-id', equipmentCount);
        
        newItem.innerHTML = `
            <h4>Equipamento #${equipmentCount} <button type="button" class="remove-btn">Remover</button></h4>
            <div class="form-group">
                <label>Tipo de Equipamento:</label>
                <select name="type" class="equip_type">
                    <option value="geladeira" selected>Geladeira / Freezer</option>
                    <option value="ar_condicionado">Ar Condicionado</option>
                    <option value="lampada">Lâmpada LED</option>
                    <option value="tv">Televisão</option>
                    <option value="bomba">Bomba d'água</option>
                    <option value="outro">Outro (especificar)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Potência (W):</label>
                <input type="number" name="potencia" value="150" min="1" required>
            </div>
            <div class="form-group">
                <label>Quantidade:</label>
                <input type="number" name="quantidade" value="1" min="1" required>
            </div>
            <div class="form-group">
                <label>Tempo de Uso Diário (horas):</label>
                <input type="number" name="tempo_uso" step="0.5" value="8" min="0.5" required>
            </div>
            <div class="advanced-fields hidden">
                 <p><small>Para equipamentos "Outro", preencha os dados abaixo.</small></p>
                 <div class="form-group">
                    <label>Fator de Potência (ex: 0.9):</label>
                    <input type="number" name="fp" step="0.05" value="0.9">
                 </div>
                 <div class="form-group">
                    <label>Relação Pico/Nominal (IP/IN):</label>
                    <input type="number" name="ipin" step="0.5" value="1">
                 </div>
            </div>
        `;
        equipmentList.appendChild(newItem);
    }

    equipmentList.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-btn')) {
            e.target.closest('.equipment-item').remove();
        }
    });
    
    equipmentList.addEventListener('change', (e) => {
        if (e.target.classList.contains('equip_type')) {
            const advancedFields = e.target.closest('.equipment-item').querySelector('.advanced-fields');
            advancedFields.classList.toggle('hidden', e.target.value !== 'outro');
        }
    });

    // --- A MÁGICA ACONTECE AQUI ---
    form.addEventListener('submit', function(e) {
        e.preventDefault(); // Impede o recarregamento da página

        // 1. Coleta os dados do formulário
        const formData = new FormData(form);
        const data = {
            regiao: formData.get('regiao'),
            dias_autonomia: formData.get('dias_autonomia'),
            equipments: []
        };
        
        const equipmentItems = equipmentList.querySelectorAll('.equipment-item');
        equipmentItems.forEach(item => {
            data.equipments.push({
                type: item.querySelector('[name="type"]').value,
                potencia: item.querySelector('[name="potencia"]').value,
                quantidade: item.querySelector('[name="quantidade"]').value,
                tempo_uso: item.querySelector('[name="tempo_uso"]').value,
                fp: item.querySelector('[name="fp"]').value,
                ipin: item.querySelector('[name="ipin"]').value
            });
        });

        // 2. Envia os dados para o back-end Python
        fetch('/calculate', { // URL do nosso servidor Flask
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        })
        .then(response => response.json())
        .then(results => {
            // 3. Exibe os resultados recebidos do Python
            displayResults(results);
        })
        .catch(error => {
            console.error('Erro:', error);
            alert("Não foi possível conectar ao servidor de cálculo. Verifique se o script 'app.py' está rodando.");
        });
    });

    function displayResults(results) {
        const resultsSection = document.getElementById('results-section');
        const intellectusDiv = document.getElementById('intellectus-analysis');
        const mainResultsDiv = document.getElementById('main-results');

        // Limpa resultados antigos
        intellectusDiv.innerHTML = '';
        mainResultsDiv.innerHTML = '';

        // Exibe avisos da análise "Intelectus"
        if (results.intellectus_warnings && results.intellectus_warnings.length > 0) {
            let warningsHTML = '<h3>Análise Inteligente Solaris:</h3><ul>';
            results.intellectus_warnings.forEach(warning => {
                warningsHTML += `<li>${warning}</li>`;
            });
            warningsHTML += '</ul>';
            intellectusDiv.innerHTML = warningsHTML;
        }
        
        // Exibe resultados principais
        let mainHTML = `
            <h3>Resumo do Projeto:</h3>
            <p><strong>Potência Fotovoltaica Recomendada:</strong> ${results.main_results.potencia_pv_kWp} kWp</p>
            <p><strong>Capacidade Mínima do Banco de Baterias:</strong> ${results.main_results.capacidade_banco_kwh} kWh</p>
            <p><strong>Pico de Potência das Cargas:</strong> ${results.main_results.potencia_pico_carga_va} VA</p>
            <p><strong>Consumo Diário:</strong> ${results.main_results.energia_diaria_kwh} kWh/dia</p>
            <hr>
            <h3>Opções de Equipamentos:</h3>
        `;
        
        if (results.solutions && results.solutions.length > 0) {
            results.solutions.forEach((sol, index) => {
                mainHTML += `
                    <h4>Opção ${index + 1}</h4>
                    <ul>
                        <li><strong>Inversor Sugerido:</strong> ${sol.inversor_modelo} (${sol.inversor_potencia_va} VA)</li>
                        <li><strong>Baterias:</strong> ${sol.bateria_quantidade} unidades do modelo ${sol.bateria_modelo}</li>
                    </ul>
                `;
            });
        } else {
            mainHTML += "<p>Nenhuma combinação de equipamentos encontrada em nosso banco de dados para a sua necessidade de potência. Seu sistema pode exigir uma solução customizada ou inversores em paralelo.</p>";
        }

        mainResultsDiv.innerHTML = mainHTML;
        resultsSection.classList.remove('hidden');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
});