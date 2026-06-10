# Cross-Spec 일관성 검토 결과

대상 브랜치: `claude/spec-sync-audit-998544` (origin/main 대비 spec ~60파일 변경)

---

## 발견사항

### [CRITICAL] `execution.submit_form` WS payload shape 불일치

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §4.2 — payload `{ executionId, formData }` (`nodeId`/`toolCallId` 클라이언트 전달 필드 아님으로 변경)
- **충돌 대상**:
  - `spec/3-workflow-editor/3-execution.md` §4.2 (라인 305) — `{ executionId, nodeId, formData }` 로 여전히 구(舊) shape 기술
  - `spec/4-nodes/6-presentation/0-common.md` §10.9 (라인 386, 419, 564) — `{ executionId, nodeId, formData, toolCallId? }` 로 여전히 구 shape 를 "변경 없음(외부 wire 유지)" 이라고 명시
  - `spec/5-system/14-external-interaction-api.md` §6 (라인 266) — REST `submit_form` 명령에 여전히 `nodeId` 를 필드로 열거
- **상세**: 이번 브랜치에서 `spec/5-system/6-websocket-protocol.md` 가 `nodeId` 제거를 **구현 현실에 맞춘 정정**으로 기록하고 Rationale §R 에도 설명을 추가했다. 그러나 같은 변경을 하지 않은 `3-execution.md`, `presentation/0-common.md`, `14-external-interaction-api.md` 는 여전히 `nodeId`(와 `toolCallId?`)가 포함된 구 shape 를 단일 진실로 제시한다. 특히 `0-common.md §10.9` 는 "외부 WS wire payload `{ executionId, nodeId, formData, toolCallId? }` 는 변경 없음" 이라고 명시해 신 spec 과 직접 모순된다.
- **제안**: `spec/3-workflow-editor/3-execution.md` §4.2 클라이언트 명령 표의 `submit_form` / `click_button` 행을 신 payload(`nodeId` 없음) 로 수정. `spec/4-nodes/6-presentation/0-common.md §10.9` 의 "(1) 외부 WS wire" 행과 §10.9 Rationale 내 "변경 없음" 기술을 신 payload 로 정정. `spec/5-system/14-external-interaction-api.md §6` 의 `submit_form` 행에서 `nodeId` 제거. 세 파일은 동일 인터페이스를 기술하므로 동시에 갱신해야 한다.

---

### [WARNING] `spec/4-nodes/6-presentation/0-common.md` §10.9 Rationale 와 구현 현실 간 사실 서술 충돌

