# 🚀 SalesCRM - El CRM Inteligente que Vende por Ti

> Sistema de gestión de relaciones con clientes (CRM) moderno con IA integrada, automatización de WhatsApp y gestión documental avanzada.

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.3-blue?logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)

## ✨ Características Principales

### 🤖 **Inteligencia Artificial Integrada**
- **Asistente de ventas IA**: Chatbot que analiza leads y da recomendaciones concretas
- **RAG Documental**: Sistema de recuperación de conocimiento que aprende de tus documentos
- **Análisis predictivo**: Identifica oportunidades de cierre basadas en datos históricos

### 📱 **Automatización de Comunicaciones**
- **WhatsApp Inteligente**: Flows configurables con takeover humano
- **Email Marketing**: Secuencias automatizadas con tracking
- **Templates personalizados**: Mensajes predefinidos por etapa del pipeline
- **LAB BOT**: Simulador interno para probar conversaciones `ads` y `walk-in` desde el CRM

### 📊 **Gestión de Ventas Avanzada**
- **Pipeline Visual**: Kanban board con drag & drop alineado al proceso comercial de Windsor
- **Asignación inteligente**: Distribución automática de leads entre vendedores
- **Analíticas en tiempo real**: Métricas de rendimiento y conversión
- **Detalle comercial del lead**: siguiente paso sugerido, timeline y seguimiento reciente

### 👥 **Gestión de Equipos**
- **Roles y permisos**: Admin/Vendedor con accesos diferenciados
- **Colaboración**: Comentarios, notas y seguimiento compartido
- **Reportes por vendedor**: Métricas individuales y de equipo

### 📚 **Base de Conocimiento**
- **Procesamiento PDF**: Subida y análisis automático de documentos
- **Búsqueda semántica**: Encuentra información relevante rápidamente
- **Edición colaborativa**: Mantén actualizada tu base de conocimiento

## 🏗️ Arquitectura

### **Frontend**
- **Framework**: Next.js 16.1.6 con App Router
- **UI**: React 19.2.3 + TailwindCSS v4
- **Estado**: React hooks y context
- **Tipado**: TypeScript

### **Backend**
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth con RLS
- **API**: Next.js API Routes
- **File Storage**: Supabase Storage

### **Integraciones Externas**
- **WhatsApp**: Twilio API
- **Email**: Resend
- **IA**: OpenAI GPT-4
- **PDF**: pdf-parse

## 🚀 Quick Start

### **Prerrequisitos**
- Node.js 18+
- npm/yarn/pnpm
- Cuenta de Supabase

### **Instalación**

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd salescrm
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales. Puedes usar `Twilio` o `Meta Cloud API`:
```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
OPENAI_API_KEY=tu_openai_api_key
RESEND_API_KEY=tu_resend_api_key
WHATSAPP_PROVIDER=meta
META_WHATSAPP_ACCESS_TOKEN=tu_meta_access_token
META_WHATSAPP_PHONE_NUMBER_ID=tu_meta_phone_number_id
META_WHATSAPP_VERIFY_TOKEN=tu_verify_token
META_WHATSAPP_BUSINESS_ACCOUNT_ID=tu_waba_id
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

Si quieres seguir con Twilio:
```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=tu_twilio_sid
TWILIO_AUTH_TOKEN=tu_twilio_token
TWILIO_WHATSAPP_NUMBER=+5217474785589
```

4. **Configurar base de datos**
```bash
# Ejecutar migraciones SQL desde /supabase/
supabase db push
```

5. **Iniciar desarrollo**
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📌 Estado Actual Del CRM

Hoy el CRM ya incluye:

- vista de conversaciones con filtros, badges, lead ligado y takeover humano;
- sincronía reforzada entre `stage` del lead y `fase` de WhatsApp;
- modal del lead con timeline, última actividad y siguiente paso;
- envío directo de información por WhatsApp desde el modal del lead;
- agenda con status operativos y validación de fechas;
- pestañas `BOT` y `LAB BOT` para configurar y simular el bot;
- refactor principal de UI en `components/crm/`;
- flujo de convenios en dos partes (lista → detalle por institución, 13 convenios);
- FAQ completo subido al RAG (preguntas formales + variantes coloquiales);
- system prompt mejorado para interpretar preguntas ambiguas en fases `dudas` y `seguimiento`.

## 🔧 Pendientes

### Bot WhatsApp
- [ ] Investigar atoro cuando el usuario pregunta por descuentos/promos generales (no convenios) — identificar qué escribe el usuario y en qué fase ocurre
- [ ] Agregar link PDF del examen de ubicación en `EXAMEN_UBICACION_MSG` (pendiente desde antes)
- [ ] Monitorear conversaciones reales 2-3 veces por semana e iterar sobre fallos detectados
- [ ] Revisar si la detección `detectarPreguntaConvenio` captura por error preguntas de descuento de programa

### Base de conocimiento (RAG)
- [ ] Agregar fechas de inicio de cada programa
- [ ] Completar info de maestrías y diplomados (actualmente solo via RAG sin hardcode)

### CRM General
- [ ] Rutina de revisión de conversaciones definida

Validaciones útiles del proyecto:

```bash
npm run whatsapp:check
npm run crm:check
```

Checklist manual:

- `docs/CRM_QA_CHECKLIST.md`

## 📁 Estructura del Proyecto

```
salescrm/
├── app/                    # Páginas y componentes
│   ├── api/               # API routes
│   │   ├── chat/         # Asistente IA
│   │   ├── emails/       # Email marketing
│   │   ├── rag/          # Procesamiento RAG
│   │   └── whatsapp/     # Webhook y gestión
│   ├── auth/             # Autenticación
│   ├── crm.jsx           # Orquestación principal del CRM
│   └── layout.tsx        # Layout principal
├── components/crm/        # Componentes extraídos del CRM
│   ├── AgendaPanel.jsx
│   ├── ConversationsPanel.jsx
│   ├── KanbanBoard.jsx
│   ├── LeadDetailModal.jsx
│   ├── LeadsTable.jsx
│   ├── NewAppointmentModal.jsx
│   └── NewLeadModal.jsx
├── docs/                  # Contexto, pendientes y QA
├── supabase/             # Migraciones y schema
│   ├── whatsapp_conversations.sql
│   ├── rag.sql
│   └── email_sequences.sql
├── scripts/              # Checks operativos
│   ├── check-crm-quality.sh
│   └── check-whatsapp-dev.sh
├── utils/                # Utilidades
│   └── supabase/         # Cliente Supabase
├── public/               # Assets estáticos
└── landing.html          # Landing page de marketing
```

## 🔧 Configuración

### **Base de Datos**

Las tablas principales se crean automáticamente con los archivos SQL en `/supabase/`:

- `leads` - Información de prospectos
- `profiles` - Perfiles de usuarios
- `whatsapp_conversaciones` - Conversaciones de WhatsApp
- `whatsapp_mensajes` - Mensajes individuales
- `whatsapp_flows` - Reglas de automatización
- `lead_activities` - Historial comercial persistente por lead
- `documentos` - Base de conocimiento RAG

### **Roles de Usuario**

- **Admin**: Acceso completo a todas las funcionalidades
- **Vendedor**: Acceso limitado a sus leads asignados

### **Integraciones**

#### **WhatsApp**
El CRM soporta dos proveedores vía `WHATSAPP_PROVIDER`:

- `twilio`: mantiene el flujo actual del sandbox o sender de Twilio.
- `meta`: usa WhatsApp Cloud API directo desde Meta.

Para `meta`:
1. Configura webhook en: `/api/whatsapp/webhook`
2. En Meta Developers usa la verificación `GET` y eventos `messages`
3. Agrega `META_WHATSAPP_ACCESS_TOKEN`, `META_WHATSAPP_PHONE_NUMBER_ID` y `META_WHATSAPP_VERIFY_TOKEN`
4. Si usas Vercel como endpoint estable, usa:
   `https://crm.windsor.edu.mx/api/whatsapp/webhook`

