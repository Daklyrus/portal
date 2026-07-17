# Entra-ID-Setup für den Ticket-Mail-Sync

Einmalige Einrichtung, damit das Tool die Shared Mailbox `support@corvion.de` über Microsoft Graph lesen und darüber senden darf. Dauer: ca. 20 Minuten. Benötigt: Global-Admin im M365-Tenant.

## 1. App-Registrierung anlegen

1. [entra.microsoft.com](https://entra.microsoft.com) → **Identität → Anwendungen → App-Registrierungen → Neue Registrierung**
2. Name: `Corvion Tool Ticket-Sync`, unterstützte Kontotypen: **Nur dieses Organisationsverzeichnis**, kein Redirect-URI nötig → **Registrieren**
3. Von der Übersichtsseite notieren:
   - **Anwendungs-ID (Client)** → `MS_CLIENT_ID`
   - **Verzeichnis-ID (Mandant)** → `MS_TENANT_ID`

## 2. Berechtigungen erteilen

1. **API-Berechtigungen → Berechtigung hinzufügen → Microsoft Graph → Anwendungsberechtigungen**
2. Hinzufügen: **`Mail.ReadWrite`** und **`Mail.Send`**
   (ReadWrite statt Read, weil das Tool verarbeitete Mails in den Ordner „Im Tool" verschiebt)
3. **Administratorzustimmung erteilen** (Button oberhalb der Liste) — Status muss auf „Gewährt" springen.

## 3. Client Secret erzeugen

1. **Zertifikate & Geheimnisse → Neuer geheimer Clientschlüssel**
2. Beschreibung `corvion-tool`, Gültigkeit **24 Monate** → **Ablaufdatum im Kalender eintragen!** (danach muss ein neues Secret in die `.env`)
3. Den **Wert** (nicht die ID) sofort kopieren → `MS_CLIENT_SECRET` — er ist später nicht mehr einsehbar.

## 4. Zugriff auf die Shared Mailbox begrenzen (wichtig)

Ohne diesen Schritt darf die App auf **alle** Postfächer des Tenants zugreifen. Mit einer Application Access Policy wird sie auf `support@corvion.de` eingeschränkt.

PowerShell (einmalig, als Exchange-Admin):

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser
Connect-ExchangeOnline

# Mail-aktivierte Sicherheitsgruppe, die nur die Shared Mailbox enthält
New-DistributionGroup -Name "CorvionTool-Postfaecher" -Type Security `
  -PrimarySmtpAddress corviontool-postfaecher@corvion.de
Add-DistributionGroupMember -Identity "CorvionTool-Postfaecher" -Member support@corvion.de

# Policy: App darf NUR auf Mitglieder dieser Gruppe zugreifen
New-ApplicationAccessPolicy -AppId "<MS_CLIENT_ID>" `
  -PolicyScopeGroupId corviontool-postfaecher@corvion.de `
  -AccessRight RestrictAccess `
  -Description "Corvion Tool: nur support@"

# Prüfen (Granted für support@, Denied für jedes andere Postfach):
Test-ApplicationAccessPolicy -Identity support@corvion.de -AppId "<MS_CLIENT_ID>"
Test-ApplicationAccessPolicy -Identity manuel@corvion.de -AppId "<MS_CLIENT_ID>"
```

Die Policy greift nach bis zu 30 Minuten.

## 5. Werte eintragen und aktivieren

In `.env` (dev) bzw. `.env.production` (Server):

```
MS_TENANT_ID=<Verzeichnis-ID>
MS_CLIENT_ID=<Anwendungs-ID>
MS_CLIENT_SECRET=<Geheimniswert>
SUPPORT_MAILBOX=support@corvion.de
TICKET_SYNC=on
```

Danach App neu starten. Im Log muss `Ticket-Sync gestartet (Intervall 90 s).` erscheinen. Der erste Lauf importiert **keine** Altbestände — er merkt sich nur den Stand; ab dann wird jede neue Mail zum Ticket.

**Funktionstest:** Von einer externen Adresse an support@corvion.de mailen → nach spätestens 2 Minuten erscheint das Ticket im Tool, der Absender bekommt die Eingangsbestätigung mit `[#T-…]`, und die Mail liegt in Outlook im Ordner „Im Tool".
