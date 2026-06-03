---
resource: application
entity: webhooks-setting
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#webhooks-setting
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Application / Webhooks setting

> Field-level 카탈로그. Endpoint enumeration index: [`../application.md`](../application.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Webhooks setting](https://developers.cafe24.com/docs/ko/api/admin/#webhooks-setting)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

쇼핑몰이 웹훅 사용에 동의(실시간 정보 조회 권한 동의)에 대해 조회할 수 있습니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `scopes` |  | 실시간 정보제공 권한 |
| `reception_status` |  | 웹훅 수신 상태 T : 활성화 · F : 비활성화 |

## Operations

### `GET /api/v2/admin/webhooks/setting` — Retrieve webhook settings

- **Scope**: `mall.read_application` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-webhook-settings

_요청 파라미터 없음._

### `PUT /api/v2/admin/webhooks/setting` — Edit webhook settings

- **Scope**: `mall.write_application` (write)
- **호출건수 제한**: 40
- **1회당 요청건수 제한**: 1
- **Platform**: cafe24
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#edit-webhook-settings

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `reception_status` |  |  |  | 웹훅 수신 상태 T : 활성화 · F : 비활성화 |
