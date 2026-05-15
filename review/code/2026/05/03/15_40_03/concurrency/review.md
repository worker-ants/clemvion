### 발견사항

- **[WARNING]** TOCTOU(Time-of-Check-Time-of-Use) 경쟁 조건
  - 위치: `execution-engine.service.ts` — `filterAiNoLlmProviderError` + 이후 노드 핸들러 실행 사이
  - 상세: `hasDefaultLlmConfig` 호출로 검증을 통과시킨 뒤, 실제 핸들러가 LLM config를 resolve하는 시점 사이에 workspace 기본 LLM이 삭제될 수 있다. 이 경우 validation은 `[]`을 반환해 통과하지만, 실행 시점에는 `LLM_CONFIG_NOT_FOUND`로 실패한다. 설계상 의도된 단순화(presence check only)임을 주석에서 인정하고 있으나, 오류 메시지가 달라져 상위 error policy handler가 다른 경로로 분기할 수 있다.
  - 제안: 완전한 해결보다는 방어적 처리로 충분하다 — LLM 핸들러 내부에서 `LLM_CONFIG_NOT_FOUND` 예외를 `INVALID_NODE_CONFIG`와 동일한 정책으로 처리하거나, `filterAiNoLlmProviderError` 결과를 execution context에 저장해 핸들러가 재사용하도록 한다.

- **[INFO]** 단일 실행 내 `hasDefaultLlmConfig` 반복 호출 — 결과 일관성 부재
  - 위치: `execution-engine.service.ts` — `filterAiNoLlmProviderError` (노드별 1회씩 호출)
  - 상세: `ai_agent` → `text_classifier` → `information_extractor` 3개 노드가 직렬 실행될 때, 동일 `workspaceId`에 대해 DB 쿼리를 3번 독립적으로 날린다. 실행 도중 기본 LLM이 삭제되면 앞 노드는 통과하고 뒤 노드는 차단되어 같은 실행 내에서 비대칭적인 결과가 발생한다.
  - 제안: `ExecutionContext`에 `hasDefaultLlmConfig` 결과를 lazily 캐시하거나, 실행 시작 시점에 1회 조회 후 context에 주입한다.

- **[INFO]** 프론트엔드 `defaultLlmConfigId` 쿼리 미완료 시 노드 추가 경쟁
  - 위치: `workflow-canvas.tsx` — `buildInitialConfig` 콜백
  - 상세: 컴포넌트 첫 렌더 직후 (쿼리 캐시 미스 상태)에 사용자가 AI 노드를 캔버스에 추가하면 `defaultLlmConfigId`가 `null`이므로 `llmConfigId`가 채워지지 않는다. 쿼리가 resolve된 후에는 기존 노드의 config가 소급 업데이트되지 않는다.
  - 제안: `isLoading` 또는 `isFetching` 상태일 때 노드 추가 버튼을 일시 비활성화하거나, 캔버스가 마운트될 때 쿼리를 prefetch/suspend 처리한다. 단, UX 영향이 작으므로 현재 수준도 수용 가능하다.

---

### 요약

변경 코드의 핵심 동시성 관심사는 `filterAiNoLlmProviderError`의 TOCTOU 패턴이다. `hasDefaultLlmConfig` 확인과 실제 LLM 호출 사이에 기본 설정이 변경될 수 있는 창이 존재하며, 동일 실행 내 복수 AI 노드에 대해 쿼리 결과가 일치하지 않을 수 있다. 다만 이는 기존 `resolveConfig → throw` 흐름과 의미적으로 동일한 수준의 race이며, 코드가 의도적으로 "presence check only"로 설계된 점을 감안하면 실제 피해 범위는 제한적이다. 데드락·뮤텍스 부재·이벤트 루프 블로킹 등 심각한 동시성 결함은 없다.

### 위험도
**LOW**