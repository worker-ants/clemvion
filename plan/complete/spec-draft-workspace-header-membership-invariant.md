---
title: spec draft — header-first 멤버십 보장을 "분산된 전제" 에서 "구조적 불변식" 으로 정정
worktree: auth-workspace-membership-guard-2b94db
started: 2026-08-08
owner: project-planner
status: in-progress
priority: P0
spec_impact:
  - spec/data-flow/12-workspace.md
  - spec/2-navigation/11-error-empty-states.md
  - spec/2-navigation/9-user-profile.md
---

> **완료 (2026-08-09 위생 정리).** 아래 변경안 5곳이 전부 `#1103` 에 반영돼 `origin/main`
> 에 있다(실측: `12-workspace.md` 3곳 · `11-error-empty-states.md` · `9-user-profile.md`
> + 신설 §Rationale "멤버십 검증은 가드 1곳에서"). 그 PR 이 `complete/` 이동을 빠뜨려
> `in-progress/` 에 남아 있었다 — [`auth-workspace-membership-guard.md`](auth-workspace-membership-guard.md)
> 가 이 문서를 **`complete/` 기준 상대경로**로 링크하고 있어 그동안 깨진 링크였고,
> 이 이동이 그것도 함께 고친다. 발견: 2026-08-09 `--impl-prep` plan_coherence INFO #6.

## Overview

[`auth-workspace-membership-guard`](auth-workspace-membership-guard.md) 의 `--impl-prep`
(`review/consistency/2026/08/08/18_47_21`) **BLOCK: YES** 를 해소하기 위한 spec 정정 draft.
developer 는 `spec/` read-only 이므로 planner 턴으로 분리했다.

## 문제 — 같은 문서가 위험을 명명하고 6줄 뒤 그 전제를 충족으로 단정한다

`spec/data-flow/12-workspace.md` Rationale L286-287 은 header-first 모델의 실패 모드를
**정확히 지목**한다:

> 목표(end-state)는 토큰이 활성 워크스페이스의 단일 진실이 되어 멤버십 검증이 인증 진입점
> 1곳으로 수렴하는 것이며(**header-first 모델의 info-leak 위험 — 멤버십 RBAC 가 모든 핸들러에
> 누락 없이 깔린다는 분산된 전제에 의존 — 해소**) …

그런데 6줄 뒤 L293 이 그 전제를 **충족된 것으로 단정**한다:

> 헤더 스푸핑(비멤버 워크스페이스 지정)은 `RolesGuard` 의 멤버십 검증이 403 으로 차단하므로
> info-leak 이 커지지 않는다.

**실측 결과 전제는 충족되지 않았다.** `RolesGuard.canActivate`(`roles.guard.ts:51-53`)는
`@Roles()` 가 없으면 멤버십 조회(`:66-70`) **이전에** `return true` 한다. 2026-08-08 전수
실측: HTTP 라우트 222건 중 `@WorkspaceId()` 를 소비하면서 `@Roles()` 가 없는 것이 **73건**
(mutation 15 / read 58). 즉 "모든 핸들러에 누락 없이" 가 **1/3 가까이 비어 있었다.**

같은 거짓 서술이 **6곳**에 있다 (`grep -rn "RolesGuard" spec/` 전수 16건 중 판정):

| # | 위치 | 현재 서술 |
|---|---|---|
| 1 | `12-workspace.md:22` (Overview) | "(헤더 스푸핑은 RolesGuard 멤버십 검증이 403 으로 차단)" |
| 2 | `12-workspace.md:293-294` (Rationale) | "…403 으로 차단하므로 info-leak 이 커지지 않는다" |
| 3 | `12-workspace.md:317` (Rationale) | "이 절의 격리 모델·우선순위·`RolesGuard` 403 은 **무번복**이다" |
| 4 | `12-workspace.md:322` (Rationale) | "헤더 스푸핑은 `RolesGuard` 가 이미 403 으로 차단한다" |
| 5 | `2-navigation/11-error-empty-states.md:72` | "헤더 스푸핑 등 실제 인가는 backend `RolesGuard` 403 이 담당" |
| 6 | `2-navigation/9-user-profile.md:158` | "**유일 강제 지점**은 backend `RolesGuard` 403" |

