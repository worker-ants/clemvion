# 보안(Security) 코드 리뷰

## 검토 범위 및 방법

이번 라운드(`18_30_55`)는 `origin/main...HEAD` 누적 diff(39개 파일, 커밋 `59dd12869` → `15374b657`
→ `91c817608` 3개)를 대상으로 한다. 실제 프로덕션 코드가 있는 파일은:

- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/entities/execution.entity.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` (JSDoc-only)

나머지(`CHANGELOG.md`, `plan/in-progress/*.md`, `review/code/2026/09/01/{17_55_50,18_13_45}/*`)는
문서/리뷰 산출물이며 코드가 아니다.

`git log --oneline`으로 이 changeset 을 구성하는 3개 커밋을 확인하고, 최신 커밋(`91c817608`,
이번 라운드가 새로 반영하는 부분)의 실제 코드 diff 를 별도로 열어 대조했다 — 실질 변경은
`ai-turn-orchestrator.service.ts`(JSDoc 4줄 추가), `ai-turn-orchestrator.service.spec.ts`(로그
`phase` 페이로드 단언 1건 추가), `retry-turn.service.ts`(`@param spawnedRow` JSDoc 1줄 추가)뿐이며
전부 문서·테스트 보강이다. 앞선 두 라운드(`17_55_50`, `18_13_45`)가 이미 이 changeset 의 핵심
코드 표면(취소 마킹 실패 흡수, `updateExecutionStatus` 반환값 로깅, `error` 컬럼 초기화 헬퍼
추출, 엔티티 타입 정정)을 각각 독립적으로 검토해 둘 다 위험도 **NONE** 으로 판정했다. 저장소
트리는 뮤테이션하지 않았다(읽기 전용 `grep`/`Read`/`git show`만 수행) — `git status --short` 확인
불필요.

## 발견사항

- **[INFO]** 내부 예외 메시지를 서버 로그에 그대로 삽입 (기존에 이미 2회 지적된 패턴, 신규 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:430-435`
    (`assertLinkedTransitionApplied` 의 `catch (err) { this.logger.error(...) }` 블록,
    `error=${err instanceof Error ? err.message : String(err)}`)
  - 상세: `markNodeCancelled` 가 reject 되면 원본 예외 메시지를 그대로 템플릿 문자열에 이어붙여
    서버 로그로만 남긴다. 클라이언트로 전달되는 값이 아니므로 직접적인 정보 노출 취약점은
    아니며, 로그 파이프라인 접근 통제가 이미 있다면 조치 불요다. `retry-turn.service.ts` 의
    `failRetryExecution` 도 이미 같은 패턴을 갖고 있어 이번 changeset 이 새로 도입한 위험
    등급은 아니다.
  - 제안: 조치 불요(로그 싱크 접근 통제 전제). 신규 발견 아님.

## 확인한 항목 (문제 없음)

- **SQL 인젝션**: `retry-turn.service.ts` 의 원자 consume/claim UPDATE 를 실제 파일에서
  직접 `grep -n "RETRY_STATE_KEY"` 로 확인했다 — `jsonb_exists(output_data, '${RETRY_STATE_KEY}')`
  (`:228`), `output_data - '${RETRY_STATE_KEY}'`(`:221`), `input_data - '${RETRY_STATE_KEY}'`
  (`:544`), `jsonb_exists(input_data, '${RETRY_STATE_KEY}')`(`:549`) 전부 모듈 최상단
  `const RETRY_STATE_KEY = '_retryState';`(`:45`, 컴파일 타임 문자열 리터럴)만 보간하며, 사용자
  입력이나 가변 값이 이 문자열 보간에 섞이는 경로는 없다. `id`/`status` 등 가변 값은 전부
  TypeORM 파라미터 바인딩(`.where('id = :id', { id })`)을 사용한다.
- **하드코딩된 시크릿**: `git diff origin/main...HEAD -- CHANGELOG.md 'codebase/**' 'plan/**'
  'review/**'` 전체를 `password|secret|api[_-]?key|token|bearer|credential|private[_-]?key|
  BEGIN (RSA|EC|OPENSSH|PRIVATE)|aws_access|AKIA[0-9A-Z]{16}` 패턴으로 직접 스캔 — 매치되는
  두 줄은 전부 `review/code/2026/09/01/18_13_45/security.md` 안에서 "이런 패턴으로 grep 했다"고
  **서술하는 텍스트 자체**이며 실제 시크릿·자격증명 값은 없다.
- **인증/인가**: 신규 엔드포인트·권한 검사 로직 변경 없음. 전부 서비스 내부 private 메서드
  리팩터·로깅 추가·타입 정정.
- **입력 검증**: 사용자 입력을 받는 신규 표면 없음(내부 종결 경로의 in-process 상태 전이만
  다룬다).
- **에러 메시지 노출(egress)**: WS `failed` 이벤트에 실리는 `execution.error` 값은 기존
  `toTerminalErrorPayload` 가 관리하며 이 diff 는 그 로직을 바꾸지 않는다. 오히려
  `prepareSuccessTermination` 이 성공 종결 시 `execution.error = null` 을 명시적으로 세팅하는
  것은 **이전 시도의 스테일 에러 메시지가 COMPLETED 레코드에 잔류해 조회/알람에 노출되던
  결함을 닫는 개선**이다.
- **동시성/무결성**: `markSpawnedRowFailed`/`prepareSuccessTermination` 추출은 순수 리팩터,
  `executeSync` timeout catch 의 `persisted` 반환값 소비는 관측성 추가일 뿐 제어 흐름·락 로직을
  바꾸지 않는다(뒤이은 `throw err;` 는 반환값과 무관하게 항상 실행). 새로운 권한 우회·데이터
  노출 경로 없음.
- **암호화**: 해시/암호화 로직에 대한 변경 없음, 평문 전송 관련 변경 없음.
- **의존성 보안**: 신규 라이브러리/패키지 도입 없음(`package.json` 등 변경분 없음).
- **`review/code/2026/09/01/{17_55_50,18_13_45}/*` 신규 파일**: 리뷰 산출물이며 코드가 아니다.
  위 grep 스캔으로 시크릿·자격증명 부재 확인.
- **`Execution.error` 엔티티 타입 정정**(`execution.entity.ts:81`, `Record<string, unknown>` →
  `Record<string, unknown> | null`): DB 컬럼(`nullable: true`)은 애초에 nullable 이었고 타입만
  뒤늦게 맞춘 것 — 마이그레이션·직렬화·보안 영향 없음.

## 요약

이번 라운드의 실제 코드 델타(최신 커밋 `91c817608`)는 JSDoc·테스트 단언 보강뿐이며, 이 changeset
전체(3개 커밋 누적)의 핵심 보안 관련 표면 — SQL 조립(상수 리터럴 + 파라미터 바인딩), 시크릿
취급, 인증/인가, 에러 메시지 egress — 은 앞선 두 라운드가 이미 독립적으로 확인한 대로 변화가
없다. 직접 재실측한 결과도 동일하다: `RETRY_STATE_KEY` 는 하드코딩된 상수 리터럴만 SQL 문자열에
보간하고, diff 전체에서 하드코딩된 시크릿·자격증명은 발견되지 않았으며, 인증/인가·암호화 로직
변경도 없다. 유일한 기존 관찰(내부 DB 예외 메시지를 서버 로그에 삽입)은 이전 두 라운드가 이미
INFO 로 등재한 것과 동일한 패턴으로, 이번 diff 가 새로 만든 위험이 아니다. `error` 컬럼을 성공
종결 시 명시적으로 비우는 변경은 오히려 스테일 에러 잔류로 인한 정보 노출 성격의 결함을 닫는
개선이다. 신규 CRITICAL/WARNING 급 보안 결함은 발견하지 못했다.

## 위험도

NONE
