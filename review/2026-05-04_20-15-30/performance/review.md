## 발견사항

### 함수 자체 성능
- **[INFO]** `buildAiMessageDebugFromResumeState` 함수 — O(1) 복잡도
  - 위치: `execution-engine.service.ts:167-185`
  - 상세: `turnDebugHistory[length - 1]` 배열 끝 접근, 조건부 프로퍼티 할당 모두 상수 시간. 불필요한 복사 없음. 구현 자체는 성능상 문제 없음.

---

### WebSocket 페이로드 크기 (주요 우려)

- **[WARNING]** `llmCalls`에 포함된 `requestPayload` 크기가 턴 수에 비례해 제곱 성장
  - 위치: `execution-engine.service.ts:1704` (`...buildAiMessageDebugFromResumeState(resumeState)`)
  - 상세: tool-loop가 있는 턴에서는 한 이벤트에 N개의 `llmCalls` 엔트리가 포함됨. 각 `requestPayload`는 시스템 프롬프트 + 누적 메시지 히스토리 + 전체 tool 정의를 포함. 대화 10턴 × tool call 3회인 경우, 10번째 `ai_message` 이벤트 하나에 전체 히스토리가 담긴 requestPayload 3개가 포함 → **O(n²) 페이로드 성장**.
  - 제안: `requestPayload`/`responsePayload`에서 반복되는 `messages` 배열을 제외하고 최신 delta만 포함하거나, 클라이언트가 이미 가진 히스토리는 생략. 또는 debug 정보는 별도 옵트인 채널로 분리.

- **[WARNING]** `llmCalls` 배열 크기에 제한 없음
  - 위치: `execution-engine.service.ts:151-185`
  - 상세: 단일 턴에서 tool loop가 수십 회 반복될 경우 (예: MCP 연속 호출) `llmCalls` 배열이 무제한으로 커짐. 각 엔트리의 `responsePayload`에는 provider가 반환한 전체 content가 포함될 수 있음. WebSocket 프레임 크기 제한을 초과하거나 클라이언트 파싱 부하가 발생할 수 있음.
  - 제안: `llmCalls` 최대 개수 제한(예: 최근 20개) 또는 `requestPayload`/`responsePayload`를 요약 필드(`model`, `usage`, `toolNames`)로 축약한 lite 버전 전송.

---

### Spread 연산자 오버헤드

- **[INFO]** `...buildAiMessageDebugFromResumeState(resumeState)` 호출 시 중간 객체 생성
  - 위치: `execution-engine.service.ts:1704`
  - 상세: 함수가 `{ llmCalls, durationMs }` 객체를 생성 후 즉시 상위 객체로 spread. 함수 내부에서 두 번 조건 분기. 이벤트 발생 빈도(AI 응답마다 1회)와 비교하면 실질적 오버헤드는 무시 가능.
  - 제안: 현재 수준에서 최적화 불필요.

---

## 요약

변경의 핵심인 `buildAiMessageDebugFromResumeState` 함수 자체는 O(1)이고 메모리 할당이 최소화된 효율적인 구현이다. 성능 위험은 함수 로직이 아니라 **함수가 직렬화하는 데이터의 크기**에 있다. `llmCalls` 배열의 각 엔트리가 누적 메시지 히스토리를 포함하는 `requestPayload` 전체를 담기 때문에, 긴 멀티턴 대화에서 WebSocket 페이로드가 O(n²)으로 성장한다. 단기적으로는 대부분의 대화에서 문제가 없겠지만, tool-loop가 많은 에이전트 워크플로우나 긴 컨텍스트 윈도우를 사용하는 케이스에서 잠재적 병목이 될 수 있다.

## 위험도

**LOW** (현재 기능 범위에서는 동작하나, 장기적 확장 시 WARNING 항목 재검토 필요)