> **#6 은 첫 draft 가 놓쳤다 (`--spec` WARNING #1 이 발견).** 원인은 방법론이다 — 첫
> `--impl-prep` checker 가 준 목록의 파일 2개만 grep 하고 **저장소 전수 grep 을 하지 않았다.**
> 손으로 고른 코퍼스만 순회하면 아무도 적어두지 않은 자리는 판정 기회를 못 얻는다.
> 하필 #5 가 #6 을 "상세" 로 직접 링크하므로, #5 만 고치면 **한 홉 뒤에서 미정정 절대
> 서술로 되돌아간다** — 부분 정정이 오히려 위험한 형태다.
>
> 전수 grep 에서 **거짓이 아니라고 판정한 것**도 적어 둔다(다음 사람이 재조사하지 않도록):
> - `data-flow/1-audit.md:158` — 그 라우트는 실제로 `@Roles('admin')` 이 붙어 있어 **참**
> - `5-system/2-api-convention.md:57,59` · `1-auth.md:312,396` — header-first 만 서술하고
>   스푸핑 차단을 **주장하지 않는다**(침묵). 거짓 아님 → 편집 대상 아님
> - `4-nodes/1-logic/12-background.md:265` — "workspace 멤버이기만 하면 허용하는 패턴" 은
>   전제가 현재 거짓이나 **fix 후 참**이 되고, 보안 보장이 아니라 역할 정책 결정 서술이라
>   편집 대상 아님

## 처분 방침 — 시한부 현황 노트가 아니라 불변식 명문화

checker 는 "fix 완료 전까지 현황을 조건부로 반영" 을 권고했다. 그대로 하면 **같은 PR 안에서
즉시 stale 해지는 문구**를 쓰게 되고(구현이 이어서 착지한다), spec 에 취약점 상세를 남긴다.

대신 **문장을 정밀하게** 만든다. spec 의 진짜 결함은 "지금 거짓" 이 아니라 **보장의 성립
조건을 적지 않은 것**이다 — 보장은 "모든 핸들러가 데코레이터를 빠뜨리지 않는다" 는 분산된
전제 위에 서 있었는데, 그 전제가 문장에 드러나지 않아 독자가 무조건적 보장으로 읽었다.

정정 방향: **멤버십 검증이 가드 1곳에서 라우트 데코레이터와 무관하게 수행된다**는 불변식을
명문화한다. 이는 L285-288 이 이미 end-state 목표로 적어둔 "멤버십 검증이 진입점 1곳으로
수렴" 을 **헤더 제거를 기다리지 않고 앞당겨 달성**하는 것이다 — 즉 기존 결정의 번복이 아니라
그 목표의 조기 실현이다.

fix 착지 후에도 참인 서술이라 stale 하지 않고, 구현이 대조할 계약이 생긴다.

### 변경안

**1. `12-workspace.md:22` (Overview)** — 괄호 안을 조건 명시로:

> …`RolesGuard` 가 그 워크스페이스를 **우선**(header-first) 사용한다. 헤더로 지정된
> 워크스페이스의 **멤버십은 `RolesGuard` 가 라우트의 `@Roles()` 유무와 무관하게 항상
> 검증**하므로(§Rationale "멤버십 검증은 가드 1곳에서 무조건") 헤더 스푸핑은 403 으로 차단된다.

**2. `12-workspace.md:293-294`** — 보장의 근거를 불변식으로 교체:

> …헤더가 없으면 위 `request.user.workspaceId`(토큰 클레임)를 사용한다. 헤더 스푸핑(비멤버
> 워크스페이스 지정)은 `RolesGuard` 가 **라우트 데코레이터와 무관하게** 수행하는 멤버십
> 검증이 403 으로 차단하므로 info-leak 이 커지지 않는다 — 이 무조건성이 위 "분산된 전제"
> 를 제거한 부분이며, 아래 §"멤버십 검증은 가드 1곳에서 무조건" 이 그 근거다.

