---
title: 403 설명이 가드 거부 코드를 싣는다 — 129곳 · 공용 헬퍼 · reflection 가드
status: in-progress
owner: developer
worktree: forbidden-desc-codes
spec_impact:
  - spec/conventions/swagger.md
started: 2026-09-26
---

# `@ApiForbiddenResponse` 설명 ↔ 가드 거부 코드

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «기존 `@ApiForbiddenResponse` 설명 ~120곳이 가드 거부
코드를 싣지 않는다» 를 닫는다.

## 실측 (2026-09-26, `src/modules` 라우트 핸들러 223개 — reflection)

판정은 `RolesGuard` 와 같은 규칙으로 «이 라우트에서 가드가 낼 수 있는 403 코드» 를 계산한다:

- `@Public()` 이거나, `@Roles()` 도 워크스페이스 소비(`@WorkspaceId()` · `@WorkspaceParam()`)도 없으면 → 없음
- 그 밖 → `NOT_A_MEMBER` + (`@Roles()` 가 있으면) 요구 중 **가장 낮은** 역할의 코드. 가장 낮은 역할이 `viewer` 면 추가 코드 없음
  (`viewer` 거부 = 멤버십 거부 — `ROLE_REQUIRED.viewer === NOT_A_MEMBER`)

근거: `RolesGuard.canActivate` · `assertMember`, `spec/data-flow/12-workspace.md` §Rationale «가드 거부의 오류 코드»(비멤버는 요구
역할과 무관하게 `NOT_A_MEMBER`).

| | 수 |
| --- | --- |
| 가드가 403 을 낼 수 있는 라우트(`@ApiExcludeEndpoint` 제외) | 157 |
| — 403 설명에 그 코드가 전부 있다 | 28 |
| — **빠진 코드가 있다** | **129** (컨트롤러 23개) |
| — 403 광고 자체가 없다 | 0 |
| 가드는 403 을 안 내는데 403 을 광고(서비스 거부 — 범위 밖) | 5 |

129곳의 설명 문구:

| 문구 | 수 | 가드 코드 | 처방 |
| --- | --- | --- | --- |
| «워크스페이스 멤버가 아님» | 54 | `NOT_A_MEMBER` | `FORBIDDEN_NOT_A_MEMBER` |
| «editor 이상 권한 필요» | 53 | + `EDITOR_REQUIRED` | `forbiddenForRole('editor')` |
| «viewer 이상 권한 필요» | 4 | `NOT_A_MEMBER` 만 | `forbiddenForRole('viewer')`(= 멤버 문장) |
| integrations «editor … 또는 Organization 통합의 변경에 Admin …» | 4 | `NOT_A_MEMBER` 만 빠짐 | 상수를 헬퍼로 |
| «Admin 미만 권한» (auth-configs) | 5 | + `ADMIN_REQUIRED` | `forbiddenForRole('admin')` |
| «관리자 권한 필요» (alerts) | 3 | + `ADMIN_REQUIRED` | `forbiddenForRole('admin')` |
| «Editor 미만 권한» (folders) | 3 | + `EDITOR_REQUIRED` | `forbiddenForRole('editor')` |
| «소유자 아님» (workflow-test-datasets `update` · `remove`) | 2 | + `EDITOR_REQUIRED` | 가드 문장 + 서비스 거부 «데이터셋 소유자가 아님(`FORBIDDEN`)» |
| «권한 부족 (Admin 미만) 또는 비멤버» (audit-logs) | 1 | + `ADMIN_REQUIRED` | `forbiddenForRole('admin')` |

«소유자 아님» 은 서비스 거부다 — `workflow-test-datasets.service.ts` 가 소유자가 아닌 수정 · 삭제를 `ForbiddenException({ code:
'FORBIDDEN' })` 로 막는다. 가드 문장에 서비스 문장을 덧붙인다(이 PR 이 판정한 유일한 서비스 거부 자리 — 나머지 서비스 403 코드의
전수는 범위 밖).

## 방향

- **공용 헬퍼** `src/common/swagger/forbidden-descriptions.ts` — `FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole(role)`. 문장 형식은 이미
  코드를 싣던 28곳의 형식(`workspaces.controller.ts` 로컬 상수 «워크스페이스 멤버가 아님(`NOT_A_MEMBER`) 또는 Admin 이상 권한
  필요(`ADMIN_REQUIRED`)»)을 따른다. 역할 문구의 대소문자는 `ROLE_REQUIRED` 메시지(«Editor 이상의 권한이 필요합니다.»)에 맞춘다.
  `workspaces.controller.ts` 의 로컬 상수 셋 · integrations 의 상수를 헬퍼로 옮긴다(같은 문장이 두 벌이 되지 않게 — 워크스페이스
  상수 셋은 문장이 그대로다).