Para `twilio`:
1. Configura webhook en: `/api/whatsapp/webhook`
2. Configura número de WhatsApp en Twilio
3. Agrega credenciales en `.env.local`

#### **Email (Resend)**
1. Crea cuenta en Resend
2. Configura dominio de envío
3. Agrega API key en `.env.local`

#### **OpenAI**
1. Obtén API key de OpenAI
2. Configura en `.env.local`
3. El sistema usa GPT-4 para asistente y RAG

## 📊 API Endpoints

### **Chat IA**
```
POST /api/chat
Content-Type: application/json
{
  "message": "mensaje del usuario",
  "context": "contexto del lead"
}
```

### **WhatsApp**
```
POST /api/whatsapp/webhook
POST /api/whatsapp/send
POST /api/whatsapp/conversations
```

### **Email**
```
POST /api/emails/send
POST /api/emails/sequence
```

### **RAG**
```
POST /api/rag/upload
POST /api/rag/query
```

## 🎯 Casos de Uso

### **Equipos de Ventas**
- Automatización de seguimiento
- Calificación de leads con IA
- Gestión de pipeline visual

### **Agencias Digitales**
- Gestión de múltiples clientes
- Reportes automatizados
- Comunicaciones unificadas

### **Empresas SaaS**
- Onboarding automatizado
- Customer success
- Upselling inteligente

## 🔒 Seguridad

- **Row Level Security (RLS)** en Supabase
- **Variables de entorno** para credenciales
- **Validación de inputs** en API routes
- **CORS** configurado para producción

## 🚀 Deploy

### **Vercel (Recomendado)**
```bash
npm run build
vercel --prod
```

### **Docker**
```bash
docker build -t salescrm .
docker run -p 3000:3000 salescrm
```

### **Manual**
```bash
npm run build
npm start
```

## 📈 Monitoreo

### **Métricas Clave**
- Tasa de conversión por etapa
- Tiempo de respuesta (WhatsApp/Email)
- ROI por campaña
- Performance por vendedor

### **Logs y Debug**
- Logs de API en `/logs/`
- Debug mode: `DEBUG=true npm run dev`
- Error tracking configurado

## 🤝 Contribución

1. Fork del proyecto
2. Feature branch: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Add nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Pull Request

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

- **Email**: soporte@salescrm.com
- **Documentación**: [docs.salescrm.com](https://docs.salescrm.com)
- **Comunidad**: [Discord](https://discord.gg/salescrm)

---

**⚡ Transforma tu proceso de ventas con IA y automatización inteligente**

*Built with ❤️ using Next.js, Supabase y OpenAI*
