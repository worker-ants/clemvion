## 성능 코드 리뷰

### 발견사항

---

- **[WARNING] Progress-aware 가드로 인한 LLM API 라운드 트립 증가**
  - 위치: `workflow-assistant-stream.service.ts`, `evaluateFinishGuard` + while 루프
  - 상세: 구 가드(`finishBlockCount > 0 → 탈출`)는 턴당 최대 2회 LLM 호출을 보장했다. 신규 가드는 edit/plan 성공이 있으면 다시 block하므로, N개 step을 LLM이 1개씩 나눠 실행하면 N+1회 API 호출이 발생한다. 각 라운드는 이전 라운드의 assistant 메시지 + tool result를 `messages` 배열에 누적하므로, k번째 라운드에 LLM이 받는 컨텍스트 토큰 수는 라운드 수에 비례해 선형 증가한다. 결과적으로 N 라운드 전체의 총 input token 사용량은 O(N²)에 가깝다.
  - 제안: 설계상 의도된 트레이드오프(plan 완성도 vs 지연/비용)이므로 제거 대상은 아니나, `computeToolCallsBudget`의 상한(hard-cap 200) 외에 **라운드 횟수 상한**(`maxRoundsPerTurn`)을 별도로 두어 비용 예측 가능성을 확보하는 것을 권장한다. 현재는 budget 소진이 유일한 안전망이다.

---

- **[INFO] `messages` 배열의 라운드 간 누적 증가 (기존 구조 + 신규 가드 결합)**
  - 위치: `workflow-assistant-stream.service.ts`, while 루프 내 `messages.push(...)` 블록
  - 상세: 매 라운드마다 `messages`에 assistant 턴 + tool result 목록이 추가된다. progress-aware 가드가 추가 라운드를 허용함에 따라, 라운드 수가 증가할수록 context 크기가 함께 증가한다. 10-step plan에서 step-by-step 실행 시 round 10의 LLM 요청에는 9개 라운드의 누적 메시지가 포함된다. 이 구조는 기존 설계이나, 신규 변경으로 실제 도달 라운드 수가 늘어났다.
  - 제안: 현 아키텍처 내에서는 `MAX_HISTORY_TURNS`처럼 **라운드 간 중간 메시지 트리밍** 전략(완료된 edit tool result는 요약 결과만 유지 등)을 검토할 수 있다. 즉각 조치는 불필요하나 plan 규모가 커질수록 모니터링이 필요하다.

---

- **[INFO] `hasEditThisTurn` O(n) 선형 스캔**
  - 위치: `assistant-store.ts`, `done` 이벤트 핸들러 내 `updated.toolCalls.some((tc) => tc.kind === "edit")`
  - 상세: `done` 이벤트 발생 시 매번 toolCalls 전체를 순회한다. 턴당 tool call 수가 `toolCallsBudget`(기본 48)으로 제한되어 있으므로 실용적 성능 영향은 없다.
  - 제안: 현재 규모에서는 문제없음. 향후 toolCalls 크기가 커진다면 streaming 중 `kind === 'edit'` 여부를 별도 플래그로 누적하는 방식이 효율적이다.

---

- **[INFO] 테스트 파일 복잡 정규식 백트래킹 (비프로덕션)**
  - 위치: `system-prompt.spec.ts`, 새 테스트 케이스의 regex 패턴
  - 상세: `/plan[- ]only turn[s]?[^\n]*(?:do not|must not)\s+emit|(?:do not|must not)\s+emit[^\n]*plan[- ]only/`는 교차(`|`) + 양방향 패턴으로 worst-case 백트래킹이 발생할 수 있다. 프로덕션 코드가 아니므로 영향은 없으나, 긴 시스템 프롬프트 문자열에 적용 시 테스트 실행 시간에 미미한 영향을 준다.
  - 제안: 단일 방향 패턴 두 개로 분리(`expect(prompt).toMatch(A); expect(prompt).toMatch(B)`)하면 의도도 명확해지고 백트래킹 위험도 제거된다.

---

### 요약

이번 변경의 핵심인 `progress-aware finish guard`는 의도적으로 LLM 라운드 트립을 늘리는 설계다. 각 추가 라운드는 실제 API 호출 비용과 누적 컨텍스트 토큰 증가를 수반하며, 최악 케이스(N step plan, step-by-step 실행)에서 총 토큰 소비는 O(N²) 패턴에 가깝다. 이는 `toolCallsBudget`(hard-cap 200)으로 상한이 설정되어 무한 루프 위험은 없으나, plan 규모가 커질수록 단일 턴 비용이 비선형적으로 증가한다. 프론트엔드(`assistant-store.ts`)의 변경은 O(1)~O(n) 수준의 단순 조건 추가로 성능 영향이 없다. 전반적으로 성능 위험보다 UX 개선 가치가 크고 안전 장치도 존재하나, 라운드 수 상한을 budget과 별개로 명시적으로 관리하는 구조를 중기적으로 검토할 것을 권장한다.

### 위험도

**LOW**