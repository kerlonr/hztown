# Projeto GT

MVP de uma plataforma de comunicacao centralizada com presenca em planta baixa e chamadas de audio, camera e tela via LiveKit.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` em duas abas ou dois navegadores, entre com nomes diferentes e clique em `Entrar na voz`.

## Configurar LiveKit

O backend gera tokens JWT de sala usando as credenciais do seu servidor LiveKit. Antes de rodar, defina:

```bash
LIVEKIT_URL=wss://seu-livekit
LIVEKIT_API_KEY=sua_api_key
LIVEKIT_API_SECRET=seu_api_secret
```

Para self-host local, voce pode usar o servidor do repositorio `livekit/livekit` e gerar chave/secret no proprio LiveKit. O app cria uma sala por canal (`tec-hq-team`, `tec-hq-daily`, `tec-hq-focus`) para reduzir assinatura de midia fora do contexto atual.

Modo dev local do LiveKit:

```bash
livekit-server --dev
```

Esse modo usa `devkey` e `secret`. Em outro terminal:

```powershell
$env:LIVEKIT_URL="ws://localhost:7880"
$env:LIVEKIT_API_KEY="devkey"
$env:LIVEKIT_API_SECRET="secret"
npm run dev
```

## O que este MVP entrega

- Interface minimalista inspirada em Discord para espacos e canais.
- Planta baixa interativa com avatares movidos por clique, setas ou WASD.
- Presenca em tempo real com Socket.IO.
- Chamada de voz, camera e compartilhamento de tela com LiveKit.
- Otimizacoes de midia com `adaptiveStream`, `dynacast`, simulcast e audio com DTX/RED.
- Base separada para evoluir para integracoes, agenda, chat, salas privadas e autenticacao.

## Proximos passos naturais

- Autenticacao corporativa e perfis.
- Chat persistente por canal.
- Autenticacao antes da emissao de tokens LiveKit.
- Integracoes com calendario, tarefas, documentos e chamados.
- Servico de sinalizacao escalavel com Redis adapter para multiplas instancias.
- TURN e configuracao de firewall para LiveKit em producao.
