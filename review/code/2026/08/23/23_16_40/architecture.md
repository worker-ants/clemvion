# 아키텍처(Architecture) 리뷰 — SSE/fanout `nodeOutput` allowlist

## 발견사항

- **[INFO]** `shared/utils/` 계층이 도메인 타입(`NodeHandlerOutput`)에 컴파일타임으로 결속돼 있다 — 의도적 예외이지만 구조적 긴장은 남는다
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:1`(`import type { NodeHandlerOutput } from '../../nodes/core/node-handler.interface'`), `:107`(`assertAllowlistCoversHandlerContract`)
  - 상세: `shared/utils/` 는 이 저장소 관례상 하위(도메인-무지) 계층이어야 하는데, 이 파일은 상위 도메인 타입 `NodeHandlerOutput` 을 참조해 컴파일타임 assertion 을 건다. 파일 자신의 헤더 주석이 이 긴장을 정확히 인지하고 있고("한 파일에 두면 하위 계층이 상위 도메인 타입을 참조하게 된다"), 이번 diff 에서 소비처가 REST(`interaction.service.ts`) 하나에서 WS(`websocket.service.ts`) 둘로 늘어난 시점에 재배치 여부를 다시 판단해 **무변경으로 결론**을 냈다(같은 파일 3~12줄, `plan/in-progress/sse-nodeoutput-allowlist.md` "재배치 defer 사유" 절). `import type` 이라 런타임 순환 의존은 없음을 직접 확인했다(`nodes/core/node-handler.interface.ts` 는 `modules/websocket` 을 참조하지 않는다). 결속 자체가 이 파일의 방어 수단(공개 키 누락 시 빌드 실패)이라 없앨 이유가 약하다는 판단도 타당하다.
  - 제안: 조치 불요 — 이미 재검토되고 근거가 기록된 상태. 소비처가 셋째가 생기거나 `nodes/core` → `shared/utils` 역방향 런타임 의존이 생기면(현재는 없음) 재론할 것.

- **[INFO]** fanout 의 단일 chokepoint(`toFanoutEnvelope`)는 컨벤션으로 강제될 뿐 구조적으로 강제되지 않는다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `emitExecutionEvent`(약 300번대, `this.gateway.broadcastToChannel(...)` 직후 `toFanoutEnvelope` 호출)와 `emitNodeEvent`(약 373번대, 동일 패턴), 대조군 `emitBackgroundRunEvent`/`emitNotificationEvent`(508·537번대)는 `broadcastToChannel` 을 직접 호출하고 `toFanoutEnvelope` 을 거치지 않음.
  - 상세: 이번 PR 이 닫는 것은 "현재 존재하는 두 emit 경로가 전부 한 함수를 지난다"는 사실이며 실측(grep)으로 맞다. 그런데 그 사실을 지키는 것은 타입 시스템이나 캡슐화가 아니라 `toFanoutEnvelope` JSDoc 의 서술("세 번째 emit 경로가 생겨도 여기를 부르면 마스킹·strip 이 구조적으로 빠지지 않는다")과 개발자의 규율이다. `WebsocketGateway.broadcastToChannel` 은 여전히 `WebsocketService` 전역에서 자유롭게 호출 가능한 public 메서드라, 향후 `nodeOutput`/`buttonConfig` 를 나르는 새 emit 메서드가 `toFanoutEnvelope` 없이 `broadcastToChannel` 을 직접 부르면 이 PR 이 막으려는 바로 그 정보노출이 조용히 재발한다. 이 저장소가 반복해 겪었다고 스스로 기록한 "출구 넷 중 하나만 닫힌다" 결함 클래스와 정확히 같은 취약 구조다(다만 이번 diff 가 만든 새 문제는 아니라 기존 구조를 그대로 물려받은 것).
  - 제안: 즉시 조치는 불요(현재 두 경로는 실측으로 확인됨, 테스트로 캐너리도 있음). 다음에 새 external emit 메서드를 추가할 때는 리뷰 체크리스트에 "이 메서드가 `nodeOutput`/`buttonConfig` 를 나르면 `toFanoutEnvelope` 를 거치는가"를 명시하거나, 장기적으로는 외부 전용 payload 생성 자체를 `toFanoutEnvelope` 뒤에서만 만들 수 있도록(예: 별도 `ExternalPayload` 타입/팩토리로 감싸 `broadcastToChannel` 시그니처가 그 타입을 요구) 강제하는 편이 컨벤션 의존도를 낮춘다.

- **[INFO]** 하나의 공유 allowlist(`NODE_OUTPUT_ALLOWED_KEYS`)가 두 개의 서로 다른 레이어(REST 표면·SSE/webhook/chat-channel 표면)의 노출 계약을 동시에 결정한다 — 응집도는 높으나 표면 간 결합을 새로 만든다
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:66-92`(단일 배열), 소비처 `codebase/backend/src/modules/external-interaction/interaction.service.ts:392`, `codebase/backend/src/modules/websocket/websocket.service.ts:189,197`
  - 상세: 이번 PR 전에는 이 상수가 REST `getStatus` 단일 소비처였고, 이번 PR 이 WS `toFanoutEnvelope` 를 두 번째 소비처로 추가하면서 chat-channel 전용 4키를 그 **공유 목록**에 넣었다. "표면별로 목록을 가르지 않는다"는 설계는 손-동기화 지점을 하나로 유지한다는 장점이 있고(이 저장소가 반복 겪은 미러 drift 방지 원칙과 일치), 대신 한 표면(chat-channel)의 요구가 다른 표면(REST)의 공개 계약을 자동으로 넓히는 부작용을 구조적으로 내재한다. 이 트레이드오프는 `side_effect`/`api_contract` 리뷰(같은 diff 안의 `review/code/.../22_51_46/side_effect.md`, `api_contract.md`)가 이미 상세히 다뤘고 캐너리로 의도를 고정했으므로 새 발견은 아니다. 아키텍처 관점에서 덧붙이면: 이 설계는 "하나의 자료구조가 여러 소비자의 요구를 대변"하는 것이 응집도 상으로는 옳지만(그 자료구조의 책임이 "top-level 에서 안전하게 노출 가능한 키" 라는 하나의 개념이므로), 결과적으로 REST 모듈과 WS 모듈이 **같은 배열의 원소 개수**를 통해 간접적으로 결합돼 있다는 점은 남는다 — 두 모듈이 직접 서로를 참조하지 않으므로 순환 의존은 아니고, 공유 저수준 유틸을 통한 정상적인 결합 형태다.
  - 제안: 조치 불요. 향후 세 번째 표면(예: 새 알림 채널)이 REST/chat-channel 과 다른 노출 요구를 가지면, 그때는 "표면별 분리"의 비용(손-동기화 둘)과 "공유 목록 확장"의 비용(무관 표면 노출 확대)을 다시 저울질할 근거가 이번 판단(무변경)과 함께 이미 기록돼 있다.

