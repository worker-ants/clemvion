# Rationale 연속성 검토 결과 (--impl-done)

## 검토 범위 메모

프롬프트 번들은 컨텍스트 예산 초과로 `4-execution-engine.md`·`14-external-interaction-api.md`·
실제 코드 diff 등 이번 변경과 가장 직결된 파일들이 절단되어 있었다. 지시에 따라 워크트리를
절대경로로 직접 열어 (a) 실제 `git diff origin/main...HEAD` 전체, (b)
`spec/5-system/4-execution-engine.md` §4.4 원문 Rationale, (c) 신설 모듈
`codebase/backend/src/modules/websocket/websocket-events.types.ts`, (d)
`plan/in-progress/ws-event-types-extract.md`, (e) 직전 라운드 산출물
`review/consistency/2026/08/15/18_53_27/rationale_continuity.md` 및
`review/code/2026/08/15/19_27_37/{RESOLUTION,requirement,documentation}.md` 를 대조했다.

이번 실제 변경은 spec 본문 diff 가 아니라 `spec/5-system/6-websocket-protocol.md` frontmatter
`code:` 목록에 1줄 추가뿐이며, 실질 조치는 코드 리팩터
(`websocket.service.ts` 의 이벤트 값/타입 선언을 의존성-프리 모듈
`websocket-events.types.ts` 로 추출, `plan/in-progress/ws-event-types-extract.md`)다.

## 발견사항

- **[INFO] §4.4 Rationale 에 이번 추출을 반영하는 후속 bullet 은 여전히 부재 (직전 라운드 WARNING 의 절반만 반영)**
  - target 위치: `plan/in-progress/ws-event-types-extract.md` "왜 — 이건 이론이 아니다" 절 +
    `codebase/backend/src/modules/websocket/websocket-events.types.ts:1-21` 모듈 헤더
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` `## Rationale`(라인 1328 이하)
    "engine→Retry 순환 DI 제거 (후속 ④, PR #638)" bullet — "*위 순환 자체를 이벤트 기반
    디커플링 등으로 근본 축소하는 것은 별도 대규모 리팩터링 backlog다 — 현재는 두 기법
    (`forwardRef`/`ModuleRef.get(strict:false)`)으로 봉인한 상태를 유지한다*"
  - 상세: 직전 라운드(`18_53_27`)는 이 항목을 WARNING 으로 잡고 두 조치를 제안했다 — (a) plan
    "왜" 절에 §4.4/PR #638 을 인용하고 층위 구분을 명시할 것, (b) 구현 완료 후 spec §4.4 에
    "타입 전용 서브모듈 추출은 봉인 기법을 대체하지 않는 보완 조치"라는 후속 Rationale bullet 을
    추가할 것. 이번 라운드에서 (a)는 충실히 이행됐다 — plan 은 §4.4 원문을 정확히 인용하고
    "§4.4 가 유예한 것(DI 그래프)"과 "이 작업(ES-module 값 평가 순서)"을 표로 구분하며,
    `websocket-events.types.ts` 모듈 헤더에도 동일 근거가 재기술돼 있다. 코드 diff 로
    `forwardRef(() => WebsocketService)` 주입(`execution-event-emitter.service.ts`)과
    `emitExecutionEvent`/`emitNodeEvent` 본문은 모두 무변경임을 직접 확인했다 — 봉인 기법·단일
    sink 정책 자체는 훼손되지 않았다. 다만 (b)는 이행되지 않았다 — `spec/5-system/4-execution-engine.md`
    자체는 이번 diff 에 포함되지 않았고(`git diff origin/main...HEAD -- spec/5-system/4-execution-engine.md`
    출력 없음), plan 은 `spec_impact: none` 을 유지한다. 즉 §4.4 만 단독으로 읽는 미래 독자는
    "타입/값 선언이 이미 순환 밖 모듈로 분리됐다"는 사실을 spec 에서 알 수 없다 — plan 문서를
    찾아야만 안다.
  - 제안: 이번 리팩터가 §4.4 가 봉인한 결정(forwardRef/ModuleRef, 단일 sink)을 대체하지 않으므로
    이 항목은 CRITICAL/WARNING 은 아니다. 다만 저비용이므로, 이후 이 영역을 다시 만지는 세션(다음
    plan 의 "planner 턴" 항목과 묶어)에 §4.4 말미에 한 줄 — "값·타입 선언은
    `websocket-events.types.ts` 로 추출되어 순환 참여자 집합이 축소됐다(2026-08-15). DI 그래프·
    봉인 기법(forwardRef/ModuleRef)·단일 sink 정책 자체는 불변" — 을 추가해 spec 단독으로도
    최신 상태를 반영하게 할 것.

