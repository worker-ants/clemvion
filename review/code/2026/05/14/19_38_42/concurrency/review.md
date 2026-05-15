## 발견사항

### 테스트 파일 (files 1-8)

해당 없음. `createEmptyConversationThread()`를 `ExecutionContext` 픽스처에 추가하는 변경이며, 순수 테스트 픽스처 구성으로 동시성과 무관합니다.

---

### spec/5-system/4-execution-engine.md (file 43)

- **[WARNING]** Background 스냅샷 copy 깊이 — turn 내 중첩 가변 객체
  - 위치: `§3.3 Background` 스냅샷 설명 (`{ ...thread, turns: [...thread.turns] }`)
  - 상세: 새 배열을 생성하지만 배열 내 각 `ConversationTurn` 객체는 동일 참조를 공유합니다. `ConversationTurn` 스펙(seq, nodeId, text, timestamp 등 모두 primitive)상 현재는 안전하지만, `data` 필드(form 제출 payload)가 중첩 객체를 담을 경우 background 실행이 해당 객체를 mutate하면 main thread의 turn도 오염됩니다. `ConversationTurn` 불변성(append-only, no post-creation mutation)이 구현 레벨에서 강제되는지 스펙에 명시가 없습니다.
  - 제안: `ConversationTurn` 타입을 `Readonly<ConversationTurn>`으로 선언하거나, `data` 필드에 `Object.freeze()` 적용을 `append*` 메서드 계약에 명시하여 shallow array copy만으로 격리가 보장됨을 문서화할 것.

- **[INFO]** `ConversationThreadService.append*` — 동시 append 시 `nextSeq` 원자성 미명시
  - 위치: `§6.1` 설명 `"ConversationThreadService.append* 가 mutation 단일 진입점"`
  - 상세: 병렬 브랜치(Loop 분기, 동시 AI Agent 등)에서 두 노드가 동시에 `append*`를 호출하면 `nextSeq` 카운터에 대한 경쟁 조건이 발생할 수 있습니다. Redis를 백킹 스토어로 사용하므로 `INCR`/`WATCH-MULTI-EXEC` 등 원자적 연산으로 해결 가능하지만, 스펙이 이 동기화 메커니즘을 명시하지 않아 구현자가 단순 메모리 카운터로 잘못 구현할 위험이 있습니다.
  - 제안: `ConversationThreadService.append*` 계약에 "Redis atomic increment (INCR) 또는 실행 컨텍스트 단일 스레드 보장 하에 호출" 조건을 명시할 것.

---

### 나머지 파일 (plan, review, 기타 spec)

해당 없음. 모두 마크다운 문서 파일입니다.

---

## 요약

변경된 TypeScript 파일은 모두 테스트 픽스처 추가로 동시성과 무관합니다. 스펙 문서(`execution-engine.md`) 변경 중 Background 격리에서 `{ ...thread, turns: [...thread.turns] }` 방식의 shallow array copy를 도입한 부분이 동시성 설계상 의미 있는 변경입니다. 현재 `ConversationTurn` 필드 구성(primitive)으로는 안전하지만, `data` 필드의 중첩 객체 불변성 보장과 `append*`의 `nextSeq` 원자성이 구현 명세에 명시되지 않아 구현 시 오해 여지가 있습니다. 실제 구현 코드가 아닌 스펙 문서 수준의 변경이므로 즉각적 버그 위험은 낮습니다.

## 위험도

**LOW**