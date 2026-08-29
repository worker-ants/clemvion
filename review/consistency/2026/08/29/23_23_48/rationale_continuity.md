# Rationale 연속성 검토 결과

## 검토 대상 요약

diff-base `origin/main` 대비 변경은 코드 4파일에 한정된다(`spec/**` 변경 없음):

- `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts` — JSDoc 주석 추가만
- `codebase/backend/src/modules/websocket/websocket-events.types.ts` — `NotificationEventType` →
  `InAppNotificationEventType` enum 개명 + JSDoc 갱신
- `codebase/backend/src/modules/websocket/websocket.service.ts` — 위 개명에 따른 import/re-export/
  사용처 갱신
- `codebase/backend/src/modules/websocket/websocket-events.types.spec.ts` — 캐너리 `EXPECTED_EXPORTS`
  갱신 + `hasDefaultExport` 헬퍼 추출·세 형태 테이블 검증 추가

target 으로 지정된 `spec/data-flow/` 는 이번 diff 에서 전혀 변경되지 않았고, 번들에 포함된 어느
`## Rationale` 섹션(`spec/data-flow/0-overview.md`·`3-execution.md`·`6-knowledge-base.md`·
`1-audit.md`·`2-auth.md`·`9-observability.md`·`11-workflow.md`, 그리고 발췌된
`spec/0-overview.md`·`spec/3-workflow-editor/3-execution.md`·`spec/4-nodes/0-overview.md`·
`spec/5-system/4-execution-engine.md`)에도 `NotificationEventType`/`InAppNotificationEventType`
또는 관련 명명 규칙을 다루는 항목이 없다(전수 grep 0건). `spec/5-system/6-websocket-protocol.md`
(워킹트리 직접 확인, 프롬프트 번들에서는 예산 초과로 절단됨)의 `## Rationale` 도 마찬가지로 이
enum 이름을 인용하지 않는다.

## 과거 결정과의 관계 (plan 트래킹 확인)

`plan/in-progress/ws-event-types-extract.md` 를 워킹트리에서 직접 확인한 결과, 이번 개명은
**같은 plan 안에서 이전 세션(`18_53_27`)이 명시적으로 "별도 항목"으로 이연한 결정을 이번 세션이
집행**한 것이다:

- 이전 결정(코드 JSDoc, `18_53_27` naming W3): "같은 이름의 다른 타입이 있다 → disambiguation
  JSDoc 으로 막고, **개명은 별도 항목**" — 이는 spec `## Rationale` 이 아니라 코드 주석 수준의
  잠정 결정이었고, "개명 자체를 기각" 한 것이 아니라 **범위 밖으로 이연**한 것이었다.
- 이번 diff 의 JSDoc(`websocket-events.types.ts`)과 plan 문서(`- [x] NotificationEventType
  개명 …`) 양쪽에 개명 근거가 명시적으로 함께 기록됐다(어느 쪽을 개명할지, 왜 disambiguation
  JSDoc 만으로는 불충분한지 — "주석은 오import 를 막지 못한다").
- plan 은 `spec 은 이 이름을 인용하지 않는다(grep -rn NotificationEventType spec/ → 0건)` 을
  실측 근거로 spec 변경 불요·developer 범위임을 명시했고, plan frontmatter 도
  `spec_impact: none` 이다. 워킹트리 grep 으로도 이 주장을 재확인했다(spec/ 전체에서
  0건 일치).

즉 "과거 Rationale 에서 기각된 대안의 재도입"(관점 1), "합의된 설계 원칙 위반"(관점 2), "무근거
번복"(관점 3), "invariant 우회"(관점 4) 어느 쪽에도 해당하는 패턴이 발견되지 않았다 — 개명
대상 선택 근거(자매 enum `<도메인>EventType` 명명 규칙 — `ExecutionEventType`·`NodeEventType`·
`BackgroundRunEventType`·`KbEventType`)도 diff 내 JSDoc 에 함께 실려 있어 새 결정에 대한 근거
누락도 없다.

## 참고 — spec Rationale 관련 부수 확인

`spec/5-system/6-websocket-protocol.md`의 `## Rationale`을 직접 열람해 아래를 재확인했으나 이번
diff 와 충돌하는 항목은 없었다:
- `notification.new`/`notifications:` 채널 관련 항목(authorizer 선제 배치 결정 등)은 emit 경로·
  인가 로직을 다루고, enum 심볼 이름과는 무관.
- `websocket-events.types.ts` 자체의 모듈 분리(ES-module 순환 봉인) 관련 결정(§4.4, PR #638)은
  이번 diff 가 "건드리지 않는다"고 plan 에 명시한 봉인 기법(`forwardRef`)·emit 경로와 무관 —
  이번 변경은 오직 명명(enum 이름)에 한정된다.

## 발견사항

없음.

## 요약

이번 diff 는 spec 변경이 전혀 없는 순수 backend 리네이밍(+테스트 보강)이며, spec 어느
`## Rationale` 에도 이 enum 명명에 관한 결정이 존재하지 않아 직접 충돌 대상이 없다. 오히려 plan
문서(`ws-event-types-extract.md`)를 통해 "이전 세션이 이연해 둔 개명 항목을 이번 세션이 근거와
함께 집행했다"는 연속성이 명시적으로 추적되고 있어, Rationale 연속성 관점에서 모범적으로 처리된
사례로 판단된다.

## 위험도

NONE
