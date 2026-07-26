# 🛡️ OSONE Local Agent (`osone-local-agent`)

Agente local standalone de alta segurança em Node.js para comunicação com a aplicação web **OSONE**.

Permite que a interface web OSONE rodando no navegador do usuário solicite:
1. **Abertura controlada de aplicativos locais** (somente via allowlist configurada).
2. **Organização automática de arquivos** em subpastas por extensão em duas etapas (Plano e Confirmação).
3. **Envio seguro de arquivos para lixeira interna do agente** sem deleção permanente.

---

## ⚡ Requisitos do Sistema

- **Node.js** v18.0.0 ou superior instalado no sistema operacional (Windows ou Linux).
- **Sem dependências externas de npm!** O agente utiliza exclusivamente os módulos nativos do Node.js (`http`, `crypto`, `child_process`, `fs`, `path`, `os`).

---

## 🚀 Como Executar

1. Abra o terminal no diretório da pasta `osone-local-agent`:
   ```bash
   cd osone-local-agent
   ```

2. Execute o comando de inicialização:
   ```bash
   npm start
   # Ou diretamente:
   node agent.js
   ```

3. Na primeira execução, o agente criará o arquivo `config.json` e gerará automaticamente um **Token de Acesso seguro** de 64 caracteres hexadecimais.

4. Observe o console de execução:
   ```text
   ================================================================
                    OSONE LOCAL AGENT (INICIALIZADO)               
   ================================================================
    Status:          ONLINE
    Bind de Rede:    http://127.0.0.1:9123 (Restrito ao Host Local)
    Plataforma:      win32
    Token de Acesso: 4a8e...f91a
   ----------------------------------------------------------------
    ATENÇÃO DE SEGURANÇA:
    1. Copie o TOKEN acima para utilizar no painel web da OSONE.
    2. NUNCA compartilhe este token com terceiros.
    ...
   ================================================================
   ```

---

## ⚙️ Como Configurar o `config.json`

O arquivo `config.json` armazena as permissões e parâmetros do agente. Você pode editá-lo com qualquer editor de texto.

```json
{
  "port": 9123,
  "token": "SEU_TOKEN_GERADO_AQUI",
  "allowedOrigin": "http://localhost:5173",
  "apps": {
    "spotify": {
      "win32": "start spotify:",
      "linux": "spotify"
    },
    "vscode": {
      "win32": "code",
      "linux": "code"
    },
    "filemanager": {
      "win32": "explorer",
      "linux": "xdg-open ."
    },
    "terminal": {
      "win32": "start cmd",
      "linux": "gnome-terminal"
    },
    "browser": {
      "win32": "start https://google.com",
      "linux": "xdg-open https://google.com"
    }
  },
  "allowedFolders": {
    "downloads": "C:\\Users\\SeuUsuario\\Downloads",
    "desktop": "C:\\Users\\SeuUsuario\\Desktop",
    "documents": "C:\\Users\\SeuUsuario\\Documents"
  }
}
```

### Principais Opções de Configuração:

1. **`allowedOrigin`**: Define qual URL de origem pode acessar o agente via CORS (ex: `"http://localhost:5173"` ou `"https://sua-app-osone.com"`).
2. **`allowedFolders`**: Mapeia nomes lógicos (`downloads`, `desktop`, etc.) para os **caminhos absolutos reais** no seu sistema operacional.
   - No Windows: `"C:\\Users\\Nome\\Downloads"`
   - No Linux: `"/home/nome/Downloads"` ou `"~/Downloads"`
3. **`apps`**: Mapeia identificadores de programas para os comandos correspondentes em cada SO (`win32` ou `linux`).

---

## 🔒 Regras e Arquitetura de Segurança

Este agente foi projetado com um modelo de segurança **Zero Trust** estrito:

1. **Bind Exclusivo em Localhost (127.0.0.1)**:
   O servidor aceita conexões estritamente do loopback da máquina local. Nenhuma interface de rede externa é exposta.

2. **Autenticação por Token Bearer (HTTP 401)**:
   Todas as requisições (exceto preflight `OPTIONS`) exigem o cabeçalho HTTP `Authorization: Bearer <TOKEN>`. Se o token não for idêntico, a requisição é bloqueada e registrada no log de auditoria.

3. **Validação de CORS (HTTP 403)**:
   Valida rigorosamente o cabeçalho `Origin` das requisições contra o parâmetro `allowedOrigin`.

4. **Allowlist de Aplicativos**:
   O cliente web NUNCA pode enviar comandos genéricos de shell para execução. Ele apenas envia o identificador (ex: `"vscode"`), e o agente executa a string de comando predefinida no `config.json`.

5. **Sandbox de Diretório (Path Traversal Protection)**:
   Todas as operações de arquivo usam a função `resolveSafePath()`, que valida se o arquivo alvo permanece dentro da pasta autorizada em `allowedFolders`. Tentativas de fuga como `../` ou caminhos absolutos forçados lançam erro e são bloqueadas.

6. **Organização em Duas Etapas**:
   - `POST /organize/plan`: Apenas analisa a pasta e categoriza arquivos em Imagens, Documentos, Planilhas, Vídeos, Áudio, Compactados, Instaladores e Outros.
   - `POST /organize/execute`: Exige envio do flag `confirmed: true`. Cada item é revalidado individualmente antes da movimentação. Se o arquivo de destino já existir, é adicionado um sufixo numérico `(1)`, `(2)`, etc.

7. **Lixeira Local (Sem Deleção Permanente)**:
   A rota `POST /file/trash` move o arquivo para a subpasta local `trash/` dentro do próprio diretório do agente, prefixando o nome com timestamp. O método `fs.unlink` nunca é chamado diretamente.

8. **Trilha de Auditoria (`audit.log`)**:
   Todas as ações, tentativas de bloqueio, erros e movimentações são salvas com data/hora em formato ISO 8601 no arquivo `audit.log`.

---

## ⚠️ AVISO IMPORTANTE DE SEGURANÇA

> **NUNCA compartilhe seu Token de Acesso.**
> O token concede permissão para abrir aplicativos e organizar arquivos nos diretórios configurados.
> Mantenha o agente rodando apenas localmente na sua máquina e nunca o exponha para a internet pública.