- **문턱 계산 공유** — `RolesGuard.assertMember` 의 «요구 중 가장 낮은 역할» 계산을 `common/constants/workspace-roles.ts` 의
  `lowestRequiredRole` 로 떼어 가드와 새 검사가 같은 함수를 쓴다(동작 불변 — 식을 옮길 뿐). 검사가 문턱 규칙을 따로 옮겨 적으면 둘이
  갈리는 날 검사가 가드가 내지 않는 코드를 요구한다.
- **저장소 가드** `src/repo-guards/__tests__/forbidden-response-codes{-guard.ts,.spec.ts}` — reflection. `src/modules` 의 컨트롤러를
  불러와 라우트마다 위 규칙으로 코드를 계산하고, `@ApiForbiddenResponse` 설명(`swagger/apiResponse` 메타데이터의 `403`)이 그 코드를
  전부 담는지 본다. 403 광고가 없으면 위반. 베이스라인 0. 설명이 상수 보간(`${NOT_A_MEMBER.code}`)이라 AST 보다 reflection 이 맞다 —
  데코레이터가 평가된 **최종 문장**을 본다.
- **spec** — `swagger.md` §5-4 의 403 항목은 «`@Roles()` 가 있으면 요구 역할과 코드» 만 적었는데 가드는 그 라우트에서도 비멤버에게
  `NOT_A_MEMBER` 를 낸다(기존 28곳도 두 코드를 싣는다). planner draft 로 §5-4 문구(두 코드 · `viewer`) · 가드 `code:` 등재 · Rationale.

## 요구 (순서대로)

1. spec draft → `--spec` → 반영(planner 커밋) → `--impl-prep`.
2. 헬퍼 + 단위 테스트.
3. `lowestRequiredRole` 추출(가드가 사용) + 단위 테스트.
4. 저장소 가드 + 대조군(spec 안의 데코레이트된 클래스) + 모델 캐너리 — RED 확인(위반 129).
5. 129곳 설명 교체 · 워크스페이스 · integrations 상수를 헬퍼로.
6. CHANGELOG — (1) OpenAPI 403 설명이 거부 코드를 싣는다(계약 광고 변화) · (3) 가드 신설.
7. 트래커 — 이 항목 닫기(수치 차이 각주) · «신규 repo-guard 가 spec `code:` 에 미등재» 각주 · §3 길이 규약 항목 신규 등재.

## 검토 경고 처리

| 출처 | 지적 | 처분 |
| --- | --- | --- |
| `--spec` `11_12_13` W1 · W2 | 모집단 하한 · 대조군 fixture 가 draft 에 안 보인다 | 가드 spec 초안에 이미 있다(하한 · 대조군 클래스 · 모델 캐너리) — draft Rationale 에 명시 |
| `--spec` `11_12_13` W3 | 트래커 repo-guard `code:` census 가 stale 해진다 | 트래커 정리에서 `http-status-advertised` 때와 같은 한 줄 각주 |
| `--impl-prep` `11_12_24` **C1** (BLOCK: YES) | 현재 §5-4 문구가 data-flow 결정과 어긋난다 | 이 PR 의 spec draft 가 고치는 그것 — planner 커밋 `f262a638e` 로 반영, `--impl-prep` 재실행 |
| `--impl-prep` `11_12_24` W1 | integrations 4곳의 `@Roles('editor')` 자체가 `integration-personal-owner-followup.md` 에서 결정 대기(Viewer 의 자기 Personal) | 순서를 바꾸지 않는다 — 지금 역할에 맞는 설명이 옳다. 다만 **역할을 내리는 날 가드는 RED 를 내지 않는다**: 가드는 설명에 빠진 코드만 잡고 남은 코드(`EDITOR_REQUIRED`)는 못 잡는다(서비스가 같은 이름의 코드를 내는 자리 — integrations 의 `ADMIN_REQUIRED` — 와 구별 불가). 그래서 그 plan 에 «설명도 손으로 바꿀 것» 포인터 한 줄. ~~역할이 바뀌는 날 가드가 RED 를 낸다~~ — 처음 이렇게 적었다가 가드 술어(`missing` 만 센다)로 반증했다 |
| `--impl-prep` `11_12_24` W2 | §3 길이 규약 표에 응답 데코레이터 `description` 범주가 없다 | 트래커 신규 등재(planner 소관 · 이 PR 범위 밖) |
| `--impl-prep` `11_12_24` INFO5 | 트래커 수치(63/54/4/2/20여)와 이 전수(54/53/4/14)가 다르다 | 트래커는 문구를 **부분 문자열로** 세어 이미 코드를 싣던 자리를 포함했다 — «워크스페이스 멤버가 아님» 63 = 빠짐 54 + 이미 `(NOT_A_MEMBER)` 9, «editor 이상 권한 필요» 54 = 빠짐 53 + executions 1. 이 전수는 **빠진 자리**만 센다 |

