# 📚 SalesCRM API Documentation

## 🚀 Overview
API RESTful para integración con SalesCRM. Permite gestionar leads, comunicaciones, analytics y más.

---

## 🔐 Autenticación

### **Bearer Token**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.salescrm.com/v1/leads
```

### **API Key Setup**
1. Ve a [dashboard.salescrm.com/api](https://dashboard.salescrm.com/api)
2. Genera nueva API key
3. Configura permisos y rate limits
4. Copia y almacena de forma segura

---

## 📊 Endpoints Principales

### **Leads Management**

#### **GET /v1/leads**
Obtener lista de leads con filtros

```bash
curl -X GET "https://api.salescrm.com/v1/leads?page=1&limit=50&stage=contactado" \
     -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "nombre": "Juan Pérez",
      "email": "juan@empresa.com",
      "whatsapp": "+5215512345678",
      "curso": "Curso de Marketing Digital",
      "valor": 50000,
      "stage": "contactado",
      "asignado_a": "uuid_vendedor",
      "created_at": "2024-03-15T10:30:00Z",
      "updated_at": "2024-03-15T14:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1247,
    "total_pages": 25
  }
}
```

#### **POST /v1/leads**
Crear nuevo lead

```bash
curl -X POST "https://api.salescrm.com/v1/leads" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "nombre": "María González",
       "email": "maria@startup.com",
       "whatsapp": "+5215587654321",
       "curso": "Mentoría 1:1",
       "valor": 75000,
       "notas": "Interesada en escalación",
       "asignado_a": "uuid_vendedor"
     }'
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "nombre": "María González",
    "email": "maria@startup.com",
    "stage": "nuevo",
    "created_at": "2024-03-15T16:45:00Z"
  },
  "message": "Lead creado exitosamente"
}
```

#### **PUT /v1/leads/{id}**
Actualizar lead existente

```bash
curl -X PUT "https://api.salescrm.com/v1/leads/uuid" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "stage": "propuesta",
       "notas": "Propuesta enviada el 15/03",
       "valor": 85000
     }'
```

#### **DELETE /v1/leads/{id}**
Eliminar lead

```bash
curl -X DELETE "https://api.salescrm.com/v1/leads/uuid" \
     -H "Authorization: Bearer YOUR_API_KEY"
```

---

### **WhatsApp Integration**

#### **POST /v1/whatsapp/send**
Enviar mensaje WhatsApp

```bash
curl -X POST "https://api.salescrm.com/v1/whatsapp/send" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "to": "+5215512345678",
       "message": "Hola Juan 👋 Vi que te interesó nuestro curso. ¿Tienes 5 minutos para hablar?",
       "template_id": "contactado",
       "lead_id": "uuid"
     }'
```

**Response:**
```json
{
  "data": {
    "message_id": "whatsapp_msg_uuid",
    "status": "sent",
    "sent_at": "2024-03-15T16:45:00Z"
  },
  "message": "Mensaje enviado exitosamente"
}
```

#### **GET /v1/whatsapp/conversations**
Listar conversaciones

```bash
curl -X GET "https://api.salescrm.com/v1/whatsapp/conversations?status=abierta" \
     -H "Authorization: Bearer YOUR_API_KEY"
```

#### **POST /v1/whatsapp/webhook**
Webhook para recibir mensajes (configurado en Twilio)

```json
{
  "From": "whatsapp:+5215512345678",
  "To": "whatsapp:+14155238886",
  "Body": "Sí, quiero agendar una llamada",
  "MessageSid": "message_uuid"
}
```

---

### **Email Marketing**

#### **POST /v1/emails/send**
Enviar email individual

```bash
curl -X POST "https://api.salescrm.com/v1/emails/send" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "to": "cliente@empresa.com",
       "subject": "Tu propuesta personalizada",
       "template_id": "propuesta_curso",
       "variables": {
         "nombre": "Juan",
         "curso": "Marketing Digital",
         "precio": "$50,000"
       },
       "lead_id": "uuid"
     }'
