---
worktree: .claude/worktrees/cafe24-error-codes-convention-523e2d
started: 2026-06-02
owner: project-planner
task: F-3-follow-up — 에러 코드 명명 규약 신설
status: complete
---

# F-3 draft — `spec/conventions/error-codes.md` 신설안

> **이 파일은 plan 작업 파일(draft)이다.** 아래 "## 격상 시 최종 spec 본문" 의 내용이
> `spec/conventions/error-codes.md` 로 신설되며, spec 전용 frontmatter(id/status/code)는
> **그 파일에만** 기재한다 (본 draft 에는 두지 않는다 — consistency-check `2026/06/02/08_41_12`
> Critical #1).

## 결정·맥락

- 기존 SoT 는 `spec/2-navigation/4-integration.md` Rationale "(c) 의미 기반 명명 선례 예외" 의
  self-contained 진술뿐. 도메인 증가로 정식 규약으로 격상(F-3, 사용자 결정 2026-06-02 신설).
- **SoT 분리 (중복 방지)**: 에러 코드 **카탈로그·분류·envelope** 은 이미
  [`spec/5-system/3-error-handling.md`](../../spec/5-system/3-error-handling.md) 가 SoT. 본 신설 문서는
  그 위에서 **이름을 어떻게 짓고 유지하는가(명명 규율)** 만 다룬다. `UPPER_SNAKE_CASE` 형식 자체는
  `3-error-handling.md §3.2` / `node-output.md §3.2` 가 이미 규정 → 재선언하지 않고 역참조한다.
- **code: 대상**: 명명 enum 의 실제 정의 파일 `codebase/backend/src/nodes/core/error-codes.ts`
  (`ErrorCode` enum). `3-error-handling.md` 의 `code:`(filter/pipe/dto, envelope 생산 지점) 와
  겹치지 않는다 (Critical #2 / Naming Collision 해소).

## 격상 시 최종 spec 본문 (`spec/conventions/error-codes.md`)

```markdown
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
- **HTTP 상태 코드 선택**: [`5-system/2-api-convention.md §6`](../5-system/2-api-convention.md) ·
  swagger 데코레이터 패턴은 [`swagger.md §2-4`](./swagger.md).
- **표기(`UPPER_SNAKE_CASE`)**: [`3-error-handling.md §3.2`](../5-system/3-error-handling.md) ·
  [`node-output.md §3.2`](./node-output.md) (SoT). 본 문서는 재선언하지 않는다.

본 문서가 **유일하게 소유**하는 것: ① 의미 기반 명명 원칙, ② rename 안정성 정책,
③ historical-artifact 예외 레지스트리.

## 1. 의미 기반 명명 (핵심 원칙)

에러 코드 이름은 **조건의 의미(무엇이 잘못되었는가)** 를 기술한다. 구현 세부·전이적 맥락
(어느 코드 경로에서 났는지, 도입 당시의 일시적 범위)을 이름에 박지 않는다.

- **의미를 기술**: `CAFE24_INSTALL_INVALID_HMAC`, `INTEGRATION_INCOMPLETE`, `OAUTH_STATE_MISMATCH`.
- **구현·역사를 박지 않음**: 코드가 리팩토링·범위 확장되어도 이름이 거짓이 되지 않게 한다.
- **클라이언트 계약**: 클라이언트는 **코드의 의미로 분기**하며 이름 토큰 부분 문자열을 파싱하지 않는다.
  코드의 *정의(spec 본문)* 가 진실이고 이름은 그 정의를 읽히게 하는 라벨이다.

**도메인 prefix (권장)**: 도메인 범주화가 의미 있는 코드는 `<DOMAIN>_<CONDITION>` 으로 그룹화한다
(`CAFE24_*`, `OAUTH_*`, `INTEGRATION_*`). 단, `VALIDATION_ERROR` 처럼 **시스템 전역 공용 코드**
(`3-error-handling.md §1.1·§1.3`) 는 prefix 없이 쓰는 기존 카테고리로, 예외가 아니라 별개 범주다.

## 2. 안정성 / rename 정책

- **에러 코드 rename 은 breaking change 다** — 클라이언트가 코드 값으로 분기하므로 deprecated alias·
  이중 발행·마이그레이션 부담이 발생한다.
- 이름 정확성 향상만을 위한 rename 은 **하지 않는다**. 의미가 분기되거나 새 조건이 생기면 **새 코드를 신설**한다.
- 신규 코드는 **처음부터 의미 정확한 이름**을 부여해 후속 rename 압력을 만들지 않는다.

## 3. Historical-artifact 예외 레지스트리

원칙(§1)을 따르지 않는 기존 코드를 명시적으로 등록한다. 신규 코드는 예외를 선례로 삼지 않는다.

| 코드 | HTTP | 이름이 부정확한 이유 | 진실(의미) | 근거 |
|---|---|---|---|---|
| `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` | 409 | `PRIVATE` 토큰은 historical artifact — 신설 당시 Private 한정이었으나 app_type 무관으로 확장 | 동일 `(workspaceId, mall_id)` 에 cafe24 Integration 중복 | [`4-integration.md` Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 코드명 유지 결정"](../2-navigation/4-integration.md#rationale) (정식 SoT 는 본 §3) |

## Rationale

- **왜 의미 기반인가**: 에러 코드는 클라이언트와의 장기 계약이다. 구현/역사를 이름에 박으면 리팩토링마다
  이름이 거짓이 되거나 rename(breaking) 압력이 생긴다. 의미를 기술하면 코드 경로가 바뀌어도 계약이 안정적이다.
- **왜 rename 대신 신설인가**: rename 의 가독성 이득은 작고(클라이언트는 의미로 분기) 호환성 비용은 크다.
- **왜 예외 레지스트리인가**: 완벽한 이름을 소급 강제하면 breaking rename 이 양산된다. 부정확하나 안정적인
  기존 코드는 "예외 + 정의 명확화" 로 흡수하고 규율은 신규 코드에만 적용해 점진적으로 일관성을 높인다.
```

## 격상(promotion) 동반 갱신 — 완료

- [x] `spec/conventions/error-codes.md` 신설 (frontmatter `status: implemented` + `code: error-codes.ts`, guard 준수 확인).
- [x] `spec/0-overview.md §8` 문서 맵에 `error-codes.md` 행 추가.
- [x] `spec/2-navigation/4-integration.md` Rationale (c) → `error-codes.md §1·§3` forward 참조 + 인라인 단축.
- [x] `spec/5-system/3-error-handling.md §3.2` → 명명 규율 SoT 위임 한 줄.
- [x] `plan/in-progress/cafe24-backlog-residual.md` F-3 `[x]` + 결정 로그.
- [x] 본 draft → `plan/complete/` 이동.
- [ ] (별 worktree, 머지 시점) `cafe24-install-ratelimit-2891d1` RESOLUTION 에 "`CAFE24_INSTALL_RATE_LIMITED` 는 §1 의미 기반 명명 준수 — 예외 불요" 메모. consistency-check WARNING #5 — 본 worktree 에서 직접 수정 불가, 머지 조율 시 처리.

> consistency-check 경합 주의 (WARNING #4): `cafe24-backlog-residual.md` 가 A-3 branch
> (`cafe24-install-ratelimit-2891d1`)·decisions branch (`cafe24-followups-decisions-a38f26`)·본 branch
> 에서 각기 다른 행을 수정 중 — 머지 시 행 단위 auto-merge 예상이나 순서 조율 권장.
