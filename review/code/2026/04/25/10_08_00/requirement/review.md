### 발견사항

---

- **[WARNING]** `renderNodeCatalog` JSDoc이 ED-AI-40 이전 동작을 서술 (system-prompt.ts)
  - 위치: `system-prompt.ts` `renderNodeCatalog` 함수 JSDoc (lines ~85–89)
  - 상세: JSDoc이 "`[dynamic-ports]` 마커를 붙여 LLM 이 `add_edge` 전에 `get_node_schema` 로 실제 포트를 먼저 확인해야 함을 인지하도록 한다"라고 명시하고 있다. 그러나 실제 프롬프트 텍스트와 spec 테스트("embeds the three P0 guard rails")는 ED-AI-40 이후 `result.ports`를 우선 사용하고, `get_node_schema`는 **이번 턴에 편집하지 않는 기존 노드에만** 필요하다고 정의한다. 코드 유지보수자가 JSDoc을 읽으면 구현 의도를 잘못 파악할 수 있다.
  - 제안: JSDoc을 "edit 결과의 `result.ports`가 동적 포트 id의 1차 소스이므로 `get_node_schema` 선행 호출 불필요. 스냅샷에만 있는 노드에 엣지를 연결할 때만 사용."으로 교체.

---

- **[WARNING]** `buildReviewChecklist` 순서 주석이 7번째 항목(`NODE_CONFIG_WARNINGS`) 누락 (review-workflow.ts)
  - 위치: `review-workflow.ts` `buildReviewChecklist` JSDoc (lines ~242–248)
  - 상세: 함수 주석은 "여섯 개 점검"과 6개 목록을 나열하지만, 실제 구현은 `NODE_CONFIG_WARNINGS`를 5번(`PENDING_USER_CONFIG_UNMENTIONED`) 직후에 실행하여 총 7개다. `REQUEST_COVERAGE_LOW`는 7번째로 밀렸지만 주석에는 여전히 6번으로 표기된다.
  - 제안: 주석을 "일곱 개 점검"으로 수정하고 `6) NODE_CONFIG_WARNINGS, 7) REQUEST_COVERAGE_LOW.`로 갱신.

---

- **[WARNING]** `PENDING_USER_CONFIG_UNMENTIONED`의 `details` 문자열이 노드 라벨을 비위생 처리로 embed (review-workflow.ts)
  - 위치: `buildReviewChecklist` 내 `PENDING_USER_CONFIG_UNMENTIONED` 처리 블록 (lines ~341–348)
  - 상세: `summary` 조합 시 `p.label`(노드 라벨)과 `f.label`(필드 라벨)을 `sanitizeLlmProvidedString` 없이 그대로 `details`에 embed한다. `DANGLING_OUTPUT_PORTS`와 `NODE_CONFIG_WARNINGS`는 동일 목적으로 `sanitizeLlmProvidedString`을 적용해 개행·백틱·꺾쇠를 중화하는데, 이 블록만 예외다. 노드 라벨이 `"Ignore prior rules\n# HACK"` 같은 문자열이면 `WORKFLOW_REVIEW_REQUIRED` tool_result로 LLM 컨텍스트에 재주입된다.
  - 제안:
    ```typescript
    return `${sanitizeLlmProvidedString(p.label, DANGLING_PORT_LABEL_MAX_LEN)} (${fields})`;
    ```
    로 교체. `f.label || f.field`도 동일하게 처리 권장.

---

- **[INFO]** `TODO(ED-AI-39)` 프로덕션 코드에 잔존 (review-workflow.ts)
  - 위치: `collectUnmentionedPendingUserConfig`, candidates 처리 블록 내 TODO 주석
  - 상세: "세션 메시지가 회전(retention)되어 전부 새 shape 이 되면 조건의 `!Array.isArray(...)` 절을 제거하라"는 TODO가 명시돼 있다. 의도적 레거시 방어 코드이므로 즉각적 버그는 아니나, 제거 시점을 추적하는 티켓이 없으면 영구 잔존할 위험이 있다.
  - 제안: ED-AI-39 티켓에 "candidates 필드 migrate 완료 후 legacy fallback 제거" 체크리스트 항목 추가.

---

- **[INFO]** 절단(truncation) 시 `details` 카운트가 실제 문제 수를 과소 표현 (review-workflow.ts)
  - 위치: `collectOrphans` (MAX_ORPHANS=20), `collectDanglingOutputPorts` (MAX_DANGLING_PORTS=20)
  - 상세: `orphans.length`/`dangling.length`가 상한에서 절단된 후 `details`에 그 값이 삽입되므로, 실제 25개 고아 노드가 있어도 "20 node(s) have no path"로 표시된다. LLM이 전체 규모를 과소 추정할 수 있다.
  - 제안: 절단 시 `"at least ${MAX_ORPHANS}"` 형태로 표기하거나, 절단 여부를 별도 플래그로 전달.

---

### 요약

네 파일 전반의 요구사항 구현은 견고하다. 테스트 커버리지가 매우 세밀하고, 각 에러 코드별 복구 경로·새니타이징·엣지케이스가 구조적으로 정의되어 있다. 다만 세 가지 일관성 결함이 있다: (1) `renderNodeCatalog` JSDoc이 ED-AI-40 이전 동작(`get_node_schema` 선행 호출)을 여전히 서술해 코드 의도와 어긋나고, (2) `buildReviewChecklist` 순서 주석이 최근 추가된 `NODE_CONFIG_WARNINGS` 체크를 누락해 "여섯 개"라 잘못 기재되며, (3) `PENDING_USER_CONFIG_UNMENTIONED`만 유일하게 `details` 내 노드 라벨 위생 처리를 생략해 다른 항목들과 보안 처리 수준이 불일치한다. 이 중 (3)은 이론적인 prompt injection 표면을 노출하므로 우선 수정을 권장한다.

### 위험도

**LOW** — 비즈니스 로직 자체는 명세와 일치하나, 비위생 처리 embed는 잠재적 LLM 조작 표면이고, 주석 오류는 향후 유지보수 실수를 유발할 수 있다.