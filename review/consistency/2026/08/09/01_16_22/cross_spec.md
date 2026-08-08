### 발견사항

발견된 CRITICAL/WARNING 없음.

**사전 확인**: `git diff origin/main -- spec/` 결과가 비어 있다 — 본 브랜치는 `spec/data-flow/**` 를 전혀 수정하지 않았다(코드 diff 는 execution-engine·retry-turn·chat-channel·integrations·knowledge-base·ai-agent·workflow-assistant 등 넓은 범위지만 spec 문서는 origin/main 과 동일). 따라서 이번 PR 이 `spec/data-flow/` 에 **새로 도입한** cross-spec 충돌은 구조적으로 존재할 수 없다. 이하는 기존(origin/main 과 동일한) `spec/data-flow/**` 내용이 인접 spec 영역과 여전히 정합적인지에 대한 표본 검증이다.

**검증한 항목 (전부 정합 확인, 충돌 없음)**:

- **Execution/NodeExecution 상태 enum** — `spec/data-flow/3-execution.md §3.1/§3.2` 의 `execution.status`(pending/running/waiting_for_input/failed/completed/cancelled) 및 `node_execution.status`(+skipped) 가 `spec/1-data-model.md §2.13/§2.14` 의 enum 정의와 완전히 일치. `failed→running`/`failed→waiting_for_input`(retry_last_turn, `allowRetryReentry` opt-in) 전이도 `spec/5-system/4-execution-engine.md` 의 상세 서술과 문구까지 일관.
- **Integration 상태 enum** — `spec/data-flow/5-integration.md §3.1`(connected/expired/error/pending_install)과 `spec/1-data-model.md §2.10`, `spec/2-navigation/4-integration.md §6` 세 문서의 상태 전이 다이어그램·status_reason 매핑이 상호 일치.
- **RBAC 요약** — `spec/data-flow/12-workspace.md §4`(권한 요약)이 `spec/5-system/1-auth.md §3.2`(정식 매트릭스)를 명시적으로 SoT 로 참조하며, 과거 오기(viewer 실행 권한)를 2026-07-31 정정한 이력까지 문서화. `spec/data-flow/0-overview.md §3.6` 권한 요약 신설 경위도 Rationale 에 근거 명시.
- **요구사항 ID 참조** — `CCH-SE-01`, `EIA-RL-06/07`, `WH-MG-02/09`, `KB-DC-02`, `NF-OB-02` 등 data-flow 문서가 인용하는 ID 들을 다른 영역(`2-navigation/2-trigger-list.md`, `1-data-model.md` 등)에서 grep 한 결과 동일 의미로만 재참조되고 있으며 의미가 다른 재사용 사례는 발견되지 않음.

**한계**: 예산 제약으로 `spec/data-flow/` 16개 파일 전체와 인접 90개 spec 파일(제공된 프롬프트 번들에서 생략됨 — `spec/4-nodes/**`, `spec/3-workflow-editor/**` 등 상당수)의 전수 대조는 수행하지 못했다. 위 항목은 diff 가 건드린 도메인(실행 엔진/재시도, 통합, chat-channel, KB) 과 데이터 모델·RBAC·상태 머신처럼 충돌 시 파급이 큰 영역을 표본 우선순위로 선택한 결과다. 전수 대조가 필요하면 `spec/4-nodes/**`·`spec/3-workflow-editor/**` 등 생략된 파일을 별도로 열어 재확인할 것.

### 요약

`spec/data-flow/**` 는 이번 PR 에서 전혀 수정되지 않았으므로(=working tree 가 origin/main 과 diff 없음) cross-spec 관점에서 신규로 유입된 모순은 있을 수 없다. 표본 검증한 핵심 교차 영역(Execution/NodeExecution 상태 enum, Integration 상태 enum, RBAC 요약, 요구사항 ID 재사용)은 모두 `spec/1-data-model.md`·`spec/5-system/1-auth.md`·`spec/5-system/4-execution-engine.md`·`spec/2-navigation/**` 와 문구 수준까지 일관되며, 과거 불일치(viewer 실행 권한, 상태 분리 오류 등)는 이미 정정 이력이 Rationale 로 남아 있다. 전수 파일 대조는 예산상 생략했으나 위험도가 높은 표본에서 이상 신호가 없어 잔여 리스크는 낮다고 판단한다.

### 위험도
NONE
