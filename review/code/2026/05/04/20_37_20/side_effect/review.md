## 발견사항

### [WARNING] `describe` 블록 중복 — execution-engine.service.spec.ts
- **위치**: diff가 삽입하는 새 `describe('AI Agent multi-turn — execution.ai_message emit shape')` 블록 vs 전체 파일 컨텍스트에 이미 존재하는 동일한 블록
- **상세**: diff는 `Form node blocking` describe 직후(~line 902)에 새 블록을 삽입하지만, 전체 파일 컨텍스트를 보면 `Template node expression resolution` 아래에 동일한 이름·동일한 내용의 블록이 이미 존재한다. 결과적으로 `aiNodes` 정의, `makeAiAgentHandler`, `beforeEach`, 두 테스트 케이스가 파일 안에 두 번 존재하게 된다.
- **부작용**: 같은 테스트가 두 번 실행되고, 두 번째 블록의 `beforeEach`(`mockNodeRepo.findBy.mockResolvedValue(aiNodes)`)가 사이에 끼어 있는 다른 describe 블록(Template, Cyclic 등)의 테스트 순서에 의존하는 경우 잠재적 간섭이 생긴다. 중복이 의도가 아니라면 기존 블록이 제거되지 않고 누락된 것이다.
- **제안**: diff가 삽입하는 블록이 최신이라면, 파일 하단에 있는 기존 동일 블록을 삭제한다. 반대로 기존 블록을 유지하려면 diff 삽입 자체를 취소한다.

---

### [WARNING] 프로덕션 환경에서 레거시 페이로드가 무음(silent) 드롭됨 — use-execution-events.ts
- **위치**: `handleAiMessage` 내 새 early-return 조건 (`!Array.isArray(payload.messages) || payload.messages.length === 0`)
- **상세**: 이전에는 `messages` 배열이 없는 페이로드에 대해 단일 assistant 아이템을 폴백으로 추가했다. 이제는 해당 페이로드를 조용히 버린다. `console.warn`은 `process.env.NODE_ENV !== "production"` 조건 아래에만 발생하므로, **프로덕션에서 메시지 유실이 발생해도 사용자에게 아무 피드백이 없다**.
- **부작용**: 백엔드가 여전히 `messages` 없이 `execution.ai_message`를 보내는 코드 경로(예: 오래된 실행 엔진 버전, 부분 배포 중인 롤링 업데이트)가 존재할 경우, 대화 메시지가 프론트엔드에서 완전히 사라진다.
- **제안**: 백엔드가 항상 `messages`를 내려주는 것이 100% 보장된 상태임을 배포 파이프라인 수준에서 확인한다. 그렇지 않은 경우 롤아웃 기간 동안 폴백을 유지하거나, 최소한 프로덕션에서도 감지 가능한 에러 메트릭(Sentry 등)을 남긴다.

---

### [INFO] `messages: []`(빈 배열)도 invariant violation으로 취급
- **위치**: `use-execution-events.ts` — `payload.messages.length === 0` 조건
- **상세**: 비어 있는 messages 배열을 보내는 경우(예: 내부 전용 턴, 도구 전용 루프)가 실제로 존재하면 해당 페이로드 전체가 드롭된다.
- **제안**: 현재 백엔드 스펙에서 빈 배열이 유효한 경우가 없는지 확인한다. 없다면 현재 구현이 안전하다.

---

### [INFO] `warnSpy` 생성 위치 — use-execution-events.test.ts
- **위치**: 새로운 테스트 케이스 내 `try` 블록 안에서 `vi.spyOn` 호출
- **상세**: `warnSpy`는 `try` 블록 내부에서 생성되고 `finally`에서 복원된다. `vi.spyOn` 자체가 예외를 던지면 `warnSpy` 변수가 undefined인 채로 `finally`의 `warnSpy.mockRestore()`가 실행되어 TypeError가 발생할 수 있다. 실제로 발생 가능성은 매우 낮지만 방어적으로는 `try` 외부에서 spy를 생성하는 것이 안전하다.
- **제안**: `const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})` 라인을 `try` 블록 밖으로 이동한다.

---

### [INFO] `addConversationMessage` 제거 — use-execution-events.ts
- **위치**: 구조분해 (~line 96) 및 `useEffect` 의존성 배열 (~line 839)
- **상세**: 두 곳 모두 정확하게 제거되었고, 해당 함수를 참조하는 다른 코드 경로도 없다. 정리가 완전하다.

---

## 요약

이번 변경의 핵심은 `ai_message` 이벤트 처리를 `messages` 스냅샷 필수로 강제하는 것이며, 이를 백엔드 통합 테스트와 프론트엔드 훅·단위 테스트 세 군데에 걸쳐 일관되게 반영했다. 부작용 관점에서 가장 큰 위험은 두 가지다: (1) `spec.ts`에 동일한 describe 블록이 이중 삽입되어 기존 블록이 삭제되지 않은 것, (2) `use-execution-events.ts`에서 레거시 폴백 제거 후 프로덕션 환경에서는 경고 없이 메시지가 드롭될 수 있다는 점. 나머지 변경(의존성 배열 정리, 타입 좁히기)은 의도대로 동작하며 불필요한 부작용이 없다.

## 위험도

**MEDIUM**