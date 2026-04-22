### 발견사항

- **[INFO]** `planProposedPendingApproval` 가드는 로컬 변수(`planForTurn`, `finishReason`)만 참조
  - 위치: `stream.service.ts` — `shouldContinueLoop` 계산 직전 블록
  - 상세: `planForTurn`은 현재 `streamMessage` 호출의 스택 프레임에만 존재하며, `finishReason`도 루프 반복마다 재초기화되는 로컬 변수. `for await...of` 루프가 단일 코루틴 내에서 순차 실행되므로 중간에 다른 코드가 끼어드는 구간이 없음. 변수 mutation 순서(루프 내 `finishReason = 'tool_calls'` → `done` 이벤트 핸들러 → 루프 외 덮어쓰기)도 완전히 직렬.
  - 제안: 없음 (정상)

- **[WARNING]** 동일 `sessionId`에 대한 동시 요청 시 `appendMessage` 경쟁 조건 (기존 아키텍처 이슈)
  - 위치: `persistAssistantTurn` → `sessionService.appendMessage`
  - 상세: 이번 변경이 도입한 문제는 아님. 그러나 `@Injectable()` singleton 서비스에서 같은 세션 ID로 두 개의 HTTP 요청이 동시에 `streamMessage`를 호출하면, 둘 다 같은 `loadMessages` 스냅샷을 읽고 각자의 어시스턴트 메시지를 append함. 새 가드(`planProposedPendingApproval`)는 로컬 변수 기반이라 이 race에 노출되지 않지만, 세션 단위 직렬화(세마포어, 락 등)가 없으면 중복 persist 가능성이 남아 있음.
  - 제안: 세션 레벨에서 동시 요청을 직렬화하는 메커니즘(예: Redis 기반 세션 락, 또는 클라이언트 측 단일 요청 보장)을 고려. 단, 이번 변경 범위 밖의 사전 이슈임.

---

### 요약

이번 변경(Gemini-3-flash 핑퐁 루프 차단 가드)은 모두 `streamMessage` 한 번의 호출 스코프 안에서 로컬 변수만 조작하며, JavaScript 이벤트 루프의 협력적 스케줄링 특성상 단일 코루틴 내 변수 접근에는 경쟁 조건이 발생하지 않는다. 추가된 `planProposedPendingApproval` 플래그, `finishReason` 덮어쓰기, `shouldContinueLoop` 단락 조건 모두 순차 직렬 실행이 보장된다. 유일한 잠재적 동시성 위험은 이번 변경 이전부터 존재하는 동일 세션 동시 요청 시 DB append 경쟁 조건이며, 신규 가드 로직은 이 문제를 악화시키지 않는다.

### 위험도
**LOW**