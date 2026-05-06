# 📊 Analytics & Tracking Setup Guide - SalesCRM

## 🎯 Overview
Configuración completa de analytics y tracking para medir el rendimiento de la landing page y optimizar conversiones.

---

## 🔧 Configuración Requerida

### **1. Google Analytics 4**
```bash
# Pasos:
1. Ir a https://analytics.google.com
2. Crear nueva propiedad GA4
3. Obtener Measurement ID: G-XXXXXXXXXX
4. Reemplazar en landing.html línea 73
```

**Eventos configurados:**
- `generate_lead` - Form submission
- `FreeTrialClick` - CTA button clicks
- `DemoClick` - Demo button clicks
- `Scroll25/50/75/90` - Scroll depth
- `TimeOnPage30s/1m/3m/5m` - Time milestones
- `FeatureClick` - Feature card interactions
- `PricingClick` - Pricing plan clicks

### **2. Meta Pixel (Facebook)**
```bash
# Pasos:
1. Ir a https://facebook.com/ads/manager/pixel
2. Crear nuevo píxel
3. Obtener Pixel ID: XXXXXXXXXXXXXXXX
4. Reemplazar en landing.html línea 96
```

**Eventos configurados:**
- `PageView` - Page load
- `ViewContent` - Content viewing
- `Lead` - Form submission
- Custom events for button clicks

### **3. Hotjar Heatmaps**
```bash
# Pasos:
1. Ir a https://hotjar.com
2. Crear nueva cuenta
3. Obtener Site ID: XXXXXXXXXX
4. Reemplazar en landing.html línea 115
```

**Funcionalidades:**
- Heatmaps de clics y scroll
- Session recordings
- Conversion funnels
- User feedback polls

### **4. LinkedIn Insight Tag**
```bash
# Pasos:
1. Ir a https://business.linkedin.com/advertising
2. Crear Insight Tag
3. Obtener Partner ID: XXXXXXXXXX
4. Reemplazar en landing.html línea 125
```

---

## 📈 Métricas Clave (KPIs)

### **Traffic Metrics**
- **Sessions**: Número de visitas
- **Users**: Visitantes únicos
- **Pageviews**: Total de páginas vistas
- **Bounce Rate**: Porcentaje de rebote
- **Avg. Session Duration**: Tiempo promedio

### **Engagement Metrics**
- **Scroll Depth**: Qué tan abajo llegan los usuarios
- **Feature Interactions**: Clicks en características
- **Pricing Engagement**: Interés en planes
- **Time on Page**: Tiempo en la landing

### **Conversion Metrics**
- **Lead Rate**: % de visitantes que completan formulario
- **Demo Requests**: Solicitudes de demo
- **Free Trial Signups**: Inicios de prueba
- **Cost per Lead**: CPL por canal

---

## 🎯 Event Tracking Implementation

### **Form Submission Events**
```javascript
// Lead generation tracking
gtag('event', 'generate_lead', {
  event_category: 'conversion',
  event_label: 'Demo Form',
  value: 1
});

fbq('track', 'Lead', {
  content_name: 'SalesCRM Demo',
  content_category: 'Lead Generation'
});
```

### **Button Click Events**
```javascript
// CTA button tracking
gtag('event', 'FreeTrialClick', {
  event_category: 'engagement',
  event_label: 'Hero Section',
  value: 149.00
});
```

### **Scroll Depth Events**
```javascript
// Scroll milestones
gtag('event', 'Scroll50', {
  event_category: 'engagement',
  event_label: 'Scroll Depth',
  custom_parameter: '50%'
});
```

---

## 🔄 Conversion Funnels

### **Funnel 1: Awareness → Lead**
```
Page View (100%)
↓
Scroll 25% (70%)
↓
Scroll 50% (45%)
↓
Feature Click (25%)
↓
Form View (15%)
↓
Lead Submit (8%)
```

### **Funnel 2: Pricing → Trial**
```
Pricing View (100%)
↓
Plan Click (35%)
↓
Professional Plan (25%)
↓
Trial Start (12%)
```

---

## 📱 Retargeting Setup

