# 아키텍처 리뷰 — 종결 이벤트 emit 타입 파사드 (`eia-terminal-emit-facade`, 2차 라운드)

## 검토 방법

본 changeset 은 이전 아키텍처 리뷰(`review/code/2026/08/15/17_54_32/architecture.md`)가 지적한 WARNING/INFO 에 대한
RESOLUTION 커밋을 포함한다. 그 RESOLUTION 이 실제로 반영됐는지 소스를 직접 `Read`/`Grep` 하여 독립적으로
재검증하고, 그 위에서 신규 아키텍처 관점 결함이 있는지 살폈다.

## 발견사항

- **[INFO]** 기존 ES-module 순환(`websocket.service` ↔ `websocket.gateway` ↔ `execution-engine`/`retry-turn` ↔
  `execution-event-emitter`)은 이번에도 근본 해소가 아니라 호출 시점 지연 평가로 우회된 상태가 유지된다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:108-125`
    (`emitTerminalExecution` 내부 `type→{eventType,status}` 매핑 객체 + "모듈 스코프에서 파생하지 않는다" 주석)
  - 상세: 전 라운드에서 WARNING 으로 지적됐던 사항과 동일 코드다. 다만 이번 라운드에서 확인한바, 그 지적이
    묵살되지 않고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 명시적 백로그 항목
    ("`websocket.service` 가 값(enum)과 서비스를 함께 export 해 순환을 만든다", 체크박스 미완료)으로 등재됐다.
    근본 원인(서비스 구현 파일이 런타임 enum 을 함께 export)은 여전히 남아 있으나, 무기한 방치가 아니라
    추적 가능한 상태로 전환됐으므로 이번 라운드에서는 WARNING 이 아니라 INFO 로 재분류한다 — 코드 자체는
    변경되지 않았고 트래킹 상태만 달라졌기 때문에 신규 결함은 아니다.
  - 제안: 조치 불요(이미 백로그 등재). 후속 세션에서 `ExecutionEventType`/`NodeEventType` 등을
    의존성-프리 모듈로 추출하는 작업이 실제로 착수되는지만 추적.

- **[INFO]** `emitTerminalExecution` 의 조립 결과(`wire`)가 `Record<string, unknown>` 이라, 이 파사드가
  강조하는 "컴파일 타임 강제"는 입력(`TerminalEventPayload`)에만 적용되고 출력 조립부는 구조적 타입
  보호를 받지 못한다
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:126-138`
  - 상세: `const wire: Record<string, unknown> = {...}` 이후 조건부로 `wire.error`/`wire.result` 를
    문자열 키로 대입하는 구조라, 예컨대 `wire.eror` 같은 오타가 나도 `tsc` 가 잡지 못한다. 지금은 단일
    함수·4건의 wire-형태 회귀 테스트로 실질 위험이 낮으나, "판별 union 이 강제한다"는 설계 서사가 입력측에서
    끝나고 출력측까지 이어지지 않는다는 점에서 추상화의 비대칭이 있다. (이미 이전 라운드 maintainability 리뷰가
    같은 지점을 INFO 로 지적했고 별도 조치 없이 넘어갔다 — 이번 라운드에서 아키텍처 관점으로도 동일 결론.)
  - 제안: 조치 불요(현 상태로도 안전). 향후 종결 필드가 더 늘어나는 변경이 생기면, 세 분기 각각의 리턴
    타입을 명시하는 헬퍼(`toTerminalWirePayload(payload): {eventType, wire}`)로 분리해 조립부까지 타입
    보호를 확장하는 편이 이 리팩터의 취지에 부합한다.

## 검증한 것 (이전 라운드 WARNING 이 실제로 해소됐는지 독립 재확인)

- **W4(scope) 클래스 JSDoc 복원**: `execution-event-emitter.service.ts:51-66` 에 원래 클래스 docstring
  (C-6 strangle step 1 · 24곳 직접호출 이력 · 향후 비-WS 채널 노트)이 `@Injectable() export class` 바로 위에
  복원되어 있고, 신규 `TerminalEventPayload` JSDoc(11-30줄)은 타입 위에 분리돼 있다. 클래스가 무-docstring
  상태로 남는 문제는 해소됨을 직접 확인.
- **W5(maintainability) `TYPE_TO_EVENT` 중복 제거**: `retry-turn.service.spec.ts:49` 모듈 스코프에 단일
  선언, `:799`·`:966` 두 사용처가 그 하나를 공유함을 `grep` 으로 확인. 두 `describe` 블록에 복제되던 문제
  해소.
- **직접 호출 이관 완전성 재검증**: `execution-engine.service.ts` 에서 `emitTerminalExecution` 8회,
  `emitExecution` 직접 호출 3회(라인 3017/4436/6134)로 확인했고, 그 3곳은 각각 `EXECUTION_STARTED` ×2·
  `EXECUTION_MESSAGE` ×1 — 파사드 범위(종결 3종) 밖 이벤트임을 소스에서 직접 확인. "직접 호출 11곳 → 0곳"
  주장과 일치.
- **W7 후속 순환 참조 안전성**: 신규 value import `ExecutionStatus`(`execution.entity.ts`) 의 import 체인을
  직접 열어 `Workflow`/`Trigger`/`User` 엔티티만 참조하고 websocket 쪽으로 역참조하지 않음을 확인 — 순환을
  새로 만들지 않았다는 이전 side_effect 리뷰 판정과 일치.
- **레이어 경계**: `emitCancellationEvent`(execution-engine.service.ts, private 헬퍼) → `emitTerminalExecution`
  (타입 파사드) → `emitExecution`/`websocketService.emitExecutionEvent`(전송) 3단 계층이 실제 코드에서
  깨끗하게 유지됨. 도메인 헬퍼가 파사드를 감싸는 형태로, 책임이 잘 분리돼 있다.

## 요약

이전 아키텍처 리뷰가 지적한 WARNING(클래스 JSDoc 삭제)·중복(TYPE_TO_EVENT)은 이번 라운드에서 코드를 직접
열어 재확인한 결과 모두 실제로 해소됐다. 유일하게 남은 실질 이슈였던 ES-module 순환 미해소는 코드 수정
대상이 아니라 트래킹 상태 전환(백로그 등재, 체크박스 미완료로 정직하게 표시)으로 처리됐고, 이는 이 PR
범위(타입 초크포인트 도입)를 벗어나는 별도의 구조적 작업이라 판단이 합리적이다. 신규로 발견한 것은 출력측
(`wire: Record<string, unknown>`) 타입 보호 비대칭 하나뿐이며, 이는 이미 테스트로 방어되고 있어 조치를
요구할 수준은 아니다. CRITICAL/BLOCKING 급 구조 결함 없음.

## 위험도

LOW
