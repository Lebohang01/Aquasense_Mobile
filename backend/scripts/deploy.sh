#!/bin/bash
# backend/scripts/deploy.sh
# AquaSense UJ — Full Supabase deployment script
# Run from the backend/ directory: bash scripts/deploy.sh

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   💧 AquaSense UJ — Supabase Deploy      ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Check Supabase CLI ─────────────────────────────────
if ! command -v supabase &> /dev/null; then
  echo "❌  Supabase CLI not found. Install: npm install -g supabase"
  exit 1
fi

echo "✓ Supabase CLI found: $(supabase --version)"

# ── Step 1: Login ──────────────────────────────────────
echo ""
echo "Step 1/5: Supabase login"
supabase login

# ── Step 2: Link project ───────────────────────────────
echo ""
echo "Step 2/5: Link project"
echo "  → Enter your Project Ref from: supabase.com → Project Settings → General"
supabase link

# ── Step 3: Push schema ────────────────────────────────
echo ""
echo "Step 3/5: Push database schema"
supabase db push
echo "✓ Schema pushed"

# ── Step 4: Deploy Edge Functions ─────────────────────
echo ""
echo "Step 4/5: Deploy Edge Functions"
supabase functions deploy evaluate-reading  --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy send-push-alert   --project-ref $SUPABASE_PROJECT_REF
supabase functions deploy daily-aggregation --project-ref $SUPABASE_PROJECT_REF
echo "✓ Edge Functions deployed"

# ── Step 5: Set function secrets ──────────────────────
echo ""
echo "Step 5/5: Set Edge Function secrets"
echo "  These are automatically available as Deno.env — no manual secrets needed."
echo "  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by Supabase automatically."

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✅ Deployment Complete!                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "1. Set up Database Webhooks in Supabase Studio:"
echo "   Database → Webhooks → Create webhook"
echo ""
echo "   Webhook 1: evaluate-reading"
echo "   • Table: readings"
echo "   • Events: INSERT"
echo "   • URL: https://YOUR_PROJECT.supabase.co/functions/v1/evaluate-reading"
echo ""
echo "   Webhook 2: send-push-alert"
echo "   • Table: alerts"
echo "   • Events: INSERT"
echo "   • URL: https://YOUR_PROJECT.supabase.co/functions/v1/send-push-alert"
echo ""
echo "2. Set up pg_cron for daily aggregation:"
echo "   Database → Extensions → Enable pg_cron"
echo "   Then run the SQL in supabase/config.toml"
echo ""
echo "3. Flash firmware to ESP32:"
echo "   • Open firmware/aquasense.ino in Arduino IDE"
echo "   • Update config.h with WiFi + Supabase credentials"
echo "   • Flash and monitor Serial at 115200 baud"
echo ""
echo "4. Build mobile app:"
echo "   cd ../app"
echo "   cp .env.example .env  # add your Supabase URL + anon key"
echo "   npx expo start        # for development"
echo "   npx eas build --platform android  # for APK"
echo ""
