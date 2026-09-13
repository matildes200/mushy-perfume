use strict;
use warnings;
use utf8;
binmode(STDOUT, ":encoding(UTF-8)");

# Builds the JSON payload that brands the two recovery e-mails in Portuguese.
# Supabase sends both natively, so the "tell them their password changed"
# requirement needs no mail provider of our own.

my $shell_open = <<'HTML';
<div style="margin:0;padding:32px 16px;background:#FAF5EA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#FFFBF3;border:1px solid #E6D9C0;border-radius:14px;overflow:hidden;">
    <div style="padding:26px 32px;border-bottom:1px solid #EFE1C6;">
      <span style="font-family:Georgia,'Times New Roman',serif;font-size:21px;color:#3B2A1D;letter-spacing:0.5px;">Mushy<span style="color:#6B4226;">Parfum</span></span>
    </div>
    <div style="padding:30px 32px;color:#3B2A1D;font-size:15px;line-height:1.7;">
HTML

my $shell_close = <<'HTML';
    </div>
    <div style="padding:20px 32px;border-top:1px solid #EFE1C6;color:#8B7256;font-size:12px;line-height:1.6;">
      Mushy Parfum &middot; Perfumaria fina<br>
      Recebeu este e-mail porque existe uma conta associada a este endereço.
    </div>
  </div>
</div>
HTML

my $button = sub {
    my ($label) = @_;
    return qq{<p style="margin:26px 0;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#4A3320;color:#FBF3E4;text-decoration:none;padding:13px 26px;border-radius:8px;font-size:14px;letter-spacing:0.4px;">$label</a></p>};
};

my $recovery = $shell_open . <<'HTML' . $button->('Definir nova palavra-passe') . <<'HTML2' . $shell_close;
      <h2 style="font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:22px;margin:0 0 14px;color:#3B2A1D;">Redefinir a sua palavra-passe</h2>
      <p style="margin:0 0 12px;">Recebemos um pedido para redefinir a palavra-passe da sua conta Mushy Parfum.</p>
      <p style="margin:0 0 12px;">Carregue no botão abaixo para escolher uma nova. A ligação é válida durante 60 minutos e só pode ser utilizada uma vez.</p>
HTML
      <p style="margin:0;color:#8B7256;font-size:13px;">Se não foi você que fez este pedido, ignore este e-mail. A sua palavra-passe actual continua válida.</p>
HTML2

my $changed = $shell_open . <<'HTML' . $shell_close;
      <h2 style="font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:22px;margin:0 0 14px;color:#3B2A1D;">A sua palavra-passe foi alterada</h2>
      <p style="margin:0 0 12px;">A palavra-passe da sua conta Mushy Parfum foi alterada há instantes.</p>
      <p style="margin:0 0 12px;">Se foi você, não precisa de fazer nada.</p>
      <p style="margin:0;color:#8B7256;font-size:13px;"><strong>Se não foi você</strong>, contacte-nos de imediato para protegermos a sua conta.</p>
HTML

sub esc {
    my ($s) = @_;
    $s =~ s/\\/\\\\/g;
    $s =~ s/"/\\"/g;
    $s =~ s/\r//g;
    $s =~ s/\n/\\n/g;
    return $s;
}

print '{';
print '"mailer_subjects_recovery":"Redefinir a sua palavra-passe",';
print '"mailer_templates_recovery_content":"' . esc($recovery) . '",';
print '"mailer_subjects_password_changed_notification":"A sua palavra-passe foi alterada",';
print '"mailer_templates_password_changed_notification_content":"' . esc($changed) . '",';
print '"mailer_otp_exp":3600';
print '}';
