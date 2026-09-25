---
title: backend README 캐너리 절 · transferOwnership 트랜잭션 재검사 분기 테스트
status: in-progress
owner: developer
worktree: canary-readme-recheck-test
spec_impact: none
started: 2026-09-25
---

# backend README 캐너리 절 · `transferOwnership` 트랜잭션 재검사 분기 테스트

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «backend README 캐너리 절 · `transferOwnership` 트랜잭션
재검사 분기 테스트» 를 닫는다. 출처: `#1400` 의 `/ai-review`(`review/code/2026/09/25/19_27_34`) INFO 8 · 9. 동작 변경 없음 — 운영자
문서 정정과 테스트 보강이다(`spec_impact: none`).

## 요구

1. `codebase/backend/README.md` §«워크스페이스 reflection 캐너리» 를 `#1399` 이후 캐너리에 맞춘다 — `@WorkspaceParam()` 소비도 센다 ·
   부팅 거부 조건은 두 판별의 **합계** 0 · 부팅 로그는 두 개수(`@WorkspaceId() 소비 라우트 N건 인식 · @WorkspaceParam() 소비 라우트 M건
   인식`) · 먼저 볼 곳에 `workspaceParamNamesOf`. 깨지면 무엇이 새는지도 경로 라우트 쪽(역할 요구가 헤더 · 토큰 워크스페이스로 판정)까지.
2. `modules/workspaces/workspaces.service.spec.ts` — `transferOwnership` 의 트랜잭션 안 재검사 분기(무락 인가 선행은 owner 로 통과했는데
   락을 잡고 다시 보니 owner 가 아님 — 동시 강등 경합)를 unit 으로 고정한다: `OWNER_REQUIRED` · 서비스 고유 문구 · 멤버 변경(`save`)이
   일어나지 않음.

## `--impl-prep` 경고 처리 (`review/consistency/2026/09/25/20_01_21` — BLOCK: NO, WARNING 4)

| # | 경고 | 처분 |
| --- | --- | --- |
| W1 · W4 | 번들이 관련 spec · conventions 를 예산으로 절단(하니스) | 이 작업(README · 테스트)과 무관 — 알려진 하니스 갭(memory `feedback_consistency_spec_mode_budget`). 조치 없음 |
| W2 | `9-user-profile.md §4.2` 역할 매트릭스가 읽기 권한까지 좁게 읽힐 여지 | 기존부터 있던 spec 모호성, 이 plan 범위 밖(spec 쓰기) — 트래커 planner 항목으로 등재 |
| W3 | `12-workspace.md` 의 Owner 요구 라우트 수가 «2곳 / 2곳 / 1곳» 으로 어긋난다 | **오독 — 실측으로 확인했다.** 현재 `workspaces.controller.ts` 의 `@Roles('owner')` 는 2곳(`remove` · `transferOwnership`), `#1399` 직전은 1곳(`transferOwnership`) — «`owner` 1 을 붙여» 는 새로 붙인 `remove` 다. 다만 checker 가 한 번 오독한 문장이라 «(`transferOwnership` 은 이미 `@Roles('owner')` 였다)» 괄호 한 줄을 planner 항목으로 등재 |

## `/ai-review` 처리

멈춤 규칙(각 라운드 시작 전 선언): Critical 0 · Warning 0 · 그 라운드 `codebase/**` 수정 0건이면 종결. 2라운드부터 구조 · 문서 잔여만
남으면 developer SKILL «수렴 예외» 로 트래커 등재.

| 라운드 | 세션 | 결과 | 처분 |
| --- | --- | --- | --- |
| 1 | `review/code/2026/09/25/20_20_00` | Critical 0 · Warning 3 | W1(재검사 OR 의 멤버십 소멸 가지 미고정) — `it.each` 로 두 상태(admin · null). 뮤턴트 **예측/실측**: V1(역할 안 봄) → admin 케이스만 RED / **1 failed — admin 케이스** · V2(부재 안 봄, `as WorkspaceMember` 로 컴파일 유지) → null 케이스만 RED / **1 failed — null 케이스**. W3(README 과밀 문장) — 판별별 불릿 둘. 커밋 `47dfdb3c3`. W2(W2 · W3 «등재» 가 트래커에 없음) — **맞는 지적**, 트래커에 planner 항목 둘 등재 |
| 2 | `review/code/2026/09/25/20_47_04` | Critical 0 · Warning 0 · INFO 6 | **종결** — 이 라운드 `codebase/**` 수정 0건. INFO 1 · 2(mock 헬퍼 · 인라인 타입 반복)는 1라운드 INFO 2 · 3 과 같은 관찰, 조치 불요 판정 유지 |

## 체크리스트

- [x] `--impl-prep` — `20_01_21` BLOCK: NO, 처리 위
- [x] 테스트(요구 2) — 분기를 실제로 타는지 뮤턴트로 확인. 조회를 `lock` 유무로 갈라 선행 owner · 재검사 admin. 뮤턴트 V1(재검사가
      역할을 안 봄) → **RED 1 — 새 테스트 하나뿐**: 전에는 이 분기를 지키는 테스트가 없었다(리뷰 INFO 8 이 맞았다). 커밋 `6aeb57a1a`
- [x] README(요구 1) — 캐너리 코드(`total === 0` 거부 · 로그 두 개수 · 에러 메시지의 «먼저 볼 곳») · 로그 문구와 한 줄씩 대조해 고쳤다
- [x] CHANGELOG 판정 — **항목 없음.** 기준 블록 «한 기능의 동작을 고정하는 테스트 추가(가드가 아닌 커버리지) · 문서» 에 해당
- [x] TEST WORKFLOW — lint · unit(backend 10059) · build · e2e(71 스위트 · 391건 PASS)
- [x] `/ai-review` — 2라운드로 수렴(위 표)
- [ ] `--impl-done`(spec 연결 여부 확인: `workspaces.service.spec.ts` 는 `9-user-profile` 의 `modules/workspaces/**` 에 걸린다)
- [ ] 트래커 항목 닫기
