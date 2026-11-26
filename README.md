# Appati

All your apps' numbers in one panel at the edge of your Mac, and a live summary in the MacBook notch.

Appati sits in the menu bar. Click the icon (or press ⌥⌘A) and a panel opens on the right edge of the screen with active users, sign-ups, site traffic, subscribers, revenue, store reviews, search performance and YouTube stats for every app you add. Move the pointer to the notch and a small island drops down with today's numbers and the song you're playing.

Free, open source, signed and notarized. No account, no server: your keys stay on your Mac.

![Panel](docs/panel.png)

*The numbers in the screenshots are sample data.*

[Türkçe README](README.tr.md) · [Privacy](PRIVACY.md)

## Install

Download the latest `.dmg` from [Releases](https://github.com/uclergnlts/appati/releases/latest), open it and drag Appati to Applications. Requires macOS 12 or later (Apple Silicon and Intel).

Appati updates itself: it checks for a new version shortly after launch and every six hours, downloads it in the background and offers "Restart and update".

With no app added, the panel shows **sample data** and says so.

## What it can read

You only connect the services you actually use. Sources in the same group are alternatives to each other.

| Group | Source | What you get | What it needs |
|---|---|---|---|
| Users | Supabase | Registered users, daily sign-ups, active users, your own table counters, a funnel | Project URL + secret key |
| Users | Firebase | Authentication users (registered, sign-ups, active), Firestore collection counters | Service account JSON |
| Users | Custom endpoint | Any of the above from your own backend, as JSON | A URL (+ optional token) |
| Site traffic | Umami | Visitors, referrers, top pages, countries, live visitors, events, a site funnel | The free share link |
| Site traffic | Plausible | Visitors, sources, top pages, countries, live visitors | Site domain + Stats API key |
| Site traffic | Google Analytics 4 | Visitors, sources, top pages, countries | Property ID + service account JSON |
| Revenue | RevenueCat | Subscribers, trials, MRR, 28-day revenue | Project ID + secret v2 key |
| Revenue | Stripe | Subscribers, trials, MRR, 28-day charges, new customers | Restricted API key (read only) |
| Stores | App Store Connect | iOS reviews, daily first-time downloads | Apple ID, Issuer ID, Key ID, .p8 (+ Vendor Number) |
| Stores | Google Play | Android reviews (last week) | Package name + service account JSON |
| Search and video | Google Search Console | Clicks, impressions, top queries and pages | Property + service account JSON |
| Search and video | YouTube | Subscribers, views, recent videos per channel | Channel handles + YouTube Data API key |

Every source has a **Test connection** button, so you know a key works before you save it. If one source breaks, the others keep working and the panel tells you what failed and what to do about it.

### Custom endpoint

If your stack isn't listed, expose one URL that returns a JSON object. All fields are optional:

```json
{
  "registeredUsers": 4200, "activeToday": 177, "activeUsers7d": 549,
  "newSignupsToday": 12, "newSignups7d": 155, "newSignupsPrev7d": 141,
  "subscribers": 86, "trials": 12, "mrr": 412, "revenue28d": 520, "currency": "$",
  "counters": [{ "label": "Open orders", "value": 8 }],
  "signups": [{ "date": "2026-11-25", "value": 9 }],
  "funnel": [{ "label": "Signed up", "value": 4200 }, { "label": "Paid", "value": 86 }]
}
```

If you set a token it is sent as `Authorization: Bearer <token>`.

## Also in the box

- **What to look at**: weekly drops, low-rated reviews and broken sources are surfaced at the top.
- **Last 7 days**: visitors, sign-ups, search clicks, downloads, subscribers and revenue against the previous week; delivered as a notification at the start of each week.
- **Funnels**: an account funnel from your database and a site funnel from analytics events.
- **Notifications** for new low-rated reviews, new subscribers and sources that stop working.
- **Notch island**: today's numbers plus Spotify and YouTube playback controls; a slim strip with album art while something is playing. Size and transparency are adjustable.
- **Languages**: English, Türkçe, Español, العربية (right-to-left). Follows macOS, changeable in Settings.
- **Light and dark** themes that follow macOS, with adjustable transparency.

## Privacy

Keys are encrypted with the macOS Keychain and never leave your Mac except in requests to the services they belong to. Appati has no backend and collects nothing. See [PRIVACY.md](PRIVACY.md).

## Known limits

- Daily active users, subscribers and MRR have no history in any source; Appati stores what it sees each day, so those charts and weekly changes fill in over time.
- Umami is read through the endpoint its own share page uses, not a documented API; it may need an update if Umami changes it.
- App Store download reports arrive a day or two late; Search Console data two to three days late.
- Google Play offers reviews only, not install counts.
- YouTube shows public numbers; watch time and traffic sources need the channel owner's sign-in and are not included.
- Stripe MRR is computed from list prices of active subscriptions; coupons and taxes are not applied.
- Translations other than Turkish are machine-made and have not been reviewed by native speakers.

## Development

```bash
npm install
npm start                        # run the panel
npm run demo                     # run with sample data
npm test                         # source readers, storage, translations
npm run preview                  # UI screenshots into preview/ (needs Playwright)
PREVIEW_DIL=en npm run preview   # same, in another language; lists untranslated text
xvfb-run -a npm run smoke        # end-to-end test with real Electron (Linux)
```

The code is written in Turkish (identifiers and comments); the UI source language is Turkish and is translated at render time from `src/ortak/diller/<lang>.json`. To add a source, write a reader in `src/main/sources/`, register it in `src/main/katalog.js` and `src/main/collect.js`, and add its strings to the three dictionaries.

Signing and releasing: [docs/IMZALAMA.md](docs/IMZALAMA.md) (Turkish).

## License

[MIT](LICENSE)
