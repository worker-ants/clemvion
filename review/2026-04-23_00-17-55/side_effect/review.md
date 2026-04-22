### 발견사항

---

**[WARNING] LABEL_CONFLICT 실패를 `recentFailedAddNodeLabels`에 추가해 misleading hint 유발 가능**
- 위치: `shadow-workflow.ts` `addNode()` — LABEL_CONFLICT 분기
- 상세: `LABEL_CONFLICT`는 "노드 생성 실패"가 아니라 "해당 label을 가진 노드가 이미 존재"를 의미한다. 그럼에도 `recordFailedAddNode(label)`을 호출해 큐에 적재한다. 이후 `add_edge`가 `NODE_NOT_FOUND`를 뱉을 때 hint 메시지는 *"The UUID you are referencing does not exist because that node was never created"*라고 출력하는데, LABEL_CONFLICT인 경우엔 동일 label의 노드가 이미 존재하므로 LLM이 해당 기존 노드의 UUID를 참조했을 수 있어 hint가 오해를 유발할 수 있다.
- 제안: `LABEL_CONFLICT` 분기에서는 `recordFailedAddNode`를 호출하지 않거나, hint 문구를 "a prior `add_node` returned an error" 수준으로 완화해 LABEL_CONFLICT와 UNKNOWN_NODE_TYPE을 구분한다.

---

**[WARNING] `isRecoveredLater`의 `add_edge` 복구 판정이 camelCase 인수를 무시**
- 위치: `review-workflow.ts` `isRecoveredLater()` — `add_edge` 분기
- 상세: `addEdge()`는 `source_id`와 `sourceId` 두 형태를 모두 허용하지만, `isRecoveredLater`는 `source_id`/`target_id`(underscore)만 비교한다. LLM이 camelCase 인수로 add_edge를 재시도하면 복구로 인식하지 못해 `UNRESOLVED_FAILED_CALLS`를 false positive로 올린다.
- 제안:
  ```typescript
  const src = (laterArgs.source_id ?? laterArgs.sourceId);
  const tgt = (laterArgs.target_id ?? laterArgs.targetId);
  const argSrc = (args.source_id ?? args.sourceId);
  const argTgt = (args.target_id ?? args.targetId);
  if (src === argSrc && tgt === argTgt && ...) return true;
  ```

---

**[INFO] `FinishGuardError` 타입 widening — 서비스 내부 한정이므로 안전**
- 위치: `workflow-assistant-stream.service.ts` line ~45
- 상세: `FinishGuardError`가 단일 interface에서 discriminated union으로 변경됐다. 파일 내부에서만 사용되고, 호출부는 값을 그대로 JSON 직렬화해 LLM에 전달하므로 `.pendingSteps` 같은 필드에 직접 접근하는 코드가 없다. 실질적 영향 없음.
- 제안: 없음.

---

**[INFO] 한국어 어미 미분리로 `REQUEST_COVERAGE_LOW` 과다 경고 가능성**
- 위치: `review-workflow.ts` `tokenize()`
- 상세: `/[가-힣]+/`는 조사 포함 어절 전체를 하나의 토큰으로 처리한다. "설문조사를"이 토큰으로 들어오면 노드 label의 "설문조사"와 일치하지 않아 coverage를 과소 계산한다. 이 체크는 `blocking: false`이므로 운영에 영향은 없으나 노이즈 경고가 빈번할 수 있다.
- 제안: 한국어 형태소 분석 라이브러리 도입 또는 `REQUEST_COVERAGE_THRESHOLD`를 낮추거나 (현 0.3은 이미 낮지만), substring 기반 partial match로 보완.

---

**[INFO] `schemaCache` 객체 직접 변이 (`cached.hits += 1`)**
- 위치: `workflow-assistant-stream.service.ts` — `get_node_schema` 처리 분기
- 상세: `schemaCache.get(typeArg)`로 얻은 참조를 직접 변이한다. 클로저 내 로컬 Map이고 외부로 노출되지 않으므로 의도된 동작이며 부작용 없음. 다만 결과 객체(`cached.result`)가 mutable reference로 공유돼 나중에 spread로 복사(`{ ...cached.result }`)하지 않고 수정된다면 오염될 수 있다. 현재 코드는 `{ ...(cached.result as ...), warning: ... }`로 얕은 복사를 하므로 안전.
- 제안: 없음.

---

### 요약

이번 변경은 `ShadowWorkflow`에 두 개의 인스턴스-scoped 상태(`labelConflictCounts`, `recentFailedAddNodeLabels`)를 추가하고, 서비스 레이어에 턴-scoped `schemaCache`와 review guard 플래그를 도입한다. 새 전역 상태나 모듈-레벨 변이는 없으며, `review-workflow.ts`의 함수들은 순수 함수로 작성되어 있어 부작용이 없다. 주요 리스크는 두 가지: LABEL_CONFLICT 실패를 NODE_NOT_FOUND hint에 끌어들여 LLM에게 오해를 줄 수 있는 점, 그리고 `isRecoveredLater`의 camelCase 인수 미처리로 인한 false positive `UNRESOLVED_FAILED_CALLS` 경보이다. 두 이슈 모두 시스템 정확성보다 LLM 재시도 품질에 영향을 미치며, 운영 안정성에 직접적인 위협은 없다.

### 위험도
**LOW**