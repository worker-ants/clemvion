# 요구사항(Requirement) 코드 리뷰

## 대상 및 방법

`backlog-final-three` 작업(선재 테스트 공백 3건 보강 + admission 가드)이 이전 두 라운드
(`14_01_46`, `17_15_21`)의 리뷰·RESOLUTION 을 거친 **최종 상태**를 다시 처음부터 실측했다.
실제 소스(`execution-engine.service.ts`, `executions.service.ts`, 각 `.spec.ts`)를 Read 로
직접 열어 `17_15_21/RESOLUTION.md` 가 주장하는 수정 내용과 line-level 로 대조하고, 관련
spec(`spec/5-system/4-execution-engine.md` §8, `spec/5-system/13-replay-rerun.md` §9.1,
`spec/5-system/14-external-interaction-api.md` §6)과의 정합성을 확인했다. 또한 대상 3개
spec 파일(`execution-engine.service.spec.ts`, `executions.service.spec.ts`,
`executions-rerun.service.spec.ts`, `chat-channel.dispatcher.spec.ts`)을 실제로 실행해
GREEN 을 재확인했다(재현, 신뢰 아님).

## 실측 검증 결과

- `pnpm --filter backend` 하위에서 개별 실행:
  - `execution-engine.service.spec.ts` → **444 passed** (RESOLUTION 이 주장한 수와 일치)
  - `executions.service.spec.ts` + `executions-rerun.service.spec.ts` → **45 passed**
  - `chat-channel.dispatcher.spec.ts` → **38 passed**
- `.query(` / `.query<` 로 반환값을 배열로 가정하는 지점을 두 파일 전체에서 grep 한 결과
  정확히 4곳(admission·`lockNonTerminalExecutionRow`·`updateExecutionStatus`·
  `computeChainDepth`)이고, **4곳 전부** `Array.isArray` 가드가 적용돼 있음을 확인했다
  (`execution-engine.service.ts:2936`, `:8206`, `:8524`, `executions.service.ts:324`).
- `runExecutionFromQueue` 의 `admitExecutionOrDefer` 호출이 `try/catch` 로 감싸져 있고,
  `catch` 블록이 `releaseExecutionRouting(executionId)` 호출 후 `throw err` 로 재전파함을
  확인했다(`execution-engine.service.ts:3679-3685`). 대응 테스트
  (`execution-engine.service.spec.ts:4922` `'admission 이 throw → routing release 후
  그대로 재전파 + runExecution 미호출'`)가 이 경로를 정확히 고정한다.
  `releaseExecutionRouting` 은 `Map.delete()` 기반(`websocket.service.ts:449-451`)이라
  등록되지 않은 executionId 에 호출해도 안전(no-op) — `triggerId` 없는 실행 경로에서
  routing 이 애초에 등록되지 않았어도 이 release 호출이 부작용을 일으키지 않는다.
- `computeChainDepth` 의 가드는 `spec/5-system/13-replay-rerun.md` §9.1 이 명시하는
  "chain 깊이 32 제한은 **애플리케이션 레벨**에서 enforce (`computeChainDepth`)" 요구와
  정확히 대응한다 — 가드가 없었다면(수정 전 상태) 드라이버가 배열이 아닌 값을 반환할 때
  `depth 1` 로 fallback 해 이 spec 조항이 실제로 우회될 수 있었다. 이번 diff 는 그 경로를
  명시적으로 닫아 spec 이 요구하는 enforce 를 강화한다.
- `updateExecutionStatus` 가드의 인라인 주석이 인용하는 "EIA §6 종결 이벤트 계약"은
  `spec/5-system/14-external-interaction-api.md` §6("API 명세 — Outbound Notification",
  종결 이벤트 필드 집합 정의)과 일치하는 인용이다.

## 발견사항

없음 (CRITICAL/WARNING 급).

- **[INFO]** `updateExecutionStatus` 의 신규 throw 는 애플리케이션 트랜잭션 **밖**의
  단일 raw UPDATE 다음에 위치하고, 이 메서드의 호출부 10곳 이상 중 특별히 이 예외를
  잡아 처리하는 곳은 없다(설계 의도상 상위 catch-all 로 자연 전파). 실제 도달 조건이
  "postgres 드라이버가 계약을 어긴다"는 사실상 불가능한 경우로 한정되므로 심각도는
  낮지만, 향후 이 throw 가 어느 계층까지 전파되는지(예: BullMQ job 실패로 잡히는지,
  아니면 uncaught 로 프로세스에 영향을 주는지)를 문서화해두면 운영 대응이 빨라진다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8524`
    (`updateExecutionStatus` else 분기 가드)
  - 제안: 조치 불요. 참고용 관찰.
- **[INFO]** 이번 backlog 가 "sibling `.query()` 지점" 가드 적용 범위를 `execution-engine.service.ts`
  ·`executions.service.ts` 두 파일로 정확히 한정했다(`17_15_21/RESOLUTION.md` 의 grep 근거와
  일치). 저장소 전체에는 `RETURNING` 을 쓰는 다른 모듈(`auth-oauth.service.ts`,
  `integration-oauth.service.ts`, `knowledge-base.service.ts`, `agent-memory.service.ts`,
  `notifications.service.ts` 등)이 더 있으나, 이들은 이번 backlog 항목(admission 가드가
  스스로 제시한 "같은 파일 내 sibling")의 범위 밖이라 그대로 두는 것이 스코프 규율상
  타당하다 — 결함이 아니라 확인 사항.
  - 위치: (참고) `grep -rln RETURNING codebase/backend/src` 결과 다수
  - 제안: 조치 불요. 별도 backlog 필요 여부는 이번 diff 범위 밖 판단 사안.

## 요약

`17_15_21` 라운드가 지적한 WARNING 2건(admission 가드의 sibling 3곳 미적용, admission
throw 시 routing context 미해제)이 후속 커밋(`b3782f562`, `9e8d9c9a9`)에서 모두 실제
코드로 반영됐음을 소스 직접 대조로 재확인했다: 4개 `.query()` 지점 전부 `Array.isArray`
가드가 있고, 실패 방향을 각각 다르게(admission·`updateExecutionStatus`= throw 로 롤백/
관측화, `lockNonTerminalExecutionRow`= 이미 fail-closed 라 진단 목적, `computeChainDepth`
= fail-open 방지) 정확히 기록했다. `computeChainDepth` 가드는 spec §9.1 이 요구하는
"애플리케이션 레벨 chain 깊이 enforce" 를 실제로 강화하는 방향이라 spec 과 충돌하지
않고 오히려 일치도를 높인다. admission throw 시 `runExecutionFromQueue` 가 routing
context 를 release 후 재전파하는 것도 코드·테스트 양쪽에서 확인했다. 3개 대상 spec 파일을
직접 실행해 각각 444/45/38 건 GREEN 을 재현했다(RESOLUTION.md 수치와 일치). TODO/FIXME/
HACK/XXX 류 미완성 표식은 diff 전체에서 발견되지 않았다. 함수 시그니처·반환값·에러
메시지·검증 규칙 모두 관련 spec 본문과 line-level 로 일치하며, CRITICAL/WARNING 급
요구사항 결함을 발견하지 못했다.

## 위험도

NONE
