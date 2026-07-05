---
worktree: auth-critical-spec-24d2db
started: 2026-07-05
owner: project-planner
spec_impact:
  - spec/5-system/1-auth.md
  - spec/5-system/2-api-convention.md
  - spec/conventions/swagger.md
  - spec/2-navigation/9-user-profile.md
---

# spec-draft: WebAuthn credentials 목록 응답 포맷 — 실제 계약(`{data:{items}}`)으로 정정

## 배경 (재확인 결론)

exec-intake 후속에서 분리된 auth Critical 2건 중:

- **Issue 1 (초대 에러코드 casing)** — 이미 해결됨(조치 불필요). `workspace-invitations.service.ts` 11개 코드 전부 `error-codes.md §3` 에 historical-artifact 예외로 명문화(2026-06-28). 본 draft 범위 아님.
- **Issue 2 (WebAuthn credentials 응답 포맷)** — 코드 버그가 **아니라 spec 텍스트 불일치**. 아래가 본 draft 범위.

### 실체 (근거)

`{data:{items:[]}}` 는 **비-페이징 auth 목록의 확립된 load-bearing 계약**이다:

| 근거 | wire 계약 |
| --- | --- |
| `webauthn.controller.ts` `webauthnList` (`WebAuthnCredentialListDto { items }`) | `{ data: { items: [...] } }` |
| `sessions.controller.ts` (listSessions 74 / revokeSession 120 / revokeOthers 164, `SessionListDto`) | `{ data: { items: [...] } }` (동일) |
| frontend `passkey-card.tsx:53` | `res.data.data.items` |
| frontend `lib/api/sessions.ts:54/67/77` | `res.data.data.items` |
| `TransformInterceptor` (`'data' in data` 분기) | 이미 `data` 키 보유 객체는 pass-through |

즉 webauthn 단독 outlier 가 아니라 **sessions·webauthn 양쪽에서 백엔드+프런트가 이미 의존**. 두 컨트롤러가 `{ data: { items } }` 를 **직접 반환**하므로 인터셉터의 `'data' in data` pass-through 분기를 탄다. `api-convention §5.2` 는 **페이징 목록**(`PaginatedResponseDto` = `{data:[], pagination}`)만 규율하고 비-페이징 소규모 컬렉션 형식은 명시하지 않음. 유일한 불일치는 `1-auth.md` line 469 가 `[{...}]`(bare array)로 적혀 실제 `{items}` 래퍼와 어긋난 spec 텍스트뿐.

### 결정 (사용자 Option A, 2026-07-05)

**spec 를 현실에 맞춘다** (non-breaking, blast radius = spec 문서만). 코드·프런트 무변경. bare-array 로의 정규화(Option B)는 breaking 이라 defer.

### consistency-check --spec (10_31_14) 반영 — CRITICAL 해소

초기 draft(2-doc)는 cross_spec **CRITICAL** 을 받았다: 새 pass-through 서술이 `swagger.md` Rationale §5 의 "pass-through 는 `PaginatedResponseDto` 가 **유일한 예외**" 단정과 정면 충돌. 코드 사실(webauthn·sessions 컨트롤러가 이미 pass-through 분기 사용)이 확인됐고, Option A 는 코드를 안 바꾸므로 **swagger.md 의 '유일한 예외' 문구를 함께 갱신**해야 정합. 따라서 scope 를 swagger.md(변경 4) + (완전성) 9-user-profile.md(변경 5)로 확장. WARNING(swagger §6 "버그" 패턴과의 표면 유사)·INFO(§6 무관성 명시)도 문구로 흡수.

---

## 변경 1 — `spec/5-system/2-api-convention.md` §5.2 뒤에 비-페이징 컬렉션 note 추가

§5.2 목록 응답의 pagination note 문단 **뒤에** 삽입:

