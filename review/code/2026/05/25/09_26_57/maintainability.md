# 유지보수성(Maintainability) 리뷰 결과

리뷰 대상: `review/consistency/2026/05/25/07_12_25/`, `review/consistency/2026/05/25/08_28_14/`, `review/consistency/2026/05/25/08_41_30/` (consistency 산출물) + `spec/` 변경 파일 (0-overview.md, 1-data-model.md, 4-nodes/6-presentation/0-common.md, 5-system/3-error-handling.md, 5-system/6-websocket-protocol.md, 5-system/10-graph-rag.md, data-flow/0-overview.md, data-flow/3-execution.md)

---

## 발견사항

### [WARNING] `_retry_state.json` — 중복 구조 두 세션에 걸쳐 완전 동일 스키마 반복
- 위치: `review/consistency/2026/05/25/07_12_25/_retry_state.json` / `review/consistency/2026/05/25/08_28_14/_retry_state.json`
- 상세: 두 파일의 최상위 필드 구조 (`session_dir`, `summary_subagent_type`, `subagent_invocations`, `agents_pending`, `agents_success`, `agents_fatal`, `agent_history`, `rate_limit_episodes`, `total_wait_sec`, `wake_history`, `last_reset_hint_sec`, `loop_mode`) 가 완전히 동일한 스키마를 반복한다. `08_41_30` 세션은 `_retry_state.json` 에서 `agents_pending` 배열이 채워진 채로 저장되었으나(`agents_success: []`), 실제 SUMMARY.md 는 모두 완료 상태로 작성되어 있어 JSON 상태와 실제 결과가 불일치한다. 이 파일은 런타임 상태를 저장하는 목적이지만, 완료 후에도 stale 중간 상태가 그대로 커밋됐다.
- 제안: `_retry_state.json` 을 review 산출물로 커밋하는 정책이 유지된다면, 세션 종료 시점에 `agents_pending` 을 비우고 `agents_success` 로 이동하는 최종 상태로 정규화 후 커밋하도록 orchestrator 정책을 보완한다. `08_41_30` 의 경우 `agents_pending` 이 채워진 상태가 커밋되어 후속 리뷰어 혼란을 야기할 수 있다.

---

### [WARNING] `meta.json` — 파일 끝 newline 누락 (3개 파일 모두)
- 위치: `review/consistency/2026/05/25/07_12_25/meta.json`, `08_28_14/meta.json`, `08_41_30/meta.json`
- 상세: 세 파일 모두 diff 에 `\ No newline at end of file` 가 표시된다. `_retry_state.json` 도 동일하다. POSIX 텍스트 파일 규약 위반이며, git diff 노이즈를 유발하고 일부 도구에서 파싱 오류가 발생할 수 있다. 특히 JSON 파일 이므로 파서가 마지막 `}` 다음에 예상치 못한 EOF 를 만날 때 엣지 케이스가 발생할 수 있다.
- 제안: orchestrator 가 `meta.json` 과 `_retry_state.json` 을 Write 할 때 마지막에 `\n` 을 추가하도록 수정한다.

---

### [WARNING] `spec/1-data-model.md` — 단일 컬럼 설명이 120자를 크게 초과하는 인라인 참조 누적
- 위치: `spec/1-data-model.md` `error` 필드 설명 (추가된 줄)
- 상세: 추가된 `error` 컬럼 설명이 단일 마크다운 표 셀 안에 `SERVER_INTERRUPTED`, `WORKER_HEARTBEAT_TIMEOUT`, `RESUME_FAILED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE` 코드와 각각의 `[Spec ... §7.x](링크)` 를 모두 열거하고 있다. 해당 셀의 글자 수는 약 350자로, 마크다운 표의 가독성을 심각하게 해친다. 이 정보의 적절한 위치는 spec 본문 별도 섹션(예: 별도 `### Execution.error.code 어휘` 서브섹션)이다.
- 제안: 해당 컬럼 설명을 "에러 정보. 최초 failed NodeExecution 의 에러를 참조/복사 (아래 참조). `error.code` 어휘는 [§2.13-a](링크) 참조" 수준으로 축약하고, 코드 목록과 링크는 인접 소절로 분리한다.

---

