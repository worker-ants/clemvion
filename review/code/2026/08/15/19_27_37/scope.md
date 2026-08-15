# 변경 범위(Scope) 리뷰 — ws-event-types-extract

## 검토 방법

프롬프트에 실린 unified diff(35개 파일)에 더해 `git diff origin/main...HEAD --stat` (총 38개
파일, 이 중 3개는 프롬프트에 없던 나머지 review/consistency 산출물 — `naming_collision.md`·
`plan_coherence.md`·`rationale_continuity.md`)로 변경 전체 목록을 실측했고, 핵심 파일
(`websocket.service.ts`, `execution-event-emitter.service.ts`, import-split 대상 다수)은
`git diff`로 전체 diff를 직접 대조했다. 대조 대상 plan: `plan/in-progress/ws-event-types-extract.md`
("`websocket.service` 의 런타임 값을 의존성-프리 모듈로 분리" — `spec_impact: none`).

## 발견사항

- **[INFO]** import-only 리팩터가 아니라 evaluation-timing 변경 1건이 섞여 있음 (의도됨, 문서화됨)
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    — `TERMINAL_SHAPE` 상수 도입부(신설 모듈-스코프 const)와 `emitTerminalExecution` 메서드 내부의
    호출-시점 리터럴 제거 부분
  - 상세: 이 파일은 단순 import 경로 교체가 아니라, `#1174`에서 도입했던 "모듈 스코프 파생 금지"
    워크어라운드(호출 시점 지연 평가)를 **모듈 스코프 상수로 되돌리는** 기능적 변경을 포함한다.
    diff 자체에 광범위한 근거 주석(`TERMINAL_SHAPE` 상단 JSDoc)이 동봉되어 있고, plan
    (`ws-event-types-extract.md` "## 구현 중 잡은 것" / "## 이 리팩터의 검증 가능성")이 이를
    **"역재현(reverse-repro)"이 이 작업의 성공 기준**이라고 명시적으로 계획했던 항목이라 scope
    creep은 아니다. 다만 다른 22개 파일이 순수 import 경로 교체인 것과 달리 이 파일만 유일하게
    "값 평가 시점"이라는 런타임 성격의 변경을 포함하므로, 이 리뷰가 "여기까지가 범위"임을
    확인차 기록한다. 실측: `git diff`로 대조 시 이 파일을 제외한 나머지 21개 코드 파일(dispatcher,
    ai-turn-orchestrator, button/form-interaction, execution-engine.service,
    background-execution.processor, retry-turn, interaction-stream/sse-adapter/notification-fanout,
    embedding/graph-extraction, ai-turn-executor 등)은 예외 없이 import 문 교체만 포함한다.
  - 제안: 조치 불필요 — plan에 사전 계획·근거 문서화가 되어 있고 425/425 테스트로 검증됐다고
    plan 체크리스트에 기록됨. 참고용 기록.

- **[INFO]** 리팩터가 유발한 3개 타 in-progress plan의 stale 라인 인용 갱신도 같은 diff에 포함
  - 위치: `plan/in-progress/node-output-redesign/background.md`,
    `plan/in-progress/spec-draft-eia-62-waiting-payload.md`,
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
  - 상세: `websocket.service.ts`에서 ~300줄을 들어내며 그 파일을 절대 라인 번호로 인용하던 3개
    문서의 인용이 stale해졌고, 이번 diff가 그 갱신(심볼 기준 전환)도 함께 포함한다. 이는 무관한
    파일 수정이 아니라 — 이 리팩터 자체가 원인이 된 부수 효과를 같은 턴에 닫은 것이며, 새 plan
    `ws-event-types-extract.md` 조치 목록의 명시 항목("하위 라인 인용 재확인")이자 저장소가
    이미 기록한 교훈("라인 인용은 리팩터마다 stale해진다")의 실천이다. 범위 내로 판단.

- **[INFO]** `review/consistency/2026/08/15/18_53_27/**` 8개 신규 파일은 `--impl-prep` 필수
  워크플로 산출물
  - 상세: CLAUDE.md에 따라 developer는 구현 착수 직전 `consistency-check --impl-prep` 의무가
    있다. `SUMMARY.md`·`meta.json`·`_retry_state.json`·5개 checker 리포트가 모두 이 turn에
    새로 생성된 필수 게이트 산출물이며, 리팩터와 무관한 파일이 아니라 그 리팩터 착수를 승인한
    근거 문서다. scope 이탈 아님.

- **[INFO]** `spec/5-system/6-websocket-protocol.md` 변경은 frontmatter `code:` 목록 1줄 추가뿐
  - 위치: `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 블록
  - 상세: 신설 파일 `websocket-events.types.ts` 경로 1줄만 추가. spec 본문 변경 없음 —
    `spec_impact: none`과 무모순. consistency-check INFO #4/#5 권고를 그대로 반영한 것으로 plan
    체크리스트의 `6-websocket-protocol.md frontmatter code: 등재` 항목과 정확히 일치한다.

## 스코프 밖 변경 여부 판정

22개 코드 파일의 import 경로 교체(`ExecutionEventType`/`NodeEventType`/`ExecutionChannelEvent`/
`KbEventType`/`BackgroundRunEventType` 등을 `websocket.service`가 아닌 `websocket-events.types`
에서 직접 가져오도록)는 모두 기계적 1:1 치환이며, 실측(`git diff`)상 로직 변경이 전혀 섞여 있지
않다. `websocket.service.ts` 자체 diff도 ~300줄의 enum/interface 선언 블록을 그대로 들어내
re-export하는 형태이고, 클래스 본문(`sanitizePayloadForWs` 등 구현 세부)은 그대로 남아 있다 —
plan이 명시한 "범위 밖: `WebsocketService` 책임 분리 아님·`forwardRef` 제거 아님"과 실제 diff가
정확히 일치한다. frontend 파일은 diff stat에 전혀 등장하지 않는다. 불필요한 리팩터링·기능 확장·
무관한 파일 수정·포맷팅 혼입·불필요 주석/임포트 정리는 발견되지 않았다.

## 요약

38개 변경 파일 전체를 실측 대조한 결과, 이 PR은 plan(`ws-event-types-extract.md`)이 선언한
범위 — `websocket.service.ts`의 값/타입 선언을 의존성-프리 모듈로 추출하고 22개 호출부의 import
경로를 갱신 — 를 정확히 지킨다. 유일한 예외는 `execution-event-emitter.service.ts`의 evaluation-
timing 변경(모듈 스코프 파생 복원)인데, 이는 plan이 사전에 "성공 기준"으로 명시한 역재현
검증 항목이라 scope creep이 아니다. 나머지 부수 변경(3개 타 plan의 stale 라인 인용 갱신,
consistency-check 필수 산출물, spec frontmatter 1줄)도 전부 이 리팩터의 직접적 파생 효과이거나
프로젝트 표준 워크플로 의무 산출물로, 의도 이상의 변경·무관한 수정·포맷팅 혼입은 발견되지 않았다.

## 위험도

NONE
