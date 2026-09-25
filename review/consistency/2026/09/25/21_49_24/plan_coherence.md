# Plan 정합성 검토 — Personal 통합 소유자 강제 (--impl-prep)

## 발견사항

- **[WARNING]** `3-error-handling.md §1.2` `ADMIN_REQUIRED` 행 — 같은 행을 겨냥한 열린 항목과 미조율
  - target 위치: `spec/5-system/3-error-handling.md:46` (`ADMIN_REQUIRED` 행), `plan/in-progress/spec-draft-integration-personal-owner.md` (G) — 이미 커밋 `f47069564` 로 반영됨. 현재 문면:
    `…(RolesGuard 의 @Roles('admin') 미달 · WorkspacesService.assertAdmin() · IntegrationsService 의 Organization 통합 변경 판정(…) 발행)`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:5093` **`removeMember` 리팩터로 낡은 spec 서술 세 줄** (아직 `[ ]`, planner, 2026-09-24 등재) — 그 항목의 표 #2(`:5103`)가 정확히 이 행을 겨냥해 "`ADMIN_REQUIRED` 발행처를 `WorkspacesService.assertAdmin()` **단수**로 못박는데, 이제 `removeMember` 가 `throwAdminRequired()` 로 직접 던진다" 고 이미 지적해 두었다.
  - 상세: 이번 PR(spec-draft-integration-personal-owner)이 바로 이 행을 편집해 `IntegrationsService` 를 발행처에 추가했다. 그런데 같은 행이 이미 "발행처 열거가 불완전하다"는 사유로 다른 열린 planner 항목의 표적이었고, 그 항목이 요구하는 세 번째 발행처(`removeMember` 의 직접 `throwAdminRequired()`)는 이번 편집에도 반영되지 않았다. 결과적으로 같은 행이 "발행처 목록"이라는 같은 이유로 두 plan 에서 각각 한 조각씩 고쳐지게 된다 — 이번 PR 이 착지하면 그 열린 항목의 표 #2 가 인용하는 전제("`WorkspacesService.assertAdmin()` 단수")가 다시 한 번 낡아지고(이제는 두 발행처를 나열한 문장이 됨), 나중에 그 항목을 처리하는 사람이 diff 를 다시 계산해야 한다. 후속 항목이 무효화되진 않지만(요구사항 자체는 여전히 유효), 같은 자리를 두 번 건드리는 비효율과 — 두 PR 이 겹치는 기간에 병합하면 — 문면 충돌 가능성이 생긴다.
  - 제안: `plan/in-progress/spec-draft-integration-personal-owner.md` 의 (G) 를 처리할 때(또는 이미 커밋됐으므로 후속 정정 커밋에서) `removeMember` 의 `throwAdminRequired()` 도 같은 행에 함께 등재해 `spec-draft-nullable-notation-followups.md:5093` 항목의 표 #2 를 동시에 닫거나, 최소한 그 항목 본문에 "이 행은 2026-09-25 Personal 통합 PR 이 먼저 편집했다 — 남은 것은 `removeMember` 한 발행처뿐" 이라고 각주를 남겨 다음 처리자가 diff 를 다시 셈하지 않게 한다.

## 요약

`plan/in-progress/integration-personal-owner.md`(구현) · `spec-draft-integration-personal-owner.md`(planner, 이미 커밋 `f47069564`) · `integration-personal-owner-followup.md`(후속)의 삼각 구조는 정합적이다. 스코프 경계("쓰기+읽기만, 노드 실행·pending_install 재사용·Viewer 생성권·UI 버튼 숨김은 후속")가 세 문서에 일관되게 반영되어 있고, 후속 plan 이 명시한 "planner 결정 필요" 항목들(노드 실행 시 "본인" 정의, Viewer 의 personal 생성 가능 여부, pending_install 재사용 거부 코드)은 이번 구현 plan 이 우회하거나 선점하지 않는다 — `assertCanModify` 일반화·`requireVisible` 404 판정은 전부 이번 PR 의 결정된 범위(§8 판정 규칙) 안에 머문다. `#1399`/`#1400`(RolesGuard reflection·경로 워크스페이스 가드)은 이미 이 브랜치에 커밋되어 선행조건으로 문제없다. 유일한 흠은 위에 적은 `ADMIN_REQUIRED` 발행처 행의 부분 중복 편집으로, 결정 충돌이 아니라 같은 자리를 겨냥한 두 plan 간의 조율 누락이라 WARNING 이 적절하다.

## 위험도

LOW
