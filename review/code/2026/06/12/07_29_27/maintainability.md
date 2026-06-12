# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `execution-failure-classifier.spec.ts` — `DB_HOST_BLOCKED` 분류 결과 중복 단언
- 위치: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` — INTERNAL_CODES `it.each` 배열(line ~110) 및 단독 `it` 블록(line ~122)
- 상세: `DB_HOST_BLOCKED → executionFailedInternal` 분류는 `.each` 배열에 이미 포함되어 있다. 바로 이어지는 단독 `it` 블록이 `expect(result.key).toBe('executionFailedInternal')` 를 다시 단언한다. warn 로그 미발생 검증(`warnSpy`)은 고유한 가치가 있지만, `executionFailedInternal` 단언이 중첩되어 테스트 이름("no CCH-ERR-04 warn log")과 단언 집합이 불일치한다.
- 제안: (1) `.each` 배열에서 `DB_HOST_BLOCKED` 를 제거하고 단독 `it` 블록에서 key + warn 로그 양쪽을 검증한다. (2) `.each` 배열에 유지하고 단독 `it` 블록에서는 warn 로그 단언만 남기며 테스트 이름을 "DB_HOST_BLOCKED → no CCH-ERR-04 warn log (key classification covered by it.each above)" 로 명확화한다.

### [INFO] `database-query.handler.ts` — SSRF 차단 에러 메시지 인라인 하드코딩
- 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` SSRF catch 블록
- 상세: `'Database host resolves to a private/loopback address blocked by SSRF policy.'` 문자열이 핸들러 본문에 직접 하드코딩되어 있다. HTTP 핸들러(`HTTP_BLOCKED`)·Email 핸들러(`EMAIL_HOST_BLOCKED`)도 유사한 메시지를 각자 정의하는 구조라면, 향후 문구 수정 시 3곳을 독립적으로 찾아야 한다. 현재 단일 핸들러 추가 범위에서는 수용 가능하나, 3개 핸들러 간 표현 일관성이 수동 관리 대상으로 남는다.
- 제안: 공유 위치(`http-safety.ts` 또는 별도 상수 파일)에 상수(`SSRF_BLOCKED_DB_MESSAGE` 또는 헬퍼 함수)를 두어 3개 핸들러가 동일 소스에서 참조하도록 리팩터링한다. 현 변경 범위에서는 필수가 아닌 INFO 수준이다.

### [INFO] `database-query.handler.spec.ts` — 픽스처 헬퍼 정의 위치 혼재
- 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.spec.ts` `describe('SSRF host guard ...')` 블록 내 `function pgIntegrationWithHost` 및 `function mysqlIntegrationWithHost`
- 상세: 두 헬퍼 함수가 `describe` 블록 내부에 정의되어 있다. 기존 파일의 픽스처 정의 컨벤션(모듈 최상단 상수 `MYSQL_INTEGRATION_BASE`, `makeService` 팩토리 함수 등)과 혼재하여 파일 내 픽스처 위치 일관성이 깨진다. 현재는 해당 `describe` 블록에서만 사용하므로 동작 문제는 없으나, 향후 유사 SSRF 테스트 확장 시 헬퍼를 재발견하기 어렵다.
- 제안: 두 헬퍼를 `describe` 외부(기존 픽스처 상수 블록 근처)로 이동하거나 팩토리 함수 패턴으로 통일한다. 현 범위에서는 LOW 위험이다.

### [INFO] `error-codes.ts` — 핸들러에서 `ErrorCode` enum 비참조, 문자열 리터럴 직접 사용
- 위치: `codebase/backend/src/nodes/integration/database-query/database-query.handler.ts` SSRF catch 블록
- 상세: catch 블록이 `new IntegrationError('DB_HOST_BLOCKED', ...)` 처럼 문자열 리터럴을 직접 사용한다. 같은 PR 에서 `ErrorCode.DB_HOST_BLOCKED` 가 정의되었음에도 핸들러가 이를 참조하지 않아, 오타 발생 시 타입 검사가 감지하지 못할 수 있다. `HTTP_BLOCKED` 핸들러 enum 참조화가 기존 follow-up 항목으로 이미 추적 중이므로 일관성 관점에서도 개선 여지가 있다.
- 제안: `new IntegrationError(ErrorCode.DB_HOST_BLOCKED, ...)` 로 enum 참조를 사용하면 리팩터링 시 자동 추적이 가능해진다. 기존 follow-up(`HTTP_BLOCKED` enum 참조화) 에 연동하여 처리한다.

### [INFO] `plan/in-progress/http-ssrf-all-auth-followups.md` — 완료 항목 한 줄 과밀
- 위치: `plan/in-progress/http-ssrf-all-auth-followups.md` `[x]` 완료 항목
- 상세: 완료된 `DB_HOST_BLOCKED` 신설 항목 설명이 단일 체크박스 줄에 결정 근거·PR 그룹명·연관 spec 참조·구현 범위를 모두 인라인으로 포함하여 가독성이 낮다. 항목 식별 역할을 하는 줄이 80+ 단어 길이의 단일 문장이 되었다.
- 제안: plan 라이프사이클 컨벤션이 허용한다면 완료 결정 요약을 별도 하위 bullet 또는 `> 결정:` callout 블록으로 분리한다. 기능적 문제는 없다.

---

## 요약

이번 변경은 `DB_HOST_BLOCKED` 에러 코드 신설과 이에 연동되는 handler catch-wrap 패턴·classifier INTERNAL_CODES 등재·i18n 매핑·테스트 보강으로 구성된다. 코드 구조는 기존 `HTTP_BLOCKED`·`EMAIL_HOST_BLOCKED` 패턴을 충실히 따르며 대칭성이 명확하다. `INTERNAL_CODES` Set 추가, try/catch 승격, `it.each` 확장, 인라인 주석 품질 모두 기존 컨벤션과 일치하며, 함수 길이·중첩 깊이·순환 복잡도 측면에서 새로운 부담이 없다. 주요 유지보수 리스크는 (1) 에러 메시지 문자열이 핸들러별 인라인 관리로 남아 3개 핸들러 간 표현 일관성이 수동 관리 대상이라는 점, (2) 핸들러에서 `ErrorCode.DB_HOST_BLOCKED` enum 대신 문자열 리터럴을 직접 사용하여 오타 방어가 약하다는 점, (3) 테스트 픽스처 헬퍼가 `describe` 내부에 정의되어 기존 파일 컨벤션과 혼재한다는 점이다. 모두 INFO 수준으로, 현재 구현의 신뢰성과 가독성에 즉각적인 위협은 없다.

## 위험도

NONE
