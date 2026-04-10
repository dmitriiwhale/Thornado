# Execution Gateway (Go Edge + Rust Execution)

Этот документ описывает текущую gateway-архитектуру THORNado для торгового исполнения (execution).

## Цель

- Сохранить существующий контур авторизации и профиля в Go.
- Вынести торговое исполнение и серверную валидацию подписей в Rust.
- Не допускать прямой клиентский execute в Nado без серверных проверок сессии и `linkedSigner`.

## Архитектура

Запросы исполнения идут по цепочке:

1. Client (browser) -> Go gateway (`/api/execution/*`)
2. Go gateway (`requireAuth`) -> Rust execution gateway
3. Rust execution gateway (валидация `sender` + EIP-712 + `linkedSigner`) -> Nado gateway/trigger

Текущее разделение ролей:

- Go (`gateway/`): SIWE, JWT cookie session, profile API, проксирование execution-маршрутов.
- Rust (`gateway/execution/`): торговые проверки и отправка execute в Nado.

## Публичные API (через Go gateway)

Все маршруты ниже защищены `requireAuth`.

| Method | Path | Назначение |
|---|---|---|
| `POST` | `/api/execution/execute` | Обычные engine execute (`place_order`, cancel, withdraw, `link_signer`, и т.д.). |
| `POST` | `/api/execution/execute/trigger` | Trigger execute (stop/take и trigger cancel). |
| `GET` | `/api/execution/context` | Контекст сабаккаунта и `linkedSigner` текущей сессии. |
| `GET` | `/api/execution/capabilities` | Поддерживаемые execute и order-type в gateway. |
| `GET` | `/api/profile/execution-context` | Тот же контекст, но в profile namespace. |

Go-прокси передает в Rust служебный заголовок:

- `X-Thornado-Session-Address: <session_address_from_jwt>`

## Внутренние API Rust execution gateway

| Method | Path | Назначение |
|---|---|---|
| `GET` | `/health` | Health-check execution сервиса. |
| `GET` | `/v1/capabilities` | Матрица поддерживаемых execute/order-type. |
| `GET` | `/v1/context` | `owner`, `subaccount`, `linked_signer` для сессии/owner. |
| `POST` | `/v1/execute` | Валидация и отправка engine execute в Nado gateway. |
| `POST` | `/v1/execute/trigger` | Валидация и отправка trigger execute в Nado trigger gateway. |

## Серверные валидации в Rust

Для каждого execute-запроса gateway делает проверки до отправки в Nado:

1. `sender` принадлежит владельцу сессии:
   - `owner = sender[0..20]`
   - `owner` должен совпадать с адресом из JWT-сессии (из заголовка `X-Thornado-Session-Address`)
2. EIP-712 подпись должна восстанавливаться в:
   - либо `owner`
   - либо `linkedSigner`, который сейчас привязан в engine к этому `sender`
3. Проверка `linkedSigner` выполняется через `Query::LinkedSigner`.

Если любое условие не выполнено, запрос отклоняется на gateway (без отправки в Nado).

## Политика ордеров (v1)

Поддерживается:

- `limit`
- `ioc` (используется как market-стиль)
- `post_only`
- `reduce_only`
- stop/take (price-trigger, через trigger endpoint)

Не поддерживается (gateway вернет `400`):

- `fok`
- `twap`

Маршрутизация:

- обычные ордера -> `/api/execution/execute`
- stop/take -> `/api/execution/execute/trigger`

## Связь с модулем профиля/login

Профиль и вход остаются в Go слое, поэтому execution использует ту же серверную identity-модель:

1. Пользователь логинится через SIWE -> получает JWT cookie (`thornado_auth`).
2. Go `requireAuth` извлекает session address.
3. Go проксирует execution в Rust вместе с session address.
4. Rust валидирует, что payload `sender` и подпись соответствуют этой сессии.

Итог: `linkedSigner` работает как исполнительно-подписывающий ключ, но право выполнять запрос определяется сессией, а не только клиентским payload.

## Конфигурация

### Go gateway

| Env | Назначение |
|---|---|
| `EXECUTION_SERVICE_URL` | URL внутреннего Rust execution gateway (default `http://127.0.0.1:3003`). |

### Rust execution gateway

| Env | Назначение |
|---|---|
| `EXECUTION_BIND_ADDR` | Адрес bind (default `0.0.0.0:3003`). |
| `EXECUTION_NETWORK` | Сеть nado-sdk: `test`, `prod`, `local`, `local-alt`. |
| `EXECUTION_DEFAULT_SUBACCOUNT` | Дефолтный subaccount name (default `default`). |
| `EXECUTION_NADO_GATEWAY_URL` | Опциональный override Nado gateway URL. |
| `EXECUTION_NADO_TRIGGER_URL` | Опциональный override Nado trigger URL. |

## Локальный запуск

1. Rust execution:

```bash
cd gateway/execution
cargo run
```

2. Go gateway:

```bash
cd gateway
go run .
```

3. Client:

```bash
npm run dev
```

## Продакшн замечание

Рекомендуется не публиковать Rust execution наружу как публичный порт. Он должен быть внутренним сервисом за Go edge gateway.