### **Facebook Custom Audiences**
```javascript
// Audience 1: All visitors (30 days)
fbq('track', 'PageView');

// Audience 2: Engaged users (scroll > 50%)
if (scrollPercent > 50) {
  fbq('trackCustom', 'EngagedUser');
}

// Audience 3: Form abandoners
if (formStarted && !formSubmitted) {
  fbq('trackCustom', 'FormAbandon');
}
```

### **Google Ads Remarketing**
```javascript
// Remarketing tag
gtag('config', 'AW-XXXXXXXXXX');
gtag('event', 'page_view', {
  send_to: 'AW-XXXXXXXXXX'
});
```

---

## 📊 Dashboard Configuration

### **Google Analytics Dashboard**
1. **Overview**: Métricas generales
2. **Acquisition**: Tráfico por canal
3. **Behavior**: Engagement y contenido
4. **Conversion**: Leads y signups
5. **Real-time**: Actividad en vivo

### **Hotjar Dashboard**
1. **Heatmaps**: Mapas de calor
2. **Recordings**: Sesiones de usuario
3. **Funnels**: Embudos de conversión
4. **Polls**: Feedback del usuario

---

## 🎯 A/B Testing Framework

### **Elementos a Testear**
1. **Headlines**: Título principal
2. **CTAs**: Texto y color de botones
3. **Images**: Hero image vs video
4. **Pricing**: Orden y presentación
5. **Form**: Campos y diseño

### **Implementación**
```javascript
// Google Optimize integration
gtag('event', 'optimize.callback', {
  name: 'AB_Test_Headline',
  callback: (value) => {
    if (value === '0') {
      // Variant A
    } else {
      // Variant B
    }
  }
});
```

---

## 🔍 SEO Analytics

### **Google Search Console**
```bash
# Pasos:
1. Verificar propiedad en GSC
2. Submit sitemap.xml
3. Monitorizar Core Web Vitals
4. Trackear keywords orgánicas
```

### **Rank Tracking**
- Keywords principales: "CRM inteligente", "automatización ventas"
- Long-tail keywords: "CRM con WhatsApp", "asistente IA ventas"
- Local keywords: "CRM Mexico", "software ventas Latinoamérica"

---

## 📈 Reporting Automatizado

### **Weekly Report Metrics**
```javascript
// Automated report generation
const weeklyMetrics = {
  sessions: gaData.sessions,
  leads: gaData.leads,
  conversionRate: (gaData.leads / gaData.sessions) * 100,
  topPages: gaData.topPages,
  topChannels: gaData.channels,
  avgSessionDuration: gaData.avgSessionDuration
};
```

### **Alerts Configuration**
```javascript
// Performance alerts
if (conversionRate < 5%) {
  sendAlert('Low conversion rate detected');
}

if (bounceRate > 70%) {
  sendAlert('High bounce rate - check UX');
}
```

---

## 🚀 Optimización Continua

### **Monthly Optimization Tasks**
1. **Review performance metrics**
2. **Analyze user behavior patterns**
3. **Test new hypotheses**
4. **Update content based on data**
5. **Refine targeting parameters**

### **Data-Driven Improvements**
- **High bounce rate** → Mejorar loading speed
- **Low form completion** → Simplificar formulario
- **Poor mobile conversion** → Optimizar responsive
- **Low scroll depth** → Mejorar contenido inicial

---

## 📞 Soporte y Mantenimiento

### **Monitoring Checklist**
- [ ] Analytics tags firing correctly
- [ ] Conversion tracking accurate
- [ ] No script errors in console
- [ ] Page speed within acceptable range
- [ ] Mobile functionality working

### **Troubleshooting Common Issues**
1. **Events not tracking** → Check tag implementation
2. **Low data volume** → Verify tag placement
3. **Inaccurate conversions** → Check attribution settings
4. **Slow page load** → Optimize script loading

---

## 📋 Next Steps

1. **Configure all tracking IDs**
2. **Test event tracking**
3. **Set up conversion goals**
4. **Create dashboards**
5. **Implement A/B tests**
6. **Monitor and optimize**

*Documentación actualizada: 15 de marzo de 2024*
