# Configuração PM2 + Tailscale

## Configuração Concluída

O projeto agora está configurado para rodar em uma única porta (3000) usando PM2 e funciona com Tailscale.

### Arquivos Criados/Modificados

- `ecosystem.config.js` - Configuração do PM2
- `next.config.ts` - Configurado para aceitar conexões externas
- `package.json` - Adicionados scripts PM2
- `.gitignore` - Adicionada pasta de logs

## Como Usar

### 1. Build da Aplicação

```bash
npm run build
```

### 2. Iniciar com PM2

```bash
npm run pm2:start
```

Ou usar o comando de deploy completo:

```bash
npm run deploy
```

### 3. Gerenciar a Aplicação

```bash
# Ver logs em tempo real
npm run pm2:logs

# Monitorar recursos
npm run pm2:monit

# Reiniciar
npm run pm2:restart

# Parar
npm run pm2:stop

# Remover do PM2
npm run pm2:delete
```

## Acesso via Tailscale

A aplicação está configurada para aceitar conexões de qualquer origem (HOSTNAME: 0.0.0.0).

### Para acessar via Tailscale:

1. Certifique-se que o Tailscale está rodando na máquina
2. Pegue o IP do Tailscale: `tailscale ip -4`
3. Acesse pelo IP: `http://[TAILSCALE_IP]:3000`

Exemplo: `http://100.x.x.x:3000`

## Configuração Automática no Boot (Opcional)

Para iniciar automaticamente quando o sistema reiniciar:

```bash
pm2 startup
```

Depois salve a configuração:

```bash
pm2 save
```

## Porta

Por padrão, a aplicação roda na porta **3000**.

Para mudar, edite `ecosystem.config.js` e altere:

```javascript
env: {
  PORT: 3000, // Mudar aqui
  // ...
}
```

## Logs

Os logs ficam salvos em:
- `./logs/out.log` - Saída padrão
- `./logs/err.log` - Erros
