import { NextResponse } from 'next/server'
import {
  getMetaConfig,
  getTwilioConfig,
  getWhatsAppProvider,
} from '@/lib/whatsapp/provider'

/**
 * GET /api/whatsapp/status
 * Devuelve si el proveedor de WhatsApp está configurado (para depurar env en Vercel).
 * No expone valores, solo si están definidas o no.
 */
export async function GET() {
  const provider = getWhatsAppProvider()
  const twilio = getTwilioConfig()
  const meta = getMetaConfig()
  const ok =
    provider === 'meta'
      ? !!meta.accessToken && !!meta.phoneNumberId && !!meta.verifyToken
      : !!twilio.accountSid && !!twilio.authToken && !!twilio.fromNumber

  return NextResponse.json({
    provider,
    configured: ok,
    twilioConfigured:
      !!twilio.accountSid && !!twilio.authToken && !!twilio.fromNumber,
    metaConfigured:
      !!meta.accessToken && !!meta.phoneNumberId && !!meta.verifyToken,
    hasAccountSid: !!twilio.accountSid,
    hasAuthToken: !!twilio.authToken,
    hasWhatsappNumber: !!twilio.fromNumber,
    hasMetaAccessToken: !!meta.accessToken,
    hasMetaPhoneNumberId: !!meta.phoneNumberId,
    hasMetaVerifyToken: !!meta.verifyToken,
  })
}