### [WARNING] `spec/5-system/6-websocket-protocol.md` — `queued` 필드 설명이 인라인 산문에 과도한 정보 밀도
- 위치: `spec/5-system/6-websocket-protocol.md`, `queued: boolean` 설명 단락
- 상세: `queued` 필드의 의미 설명, 동작 원리(`continuation-queue`), cross-reference(`§7.5 rehydration`), 클라이언트 사용 금지 지침("클라이언트 routing 결정에 사용하지 않는다"), 적용 범위(`submit_form`/`click_button`/`submit_message`/`end_conversation`) 가 단일 연속 문단에 혼재되어 있다. 이 단락의 길이는 약 200자로, 유사한 다른 필드 설명보다 3-4배 길다. 마크다운 표 주석(`> 위 표의 마지막 3개 코드...`) 에서도 같은 패턴이 반복된다.
- 제안: `queued` 필드 설명은 "`true`: 비동기 enqueue, `false`(기본): in-instance fast path" 정도로 축약하고, 상세 동작은 cross-reference 링크만 제공한다. 표 하단 NOTE 도 두 개의 별도 NOTE 로 분리한다.

---

### [WARNING] `spec/data-flow/3-execution.md` — 섹션 제목 변경이 참조 anchor 를 암묵적으로 파괴
- 위치: `spec/data-flow/3-execution.md` `### 2.3 Redis (Pub/Sub — Continuation bus)` → `### 2.3 Redis (보조 키 — 분산 lock & seq)`
- 상세: 마크다운 섹션 제목이 변경되면 GitHub/GitLab 의 anchor 링크가 자동으로 변경된다. 다른 spec 파일에서 `#23-redis-pubsub--continuation-bus` 형태의 anchor 를 참조하고 있을 경우 링크가 404 가 된다. 변경된 제목이 내용을 더 정확히 반영한다는 점은 맞지만, 이런 구조 변경 시 repo-wide anchor 영향을 확인하지 않으면 문서 탐색이 조용히 깨진다.
- 제안: 섹션 제목 변경 시 `grep -r "2.3" spec/` 또는 anchor pattern 검색으로 기존 참조를 확인하고, 필요 시 HTML 앵커 태그(`<a id="...">`)를 추가해 backward-compatible 링크를 유지한다.

---

### [INFO] `review/consistency/08_41_30/_retry_state.json` — `agents_pending` 비어있지 않은 상태로 커밋
- 위치: `review/consistency/2026/05/25/08_41_30/_retry_state.json` 라인 25-32
- 상세: `agents_pending` 배열에 5개 에이전트가 모두 채워져 있고 `agents_success: []`, `agent_history: {}` 인 상태로 커밋됐다. SUMMARY.md 는 완전히 작성되어 있어 실제로는 모두 성공했음을 알 수 있으나, 파일만 보면 한 건도 완료되지 않은 것처럼 보인다. 다른 두 세션의 `_retry_state.json` 은 `agents_pending: []` + 성공 목록 채워진 정상 완료 상태다.
- 제안: `08_41_30` 세션의 `_retry_state.json` 은 세션 시작 시점의 초기 상태가 잘못 커밋된 것으로 보인다. orchestrator 가 세션 종료 후 최종 상태를 갱신하도록 flush 로직을 보완한다.

---

