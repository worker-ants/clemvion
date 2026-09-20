# Plan 정합성 검토 — `spec/2-navigation` (--impl-prep, rotate-lost-update)

## 발견사항

- **[WARNING]** 같은 함수(`rotate()`) 안에 미해결 planner 결정이 있는데 plan 이 언급하지 않는다
  - target 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` :1119-1129
    (`INTEGRATION_TEST_FAILED` → `BadRequestException`(400)), 및 `spec/2-navigation/4-integration.md:866`
    (같은 코드를 **422** 로 문서화)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미체크 항목
    「rotate 의 테스트 실패 응답이 400 인데 spec 은 422 — 두 spec 이 서로도 어긋난다」
    (`planner 결정`, 2026-09-19 등재, `--impl-prep 2026/09/19/13_21_00` WARNING 1) — 아직 열려 있다.
  - 상세: `plan/in-progress/rotate-lost-update.md` 는 `IntegrationsService.rotate()` 의 락·머지 순서를
    구조적으로 다시 쓴다(외부 연결 테스트를 락 밖에, 재읽기·재머지·`validateCredentials` 재실행을 락 안으로).
    이 리팩터가 손대는 범위(§B 도식 "[락 밖] 연결 테스트 … [락 안] … 재실행")는 바로 위 줄의
    `INTEGRATION_TEST_FAILED` 400/422 불일치 지점과 같은 함수, 인접한 코드다. plan 본문·체크리스트
    어디에도 이 열린 planner 결정을 "건드리지 않는다" 는 명시가 없다 — developer 가 같은 함수를
    고치다 눈에 띄는 이 불일치를 함께 "고치는" drive-by 변경을 하면, 코드만으로 열려 있던 결정
    (spec 422 vs 코드 400, 어느 쪽에 맞출지 + 세부 `code` 를 `details` 에 실을지)을 planner 턴 없이
    developer 가 일방적으로 확정하게 된다. 이는 §0 "구현 중 spec 변경 필요 시 developer 는 멈추고
    project-planner 위임" 원칙과 CLAUDE.md 자기-반증형 소정정 예외(다섯 조건)에도 해당하지 않는
    경로다.
  - 제안: `plan/in-progress/rotate-lost-update.md` 에 "이 PR 은 `INTEGRATION_TEST_FAILED` 의 상태 코드·
    `code` 세분성을 바꾸지 않는다 — 그 결정은 `spec-draft-nullable-notation-followups.md` 의 별도 열린
    planner 항목" 이라는 한 줄을 명시해 두 작업의 경계를 문서로 고정할 것. (구현 자체를 바꿀 필요는
    없다 — 현재 설계상 `dispatchTest`/그 실패 처리는 락 밖에 그대로 남으므로 실질 충돌은 없다.)

## 요약

`plan/in-progress/rotate-lost-update.md` 는 자신이 대체한 409 신설안(`plan/complete/spec-draft-rotate-conflict.md`)의
철회 근거를 `--spec` BLOCK:YES 결과까지 인용해 정직하게 남겼고, 선례(`CONC H-3`, `trigger-config-lost-update.md`)와의
정합도 스스로 검증했다. `plan/in-progress/**` 전수 검색 결과 이 작업과 겹치는 다른 진행 중 plan 은 없고, `spec_impact: none`
판단도 대상 spec(`status: implemented`, `pending_plans` 없음)과 어긋나지 않는다. 유일한 갭은 같은 메서드 안에 놓인,
아직 열려 있는 별개의 planner 결정(rotate 테스트 실패 응답 코드 400/422 불일치)을 plan 이 언급하지 않아, 리팩터
과정에서 그 결정이 의도치 않게 우회될 위험이 남아 있다는 점이다 — 차단 사유는 아니나 plan 갱신을 권한다.

## 위험도
LOW
