# Security Review — `assertRowArray` 하드닝 4곳 + 회귀 테스트 + review/plan 문서

## 리뷰 범위

`git diff origin/main...HEAD -- codebase/ plan/` 기준 실질 변경 10파일(+632/-56):

- `codebase/backend/src/common/utils/assert-row-array.ts` (신규) / `.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts`
- `plan/in-progress/backend-lint-gate-broken-on-main.md`,
  `plan/in-progress/spec-draft-eia-notification-payload-contract.md`

프롬프트에 포함된 나머지 다수 파일(`review/code/**/*.md`, `review/consistency/**/*.md`)은 이전
리뷰 세션의 산출물(RESOLUTION/SUMMARY/security.md 등)이 신규로 커밋되는 문서이며, 코드가 아니라
그 자체로 보안 표면을 만들지 않는다 — 하드코딩 시크릿·토큰·인젝션 패턴 유무만 grep 으로 전수
확인했고 발견 없음(`SECRET SYSTEM PROMPT` 는 `chat-channel.dispatcher.spec.ts:534` 의 기존(비변경)
테스트 픽스처로, 유출 방지를 검증하는 더미 값이며 이번 diff 대상도 아니다).

## 발견사항

없음 (Critical/Warning 없음).

### 점검한 보안 관점

1. **인젝션**: `computeChainDepth`(재귀 CTE)·admission UPDATE·`lockNonTerminalExecutionRow`
   SELECT·`updateExecutionStatus` UPDATE 모두 `$1`/`$2` 파라미터 바인딩만 사용하고, 이번 diff 는
   SQL 문자열 자체를 건드리지 않았다(신규 `assertRowArray` 호출은 실행 *후* 반환값 shape 만 검사).
   커맨드/경로/LDAP 인젝션 표면 없음.
2. **하드코딩 시크릿**: 신규/변경 코드에 API 키·비밀번호·토큰 리터럴 없음. `TOKEN_NAME:` 은 에러
   코드 접두 상수명일 뿐 실제 토큰이 아님.
3. **인증/인가**: 이번 diff 는 인증/인가 로직을 변경하지 않는다. `reRun` 의 workspace 격리·
   owner/admin 검증(RR-PL-06)은 그대로다. 오히려 `computeChainDepth` 가드는 인가와 인접한
   레이트리밋성 불변식(RR-PL-05 체인 깊이 제한)의 **fail-open 우회 가능성을 닫는** 방향이다
   (아래 상세).
4. **입력 검증**: 이 diff 의 핵심이 바로 입력(정확히는 `EntityManager.query()`/`Repository.query()`
   반환값, 선언 타입은 `Promise<any>`) 검증 강화다. `assertRowArray()` 는 `.length`/`[0]` 접근
   **전에** `Array.isArray()` 로 shape 을 확정하고, 실패 시 컨텍스트가 담긴 `Error` 를 던진다.
   4개 호출부(`execution-engine.service.ts` 3곳, `executions.service.ts` 1곳)를 실제 소스에서
   대조 확인했다.
   - `computeChainDepth`(`executions.service.ts:304-332`) — 가드 이전에는 배열이 아니면
     `rows[0]?.depth ?? 1` 로 조용히 **depth 1** 이 되어 호출부 `depth >= RERUN_CHAIN_DEPTH_LIMIT`
     검사를 통과, **RR-PL-05 재실행 체인 깊이 제한이 fail-open 으로 우회**될 수 있었다(무한 재실행
     체인을 통한 리소스 소모/남용에 대한 방어가 무력화). 이번 가드는 이 자리를 throw(fail-closed)
     로 바꿔 실질적으로 보안 하드닝이다.
   - `admitExecutionOrDefer`/`lockNonTerminalExecutionRow`/`updateExecutionStatus`
     (`execution-engine.service.ts`) — 나머지 세 자리는 정확성/가용성(트랜잭션 롤백 보존, 종결
     이벤트 유실 방지) 문제이지 인가 우회는 아니지만, 동일한 원칙(드라이버 반환 shape 을 신뢰하지
     않고 명시 검증)을 일관되게 적용했다.
5. **OWASP Top 10**: A03(Injection) 해당 없음(위 1항). A05(Security Misconfiguration)/A08(Software
   and Data Integrity Failures) 관점에서 이번 변경은 "타입 단언은 검증이 아니다" 라는 구체적
   실패 사례에 대한 런타임 무결성 검증 추가로, 오히려 A08 방향의 하드닝.
6. **암호화**: 해당 없음(평문 전송/해시 알고리즘 변경 없음).
7. **에러 처리**: `assertRowArray` 가 던지는 `Error` 메시지는 `computeChainDepth 재귀 CTE, execution
   ${executionId}...` 처럼 내부 컨텍스트(실행 ID, 우회 시 영향)를 담는다. 이 메시지가 클라이언트로
   그대로 노출되는지 `codebase/backend/src/common/filters/http-exception.filter.ts` 를 직접 열어
   확인했다: `assertRowArray` 가 던지는 값은 plain `Error`(HttpException 아님)이고, 이 필터의
   `exception instanceof Error` 분기는 `mapHttpErrorLike`(4xx http-error-like 만 인식)에 안 걸리는
   내부 오류를 `logger.error(exception.message, exception.stack)` 로 서버 로그에만 남기고, 클라이언트
   응답은 고정 문구 `'An unexpected error occurred. Please try again later.'` 로 마스킹한다(CWE-209
   방지 설계, 이 필터 자체는 이번 diff 대상 아님·기존 구현). 즉 새로 추가된 상세 에러 메시지가
   HTTP 응답으로 유출되지 않는다.
8. **의존성 보안**: 신규/변경 의존성 없음(`fs`/`path`는 신규 테스트 파일이 Node 표준 라이브러리로
   같은 리포 내 소스 파일을 정적 텍스트로 읽어 정규식 카운트만 하는 용도 — 외부 입력 아님, 경로
   탐색 표면 없음).

### 참고 (비-Critical, 타 리뷰 축과 중복이므로 INFO 로만 기록)

- `admitExecutionOrDefer` 가 throw 하는 새 경로에서 `runExecutionFromQueue` 가 `try/catch` 로 감싸
  `releaseExecutionRouting` 을 호출한 뒤 재전파하도록 바뀌었다(diff 확인). 이는 in-memory routing
  map 잔류를 막는 자원 누수/가용성 보정이며 별도 인가 우회는 아니다 — side_effect 관점 중복이라
  security 발견사항으로는 카운트하지 않는다.

## 요약

이번 diff 는 raw SQL 쿼리 반환값(`Promise<any>`)에 대한 타입 단언이 런타임을 검증하지 않는다는
구체적 결함을 `assertRowArray` 런타임 가드로 막는 방어적 하드닝이며, 그중 `computeChainDepth`
지점은 이전에 재실행 체인 깊이 제한(RR-PL-05)이 fail-open 으로 조용히 우회될 수 있던 경로를
throw(fail-closed)로 닫아 실질적인 보안 개선에 해당한다. 새 SQL 인젝션·하드코딩 시크릿·인증/인가
우회·평문 전송·의존성 취약점은 발견되지 않았고, 신규 에러 메시지에 담긴 내부 컨텍스트(실행 ID 등)는
기존 `GlobalExceptionFilter` 가 클라이언트에는 일반 문구만 반환하고 상세는 서버 로그로만 남기도록
설계돼 있어 정보 노출 위험도 없다. 나머지 파일(plan 문서, 이전 리뷰 세션 산출물 markdown)은 코드가
아니며 시크릿·토큰 패턴 grep 전수 확인 결과 이상 없음.

## 위험도

NONE
