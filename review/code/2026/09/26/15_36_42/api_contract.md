# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 이번 변경은 OpenAPI `@ApiForbiddenResponse` **설명 문자열의 이음(구두점) 통일**뿐이며, 실제 API 계약 요소(HTTP 상태 코드·응답 바디·에러 코드·URL·인증/인가 로직·페이지네이션)는 전혀 바뀌지 않는다.
  - 위치: `codebase/backend/src/common/swagger/forbidden-descriptions.ts` (`forbiddenWithService` 함수, 새로 추가) · `codebase/backend/src/modules/{auth,executions,integrations,workflow-test-datasets,workspaces}.controller.ts` 의 `@ApiForbiddenResponse({ description: ... })` 각 호출부
  - 상세: `forbiddenForRole` 이 만드는 가드 거부 문장 뒤에 서비스가 내는 403 문장을 잇는 구분자를 `, 또는`(문장 내에서 혼재하던 형식) → ` 또는`(헬퍼가 강제하는 단일 형식)으로 통일했다. 실제로 실행 시 던져지는 `ForbiddenException` 의 상태 코드(403)·바디(`error.code` 등)는 손대지 않았고, `forbidden-response-codes` 가드(부분 문자열로 코드 포함 여부만 검사)도 이 변경으로 깨지지 않음을 소스에서 직접 확인했다(`forbidden-response-codes-guard.ts` 의 `scanForbiddenResponseCodes` 는 `description.includes(code)` 만 본다).
  - 제안: 없음 — 문서 문자열 정합화로, 계약 관점에서 조치가 필요한 리스크는 없다.

- **[INFO]** `swagger.md` §2-4 상태 코드 표에 202·410·429 행이 빠져 있다는 기존 갭이 이번 PR 범위 밖에서 이미 인지·트래커 등재되어 있다.
  - 위치: `plan/in-progress/forbidden-helper-sentences.md` "검토 경고 처리" 표 (`--impl-prep 15_08_57 W1`)
  - 상세: 해당 갭은 이 PR 이전부터 존재했고 spec 표 자체의 문제(신규 도입 아님)이며, plan 문서에도 "사실 확인·트래커 등재(planner)" 로 명시 처분되어 있다. 이번 diff 가 원인이 아니므로 재지적하지 않는다.
  - 제안: 없음(이미 별도 트랙에서 추적 중).

- **[INFO]** 서비스 문장을 잇는 8개 자리 중 재실행(`re-run`)·chain 조회 2곳은 내용(코드 나열 순서·구두점 형식)이 옛 손문장과 문자 그대로는 다르지만, 실려 있는 오류 코드 집합(`NOT_A_MEMBER`, `EDITOR_REQUIRED`, `RERUN_PERMISSION_DENIED`, `RR-PL-06`)은 그대로 유지된다.
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts` `reRun()`, `getChain()` 의 `@ApiForbiddenResponse`
  - 상세: 예) 기존 `... — RolesGuard / 타인 실행이고 Owner·Admin 아님(RERUN_PERMISSION_DENIED, RR-PL-06) — 서비스` → `... 또는 타인 실행이고 Owner·Admin 아님(RR-PL-06 · RERUN_PERMISSION_DENIED — 서비스 판정)`. 정보 손실 없이 표기만 통일됐다.
  - 제안: 없음.

## 요약

이번 diff 는 8개 컨트롤러·1개 공용 헬퍼 파일에 걸쳐 있지만 전부 Swagger `@ApiForbiddenResponse` **설명 문자열**의 이음 구두점(`, 또는` → ` 또는`)을 신설 헬퍼 `forbiddenWithService(guard, service)` 로 통일하는 순수 문서 리팩터다. 실제 응답 상태 코드·바디 구조·에러 코드·인증/인가 가드 로직·URL 설계·페이지네이션·요청 검증에는 어떤 코드 변경도 없어, 기존 API 클라이언트에 영향을 주는 breaking change 요소가 없다. 코드가 실리는지 여부를 검사하는 `forbidden-response-codes` 가드도 부분 문자열 매칭만 하므로 이번 형식 변경으로 깨지지 않는 것을 소스 확인했다. plan 문서(`plan/in-progress/forbidden-helper-sentences.md`)에도 "응답은 그대로, 설명 문장만 바뀐다" 는 동일한 전제가 명시돼 있고 실측·뮤테이션 테스트로 뒷받침된다.

## 위험도

NONE
