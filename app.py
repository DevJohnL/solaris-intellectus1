from flask import Flask, request, jsonify, render_template 
from flask_cors import CORS
import pandas as pd
import io
import math # <-- ADICIONADO: Importa a biblioteca de matemática

# --- Inicialização do Servidor Flask ---
app = Flask(__name__, static_folder='static', template_folder='templates')  
CORS(app) 

# --- BANCO DE DADOS (embutido no código) ---
inverter_data = """Inversor Escolhido,P_pico (VA),P_nominal (VA),Topologia,Preco_Estimado,Bateria Compátivel
X1-Hybrid-5K LV,10000,5000,Monofásico,12000,LD53
X1-Hybrid-7.5K,11250,7000,Monofásico,18000,T58
X3-Hybrid-15K,22500,15000,Trifásico,35000,T58
SUN2000-2KTL-L1,2200,2000,Monofásico,3500,LUNA2000
SUN2000-3KTL-L1,3300,3000,Monofásico,4500,LUNA2000
SUN2000-4KTL-L1,4400,4000,Monofásico,5800,LUNA2000
SUN2000-5KTL-L1,5500,5000,Monofásico,6500,LUNA2000
SUN2000-6KTL-L1,6600,6000,Monofásico,7200,LUNA2000
"""

battery_data = """Bateria Escolhida,Energia_nominal_kWh,Tensao_V
LD53,4.7,48
T58,5.1,48
LUNA2000,4.5,48
"""

df_inverters = pd.read_csv(io.StringIO(inverter_data))
df_batteries = pd.read_csv(io.StringIO(battery_data))

# --- DADOS E PRESETS ---
EQUIPMENT_PRESETS = {
    "geladeira": {"fp": 0.85, "ipin": 6.0},
    "ar_condicionado": {"fp": 0.90, "ipin": 4.0},
    "lampada": {"fp": 1.0, "ipin": 1.2},
    "tv": {"fp": 0.95, "ipin": 1.0},
    "bomba": {"fp": 0.80, "ipin": 7.0},
    "outro": {"fp": 1.0, "ipin": 1.0}
}

HSP_DATABASE = {
    "fortaleza": 5.9,
    "sao paulo": 4.5,
    "rio de janeiro": 4.8,
    "curitiba": 4.2
}

# --- ROTA DA API: O PONTO DE CÁLCULO ---
@app.route('/calculate', methods=['POST'])
def calculate_system():
    data = request.get_json()
    
    equipments = data.get('equipments', [])
    dias_autonomia = float(data.get('dias_autonomia', 1))
    regiao_input = data.get('regiao', 'fortaleza').split(',')[0].strip().lower()

    intellectus_warnings = []
    
    for equip in equipments:
        preset = EQUIPMENT_PRESETS.get(equip['type'], EQUIPMENT_PRESETS['outro'])
        equip['fp'] = float(equip.get('fp') or preset['fp'])
        equip['ipin'] = float(equip.get('ipin') or preset['ipin'])
        
        energia_item = (float(equip['potencia']) * float(equip['tempo_uso'])) / 1000
        if energia_item > 2.0 or float(equip['potencia']) > 1500:
            intellectus_warnings.append(f"Atenção: O equipamento com potência {equip['potencia']}W usado por {equip['tempo_uso']}h é um grande consumidor. Ele terá um impacto significativo na autonomia das baterias.")

    energia_total_diaria_kWh = 0
    potencia_nominal_backup_VA = 0
    potencia_pico_backup_VA = 0

    for equip in equipments:
        energia_item = (float(equip['quantidade']) * float(equip['potencia']) * float(equip['tempo_uso'])) / 1000
        energia_total_diaria_kWh += energia_item
        
        potencia_aparente = (float(equip['quantidade']) * float(equip['potencia'])) / equip['fp']
        potencia_pico = potencia_aparente * equip['ipin']
        
        potencia_nominal_backup_VA += potencia_aparente
        potencia_pico_backup_VA += potencia_pico

    hsp = HSP_DATABASE.get(regiao_input, 4.5)
    rendimento_sistema_pv = 0.85
    profundidade_descarga_DoD = 0.80

    potencia_pico_pv_kWp = energia_total_diaria_kWh / (hsp * rendimento_sistema_pv)
    energia_banco_baterias_kWh = (energia_total_diaria_kWh * dias_autonomia) / profundidade_descarga_DoD

    inversores_compativeis = df_inverters[
        (df_inverters['P_nominal (VA)'] >= potencia_nominal_backup_VA) &
        (df_inverters['P_pico (VA)'] >= potencia_pico_backup_VA)
    ]

    inversores_ordenados = inversores_compativeis.sort_values(by='Preco_Estimado').head(3)

    solutions = []
    if not inversores_ordenados.empty:
        for _, inversor in inversores_ordenados.iterrows():
            bateria_compativel = df_batteries[df_batteries['Bateria Escolhida'] == inversor['Bateria Compátivel']].iloc[0]
            
            # CORRIGIDO: Troca 'np.ceil' por 'math.ceil'
            qtd_baterias = math.ceil(energia_banco_baterias_kWh / bateria_compativel['Energia_nominal_kWh'])
            
            solutions.append({
                "inversor_modelo": inversor['Inversor Escolhido'],
                "inversor_potencia_va": inversor['P_nominal (VA)'],
                "bateria_modelo": bateria_compativel['Bateria Escolhida'],
                "bateria_quantidade": int(qtd_baterias)
            })
    
    response = {
        "intellectus_warnings": intellectus_warnings,
        "main_results": {
            "potencia_pv_kWp": round(potencia_pico_pv_kWp, 2),
            "capacidade_banco_kwh": round(energia_banco_baterias_kWh, 2),
            "potencia_pico_carga_va": round(potencia_pico_backup_VA, 2),
            "energia_diaria_kwh": round(energia_total_diaria_kWh, 2)
        },
        "solutions": solutions
    }
    
    return jsonify(response)
# --- ROTA PRINCIPAL: SERVE A PÁGINA INICIAL ---
@app.route('/')
def home():
    # Renderiza o arquivo index.html que está na pasta /templates
    return render_template('index.html')

# --- Roda o servidor ---
if __name__ == '__main__':
    app.run(debug=False) # 'debug' deve ser False em produção