- **target 위치**: `spec/5-system/6-websocket-protocol.md` §R (Rationale) — "`nodeId` 양단 구현이 보내지도 받지도 않는다" 정정 사실 기록
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md §10.9` (라인 564) — "외부 WS wire (`execution.submit_form` payload `{executionId, nodeId, formData, toolCallId?}`) 는 frontend / external API consumer 와의 호환 surface. 변경하면 client SDK·user-guide·external integration 모두 동시 흔들림. → 외부 wire 유지."
- **상세**: WS spec 은 이미 `nodeId` 미전달이 양단 구현 현실임을 확인해 spec 을 정정했다. presentation common §10.9 의 Rationale 은 이 사실을 모르고 과거 shape 유지가 하위 호환 이유라고 설명하고 있어, 향후 독자가 payload 를 읽을 때 어느 쪽이 SoT 인지 혼란을 준다.
- **제안**: `0-common.md §10.9` Rationale 에서 "(1) 외부 WS wire" 행의 "변경 없음" 주석과 §10.9 Rationale 단락의 wire 유지 근거를 신 shape 기준으로 업데이트.

---

### [WARNING] `spec/5-system/7-llm-client.md` §2.1 Rerank provider Dropped 결정이 `spec/1-data-model.md §2.16.1` 와 미동기

- **target 위치**: `spec/5-system/7-llm-client.md` §2.1 — jina/voyage/local/builtin 을 "Dropped (2026-06-05 결정)" 으로 변경
- **충돌 대상**: `spec/1-data-model.md §2.16.1` RerankConfig 엔티티 `provider` 필드 설명 (라인 미변경) — "**Planned(후속): `jina` / `voyage` / `local`(OpenAI-compatible `/rerank`) / `builtin`(Transformers.js 인프로세스)** — 모두 동일 `/rerank` HTTP 래퍼라 추가 비용 낮음" 이라는 Planned 표기가 drop 결정 이후에도 그대로 남아 있음
- **상세**: LLM Client spec 이 명시적으로 drop 결정을 기록했지만, 데이터 모델의 RerankConfig `provider` 필드 설명은 여전히 Planned 로 표기되어 있다. 사용자가 RerankConfig 를 보면 jina/voyage/local 지원 확장을 계획으로 이해한다.
- **제안**: `spec/1-data-model.md §2.16.1` RerankConfig 엔티티의 `provider` 필드 설명에서 "**Planned(후속):** `jina` / `voyage` / `local` / `builtin`" 을 "Dropped (2026-06-05 결정) — [Spec LLM Client §2.1](./5-system/7-llm-client.md)" 로 수정하거나 표기를 LLM Client spec 과 일치시킨다.

---

### [WARNING] `spec/conventions/spec-impl-evidence.md` frontmatter-evidence 가드 수 불일치

- **target 위치**: `spec/conventions/spec-impl-evidence.md` 수정 (라인 31) — "4건" 으로 변경 + "§4.0" → "§4.2" 참조 변경
- **충돌 대상**: 동일 파일 내 §4 가드 실제 열거 건수 및 교차 참조 — 변경 전 본문이 "5건" 을 기준으로 서술됐을 경우 내부 일관성 필요
- **상세**: `spec-impl-evidence.md` 의 한 줄이 "(5건)" 에서 "(4건)"으로 수정되고 섹션 참조도 바뀌었다. §4 가드 목록 본문과 실제 개수가 일치하는지 확인이 필요하다. 본 검토 범위에서 §4 전체 내용은 변경 파일에 포함되지 않아 정합성 검증 불완전.
- **제안**: `spec/conventions/spec-impl-evidence.md §4` 의 가드 항목 나열 수(4 vs 5)를 직접 세어 본문·전문 주석과 일치시킨다.

---

### [INFO] `spec/data-flow/1-audit.md` AuditLog action 표기 규약이 `spec/5-system/1-auth.md §4.1` 기대 값과 불일치

- **target 위치**: `spec/data-flow/1-audit.md` — 현재 구현된 9종 call site 표 신규 기술; `re_run_initiated` 표기가 `<resource>.<verb>` 규약에서 이탈함을 명시 기록
- **충돌 대상**: `spec/5-system/1-auth.md §4.1` — `workflow.*` / `trigger.*` / `member.*` / `schedule.*` / `workspace.*` / `llm_config.*` / `rerank_config.*` 액션을 감사 대상으로 열거하지만 현재 미구현 (data-flow 신 기술이 이 갭을 명시했음)
- **상세**: data-flow 1-audit 의 신규 "커버리지 갭" 기술이 auth.md §4.1 의 spec 약속과 구현 현실을 올바르게 지목했다. 모순이라기보다 알려진 spec-impl 갭의 공식 기록이다. 단, `re_run_initiated` (dot-prefix 없는 action 문자열) 가 규약에서 이탈한 사실이 data-flow 에만 기록돼 있고 `spec/conventions/` 에 action naming 정식 규약 문서가 없다는 점은 향후 새 action 추가 시 혼란 소지가 있다.
- **제안**: `spec/conventions/` 또는 `spec/5-system/1-auth.md §4.1` 에 AuditLog action naming 규약(`<resource>.<verb>` + 기록된 예외 `re_run_initiated`)을 간략 기술하면 drift 방지에 도움이 된다. 필수는 아님.

---

### [INFO] `spec/5-system/4-execution-engine.md` `NodeHandlerRegistry.register` 시그니처 변경이 `spec/4-nodes/0-overview.md` 에 미반영

- **target 위치**: `spec/5-system/4-execution-engine.md §5.4` — `register(nodeType, handler, metadata?)` 3인자 시그니처 + `getMetadata` / `assertConsistency` 추가
- **충돌 대상**: `spec/4-nodes/0-overview.md §1.2 component 등록` 관련 서술 (본 브랜치에서 `0-overview.md` 는 frontmatter 추가·소소한 문안 수정만 포함, 레지스트리 등록 시그니처 변경 미반영 가능성)
- **상세**: 4-nodes/0-overview.md 가 `NodeHandlerRegistry` 를 직접 기술하지는 않으나, 노드 컴포넌트 등록 흐름을 설명하는 문단이 2인자 패턴을 전제하는 경우 미동기 상태가 된다. 변경 범위가 크지 않고 4-nodes/0-overview 는 architecture 레벨 기술이라 단순 INFO 로 분류한다.
- **제안**: `spec/4-nodes/0-overview.md` 에서 `register` 패턴을 언급하는 부분이 있으면 `metadata?` 인자 추가를 반영하거나 §5.4 링크를 추가한다.

---

### [INFO] `spec/data-flow/13-agent-memory.md` 신규 파일이 `spec/5-system/17-agent-memory.md` 와 BullMQ 큐명 동일성 확인 필요

- **target 위치**: `spec/data-flow/13-agent-memory.md` — 큐 이름 `agent-memory-extraction`, concurrency 2, jobId `agent-memory:<ws>:<scope>` 기술
- **충돌 대상**: `spec/5-system/17-agent-memory.md` §3 (큐 분리 섹션) — 동일 큐명과 동일 concurrency 로 확정됨이 본 브랜치에서 동시에 업데이트됨
- **상세**: 두 파일이 같은 변경분으로 업데이트됐으므로 현재는 일치한다. 다만 data-flow 문서가 직접 BullMQ 큐명·concurrency 를 담으면 나중에 변경 시 두 파일을 동시에 수정해야 하는 이중 SoT 위험이 있다.
- **제안**: `spec/data-flow/13-agent-memory.md` 의 큐 상세 파라미터(concurrency, jobId 패턴 등)를 `spec/5-system/17-agent-memory.md` 참조로 처리해 data-flow 는 흐름 중심, system spec 은 파라미터 SoT 로 역할을 분리한다. 강제 아님 — 현재 상태도 두 파일이 일치하므로 기능적 오류 없음.

---

## 요약

이번 브랜치의 spec 변경(~60 파일)은 대부분 구현 현실과의 drift 를 해소하고 신규 data-flow 문서 3개(13·14·15)를 추가하는 방향으로 일관성이 높다. Cross-spec 관점에서 식별된 **가장 심각한 충돌은 `execution.submit_form` WS payload `nodeId` 필드 제거**다: `6-websocket-protocol.md` 에서는 `nodeId` 미전달이 구현 현실임을 확인해 spec 을 정정했으나, `3-workflow-editor/3-execution.md`, `4-nodes/6-presentation/0-common.md §10.9`, `5-system/14-external-interaction-api.md §6` 세 곳이 여전히 구 payload shape 을 SoT 로 제시해 두 API 계약이 공존하는 상태다. 이는 프론트엔드 구현이 어느 spec 을 따라야 하는지 판단이 불가능한 수준의 모순이다. Rerank provider Dropped 결정이 `spec/1-data-model.md §2.16.1` 에 미반영된 WARNING 과 `spec-impl-evidence.md` 가드 수 불일치 WARNING 도 후속 동기화가 필요하다. 나머지 INFO 항목은 명명 일관성·이중 SoT 방지 수준으로 기능적 오류로 이어질 가능성은 낮다.

## 위험도

HIGH
