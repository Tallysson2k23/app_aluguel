# Aluguel Map

Aplicação web mobile-first para explorar e anunciar casas e apartamentos em Santa Cruz do Capibaribe–PE. Usa React, TypeScript, Vite, React Router, Leaflet, Firebase Authentication e Cloud Firestore.

## Rodar localmente

Requisitos: Node.js 20.19+ na série 20 ou 22.12+, npm e Java 21+ no PATH para o emulador do Firestore. Execute a partir da raiz do projeto.

```powershell
npm ci
npm run emulators
```

Em outro terminal:

```powershell
npm run seed
npm run dev
```

Abra [Aluguel Map local](http://localhost:5173/). A [interface do Emulator Suite](http://127.0.0.1:4000/) permite inspecionar Auth e Firestore. O desenvolvimento usa emuladores por padrão, com Auth na porta 9099 e Firestore na 8080. O script de demonstração aponta exclusivamente para o projeto local `demo-aluguel-map` e pode ser repetido sem substituir os anúncios já criados. O conteúdo padrão do emulador dura até o encerramento do processo. Para reaproveitar dados entre sessões, use as opções `--import` e `--export-on-exit` do Firebase CLI com um diretório local dedicado.

- Conta fictícia verificada: `anunciante@example.test` com senha `Demonstracao!2026`.
- Para testar um novo cadastro ou recuperar uma senha, use o link impresso no terminal do Auth Emulator. Depois de confirmar, volte ao Perfil e selecione **Já verifiquei**. O endereço do WhatsApp da demonstração serve para validar a formação do link.
- Para ver a casinha vermelha, ative **Filtros → Mostrar ocupados**. O conjunto inicial inclui imóveis para alugar agora, para alugar em breve, ocupados com autorização e à venda.

## Build e testes

```powershell
npm run build
# Usa um emulador isolado na porta 8180.
npm test
```

Os testes de regras iniciam o projeto descartável `demo-aluguel-map-rules`. Eles verificam leitura pública com filtros e limite, isolamento de rascunhos, anúncios pausados e ocultos, edição por terceiros, imutabilidade do proprietário, publicação sem e-mail verificado, proteção do contato, atomicidade e privacidade de perfil, favoritos e denúncias.

Para os testes de interface, mantenha `npm run emulators` e `npm run dev` ativos e já execute `npm run seed`.

```powershell
npx playwright install chromium webkit
npm run test:e2e
```

O Playwright usa o Chrome instalado no caminho padrão do Windows ou o indicado em `CHROME_PATH`. Se não o encontrar, usa Chromium. O perfil iPhone usa WebKit no Windows e simula viewport e toque. Os testes bloqueiam as requisições de tiles públicos para verificar a alternativa em lista sem gerar tráfego automatizado no OpenStreetMap.

Validação executada no Windows com Chrome 156 de desktop, Chrome 156 no perfil Pixel 7 e WebKit 27.2 no perfil iPhone 13. Foi verificada a interface a 320 px, com latência simulada e redução da área visível durante a digitação. O teclado virtual de um celular físico e a instalação em aparelhos reais ainda precisam de verificação.

Para gerar um build local conectado aos emuladores no PowerShell:

```powershell
$env:VITE_USE_EMULATORS = 'true'
npm run build
Remove-Item Env:VITE_USE_EMULATORS
```

## Busca e localização

- A primeira consulta cobre a região central configurada. **Buscar nesta área** usa o retângulo visível no mapa. O Firestore aplica cidade, publicação, visibilidade e intervalos de latitude e longitude. Cada chamada lê até 25 documentos, exibe até 24 e oferece continuação por cursor.
- Busca por trecho de título ou bairro, filtros adicionais e ordenação são compartilhados por mapa e lista e operam sobre as páginas carregadas. A pesquisa ignora maiúsculas e acentos. Carregue mais páginas para incluir outros resultados da área. A ordenação exibida é relativa aos resultados carregados.
- O marcador público é arredondado para uma grade de 0,002° (cerca de 220 m na latitude do piloto). O editor aceita um ponto aproximado ou ajuste por direção. O aplicativo só pede a localização de quem navega ao tocar em **Minha localização**, e usa a posição para centralizar o mapa.
- Configure cidade, centro e zoom em `src/config.ts`. Atualize o identificador e as amostras em `scripts/seed.mjs` para uma nova demonstração. Anúncios já criados preservam a cidade original.
- Configure `VITE_TILE_URL` e `VITE_TILE_ATTRIBUTION` para trocar o provedor. O piloto usa os tiles públicos com atribuição visível, cache HTTP padrão do navegador e sem pré-carregamento. [Política de uso de tiles do OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/)

## Modelo Firestore

| Caminho | Dados e acesso |
| --- | --- |
| `profiles/{uid}` | Nome e timestamp do servidor. A própria conta pode ler e gravar. O e-mail fica no Auth. |
| `listings/{id}` | Proprietário imutável, cidade, finalidade, tipo, disponibilidade, publicação, visibilidade, grade aproximada, valores em reais, características e timestamps. Visitantes leem anúncios publicados e visíveis. O proprietário também lê os próprios anúncios privados. |
| `contacts/{id}` | Proprietário, número brasileiro normalizado e timestamp. O dono gerencia. Contas verificadas podem consultar pelo ID apenas enquanto a divulgação estiver habilitada e o anúncio estiver publicado e com visibilidade normal. |
| `profiles/{uid}/favorites/{id}` | Referência pelo ID e timestamp. Só a própria conta pode consultar e remover. |
| `reports/{id}/submissions/{uid}` | Motivo enumerado e timestamp. A conta pode criar uma única denúncia por imóvel público. A triagem é administrativa, fora do aplicativo. |

Finalidade (`rent`, `sale`), disponibilidade (`available`, `soon`, `occupied`, `closed`) e situação editorial (`draft`, `published`, `paused`, `archived`) são independentes. `visibility` deriva da disponibilidade e da autorização para mostrar ocupados. Vendas encerradas e ocupados sem autorização ficam fora da busca. Previsões vencidas continuam como “Em breve” até a decisão explícita do anunciante. Gravações do anúncio e do contato são atômicas. Uma edição concorrente exige reabrir o anúncio para trabalhar com a versão mais recente.

O código do domínio está em `src/domain.ts` e o acesso aos dados em `src/data.ts`. As regras e os índices versionados estão em `firestore.rules` e `firestore.indexes.json`. A aplicação não coleta um campo de endereço exato ou dados de documentos pessoais. O editor orienta o anunciante a evitar esses dados no texto livre.

## Tela inicial e conexão

No Chrome do Android, abra o menu do navegador e escolha **Adicionar à tela inicial** ou **Instalar aplicativo**, conforme a versão. No Safari do iOS, toque em **Compartilhar → Adicionar à Tela de Início**. Use um endereço HTTPS para instalação fora do ambiente local. A aplicação inclui manifesto e ícones locais. Não há service worker. Se a conexão cair com o aplicativo aberto, a lista pode continuar mostrando resultados já carregados.

## Firebase existente e publicação

O briefing identifica `aluguel-map`, mas o objeto de configuração Web não veio preenchido. O CLI autenticado recebeu HTTP 403 ao consultar o Firestore e seus índices e não conseguiu listar os apps Web. A demonstração e os testes usam exclusivamente os emuladores.

1. No Console Firebase de `aluguel-map`, confirme o app Web, a instância e a localização do Firestore, o provedor de login E-mail/senha, os domínios autorizados e os modelos de e-mail.
2. Copie `.env.example` para `.env.local`. Preencha as variáveis `VITE_FIREBASE_*` com a configuração do app Web e defina `VITE_USE_EMULATORS=false`. A aplicação não precisa de chaves privadas, Cloud Storage, Cloud Functions ou faturamento obrigatório.
3. Antes de qualquer aplicação das regras, compare as coleções, regras e índices existentes com os arquivos locais. Incorpore as cláusulas novas ao conjunto existente e preserve os demais acessos e índices. O deploy de regras substitui o conjunto ativo. O emulador valida regras e consultas, mas a criação e o estado dos índices compostos precisam ser confirmados no Firestore real.
4. Revise os rascunhos de privacidade e termos, os dados e os domínios do piloto. Gere o build com `npm run build` usando o ambiente real. Após revisão e autorização, os alvos seriam `firestore:rules`, `firestore:indexes` e `hosting`, sempre com `--project aluguel-map`. A configuração de Hosting publica `dist` e reescreve URLs da SPA para `index.html`. Confirme os fluxos e o envio de e-mails com uma conta de teste no domínio real.

### Recursos sujeitos a alteração em produção

- **Authentication**: habilitação de e-mail/senha ou ajustes de domínio e modelos de e-mail, conforme o inventário.
- **Firestore**: regras revisadas, índices compostos para mapa e painel do proprietário e uso das coleções descritas acima.
- **Hosting**: versão estática do aplicativo e rotas da SPA.



