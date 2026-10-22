# OSONE AGENTE

Dá a qualquer assistente de IA as mãos no computador: **abrir apps, mover e clicar o mouse,
digitar, apertar atalhos, ver a tela, gerenciar janelas e rodar comandos no PowerShell ou no
terminal**, no **Windows e no Linux**.

É o mesmo agente que o [OSONE](https://github.com/HROSONE/OSONE-AI) usa, separado num pacote que
você pode colocar no seu projeto: um servidor HTTP local, sem dependências, que entende pedidos
como `POST /open-app {"appName": "spotify"}` — ou, para modelos com *function calling*,
`POST /ferramenta {"nome": "clicar", "args": {"x": 400, "y": 300}}`.

```
seu assistente (Gemini, GPT, Claude, Llama...)  ──HTTP + token──▶  OSONE AGENTE  ──▶  mouse, teclado, apps, terminal
```

## Instalação

Precisa do **Node.js 18 ou mais novo**. Não há `npm install`: o agente não tem dependências.

```bash
git clone https://github.com/HROSONE/osone-agente
cd osone-agente
node agente.js
```

Na primeira execução ele cria o `config.json` com um **token** aleatório e mostra:

```
================================================================
  OSONE AGENTE 2.0.0 — online
================================================================
  Endereço:    http://127.0.0.1:9123   (só esta máquina)
  Painel:      http://127.0.0.1:9123/
  Sistema:     linux (x11) · entrada: xdotool
  Permissões:  apps, mouse, teclado, tela, janelas, terminal, arquivos
  Token:       3f9c...
```

Abra o **painel** no navegador, cole o token e teste cada recurso antes de ligar o assistente.

| comando | o que faz |
|---|---|
| `node agente.js` | inicia |
| `node agente.js --token` | mostra o token |
| `node agente.js --novo-token` | troca o token (o antigo deixa de valer) |

### Windows

Nada a instalar. O agente usa o PowerShell que vem com o Windows 10/11: abre **um** processo
PowerShell ao iniciar, compila uma pequena classe C# (SendInput, SetCursorPos, janelas) e reaproveita
o mesmo processo em todo pedido — cada clique leva milissegundos, não o segundo e meio que custa
abrir um PowerShell novo.

- Texto com acento e emoji é digitado como Unicode, independente do layout do teclado.
- Apps são achados pelo nome no PATH, no registro (App Paths), no menu Iniciar (inclusive apps da
  Microsoft Store) e nos atalhos `.lnk`.
- Um app rodando **como administrador** não aceita clique de um agente que não é: o Windows bloqueia
  (UIPI). Para controlar esses apps, rode o agente como administrador.

### Linux

O agente usa as ferramentas do próprio sistema. Instale conforme a sua sessão
(`echo $XDG_SESSION_TYPE`):

**X11** (a maioria das distribuições até 2023, e Ubuntu com "Ubuntu on Xorg"):

```bash
sudo apt install xdotool wmctrl imagemagick      # Debian/Ubuntu/Mint
sudo dnf install xdotool wmctrl ImageMagick      # Fedora
sudo pacman -S xdotool wmctrl imagemagick        # Arch
```

**Wayland** (GNOME e KDE recentes): o Wayland não deixa um programa comum controlar o mouse dos
outros. O caminho é o `ydotool`, que fala direto com o kernel:

```bash
sudo apt install ydotool grim
sudo systemctl enable --now ydotoold   # ou rode `ydotoold` como root
```

No Wayland, **mouse e digitação funcionam; atalhos de teclado (`ctrl+c`) e listar janelas ainda
não**. Se precisar de tudo, entre na sessão X11 na tela de login.

| recurso | X11 | Wayland |
|---|---|---|
| mover, clicar, rolar, arrastar | xdotool | ydotool |
| digitar texto (acentos, emoji) | xdotool | ydotool |
| atalhos (`ctrl+c`, `alt+tab`) | xdotool | — |
| posição do mouse | xdotool | — |
| listar/focar/fechar janelas | wmctrl (ou xdotool) | — |
| ver a tela | import, scrot, gnome-screenshot ou spectacle | grim ou gnome-screenshot |
| abrir apps | `.desktop`, PATH, xdg-open | igual |

`GET /status` mostra o que foi encontrado e, quando falta algo, o erro diz o comando para instalar.

## Usar num assistente de IA

O arquivo **`ferramentas.json`** traz as ferramentas já descritas no formato de *function calling*.
O laço é sempre o mesmo, para qualquer modelo:

1. Declare `ferramentas.json → ferramentas` no modelo.
2. Quando o modelo chamar uma, envie `POST /ferramenta {"nome": ..., "args": ...}` ao agente.
3. Devolva a resposta ao modelo.

| modelo | onde as ferramentas entram |
|---|---|
| Gemini | `tools: [{ functionDeclarations: ferramentas }]` |
| OpenAI e compatíveis | `tools: ferramentas.map(f => ({ type: 'function', function: f }))` |
| Claude (Anthropic) | `tools: ferramentas.map(f => ({ name: f.name, description: f.description, input_schema: f.parameters }))` |

Exemplos completos e prontos para rodar:

- [`exemplos/gemini.mjs`](exemplos/gemini.mjs) — assistente Gemini que vê a tela e age
- [`exemplos/openai.mjs`](exemplos/openai.mjs) — o mesmo com OpenAI, Groq, OpenRouter, Ollama...
- [`exemplos/embutido.js`](exemplos/embutido.js) — o agente dentro do seu processo Node, sem HTTP
- [`exemplos/curl.sh`](exemplos/curl.sh) — cada rota na linha de comando

### Ferramentas

| ferramenta | o que faz |
|---|---|
| `abrir_app` | abre um app pelo nome, um site ou um arquivo |
| `fechar_app` | fecha um app (processos do sistema são protegidos) |
| `listar_apps` | apps instalados |
| `ver_tela` | captura PNG em base64 |
| `tamanho_da_tela` | largura e altura |
| `clicar`, `mover_mouse`, `rolar`, `arrastar` | mouse |
| `digitar`, `tecla` | teclado (`"ctrl+shift+t"`, `"alt+f4"`, `"win"`, `"volumeup"`...) |
| `listar_janelas`, `focar_janela`, `fechar_janela` | janelas |
| `terminal` | roda no PowerShell (Windows) ou bash (Linux) e devolve a saída |
| `planejar_organizacao`, `organizar`, `mandar_para_lixeira` | arrumar Downloads/Desktop/Documentos |

### Cliente JavaScript

```js
const { ClienteOsoneAgente } = require('osone-agente/cliente');
const agente = new ClienteOsoneAgente({ token: process.env.OSONE_AGENTE_TOKEN });

await agente.abrirApp('calculadora');
await agente.digitar('12*7\n');
await agente.tecla('ctrl+c');
const { stdout } = await agente.terminal('Get-Date');       // PowerShell no Windows, bash no Linux
const { base64 } = await agente.verTela();
await agente.ferramenta('arrastar', { xDe: 100, yDe: 100, xPara: 500, yPara: 300 });
```

O cliente usa só `fetch`: funciona no Node 18+ e no navegador.

## API HTTP

Toda rota, menos `/ping` e o painel (`/`), exige `Authorization: Bearer <token>`. As respostas são
`{"ok": true, ...}` ou `{"ok": false, "erro": "..."}` com o status HTTP do problema.

| rota | corpo |
|---|---|
| `GET /status` | — sistema, sessão, motor de entrada, ferramentas encontradas, permissões |
| `GET /ping` | — público: o agente existe? |
| `POST /ferramenta` | `{ nome, args }` |
| `GET /apps` | — |
| `POST /open-app` | `{ appName, path? }` |
| `POST /close-app` | `{ appName, force? }` |
| `POST /mouse/move` | `{ x, y }` |
| `POST /mouse/click-at` | `{ x?, y?, button?: left\|right\|middle, double? }` |
| `POST /mouse/button` | `{ action: down\|up\|click, button? }` |
| `POST /mouse/scroll` | `{ direction: up\|down\|left\|right, amount?, x?, y? }` |
| `POST /mouse/drag` | `{ xDe, yDe, xPara, yPara, button? }` |
| `GET /mouse/position` | — |
| `POST /keyboard/type` | `{ text }` |
| `POST /keyboard/key` | `{ key, modifiers? }` |
| `GET /window/list` | — |
| `POST /window/focus` | `{ id }` |
| `POST /window/close` | `{ id }` |
| `GET /screen-info` | — |
| `GET /screen/capture` | — `{ formato: 'png', base64 }` |
| `POST /exec` | `{ command, cwd?, timeoutMs?, shell?: powershell\|cmd\|bash\|sh }` |
| `POST /organize/plan` | `{ folderKey }` |
| `POST /organize/execute` | `{ folderKey, plan, confirmed: true }` |
| `POST /file/trash` | `{ folderKey, fileName, confirmed: true }` |
| `GET /audit/logs?quantas=100` | — |

Os nomes das rotas são os mesmos do agente embutido no OSONE: um cliente escrito para um serve ao outro.

## Segurança

**O agente dá a quem tem o token o mesmo poder que você tem no computador.** As proteções:

- Escuta **só em 127.0.0.1**: ninguém na rede alcança o agente.
- **Token** de 64 caracteres, comparado em tempo constante.
- **Origens permitidas**: uma página aberta no navegador só fala com o agente se a origem dela
  estiver em `origensPermitidas` — mesmo que tenha roubado o token. Scripts e servidores (sem
  cabeçalho `Origin`) passam só com o token.
- **Host conferido**: um site que aponta o próprio domínio para 127.0.0.1 (DNS rebinding) recebe 421.
- **Permissões**: cada capacidade pode ser desligada no `config.json`. Desligada, a rota responde
  403 e nada roda.
- **Terminal com freio**: formatar disco, apagar a raiz ou a pasta pessoal, sobrescrever disco,
  desligar a máquina e outros comandos destrutivos são recusados. **Isto não é uma sandbox** — é
  uma rede contra o erro mais caro de um modelo, não contra quem quer contorná-la. Se você não
  confia no assistente, desligue `permissoes.terminal`.
- **Arquivos** só dentro das `pastasPermitidas`, e nada é apagado: a "lixeira" é uma pasta.
- **Auditoria** de toda ação em `audit.log` (sem o token e sem o texto digitado).

Não exponha o agente com `host: "0.0.0.0"`, túnel ou proxy reverso.

## Configuração

O `config.json` é criado na primeira execução. Veja [`config.exemplo.json`](config.exemplo.json).

| chave | padrão | |
|---|---|---|
| `porta` | `9123` | |
| `token` | gerado | troque com `--novo-token` |
| `origensPermitidas` | `localhost:3000`, `localhost:5173` | sites que podem chamar o agente pelo navegador |
| `permissoes` | tudo ligado | `apps`, `mouse`, `teclado`, `tela`, `janelas`, `terminal`, `arquivos` |
| `terminal.prazoPadraoMs` | `30000` | prazo de cada comando |
| `terminal.bloquear` | `[]` | textos extras que recusam um comando |
| `apps` | `{}` | atalhos: `{"editor": {"win32": "code", "linux": "code"}}` |
| `pastasPermitidas` | Downloads, Desktop, Documents | para organizar e lixeira |

Variáveis de ambiente: `OSONE_AGENTE_TOKEN`, `OSONE_AGENTE_PORTA`, `OSONE_AGENTE_CONFIG` (outro
caminho para o config), `OSONE_AGENTE_SILENCIOSO=1`.

## Iniciar junto com o sistema

**Windows**: crie um atalho para `node C:\caminho\osone-agente\agente.js` em
`shell:startup` (Win+R → `shell:startup`).

**Linux** (systemd do usuário, para rodar dentro da sua sessão gráfica):

```ini
# ~/.config/systemd/user/osone-agente.service
[Unit]
Description=OSONE AGENTE
After=graphical-session.target

[Service]
ExecStart=/usr/bin/node %h/osone-agente/agente.js
Restart=on-failure

[Install]
WantedBy=graphical-session.target
```

```bash
systemctl --user enable --now osone-agente
```

## Testes

```bash
npm test
```

Testa segurança (token, origem, Host, permissões), terminal, teclas, organização de pastas e o
cliente. Com o PowerShell 7 (`pwsh`) instalado, também compila o C# do Windows e confere a sintaxe
dos scripts — inclusive no Linux.

O teste de ponta a ponta **mexe no mouse e no teclado de verdade**, por isso só roda quando pedido.
Use um display virtual:

```bash
Xvfb :99 & DISPLAY=:99 openbox &
DISPLAY=:99 OSONE_AGENTE_TESTE_NA_TELA=1 npm test
```

## Licença

MIT
