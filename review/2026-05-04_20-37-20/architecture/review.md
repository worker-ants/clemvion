### 발견사항

---

**[INFO] 레거시 폴백 제거 — 하위 호환 계약 파기 타이밍**
- 위치: `use-execution-events.ts` diff, `handleAiMessage` (line ~309–362)
- 상세: `addConversationMessage` 기반의 단일 assistant 폴백 경로를 삭제하고, `messages` 배열 부재 시 즉시 드롭(경고)하도록 교체했다. 이는 계약 강화(invariant assertion)이지만, 프런트엔드와 백엔드가 동일 배포 단위가 아닌 경우(예: 점진적 롤아웃, CDN 캐시, 브라우저 탭 재로딩) 구버전 백엔드와의 일시적 불일치 기간 동안 AI 메시지가 무음으로 누락될 수 있다. `console.warn`은 개발 전용으로 제한되어 있어 프로덕션에서는 무증상으로 실패한다.
- 제안: 배포 동기화를 보장할 수 없다면, `process.env.NODE_ENV !== "production"` 경고와 함께 **최소한 실행 로그/모니터링 카운터**를 추가할 것. 또는 feature flag로 폴백 경로를 일정 기간 유지하고, 구 버전 백엔드가 완전히 퇴역 후 제거하는 것이 더 안전한 전이 전략이다.

---

**[WARNING] 테스트가 서비스 내부 emit 형태를 직접 어서션 — 계약 레이어 부재**
- 위치: `execution-engine.service.spec.ts`, 새 `describe` 블록 (line ~902+)
- 상세: 테스트가 `mockWebsocketService.emitExecutionEvent.mock.calls`를 필터링해 `call[1] === 'execution.ai_message'`를 검사하고, `call[2]` 페이로드를 직접 `Record<string, unknown>`으로 캐스팅해 검증한다. 이는 WebSocket 이벤트 페이로드 구조가 서비스 내부 구현 세부사항으로 테스트에 노출됨을 의미한다. 페이로드 형태가 바뀌면 이 테스트가 실패하지만, **정작 변경의 영향을 받는 프런트엔드 파싱 로직과의 계약**은 별도 타입 없이 문자열 비교와 `as` 캐스팅으로만 검증된다.
- 제안: `AiMessagePayload` 같은 공유 DTO/인터페이스를 `@shared` 패키지 또는 백엔드 이벤트 타입 파일에 정의하고, 서비스 emit과 테스트 어서션 모두 해당 타입을 참조하도록 단일화하면 계약이 타입 시스템으로 강제된다.

---

**[WARNING] 테스트 내 `makeAiAgentHandler` 팩토리 — 핸들러 인터페이스 확장 패턴 우회**
- 위치: `execution-engine.service.spec.ts` `makeAiAgentHandler` 함수
- 상세: `NodeHandler` 인터페이스를 `as unknown as NodeHandler & { processMultiTurnMessage: jest.Mock; endMultiTurnConversation: jest.Mock; }` 이중 캐스팅으로 확장한다. 이는 `NodeHandler` 인터페이스가 멀티턴 관련 메서드를 포함하지 않아 타입 시스템을 우회해야만 테스트가 가능한 상황을 드러낸다. 인터페이스와 구현 간 불일치가 숨겨져 있다.
- 제안: `MultiTurnNodeHandler extends NodeHandler` 같은 서브인터페이스를 정의하거나, 엔진이 멀티턴 메서드를 타입 가드로 확인하는 패턴을 인터페이스에 명시화하면 이중 캐스팅 없이 테스트 가능하다.

---

**[INFO] `handleAiMessage` 의존성 배열 축소 — 정확성 개선**
- 위치: `use-execution-events.ts` diff, `useCallback` 의존성 배열 (line ~362)
- 상세: `addConversationMessage` 제거로 `useCallback` 의존성 배열이 `[setConversationMessages, updateConversationConfig]`로 축소됐다. 이는 불필요한 리렌더링 방지 측면에서 긍정적이다.
- 제안: 없음. 올바른 방향.

---

**[INFO] 테스트 중복 — 동일 `describe` 블록이 파일 내 두 번 출현**
- 위치: `execution-engine.service.spec.ts` 전체 파일 컨텍스트 (line ~902와 그 이후 중복 위치)
- 상세: diff로 추가된 `describe('AI Agent multi-turn — execution.ai_message emit shape', ...)` 블록이 전체 파일 컨텍스트에서 두 번 나타난다. 파일 구조상 동일 describe가 중복 등록된 것으로 보인다. 테스트 러너에서 케이스가 두 번 실행되거나 `beforeEach` mock 리셋이 의도치 않게 공유될 수 있다.
- 제안: 파일 실제 내용을 확인해 중복 블록 제거 필요.

---

### 요약

이번 변경의 핵심은 `execution.ai_message` 이벤트 핸들러에서 레거시 단일-메시지 폴백 경로를 제거하고 `messages` 배열을 필수 인변리언트로 승격한 것이다. 아키텍처 관점에서 계약 강화 방향은 올바르나, 백엔드-프런트엔드 간 배포 동기화 보장이 없다면 점진적 롤아웃 구간에서 무음 실패가 발생할 수 있고, 이벤트 페이로드 형태가 공유 타입 없이 `as` 캐스팅과 문자열 상수로만 검증되는 구조는 계약 드리프트에 취약하다. `NodeHandler` 인터페이스가 멀티턴 메서드를 포함하지 않아 테스트에서 이중 캐스팅을 강제하는 부분은 인터페이스 설계 개선이 필요한 신호다.

### 위험도

**LOW**