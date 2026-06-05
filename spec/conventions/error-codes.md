---
id: error-codes
status: implemented
code:
  - codebase/backend/src/nodes/core/error-codes.ts
---

# 에러 코드 명명 규약 (Conventions)

## Overview

에러 코드(`error.code`)의 **명명·안정성 규율**만 정의한다. 책임 경계:

- **카탈로그·분류·트리거**: [`5-system/3-error-handling.md §1`](../5-system/3-error-handling.md) (SoT).
- **응답 봉투(envelope) 형식**: [`5-system/3-error-handling.md §2.1`](../5-system/3-error-handling.md) ·
  [`5-system/2-api-convention.md §5.3`](../5-system/2-api-convention.md#53-에러-응답) (SoT).
- **HTTP 상태 코드 선택**: [`5-system/2-api-convention.md §6`](../5-system/2-api-convention.md);
  swagger 데코레이터 패턴은 [`swagger.md §2-4`](./swagger.md).
- **표기(`UPPER_SNAKE_CASE`)**: [`3-error-handling.md §3.2`](../5-system/3-error-handling.md) ·
  [`node-output.md §3.2`](./node-output.md) (SoT). 본 문서는 재선언하지 않는다.

본 문서가 **유일하게 소유**하는 것: ① 의미 기반 명명 원칙, ② rename 안정성 정책,
③ historical-artifact 예외 레지스트리.

**적용 범위**: 본 규율은 `code:` 의 `ErrorCode` enum(`codebase/backend/src/nodes/core/error-codes.ts` —
명명이 중앙화된 **대표 surface**)뿐 아니라 **프로젝트 전체의 에러 코드 문자열**에 적용된다 — API·통합·
OAuth 등에서 인라인 문자열 리터럴로 발행되는 코드(`CAFE24_*`, `OAUTH_*` 등)를 포함한다.

## 1. 의미 기반 명명 (핵심 원칙)

에러 코드 이름은 **조건의 의미(무엇이 잘못되었는가)** 를 기술한다. 구현 세부·전이적 맥락
(어느 코드 경로에서 났는지, 도입 당시의 일시적 범위)을 이름에 박지 않는다.

- **의미를 기술**: `CAFE24_INSTALL_INVALID_HMAC`(HMAC 검증 실패), `INTEGRATION_INCOMPLETE`(통합 미완성),
  `OAUTH_STATE_MISMATCH`(state 불일치). 이름만으로 분기 의미가 드러난다.
- **구현·역사를 박지 않음**: 코드가 리팩토링·범위 확장되어도 이름이 거짓이 되지 않게 한다.
- **클라이언트 계약**: 클라이언트(프론트엔드·통합 사용자)는 **코드의 의미로 분기**하며 이름 토큰 부분
  문자열을 파싱하지 않는다. 코드의 *정의(spec 본문)* 가 진실이고 이름은 그 정의를 읽히게 하는 라벨이다.

**도메인 prefix (권장)**: 도메인 범주화가 의미 있는 코드는 `<DOMAIN>_<CONDITION>` 으로 그룹화한다
(`CAFE24_*`, `OAUTH_*`, `INTEGRATION_*`). 단 `VALIDATION_ERROR` 처럼 **시스템 전역 공용 코드**
([`3-error-handling.md §1.1·§1.3`](../5-system/3-error-handling.md))는 prefix 없이 쓰는 기존 카테고리로,
원칙 위반 예외가 아니라 별개 범주다.

## 2. 안정성 / rename 정책

- **에러 코드 rename 은 breaking change 다** — 클라이언트가 코드 값으로 분기하므로 deprecated alias·
  이중 발행·마이그레이션 부담이 발생한다.
- 이름 정확성 향상만을 위한 rename 은 **하지 않는다**. 의미가 분기되거나 새 조건이 생기면 **새 코드를 신설**한다.
- 신규 코드는 **처음부터 의미 정확한 이름**을 부여해 후속 rename 압력을 만들지 않는다.

## 3. Historical-artifact 예외 레지스트리

원칙(§1)을 따르지 않는 기존 코드를 명시적으로 등록한다. 신규 코드는 예외를 선례로 삼지 않는다.

| 코드 | HTTP | 이름이 부정확한 이유 | 진실(의미) | 근거 |
|---|---|---|---|---|
| `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` | 409 | `PRIVATE` 토큰은 historical artifact — 신설 당시 Private 한정이었으나 app_type 무관으로 확장 | 동일 `(workspaceId, mall_id)` 에 cafe24 Integration 중복 | [`4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정"](../2-navigation/4-integration.md#rationale) |
| `invitation_not_found` · `invitation_expired` · `invitation_already_used` · `invitation_email_mismatch` · `forbidden` · `rate_limited` | 404/410/400/403/429 | `lower_snake_case` — §1 `UPPER_SNAKE_CASE` 위반. 워크스페이스 초대 흐름 v1 출하 시 이 형태로 정착, 프론트(`invitations.ts` `INVITATION_ERROR_CODES`)·백엔드(`workspace-invitations.service.ts` / `auth.service.ts`)가 `code` 값으로 분기 → rename = breaking(§2) | 초대 토큰 부재/만료/사용됨/이메일 불일치/권한 부족/rate-limit. **초대 API 한정** — 본 `forbidden`/`rate_limited` (lowercase) 는 초대 흐름 전용 historical artifact 로, 다른 영역의 `UPPER_SNAKE_CASE` 범용 코드와 별개다 | [`1-auth.md §1.5.4`](../5-system/1-auth.md#154-에러-응답) |

## Rationale

- **왜 의미 기반인가**: 에러 코드는 클라이언트와의 장기 계약이다. 구현/역사를 이름에 박으면 리팩토링마다
  이름이 거짓이 되거나 rename(breaking) 압력이 생긴다. 의미를 기술하면 코드 경로가 바뀌어도 계약이 안정적이다.
- **왜 rename 대신 신설인가**: rename 의 가독성 이득은 작고(클라이언트는 의미로 분기) 호환성 비용은 크다.
  의미가 실제로 갈라질 때만 새 코드로 분기하는 것이 비용 대비 합리적이다.
- **왜 예외 레지스트리인가**: 완벽한 이름을 소급 강제하면 breaking rename 이 양산된다. 부정확하나 안정적인
  기존 코드는 "예외 + 정의 명확화" 로 흡수하고 규율은 신규 코드에만 적용해 점진적으로 일관성을 높인다.
- **왜 SoT 를 분리하는가**: 카탈로그(`3-error-handling.md`)·envelope(`api-convention §5.3`)·HTTP status
  (`api-convention §6`)·표기(`node-output §3.2`)를 각 축으로 분리해 독립 진화시키고, 본 문서는 명명 규율만
  소유해 책임 중복을 피한다.
