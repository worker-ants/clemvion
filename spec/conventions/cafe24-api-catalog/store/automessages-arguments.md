---
resource: store
entity: automessages-arguments
cafe24_docs: https://developers.cafe24.com/docs/ko/api/admin/#automessages-arguments
source: Cafe24 REST API Documentation (admin) — downloaded 2026-06-03
---

# Cafe24 API — Store / Automessages arguments

> Field-level 카탈로그. Endpoint enumeration index: [`../store.md`](../store.md) · 규약: [`../_overview.md`](../_overview.md) · 공식 docs: [Automessages arguments](https://developers.cafe24.com/docs/ko/api/admin/#automessages-arguments)
> 복합(nested) 필드의 하위 요소는 `↳` 로 표기한다.

자동메시지 변수(Automessages arguments)는 자동메시지 발신 시 사용할 수 있는 변수를 확인하는 리소스입니다.

## 응답 속성 (Property list)

| Attribute | 제약 | 설명 |
|---|---|---|
| `shop_no` | 최소값: [1] | 멀티쇼핑몰 번호 DEFAULT 1 |
| `name` |  | 변수명 |
| `description` |  | 변수 설명 |
| `sample` |  | 변수 예제 |
| `string_length` |  | 메시지 표시 최대 글자수 글자수 : 설정된 글자수 만큼 표시 · 가변 : 글자수 제한 없이 모두 표시 |
| `send_case` |  | 사용 가능 발송 상황 |

## Operations

### `GET /api/v2/admin/automessages/arguments` — Retrieve the list of available variables for automated messages

- **Scope**: `mall.read_store` (read)
- **호출건수 제한**: 40
- **Platform**: cafe24,youtube
- **Docs**: https://developers.cafe24.com/docs/ko/api/admin/#retrieve-the-list-of-available-variables-for-automated-messages

#### 요청 파라미터 (Request)

| Parameter | 필수 | 제약 | 기본값 | 설명 |
|---|---|---|---|---|
| `shop_no` |  | 최소값: [1] | 1 | 멀티쇼핑몰 번호 |
