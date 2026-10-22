#!/usr/bin/env sh
# Chamadas diretas ao agente. Pegue o token com: node agente.js --token
TOKEN="${TOKEN:?defina TOKEN=<token do agente>}"
A="http://127.0.0.1:9123"
H="Authorization: Bearer $TOKEN"

curl -s "$A/status" -H "$H"; echo
curl -s "$A/open-app" -H "$H" -H 'Content-Type: application/json' -d '{"appName":"calculadora"}'; echo
curl -s "$A/mouse/click-at" -H "$H" -H 'Content-Type: application/json' -d '{"x":400,"y":300}'; echo
curl -s "$A/keyboard/type" -H "$H" -H 'Content-Type: application/json' -d '{"text":"Olá do OSONE AGENTE"}'; echo
curl -s "$A/keyboard/key" -H "$H" -H 'Content-Type: application/json' -d '{"key":"ctrl+a"}'; echo
curl -s "$A/exec" -H "$H" -H 'Content-Type: application/json' -d '{"command":"echo funcionando"}'; echo
# Pelo nome da ferramenta, como um modelo de IA chamaria:
curl -s "$A/ferramenta" -H "$H" -H 'Content-Type: application/json' -d '{"nome":"listar_janelas","args":{}}'; echo
