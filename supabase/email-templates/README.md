# Modelos de e-mail de autenticação (PT)

Os dois e-mails da recuperação de palavra-passe, em português de Portugal e com
a identidade da MushyParfum:

- **Redefinir a sua palavra-passe**, enviado quando alguém pede a recuperação.
  A ligação é válida 60 minutos (`mailer_otp_exp: 3600`) e é de utilização única.
- **A sua palavra-passe foi alterada**, enviado depois de a alteração ser
  concluída, para que o cliente saiba caso não tenha sido ele.

## Porque é que ainda não estão aplicados

A API respondeu:

> Email template modification is not available for free tier projects using the
> default email provider. Please upgrade your plan or configure a custom SMTP
> provider.

Ou seja, **não é uma limitação do código**. O fluxo de recuperação funciona já;
o que fica por aplicar é o aspecto do e-mail, que continua a ser o modelo
predefinido do Supabase, em inglês.

## Como aplicar, assim que houver SMTP ou plano pago

```sh
curl -X PATCH "https://api.supabase.com/v1/projects/<PROJECT_REF>/config/auth" \
  -H "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  --data-binary @auth-templates.pt.json
```

`build-templates.pl` regenera o `auth-templates.pt.json` caso o texto mude:

```sh
perl build-templates.pl > auth-templates.pt.json
```