## 남기는 것

- **서비스 계층 403 코드의 광고** — 가드는 가드 코드만 본다. 서비스가 내는 403(`FORBIDDEN` · `RERUN_PERMISSION_DENIED` 등)을 설명에
  싣는지는 자리마다 판정이 필요해 이 PR 은 test-datasets 두 곳만 했다.

## 체크리스트

- [x] spec draft `--spec` · 반영 — `review/consistency/2026/09/26/11_12_13` BLOCK: NO · planner 커밋 `f262a638e`
- [x] `--impl-prep` — 1회차 `review/consistency/2026/09/26/11_12_24` BLOCK: YES(§5-4 문구 — spec draft 가 고치는 그것) → 반영 뒤 재실행 `review/consistency/2026/09/26/11_28_17` BLOCK: NO
- [x] 헬퍼 · `lowestRequiredRole` · 가드(RED 확인) — 적용 전 위반 **정확히 129**(전수와 일치), 대조군 · 모델 캐너리 · 기존 가드 테스트 GREEN
- [x] 129곳 교체 — 자리별 가드 코드로 헬퍼 선택 · 옛 로컬 상수 별칭 없이 제거(grep 0) · `175387b65`
- [x] 뮤턴트 — 12개. 11 예측대로 KILLED, **F7(클래스 단위 메타데이터 fallback 제거)은 예측대로 SURVIVED** → 대조군에 클래스
  단위 `@Roles` 두 자리(물려받기 · 핸들러 우선)를 더해(`b03432baa`) 재실행 KILLED. 하네스 `PYTHONDONTWRITEBYTECODE=1` · `--no-cache` · cp 원복

  | # | 뮤턴트 | 예측 / 실측 | 죽인 케이스 |
  | --- | --- | --- | --- |
  | F1 | `@Public` 무시 | KILLED / KILLED | 대조군 셋 · 모델 캐너리 |
  | F2 | 워크스페이스 소비 무시 | KILLED / KILLED | **floor** · 대조군 · 캐너리 |
  | F3 | `@WorkspaceParam` 무시 | KILLED / KILLED | 대조 수 · 모델 · 캐너리 |
  | F4 | 문턱을 첫 역할로(가장 낮은 것 아님) | KILLED / KILLED | 대조군 · 모델 · 캐너리 |
  | F5 | 설명 포함 판정 무력화 | KILLED / KILLED | **대조군 위반 목록만** — 저장소 스캔은 초록 |
  | F6 | OpenAPI 제외 무시 | KILLED / KILLED | 본 판정 · 대조군 · 대조 수 |
  | F7 | 클래스 단위 메타데이터 fallback 제거 | SURVIVED / SURVIVED → 대조군 보강 뒤 KILLED | 대조 수 · 모델 · 캐너리 |
  | F8 | swagger 응답 키 오타 | KILLED / KILLED | 본 판정 · 대조군 |
  | F9 | `lowestRequiredRole` 이 가장 높은 역할 | KILLED / KILLED | 단위 · **기존 `roles.guard` spec 셋** · 대조군 · 모델 |
  | F10 | 헬퍼가 비멤버 문장을 뺌 | KILLED / KILLED | 헬퍼 spec · 본 판정 · 대조군 |
  | F11 | 한 자리를 옛 문장으로 | KILLED / KILLED | 본 판정 |
  | C1 | 캐너리가 비멤버만 찌름 | KILLED / KILLED | 캐너리(공허성 — 역할 코드가 한 번도 안 나온다) |
- [x] CHANGELOG — 두 항목(403 설명 · 가드)
- [x] TEST WORKFLOW (lint · unit · build · e2e) — 전부 PASS(e2e 409건). 1회차 unit 은 frontend plan 링크 가드가 spec draft 의 인용 표기 `[…](…)` 를 상대 링크로 읽어 실패 → `3db7fab59` 로 고쳐 재통과
- [x] `/ai-review` — 정지 규칙(사전 선언) «Critical 0 · Warning 0 · 그 라운드 codebase 수정 0». 1라운드 `review/code/2026/09/26/11_53_46` Critical 0 · Warning 2 → 조치 `37aff2a37` · `cb8999dfb`(서열 밖 역할 대조군 · 복합 문장 상수 · `toStrictEqual`). 2라운드 `review/code/2026/09/26/12_20_03` Critical 0 · Warning 0 · codebase 수정 0 — 수렴(INFO 15건 선택 사항)
- [ ] `--impl-done`
- [ ] 트래커 항목 닫기
