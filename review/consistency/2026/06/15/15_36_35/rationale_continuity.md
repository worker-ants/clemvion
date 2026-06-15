# Rationale 연속성 검토 보고서

검토 모드: --impl-done  
diff-base: 015b11df38531ae9fd291d99e8634a21b4a8f8c7  
검토 대상 spec 영역: `spec/1-data-model.md`, `spec/3-workflow-editor/3-execution.md`

---

## 발견사항

### [WARNING] §1.3 단일 노드 테스트 구현 — C3 기각 결정의 번복 (새 Rationale 부재)

- **target 위치**: `spec/3-workflow-editor/3-execution.md §1.3 단일 노드 테스트`
- **과거 결정 출처**: `spec/5-system/13-replay-rerun.md §10 향후 확장` + `## Rationale "왜 C1 (전체 워크플로만) 인가"`
- **상세**:  
  replay-rerun spec 의 §10 기각 테이블은 C3 (`single-node debug`) 를 "입력 데이터 격리, downstream 미진행, **표현식 컨텍스트 mock** — 디버그 도구 plan 으로 분리" 라는 차단 사유와 함께 명시적으로 v1 제외로 기각했다.  
  그리고 "왜 C1 (전체 워크플로만) 인가" Rationale 에서 "resume-from-failure (C2) 는 엔진 안전성 검증이 별도 plan 분량이다. v1 에서는 전체 워크플로 Re-run 만으로도 use-case 의 80% 를 커버" 라고 명시해, C2/C3 전체를 후속 plan 으로 미뤘다.  
  target 의 현재 §1.3 은 이 기능을 "구현" 상태로 정의하고 `POST /api/workflows/:id/nodes/:nodeId/execute` 전용 엔드포인트를 제공한다. 이는 C3 의 재도입이다.  
  단, target Rationale 항의 구현 방식은 C3 의 차단 사유였던 "**표현식 컨텍스트 mock**" 대신 "**직속 predecessor 출력을 `nodeOutputCache`/`structuredOutputCache` 에 복원해 정상 실행과 동일하게 동작**" 으로 설계됐다. 이는 full mock 이 아닌 "predecessor output restoration" 경로를 채택한 것으로, 기각 사유를 기술적으로 해소했을 가능성이 있다. 그러나 target 의 `## Rationale` 에 "왜 C3 를 이제 채택하는가 / 기각 사유였던 표현식 컨텍스트 mock 을 어떻게 해소했는가" 를 설명하는 항이 **존재하지 않는다**.  
  또한 2026-06-03 spec-vs-code audit 의 Rationale 기록("미구현 항목: §1.3 단일 노드 테스트")과도 상충한다. 해당 기록은 §1.3 이 미구현임을 명문화했는데, 이제 구현 완료로 전환되면서 그 전환 근거가 Rationale 에 부재하다.
- **제안**:  
  `spec/3-workflow-editor/3-execution.md ## Rationale` 에 `### R-1.3 단일 노드 테스트 구현 — C3 채택 경위` 항을 추가한다. 내용에 포함할 사항:  
  (1) replay-rerun spec C3 의 차단 사유("표현식 컨텍스트 mock") 가 본 구현에서 왜 해소됐는지 — predecessor output restoration 이 full mock 을 대체하는 이유.  
  (2) v1 범위 한계(blocking 노드, 컨테이너 내부, 비인접 `$node[...]`) 가 기각 사유 중 어떤 부분을 여전히 defer 하는지.  
  (3) 2026-06-03 audit 의 "미구현" 기록이 현재 구현으로 전환된 계기.  
  아울러 `spec/5-system/13-replay-rerun.md §10` 의 C3 기각 테이블 행에 "(→ 3-execution §1.3 에서 predecessor-output-restoration 경로로 구현됨, 2026-06-15)" 같은 참조를 달아 두 문서의 정합성을 유지한다.

---

### [INFO] Execution.single_node_id / previous_execution_id 컬럼 — data-model Rationale 항 미작성

- **target 위치**: `spec/1-data-model.md §2.13 Execution` 의 `single_node_id`(V098) / `previous_execution_id`(V098) 컬럼 설명
- **과거 결정 출처**: `spec/1-data-model.md ## Rationale` (기존 mode-encoding 컬럼들에 대한 Rationale 선례 없음 — dry_run, re_run_of 도 본문 설명에 근거를 내포하되 별도 Rationale 항이 없다)
- **상세**:  
  `dry_run`(V068)·`re_run_of`·`chain_id` 등 기존 mode-encoding 컬럼들은 data-model Rationale 에 별도 항 없이 본문 설명에 설계 근거를 inline 했다. `single_node_id`·`previous_execution_id` 도 같은 패턴을 따라 본문에 inline 했으며 Rationale 항은 없다. 이는 기존 선례와 일관된 처리이므로 위반이라 보기 어렵다.  
  다만 `previous_execution_id` 가 "입력 주입 참조일 뿐 chain 관계가 아니다" 라는 설명이 `re_run_of`(직계 부모) 와의 의미 분리 근거를 inline 으로만 담고 있어, 추후 두 컬럼을 혼동하는 리더에게 불명확할 수 있다.
- **제안**:  
  강제는 아니나, `spec/1-data-model.md ## Rationale` 에 `### Execution.single_node_id / previous_execution_id (V098)` 항을 짧게 추가해 (a) `re_run_of` 와의 의미 차이, (b) FK 제약·인덱스를 두지 않은 이유(`re_run_of` 선례 및 디버그 전용 조회 패턴 부재)를 명시하면 rationale 정합성이 높아진다.

---

## 요약

가장 중요한 발견은 `spec/5-system/13-replay-rerun.md` 의 C3 (`single-node debug`) 기각 결정이다. 해당 spec 은 "표현식 컨텍스트 mock" 을 차단 사유로 명시하며 이 기능을 "디버그 도구 plan 으로 분리" 했고, 2026-06-03 audit Rationale 도 §1.3 을 미구현으로 명문화했다. 이번 구현 target 이 전용 엔드포인트(`POST /api/workflows/:id/nodes/:nodeId/execute`)와 `single_node_id`/`previous_execution_id` 컬럼으로 C3 를 실제 도입했으므로 결정 번복이 발생했다. 구현 접근법(predecessor output restoration, full mock 대신)이 기각 사유를 기술적으로 해소했을 가능성이 높고, 파괴적 위반이라기보다 이미 합의된 디버그 도구 plan 의 자연스러운 실현으로 볼 수 있다. 그러나 `spec/3-workflow-editor/3-execution.md ## Rationale` 에 C3 기각 번복의 근거와 replay-rerun spec 과의 조화를 설명하는 항이 없어 WARNING 등급으로 판정한다. 다른 발견사항(single_node_id / previous_execution_id Rationale 항 미작성)은 기존 선례와 일관된 패턴으로 INFO 수준에 머문다. Rationale 항 보완만으로 해소 가능하며 설계 결정 자체의 구조적 문제는 없다.

---

## 위험도

LOW
