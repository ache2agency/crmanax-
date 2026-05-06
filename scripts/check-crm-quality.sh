#!/bin/bash

set -e

echo "Validando archivos criticos del CRM..."

npx eslint app/api/whatsapp/webhook/route.ts
npx eslint app/crm.jsx
npx eslint components/crm/ConversationsPanel.jsx
npx eslint components/crm/AgendaPanel.jsx

echo ""
echo "Validacion tecnica completada."
echo "Siguiente paso: corre la checklist manual en docs/CRM_QA_CHECKLIST.md"