**3. `12-workspace.md:317`** — "무번복" 의 대상을 좁힌다 (현재는 멤버십 집행 지점까지 포함하는 것처럼 읽힘):

> …따라서 이 절의 격리 모델과 **우선순위(header-first)** 는 **무번복**이다 (slug 라우팅이
> token-first 로의 회귀를 의미하지 않는다 — token-first 는 격리 회귀로 이미 기각됨).
> `RolesGuard` 403 자체도 유지되나, **그 집행 지점**은 아래 §"멤버십 검증은 가드 1곳에서
> 무조건" 에서 한 번 정정됐다(보장을 넓히는 방향).

**4. `12-workspace.md:322`** — 같은 정밀화:

> …이며 인가 경계가 아니다. 헤더 스푸핑은 `RolesGuard` 가 `@Roles()` 유무와 무관하게
> 403 으로 차단한다.

**5. `2-navigation/11-error-empty-states.md:72`** — 같은 정밀화:

> …(인가 경계가 아니며, 헤더 스푸핑 등 실제 인가는 backend `RolesGuard` 403 이 담당 —
> 라우트 `@Roles()` 유무와 무관하게 멤버십을 검증한다)

**6. `12-workspace.md` `## Rationale` 에 신설 절** — 결함과 처분을 역사로 고정:

> ### 멤버십 검증은 가드 1곳에서 무조건 (2026-08-08)
>
> 위 "전환기 하위호환 — header-first" 절은 헤더 스푸핑이 `RolesGuard` 멤버십 검증으로
> 차단된다고 서술해 왔다. 그 보장은 실제로 **"모든 워크스페이스-스코프 핸들러에 `@Roles()`
> 가 빠짐없이 붙어 있다"** 는 분산된 전제 위에 서 있었고 — 같은 절이 그 위험을 이미
> 명명했다("멤버십 RBAC 가 모든 핸들러에 누락 없이 깔린다는 분산된 전제에 의존") —
> **전제는 충족되지 않았다.** 2026-08-08 실측: HTTP 라우트 222건 중 `@WorkspaceId()` 를
> 소비하면서 `@Roles()` 가 없는 것 73건(mutation 15 / read 58). `RolesGuard.canActivate`
> 가 `requiredRoles` 가 비면 멤버십 조회 이전에 통과시켰기 때문이다.
>
> **정정**: 멤버십 검증을 라우트 데코레이터에서 분리해 가드에서 **무조건** 수행한다.
> `@Roles()` 는 이제 **역할 계층 비교만** 통제한다. 헤더가 없으면 워크스페이스 컨텍스트는
> `jwt.strategy` 가 이미 멤버십 검증한 `request.user.workspaceId` 이므로 추가 검사가 필요
> 없고, 검증이 필요한 유일한 경로는 **헤더가 토큰 확정값을 덮어쓸 때**다.
>
> **기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착**: opt-in 모델의 연장이라 74번째
> 라우트에서 같은 누락이 재발한다(이미 최소 2회 발생). 원 리뷰
> (`review/code/2026/08/01/13_46_48/security.md`)도 구조적 해소를 권고했다.
>
> **이것은 token-first 회귀가 아니다** — header-first 우선순위는 그대로다. 바뀐 것은
> 헤더로 들어온 값의 **검증 시점이 라우트별 opt-in 에서 가드 무조건으로** 옮겨진 것이며,
> 위 end-state 목표("멤버십 검증이 인증 진입점 1곳으로 수렴")를 헤더 제거를 기다리지 않고
> 앞당겨 달성한 것이다.
>
> 구현·전수 목록: [`plan/complete/auth-workspace-membership-guard.md`](../../plan/complete/auth-workspace-membership-guard.md).

**7. `2-navigation/9-user-profile.md:158`** (`--spec` W1) — "유일 강제 지점" 을 정밀화:

