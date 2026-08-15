# Rationale 연속성 검토 결과

## 검토 범위 메모

프롬프트 번들의 target 은 `spec/5-system/` (impl-prep, scope=spec/5-system/) 이며 `1-auth.md`·
`2-api-convention.md`·`3-error-handling.md` 는 전문 포함, 나머지 15개 파일(4-execution-engine.md 포함)은
컨텍스트 예산 초과로 절단됐다. 절단된 파일 중 이번 impl-prep 이 실제로 겨냥하는 코드 변경과 직결되는
`4-execution-engine.md` §4.4 는 지시에 따라 워크트리에서 직접 `Read` 해 확인했다. 실제 구현 계획
(`plan/in-progress/ws-event-types-extract.md`, `websocket.service` 의 이벤트 타입/enum 을 의존성-프리
모듈로 분리)은 프롬프트 번들에는 포함돼 있지 않았지만, 워크트리에 존재하는 것을 확인하고 대조했다.

## 발견사항

- **[WARNING] `ws-event-types-extract` 계획이 §4.4 "두 기법으로 봉인 유지" 결정과 겹치는데 상호 참조가 없음**
  - target 위치: (spec 자체에는 diff 없음 — `spec_impact: none`) 실제 조치 대상은
    `plan/in-progress/ws-event-types-extract.md` (`websocket-events.types.ts` 신설 + 타입 전용
    12곳을 신규 모듈로 직접 import 전환, "이 12곳이 순환에서 빠진다")
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.4 "이벤트 발행 sink — `WebsocketService`
    단일 sink 정책" Rationale, 그중 "engine→Retry 순환 DI 제거 (후속 ④, PR #638)" 항목
  - 상세: §4.4 Rationale 은 `ws.service↔gateway↔retry↔event-emitter` ES-module 순환을 **정확히
    같은 체인**으로 이름 붙여 "`ExecutionEventEmitter→WebsocketService` `forwardRef` 지연 해석으로
    봉인했다"고 기록하고, 곧바로 "위 순환 자체를 이벤트 기반 디커플링 등으로 근본 축소하는 것은 별도
    대규모 리팁터링 backlog다 — 현재는 두 기법(`forwardRef` / `ModuleRef.get(strict:false)`)으로
    봉인한 상태를 유지한다"고 스코프를 명시적으로 닫아 뒀다. 신규 plan 은 이 순환의 25개 소비처 중
    "타입만 쓰는 12곳"을 신규 의존성-프리 모듈로 옮겨 그 12곳을 순환 밖으로 빼내는 조치이며, plan 스스로
    "근본 원인은 남았고"라고 인정하면서도 §4.4/PR #638 Rationale 을 한 번도 인용하지 않고
    `spec_impact: none` 으로 단정했다. DI 그래프·`forwardRef` 자체는 그대로 두는 좁은 범위(plan의
    "범위 밖" 절도 forwardRef 제거를 명시적으로 배제)라 두 기법을 훼손하지는 않지만, "그 순환을
    축소하는 조치"라는 점에서 §4.4 가 미뤄 둔 작업 영역에 발을 들이는 것은 사실이다.
  - 제안: (a) plan 본문("왜" 절)에 §4.4/PR #638 Rationale 을 인용하고, 이번 조치는 "이벤트 기반
    디커플링"(deferred backlog)과 다른 층위 — DI 그래프·`forwardRef` 는 불변, ES-module 값 평가
    순서만 정리 — 임을 한 문장으로 명시할 것. (b) 구현 완료 후 spec §4.4 에 "타입 전용 서브모듈 추출은
    봉인 기법을 대체하지 않는 보완 조치"라는 짧은 후속 Rationale bullet을 추가해, 이후 이 영역을 다시
    만지는 세션이 "근본 축소가 이미 진행 중"이라고 오독하지 않도록 한다. `spec_impact` 를 `none` 대신
    `spec/5-system/4-execution-engine.md` 로 바꾸고 Rationale 한 줄을 더하는 쪽이, 나중에 이 교차를
    재발견하는 비용보다 싸다.

- **[INFO] "단일 sink" 원칙 자체와는 충돌하지 않음 — plan 에 그 구분이 명시돼 있지 않을 뿐**
  - target 위치: 동일 plan
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.4 "결정: … `WebsocketService` 가
    canonical 이며 별도 추상화(`IExecutionEventEmitter` 등)를 도입하지 않는다"
  - 상세: plan 은 이벤트 emit 경로(`emitToExecution` 등)를 건드리지 않고 enum/type 정의의 파일
    위치만 옮긴다. `websocket.service.ts` 는 신규 모듈에서 re-export 해 서비스 소비처 13곳은
    무변경이므로 "단일 sink" 원칙 자체는 위반하지 않는다. 다만 이 구분이 plan 어디에도 한 줄로
    적혀 있지 않아, 이후 --impl-done 리뷰나 코드 리뷰 단계에서 "sink 분리 시도 아니냐"는 오탐이
    나올 여지가 있다.
  - 제안: plan "왜" 절에 "§4.4 단일 sink 정책은 불변 — 이동 대상은 값/타입 정의뿐이며 emit 경로는
    없음" 한 줄을 추가.

- 검토 대상으로 전문 포함된 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 자체의 본문과
  Rationale 은 상호간에도, 번들에 발췌된 타 spec(`0-overview.md`·`1-data-model.md`·
  `2-navigation/*.md` 등)의 Rationale 과도 뚜렷한 모순이 발견되지 않았다. 특히 `1-auth.md` §1.1.B
  (이메일 변경 흐름)의 재인증 수단 제한(이메일 OTP 배제)·`3-error-handling.md` §1 카탈로그 완결성
  bullet 들은 각자 인용하는 과거 결정(§2.3.D 정합화, Rationale 1.1.B-4 등)과 정합적으로 연결돼 있다.

## 요약

전문 포함된 target 문서(`1-auth.md`/`2-api-convention.md`/`3-error-handling.md`) 자체는 기존
Rationale 코퍼스와 정합적이며 기각된 대안의 재도입이나 원칙 위반은 발견되지 않았다. 다만 이번
--impl-prep 이 실제로 겨냥하는 코드 작업(`websocket.service` 이벤트 타입의 의존성-프리 모듈 분리,
`plan/in-progress/ws-event-types-extract.md`)은 `spec/5-system/4-execution-engine.md` §4.4 가
"별도 대규모 리팁터링 backlog로 미룬다"며 명시적으로 스코프를 닫아 둔 바로 그 ES-module 순환
(`ws.service↔gateway↔retry↔event-emitter`)의 참여자 집합을 부분적으로 줄이는 조치다. `forwardRef`·DI
그래프는 그대로 두는 좁은 범위라 두 봉인 기법을 직접 훼손하지는 않지만, plan 이 이 Rationale 을 전혀
인용하지 않고 `spec_impact: none` 으로 단정한 것은 "결정 번복은 아니되 인접 결정에 대한 Rationale
갱신·상호참조 누락"에 해당한다 — 구현 착수 전에 plan 문서에 §4.4 인용 한 줄, 구현 완료 후 spec 에
후속 Rationale bullet 한 줄을 더하는 저비용 조치로 닫을 수 있다.

## 위험도

MEDIUM
