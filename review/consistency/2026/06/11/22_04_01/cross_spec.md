# Cross-Spec 일관성 검토 결과

target: `spec/4-nodes/5-data/` (0-common.md / 1-transform.md / 2-code.md)
검토 모드: --impl-done, diff-base=origin/main

---

## 발견사항

### [WARNING] `3-error-handling.md §1.4` 엔진 수준 에러 표의 `EXECUTION_TIMEOUT` 계층 혼동

- **target 위치**: `spec/4-nodes/5-data/2-code.md §5.3.2` 타임아웃 케이스 / `§5.3 공통 필드 표` — `output.error.code = "CODE_TIMEOUT"` (정규화된 public 코드), `output.error.details.legacyCode = "EXECUTION_TIMEOUT"` (내부 분류 전용)
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4` — "엔진 수준 에러 (execution status → `failed`)" 표에 `EXECUTION_TIMEOUT` 이 "Code 노드 스크립트 실행 타임아웃" 으로 등재되어 있어, 마치 이 코드가 `execution.status = failed` 를 유발하는 엔진 수준 코드인 것처럼 읽힌다
- **상세**: target spec 은 Code 노드의 타임아웃이 `error` 포트로 라우팅(§5.3.2, CONVENTIONS Principle 3.1 Runtime 에러)되며 public `output.error.code` 는 `CODE_TIMEOUT` 임을 명확히 정의한다. `EXECUTION_TIMEOUT` 은 핸들러 내부 wall-clock 타이머가 host-side 로 설정하는 내부 코드이며, `LEGACY_TO_NORMALIZED` 테이블에 의해 public `CODE_TIMEOUT` 으로 정규화된다. 반면 `3-error-handling.md §1.4` 엔진 수준 표는 `EXECUTION_TIMEOUT` 을 엔진 수준(execution → `failed`) 항목에 배치해, 이 코드가 `error` 포트 라우팅 코드인지 `execution.status = failed` 코드인지 혼동을 준다. `chat-channel-adapter.md §3.1`(line 387)은 `EXECUTION_TIMEOUT` 과 `CODE_TIMEOUT` 을 같은 셀에 병기해 이미 이 긴장을 흡수했으나 `3-error-handling.md §1.4` 자체는 정정되지 않았다.
- **제안**: `3-error-handling.md §1.4` 엔진 수준 표의 `EXECUTION_TIMEOUT` 항목을 "내부 legacy 코드 — public surface 는 `CODE_TIMEOUT` (`output.error.code`), `error` 포트 라우팅" 으로 주석 보강하거나, 노드 수준 표(line 81, Code 노드 행)로 이동해 엔진 수준 표에서 제거한다. 이 변경은 spec 전용 편집이며 구현에는 영향 없다.

---

### [INFO] `spec/5-system/14-external-interaction-api.md §547` — `EXECUTION_TIMEOUT` 열거

- **target 위치**: 해당 없음 (target spec 의 직접 정의 대상 아님)
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md:547` — execution_failed 에러 코드 목록에 `EXECUTION_TIMEOUT` 이 명시됨. 주석으로 "EXECUTION_TIMEOUT=Code 노드 스크립트 타임아웃" 을 설명하나, public `CODE_TIMEOUT` 은 나열에 없음
- **상세**: external-interaction API 의 예시 열거는 내부 코드(`EXECUTION_TIMEOUT`)를 표면에 노출하고 있어, 실제로 클라이언트가 받는 `CODE_TIMEOUT` 과 괴리가 있다. target spec 에서 정규화 레이어가 명확해진 후 이 열거가 구버전 코드명을 포함하게 됨.
- **제안**: `14-external-interaction-api.md §547` 에서 `EXECUTION_TIMEOUT` 을 `CODE_TIMEOUT` 으로 교체하거나 `CODE_TIMEOUT` 을 추가하고 `EXECUTION_TIMEOUT` 은 "(internal → CODE_TIMEOUT)" 로 주석 처리한다. 사용자 영향 없음(주석 수준 정확화).

---

### [INFO] `spec/5-system/3-error-handling.md §1.4` — `EXECUTION_TIMEOUT` 주석의 handler 파일 경로 유효성

