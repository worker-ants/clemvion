### 발견사항

- **[INFO]** 의도된 변경 범위와 실제 변경 파일 집합이 일치함
  - 위치: 전체 변경 파일 목록
  - 상세: plan(`spec-update-pr4b-embedding-retire.md`)이 명시한 적용 위치 표(§1~§6, CHANGELOG)와 실제 수정 파일이 1:1 대응한다. `spec/1-data-model.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/3-error-handling.md`, `spec/conventions/error-codes.md`, `spec/5-system/7-llm-client.md`, `spec/data-flow/6-knowledge-base.md`, `spec/2-navigation/5-knowledge-base.md`, `CHANGELOG.md` 모두 plan 에 사전 등재된 파일이다.
  - 제안: 해소 불필요.

- **[WARNING]** `spec/data-flow/7-llm-usage.md` 수정 — plan 적용 위치 표에 미등재
  - 위치: `spec/data-flow/7-llm-usage.md` line 119, plan `## 적용 위치 요약` 표
  - 상세: plan 의 §5 "data-flow/6-knowledge-base.md §2" 와 §6 에는 `spec/data-flow/7-llm-usage.md` 가 포함되지 않는다. 그러나 실제 변경에서 `7-llm-usage.md` line 119 의 `kb.embeddingLlmConfigId (V029)` → `resolveEmbedding(kb.embeddingModelConfigId)` 수정이 포함됐다. 변경 내용 자체는 legacy 컬럼 참조 제거라는 PR4b 범위 내 작업이며, consistency checker SUMMARY 의 INFO-9에서 이 누락을 이미 지적하고 추가 권장까지 했으므로 변경 방향은 옳다. 다만 plan 에 사전 명시 없이 추가됐다는 점에서 scope drift 경계에 걸친다.
  - 제안: plan `## 적용 위치 요약` 표에 `spec/data-flow/7-llm-usage.md | embeddingLlmConfigId 참조 제거` 행을 소급 추가해 plan-파일 일관성을 확보한다.

- **[INFO]** `review/consistency/2026/06/12/09_01_10/` 디렉터리 신규 생성 — 정책 범위 내
  - 위치: `review/consistency/2026/06/12/09_01_10/` 전체 (6개 파일)
  - 상세: consistency check 결과물은 `review/consistency/<ISO 날짜>/<시각>/` 경로에 저장하는 프로젝트 정책(CLAUDE.md)을 준수한다. `_retry_state.json`, `meta.json`, checker 출력 5개, `SUMMARY.md` 모두 consistency-checker 워크플로의 정규 산출물이다. 이전 consistency check(`00_23_39`)의 산출물(파일 1~3)도 동일 패턴이다.
  - 제안: 해소 불필요.

- **[INFO]** `review/code/2026/06/12/07_34_38/_resolution_log.md` — 코드 리뷰 resolution 로그 정규 파일
  - 위치: `review/code/2026/06/12/07_34_38/_resolution_log.md`
  - 상세: resolution-applier 가 코드 수정 이력을 기록하는 로그 파일로 프로젝트 규약에 따른 정규 산출물이다. 내용은 W1~W17·C1 항목을 처리한 이력 기록이며 scope 외 수정 없음.
  - 제안: 해소 불필요.

- **[INFO]** `spec/conventions/error-codes.md` — `## §3` 제목 대신 `## 4.` 신설로 plan 초안과 다르나 방향 적절
  - 위치: `spec/conventions/error-codes.md`, plan `### 3` 제안 추가 코드 블록
  - 상세: plan draft 에서는 `## §3 Historical Artifacts (Retired Codes)` 제목으로 기존 §3 안에 삽입하는 구조를 제안했으나, 실제 변경은 `## 4. Rename 이력 (Retired codes)` 로 별도 절을 신설하고 §3 에 목적 구분 주석을 추가했다. consistency checker WARNING(§3 제목 충돌·5-컬럼 vs 4-컬럼 불일치)을 반영해 scope 내에서 적절히 교정한 것이다. plan 과 구현 결과의 구조 차이는 spec draft 개선 범위 내이며 초과 변경이 아니다.
  - 제안: 해소 불필요.

---

### 요약

변경 범위 관점에서 이 PR 은 plan(`spec-update-pr4b-embedding-retire.md`)이 사전 명시한 7개 spec 파일·CHANGELOG 범위를 충실히 따르고 있다. 불필요한 리팩토링, 포맷팅 전용 변경, 무관 파일 수정은 없다. 단 하나의 경미한 이슈는 `spec/data-flow/7-llm-usage.md` 가 plan 적용 위치 표에 없었음에도 변경에 포함된 점이다 — 내용 자체는 PR4b 의도(legacy 참조 제거)에 부합하고 consistency checker 도 해당 파일 갱신을 권장했으므로 의도치 않은 over-scope 가 아니라 리뷰 피드백 적용에 해당한다. plan 표에 소급 추가하면 완전히 해소된다.

### 위험도

LOW
