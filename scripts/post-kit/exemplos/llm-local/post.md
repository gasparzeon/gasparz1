Até pouco tempo atrás, rodar um modelo de linguagem útil em casa era escolher entre dois incômodos: aceitar um modelo pequeno que errava o básico ou gastar uma fortuna numa placa de vídeo. Em 2026 isso mudou por dois caminhos bem diferentes:

- **Modelos pequenos muito bem treinados**, como o **Qwen 3.5 9B**, da Alibaba.
- **Compressão extrema de modelos grandes**, como a família **Bonsai**, da PrismML, que reescreve um modelo de 27 bilhões de parâmetros com pesos que só podem valer −1, 0 ou +1.

Para sair da teoria, coloquei os dois para rodar num **Mac mini M4 com 16 GB** — a configuração de entrada da máquina — e medi tudo: quanto de memória ocupam, quantos tokens por segundo geram e quanto tempo você espera por uma resposta de verdade.

> [!NOTE]
> **O que foi medido aqui e o que vem dos fabricantes.** As velocidades e o uso de memória das tabelas foram medidos por mim no Mac mini, com o LM Studio. O **Bonsai 2** exige um carregador próprio (explico adiante) e ainda não roda no LM Studio; por isso medi o **Ternary Bonsai 27B**, a geração anterior, que usa o mesmo formato ternário. Os números do Bonsai 2 são os publicados pela PrismML e estão sempre identificados como tal.

## Por que memória é tudo

Um modelo de linguagem é, no fundo, um arquivo enorme de números (os **pesos**). Para gerar cada token, o computador precisa ler praticamente todos esses pesos da memória. Isso leva a duas regras práticas:

1. **O modelo precisa caber na memória.** O tamanho é aproximadamente *parâmetros × bits por peso ÷ 8*. Um modelo de 27 bilhões de parâmetros em 16 bits ocupa uns 54 GB — mais de três vezes a memória do Mac mini.
2. **A velocidade é limitada pela largura de banda da memória**, não pela "potência" do processador:

$$
\text{tokens por segundo} \;\lesssim\; \frac{\text{largura de banda da memória}}{\text{tamanho dos pesos lidos por token}}
$$

O M4 tem 120 GB/s de largura de banda. Com os ~6 GB do Qwen 3.5 9B em 4 bits, o teto teórico fica em torno de 20 tokens por segundo. Guarde esse número: a medição chegou muito perto dele.

É por isso que **quantização** — guardar cada peso com menos bits — é o que torna a IA local possível: menos bits significa um modelo que cabe *e* que roda mais rápido.

## Os dois competidores

### Qwen 3.5 9B: pequeno e bem treinado

Lançado em março de 2026, o Qwen 3.5 9B é um dos modelos compactos da família Qwen 3.5. Pelo cartão oficial do modelo:

- **9 bilhões de parâmetros** em 32 camadas, com arquitetura híbrida: em cada 4 blocos, 3 usam *Gated DeltaNet* (uma atenção linear, barata) e 1 usa atenção completa.
- **Contexto de 262.144 tokens**, extensível até cerca de 1 milhão.
- **Multimodal**: entende texto, imagem e vídeo.
- **201 idiomas e dialetos** — e o português das respostas no teste foi muito bom.
- **Modo "pensando" ligado por padrão** — guarde essa informação, ela vai pesar.

A versão usada aqui é a **MLX 4-bit** da comunidade do LM Studio: **5,95 GB** em disco.

### Bonsai: um 27B que cabe num notebook

A PrismML saiu do anonimato em março de 2026 com modelos de **1 bit**, e em setembro lançou o **Bonsai 2 27B**, derivado do Qwen3.8-27B. A ideia é radical: em vez de 16 bits, cada peso do modelo de linguagem vira um *trit* — **−1, 0 ou +1** — com um fator de escala compartilhado a cada 128 pesos.

Um valor ternário carrega log₂3 ≈ 1,585 bit de informação. Somando as escalas, o Bonsai 2 fica em **1,72 bit por peso**. Segundo a PrismML:

- **98,2% da qualidade** do modelo original em 16 bits (média de 84,78 em 14 benchmarks no modo "pensando").
- **8,60 GB** no pacote MLX para Mac (7,67 GB de modelo de linguagem + 0,92 GB da parte de visão), ou **5,95 GB** no formato GGUF mais compacto.
- **Contexto de 262 mil tokens**, possível porque 75% das camadas usam atenção linear.