> …**UX 편의이며 인가 경계가 아니다**(강제 지점은 backend `RolesGuard` 403 — 라우트
> `@Roles()` 유무와 무관하게 워크스페이스 멤버십을 검증한다).

### 적용 범위 (모든 변경안에 공통, `--spec` W2)

"무조건" 의 대상은 **워크스페이스 컨텍스트를 소비하는 인증된 라우트**다. `RolesGuard` 는
`APP_GUARD` 전역 등록(`app.module.ts`)이라 아래는 **대상 제외**이며, 각 변경안 문구와
신설 Rationale 에 이 스코프를 함께 새긴다:

- `@Public()` 라우트 · `request.user` 부재(미인증) → 인증 판정은 `JwtAuthGuard` 소관
- 워크스페이스 컨텍스트를 쓰지 않는 라우트(`@WorkspaceId()` 미소비) → 검증 대상 없음

## side-effect 점검 대상

- `spec/5-system/1-auth.md` §3.3 API 인가 흐름 — 2단계 서술이 header-first 를 적고 있으나
  멤버십 검증 시점을 명시하지 않는다. **본 draft 범위에 포함할지 판정 필요** (§3.3 은
  이미 "3. 요청 리소스가 해당 워크스페이스에 속하는지 확인" 을 별 단계로 두어 모순은 아님)
- `spec/5-system/3-error-handling.md` §1.2 `NOT_A_MEMBER` 발행처 — developer 가 403 코드로
  `NOT_A_MEMBER` 를 재사용하기로 결정하면 발행처에 `roles.guard.ts` 추가 필요.
  **그 결정은 developer 턴 소관**이라 본 draft 에서 선점하지 않는다
- `spec/2-navigation/4-integration.md §8` — integrations 4건의 역할 판정 근거. spec 변경
  없음(대조 대상일 뿐)
- **`spec/conventions/swagger.md` §5-4 — 체크리스트 전제가 깨진다** (`--spec` W3).
  현재 규약은 "`@Roles()` 붙은 엔드포인트만 `@ApiForbiddenResponse` 요구" 인데, 정정 후
  `@Roles()` 없이 `@WorkspaceId()` 만 쓰는 라우트도 403 을 반환할 수 있다 → 규약을 그대로
  두면 OpenAPI 문서에서 403 이 계속 누락된다. **처분**: 규약 문구 갱신이 필요하다는 사실을
  여기 명시하고, 실제 데코레이터 부착·규약 편집은 developer 구현 시점에 함께 처리한다
  (그 시점에야 어느 라우트가 403 을 낼 수 있는지 확정된다)
- `spec/5-system/2-api-convention.md:57,59` · `1-auth.md:312,396` — **침묵(거짓 아님)**.
  header-first 만 적고 스푸핑 차단을 주장하지 않는다. 불변식을 여기에도 적으면 발견성이
  좋아지지만 본 draft 는 **거짓 서술 정정**으로 범위를 한정한다 — 의도적 범위 밖

## Rationale

**왜 시한부 문구가 아닌가.** 구현이 같은 브랜치에서 이어지므로 "현재 미차단" 노트는 같은 PR
안에서 stale 해진다. 이 저장소는 "문서한 보장이 구현보다 넓으면 안 된다" 를 반복 학습했는데,
그 반대(문서가 실제보다 좁게 시한부로 적혀 곧 거짓이 됨)도 같은 클래스의 비용이다.

**왜 "무번복" 을 손대는가.** L317 의 무번복 선언은 `RolesGuard` 403 을 격리 모델·우선순위와
한 묶음으로 못박는다. 멤버십 집행 지점을 옮기는 것은 그 선언과 충돌하는 것처럼 읽히므로,
무번복의 대상을 **우선순위**로 좁히고 집행 지점 정정을 명시적으로 예외 처리한다. 보장을
**넓히는** 방향이라 원 결정의 취지(격리 유지)와 상충하지 않는다.

**Gate C**: `spec_impact` 는 실제 편집 대상 2파일 리스트로 선언한다(`none` 아님).
