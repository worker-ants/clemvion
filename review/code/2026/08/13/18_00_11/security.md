# Security Review — execution-engine / executions.service admission·chain-depth 가드 + 테스트 보강

## 대상 요약

이번 changeset 의 실질 프로덕션 코드 변경은 두 파일:

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `admitExecutionOrDefer`(admission UPDATE), `lockNonTerminalExecutionRow`(FOR UPDATE SELECT), `updateExecutionStatus`(guarded UPDATE) 세 지점에 `Array.isArray(rows)` 런타임 가드 추가. 위반 시 `throw new Error(...)`. `runExecutionFromQueue` 에서 `admitExecutionOrDefer` 호출을 `try/catch` 로 감싸 throw 시 `releaseExecutionRouting` 후 재전파.
- `codebase/backend/src/modules/executions/executions.service.ts` — `computeChainDepth`(재귀 CTE `.query()`)에 동일한 `Array.isArray` 가드 추가, `SNAPSHOT_CACHE_MAX_ENTRIES` 를 `export` 로 가시성만 확대.

나머지(`chat-channel.dispatcher.spec.ts`, `execution-engine.service.spec.ts`, `executions-rerun.service.spec.ts`, `executions.service.spec.ts`)는 순수 테스트 추가이며 대응 production 코드가 이미 위 두 파일에 반영돼 있다. `plan/in-progress/*.md`, `review/**` 는 문서 변경뿐이다.

## 발견사항

없음 — CRITICAL/WARNING 급 보안 결함을 발견하지 못했다.

### 점검한 보안 관점 (해당 없음 확인)

- **인젝션**: 신규 SQL 은 없다. `computeChainDepth`(`$1`,`$2` 파라미터 바인딩), admission UPDATE(파라미터 바인딩)는 이번 diff 대상이 아니고 변경 없음. 신규 `throw new Error(...)` 메시지에 `executionId`/`typeof rows` 를 문자열 템플릿으로 연결하지만, 이 값은 SQL/커맨드/경로로 재사용되지 않고 순수 진단 문자열이라 인젝션 표면이 아니다.
- **하드코딩된 시크릿**: 없음. 신규 diff 어디에도 API 키·비밀번호·토큰·인증서 리터럴 없음. (과거 라운드 리뷰가 언급한 `chat-channel.dispatcher.spec.ts` 의 `'SECRET SYSTEM PROMPT'` 는 이번 diff 범위 밖의 기존 코드이며, "유출되지 않는지" 를 검증하는 더미 fixture다.)
- **인증/인가**: 변경 없음. `computeChainDepth`/`admitExecutionOrDefer`/`updateExecutionStatus`/`lockNonTerminalExecutionRow` 는 모두 이미 인가된 컨텍스트(컨트롤러 레벨에서 워크스페이스 소유권 검증 이후) 내부에서 호출되는 private 헬퍼이고, 이번 가드는 그 호출 경로나 권한 검사 로직을 건드리지 않는다. `SNAPSHOT_CACHE_MAX_ENTRIES` export 확대는 상수 가시성만 넓히며 캐시 키 구조·workspace 격리 로직은 불변.
- **입력 검증**: 이번 변경 자체가 입력(드라이버 반환 shape) 검증을 **강화**하는 방향이다. 특히 `computeChainDepth` 가드는 `rows`가 배열이 아닐 때 `rows[0] ?? 1` 로 조용히 depth 1 을 반환해 `depth >= RERUN_CHAIN_DEPTH_LIMIT` 검사를 우회시키던 **fail-open 경로를 닫는다** — RR-PL-05(rerun 체인 깊이 제한, 무한/과도한 rerun 체인을 통한 자원 고갈 방지 성격의 제약)가 조용히 무력화될 수 있었던 지점을 fail-closed 로 전환한 점은 긍정적 보안 개선으로 평가한다.
- **OWASP Top 10**: 해당 없음. A05(Security Misconfiguration)·A08(Software and Data Integrity Failures) 관점에서도 이번 가드는 "검증되지 않은 가정(제네릭 타입 단언)에 의존하던 무결성 취약 지점"을 명시적 런타임 검증으로 바꾸는 방향이라 개선에 해당한다.
- **암호화/평문 전송**: 해당 없음. 신규 네트워크 통신·저장 암호화 관련 변경 없음.
- **에러 처리(정보 노출, CWE-209)**: 신규 `throw new Error(...)` 4곳 모두 `executionId`(이미 호출자가 알고 있는 리소스 ID, 워크스페이스 스코프 내 비-시크릿)와 `typeof <value>`(런타임 타입 이름, 예: `"undefined"`)만 메시지에 담는다. 이 예외들은 애플리케이션 서비스 계층(BullMQ consumer/큐 처리 경로) 안에서 발생하며, HTTP 경계에 닿는 지점은 `codebase/backend/src/common/filters/http-exception.filter.ts` 의 `GlobalExceptionFilter` 다 — 이 필터는 `HttpException` 이 아닌 일반 `Error` 를 `logger.error(exception.message, exception.stack)` 로만 서버 로그에 남기고, 클라이언트에는 고정 문구 `"An unexpected error occurred. Please try again later."` 만 반환한다(코드 내 명시적 CWE-209 주석 확인). 즉 이번에 추가된 진단 메시지가 클라이언트로 echo 될 경로가 없다. `computeChainDepth`는 `ExecutionsService.reRun()` 경유로 컨트롤러까지 연결되지만 동일 필터가 적용되므로 마찬가지로 마스킹된다.
- **의존성 보안**: 신규/변경된 외부 의존성 없음. `Array.isArray` 는 언어 내장.

## 요약

이번 diff 는 `EntityManager.query()`/`createQueryBuilder().getRawMany()` 류 호출의 선언 타입(`Promise<any>`)이 실제 런타임 shape 을 보장하지 않는다는 전제 하에, admission/락/상태갱신/체인깊이 네 지점에 `Array.isArray` 방어 가드를 추가하고 그에 대응하는 회귀 테스트를 붙인 방어적 하드닝이다. 신규 인젝션·인가 우회·시크릿 노출·안전하지 않은 암호화 표면은 없으며, 신규 에러 메시지는 HTTP 경계의 `GlobalExceptionFilter` 가 일괄 마스킹해 CWE-209 노출 경로도 없다. 오히려 `computeChainDepth` 가드는 종전에 존재하던 잠재적 fail-open(체인 깊이 제한 우회) 지점을 fail-closed 로 닫아 보안 견고성을 높이는 방향이다. `runExecutionFromQueue` 의 admission try/catch + routing release 는 가용성/일관성(다른 reviewer 의 side_effect·testing 관점) 이슈이지 기밀성·인가 문제는 아니다.

## 위험도

NONE
