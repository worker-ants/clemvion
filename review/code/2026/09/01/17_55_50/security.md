# 보안(Security) 코드 리뷰

## 검토 범위

- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/entities/execution.entity.ts`
- `plan/in-progress/ie-resume-turn-boundary-cancel.md`, `plan/in-progress/retry-turn-terminal-guard.md` (문서, 코드 아님)

전반적으로 이번 변경은 취소(cancel)/retry 종결 경로의 **관측성·정합성 잔여 결함**을 닫는
방어적 리팩터(원자 UPDATE 재검증, 반환값 소비, `error` 컬럼 명시적 초기화, zombie-row
헬퍼 추출)이며, 인증/인가·인젝션·시크릿 취급을 바꾸는 표면은 없다.

## 발견사항

- **[INFO]** 내부 DB 예외 메시지를 서버 로그에 그대로 삽입
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:426-431` (`assertLinkedTransitionApplied` catch 블록)
  - 상세: `markNodeCancelled` 가 reject 되면 `err.message` 를 그대로 템플릿 문자열에 이어붙여
    `this.logger.error(...)` 로 남긴다. 이 값이 클라이언트로 나가지는 않으므로(로그 전용) 직접적인
    정보노출 취약점은 아니지만, 드라이버(pg 등)의 제약조건 위반 메시지에는 종종 실제 컬럼 값이
    포함될 수 있어 로그 파이프라인이 외부로 export 되거나 낮은 권한자가 로그를 볼 수 있는 환경이면
    간접적 데이터 노출 경로가 될 수 있다. `retry-turn.service.ts` 의 `failRetryExecution`
    (`errMessage` → `execution.error` → `toTerminalErrorPayload` → WS `failed` 이벤트, 이 diff
    밖의 기존 코드)도 같은 패턴을 이미 갖고 있어 이번 변경이 새로 도입한 위험 등급은 아니다.
  - 제안: 로그 싱크에 대한 접근 통제가 이미 있다면 조치 불요. 신규가 아니므로 이번 PR 스코프에서
    조치할 필요는 없다고 판단하며 참고용으로만 기록한다.

- **[INFO]** try/catch 가 `markNodeCancelled` 실패를 관측만 하고 전파하지 않음(의도적 설계)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-432`
  - 상세: 마킹 실패 시 원본 예외를 삼키고 `ExecutionCancelledError` 로만 종결한다. 짝
    `NodeExecution` 이 non-terminal 로 잔류할 수 있음을 로그로만 남긴다. 코드 내 주석이 이 트레이드
    오프(취소 **분류**를 실패로 오염시키지 않기 위함, 감사 로깅 실패와 동일한 판단)를 명시하고
    있고, 보안 관점에서 인가 우회나 상태 위조로 이어지는 경로는 아니다 — 최종 사용자에게 노출되는
    분류(CANCELLED)는 실제 DB 정본 상태와 일치한다. 취약점 아님, 정보 목적으로만 기록.

- **[INFO]** `execution.entity.ts` `error` 컬럼 타입 정정
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:81`
  - 상세: `Record<string, unknown>` → `Record<string, unknown> | null` 로 타입만 DB 스키마
    (`nullable: true`)에 맞게 수정됐다. 런타임 검증·직렬화 로직 변경 없음, 보안 영향 없음.

## 확인한 항목 (문제 없음)

- **SQL 인젝션**: `retry-turn.service.ts` 의 원자 consume/claim UPDATE 는
  `RETRY_STATE_KEY`(`'_retryState'`) 상수 리터럴만 문자열 보간하고, `id`/`status` 등 가변 값은
  전부 TypeORM 파라미터 바인딩(`.where('id = :id', { id })`)을 사용한다. 사용자 입력이 SQL
  문자열에 직접 연결되는 경로는 이번 diff 에 없다(테스트 파일이 `set`/`andWhere` 인자를 캡처하도록
  바뀐 것은 검증 강화이며 production SQL 조립 로직 자체는 diff 밖).
- **하드코딩된 시크릿**: 신규 코드에 API 키·비밀번호·토큰 없음.
- **인증/인가**: 신규 엔드포인트·권한 검사 로직 변경 없음. 내부 서비스 메서드 간 리팩터.
- **에러 메시지 노출**: WS `failed` 이벤트에 실리는 `execution.error` 값은 이번 diff 가 아니라
  기존 코드(`toTerminalErrorPayload`)가 관리하며, 오히려 이번 변경(`prepareSuccessTermination`
  이 성공 종결 시 `execution.error = null` 로 명시 초기화)은 **이전 시도의 스테일 에러 메시지가
  COMPLETED 레코드에 잔류해 노출되던 문제를 닫는 개선**이다.
- **동시성/무결성**: `markSpawnedRowFailed`/`prepareSuccessTermination` 추출은 순수 리팩터로
  동작 변경 없음. `execution-engine.service.ts` 의 timeout catch 가 `updateExecutionStatus`
  반환값을 소비하도록 바뀐 것은 관측성 개선(동시 cancel 선점을 로그로 드러냄)이며 새로운 권한
  우회나 데이터 노출을 만들지 않는다.
- **의존성 보안**: 신규 라이브러리 도입 없음.
- **plan/*.md 문서**: 코드가 아니며 시크릿·자격증명 포함 없음.

## 요약

이번 변경은 실행 엔진의 취소(cancel)/retry 종결 경로에서 잔존하던 관측성·정합성 결함을 닫는
방어적 리팩터로, 인증/인가·인젝션·시크릿 취급 표면을 넓히지 않는다. SQL 은 여전히 상수 키
리터럴 + 파라미터 바인딩 조합이라 인젝션 경로가 없고, `error` 컬럼을 성공 종결 시 명시적으로
비우는 변경은 오히려 스테일 에러 노출을 줄이는 방향이다. 발견된 항목은 전부 INFO 등급이며
기존 패턴의 연장선이라 이번 PR 의 신규 위험으로 보지 않는다.

## 위험도

NONE
