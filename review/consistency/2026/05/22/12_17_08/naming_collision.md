# 신규 식별자 충돌 검토

검토 대상: `spec/2-navigation/2-trigger-list.md` (트리거 목록 화면 — 편집·삭제 suite)
검토 시점: 구현 착수 전 (--impl-prep)

---

## 발견사항

### [INFO] `PATCH /api/triggers/:id/toggle` — 기존 frontend 구현과 동작 방식 분리

- target 신규 식별자: `PATCH /api/triggers/:id/toggle` (§3 API 표, R-4)
- 기존 사용처: `codebase/frontend/src/app/(main)/triggers/page.tsx` L141 — `toggleMutation` 이 현재 `PATCH /triggers/:id { isActive }` body 방식만 사용 중
- 상세: spec 이 `/toggle` sub-endpoint 를 정식 정의하고 R-4 에서 양쪽 병용을 명시했으나, 기존 frontend 코드는 `/toggle` endpoint 를 전혀 호출하지 않는다. 그리고 backend `triggers.controller.ts` 에 `PATCH :id/toggle` route 가 존재하지 않는다. 즉, `/toggle` endpoint 는 spec 에서 "살아 있다"고 표현되지만 코드에는 없는 상태다. 이 gap 이 명시적으로 문서화되지 않아 구현자가 신설해야 하는지 기존 구현을 유지해야 하는지 판단 불명확.
- 제안: R-4 에 "현재 backend 미구현, 이번 Plan A 범위에서 신설하거나 기존 `PATCH :id { isActive }` 단일 경로로 유지하도록 명시" 를 추가. 또는 `/toggle` 신설 여부를 `trigger-list-row-actions.md` plan 의 backend 체크리스트에 명시.

---

### [INFO] `triggers.deleteConfirm` (flat 키) vs `triggers.delete.confirm.*` (중첩 키) — i18n 키 형태 변경

- target 신규 식별자: `triggers.delete.confirm.webhook`, `triggers.delete.confirm.schedule`, `triggers.delete.confirm.manual`, `triggers.delete.title`, `triggers.delete.button`, `triggers.delete.typeNameToConfirm`, `triggers.delete.cascadeWarning`, `triggers.rowActions.delete`, `triggers.rowActions.viewDetails`, `triggers.rowActions.viewHistory`, `triggers.rowActions.editInSchedule`
- 기존 사용처: `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts` L26: `deleteConfirm: "이 트리거를 삭제할까요?"` / `codebase/frontend/src/lib/i18n/dict/en/triggers.ts` L28: `deleteConfirm: "Delete this trigger?"`
- 상세: 기존 flat 키 `deleteConfirm` 이 이미 ko/en 양쪽 dict 에 존재한다. plan `trigger-list-row-actions.md` L45 에 "flat 키를 본 plan 의 type 분기 모달로 일괄 대체" 가 명시되어 있어 의식적 교체 계획이 있다. 그러나 `triggers.rowActions.*` 키 그룹이 신규로 도입되는 중첩 객체 형태인데, 기존 dict 의 최상위에는 `rowActions` 키가 없다. TypeScript `as const` 타입 추론 상 중첩 키 신설이 타입 오류 없이 추가될 수 있으므로 컴파일 단계에서 무결성 체크가 필요하다.
- 제안: 기존 `deleteConfirm` 키의 실제 참조처를 grep 으로 확인 후 삭제 전 단계적 마이그레이션 수행. `triggers.rowActions` 신설 시 i18n parity 테스트(`i18n.test.ts`) 가 ko/en 동등성을 검증하는지 확인.

---

### [INFO] `POST /api/triggers/:id/auth/rotate-secret` — 기존 sub-channel RPC 패턴과 경로 세그먼트 불일치

