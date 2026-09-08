# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `raceErrorSurfaces` 대조군 배열이 cafe24/makeshop 두 spec 파일에 문자 그대로 복제됨
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts`(`describe` 내 `raceErrorSurfaces` 선언, 새 `it.each` 블록 직전)와 `codebase/backend/src/modules/integrations/integration-oauth.service.makeshop.spec.ts`의 동일 위치
  - 상세: `flat (err.code / err.constraint)` / `wrapped (err.driverError.*)` 두 표면을 만드는 11줄짜리 배열 리터럴과 그 위 5줄 주석이 두 파일에 완전히 동일하게 들어갔다. 다만 이 저장소는 cafe24/makeshop 두 서비스 경로의 미러 중복을 각 서비스가 독립적으로 진화(다른 상수·에러 코드 이름 등)할 수 있도록 **의도적으로 유지**하는 확립된 결정이 있다(과거 리뷰에서 DRY 재발견을 오탐으로 철회한 선례가 있음). 이 변경은 그 기존 미러링 관례를 그대로 따른 것이라 새로운 이탈이 아니다.
  - 제안: 조치 불요 — 기존 프로젝트 컨벤션과 일치한다. 다만 세 번째 서비스가 같은 패턴을 요구하게 되면 그때는 공용 헬퍼(`__test-utils__`)로의 승격을 검토할 만하다.

- **[INFO]** `_cmd_typecheck_ratchets` 는 같은 파일의 `_run_internal` 과 다른 반복 스타일을 씀
  - 위치: `.claude/test-stages.sh` — `_cmd_typecheck_ratchets()` 함수 (INTERNAL_PACKAGES 배열을 순회하는 `_run_internal()` 바로 아래)
  - 상세: `_run_internal()` 은 `for pkg in "${INTERNAL_PACKAGES[@]}"; do ... || return 1; done` 형태의 배열+루프로 "N개를 순차 실행하고 하나라도 실패하면 중단"을 표현하는데, 바로 이어지는 `_cmd_typecheck_ratchets()` 는 같은 의도를 `python3 a.py && python3 b.py` 인라인 체인으로 표현한다. 현재는 항목이 2개뿐이라 실질적 문제는 없지만, 같은 파일 안에 같은 목적의 서로 다른 두 관용구가 나란히 있다.
  - 제안: 지금 당장 바꿀 필요는 없음(2건 규모에서는 배열화가 과설계일 수 있음). 세 번째 ratchet 스크립트가 추가되는 시점에는 `_run_internal` 과 같은 배열+루프 형태로 통일하는 것을 고려.

## 요약

이번 배치는 순수 리팩터(중복 로컬 함수 `isUniqueViolation` 제거 후 SoT `isPostgresUniqueViolation` 재사용, `integration-oauth.service.ts` 의 손-작성 constraint 추출부 2곳을 `pgErrorConstraint()` 로 교체, `enclosingName`/`enclosingScopeName` 형제 중복을 `source-scan.ts` 공용 함수로 승격), 신규 구조 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture), DB 레벨 `select` 투영 전환(`workspaces.service.ts#listMembers`), 타입 개명(`WorkflowVersionDetailProjection`)으로 구성된다. 모두 기존 형제 가드(`user-entity-exposure-guard.ts`, `swagger-dto-contract-guard.ts`)와 동일한 구조·네이밍(`SRC_ROOT`, 상수로 뽑은 문자열 리터럴 `CONFLICT_WRAPPER`/`TRIGGER_REPOSITORY`)·문서화 규율을 따라 코드베이스 일관성이 높다. 함수 길이·중첩 깊이·순환 복잡도는 모두 정상 범위이고(`isWrappedByConflictCatch`·`findTriggerRepositorySaves` 등 신규 함수는 20~40줄 내 단일 책임 유지), `production-build-devdep.spec.ts` 는 과거 리뷰가 지적한 반복 `it()` 블록을 이번에 `it.each` 로 파라미터화해 확장 비용을 낮췄다. 실질적으로 새로 지적할 만한 결함은 없고, 위 두 항목은 모두 INFO 수준 참고 사항(하나는 기존 프로젝트 컨벤션과 일치, 다른 하나는 항목 수가 늘 때 고려할 스타일 통일)이다.

## 위험도

LOW
