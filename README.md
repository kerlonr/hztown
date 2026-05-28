# Projeto GT

MVP de uma plataforma de comunicacao centralizada com presenca em planta baixa e chamadas de audio, camera e tela via LiveKit.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` em duas abas ou dois navegadores, entre com nomes diferentes e clique em `Entrar na voz`.

## Instalar como app

O projeto e um PWA. Em producao com HTTPS, o navegador pode oferecer a opcao de instalar:

- Chrome/Edge desktop: icone de instalar na barra de endereco ou menu `Instalar app`.
- Android Chrome: menu do navegador > `Adicionar a tela inicial` ou `Instalar app`.
- iPhone/iPad Safari: compartilhar > `Adicionar a Tela de Inicio`.

## Estrutura

```text
server.js                 # Entrada HTTP, estaticos e bootstrap do Socket.IO
server/sanitizers.js        # Sanitizacao de ids, texto e avatares recebidos
server/spaceStore.js        # Estado em memoria de usuarios e mensagens
server/livekitTokenRoute.js # Rota que emite token LiveKit
server/socketEvents.js      # Eventos Socket.IO de presenca, chat e sinalizacao
public/app.js             # Orquestracao do cliente: eventos, LiveKit e render principal
public/js/core/           # Configuracao, estado e referencias DOM
public/js/features/       # Funcionalidades de produto: chat e PWA
public/js/ui/             # Renderizadores visuais: avatar, icones e toasts
public/js/shared/         # Helpers pequenos e puros
```

## Configurar LiveKit

O backend gera tokens JWT de sala usando as credenciais do seu servidor LiveKit. Antes de rodar, defina:

```bash
LIVEKIT_URL=wss://seu-livekit
LIVEKIT_API_KEY=sua_api_key
LIVEKIT_API_SECRET=seu_api_secret
```

Para self-host local, voce pode usar o servidor do repositorio `livekit/livekit` e gerar chave/secret no proprio LiveKit. O app cria uma sala por canal (`projeto-gt-team`, `projeto-gt-daily`, `projeto-gt-focus`) para reduzir assinatura de midia fora do contexto atual.

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
