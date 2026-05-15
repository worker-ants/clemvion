## 보안 코드 리뷰: 타임아웃 제거 및 무제한 대기 전환

---

### 발견사항

---

**[WARNING] 서버 메모리 자원 고갈 (Resource Exhaustion) — `pendingContinuations` Map 무제한 누적**

- **위치**: `execution-engine.service.ts` — `waitForFormSubmission()`, `waitForAiConversation()`, `waitForButtonClick()` 내 `pendingContinuations.set(...)` 호출부
- **상세**: 기존에는 각 대기 지점에 `setTimeout`으로 자동 정리가 보장되어 있었으나, 이 변경으로 세 가지 대기 경로 모두에서 타임아웃이 제거되었습니다. `pendingContinuations`에 삽입된 `{nodeId, resolve, reject}` 엔트리는 외부 cancel 명령이 없는 한 GC 대상이 되지 않습니다. 악의적 사용자 또는 대량의 방치된 세션이 발생할 경우:
  - `pendingContinuations` Map 엔트리 무제한 누적
  - 각 엔트리가 참조하는 Promise와 클로저(closure)가 힙을 점유
  - 장시간 운영 환경에서 메모리 증가 → 서비스 불안정

  외부 cancel 의존 구조가 실제로 WebSocket disconnect 시에도 작동하는지, 또는 사용자가 브라우저를 닫은 경우 정리가 보장되는지가 이 diff만으로는 확인되지 않습니다.

- **제안**:
  - WebSocket `disconnect` 이벤트 핸들러에서 해당 클라이언트의 모든 `pendingContinuations` 자동 정리 로직 확인/보강
  - 워크스페이스 또는 사용자당 동시 `waiting_for_input` 상태 실행 수 상한(예: 100개) 설정
  - 최후 방어선으로 매우 긴 안전 타임아웃(예: 24시간)을 유지하는 방안 검토

---

**[WARNING] Sub-workflow `timeoutMs = 0` 입력 경로 무검증**

- **위치**: `execution-engine.service.ts:617` — `executeSubWorkflow()` 내 `options?.timeoutMs ?? 300_000`
- **상세**: `timeoutMs === 0`이 "타임아웃 없음"으로 해석되도록 변경되었습니다. 이 값이 API 또는 노드 config 경로를 통해 외부에서 제어 가능하다면, 공격자가 `timeout: 0`을 지정하여 의도적으로 타임아웃 없는 sub-workflow를 생성할 수 있습니다.
- **제안**: `WorkflowHandler.validate()`에서 `timeout >= 0`을 허용하되, 엔진 내부에서 `0`을 실제로 무제한 대기로 변환하기 전에 최대 허용값 상한(예: 86400초)을 별도로 강제하는 것을 검토하세요.

---

**[INFO] `carousel.handler.ts` — URL 새니타이징 불완전 (기존 이슈)**

- **위치**: `carousel.handler.ts` — `sanitizeUrl()` 함수 (diff 외 기존 코드)
- **상세**: `sanitizeUrl`이 `javascript:` 스킴만 차단하고 `data:`, `vbscript:` 등 다른 위험 스킴은 허용합니다. 같은 파일 내 `validateItemButtons`에서는 세 가지 스킴 모두 검사하는 패턴이 올바르게 적용되어 있어, `sanitizeUrl`만 일관성이 부족한 상태입니다.
- **제안**: `sanitizeUrl`을 `validateItemButtons`의 패턴과 일치시킵니다:
  ```typescript
  function sanitizeUrl(url: string): string {
    if (/^(javascript|data|vbscript):/i.test(url.trim())) return '';
    return url;
  }
  ```

---

**[INFO] `__continue__` 센티널 ID 남용 가능성**

- **위치**: `use-execution-interaction-commands.ts` — `CONTINUE_BUTTON_ID = "__continue__"`, 엔진 버튼 처리 로직
- **상세**: `__continue__` ID가 특수 동작(continue 포트로 라우팅)을 트리거합니다. 만약 서버 측 버튼 클릭 처리 로직에서 해당 executionId에 대한 실제 버튼 목록과 `__continue__`의 허용 여부를 검증하지 않는다면, 인증된 사용자가 port-type 버튼만 있는 노드에서도 `__continue__`를 전송하여 의도치 않은 포트로 분기할 수 있습니다.
- **제안**: 서버 측 `execution.click_button` 핸들러에서 `__continue__` 수신 시 해당 노드의 버튼 구성이 link-only인지 검증하는 로직이 있는지 확인하세요.

---

**[INFO] `table.handler.ts` — 프로덕션 로그에 민감 데이터 노출 (기존 이슈)**

- **위치**: `table.handler.ts` — `safeEvaluate()` catch 블록 (diff 외 기존 코드)
- **상세**: `console.error`로 `ctx.$sourceItem`과 `ctx.$var` 전체를 JSON 직렬화하여 출력합니다. 이 데이터에는 개인정보나 업무 데이터가 포함될 수 있습니다.
- **제안**: 프로덕션 환경에서는 에러 요약만 로깅하거나, 구조화 로거의 민감 필드 마스킹을 적용하세요.

---

### 요약

이번 변경의 핵심 보안 이슈는 **서버 측 타임아웃 전면 제거로 인한 자원 고갈 위험**입니다. `pendingContinuations`에 저장된 실행 대기 엔트리들이 외부 cancel 없이는 무기한 메모리를 점유하며, WebSocket disconnect 시 자동 정리가 보장되는지가 이 diff만으로는 확인되지 않습니다. 클라이언트 사이드의 URL 검증(`isSafeButtonUrl`, `isSafeUrl`)과 서버 사이드의 URL 스킴 차단은 적절히 구현되어 있어 XSS 방어는 양호합니다. 하드코딩된 시크릿, SQL 인젝션, 인증 우회 등의 직접적인 취약점은 이 diff에서 발견되지 않았습니다.

### 위험도

**MEDIUM** — 타임아웃 제거로 인한 자원 고갈 가능성이 있으며, WebSocket 세션 정리 메커니즘의 보완 여부에 따라 실제 영향도가 결정됩니다.