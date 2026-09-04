# 신규 식별자 충돌 검토 — spec/5-system (impl-done)

## 검토 범위 요약

- **scope(`spec/5-system/`) 델타**: 0개 파일 — 이 브랜치는 해당 spec 영역 문서를 변경하지 않았다.
- **구현 diff**: 2개 파일 / 43줄(insertions 기준, orchestrator 집계 125줄과 동일 변경분) —
  - `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
  - `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts`
- 워킹트리(`git diff origin/main...HEAD --stat -- codebase/`)로 재확인한 결과도 위 2개 파일 외 변경 없음.

## 변경 내용 성격 분석

diff 를 실측한 결과, 이번 변경은 **기존 5개 필드**(`durationMs`, `currentNode`, `context`, `result`, `error`)의 데코레이터를 `@ApiPropertyOptional` → `@ApiProperty`로, TS 타입을 `field?: T | null` → `field: T | null`로 정정하고, 그에 대응하는 테스트 상수 `NULL_PRESENT_FIELDS`와 `required` 축 단언 테스트 1건을 추가한 것이다. 다섯 필드 모두 `spec/5-system/2-api-convention.md` §5.4(부재 표현 — `null` vs 키 생략)와 `14-external-interaction-api.md` §5.3(EIA `getStatus` 응답)에 **이미 문서화된 기존 필드**이며, §5.4 예시 표(줄 1151)에도 `currentNode`/`result`/`error`가 `null` 표현 선례로 명시돼 있다. 즉 이 diff는:

- 새 요구사항 ID 를 부여하지 않는다.
- 새 엔티티·DTO·인터페이스명을 도입하지 않는다 (`ExecutionStatusDto`, `CurrentNodeDto`, `ButtonsContextDto`, `NodeOutputContextDto` 모두 기존 타입).
- 새 API endpoint(method+path)를 추가하지 않는다.
- 새 webhook/queue/SSE 이벤트명을 추가하지 않는다.
- 새 ENV var·config key를 추가하지 않는다.
- 새 spec 파일 경로를 만들지 않는다 (spec 델타 0).

테스트 파일에 추가된 로컬 상수 `NULL_PRESENT_FIELDS`는 해당 `describe` 블록 스코프에 한정되며, 저장소 전역 grep(`git grep -n "NULL_PRESENT_FIELDS"`) 결과 정의·사용처가 이 한 파일 3곳뿐임을 확인했다 — 다른 모듈·테스트의 동명 식별자와 충돌하지 않는다.

## 발견사항

없음. 이번 target 변경분은 **기존 필드의 데코레이터/타입 정합화(bug fix)**이며 어떤 관점(요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·파일 경로)에서도 새 식별자를 도입하지 않는다. 따라서 신규 식별자 충돌이라는 이 검토의 관점 자체가 적용될 대상이 없다.

## 요약

이 diff는 `spec/5-system/2-api-convention.md` §5.4에 이미 문서화된 "null 을 쓰는 상시 존재 필드는 `@ApiProperty({nullable:true})`" 규칙에 맞춰 `ExecutionStatusDto`의 기존 5개 필드(`durationMs`/`currentNode`/`context`/`result`/`error`) 데코레이터·타입을 정정하고, 그 정합성을 고정하는 테스트 1건과 로컬 스코프 헬퍼 상수 1개를 추가한 것뿐이다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·spec 파일 경로 어느 축에서도 신규 식별자가 도입되지 않았으므로 충돌 가능성이 없다.

## 위험도

NONE
