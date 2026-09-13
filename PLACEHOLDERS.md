# Inventário de dados de exemplo

Tudo o que está nesta lista é **temporário** e tem de ser substituído por dados
reais antes do lançamento. Nada aqui foi confirmado.

**Convenção de marcação** — texto visível ao cliente leva o prefixo `[EXEMPLO]`.
Campos por preencher usam `XXX`. Números de telefone de exemplo usam a gama
reservada `+244 900 000 000`, que não pertence a ninguém: quem ligue não
incomoda um estranho.

Última actualização: 13 de Setembro de 2026 (B2, B3 e o modelo de tamanhos).

---

## 1. Identificação da empresa — páginas legais

| Onde | Linha | Valor de exemplo |
|---|---|---|
| [termos-e-condicoes.html](termos-e-condicoes.html#L83) | 83 | `[EXEMPLO] Mushy Parfum, Lda.` |
| [termos-e-condicoes.html](termos-e-condicoes.html#L83) | 83 | `[EXEMPLO] Rua XXX, n.º XXX, Luanda, Angola` |
| [termos-e-condicoes.html](termos-e-condicoes.html#L83) | 83 | NIF `[EXEMPLO] XXXXXXXXXX` |
| [politica-de-privacidade.html](politica-de-privacidade.html#L83) | 83 | os mesmos três valores |

A denominação social, a sede e o NIF são obrigatórios por lei nos termos e na
política de privacidade. São o item mais urgente da lista.

## 2. Contactos

| Onde | Linha | Valor de exemplo |
|---|---|---|
| [index.html](index.html#L229) | 229 | `[EXEMPLO] geral@mushyparfum.ao` |
| [index.html](index.html#L239) | 239 | `[EXEMPLO] +244 900 000 000` |
| [termos-e-condicoes.html](termos-e-condicoes.html#L168) | 168–169 | e-mail e telefone |
| [politica-de-privacidade.html](politica-de-privacidade.html#L186) | 186–187 | e-mail e telefone |

O Instagram (`@mushy_parfum`) é **real** e não precisa de ser substituído.
Facebook, TikTok e WhatsApp estão preparados no rodapé mas sem links, conforme
indicado.

> **Nota:** os campos "Contactos" em Definições (telefone, e-mail, Instagram)
> gravam na base de dados mas o site público ainda não os lê — as versões
> visíveis são as do HTML acima. Ver secção 5.

## 3. Dados de pagamento

Guardados em `payment_settings` e editáveis em **Definições → Dados de
pagamento**. Não estão em código.

| Campo | Estado |
|---|---|
| `bank_name` | por preencher |
| `account_holder` | por preencher |
| `account_number` (IBAN) | por preencher |
| `express_phone` | por preencher |

Enquanto estiverem vazios o checkout mostra um travessão em vez de um IBAN
inventado. Nunca foi semeado um IBAN de exemplo, precisamente porque um IBAN
com ar verosímil é o pior tipo de placeholder: alguém podia transferir dinheiro
para ele.

## 4. Zonas de entrega — **novo em B3**

Semeadas em [supabase/migration_15_fixacao_zonas.sql](supabase/migration_15_fixacao_zonas.sql#L50)
e editáveis em **Definições → Zonas de entrega**.

| Zona | Preço de exemplo |
|---|---|
| Talatona | 2 500 Kz |
| Kilamba / Camama | 3 000 Kz |
| Luanda Centro / Ingombota | 3 500 Kz |
| Viana / Cacuaco | 4 500 Kz |
| Fora de Luanda | sob consulta |

Os **nomes** das zonas são áreas reais de Luanda e provavelmente servem. Os
**preços** vieram do briefing como exemplo e não foram confirmados.

Ao contrário das restantes entradas desta lista, estes valores **não** levam o
prefixo `[EXEMPLO]`: um preço deliberadamente falso tornaria impossível testar
o total do checkout de ponta a ponta. Em vez disso, o painel de administração
mostra um aviso permanente por cima da tabela até serem revistos, e ficam
registados aqui.

O limite para entrega grátis está **desactivado** por omissão, sem valor
definido. Se for activado sem valor, o formulário recusa guardar.

## 5. Tamanhos e preços por tamanho — **novo**

Definidos em [supabase/migration_16_product_variants.sql](supabase/migration_16_product_variants.sql)
e editáveis em **Definições → Tamanhos** (os tamanhos e as percentagens) e em
**Produtos → editar produto** (o preço e o stock de cada tamanho).

| Tamanho | % do preço base | Estado |
|---|---|---|
| 35 ml | 55% | **percentagem de exemplo** |
| 50 ml | 75% | **percentagem de exemplo** |
| 100 ml | 100% (preço base) | corresponde ao preço já praticado |

O preço base de cada produto é o que já lá estava e é real; é o preço do 100 ml.
As percentagens de 55% e 75% vieram do briefing como ponto de partida e **não
foram calculadas a partir de custos**. Dão apenas o valor por omissão: o preço
de qualquer tamanho pode ser escrito à mão no produto, e nesse caso deixa de
seguir a percentagem.

> **35 ml ou 30 ml?** O briefing inicial dizia 30 ml; a indicação mais recente
> disse 35 ml, que foi o que ficou. Muda-se em Definições → Tamanhos, num campo.

**Stock:** os 100 ml herdaram o stock que cada produto já tinha. Os 35 ml e os
50 ml começaram a zero, e aparecem como esgotados até serem preenchidos, porque
sabemos que stock existe mas não sabemos que stock existe num tamanho que nunca
foi vendido. Inventá-lo poria pedidos na lista que não podem ser satisfeitos.
O stock total do produto passou a ser a soma dos tamanhos, calculada
automaticamente.

## 6. Por fazer, fora do âmbito de B2 e B3

- **Definições → Contactos não chega ao site.** Os três campos gravam
  correctamente mas nenhuma página pública os lê; o rodapé e o cartão de
  contactos da página inicial continuam com os valores fixos do HTML. É a mesma
  cadeia partida que o banner promocional tinha antes de B-fix 2. Resolve-se da
  mesma maneira, com uma vista pública. Aguarda decisão.
- **E-mail transaccional.** Os modelos em
  [supabase/email-templates/](supabase/email-templates/) estão escritos mas o
  envio depende de configurar SMTP (Resend). Até lá o Supabase envia os textos
  predefinidos, em inglês.
- **Imagens de produto.** PNG entre 183 KB e 451 KB. Precisam de ser
  convertidas para WebP; exige ferramentas de imagem que não existem neste
  ambiente.