| | Qwen 3.5 9B | Ternary Bonsai 27B (v1) | Bonsai 2 27B |
| --- | :-: | :-: | :-: |
| Lançamento | mar/2026 | jul/2026 | set/2026 |
| Parâmetros | 9B | 27B | 27B |
| Modelo base | — | Qwen3.6-27B | Qwen3.8-27B |
| Formato | 4 bits | ternário (1,71 bit/peso) | ternário (1,72 bit/peso) |
| Tamanho (MLX) | 5,95 GB | 8,49 GB | 8,60 GB |
| Qualidade vs. 16 bits | — | 95% | 98,2% |
| Contexto | 262K | 262K | 262K |
| Roda no LM Studio | sim | sim | ainda não |
| Licença | Apache 2.0 | Apache 2.0 | Apache 2.0 |

![Quanto cada modelo ocupa em disco, comparado aos 16 GB do Mac mini]({{grafico-memoria.png}} "Os pesos do 27B em 16 bits não caberiam; comprimidos, sobram vários gigabytes para o sistema.")

## O teste

- **Máquina:** Mac mini M4 (CPU de 10 núcleos: 4 de desempenho e 6 de eficiência), 16 GB de memória unificada.
- **Software:** LM Studio com o motor MLX, contexto de 8.192 tokens, temperatura 0,7, top-p 0,8.
- **Tarefas, em português:** (1) explicar quantização em três parágrafos; (2) escrever uma função Python com docstring e testes; (3) resumir em cinco tópicos um texto técnico de ~1.400 tokens (a própria ficha do Bonsai 2).
- Uma rodada de aquecimento descartada; cada tarefa rodou **com** e **sem** o modo "pensando". A memória é a ocupação física do processo do LM Studio durante a geração.

### Resultados

| | Qwen 3.5 9B | Ternary Bonsai 27B (v1) |
| --- | :-: | :-: |
| Velocidade de geração | **18,2 – 19,8 tok/s** | **10,0 – 12,1 tok/s** |
| Primeiro token (pergunta curta) | 0,36 – 0,39 s | 1,2 – 1,4 s |
| Leitura de um texto de 1.409 tokens | 6,3 s (~224 tok/s) | 25,8 s (~55 tok/s) |
| Memória em uso durante a geração | ~7,2 – 7,8 GB | ~9,6 – 10,2 GB |

![Velocidade de geração medida no Mac mini M4 de 16 GB]({{grafico-velocidade.png}} "Tokens por segundo na geração, média de seis rodadas por modelo.")

Os dois cabem com folga nos 16 GB e geram texto mais rápido do que dá para ler. O Qwen chega a ~19 tok/s, quase exatamente o teto teórico calculado lá em cima. O Bonsai, com três vezes mais parâmetros, fica em ~11 tok/s (o teto teórico com seus 8,49 GB seria ~14): mais lento, mas totalmente utilizável — e é um modelo de 27B rodando numa máquina de entrada.

**Onde o tamanho pesa de verdade é na leitura de textos longos.** Antes de responder, o modelo precisa processar o prompt inteiro — e essa etapa depende de poder de cálculo, não só de memória. Para "ler" o texto de 1.409 tokens, o Qwen levou 6,3 s; o Bonsai, 25,8 s. Se você pretende colar documentos grandes, isso conta. (Ao reenviar o mesmo texto, o LM Studio reaproveita o cache e esse tempo cai para 1 a 3 segundos.)

## O vilão escondido: o modo "pensando"

O número que mais importa no dia a dia não é tokens por segundo, e sim **quanto tempo você espera pela resposta**. E aí apareceu a maior diferença do teste inteiro.

Os dois modelos vêm com o raciocínio ligado: antes de responder, geram um "rascunho" interno que você não vê. Para pedir três parágrafos sobre quantização, o Qwen escreveu **1.531 tokens de raciocínio** antes de começar a resposta. Nas tarefas de código e de resumo, ele raciocinou por mais de 2.500 tokens — e bateu no limite sem responder nada.

![Tempo até a resposta completa, com e sem o modo pensando]({{grafico-raciocinio.png}} "A mesma pergunta: de minutos para segundos só desligando o raciocínio.")

