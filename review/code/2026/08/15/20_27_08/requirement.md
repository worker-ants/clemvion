# 요구사항(Requirement) 리뷰 — `ws-event-types-extract` fresh review (`20_27_08`)

## 검토 방법

이 diff(`git diff origin/main...HEAD`, 27개 코드/spec 파일 — 나머지는 이전 두 라운드
(`19_27_37`/`20_05_17`)와 그 트리거였던 `18_53_27`/`20_05_19` consistency-check 산출물)는
`websocket.service.ts` 가 함께 export 하던 런타임 값(enum)·타입 선언을 의존성-프리 신규 모듈
`websocket-events.types.ts` 로 추출하는 순수 리팩터(#1174 ES-module 순환 회귀 방지)다.
프롬프트 diff 조각 외에 아래를 직접 대조했다:

- `websocket-events.types.ts`(전체, 265줄), `websocket.service.ts`(re-export facade),
  `websocket.gateway.ts`(import), `execution-event-emitter.service.ts`(`TERMINAL_SHAPE`) 를
  워크트리에서 `Read`.
- `git diff origin/main...HEAD` 로 각 파일의 실제(비-truncated) diff 를 전수 대조 —
  `websocket.service.ts` 는 순수 extraction(287줄 삭제 = 그대로 신규 모듈로 이동, 클래스 본문
  무변경), `execution-event-emitter.service.ts` 는 호출-시점 인라인 계산 → 모듈-스코프
  `TERMINAL_SHAPE` 상수 참조로 형태만 변경(값·shape 동일)임을 확인.
- `npx jest src/modules/websocket/websocket-events.types.spec.ts` 직접 실행 — 4/4 PASS.
- `npx jest .../execution-event-emitter.service.spec.ts src/modules/websocket` — 반복 실행 시
  152/152 PASS(1회 관측된 단발성 실패는 재실행 3회 전부 재현 안 됨 — 이번 diff 로직과 무관한
  플레이크로 판단, 별도 조치 불요).
- `grep -rn "from '.*websocket\.service'" src` 전수 — `WebsocketService`(값) 외의 것을 그
  경로에서 값으로 import 하는 곳이 저장소 전체에 **0곳**임을 재확인(가드 3번째 테스트와 별개로
  직접 재현).
- `npx eslint` 4개 핵심 파일 — `--max-warnings 0` 클린.
- `plan/in-progress/ws-event-types-extract.md` 전문 — 왜/실측/조치/검증가능성/범위 밖/후속 절
  전부 확인.

## 발견사항

이번 라운드에서 새로 지적할 CRITICAL/WARNING 은 없다. 직전 두 라운드(`19_27_37`: W1~W5,
`20_05_17`: W1~W2)가 지적한 항목은 소스를 직접 열어 전부 반영 확인했다(`websocket.gateway.ts`
의 옛 경로 import 전환, `TERMINAL_SHAPE`/클래스 JSDoc 순서 교정, `NotificationEventType` JSDoc
병합, WARN #10 위치 이동, `ExecutionChannelEvent` 3곳 `import type` 통일, 회귀 가드 5형태 전수
탐지로 교정). 아래는 이번 라운드에서 독립적으로 재확인한 참고 사항이다.

- **[INFO]** §4.4 Rationale 에 이번 추출을 반영하는 후속 bullet 부재 — 기존에 이미 INFO 로
  하향·추적 중, 재확인만
  - 위치: `spec/5-system/4-execution-engine.md` `## Rationale`(§4.4, PR #638 bullet) / 대응
    조치는 `plan/in-progress/ws-event-types-extract.md:210-211`("후속" 절)
  - 상세: `18_53_27` rationale_continuity 가 이를 WARNING(MEDIUM)으로 잡았고, `20_05_19`
    rationale_continuity 가 재검증해 "plan 문서 차원의 인용·층위 구분(표)은 충실히 이행됐으나
    spec §4.4 자체의 후속 bullet 추가는 미이행"이라며 INFO(LOW)로 하향했다. 직접 확인한 결과
    이 판정은 정확하다 — `git diff origin/main...HEAD -- spec/5-system/4-execution-engine.md`
    출력이 없고, plan 은 §4.4 원문을 정확히 인용하며 "DI 그래프 불변·emit 경로 불변"을 표로
    명시했다(`plan/in-progress/ws-event-types-extract.md:28-47`). `forwardRef(() =>
    WebsocketService)` 주입과 `emitExecutionEvent`/`emitNodeEvent` 본문이 코드 diff 상
    무변경임도 직접 대조로 재확인했다 — 즉 §4.4 가 봉인한 결정(forwardRef/ModuleRef, 단일
    sink)은 실제로 훼손되지 않았고, 이건 **spec 이 아직 이 사실을 반영하지 않은 문서 갱신
    누락**이지 코드 결함이 아니다.
  - 이는 SPEC-DRIFT 로 분류하지 않는다 — spec §4.4 본문(봉인 기법·유예 결정)이 "틀려서" 코드가
    다르게 간 것이 아니라, spec 이 다루지 않는 새 사실(순환 참여자 집합 축소)을 추가 서술할지
    여부의 문제이며 developer 권한(`spec/` read-only) 밖이다. `plan/in-progress/
    ws-event-types-extract.md:210-211` 에 planner 턴 항목으로 이미 정확히 등재돼 있다.
  - 제안: 조치 불요 — 이미 등재된 planner 턴 항목을 그대로 진행. 코드 변경 없음.

- **[INFO]** `KbEventType` 정본 위치 서술이 `spec/5-system/`·`spec/data-flow/` 6곳에 stale —
  이미 전수 등재됨, 재확인만
  - 위치: `plan/in-progress/ws-event-types-extract.md:188-199`(전수 목록 6곳 + 제외 판정 3곳)
  - 상세: `KbEventType` 의 정본 선언이 `websocket-events.types.ts:254`로 실제 이동했고
    `websocket.service.ts` 는 `export type { KbEventType }` 로 re-export 만 한다(직접 확인).
    `20_05_19` plan_coherence 가 "1곳만 등재했는데 실은 최소 3~4곳"이라고 지적했고, plan 은
    이번 라운드에 심볼(`KbEventType`) 기준 전수 재검색으로 6곳(3곳 제외 판정 근거 포함)을
    정확히 등재했다. re-export 가 살아 있어 문장 자체는 거짓이 아니라는 점(제외 판정 근거)도
    plan 이 명시한다.
  - 제안: 조치 불요 — spec 쓰기는 developer 권한 밖, 이미 planner 턴 항목.

- **[INFO]** `emitTerminalExecution` 의 `TERMINAL_SHAPE[payload.type]` 조회는 새 위험을
  도입하지 않는다 — 컴파일타임 exhaustiveness 로 이미 닫혀 있음
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
    (`TERMINAL_SHAPE` 상수, `emitTerminalExecution` 메서드)
  - 상세: `payload.type` 은 `TerminalEventPayload` 판별 union 의 리터럴('completed'|'failed'|
    'cancelled')로 컴파일타임에 3값으로 닫혀 있고, `TERMINAL_SHAPE` 는 정확히 그 3키를 갖는
    `as const` 객체라 `TERMINAL_SHAPE[payload.type]` 가 `undefined` 를 반환할 런타임 경로가
    없다(호출부가 `any` 캐스트로 타입을 우회하지 않는 한). 이는 리팩터 전 인라인 리터럴
    버전과 완전히 동일한 안전성이며, `git diff` 로 확인한 대로 계산 결과(`eventType`/`status`
    쌍)도 바이트 단위로 동일하다 — 순수 형태 변경.
  - 제안: 없음(확인용 기록).

- **[INFO]** 신규 회귀 가드(`websocket-events.types.spec.ts`)가 실제로 저장소 전체를 커버하는지
  독립 재현 — 확인 완료
  - 위치: `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts`
  - 상세: `SRC_ROOT = path.resolve(__dirname, '..', '..')` 가 `codebase/backend/src` 로
    정확히 해석되어(`websocket/` → `modules/` → `src/`) `nodes/ai/ai-agent/ai-turn-executor.ts`
    등 `modules/` 밖 파일까지 포함한 전수 스캔임을 직접 계산·확인했다. 별도로
    `grep -rn "from '.*websocket\.service'" src` 전수를 직접 돌려 `WebsocketService`(값) 외의
    값 import 가 저장소에 0곳임을 가드와 독립적으로 재확인했다 — 가드의 "offenders: []" 단언과
    합치.
  - 제안: 없음(확인용 기록).

## 요약

핵심 요구사항 — "`websocket.service.ts` 의 값/타입 선언을 의존성-프리 모듈로 분리해 #1174
급 ES-module 순환 재발을 구조적으로 차단한다" — 은 코드로 정확히 구현돼 있고, 그 불변식은
주석이 아니라 TS 파서 기반 이름 있는 테스트(`websocket-events.types.spec.ts`, 4 tests, 뮤테이션
6+5/11 RED 로 검증된 이력)로 고정돼 있다. 직전 두 리뷰 라운드가 지적한 WARNING 7건(순환 노드
누락·JSDoc 고아화 2곳·회귀 테스트 부재·`import type` 3곳 누락·가드 자체의 탐지 폭 협소화 등)은
전부 현재 소스에서 실제로 반영된 것을 직접 코드 대조 + 테스트 실행(guard 4/4, emitter suite
152/152, 저장소 전수 grep 0건, eslint 클린)으로 재확인했다. `TerminalEventPayload`(§6/§6.5)의
필수 필드 강제·닫힌 3값 union·에러/취소 payload 조립 로직은 이번 diff 로 손대지 않았고
행동적으로 동일함을 diff 로 직접 확인했다. TODO/FIXME/HACK/XXX 는 diff 어디에도 없다.
spec 변경은 `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 목록 1줄뿐이며 신설
파일 등재로 정확하다. 유일하게 남은 항목은 spec §4.4 본문 자체에 이번 추출을 반영하는 후속
Rationale 문장이 아직 없다는 것과 `KbEventType` 정본 위치 서술이 spec 6곳에서 stale 하다는
것인데, 둘 다 developer 권한(`spec/` read-only) 밖이고 `plan/in-progress/
ws-event-types-extract.md` "후속" 절에 정확한 대상 목록과 함께 이미 등재돼 있어 이번 PR 을
막을 사유가 아니다.

## 위험도

NONE
