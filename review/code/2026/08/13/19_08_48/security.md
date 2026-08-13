# Security Review — assertRowArray 하드닝 + snapshotCache/rerun 테스트 보강 + plan/review 문서

## 대상 요약

`git diff origin/main...HEAD -- codebase/` 로 실제 소스 변경을 직접 대조했다. 실질 프로덕션
코드 변경은 3개 파일뿐이다:

- `codebase/backend/src/common/utils/assert-row-array.ts` (신규) — `assertRowArray(rows, detail): asserts rows is unknown[]`. `Array.isArray` 가 아니면 `detail` 을 포함한 `Error` 를 던진다.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `admitExecutionOrDefer`(admission UPDATE), `lockNonTerminalExecutionRow`(FOR UPDATE SELECT), `updateExecutionStatus`(guarded UPDATE) 세 지점에 `assertRowArray` 적용 + `runExecutionFromQueue` 의 admission 호출을 `try/catch` 로 감싸 throw 시 `releaseExecutionRouting` 후 재전파.
- `codebase/backend/src/modules/executions/executions.service.ts` — `computeChainDepth`(재귀 CTE) 에 동일 가드 적용, `SNAPSHOT_CACHE_MAX_ENTRIES` 를 `export` 로 가시성 확대(값 256 불변).

나머지는 전부 테스트 파일(`assert-row-array.spec.ts`, `chat-channel.dispatcher.spec.ts`,
`execution-engine.service.spec.ts`, `executions-rerun.service.spec.ts`,
`executions.service.spec.ts`) 및 `plan/**`·`review/**` 문서(이전 리뷰/일관성-체크 라운드
산출물 기록)다.

## 발견사항

없음 — CRITICAL/WARNING 급 보안 결함을 발견하지 못했다.

### 점검한 보안 관점

- **인젝션**: 신규 SQL/커맨드/경로 조합 없음. `computeChainDepth`(`` `... WHERE id = $1 ...` `` 등 파라미터 바인딩), admission UPDATE(`$1..$5` 바인딩), `lockNonTerminalExecutionRow`(`FOR UPDATE` + 파라미터 바인딩)는 이번 diff 대상이 아니고 쿼리 문자열 자체는 불변이다. 신규 `assertRowArray` 의 `Error` 메시지(`detail` 문자열)는 호출부가 리터럴/템플릿으로 넘기는 진단 문구일 뿐 SQL·쉘·파일경로로 재사용되지 않는다. `assert-row-array.spec.ts` 의 신규 정규식(`CONSUMING_QUERY`)은 이 저장소가 소유한 고정 소스 파일 2개(`FILES` 배열)에만 정적으로 적용되는 테스트-시점 코드로, 사용자 입력을 다루지 않아 ReDoS/경로 탐색 표면이 아니다.
- **하드코딩된 시크릿**: 신규 diff 어디에도 API 키·비밀번호·토큰·인증서 리터럴 없음. `chat-channel.dispatcher.spec.ts:534` 의 `'SECRET SYSTEM PROMPT'` 는 `git diff` 로 직접 대조한 결과 이번 diff 범위 밖(hunk 시작이 `@@ -699,50 +700,163 @@`)의 기존·비변경 코드이며, "시스템 프롬프트가 outbound 이벤트로 새어나가지 않는지" 검증하는 회귀 테스트용 더미 값이다.
- **인증/인가**: `executions.controller.ts`/`execution-engine` 호출 경로 자체는 변경되지 않았다. `computeChainDepth`/`admitExecutionOrDefer`/`updateExecutionStatus`/`lockNonTerminalExecutionRow` 는 모두 이미 인가 컨텍스트 내부(컨트롤러 레벨 workspace 소유권 검증 이후)에서 호출되는 private 헬퍼이고, 이번 가드는 권한 검사 로직을 건드리지 않는다. `SNAPSHOT_CACHE_MAX_ENTRIES` export 확대는 상수 가시성만 넓히고 캐시 키(execution UUID)·workspace 격리 로직·eviction 은 불변이다.
- **입력 검증**: 이번 변경 자체가 DB 드라이버 반환 shape 검증을 **강화**하는 방향이다. 특히 `computeChainDepth` 가드는 `rows` 가 배열이 아닐 때 `rows[0] ?? 1` 로 조용히 depth 1 을 반환해 `depth >= RERUN_CHAIN_DEPTH_LIMIT` 검사를 우회시키던 fail-open 경로를 닫는다(RR-PL-05 재실행 체인 깊이 제한). 다만 이 경로는 사용자 입력이 아니라 pg 드라이버가 `Promise<any>` 계약을 어길 때만 도달하는 방어적 코드라 실제 공격 표면이라기보다 견고성 개선이다.
- **OWASP Top 10**: 해당 없음. A03(Injection)·A01(Broken Access Control) 관점에서 신규 표면 없음.
- **암호화/평문 전송**: 해당 없음. 신규 네트워크 통신·저장 암호화 관련 변경 없음.
- **에러 처리(정보 노출, CWE-209)**: 신규 `throw new Error(...)` 4곳(`admitExecutionOrDefer`, `lockNonTerminalExecutionRow`, `updateExecutionStatus`, `computeChainDepth`) 모두 `executionId`(호출자가 이미 아는 리소스 UUID)와 `typeof <value>`(런타임 타입 이름)만 메시지에 담는다. `codebase/backend/src/common/filters/http-exception.filter.ts` 의 `GlobalExceptionFilter` 를 직접 열어 확인했다 — `HttpException` 이 아닌 일반 `Error` 는 `logger.error(exception.message, exception.stack)` 로 서버 로그에만 남기고, 클라이언트에는 `GlobalExceptionFilter.UNHANDLED_ERROR_MESSAGE`(고정 문구) 만 반환한다. `computeChainDepth` → `reRun()` → `executions.controller.ts:284` 경로도 별도 try/catch 로 원문을 echo 하지 않고 그대로 전파되므로 동일 필터가 적용된다. admission/lock/status 세 지점은 BullMQ 워커(`runExecutionFromQueue`) 경로라 애초에 HTTP 응답과 무관하다. 즉 신규 진단 메시지가 클라이언트로 노출될 경로는 없다.
- **의존성 보안**: 신규/변경된 외부 의존성 없음. `Array.isArray` 는 언어 내장.