| Tarefa | Qwen com raciocínio | Qwen sem raciocínio | Bonsai com raciocínio | Bonsai sem raciocínio |
| --- | :-: | :-: | :-: | :-: |
| Explicação (3 parágrafos) | 95,8 s | **15,9 s** | 116 s | **29,9 s** |
| Função Python | 125 s, sem resposta¹ | **19,4 s** | 242 s, sem resposta¹ | **15,6 s** |
| Resumo de texto longo | 132 s, sem resposta¹ | **17,7 s** | 223 s | **34,3 s** |

¹ Atingiu o limite de 2.500 tokens ainda raciocinando.

> [!TIP]
> **Desligue o raciocínio para tarefas do dia a dia.** Pela API do LM Studio (compatível com a da OpenAI), envie `"reasoning_effort": "none"` — testei com os dois modelos e o raciocínio cai para zero. Na interface, a opção de raciocínio aparece nas configurações dos modelos que o suportam. Deixe o modo "pensando" para problemas que realmente pedem passo a passo — matemática, depuração, lógica.

```bash
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen/qwen3.5-9b",
    "reasoning_effort": "none",
    "messages": [{ "role": "user", "content": "Resuma a teoria da relatividade em 3 frases." }]
  }'
```

## Em vídeo: a velocidade real

Os dois vídeos abaixo mostram a mesma pergunta — um parágrafo de ~150 palavras sobre privacidade —, com o raciocínio desligado. O streaming de cada modelo foi gravado token a token no Mac mini e reproduzido **no tempo real** em que cada pedaço do texto chegou: 11,5 s para o Qwen e 16,8 s para o Bonsai.

![Qwen 3.5 9B respondendo no Mac mini M4, em tempo real]({{qwen-tempo-real.mp4}})

![Ternary Bonsai 27B respondendo à mesma pergunta, em tempo real]({{bonsai-tempo-real.mp4}})

E para entender de onde vem a ideia de pesos de 1 bit e ternários, vale este vídeo do Tim Carambat, criador do AnythingLLM:

https://www.youtube.com/watch?v=0fWFetwHkVE

## E o Bonsai 2?

O Bonsai 2 traz duas mudanças importantes em relação à primeira geração:

- **Base nova:** sai do Qwen3.6-27B e passa ao Qwen3.8-27B.
- **Rotação de Hadamard:** antes de virar ternário, cada matriz de pesos é "girada" por uma transformação ortogonal, e o programa aplica a transformação correspondente nas ativações durante a execução. A rotação já vem embutida nos pesos, então não custa nenhum bit a mais.

Nas fichas da PrismML, a qualidade retida sobe de 95% (v1, média de 15 benchmarks) para 98,2% (Bonsai 2, média de 14) — conjuntos de testes um pouco diferentes, então a comparação é aproximada.

A consequência prática: **o pacote MLX do Bonsai 2 precisa do carregador que vem junto com ele**, na pasta `runtime/`. A própria PrismML avisa que carregadores MLX comuns "devolvem saída errada em vez de um erro" — então não adianta só baixar e abrir no LM Studio. O caminho oficial no Mac é:

```bash
hf download prism-ml/Ternary-Bonsai-2-27B-mlx-2bit --local-dir bonsai2-27b-mlx
cd bonsai2-27b-mlx
pip install -r runtime/requirements.txt
python quickstart.py "Explique o que é um modelo ternário"
```

Em PC com placa NVIDIA, a versão GGUF usa um *fork* do llama.cpp da própria PrismML; o llama.cpp oficial ainda não lê esses arquivos.

> [!WARNING]
> Os números abaixo são da PrismML, não foram medidos aqui. Eles usam o llama.cpp com os kernels próprios da empresa, gerando 128 tokens a partir de um contexto vazio.

| Plataforma (dados da PrismML) | Geração (tok/s) | Leitura do prompt (tok/s) |
| --- | :-: | :-: |
| RTX 5090 (32 GB) | 129,9 | 3.893 |
| RTX 4090 (24 GB) | 81,2 | 3.124 |
| L4 (24 GB, 72 W) | 29,8 | 777 |
| MacBook com M5 Pro | 28,1 | 387 |

## Qual escolher

