# 12 · Internationalisation

> How languages work across the web app, the API, the worker and emails.
> Decision: [ADR-023](./11-decisions.md#adr-023) · Flow: [Sequence 22](./diagrams/sequence/22-locale-propagation.md) · Features: I18N-01…04 in [02 §2.7](./02-product-scope.md#27-internationalisation-i18n)

---

## 1. Summary

| Layer | Library | Where the locale comes from |
|---|---|---|
| Web (Next.js) | `next-intl`, without i18n routing | `tb_locale` cookie |
| API (NestJS) | `nestjs-i18n` | `Accept-Language` header, set by the BFF |
| Worker | `nestjs-i18n`, same catalogues as the API | The recipient's `users.locale` |

The app launches in English (`en`, the default) and Vietnamese (`vi`). `SUPPORTED_LOCALES` and `DEFAULT_LOCALE` live in `@tb/contracts`, so the web app and the API share one list.

---

## 2. Locale resolution

The web app resolves the locale once per request, in this order:

1. `tb_locale` cookie, if its value is in `SUPPORTED_LOCALES`
2. Best match from the browser's `Accept-Language` header
3. `DEFAULT_LOCALE`

The cookie follows the account:

| Moment | What happens |
|---|---|
| Sign-up | The resolved locale is saved to `users.locale`, so the verification email uses it |
| Log in | The API returns `AuthPayload.locale`, and the BFF copies it into `tb_locale` |
| Language changed in settings | `updateProfile` saves `users.locale`, and the BFF updates the cookie |
| Language changed while signed out | Only the cookie changes |

`tb_locale` is a first-party cookie with `SameSite=Lax` and a one-year lifetime. It holds no secret, so it isn't httpOnly.

---

## 3. Web

- **Cookie, not path.** URLs stay `/b/:shortId`, for three reasons:
  - A shared link opens in the reader's own language.
  - There are no public pages that need per-language SEO, because public boards aren't in the MVP ([ADR-022](./11-decisions.md#adr-022)).
  - The intercepted ticket modal route doesn't need a `[locale]` segment around it.

  If public pages arrive later, path-based routing can be added then.
- `src/i18n/request.ts` calls the shared resolver and loads `messages/<locale>.json`.
- Server Components use `getTranslations`. Client components use `useTranslations` and receive their messages through `NextIntlClientProvider`.
- Dates and numbers go through `next-intl` formatters, using the viewer's `users.time_zone`.
- Both GraphQL clients send `Accept-Language` with the resolved locale ([ADR-019](./11-decisions.md#adr-019)).
- `@tb/ui` contains no hard-coded strings. Components take their labels as props.

---

## 4. API and worker

- The BFF always sends exactly one locale, such as `Accept-Language: en`. The browser's own header never reaches the API.
- `nestjs-i18n` reads it with `AcceptLanguageResolver`. Under GraphQL the module needs the request in the GraphQL context.
- **Domain code never produces user-facing text.** A `DomainError` carries a `code` and `details`. The exception filter in `interface/` turns that into a translated `message`, and `extensions.code` never changes. Clients branch on `code`, never on `message`.
- Validation messages are translated the same way, into `details.fields`.
- The worker has no request, so it reads `users.locale` for each recipient. An invitation to someone without an account uses the inviter's locale.

> ⚠️ **Verify at init:** check that the current `nestjs-i18n` release declares NestJS 11 as a peer dependency. If it doesn't, the fallback is a small interceptor around `i18next`, with the same header and catalogues.

---

## 5. What gets translated

| Content | Translated | Where |
|---|---|---|
| UI labels, buttons, empty states | Yes | `apps/web/messages` |
| GraphQL errors and validation messages | Yes | `apps/api/src/i18n`, from `Accept-Language` |
| Emails | Yes | `apps/api/src/i18n`, in the recipient's locale |
| Notifications | Yes, at display time | Stored as `type` + `data`, rendered by the web app in the viewer's language |
| Activity feed | Yes, at display time | Stored as `type` + `data`, rendered by the web app |
| "Basic" template list names | Once, at creation | Creator's locale. After that they're ordinary board data |
| Realtime events | No | Carry codes and data only |
| Board, list and ticket names, comments | Never | User content |
| Board snapshot cache | No | Holds data only, so one cache entry serves every language |

---

## 6. File layout

```text
apps/web/messages/<locale>.json             # UI catalogue
apps/web/src/i18n/request.ts                # next-intl request config
apps/api/src/i18n/<locale>/errors.json      # error codes
apps/api/src/i18n/<locale>/validation.json  # validation messages
apps/api/src/i18n/<locale>/email.json       # email subjects and bodies
packages/contracts/src/locales.ts           # SUPPORTED_LOCALES, DEFAULT_LOCALE, resolveLocale()
```

---

## 7. Adding a language

1. Add the code to `SUPPORTED_LOCALES`.
2. Add `apps/web/messages/<locale>.json` and the three API catalogues.
3. Run the catalogue check. CI fails when a key exists in `en` but not in another locale.
4. Add the language to the settings picker. A Playwright test covers switching to it.

---

## 8. Vietnamese

| Area | Rule |
|---|---|
| Slugs and usernames | Fold to ASCII before building them, because `slug` and `username` only allow `a-z`, `0-9` and a separator. Stripping accents isn't enough: Unicode normalisation doesn't decompose `đ`, so `đ` and `Đ` need an explicit mapping to `d` |
| Stored text | Normalise names and titles to NFC at the API edge, so the same word always compares equal, in search too |
| Fonts | Load the `vietnamese` subset with `next/font`, or letters such as `ệ` fall back to another typeface |
| Plurals | Vietnamese has one plural form, so `vi` messages only need the ICU `other` case |