### 참고 — plan/review 문서 파일

`plan/in-progress/*.md`, `review/code/2026/08/13/{14_01_46,17_15_21,18_00_11,18_19_33,18_38_10}/**`,
`review/consistency/2026/08/13/{14_18_42,17_05_10,18_50_06}/**` 는 전부 마크다운 문서(이전
코드 리뷰/일관성 검토 라운드의 기록물)이며 실행되는 코드가 아니다. `git diff origin/main...HEAD | grep -iE "password|api[_-]?key|secret|token"` 로 전체 diff 를 훑었고, 위 `'SECRET SYSTEM PROMPT'` 인용(모두 "실제 시크릿이 아니라 더미 fixture" 라는 서술)을 제외하면 자격증명·API 키·토큰 형태의 신규 리터럴은 없다.

## 요약

이번 diff 의 실질 프로덕션 변경은 `EntityManager.query()`(선언 타입 `Promise<any>`)의 반환값이
실제로 배열인지를 런타임에 확정하는 `assertRowArray` 헬퍼를 신설하고, 이를 raw SQL 소비 지점
4곳(`admitExecutionOrDefer`, `lockNonTerminalExecutionRow`, `updateExecutionStatus`,
`computeChainDepth`)에 배선한 방어적 하드닝과, 그 배선 누락 자체를 정적 카운트로 잡는 회귀
테스트다. 새 SQL/커맨드/경로 조합이 없고 모든 쿼리는 파라미터 바인딩을 그대로 유지하며,
하드코딩된 시크릿·인증/인가 우회·안전하지 않은 암호화는 발견되지 않았다. 신규 에러 메시지는
execution UUID 와 `typeof` 값만 담고 `GlobalExceptionFilter` 가 HTTP 경계에서 일괄 마스킹해
CWE-209 노출 경로도 없다. 오히려 `computeChainDepth` 가드는 종전에 존재하던 잠재적 fail-open
(RR-PL-05 체인 깊이 제한 우회) 지점을 fail-closed 로 전환해 보안 견고성을 높이는 방향이며,
`admission` throw 시 routing context 를 release 하도록 고친 것도 가용성 개선이지 기밀성/인가
문제는 아니다. 이전 4차례 리뷰 라운드(`14_01_46`→`17_15_21`→`18_00_11`→`18_19_33`→`18_38_10`)
가 모두 security 관점 NONE 으로 판정했고, 이번 재검증(전체 소스 diff 를 `git diff` 로 직접
대조)도 동일한 결론이다.

## 위험도

NONE