## 잘된 점 (참고)

- **Chokepoint 패턴의 정확한 적용**: `toFanoutEnvelope` 한 곳에 `stripExternalOnlyFields` → `allowlistFanoutNodeOutput` → `attachRoutingContext` 순서로 cross-cutting 관심사를 쌓아 올렸다. 순서 자체(strip → allowlist → routing)도 JSDoc 이 "왜 이 순서인가"(재마스킹 방지)를 명시해, 이 저장소가 여러 차례 겪은 "일부 출구만 닫힌다" 결함 클래스를 이번 두 자리(top-level `nodeOutput` / `buttonConfig.nodeOutput`) 모두에서 구조적으로 막았다.
- **일관된 copy-on-change 관례**: `allowlistFanoutNodeOutput`(`websocket.service.ts:182-205`)과 `allowlistNodeOutputKeys`(`node-output-allowlist.ts:121-137`) 양쪽 모두 "바뀐 게 없으면 같은 참조" 관례를 지켜 자매 유틸(`stripExternalOnlyFields`)과 동일한 성능 계약을 이어받는다. 함수 시그니처·에러 처리 스타일도 기존 파일 관례를 그대로 따라 인지 부하가 낮다.
- **추상화 수준이 적절**: allowlist 가 top-level 키만 거르고 그 아래(렌더 payload 자체)는 건드리지 않는 설계는, "무엇이 위험인가(새 최상위 핸들러 키)"와 "무엇이 작성자 데이터인가(그 아래)"를 정확히 가르는 경계다 — 과도하게 깊은 재귀도, 지나치게 얕은 검사도 아니다.

## 요약

이번 변경은 REST `getStatus`(#1205)에 이미 있던 fail-closed allowlist 를 WS `toFanoutEnvelope` 단일 chokepoint 에 배선해 SSE/webhook/chat-channel 표면의 방어 강도를 REST 와 맞춘 것으로, 아키텍처 관점에서는 견고하다. `NODE_OUTPUT_ALLOWED_KEYS` 를 유일한 SoT 로 공유해 REST·WS 두 소비처가 손-동기화 없이 같은 계약을 참조하도록 만든 결정, cross-cutting 필터를 하나의 진입점에 순서대로 쌓은 chokepoint 구조, 값이 아닌 최상위 키만 거르는 절제된 추상화 수준 모두 SOLID·응집도 관점에서 타당하다. 순환 의존은 없다. 남은 구조적 긴장 세 가지 — `shared/utils` 의 도메인 타입 결속, chokepoint 가 타입이 아닌 컨벤션으로만 강제되는 점, 공유 allowlist 가 표면 간 결합을 만드는 점 — 은 전부 이번 PR 이전부터 존재했거나 이번 PR 이 의식적으로 재검토·기록한 트레이드오프이며, 코드·plan·spec 세 층이 그 판단 근거를 일관되게 남겨 두었다. 신규로 도입된 CRITICAL/WARNING 급 아키텍처 결함은 없다.

## 위험도
NONE