- **Uso diário num Mac de 16 GB** (resumos, e-mails, código simples, tradução): **Qwen 3.5 9B sem raciocínio**. Responde em segundos, sobra memória para o navegador e o resto do sistema.
- **Perguntas difíceis, quando qualidade importa mais que tempo**: **Bonsai** com o raciocínio ligado. É um 27B: mais conhecimento e raciocínio mais sólido, a ~11 tok/s nesta máquina.
- **Máquinas com 8 GB**: olhe para os modelos de 1 bit — o Bonsai 8B de 1 bit ocupa cerca de 1,15 GB, segundo a PrismML.
- **PC com placa de vídeo**: prefira os formatos GGUF; numa RTX 4090 o Bonsai 2 passa dos 80 tok/s, segundo a fabricante.

## Como começar em 10 minutos

1. Instale o [LM Studio](https://lmstudio.ai) (Mac, Windows ou Linux).
2. Na busca de modelos, procure `qwen3.5-9b` e baixe a versão MLX 4-bit (Mac) ou GGUF Q4 (PC).
3. Abra uma conversa, escolha o modelo e, para tarefas simples, desligue o raciocínio.
4. Quer usar em outros programas? Ligue o servidor local:

```bash
lms server start
lms load qwen/qwen3.5-9b --context-length 8192
```

A partir daí, qualquer aplicativo que fale com a API da OpenAI pode apontar para `http://localhost:1234/v1` — tudo rodando na sua máquina, sem enviar nada para fora.

## As respostas, sem retoque

Velocidade não é tudo; vale ver o que os modelos de fato escreveram (modo sem raciocínio).

<details>
<summary>Qwen 3.5 9B — função Python (correta)</summary>

```python
def top_three_distinct(nums):
    """
    Recebe uma lista de inteiros e devolve os três maiores valores distintos 
    em ordem decrescente. Se houver menos de três valores distintos, 
    devolve todos os disponíveis.

    Parâmetros:
        nums (list): Lista de inteiros.

    Retorna:
        list: Lista contendo os três maiores valores distintos em ordem decrescente.
    
    Exemplos:
        >>> top_three_distinct([10, 20, 30, 20, 10, 5])
        [30, 20, 10]
        >>> top_three_distinct([5, 5, 5])
        [5]
        >>> top_three_distinct([-1, -2, -3, -4])
        [-1, -2, -3]
    """
    # Obter elementos únicos e ordenar em ordem decrescente
    unique_nums = sorted(set(nums), reverse=True)
    
    # Retornar apenas os três primeiros (ou menos se não houver)
    return unique_nums[:3]


# Testes
assert top_three_distinct([10, 20, 30, 20, 10, 5]) == [30, 20, 10]
assert top_three_distinct([5, 5, 5]) == [5]
assert top_three_distinct([-1, -2, -3, -4]) == [-1, -2, -3]
```

</details>

<details>
<summary>Qwen 3.5 9B — explicação sobre quantização (com um deslize)</summary>

A quantização de modelos de linguagem é uma técnica de otimização que reduz o tamanho dos pesos neuronais de uma rede neural, convertendo-os de formatos de alta precisão (como ponto flutuante de 32 bits) para formatos de menor precisão (como inteiros de 8 ou 4 bits). Esse processo envolve um compromisso calculado entre a perda de desempenho e o ganho em eficiência, permitindo que a estrutura cognitiva do modelo seja preservada enquanto se diminui drasticamente o consumo de memória e o uso de energia.

Ao reduzir a precisão numérica dos parâmetros, a quantização diminui a quantidade de dados que precisam ser armazenados e processados em tempo real, o que resulta em um modelo muito mais compacto e leve. Essa redução no tamanho da matriz de pesos permite que modelos que antes exigiam centenas de gigabytes de RAM agora caibam na memória principal de um laptop ou notebook comum, superando a limitação de hardware dos computadores domésticos.

Além de economizar espaço em disco, a quantização melhora significativamente a velocidade de inferência ao permitir que as operações matemáticas sejam realizadas com instruções de hardware nativas de baixo nível, como as instruções AVX2 em processadores Intel/AMD ou as instruções NEON em processadores Apple. Isso elimina a necessidade de depender de servidores na nuvem caros e torna o processamento da inteligência artificial acessível, rápido e viável diretamente no dispositivo do usuário final.

**O deslize:** o modelo atribui o ganho de velocidade a instruções NEON e AVX2 do processador. No Mac, o MLX roda na **GPU**, via Metal — e o ganho vem principalmente de ler menos bytes da memória, como vimos acima. Bom lembrete de que modelos pequenos erram detalhes técnicos com toda a confiança.

</details>

<details>
<summary>Ternary Bonsai 27B com raciocínio — resumo do texto técnico (o mais preciso do teste)</summary>

1. **Arquitetura e Base:** Modelo derivado de Qwen3.8-27B com 27,36B parâmetros, atenção híbrida (~75% linear), suporte a contexto de 262K tokens e estrutura inalterada.
2. **Quantização Ternária (g128):** Pesos mapeados para {-1, 0, +1} com fator de escala FP16 por grupo de 128, atingindo ~1,72 bits/parâmetro e redução teórica de ~9,3x versus FP16.
3. **Transformação de Base (Hadamard):** Matrices rotacionadas ortogonalmente offline e compensadas em runtime nas ativações, garantindo zero custo adicional de armazenamento ou tráfego.
4. **Tamanho e Vision Tower:** Pack final de 8,60 GB em disco (7,67 GB LM + 0,92 GB torre visual não quantizada em FP16), otimizado para execução nativa no Apple MLX e CUDA.
5. **Formato MLX e Licença:** Container MLX armazena escala + viés por grupo para decodificação exata dos trits (2,25 bits/parâmetro), com equivalência bit-a-bit ao GGUF e licença Apache 2.0.

</details>

<details>
<summary>Ternary Bonsai 27B — explicação sobre quantização</summary>

A quantização de modelos de linguagem é uma técnica de otimização que reduz a precisão dos pesos numéricos do modelo, geralmente convertendo valores de 32 bits para 8 ou até 4 bits. Em vez de armazenar cada parâmetro com alta exatidão, a quantização usa números inteiros menores para representar as mesmas informações de forma aproximada. Isso diminui significativamente o consumo de memória, pois os dados ocupam menos espaço na RAM e no armazenamento do dispositivo.

Essa redução de tamanho permite que grandes modelos de linguagem, originalmente projetados para rodar em servidores com recursos computacionais massivos, sejam executados em computadores domésticos. Como o modelo ocupa menos memória, ele pode caber na memória volátil de um PC comum ou até em dispositivos móveis. Além disso, operações matemáticas com números inteiros menores são mais rápidas e consomem menos energia, melhorando a eficiência do processamento e reduzindo o custo energético da inferência.

Embora haja uma leve perda de precisão na geração de respostas, técnicas avançadas de quantização, como a quantização baseada em blocos e métodos de calibração, minimizam esse impacto. Assim, a quantização é essencial para democratizar o acesso à inteligência artificial, permitindo que usuários utilizem modelos de linguagem de alta capacidade em ambientes pessoais, sem a necessidade de infraestrutura profissional ou custos elevados.

</details>

## Conclusão

Rodar IA em casa deixou de ser brincadeira. Num Mac mini de entrada, um modelo de 9B responde em segundos e um de 27B comprimido para pesos ternários roda com folga — algo impensável um ano atrás, quando o mesmo 27B exigiria mais de 50 GB.

A lição mais útil do teste, porém, não é sobre bits: é que o **modo "pensando" multiplica o tempo de espera** em máquinas domésticas. Ligue-o quando o problema pedir; desligue no resto. E fique de olho no Bonsai 2: assim que ele chegar ao LM Studio, este teste ganha uma atualização.

## Fontes

- [Qwen3.5-9B — cartão oficial do modelo (Hugging Face)](https://huggingface.co/Qwen/Qwen3.5-9B)
- [Bonsai 2 27B — cartão do modelo MLX (PrismML)](https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-mlx-2bit)
- [Ternary Bonsai 27B — cartão do modelo MLX (PrismML)](https://huggingface.co/prism-ml/Ternary-Bonsai-27B-mlx-2bit)
- [PrismML — anúncio dos modelos de 1 bit](https://prismml.com/news/bonsai-8b)
- [PrismML — família Ternary Bonsai](https://prismml.com/news/prismml-introduces-ternary-bonsai-model-family)
- [The Register — PrismML e os LLMs de 1 bit](https://www.theregister.com/2026/04/04/prismml_1bit_llm/)
- [LM Studio](https://lmstudio.ai)