```

#### **POST /v1/emails/sequence**
Iniciar secuencia automatizada

```bash
curl -X POST "https://api.salescrm.com/v1/emails/sequence" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "sequence_id": "welcome_series",
       "lead_id": "uuid",
       "start_immediately": true
     }'
```

---

### **AI Assistant**

#### **POST /v1/ai/chat**
Consultar asistente IA

```bash
curl -X POST "https://api.salescrm.com/v1/ai/chat" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "message": "¿Qué probabilidades tiene este lead de cerrar?",
       "lead_id": "uuid",
       "context": "lead_analysis"
     }'
```

**Response:**
```json
{
  "data": {
    "response": "Basado en el análisis del lead Juan Pérez, hay una probabilidad del 78% de cierre. Recomiendo enviar propuesta dentro de 48 horas y destacar el ROI del curso.",
    "confidence": 0.78,
    "recommendations": [
      "Enviar propuesta personalizada",
      "Agendar llamada de seguimiento",
      "Mencionar casos de éxito similares"
    ],
    "next_steps": [
      {
        "action": "send_proposal",
        "priority": "high",
        "timeline": "48 hours"
      }
    ]
  }
}
```

#### **POST /v1/ai/analyze**
Análisis predictivo de lead

```bash
curl -X POST "https://api.salescrm.com/v1/ai/analyze" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "lead_id": "uuid",
       "analysis_type": "closing_probability"
     }'
```

---

### **RAG Documental**

#### **POST /v1/rag/upload**
Subir documento a la base de conocimiento

```bash
curl -X POST "https://api.salescrm.com/v1/rag/upload" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Guía de Precios 2024",
       "content": "El curso de Marketing Digital cuesta $50,000 MXN...",
       "category": "pricing",
       "tags": ["precios", "marketing", "2024"]
     }'
```

#### **POST /v1/rag/query**
Consultar base de conocimiento

```bash
curl -X POST "https://api.salescrm.com/v1/rag/query" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "query": "¿Cuánto cuesta el curso de Marketing Digital?",
       "context": "pricing_inquiry"
     }'
```

**Response:**
```json
{
  "data": {
    "answer": "El curso de Marketing Digital tiene un costo de $50,000 MXN. Incluye acceso lifetime a todos los materiales y soporte personalizado.",
    "sources": [
      {
        "title": "Guía de Precios 2024",
        "relevance": 0.95
      }
    ],
    "confidence": 0.95
  }
}
```

---

### **Analytics y Reportes**

#### **GET /v1/analytics/dashboard**
Métricas del dashboard

```bash
curl -X GET "https://api.salescrm.com/v1/analytics/dashboard?period=30d" \
     -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "data": {
    "leads": {
      "total": 1247,
      "new": 156,
      "conversion_rate": 0.23
    },
    "revenue": {
      "total": 2450000,
      "average_deal": 85000,
      "growth": 0.34
    },
    "activities": {
      "whatsapp_sent": 892,
      "emails_sent": 1247,
      "ai_recommendations": 445
    }
  }
}
```

#### **GET /v1/analytics/reports**
Generar reporte personalizado

```bash
curl -X GET "https://api.salescrm.com/v1/analytics/reports?type=conversion_funnel&date_from=2024-02-01&date_to=2024-03-15" \
     -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 🛠️ SDKs y Librerías

### **JavaScript/Node.js**
```bash
npm install salescrm-sdk
```

```javascript
const SalesCRM = require('salescrm-sdk');

const client = new SalesCRM({
  apiKey: 'YOUR_API_KEY',
  baseURL: 'https://api.salescrm.com/v1'
});

// Crear lead
const lead = await client.leads.create({
  nombre: 'Juan Pérez',
  email: 'juan@empresa.com',
  curso: 'Marketing Digital'
});

// Enviar WhatsApp
await client.whatsapp.send({
  to: '+5215512345678',
  message: 'Hola Juan 👋',
  leadId: lead.id
});
```

### **Python**
```bash
pip install salescrm-python
```

