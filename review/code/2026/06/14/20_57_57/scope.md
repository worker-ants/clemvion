# 변경 범위(Scope) Review

## 발견사항

### [INFO] 전체 변경 목적 단일성 확인
- 위치: 전체 diff (17개 파일)
- 상세: 변경의 핵심 목적은 EIA `submit_form` 서버 측 field 검증 추가 (spec form §4·§6.2 / EIA §5.1). 모든 파일이 이 단일 목적에 집중되어 있다.
- 제안: 없음.

### [INFO] review/ 산출물 파일 포함 (정상 범위)
- 위치: `review/code/2026/06/14/20_22_14/` 하위 4개 파일 (RESOLUTION.md, SUMMARY.md, _resolution_log.md, _resolution_state.json)
- 상세: 이전 리뷰 사이클(20_22_14)의 resolution 산출물이 포함되어 있다. 프로젝트 규약상 `review/` 산출물은 gitignored가 아니며 커밋 대상이므로 정상 범위다.
- 제안: 없음.

### [INFO] `interaction.controller.ts` — 단순 description 문자열 수정 (정상 범위)
- 위치: `codebase/backend/src/modules/external-interaction/interaction.controller.ts` (파일 7)
- 상세: `@ApiBadRequestResponse` description에서 `VALIDATION_FAILED` → `VALIDATION_ERROR`로 수정. 기능 변경 없이 API 문서 정확성 제고. 이번 작업의 에러코드가 `VALIDATION_ERROR`이므로 직접 관련된 수정이다.
- 제안: 없음.

### [INFO] `badRequest()` 헬퍼 함수 시그니처 확장
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/modules/external-interaction/interaction.service.ts` — `badRequest` 함수
- 상세: 기존 `badRequest(code, message)` → `badRequest(code, message, details?)` 로 확장. `ValidationDetail` 인터페이스 신규 선언. `details` 파라미터가 optional이므로 하위 호환 유지. 이번 작업 범위(VALIDATION_ERROR details 구조화)에 직접 필요한 변경이다.
- 제안: 없음.

### [INFO] `CHANGELOG.md` 최상단 섹션 추가
- 위치: `CHANGELOG.md` (파일 1)
- 상세: "Unreleased — EIA submit_form 서버 측 field 검증" 섹션이 최상단에 추가됨. 이전 SUMMARY I-14에서 명시적으로 요청한 항목으로, 이번 작업 범위에 속한다.
- 제안: 없음.

### [INFO] `ErrorCode` enum에 `VALIDATION_ERROR` 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/eia-form-validation-0f0d83/codebase/backend/src/nodes/core/error-codes.ts` (파일 11)
- 상세: 기존 에러코드 패턴과 동일한 방식으로 단일 SoT 추가. 이전 SUMMARY W-5의 결의 사항이며 이번 작업 범위에 속한다.
- 제안: 없음.

## 요약

변경된 17개 파일 전체가 단일 목적인 `submit_form` 서버 측 field 검증 구현 및 이전 리뷰 사이클(20_22_14)의 WARNING 항목 해소에 집중되어 있다. 소스 코드 변경(execution-engine, executions, external-interaction, websocket, nodes/core)은 모두 FormValidationError 도입과 그에 따른 에러 처리 경로 연결에 필요한 최소 범위이며, 테스트 파일(spec.ts, e2e-spec.ts) 변경도 해당 기능의 커버리지 추가에 한정된다. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 혼입, 불필요한 임포트 정리, 의도하지 않은 설정 변경은 발견되지 않았다. review/ 산출물 파일은 프로젝트 규약상 커밋 대상이며 범위 이탈이 아니다.

## 위험도

NONE
