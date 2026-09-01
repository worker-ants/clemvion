# 보안(Security) 코드 리뷰

## 검토 범위

- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/entities/execution.entity.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` (JSDoc-only)
- `CHANGELOG.md`, `plan/in-progress/ie-resume-turn-boundary-cancel.md`, `plan/in-progress/retry-turn-terminal-guard.md` (문서, 코드 아님)
- `review/code/2026/09/01/17_55_50/*` (직전 라운드 리뷰 산출물 — 이번 changeset 에 신규 파일로 포함됨)

이번 changeset 은 두 커밋(`59dd12869` 원 수정 + `15374b657` 그 리뷰의 WARNING 5건 fix)의 누적
diff다. `59dd12869` 는 취소(cancel)/retry 종결 경로의 관측성·정합성 잔여 결함을 닫는 방어적
리팩터(원자 UPDATE 재검증, `updateExecutionStatus` 반환값 소비, `error` 컬럼 명시적 초기화,
zombie-row 헬퍼 추출, `markNodeCancelled` reject 흡수)이고, `15374b657` 는 그 결과물의 JSDoc
오귀속 정정·관측 로그 2건에 대한 스파이 단언 추가·CHANGELOG 보강이다. 두 커밋 모두 인증/인가·
인젝션·시크릿 취급을 바꾸는 표면은 없다. 본 라운드는 동일 diff 를 이미 한 차례(`17_55_50`
세션) 검토했던 것과 실질적으로 같은 코드 표면이며, 후속 커밋이 추가한 것은 테스트 단언과 문서
정정뿐이라 보안 판정에 영향을 주는 신규 변경은 없다.

## 발견사항

- **[INFO]** 내부 DB 예외 메시지를 서버 로그에 그대로 삽입
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` — `assertLinkedTransitionApplied` catch 블록 (`this.logger.error(...err instanceof Error ? err.message : String(err)...)`)
  - 상세: `markNodeCancelled` 가 reject 되면 `err.message` 를 그대로 템플릿 문자열에 이어붙여
    로그로 남긴다. 클라이언트로 나가는 값이 아니므로 직접적인 정보노출 취약점은 아니지만,
    드라이버(pg 등)의 제약조건 위반 메시지에는 실제 컬럼 값이 포함될 수 있어 로그 파이프라인이
    외부로 export 되거나 낮은 권한자가 로그를 볼 수 있는 환경이면 간접적 데이터 노출 경로가 될
    수 있다. `retry-turn.service.ts` 의 `failRetryExecution` 도 이미 같은 패턴을 갖고 있어 이번
    변경이 새로 도입한 위험 등급은 아니다. `15374b657` 이 이 로그에 스파이 단언(`errorSpy`)을
    추가해 페이로드(`nodeExec.id` · 원본 에러 메시지)가 유지되는지 회귀 고정한 것은 보안 성격의
    변경이 아니라 관측성 테스트 보강이다.
  - 제안: 로그 싱크에 대한 접근 통제가 이미 있다면 조치 불요.

- **[INFO]** try/catch 가 `markNodeCancelled` 실패를 관측만 하고 전파하지 않음(의도적 설계)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` — 위와 동일 catch 블록
  - 상세: 마킹 실패 시 원본 예외를 삼키고 `ExecutionCancelledError` 로만 종결한다. 짝
    `NodeExecution` 이 non-terminal 로 잔류할 수 있음을 로그로만 남긴다. 최종 사용자에게 노출되는
    분류(CANCELLED)는 DB 정본 상태와 일치하며, 인가 우회나 상태 위조로 이어지는 경로는 아니다.
  - 제안: 조치 불요 (plan 에 이미 수용된 트레이드오프로 명시).

- **[INFO]** `execution.entity.ts` `error` 컬럼 타입 정정
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` (`error: Record<string, unknown> | null`)
  - 상세: `Record<string, unknown>` → `| null` 로 DB 스키마(`nullable: true`)에 맞춘 순수 타입
    정정. 런타임 검증·직렬화 로직 변경 없음, 보안 영향 없음.

## 확인한 항목 (문제 없음)

- **SQL 인젝션**: `retry-turn.service.ts` 의 원자 consume/claim UPDATE(`jsonb_exists(output_data, '${RETRY_STATE_KEY}')`, `output_data - '${RETRY_STATE_KEY}'`)는 코드 상수 `RETRY_STATE_KEY = '_retryState'`
  만 문자열 보간하고(이 diff 가 새로 만든 코드가 아니라 기존 로직 — 이번 diff 는 테스트에서
  `set`/`andWhere` 인자를 캡처해 검증을 강화했을 뿐), `id`/`status` 등 가변 값은 전부 TypeORM
  파라미터 바인딩(`.where('id = :id', { id })`)을 사용한다. 사용자 입력이 SQL 문자열에 직접
  연결되는 경로는 이번 diff 에 없다.
- **하드코딩된 시크릿**: 신규 코드·신규 테스트 픽스처에 API 키·비밀번호·토큰 없음. (테스트
  파일 안에 `Bearer sk-...`/`api_key=AKIA-...` 형태 문자열이 존재하나 전부 diff 밖의 기존
  egress-마스킹 테스트이며, 실제 자격증명이 아니라 마스킹 로직 검증용 픽스처다.)
- **인증/인가**: 신규 엔드포인트·권한 검사 로직 변경 없음. 서비스 내부 리팩터(private 헬퍼
  추출)와 로깅 추가뿐.
- **에러 메시지 노출**: WS `failed` 이벤트에 실리는 `execution.error` 값은 이번 diff 가 아니라
  기존 코드(`toTerminalErrorPayload`)가 관리한다. 오히려 `prepareSuccessTermination` 이 성공
  종결 시 `execution.error = null` 로 명시 초기화하는 것은 **이전 시도의 스테일 에러 메시지가
  COMPLETED 레코드에 잔류해 노출되던 문제를 닫는 개선**이다.
- **동시성/무결성**: `markSpawnedRowFailed`/`prepareSuccessTermination` 추출은 순수 리팩터로
  동작 변경 없음. `execution-engine.service.ts` timeout catch 가 `updateExecutionStatus` 반환값을
  소비하도록 바뀐 것은 관측성 개선(동시 cancel 선점을 로그로 드러냄)이며 새로운 권한 우회나
  데이터 노출을 만들지 않는다.
- **의존성 보안**: 신규 라이브러리 도입 없음.
- **`review/code/2026/09/01/17_55_50/*` 신규 파일**(RESOLUTION.md·SUMMARY.md·`_retry_state.json`·
  각 reviewer 리포트): 이전 라운드 리뷰 산출물이며 코드가 아니다. 시크릿·자격증명·개인정보
  패턴(`password|secret|api[_-]?key|token|bearer|credential|private[_-]?key`, PEM 헤더, AWS
  access-key 패턴) grep 결과 실제 자격증명 없음(테스트 목적 문자열/설명 텍스트만).
- **`plan/*.md`, `CHANGELOG.md` 문서**: 코드가 아니며 시크릿·자격증명 포함 없음.

## 뮤테이션/재현 검증

이번 라운드에서는 저장소 트리를 뮤테이션하지 않았다 — 정적 diff 분석(`git diff origin/main...HEAD`)과
grep 기반 시크릿 스캔만으로 판단이 충분했다(SQL 조립부의 상수 리터럴 여부는 `RETRY_STATE_KEY`
선언부를 직접 확인해 판정). `git status --short` 로 트리 무변경 확인함.

## 요약

이번 변경(두 커밋 누적)은 실행 엔진의 취소(cancel)/retry 종결 경로에서 잔존하던 관측성·정합성
결함을 닫는 방어적 리팩터와 그 리뷰 후속 수정으로, 인증/인가·인젝션·시크릿 취급 표면을 넓히지
않는다. SQL 은 여전히 상수 키 리터럴 + 파라미터 바인딩 조합이라 인젝션 경로가 없고, `error`
컬럼을 성공 종결 시 명시적으로 비우는 변경은 오히려 스테일 에러 노출을 줄이는 방향이다. 후속
커밋이 추가한 로그 스파이 단언·JSDoc 이동·CHANGELOG 보강도 보안 표면에 영향이 없다. 발견된
항목은 전부 INFO 등급이며 기존 패턴의 연장선이라 신규 위험으로 보지 않는다.

## 위험도

NONE