```python
from salescrm import SalesCRM

client = SalesCRM(api_key='YOUR_API_KEY')

# Crear lead
lead = client.leads.create({
    'nombre': 'Juan Pérez',
    'email': 'juan@empresa.com',
    'curso': 'Marketing Digital'
})

# Consultar IA
analysis = client.ai.analyze(lead.id)
print(f"Probabilidad de cierre: {analysis.closing_probability}%")
```

### **PHP**
```bash
composer require salescrm/php-sdk
```

```php
use SalesCRM\SalesCRM;

$client = new SalesCRM('YOUR_API_KEY');

$lead = $client->leads()->create([
    'nombre' => 'Juan Pérez',
    'email' => 'juan@empresa.com',
    'curso' => 'Marketing Digital'
]);

$response = $client->whatsapp()->send([
    'to' => '+5215512345678',
    'message' => 'Hola Juan 👋',
    'lead_id' => $lead->id
]);
```

---

## 📝 Webhooks

### **Configuración**
1. Ve a dashboard.salescrm.com/webhooks
2. Agrega URL endpoint
3. Selecciona eventos a suscribir
4. Configura secret para seguridad

### **Eventos Disponibles**

#### **lead.created**
```json
{
  "event": "lead.created",
  "data": {
    "id": "uuid",
    "nombre": "Juan Pérez",
    "email": "juan@empresa.com",
    "created_at": "2024-03-15T16:45:00Z"
  },
  "timestamp": "2024-03-15T16:45:00Z"
}
```

#### **lead.stage_changed**
```json
{
  "event": "lead.stage_changed",
  "data": {
    "id": "uuid",
    "old_stage": "contactado",
    "new_stage": "interesado",
    "changed_at": "2024-03-15T16:45:00Z"
  },
  "timestamp": "2024-03-15T16:45:00Z"
}
```

#### **whatsapp.message_received**
```json
{
  "event": "whatsapp.message_received",
  "data": {
    "conversation_id": "uuid",
    "from": "+5215512345678",
    "message": "Sí, estoy interesado",
    "received_at": "2024-03-15T16:45:00Z"
  },
  "timestamp": "2024-03-15T16:45:00Z"
}
```

---

## 🔧 Rate Limits

### **Límites por Plan**
| Plan | Requests/Hour | Burst |
|------|---------------|-------|
| Starter | 1,000 | 100 |
| Professional | 10,000 | 500 |
| Enterprise | 100,000 | 1,000 |

### **Headers de Rate Limiting**
```bash
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9876
X-RateLimit-Reset: 1647888000
```

### **Respuesta de Rate Limit Exceeded**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retry_after": 3600
  }
}
```

---

## 🚨 Errores y Códigos

### **Códigos HTTP Comunes**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

### **Formato de Error**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email format is invalid",
    "details": {
      "field": "email",
      "value": "invalid-email"
    },
    "request_id": "req_uuid"
  }
}
```

### **Códigos de Error Específicos**
| Código | Descripción |
|--------|-------------|
| `INVALID_API_KEY` | API key inválida o expirada |
| `INSUFFICIENT_PERMISSIONS` | Permisos insuficientes |
| `RESOURCE_NOT_FOUND` | Recurso no encontrado |
| `VALIDATION_ERROR` | Datos de entrada inválidos |
| `DUPLICATE_RESOURCE` | Recurso duplicado |
| `QUOTA_EXCEEDED` | Cuota del plan excedida |

---

## 🧪 Testing y Sandbox

### **Environment Sandbox**
```bash
# Sandbox URL
https://sandbox-api.salescrm.com/v1

# Sandbox API Key
sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### **Datos de Prueba**
```json
{
  "lead_test": {
    "nombre": "Test User",
    "email": "test@example.com",
    "whatsapp": "+1234567890",
    "curso": "Test Course"
  }
}
```

### **Postman Collection**
[Descargar Collection](https://github.com/salescrm/api-collection)

---

## 📚 Ejemplos de Integración

### **WordPress Plugin**
```php
// Crear lead desde formulario de contacto
function create_salescrm_lead($entry) {
    $api_key = get_option('salescrm_api_key');
    
    $response = wp_remote_post('https://api.salescrm.com/v1/leads', [
        'headers' => [
            'Authorization' => 'Bearer ' . $api_key,
            'Content-Type' => 'application/json'
        ],
        'body' => json_encode([
            'nombre' => $entry['name'],
            'email' => $entry['email'],
            'telefono' => $entry['phone'],
            'nota' => 'Formulario web'
        ])
    ]);
}
add_action('gform_after_submission', 'create_salescrm_lead', 10, 2);
```

### **Zapier Integration**
```javascript
// Trigger: New Lead in SalesCRM
const options = {
  url: 'https://api.salescrm.com/v1/leads',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer {{bundle.authData.api_key}}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    nombre: bundle.inputData.nombre,
    email: bundle.inputData.email,
    curso: bundle.inputData.curso
  })
};