- **[INFO] `10-graph-rag.md:552` 의 `KbEventType` 정본 위치 서술 stale — 이미 plan 에 후속 등재됨, 재확인만**
  - target 위치: `spec/5-system/10-graph-rag.md:552` (diff 없음 — 미변경)
  - 과거 결정 출처: 해당 줄이 `KbEventType` 의 정본 선언 위치를 `websocket.service.ts` 로 서술
  - 상세: 이번 추출로 `KbEventType` 의 정본 선언은 `websocket-events.types.ts` 로 이동했고
    (`websocket.service.ts` 는 re-export 만) — 문장 자체는 re-export 덕에 여전히 "참"이지만
    정본 위치 서술은 stale. developer 는 `spec/` 쓰기 권한이 없어 plan
    (`ws-event-types-extract.md` "후속" 절)에 planner 턴 항목으로 이미 정확히 기록해 뒀다
    (`review/code/2026/08/15/19_27_37/RESOLUTION.md` INFO#1 도 동일하게 처분). 새 결함이
    아니라 기존에 이미 식별·추적 중인 항목이므로 이번 라운드의 신규 발견이 아니라 확인 차 재기재.
  - 제안: 별도 조치 불요 — planner 턴에서 §4.4 bullet(위 항목)과 함께 처리하면 한 번에 닫힌다.

- 위 두 건을 제외하면, 이번 diff(값/타입 선언 추출)는 §4.4 Rationale 이 명시한 두 봉인 기법
  (`forwardRef` / `ModuleRef.get(strict:false)`)·단일 sink 정책(`WebsocketService.emitExecutionEvent`/
  `emitNodeEvent`)·"이벤트 기반 디커플링은 별도 backlog" 유예 결정 중 어느 것도 재도입·번복·우회하지
  않는다. 코드 diff 로 직접 확인: (1) `execution-event-emitter.service.ts` 생성자의
  `@Inject(forwardRef(() => WebsocketService))` 는 무변경, (2) `emitExecutionEvent`/`emitNodeEvent`
  본문(emit 경로)은 무변경 — 옮겨진 것은 값/타입 선언뿐, (3) 신설 모듈은 새로운 sink 추상화
  (`IExecutionEventEmitter` 류)가 아니라 순수 타입 모듈. `websocket-events.types.ts` 모듈 헤더의
  §4.4 인용은 spec 원문과 정확히 일치하며 지어낸 이력이 아니다(§4.4 라인 1756 원문 대조 완료).

## 요약

이번 diff 는 순수 리팩터(`websocket.service.ts` 값·타입 선언을 의존성-프리 모듈로 추출)로,
`4-execution-engine.md` §4.4 Rationale 이 못박은 두 봉인 기법·단일 sink 정책·"근본 축소는 별도
backlog" 유예 결정 어느 것도 재도입하거나 번복하지 않는다 — DI 그래프·`forwardRef`·emit 경로는
코드 diff 로 직접 대조해 무변경임을 확인했다. 직전 라운드(`18_53_27`)가 WARNING 으로 지적한
"§4.4 인접 결정과의 상호참조 누락"은 plan 문서 차원(원문 인용 + 층위 구분 표)에서는 충실히
해소됐지만, spec §4.4 자체에 후속 Rationale bullet 을 추가하는 쪽(제안 (b))은 여전히 미이행이라
spec 단독 독자에게는 여전히 갱신 정보가 없다 — 다만 이는 실제 결정을 훼손하지 않는 낮은 비용의
문서 정합 보완 사안이라 INFO 로 하향한다.

## 위험도

LOW
