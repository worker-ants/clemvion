## 발견사항

### [INFO] `chatParams` 스냅샷 시점과 실제 LLM 호출 불일치
- **위치**: `ai-agent.handler.ts`, `processMultiTurnMessage()` ~388행
- **상세**: `chatParams`는 LLM 호출 전에 `messages` 배열을 스프레드(`[...messages]`)로 복사하지만, 도구 호출 루프에서 `messages`가 변경된 후의 최종 상태가 아닌 첫 번째 호출 시점의 페이로드만 캡처됩니다. 도구 호출이 여러 번 발생하면 `lastTurnRequest`는 실제로 LLM에 보낸 마지막 요청과 다를 수 있습니다.
- **제안**: 도구 호출 루프가 끝난 후 실제 마지막 요청 파라미터를 캡처하거나, 디버깅 목적임을 주석으로 명시

---

### [INFO] `turnDurationMs` 측정 범위가 도구 호출 시간 포함
- **위치**: `ai-agent.handler.ts`, `turnStartedAt` / `turnDurationMs`
- **상세**: `turnStartedAt`은 첫 LLM 호출 전에 기록되고, `turnDurationMs`는 도구 호출 루프 포함 전체 턴 소요 시간을 측정합니다. 이는 순수 LLM 레이턴시가 아닌 턴 전체 소요 시간이므로 UI의 "Latency" 레이블과 의미가 다를 수 있습니다.
- **제안**: UI에서 레이블을 "Turn Duration"으로 표시하거나 순수 LLM 호출 시간만 별도로 측정

---

### [INFO] `execution.ai_message` 조건 변경 - 빈 메시지 허용
- **위치**: `use-execution-events.ts` ~231행
- **상세**: 기존 `if (!payload.message) return;`에서 `if (!payload.message && payload.message !== "") return;`으로 변경되어 빈 문자열 메시지가 허용됩니다. 실제로 AI가 빈 응답을 반환하는 경우(도구 호출만 있는 턴 등)에 빈 conversation item이 추가될 수 있습니다.
- **제안**: 의도적 변경이라면 문서화, 아니라면 원래 조건 유지

---

### [INFO] `requestPayload`에 민감 정보 노출 가능성
- **위치**: `ai-agent.handler.ts` ~479행, `use-execution-events.ts`, `conversation-inspector.tsx`
- **상세**: `lastTurnRequest`에는 전체 `messages` 배열이 포함되며, 여기에는 시스템 프롬프트(지식베이스 내용, RAG 컨텍스트 등)가 포함될 수 있습니다. 이 데이터가 WebSocket을 통해 프론트엔드에 그대로 전달되고 UI에 렌더링됩니다.
- **제안**: 클라이언트로 전송 시 민감한 시스템 프롬프트 내용 마스킹 또는 서버 사이드에서 필터링 검토

---

### [INFO] `SummaryView` 히스토리 모드의 `turnIndex` 계산 불일치
- **위치**: `conversation-inspector.tsx` SummaryView 내 items 생성 로직
- **상세**: 히스토리 모드에서 `turnIndex`를 `Math.floor(i / 2) + 1`로 계산합니다. 메시지 배열에 시스템 메시지가 필터링된 후 user/assistant만 남는다면 정확하지만, 도구 호출로 인해 assistant 메시지가 연속으로 존재하는 경우 인덱스가 틀릴 수 있습니다.
- **제안**: `type === "user"`일 때마다 카운터를 증가시키는 방식으로 변경

---

### [INFO] `SelectedItemDetail`의 탭 상태가 아이템 전환 시 초기화되지 않음
- **위치**: `conversation-inspector.tsx`, `SelectedItemDetail` 컴포넌트
- **상세**: `activeTab` 상태가 컴포넌트 내부에 있어, 다른 conversation item을 선택해도 탭 상태가 유지될 수 있습니다. React는 같은 위치의 같은 컴포넌트를 재사용하므로 이전에 "Request" 탭을 보다가 다른 메시지를 클릭해도 "Request" 탭이 유지됩니다.
- **제안**: `key={item.turnIndex}` 또는 `key={item.timestamp}`를 `SelectedItemDetail`에 전달하여 아이템 변경 시 상태 리셋

---

## 요약

이번 변경은 AI 대화 디버깅을 위한 메타데이터(request/response payload, 토큰 사용량, 레이턴시)를 백엔드에서 수집하여 WebSocket으로 전달하고 프론트엔드 UI에 탭 형태로 노출하는 기능입니다. 전반적으로 기존 실행 흐름을 변경하지 않고 데이터를 추가하는 방향이라 부작용 위험도는 낮습니다. 주요 관심사는 (1) `requestPayload`에 포함된 시스템 프롬프트 등 민감 정보의 클라이언트 노출, (2) 도구 호출 루프에서 첫 번째 요청만 캡처되는 디버깅 데이터 정확성, (3) UI의 탭 상태가 메시지 전환 시 초기화되지 않는 UX 이슈입니다. 이 중 보안 관련 사항은 운영 환경에서 검토가 권장됩니다.

## 위험도

**LOW**