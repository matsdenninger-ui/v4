# Ascend

Self-Improvement-Dashboard: Fokus, Gewohnheiten, Training, Ernährung, Wissen, Ziele und Side Hustle an einem Ort. Läuft als statische Seite auf Vercel, Cloud-Sync über Upstash Redis.

## Cloud-Sync
In Vercel die Umgebungsvariable `APP_SECRET` setzen (dein Sync-Code) und Upstash Redis über den Vercel Marketplace verbinden. In der App den Sync-Code in der Seitenleiste eintragen.

## Push-Erinnerungen (einmalig einrichten)
1. **Cloud-Sync muss verbunden sein** — der Server liest daraus, was gerade ansteht.
2. **App installieren:** iPhone: Safari → Teilen → „Zum Home-Bildschirm“ (Pflicht für Push auf iOS). Android/Computer: Browser-Menü → „App installieren“.
3. In der App: Seitenleiste → **🔔 Erinnerungen** → „Auf diesem Gerät aktivieren“ → „Test-Push“.
4. **Zeitplan:** Auf dem kostenlosen Vercel-Tarif laufen Cron-Jobs nur einmal täglich, deshalb ruft `.github/workflows/reminders.yml` alle 15 Minuten `/api/cron` auf. Im GitHub-Repo unter *Settings → Secrets and variables → Actions* anlegen:
   - `ASCEND_URL` — Adresse der App, z. B. `https://dein-projekt.vercel.app`
   - `ASCEND_SECRET` — derselbe Wert wie `APP_SECRET`

Die VAPID-Schlüssel für Web-Push erzeugt der Server beim ersten Aufruf selbst und speichert sie in Upstash — dafür sind keine weiteren Variablen nötig. Hinweis: GitHub pausiert Zeitpläne in Repos, die 60 Tage lang keine Commits hatten; dann im Tab *Actions* wieder aktivieren.
