## 발견사항

### [WARNING] 프론트엔드 `STALL_MAX_ATTEMPTS` 상수 동기화 미보장
- **위치**: `frontend/src/lib/stores/assistant-store.ts` — `const STALL_MAX_ATTEMPTS = 2`
- **상세**: 백엔드의 `MAX_STALL_ROUNDS`와 동일한 값을 프론트에 하드코딩으로 복제했다. rehydrate 시 `"N/M"` 포맷에 사용되는 `max` 값이 이 상수에서 파생되는데, 백엔드가 변경되고 프론트가 업데이트되지 않으면 기존 DB 행의 divider가 잘못된 분모를 표시한다. 타입시스템이나 빌드 시 이 불일치를 잡을 방법이 없다.
- **제안**: 공유 상수 패키지로 추출하거나, 백엔드 API 응답에 `max` 값을 항상 포함시켜 rehydrate 시 서버 값을 그대로 사용하도록 변경. (실시간 경로는 이미 SSE `auto_resume.data.max`를 사용하므로 영향 없음)

---

### [WARNING] 중간 persist 실패 시 클라이언트-DB 상태 비대칭
- **위치**: `workflow-assistant-stream.service.ts` 스톨 복구 블록 — step (A) `await persistAssistantTurn(...)` → step (B) `yield { event: 'auto_resume', ... }`
- **상세**: 중간 row를 DB에 먼저 기록한 후 `auto_resume` SSE를 발행하는 순서는 올바르다. 그러나 `persistAssistantTurn` 가 DB 장애로 throw하면 SSE 스트림 자체가 에러 종료되어 프론트는 `auto_resume` 이벤트를 받지 못한다. 반대로 persist가 성공하고 SSE yield 직후 네트워크가 끊기면 프론트는 분리 신호를 놓친 채 다음 round delta를 기존 버블에 누적한다. 이 경우 rehydrate 시에는 DB의 두 row가 올바르게 표시되지만 스트리밍 세션 중 버블이 합쳐지는 시각적 불일치가 발생한다.
- **제안**: 현행 구조에서 완전히 방지하기 어려우나, 문서화는 필요하다. 네트워크 단절 감지 후 세션 재연결 시 rehydrate가 올바른 분리 상태를 복원하므로 최종 UX 영향은 제한적이다.

---

### [WARNING] `sendMessage` 종료 시 스트리밍 플래그 일괄 정리 — 범위 확장
- **위치**: `frontend/src/lib/stores/assistant-store.ts` — `sendMessage` 마지막 `set` 블록
- **상세**: 기존 코드는 `m.id === assistantId`(원본 ID 한 건)만 `streaming: false`로 정리했다. 변경 후 `m.streaming ? { ...m, streaming: false } : m`으로 모든 streaming 메시지를 일괄 처리한다. 의도는 `auto_resume`으로 생성된 추가 버블을 정리하기 위함이며 동일 세션 단일 스트림 구조에서는 안전하다. 다만 이론적으로 다중 탭에서 동일 Zustand 스토어를 공유하거나 future에 병렬 스트림이 생기는 경우 의도치 않은 버블이 종료될 수 있다.
- **제안**: 현재 구조(단일 세션, 단일 스트림)에서는 허용 가능하나, 주석에 "이 세션의 스트림만 대상"임을 명시. 장기적으로 `sendMessage` 호출 시 생성된 message ID 목록을 추적해 해당 ID들만 정리하는 것이 더 명확하다.

---

### [WARNING] 재개된 라운드의 tool_call이 rehydrate 시 plan step 완료 상태에 미반영될 가능성
- **위치**: `frontend/src/lib/stores/assistant-store.ts` — `hydrateMessage`
- **상세**: `hydrateMessage`는 동일 메시지 row의 `toolCalls`만 참조해 plan step 완료 상태를 재구성한다. 만약 같은 턴에서 `propose_plan`이 호출된 뒤 stall이 발생하면, plan은 중간 row(첫 번째 분리 row)에 기록되고 plan step을 완료시키는 tool call은 최종 row에 들어간다. rehydrate 시 중간 row의 plan card는 해당 step들을 여전히 `pending`으로 표시한다.
- **상세2**: 실제로 이 시나리오는 `planProposedPendingApproval` 가드로 인해 "propose_plan + 미승인 + 동일 턴 stall"이 불가능하므로 발생 빈도는 극히 낮다.
- **제안**: 안전망으로 `loadSession` 후 모든 메시지에 걸쳐 `toolCalls`를 집계해 plan step을 재구성하는 cross-message aggregation 로직을 별도 패스로 추가 검토.

---

### [INFO] `persistAssistantTurn` 시그니처 확장 — 하위 호환 유지
- **위치**: `workflow-assistant-stream.service.ts` 약 1084라인
- **상세**: 새 `resumeMeta` 파라미터가 기본값을 가지므로 기존 호출부는 자동으로 호환된다. diff를 보면 실제로 에러 경로 두 곳과 최종 persist 모두 명시적으로 업데이트되어 누락 없음.
- **제안**: 없음 (올바르게 처리됨).

---

### [INFO] 빈 intermediate row 생성 가능성
- **위치**: `workflow-assistant-stream.service.ts` — stall 복구 블록 step (A)
- **상세**: stall 판정 시점에 LLM이 텍스트와 tool call을 모두 생성하지 않았다면 `assistantText = ''`, `pendingToolCalls = []`인 채로 중간 row가 persist된다. gpt-oss-120b의 stall quirk는 "텍스트는 생성하나 tool call 없음"이 전형적이므로 대부분 텍스트가 있지만, 완전히 빈 라운드도 이론상 가능하다.
- **제안**: persist 전에 `assistantText.trim() || pendingToolCalls.length > 0` 가드를 추가해 완전히 빈 row 생성을 방지하는 것을 고려.

---

## 요약

이번 변경은 백엔드의 stall 자동 복구 경계에서 DB row 분리 + SSE 신호 발행, 프론트의 버블 분리 처리로 구성된 전체적으로 설계가 탄탄한 구현이다. 마이그레이션의 `DEFAULT FALSE / NULL` 설정으로 기존 데이터 호환성이 유지되고, `persistAssistantTurn` 시그니처 확장도 기본값으로 안전하게 처리되었다. 주요 부작용 위험은 (1) 프론트의 `STALL_MAX_ATTEMPTS` 상수가 백엔드와 암묵적 커플링을 형성한다는 점, (2) 스트리밍 종료 후 일괄 streaming 플래그 정리가 기존보다 넓은 범위를 커버한다는 점 두 가지이며, 현재 아키텍처(단일 세션, 단일 스트림)에서는 실질적 위험은 낮다.

## 위험도

**LOW**