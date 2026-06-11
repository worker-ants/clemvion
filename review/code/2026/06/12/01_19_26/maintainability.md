# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] 테스트에서 `DB_HOST_BLOCKED` 중복 검증
- 위치: `execution-failure-classifier.spec.ts` 라인 168~186 (`.each` 배열) 및 라인 190~198 (단독 `it` 블록)
- 상세: `DB_HOST_BLOCKED → executionFailedInternal` 분류는 `.each` 배열에 이미 포함되어 있다. 이후 단독 `it` 블록이 동일한 `result.key === 'executionFailedInternal'` 를 다시 assert 한다. warn 로그 비호출 검증(`warnSpy`) 은 의미 있는 추가지만, 테스트 이름이 "no CCH-ERR-04 warn log" 로 한정되어야 할 관심사에 `executionFailedInternal` assert 가 합산되어 의도가 중첩된다.
- 제안: 단독 `it` 블록의 `expect(result.key).toBe('executionFailedInternal')` 제거 또는 테스트 이름을 "DB_HOST_BLOCKED → no CCH-ERR-04 warn log (classification already covered above)" 로 명확화해 중복 의도를 문서화한다.

### [INFO] SSRF 차단 에러 메시지 하드코딩 문자열
- 위치: `database-query.handler.ts` SSRF 차단 catch 블록 (`throw new IntegrationError('DB_HOST_BLOCKED', 'Database host resolves to a private/loopback address blocked by SSRF policy.')`)
- 상세: 에러 메시지 문자열이 핸들러 본문에 인라인으로 하드코딩되어 있다. HTTP 핸들러와 Email 핸들러도 각자 유사 문구를 직접 정의한다면, 3개 핸들러 간 메시지 표현이 엇갈릴 수 있다.
- 제안: 세 핸들러가 공유하는 `http-safety.ts` 또는 `integration-handler-base.ts` 에 상수(`SSRF_BLOCKED_MESSAGE`) 또는 헬퍼를 두어 메시지 일관성을 보장한다. 현재 변경 범위(DB 핸들러 단독)에서는 수용 가능한 수준이나, 향후 문구 수정 시 3곳을 동시에 찾아야 한다.

### [INFO] `database-query.handler.spec.ts` 내 `pgIntegrationWithHost` 헬퍼 스코프
- 위치: `database-query.handler.spec.ts` `describe('SSRF host guard ...')` 블록 내 `function pgIntegrationWithHost`
- 상세: `pgIntegrationWithHost` 헬퍼는 `describe` 블록 내부에 정의되어 있다. 기존 `MYSQL_INTEGRATION_BASE` 상수나 `makeService` 팩토리와의 일관성 면에서, 파일 내 픽스처 정의 위치 컨벤션(모듈 최상단 상수 또는 팩토리 함수)이 혼재한다.
- 제안: 코드 동작에는 영향 없으나, 향후 유사 SSRF guard 테스트가 MySQL 등으로 확장될 때 헬퍼를 `describe` 외부 팩토리로 승격해 재사용하면 일관성이 높아진다. 현 범위에서는 LOW 위험.

### [INFO] `plan/in-progress/http-ssrf-all-auth-followups.md` 완료 항목 설명 길이
- 위치: `plan/in-progress/http-ssrf-all-auth-followups.md` 완료(`[x]`) 항목 한 줄
- 상세: 완료 항목 설명이 단일 줄에 매우 길게 인라인 추가되어 가독성이 낮다. 체크박스 라인의 본래 역할(항목 식별)을 넘어 결정 근거·PR 범위·연관 spec 참조가 모두 합산되어 있다.
- 제안: plan 파일 컨벤션이 허용한다면 완료 결정 요약을 별도 하위 bullet 또는 링크로 분리한다. 기능적 문제는 아니며 plan 라이프사이클 문서가 이 패턴을 수용하면 수용 가능.

## 요약

이번 변경은 `DB_HOST_BLOCKED` 에러 코드 신설과 이에 연동되는 handler 분기·분류기 등재·spec 동기화로 구성된다. 코드 구조는 기존 `HTTP_BLOCKED`·`EMAIL_HOST_BLOCKED` 패턴을 충실히 따르며 대칭성이 명확하다. `INTERNAL_CODES` Set 추가, try/catch 승격 패턴, `it.each` 확장 모두 기존 컨벤션과 일치하고 함수 길이·중첩 깊이·복잡도 측면에서 새로운 부담 없다. 주요 유지보수 리스크는 에러 메시지 문자열이 핸들러별 인라인 관리로 남아 있어 3개 핸들러 간 표현 일관성이 향후 수동 관리 대상이라는 점이다. 발견된 사항 모두 INFO 수준으로 현재 구현의 신뢰성과 가독성에 즉각적인 위협은 없다.

## 위험도

NONE