return z.request(options)
  .then((response) => JSON.parse(response.content));
```

### **Google Apps Script**
```javascript
function syncLeadsToSalesCRM() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leads');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const lead = {
      nombre: data[i][0],
      email: data[i][1],
      telefono: data[i][2],
      curso: data[i][3]
    };
    
    UrlFetchApp.fetch('https://api.salescrm.com/v1/leads', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + PropertiesService.getScriptProperties().getProperty('API_KEY'),
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(lead)
    });
  }
}
```

---

## 🔒 Seguridad

### **Best Practices**
1. **API Keys**: Rotar cada 90 días
2. **HTTPS**: Siempre usar conexión segura
3. **Input Validation**: Validar todos los inputs
4. **Error Handling**: No exponer información sensible
5. **Logging**: Registrar todas las llamadas API

### **IP Whitelisting**
```bash
# Configurar IPs permitidas
curl -X POST "https://api.salescrm.com/v1/security/whitelist" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{"ips": ["192.168.1.100", "10.0.0.50"]}'
```

### **Webhook Security**
```javascript
// Verificar firma del webhook
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === `sha256=${expectedSignature}`;
}
```

---

## 📞 Soporte y Comunidad

### **Canales de Soporte**
- **Email**: api-support@salescrm.com
- **Discord**: [discord.gg/salescrm](https://discord.gg/salescrm)
- **Status Page**: [status.salescrm.com](https://status.salescrm.com)
- **Documentation**: [docs.salescrm.com/api](https://docs.salescrm.com/api)

### **Recursos para Desarrolladores**
- [GitHub Repository](https://github.com/salescrm/api-sdk)
- [SDK Documentation](https://docs.salescrm.com/sdk)
- [API Changelog](https://docs.salescrm.com/changelog)
- [Community Forum](https://community.salescrm.com)

### **SLA y Tiempos de Respuesta**
| Plan | Tiempo Respuesta | Uptime Garantizado |
|------|------------------|-------------------|
| Starter | 48 horas | 99.5% |
| Professional | 24 horas | 99.9% |
| Enterprise | 4 horas | 99.99% |

---

## 🚀 Roadmap de la API

### **Próximas Features (Q2 2024)**
- [ ] GraphQL API
- [ ] Real-time WebSocket events
- [ ] Advanced filtering and sorting
- [ ] Bulk operations
- [ ] Custom fields support

### **Features Futuras (Q3 2024)**
- [ ] API v2 (breaking changes)
- [ ] Machine Learning endpoints
- [ ] Advanced analytics API
- [ ] Multi-tenant support
- [ ] API versioning

---

## 📋 Checklist de Implementación

### **Antes de Empezar**
- [ ] Obtener API key
- [ ] Revisar límites del plan
- [ ] Configurar entorno de testing
- [ ] Leer documentación completa

### **Desarrollo**
- [ ] Implementar manejo de errores
- [ ] Configurar retry logic
- [ ] Agregar logging
- [ ] Testear con sandbox

### **Producción**
- [ ] Usar API key de producción
- [ ] Configurar webhooks
- [ ] Monitorear rate limits
- [ ] Implementar caching

### **Mantenimiento**
- [ ] Rotar API keys regularmente
- [ ] Monitorear uptime
- [ ] Actualizar SDKs
- [ ] Revisar changelog

---

*API Documentation v1.2 - Actualizada: 15 de marzo de 2024*