### [INFO] consistency 산출물 파일들 — 헤더 메타 정보 형식이 세 세션 간 불일관
- 위치: 각 checker 산출물 파일 상단 메타 블록 (예: `convention_compliance.md`, `cross_spec.md` 등)
- 상세: 동일 checker 종류라도 세션별로 메타 블록 형식이 다르다. 예를 들어 `07_12_25/convention_compliance.md` 는 코드 블록(`` ` ``)으로 감싼 메타 정보를 사용하고, `08_28_14/convention_compliance.md` 는 불릿 리스트(`- **검토 대상**: ...`), `08_41_30/convention_compliance.md` 는 별도 서술형을 사용한다. `rationale_continuity.md` 는 `08_41_30` 에서 `**bold**` 인라인, `07_12_25` 에서 불릿 리스트로 표현이 다르다. 이 불일관성은 파일을 자동 파싱하거나 비교할 때 장애가 된다.
- 제안: orchestrator prompt 에 메타 블록 형식을 고정 템플릿으로 지정한다. 예: `---\n검토 모드: ...\n검토 대상: ...\n검토 일시: ...\n---` 구분선 방식으로 통일한다.

---

### [INFO] `spec/5-system/3-error-handling.md` — blockquote 주석에 두 링크가 괄호 없이 연결되어 가독성 저하
- 위치: `spec/5-system/3-error-handling.md` 추가된 blockquote 줄
- 상세: 추가된 `> WS commands 에서는 동일 의미를 ...` 줄에서 `([WS Protocol §4.2](링크) / [실행 엔진 §7.5.1](링크))` 표현이 괄호와 슬래시로 연결되어 있다. 이 표현은 두 문서 중 어느 것이 규범적 SoT 인지 불분명하다. 또한 blockquote 가 `### 1.4` 섹션 직전에 등장하지만 표와의 관계가 시각적으로 모호하다.
- 제안: blockquote 를 `INVALID_STATE` 행 바로 아래 표 내 `비고` 컬럼으로 이동하거나, `주석:` 레이블로 명시하고 링크 순서를 "WS 쪽 → REST 쪽" 으로 명확화한다.

---

### [INFO] `spec/data-flow/3-execution.md` — 시퀀스 다이어그램 내 `Note over` 문자열이 과도하게 길어짐
- 위치: `spec/data-flow/3-execution.md` 라인 ~106 (`Note over Eng: continuation-queue ...`)
- 상세: 변경 전 `Note over Eng: continuation-bus subscribe → 폼 제출 / 버튼 클릭 / AI message 가 깨움` (44자) 에서 변경 후 `Note over Eng: continuation-queue (BullMQ) consume → 폼 제출 / 버튼 클릭 / AI message 가 깨움. worker 가 자기 인스턴스의 in-memory resolver 보유 시 즉시 resolve, 없으면 §7.5 rehydration 경로` (약 100자) 로 두 배 이상 길어졌다. Mermaid `Note` 는 렌더링 시 박스 너비를 초과하면 가독성이 크게 나빠진다.
- 제안: Note 를 "continuation-queue (BullMQ) → fast path or §7.5 rehydration" 정도로 압축하고, 상세 설명은 다이어그램 하단의 산문 주석 블록으로 이동한다.

---

### [INFO] `spec/data-flow/3-execution.md` — 섹션 제목 `### Continuation queue = BullMQ 영속 큐 (2026-05-24 갱신)` 에 날짜 하드코딩
- 위치: `spec/data-flow/3-execution.md` 마지막 섹션 제목
- 상세: 섹션 제목에 `(2026-05-24 갱신)` 을 포함하면, 후속 갱신 시 제목을 변경해야 하거나 날짜가 stale 해진다. Rationale 내의 날짜 태그(`"Durable Continuation (2026-05-24)"`)는 결정 식별자로서 의미 있지만, 본문 섹션 제목에 날짜를 포함하는 것은 일반적으로 관례를 벗어난다. 동일 파일 내 다른 섹션(`### 2.3 Redis (보조 키 ...)`, `### 1.4 Sub-workflow 호출`)에는 날짜가 없다.
- 제안: 제목을 `### Continuation queue = BullMQ 영속 큐` 로 변경하고, `(2026-05-24 갱신)` 은 제목 바로 아래 blockquote 나 inline 주석으로 이동한다.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md` — 기술 용어(`bus.add(...)`) 가 산문과 섞여 읽기 어려움
- 위치: `spec/4-nodes/6-presentation/0-common.md` §10.9 설명 단락 마지막 문장
- 상세: `(BullMQ \`execution-continuation\` 큐 — \`bus.add({ type: 'continue', executionId, nodeExecutionId, payload: { type: 'form_submitted', formData } }, { jobId, attempts })\`) 에 enqueue 한다` 는 표현이 API 시그니처 수준의 코드를 산문 안에 직접 포함하고 있다. 이 정도 상세는 구현 코드 수준이며 spec 문서의 적절한 추상 수준을 초과한다. 특히 `{ jobId, attempts }` 의 실제 값이 어디에 정의되는지 이 문장만으로는 알 수 없다.
- 제안: 해당 코드 예시는 spec 본문에서 제거하고, "BullMQ `execution-continuation` 큐에 `{ type: 'continue', executionId, nodeExecutionId, payload }` 를 enqueue 한다 (jobId idempotency key 구조는 [실행 엔진 §7.4](링크) 참조)" 수준으로 간소화한다.

---

## 요약

이번 변경의 유지보수성 측면 핵심 우려는 두 가지다. 첫째, `spec/1-data-model.md` 의 `error` 컬럼 설명과 `spec/5-system/6-websocket-protocol.md` 의 `queued` 필드 설명처럼 단일 위치에 너무 많은 정보를 밀어넣어 문서 가독성이 떨어지는 패턴이 반복된다. 이는 향후 독자가 내용을 이해하기 어렵게 만들고, 관련 정보가 여러 곳에 분산되어 있어 단일 진실 원칙에도 반한다. 둘째, `review/consistency/` 산출물 파일들의 메타 블록 형식이 세 세션 간 일관되지 않고, `08_41_30/_retry_state.json` 이 초기 상태 그대로 커밋되어 상태 파일의 신뢰성을 훼손한다. 핵심 spec 변경 내용(BullMQ 전환, rehydration 경로, 에러 코드 정의)은 의도와 근거가 명확하게 기술되어 있고, 전반적인 문서 구조는 기존 패턴을 준수하고 있다. 치명적 유지보수성 결함은 없으나, 정보 밀도 과부하와 파일 형식 불일관성을 개선하면 문서 장기 유지보수성이 크게 향상될 것이다.

---

## 위험도

LOW
