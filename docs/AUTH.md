# Авторизация THORNado

Документ для разработчиков: откуда брать данные о «текущем пользователе» и чем серверная сессия отличается от кошелька и Nado.

## Что считается «авторизованным» пользователем

После **Sign-In with Ethereum (SIWE)** gateway выставляет **HTTP-only cookie** `thornado_auth` с **JWT**. В токене хранится только **один идентификатор** — **Ethereum-адрес** кошелька (в **нижнем регистре**, `0x` + 40 hex).

Других полей профиля (имя, email и т.д.) **нет**: бэкенд не ведёт отдельную таблицу пользователей в рамках этого потока.

## Три разных источника «кто пользователь»

| Источник | Где | Что даёт |
|----------|-----|----------|
| **Серверная сессия (SIWE + JWT)** | Cookie после `POST /api/auth/verify` | Адрес, с которым пользователь **вошёл на сайт** — единственный «аккаунт» для API gateway. |
| **Кошелёк (wagmi)** | `useAccount()` и провайдер | Текущий **подключённый** адрес в расширении; может **не совпадать** с адресом в cookie, если пользователь сменил аккаунт в кошельке без нового входа. |
| **Nado (торговля)** | SDK / linked signer | On-chain и engine-логика; **не заменяет** проверку серверной сессии для HTTP API THORNado. |

Для фич, завязанных на «залогинен в THORNado», ориентируйтесь на **`/api/auth/me`** (или хук ниже), а кошелёк используйте для подписей и сети.

## Клиент: откуда брать данные пользователя

### Хук `useSession`

Файл: [`client/src/hooks/useSession.js`](../client/src/hooks/useSession.js).

- Выполняет `GET /api/auth/me` с **`credentials: 'include'`** (обязательно для отправки cookie).
- Ответ **`401`** трактуется как «нет сессии» → в React Query приходит **`null`**.
- Успешный ответ — JSON вида:

```json
{ "address": "0xabcdef..." }
```

`address` — **нижний регистр**, как в JWT на сервере.

Пример использования:

```javascript
import { useSession } from '../hooks/useSession'

export function Example() {
  const { data: session, isLoading, error, isFetching } = useSession()

  if (isLoading) return <p>Загрузка сессии…</p>
  if (error) return <p>Ошибка запроса сессии</p>
  if (!session) return <p>Не выполнен вход (SIWE)</p>

  return <p>Сервер знает адрес: {session.address}</p>
}
```

После входа или выхода нужно обновить кэш запроса — в проекте для этого есть **`useInvalidateSession()`** (инвалидация `queryKey: ['session']`).

### Вход и выход в коде

| Действие | Модуль | Примечание |
|----------|--------|------------|
| Вход (nonce → подпись → verify) | [`client/src/lib/siweAuth.js`](../client/src/lib/siweAuth.js) — `signInWithThornado` | После успеха вызвать инвалидацию сессии. |
| Выход | тот же файл — `logoutSession` | `POST /api/auth/logout` + `credentials: 'include'`. |

Домен в SIWE на клиенте: `VITE_SIWE_DOMAIN` или `window.location.host` — он должен **совпадать** с `SIWE_DOMAIN` на gateway (см. ниже).

### Согласование адреса сессии и кошелька

Имеет смысл явно сравнивать `session?.address` с адресом из wagmi. Если не совпадают — показать предупреждение или предложить повторный SIWE. Пример логики: [`client/src/pages/Account.jsx`](../client/src/pages/Account.jsx) (`sessionAddr`, `walletAddr`, `sessionMatchesWallet`).

## HTTP API (gateway, Go)

Реализация: [`gateway/main.go`](../gateway/main.go).

В разработке фронт ходит на `http://localhost:5173/api/...`; Vite **проксирует** `/api` на gateway `http://127.0.0.1:3001` — см. [`client/vite.config.js`](../client/vite.config.js).

### Эндпоинты авторизации

| Метод | Путь | Назначение |
|-------|------|------------|
| `GET` | `/api/auth/nonce` | Выдать одноразовый nonce для SIWE (живёт ~10 минут). |
| `POST` | `/api/auth/verify` | Тело: `{ "message": "<SIWE>", "signature": "0x..." }` — проверка подписи, выдача JWT в cookie. Ответ: `{ "address": "0x..." }`. |
| `POST` | `/api/auth/logout` | Очистить cookie сессии. |
| `GET` | `/api/auth/me` | Текущий пользователь по cookie; **401** если не залогинен. Ответ: `{ "address": "0x..." }`. |

Cookie: **`thornado_auth`**, HttpOnly, `Path=/`, SameSite=Lax, срок жизни JWT по умолчанию **24 часа**.

### Новые защищённые маршруты на сервере

Для эндпоинтов, где нужен текущий пользователь:

1. Подключить middleware **`requireAuth`** (как у `getMe`).
2. Читать адрес: **`c.Get("address")`** — строка с hex-адресом в нижнем регистре.

Данных кроме адреса в JWT сейчас нет — при необходимости профиль расширяется отдельно (БД и т.д.).

## Переменные окружения gateway

| Переменная | Назначение |
|------------|------------|
| `JWT_SECRET` | Секрет подписи JWT; в продакшене задайте явно (иначе используется dev-значение из кода). |
| `SIWE_DOMAIN` | Домен в сообщении SIWE; должен совпадать с тем, что отправляет клиент. По умолчанию в коде: `localhost:5173`. |
| `SIWE_CHAIN_IDS` или `SIWE_CHAIN_ID` | Разрешённые chain ID для подписи входа (список через запятую). |
| `CORS_ORIGINS` | Origin фронтенда для запросов с cookies. |
| `COOKIE_SECURE` | `1` или `true` — флаг `Secure` у cookie (нужен для HTTPS). |
| `PORT` | Порт gateway (по умолчанию `3001`). |

## Краткий чеклист для нового кода

1. Читать пользователя с сервера — **`GET /api/auth/me`** или **`useSession()`**, всегда с **`credentials: 'include'`**.
2. Не путать **`session.address`** с адресом кошелька без проверки.
3. Не считать наличие wagmi-подключения эквивалентом серверной сессии.
4. Для Nado-операций смотреть документацию/SDK отдельно; серверная cookie **не** подставляется в запросы к Nado автоматически.
