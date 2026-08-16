# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `toTerminalErrorPayload` 의 반환값 마스킹이 기존 호출부 5곳(WS·SSE·webhook 종결 emit + `chat-channel.dispatcher`) 전체의 출력 형태를 동시에 바꾼다 — 내부/신뢰 채널 소비자에 대한 영향이 이 diff 범위 안에서 검증되지 않았다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:81` (`redactTerminalError` 정의), 적용 지점은 `:99`·`:108-113`·`:117`·`:129` (모든 `return` 경로가 `redactTerminalError(...)` 로 래핑됨)
  - 상세: `redactTerminalError` 는 `message`/`details` 에 `deepRedactSecrets` 를 적용해 secret-형태 패턴을 `***` 로 치환한다. 이 함수는 4개 반환 경로 전부(문자열/스칼라/비객체/일반 객체)에 빠짐없이 적용돼 "한 곳만 빠뜨린다" 는 이 저장소의 반복 결함 형태를 구조적으로 막는다는 설계 의도는 타당하다. 다만 이 변경은 `toTerminalErrorPayload` 를 소비하는 **모든** 곳의 payload 내용을 조용히 바꾼다 — 외부(SSE/webhook/WS 제3자)로 나가는 경로는 마스킹이 목적대로 필요하지만, 같은 payload 를 내부 신뢰 채널(예: 워크플로우 에디터가 WS 로 받아 `Error: <message>` 를 그대로 렌더링하는 경로)도 공유해서 받는다면 디버깅에 필요한 원문이 `***` 로 가려질 수 있다. 이 우려는 이미 같은 세션의 consistency-check(`review/consistency/2026/08/16/09_25_29/SUMMARY.md` WARNING #1, rationale_continuity)가 독립적으로 지적했고 "워크플로우 에디터가 마스킹값을 받아도 되는지 별도 확인" 이 **미해결 조치사항**으로 남아 있다 — 이 코드 diff 자체에는 그 확인이나 캐비엇이 반영되지 않았다.
  - 제안: 워크플로우 에디터(또는 다른 내부 전용 소비자)가 `execution.failed` WS 이벤트의 `error.message` 를 신뢰 채널로 그대로 렌더링하는지 확인하고, 그렇다면 (a) 마스킹이 UX 상 허용 가능함을 문서화하거나 (b) 내부 전용 표면은 raw 값을 별도로 노출하는 경로를 검토한다.

- **[INFO]** `redactTerminalError` 의 `details` 마스킹이 신설 호출을 통해 기존 shared 모듈의 전역(module-level) `WeakMap` 캐시에 새 항목을 추가한다
  - 위치: 캐시 정의는 `codebase/backend/src/shared/utils/sanitize-error-message.ts:107` (`DEEP_REDACT_CACHE`, 이번 diff 밖 기존 코드) — 신규 호출 지점은 `codebase/backend/src/shared/utils/terminal-error-payload.ts:81`(`redactTerminalError` → `deepRedactSecrets(p.details)`)
  - 상세: `deepRedactSecrets` 는 depth-0 객체를 identity 로 캐싱하는 module-scope `WeakMap` 을 이미 갖고 있다(conversation-thread 등 기존 소비자용). 이번 diff 는 이 캐시에 새 소비자(terminal error `details`)를 추가하는 것이라 **새 전역 변수를 도입하지는 않지만**, 공유 가변 캐시에 쓰기가 늘어난다. `WeakMap` 이라 GC 는 안전하고, 각 emit 지점이 매번 새 객체 리터럴을 만들어 `Execution.error` 에 쓰므로(예: `finalizeFailedExecution` 의 `{ message: errMessage, ... }`) 같은 참조가 내용만 바뀌어 재사용되며 캐시가 stale 값을 돌려주는 실질적 위험은 낮다. 정보성으로만 기록.
  - 제안: 조치 불요(설계상 안전). 향후 `Execution.error` 객체가 in-place mutation 되어 재전달되는 경로가 생기면 이 캐시의 identity 기반 재사용이 stale 마스킹 결과를 낼 수 있다는 점만 유의.

- **[INFO]** 리뷰 대상 파일 4~13 은 신규 파일 생성(plan 문서 + consistency-check 산출물)이지만 정해진 워크플로 산출물이라 의도치 않은 파일시스템 부작용이 아님
  - 위치: `plan/in-progress/eia-terminal-error-sanitize.md`(신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(체크박스 갱신), `review/consistency/2026/08/16/09_25_29/*`(신규)
  - 상세: 프로젝트 규약상 `developer`/consistency-checker 가 `plan/`·`review/` 하위에 쓰는 것은 명시된 쓰기 권한 범위이며, 내용도 이번 코드 변경의 배경·검토 이력을 정확히 반영한다.
  - 제안: 조치 불요.

## 관측된 안전한 설계 (부작용 없음 확인)

- `redactTerminalError`/`deepRedactSecrets` 는 입력을 mutate 하지 않는다 — `redactTerminalError` 는 spread 로 새 객체를 만들고, `deepRedactSecrets`/`deepRedactObject` 는 copy-on-change(변경 없으면 원본 참조 반환)라 `details` 의 참조 보존 테스트(`terminal-error-payload.spec.ts` "마스킹할 게 없으면 details 참조를 보존한다")와 부합한다.
- `TerminalErrorPayload` 인터페이스·`toTerminalErrorPayload`/`sanitizeErrorMessage` 의 함수 시그니처는 변경되지 않았다 — 기존 호출부가 재컴파일·타입 오류 없이 그대로 동작한다.
- `sanitize-error-message.ts`(execution-engine) 변경은 JSDoc 주석뿐이며 런타임 로직은 무변경.
- 신규 `import { deepRedactSecrets } from './sanitize-error-message'` (`terminal-error-payload.ts:3`) 에 대한 순환 참조 우려는 대상 파일(`shared/utils/sanitize-error-message.ts`)에 import 문이 0개임을 직접 확인해 근거가 맞다(#1175 가 해소한 순환에 재유입하지 않음).
- 네트워크 호출·환경 변수 read/write·이벤트 발행 로직 변경 없음.

## 요약

핵심 변경은 `toTerminalErrorPayload` 의 모든 반환 경로에 secret 마스킹(`deepRedactSecrets`)을 구조적으로 삽입한 것으로, 입력 mutate 없음·시그니처 불변·기존 shared 캐시의 안전한(WeakMap, copy-on-change) 재사용 등 부작용 관점에서 설계가 신중하다. 유일하게 실질적인 부작용 우려는 이 payload 를 공유하는 **모든** emit 경로(WS/SSE/webhook + chat-channel)의 출력 내용이 동시에 바뀐다는 점이며, 그중 내부 신뢰 채널(워크플로우 에디터)에 대한 영향이 아직 검증되지 않은 채로 남아 있다 — 이는 이미 같은 세션의 consistency-check 가 독립적으로 포착해 미해결 조치사항으로 기록한 항목과 동일하다.

## 위험도
LOW
