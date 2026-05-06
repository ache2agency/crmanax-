#!/bin/bash

set -e

echo "Verificando entorno local de WhatsApp..."

if [ ! -f ".env.local" ]; then
  echo "Falta .env.local"
  exit 1
fi

missing=0
provider=$(grep '^WHATSAPP_PROVIDER=' .env.local 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'" )

if [ -z "$provider" ]; then
  provider="twilio"
fi

base_keys="NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY"

if [ "$provider" = "meta" ]; then
  provider_keys="META_WHATSAPP_ACCESS_TOKEN META_WHATSAPP_PHONE_NUMBER_ID META_WHATSAPP_VERIFY_TOKEN"
else
  provider_keys="TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_WHATSAPP_NUMBER"
fi

for key in $base_keys $provider_keys; do
  if ! grep -q "^${key}=" .env.local; then
    echo "Falta variable: ${key}"
    missing=1
  fi
done

if [ "$missing" -eq 1 ]; then
  exit 1
fi

echo "Proveedor configurado: ${provider}"

if lsof -i :3000 >/dev/null 2>&1; then
  echo "Puerto 3000: en uso"
else
  echo "Puerto 3000: libre"
fi

if [ "$provider" = "twilio" ]; then
  if command -v ngrok >/dev/null 2>&1; then
    echo "Tunnel disponible: ngrok"
  elif command -v cloudflared >/dev/null 2>&1; then
    echo "Tunnel disponible: cloudflared"
  elif command -v lt >/dev/null 2>&1; then
    echo "Tunnel disponible: localtunnel"
  else
    echo "Tunnel disponible: ninguno detectado"
    echo "Necesitas una URL publica para que Twilio llegue a tu webhook local."
  fi
fi

echo ""
echo "Checklist rapida:"
echo "1. Inicia el proyecto con: npm run dev"
echo "2. Verifica en navegador: http://localhost:3000/api/whatsapp/status"
if [ "$provider" = "meta" ]; then
  echo "3. En Meta Developers, configura el webhook:"
  echo "   GET/POST <URL_PUBLICA>/api/whatsapp/webhook"
  echo "4. Usa META_WHATSAPP_VERIFY_TOKEN igual en Meta y en .env.local"
  echo "5. Prueba con el numero activo en WhatsApp Manager"
else
  echo "3. Expone localhost con un tunnel o usa una URL estable desplegada"
  echo "4. En Twilio Sandbox, configura:"
  echo "   POST <URL_PUBLICA>/api/whatsapp/webhook"
  echo "5. En tu WhatsApp, confirma que el numero siga unido al sandbox con el codigo join"
fi