- **target 위치**: 해당 없음
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4:62` — "Code 노드 스크립트 실행 타임아웃 (`nodes/data/code/code.handler.ts`)" 파일 경로 언급
- **상세**: 파일 경로 자체는 유효하나, 해당 파일에서 `EXECUTION_TIMEOUT` 코드는 이제 public 코드가 아니라 내부 분류 경로(`classifyError` 반환값 → `LEGACY_TO_NORMALIZED` 정규화)로 격리됐다. 코드 명칭이 handler 코드에서 사라진 건 아니지만 역할이 달라졌다.
- **제안**: 정확도 향상을 위해 `3-error-handling.md §1.4` 주석에 "내부 legacy 코드; `output.error.code` = `CODE_TIMEOUT`" 을 보강한다. 낮은 우선순위.

---

### [INFO] `spec/conventions/node-output.md` Principle 7 `code.config.code` echo — target 과 완전 일치

- **target 위치**: `spec/4-nodes/5-data/2-code.md §5.1 / §Rationale`
- **충돌 대상**: `spec/conventions/node-output.md` Principle 7 "항상 echo" 목록 — `code` (raw — `code.config.code`)
- **상세**: 모순 없음. Principle 7 는 `code.config.code` 를 "항상 echo" 목록에 명시하고 "expression 평가 제외(expression-exclusions 등록)는 echo 금지와 다르다" 는 Rationale 도 정합화돼 있다. target spec §Rationale 과 일치.
- **제안**: 없음.

---

### [INFO] `spec/conventions/node-output.md` Principle 8.2 Code/Transform root 배치 — target 과 완전 일치

- **target 위치**: `spec/4-nodes/5-data/2-code.md §5.1 / §Rationale`
- **충돌 대상**: `spec/conventions/node-output.md` Principle 8.2 — "Code/Transform 은 `output.result` 래핑 미적용"
- **상세**: 모순 없음. Principle 8.2 는 LLM 계열(ai_agent/text_classifier/information_extractor) 한정으로 명시하고 Code/Transform 예외를 "SoT 는 Code §Rationale · Transform §5.1" 로 지정한다. target spec §5.1 / §Rationale 과 일치.
- **제안**: 없음.

---

### [INFO] `spec/conventions/node-output.md` Principle 2 Code meta 필드 — target 과 완전 일치

- **target 위치**: `spec/4-nodes/5-data/2-code.md §5.1 / §5.3`
- **충돌 대상**: `spec/conventions/node-output.md` Principle 2 — Code 카테고리: `meta.durationMs`, `meta.success`, `meta.logs?`
- **상세**: 모순 없음. target spec §5.1 / §5.3 의 meta 필드가 Principle 2 Code 행과 일치한다. `meta.error`/`meta.errorCode` 폐기 결정도 "Phase 1 D 에서 폐기" 로 Principle 2 와 동일하게 기술됐다.
- **제안**: 없음.

---

### [INFO] `spec/4-nodes/0-overview.md §5` 샌드박싱 표 — target 과 완전 일치

- **target 위치**: `spec/4-nodes/5-data/2-code.md §7`
- **충돌 대상**: `spec/4-nodes/0-overview.md §5` 샌드박싱 표
- **상세**: 모순 없음. `0-overview.md §5` 는 `isolated-vm`, `memoryLimit: 128`, `CODE_MEMORY_LIMIT`, `error` 포트 분기를 target spec §7.2 와 동일하게 기술한다.
- **제안**: 없음.

---

### [INFO] `spec/conventions/chat-channel-adapter.md §3.1` 분류 표 — 미등재 코드 `CODE_MEMORY_LIMIT` 없음

- **target 위치**: `spec/4-nodes/5-data/2-code.md §5.3.3` — `CODE_MEMORY_LIMIT` 신규 에러 코드
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §3.1` (line 388) — `CODE_EXECUTION_FAILED` · `CODE_MEMORY_LIMIT` · ... 가 `executionFailedInternal` 행에 이미 등재됨
- **상세**: 모순 없음. `chat-channel-adapter.md §3.1` 은 `CODE_MEMORY_LIMIT` 를 이미 `executionFailedInternal` 그룹에 포함한다. target spec 이 신설한 코드와 일치.
- **제안**: 없음.

---

## 요약

Cross-Spec 일관성 관점에서 `spec/4-nodes/5-data/` (0-common.md / 1-transform.md / 2-code.md) 의 주요 변경(isolated-vm 전환, `CODE_MEMORY_LIMIT` 신설, `CODE_TIMEOUT` 정규화)은 `spec/conventions/node-output.md`, `spec/4-nodes/0-overview.md §5`, `spec/5-system/3-error-handling.md §1.4` 노드 수준 표, `spec/conventions/chat-channel-adapter.md §3.1` 과 모순 없이 일치한다. 유일한 WARNING 은 `3-error-handling.md §1.4` 엔진 수준 에러 표에 `EXECUTION_TIMEOUT` 이 engine-level(→ `failed`) 항목으로 남아 있어 target spec 의 `error` 포트 라우팅(node-level runtime 에러)과 계층 혼동을 줄 수 있다는 점이다. 이는 target spec 이 도입한 문제가 아니라 기존 표의 분류 부정확이며, target spec 은 내부 코드(`EXECUTION_TIMEOUT`)를 `details.legacyCode` 로 격리하고 public `CODE_TIMEOUT` 을 일관되게 사용하는 올바른 방향이다. 구현 차단 수준의 Critical 충돌은 없다.

## 위험도

LOW