- target 신규 식별자: `POST /api/triggers/:id/auth/rotate-secret` (§3 API 표, R-2)
- 기존 사용처: `spec/5-system/2-api-convention.md` L38 — RPC-style 예시가 `/{channel}/{action}` 패턴 (`/notification/rotate-secret`, `/interaction/revoke-token`, `/chat-channel/rotate-bot-token`)으로 정의되어 있다. `auth` 는 기존 예시 목록에 없는 신규 채널 세그먼트다.
- 상세: 기존 RPC 예시들은 모두 외부 inbound/outbound 채널 이름(`notification`, `interaction`, `chat-channel`)을 segment 로 사용한다. 반면 `/auth/rotate-secret` 의 `auth` 는 webhook 자체 인증 설정을 뜻하며 외부 채널이 아닌 트리거 자체 속성이다. spec 본문 R-2 에서 경로명이 TBD 임을 인정하고 있으므로 확정 전 충돌은 아니나, 실제 신설 시 `api-convention.md` RPC 예시 목록에 `/auth/` 채널 추가가 필요하다. 아울러 `spec/5-system/15-chat-channel.md` 가 `rotate-bot-token` 과 `rotate-secret` 의 혼동 방지를 위해 `/chat-channel/rotate-bot-token` 으로 명시화한 것처럼, `/auth/rotate-secret` 도 EIA `/notification/rotate-secret` (outbound HMAC) 와 혼동될 수 있어 경로명 재검토 여지가 있다.
- 제안: v1.1 경로 확정 시 `spec/5-system/2-api-convention.md` §3.3 RPC 예시를 동시 갱신. 경로명 후보로 `/webhook-auth/rotate-secret` 또는 `/inbound-auth/rotate-secret` 검토 권장.

---

### [INFO] `trigger.toggle` audit action — 기존 `1-auth.md` 와 일치, 실제 emit 코드는 미확인

- target 신규 식별자: audit action `trigger.toggle` (§ Rationale R-4)
- 기존 사용처: `spec/5-system/1-auth.md` L319 — `trigger.create, trigger.update, trigger.delete, trigger.toggle` 목록에 이미 등재. `spec/data-flow/1-audit.md` L36 — `trigger.delete` 예시 기재.
- 상세: 이름 충돌 없음. 단, backend `triggers.service.ts` / `triggers.controller.ts` 에서 `/toggle` endpoint 가 없으므로 `trigger.toggle` audit emit 코드도 존재하지 않는다. spec 에서 "audit log 를 emit 한다" 고 명시하므로 구현 시 누락 위험.
- 제안: `trigger-list-row-actions.md` plan backend 체크리스트에 `/toggle` endpoint 신설 및 audit `trigger.toggle` emit 을 명시.

---

### [INFO] `TRIGGER_ENDPOINT_PATH_CONFLICT` 세부 코드 — 기존 에러 처리 패턴에 미등록

- target 신규 식별자: 오류 세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT` (§2.3.1 및 §3 API 주석)
- 기존 사용처: `spec/5-system/3-error-handling.md` L35 — 상위 코드 `RESOURCE_CONFLICT` 만 정의. 세부 코드(sub-code) 필드 목록 없음. codebase 에서 `TRIGGER_ENDPOINT_PATH_CONFLICT` 문자열 미사용.
- 상세: `spec/5-system/3-error-handling.md` 가 `details.field` 등 응답 세부 필드를 정의하나 세부 코드 enum 목록은 없다. `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 신규 도입이므로 기존 등록된 다른 세부 코드와 충돌하지는 않지만, 패턴이 이 spec 에서 처음 등장하는 형태다. `IDEMPOTENCY_KEY_CONFLICT` 는 EIA spec 에 있으나 다른 도메인이다.
- 제안: `spec/5-system/3-error-handling.md` 에 세부 코드(sub-code) 네임스페이스 및 등록 규약 추가, 또는 trigger spec 의 `TRIGGER_ENDPOINT_PATH_CONFLICT` 를 에러 처리 spec 에 등록.

---

## 요약

`spec/2-navigation/2-trigger-list.md` 가 도입하는 신규 식별자 중 기존에 다른 의미로 사용 중인 심각한 충돌은 없다. 요구사항 ID(NAV-TR-09, NAV-TR-10)는 `_product-overview.md` 에 이미 예약된 ID를 spec 이 채워 넣는 구조이므로 ID 충돌이 없다. audit action `trigger.toggle` 은 `1-auth.md` 에 선행 등재되어 일치한다. 가장 주목할 사항은 네 가지 INFO 수준의 불일치다: (1) `/toggle` endpoint 가 spec 에 명시되었으나 backend 코드에 미구현된 상태임에도 "살아 있다"고 표현되어 구현자 혼선 우려, (2) 기존 `triggers.deleteConfirm` flat i18n 키와 신규 중첩 `triggers.delete.*` 키 그룹의 교체 계획이 plan 에는 있으나 spec 에 명시되지 않음, (3) v1.1 예약 `/auth/rotate-secret` 경로가 기존 RPC sub-channel 컨벤션(`/notification/`, `/interaction/`) 과 패턴 상이, (4) `TRIGGER_ENDPOINT_PATH_CONFLICT` 세부 코드가 에러 처리 spec 에 미등록. 모두 INFO 등급으로, 즉시 구현을 차단하지 않는다.

## 위험도

LOW
