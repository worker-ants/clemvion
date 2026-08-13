# Security Review — assertRowArray 하드닝(4곳) + 회귀 테스트 + 리뷰/plan 문서

## 발견사항

없음. CRITICAL/WARNING 대상 결함을 찾지 못했다.

이번 diff 의 실질 코드 변경은 8개 backend 파일(신규 유틸 2 + production 2 + spec 4)이며,
나머지(파일 9~72)는 `plan/in-progress/**` 문서 갱신과 `review/code/**`, `review/consistency/**`
하위의 과거 리뷰/일관성 검토 산출물(마크다운, 실행되지 않는 정적 기록)이다 — 실행 코드가
아니므로 보안 표면에 실질적 영향이 없다.

### 점검한 항목 (해당 없음 확인)

- **인젝션**: 신규 SQL 조합 없음. `codebase/backend/src/modules/executions/executions.service.ts`
  의 `computeChainDepth`(재귀 CTE)와 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  의 admission UPDATE·`lockNonTerminalExecutionRow` SELECT·`updateExecutionStatus` UPDATE 모두
  `$1`/`$2` 파라미터 바인딩만 사용하며 이번 diff 는 그 SQL 문자열 자체를 건드리지 않았다. 신규로
  추가된 `assertRowArray()` 호출은 쿼리 실행 **이후** 반환값 shape 을 검사할 뿐, 쿼리 구성에
  관여하지 않는다.
- **하드코딩된 시크릿**: 없음. `git diff origin/main..HEAD | grep -iE "password|api[_-]?key|secret|token|bearer"`
  로 전수 확인한 결과 매칭은 전부 과거 리뷰 세션(`14_01_46`/`17_15_21`/`18_00_11`/`18_19_33`)의
  마크다운 산출물 안에서 `chat-channel.dispatcher.spec.ts` 기존(비변경) 테스트 픽스처
  `'SECRET SYSTEM PROMPT'`(outbound 이벤트에 시스템 프롬프트가 새지 않는지 검증하는 더미 값)를
  **서술**하는 텍스트였다 — 실제 시크릿 리터럴이 새로 추가되지 않았다.
  `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` 실제 diff
  (`git diff origin/main..HEAD -- .../chat-channel.dispatcher.spec.ts`)를 직접 열어 대조했고,
  이 diff 범위(로그 레벨 분기 테스트 + `makeDispatcherHarness` 공통화)에는 해당 리터럴이
  등장하지 않는다.
- **인증/인가**: `SNAPSHOT_CACHE_MAX_ENTRIES`(executions.service.ts:63) 는 `const` → `export const`
  로 가시성만 확대됐고 캐시 키(execution UUID)·eviction 로직·워크스페이스 소유권 검증 경로는
  변경되지 않았다. admission/lock/상태전이 가드는 판정 로직을 바꾸지 않고 "배열 아님" shape 이상
  시 예외를 던지는 진단 계층만 추가한다.
- **입력 검증**: `codebase/backend/src/common/utils/assert-row-array.ts` 의
  `assertRowArray(rows, detail): asserts rows is unknown[]` 는 `EntityManager.query()`/
  `Repository.query()` 의 선언 타입(`Promise<any>`)이 실제로는 검증하지 않는 런타임 shape 을
  4개 호출부(`admitExecutionOrDefer`, `lockNonTerminalExecutionRow`, `updateExecutionStatus`,
  `computeChainDepth`)에서 일관되게 강제한다. 특히 `computeChainDepth` 는 가드가 없으면
  `rows[0]?.depth ?? 1` 로 **depth 1** 이 되어 호출부 `depth >= RERUN_CHAIN_DEPTH_LIMIT` 검사를
  통과 — **RR-PL-05 재실행 체인 깊이 제한이 조용히 우회(fail-open)**될 수 있었던 지점을 이번
  변경이 닫는다(`codebase/backend/src/modules/executions/executions.service.ts` 함수
  `computeChainDepth`). 이는 신규 취약점이 아니라 **기존 fail-open 결함을 막는 방어적 강화**다.
- **암호화/평문 전송**: 해당 변경 없음.
- **에러 처리(정보 노출, CWE-209)**: `assertRowArray` 가 던지는 `Error` 는 일반
  `Error`(HttpException 아님)이므로 `codebase/backend/src/common/filters/http-exception.filter.ts`
  의 `GlobalExceptionFilter.catch()` 에서 `mapHttpErrorLike()` 가 `null` 을 반환해
  `UNHANDLED_ERROR_MESSAGE`("An unexpected error occurred. Please try again later.")로
  마스킹되고, 원문(`typeof rows`·`executionId`·CTE 세부 설명 등)은 `logger.error(...)` 로
  서버 로그에만 남는다. `computeChainDepth` 의 예외는 `ExecutionsController.reRun` 경유로
  전파되는데(`codebase/backend/src/modules/executions/executions.controller.ts:284-290`, try/catch
  없이 그대로 위임) 컨트롤러 레벨 가로채기가 없어 결국 GlobalExceptionFilter 로만 처리되므로
  클라이언트에는 내부 SQL/캐시/체인 구조가 노출되지 않는다. 메시지에 담긴 `executionId` 는
  호출자가 이미 아는 내부 UUID로 PII/시크릿이 아니다.
  admission 가드의 throw 경로(`execution-engine.service.ts` `runExecutionFromQueue`)는 BullMQ
  워커 큐 처리 경로이며 HTTP 응답 경로가 아니다 — try/catch 로 routing context 를 release 한 뒤
  그대로 재전파해 BullMQ 재배달에 맡긴다(HTTP 클라이언트에 직접 노출되지 않음).
- **의존성 보안**: 신규/변경 의존성 없음(`assert-row-array.ts` 는 순수 함수, 외부 패키지 미사용).

## 요약

이번 diff 의 실질 production 코드 변경은 `assertRowArray()` 라는 단일 목적 런타임 shape 가드
유틸리티를 4개 호출부에 일관되게 적용한 것과, 테스트가 상수를 참조하기 위한 `export` 전환
1줄이다. 인젝션·하드코딩 시크릿·인증/인가 우회·입력 검증 미비·안전하지 않은 암호화·민감정보
노출 어느 관점에서도 신규 결함을 발견하지 못했다. 오히려 이 변경은 (1) `computeChainDepth`
에서 드라이버가 계약을 어긴 shape 을 반환할 경우 재실행 체인 깊이 제한(RR-PL-05)이 조용히
우회될 수 있던 fail-open 결함을 닫고, (2) 그 예외가 기존 `GlobalExceptionFilter` 의 CWE-209
마스킹 경로를 그대로 타 클라이언트에 내부 정보를 노출하지 않으며, (3) 트랜잭션 내부 가드는
throw 로 롤백을 보존해(WARNING 이력상 `return false` 로 삼켰다가 되돌린 것으로 확인) 부분 적용
상태를 방지하는 등, 전반적으로 방어를 강화하는 방향의 변경이다. 나머지 대다수 파일은
`review/**`·`plan/**` 하위의 비실행 마크다운 산출물로 보안 표면에 영향이 없다.

## 위험도

NONE
