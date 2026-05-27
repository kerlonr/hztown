# Projeto GT

MVP de uma plataforma de comunicacao centralizada com presenca em planta baixa e chamada de voz via WebRTC.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000` em duas abas ou dois navegadores, entre com nomes diferentes e clique em `Entrar na voz`.

## O que este MVP entrega

- Interface minimalista inspirada em Discord para espacos e canais.
- Planta baixa interativa com avatares movidos por clique, setas ou WASD.
- Presenca em tempo real com Socket.IO.
- Chamada de voz P2P com WebRTC entre usuarios no mesmo canal.
- Base separada para evoluir para integracoes, agenda, chat, salas privadas e autenticacao.

## Proximos passos naturais

- Autenticacao corporativa e perfis.
- Chat persistente por canal.
- Video opcional na mesma camada WebRTC.
- Integracoes com calendario, tarefas, documentos e chamados.
- Servico de sinalizacao escalavel com Redis adapter para multiplas instancias.
- TURN server para chamadas confiaveis fora da rede local.