> **비-페이징 고정 컬렉션** (페이지네이션이 무의미한 소규모·본인 소유 목록 — 활성 세션 목록, WebAuthn credential 목록)은 `pagination` 없이 단일 `items` 배열을 `data` 아래 중첩해 `{ "data": { "items": [ ... ] } }` 형태로 반환한다. 핸들러가 `{ data: { items } }` 를 직접 반환하면 이미 top-level `data` 키를 가지므로 `TransformInterceptor` 가 추가 래핑 없이 pass-through 한다(§5.2 페이징 목록과 동일한 pass-through 경로 — [Swagger 규약 §2-5](../conventions/swagger.md#2-5-응답-wrapping)). 이는 §5.2 페이징 목록(`data` 가 배열 그 자체 + `pagination` 형제)과 형태가 다르며, [Swagger 규약 §6](../conventions/swagger.md) 이 "버그"로 지목하는 `{ data: { items, totalItems, page, limit } }`(페이지네이션 메타를 `items` 옆에 뒤섞은 오용)와도 다르다 — 본 컬렉션은 애초에 `pagination` 필드 자체가 없다. 상세 근거는 Rationale.

## 변경 2 — `spec/5-system/1-auth.md` line 469 응답 포맷 정정

기존:

```
| GET | /api/auth/2fa/webauthn/credentials | 사용자의 WebAuthn credential 목록. **인증 필수** (JWT). 응답: `[{id, deviceName, transports, lastUsedAt, createdAt}]` (publicKey·counter 미노출) |
```

변경:

```
| GET | /api/auth/2fa/webauthn/credentials | 사용자의 WebAuthn credential 목록. **인증 필수** (JWT). 응답: `{ data: { items: [{ id, deviceName, transports, lastUsedAt, createdAt }] } }` — 비-페이징 고정 컬렉션([api-convention §5.2](./2-api-convention.md#52-목록-응답)). publicKey·counter 미노출 |
```

## 변경 3 — `spec/5-system/2-api-convention.md` `## Rationale` 에 결정 근거 subsection 추가

Rationale 말미에 추가:

> ### 비-페이징 고정 컬렉션은 `{data:{items}}` 유지 (§5.2 페이징과 형태 상이)
>
> 활성 세션·WebAuthn credential 목록은 페이지네이션이 무의미한 소규모 본인 소유 컬렉션으로, `{ data: { items: [...] } }` 를 반환한다. 이는 §5.2 페이징 목록(`data` 가 배열 그 자체, `pagination` 형제)과 nesting 형태가 달라 일관성 관점에서 이상적이지 않다. 그럼에도 이 형태를 **유지**하는 이유: (1) sessions·webauthn 양 엔드포인트의 백엔드(`sessions.controller.ts`·`webauthn.controller.ts` + `WebAuthnCredentialListDto`/`SessionListDto`)와 프런트(`lib/api/sessions.ts`·`passkey-card.tsx` 가 `res.data.data.items` 소비)가 이미 이 계약에 의존하는 **load-bearing** 상태이고, (2) bare-array 로 평탄화하면 백엔드 2·프런트 2 surface 를 동시 변경하는 breaking change 라 이득 대비 churn 이 크다. 따라서 spec 을 실제 계약에 맞춰 정정한다(문서 정직화). 비-페이징 목록을 bare-array `{data:[]}` 로 정규화하는 대안(Option B)은 breaking 이라 별도 결정 시까지 defer. 본 `{data:{items}}` 는 [Swagger 규약 §6](../conventions/swagger.md) 이 기각한 페이지네이션 double-wrap 버그(`{data:{items,totalItems,page,limit}}`)와 무관하다 — pagination 필드가 전혀 없는 순수 비-페이징 컬렉션에 한정된다.

## 변경 4 — `spec/conventions/swagger.md` "유일한 예외" 정정 + §6 구분 (CRITICAL 해소)

**(4a) Rationale §5 (line 317)** — pass-through 예외가 `PaginatedResponseDto` "유일한 예외"라는 단정을 두 사례로 정정:

- 기존: "…§2-5 의 '성공 응답을 `{ data }` 로 감싼다'는 보편 규칙의 **유일한 예외**가 된다."
- 변경: "…§2-5 의 '성공 응답을 `{ data }` 로 감싼다'는 보편 규칙의 **주요 pass-through 사례**가 된다(두 번째 사례: 비-페이징 고정 컬렉션이 `{ data: { items } }` 를 직접 반환하는 경우 — [api-convention §5.2](../5-system/2-api-convention.md#52-목록-응답) 비-페이징 고정 컬렉션 note. `pagination` 필드가 없어 이 §5 페이징 pass-through 와는 형태가 다르다)."

**(4b) §2-5 (line 205)** — "`PaginatedResponseDto`… 가 대표 사례이며" 문장 뒤에 한 절 추가: "비-페이징 고정 컬렉션(활성 세션·WebAuthn credential 목록)이 `{ data: { items } }` 를 직접 반환하는 경우도 동일 pass-through 분기를 탄다([api-convention §5.2](../5-system/2-api-convention.md#52-목록-응답))."

**(4c) §6 (line 305)** — "버그" 문장 뒤에 구분 각주 추가: "단, `pagination` 필드가 전혀 없는 순수 `{ data: { items } }`(비-페이징 고정 컬렉션)는 이 버그 패턴이 아니라 §2-5 의 정상 pass-through 사례다([api-convention §5.2](../5-system/2-api-convention.md#52-목록-응답)) — reflatten 하지 말 것."

## 변경 5 — `spec/2-navigation/9-user-profile.md` line 329 sessions 응답 shape 동기화 (완전성)

sessions 의 canonical spec 위치에도 동일 사실 반영. line 329:

- 기존: `| GET | /api/users/me/sessions | 활성 세션 목록 (family 단위, isCurrent 플래그 포함) |`
- 변경: `| GET | /api/users/me/sessions | 활성 세션 목록 (family 단위, isCurrent 플래그 포함). 응답 `{ data: { items: [...] } }` — 비-페이징 고정 컬렉션([api-convention §5.2](../5-system/2-api-convention.md#52-목록-응답)) |`

---

## 범위 밖 (follow-up, developer 트랙)

- `webauthn-response.dto.ts:77` 주석 "SessionListDto 의 이중 중첩 패턴은 피한다" 가 stale — `SessionListDto` 도 현재 단일 `{items}` 패턴으로 정리됨(`session.dto.ts:60`). 코드 주석이라 본 spec-only PR 범위 밖. developer 가 해당 파일 편집 시 정정 권고 (별도 follow-up 등록).

## 체크리스트

- [x] /consistency-check --spec (초기 2-doc: cross_spec CRITICAL — swagger 미동기)
- [x] draft 확장(변경 4·5) 후 /consistency-check --spec 재실행 → BLOCK: NO (10_42_09, 5/5 clean)
- [x] spec 반영 (변경 1·2·3·4·5 — 4 spec 파일, 7 edits)
- [x] followups auth Critical 2건 close 반영 (exec-intake-followups.md:25) + webauthn-response.dto.ts follow-up 등록
- [x] commit + PR (origin/main) — [#809](https://github.com/worker-ants/clemvion/pull/809)
- [x] memory
