# 부작용(Side Effect) 리뷰 결과

리뷰 대상: `workflow-resumable-execution-phase2-cont-64f537` worktree 의 spec·리뷰 파일군 (파일 1-32)

---

## 발견사항

### [INFO] `spec/5-system/10-graph-rag.md` — frontmatter `status` / `code:` 전역 상태 변경
- 위치: `spec/5-system/10-graph-rag.md` frontmatter
- 상세: `status: spec-only` + `code: []` 에서 `status: implemented` + `code: [...]` 로 변경. 이 frontmatter 는 `spec-code-paths.test.ts` 빌드 가드가 직접 읽는 shared state 다. 변경 자체는 올바른 상태 수렴이지만, 이 파일을 base 로 삼는 다른 active worktree (`workflow-resumable-execution-6b105e`, `workflow-resumable-execution-phase2-a6b133`) 가 동일 파일을 수정하여 이미 같은 내용을 보유하고 있다고 plan_coherence 보고서가 확인했다. 세 브랜치 chain 에서 동시에 PR 이 열리면 merge 순서에 따라 git conflict 없이도 중복 적용되어 빌드 가드 동작이 예상 범위와 달라질 수 있다.
- 제안: PR merge 순서를 chain 순서대로 유지하고, `10-graph-rag.md` frontmatter 변경이 중간 PR 에 이미 포함됐는지 확인 후 상위 PR 에서 중복 없이 합친다.

---

### [INFO] `_retry_state.json` 파일 — orchestrator 내부 상태를 `review/` 디렉터리에 영속화
- 위치: `review/consistency/2026/05/25/07_12_25/_retry_state.json`, `review/consistency/2026/05/25/08_28_14/_retry_state.json`, `review/consistency/2026/05/25/08_41_30/_retry_state.json`
- 상세: `_retry_state.json` 은 consistency-check orchestrator 가 sub-agent 재시도·진행 상태를 영속화하는 파일이다. 파일시스템에 직접 기록되며 `agents_pending` / `agents_success` / `loop_mode` 등 실행 흐름 상태를 담는다. `08_41_30/_retry_state.json` 의 경우 `agents_pending` 에 5개 checker 가 아직 남아 있는 채로 커밋되어 있다 (실제 SUMMARY.md 는 완성됐으므로 최종 flush 가 완료되지 않은 중간 스냅샷이 커밋된 상태). 이 파일이 `review/` 산출물 규약의 일부로 의도된 파일이라면 문제없으나, 다른 worktree 나 CI 파이프라인이 이 파일을 재개(resume) 가능한 상태로 오해해서 sub-agent 를 재실행하는 부작용은 없는지 확인이 필요하다.
- 제안: `_retry_state.json` 이 단순 감사 기록이라면 현행 유지. orchestrator 가 파일 존재만으로 재실행을 트리거하는 로직이 있다면, `08_41_30` 파일의 `agents_pending` 목록이 비어 있어야 안전하다.

---

### [INFO] `spec/data-flow/0-overview.md §5` — "Redis pub/sub" 설명을 "BullMQ 영속 큐"로 교체
- 위치: `spec/data-flow/0-overview.md` §5 Continuation bus 설명
- 상세: 이 파일은 여러 개발자·스펙 문서가 cross-reference 하는 shared overview 다. 기술 변경(pub/sub → BullMQ)이 올바르게 반영됐지만, 이 파일을 참조하는 다른 spec 문서(`spec/5-system/8-embedding-pipeline.md` 등)가 "Redis pub/sub" 로 동작한다고 기술한 곳이 있다면 해당 설명이 자동으로 stale 이 된다. 변경 자체는 단방향(이 파일만 수정)이므로 역방향 참조자의 상태 변경은 없지만, 참조자들이 stale 기술을 갖게 되는 간접 부작용이 있다.
- 제안: `spec/data-flow/0-overview.md` 변경 시 `grep -rn "Redis pub/sub\|pub/sub" spec/` 로 잔여 stale 기술을 한 번 전수 확인.

---

### [INFO] `spec/4-nodes/6-presentation/0-common.md §10.9` — 내부 bus 구현 기술 변경
- 위치: `spec/4-nodes/6-presentation/0-common.md` §10.9 Layer (2) 행
- 상세: "server-internal Redis pub/sub `execution:continuation` 채널의 `'continue'` 메시지" 를 "BullMQ `execution-continuation` 큐" 로 교체하고 `bus.publish` 호출 시그니처에 `nodeExecutionId` 를 추가했다. 이 spec 을 참조해 구현된 클라이언트 코드가 있다면 메서드 시그니처 변경(`bus.publish` → `bus.add` + 추가 인자)의 영향을 확인해야 하지만, 이는 server-internal layer 의 변경이므로 외부 API 에는 노출되지 않는다. spec 기술 변경이 구현 변경을 선행하는 상태임을 `§7.5.1` 인라인 노트가 명시하고 있어, spec-impl 갭이 의도적으로 기록됐다.
- 제안: 해당 spec-impl 갭(sentinel publish 우회 → 동기 반환 전환)이 후속 PR 으로 해소될 때 `0-common.md §10.9` 의 기술도 함께 재검증할 것을 `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 변경 2.3 추적 항목에 명시한다.

---

### [INFO] `spec/5-system/3-error-handling.md` — `INVALID_STATE` 행에 WS 역방향 cross-link 추가
- 위치: `spec/5-system/3-error-handling.md` §1.3 `INVALID_STATE` 행 아래 blockquote
- 상세: 기존 공용 에러 코드 테이블에 주석 형태의 텍스트가 추가됐다. 이 변경은 기존 에러 코드의 의미나 값을 전혀 변경하지 않고 가독성 보강만 하므로 구현 호출자에 대한 부작용은 없다. 다만 테이블 내 blockquote 가 마크다운 렌더러에 따라 테이블 외부로 렌더링될 수 있어 파싱 도구가 이 파일을 스키마로 사용하는 경우 예상치 않은 구조 변화가 있을 수 있다.
- 제안: 영향 없음. 현행 유지.

---

### [INFO] `spec/5-system/6-websocket-protocol.md §4.2` — ack payload 에 `queued` 필드 추가
- 위치: `spec/5-system/6-websocket-protocol.md` §4.2 `execution.click_button` success payload
- 상세: 기존 `{ resumed: boolean }` 에 `queued: boolean` 선택 필드가 추가됐다. 이 필드가 없던 기존 클라이언트는 `queued` 를 무시하면 되므로 하위 호환성은 유지된다. spec 이 "관측·디버깅 용도이며 클라이언트 routing 결정에 사용하지 않는다"고 명시하고 있어 의도치 않은 클라이언트 분기 변경 위험은 없다. 단, 동일 ack shape 가 `execution.submit_form` / `execution.submit_message` / `execution.end_conversation` 에도 공통 적용된다고 기술되어 있는데, 이 세 ack 의 success payload 에 `queued` 필드가 실제로 추가됐는지 diff 에서 확인되지 않는다.
- 제안: `execution.submit_form`, `execution.submit_message`, `execution.end_conversation` ack 의 success payload 예시에도 `queued` 필드가 반영됐는지 `spec/5-system/6-websocket-protocol.md` 전체를 확인. 미반영이면 "공통 적용" 기술과 실제 spec 예시 간 불일치.

---

### [INFO] `spec/5-system/4-execution-engine.md §9.3` — `task-queue` 행 삭제에 의한 §11 참조 제거
- 위치: `spec/5-system/4-execution-engine.md` §11 Graceful Shutdown 항목 2
- 상세: `task-queue` 토큰 제거는 §9.3 테이블과 §11 본문 두 곳을 함께 수정했다. 이 두 곳 외 spec 전체에서 `task-queue` 잔여 참조가 0건임을 naming_collision 보고서가 확인했다. 파일시스템·환경 변수·네트워크 부작용은 없다.
- 제안: 영향 없음. 현행 유지.

---

### [INFO] `review/consistency/2026/05/25/08_41_30/convention_compliance.md` — CRITICAL 4건이 현 PR 외 파일에 존재
- 위치: `review/consistency/2026/05/25/08_41_30/convention_compliance.md`
- 상세: `spec/5-system/1-auth.md`, `spec/5-system/15-chat-channel.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md` 4개 파일의 CRITICAL 이슈가 이 리뷰 파일에 기록됐다. 이 중 `10-graph-rag.md` 의 CRITICAL (status: spec-only vs 본문 구현 완료 불일치)은 본 PR 의 `spec/5-system/10-graph-rag.md` 변경(status: implemented 로 승격)으로 해소됐다. 그러나 SUMMARY.md 의 C3 항목이 "payload 에 포함된 버전(status: implemented)은 규약에 부합하지만 실제 디스크의 파일은 아직 spec-only" 라고 기술하는데, 실제 diff(파일 27)에서는 이미 `status: implemented` + code 경로로 변경됐다. SUMMARY.md 와 convention_compliance.md 의 기술이 서로 다른 시점의 스냅샷을 참조하여 불일치하는 상태다.
- 제안: SUMMARY.md C3 항목을 "본 PR 에서 해소됨 — `spec/5-system/10-graph-rag.md` status 를 `implemented` 로 갱신" 으로 수정하거나, 기록 목적이라면 현행 유지(해소됐음을 RESOLUTION.md 에 명시).

---

## 요약

이번 변경은 모두 spec 문서, 리뷰 산출물, 내부 orchestrator 상태 파일로 구성되어 있으며, 실제 codebase 코드 변경을 포함하지 않는다. 의도치 않은 전역 변수 도입, 네트워크 호출, 환경 변수 읽기/쓰기, 이벤트 핸들러 변경은 없다. 부작용 관점에서 주목할 사항은 세 가지다. 첫째, `spec/5-system/10-graph-rag.md` frontmatter 가 stacked PR chain 의 세 브랜치에 걸쳐 동일하게 변경되어 있어 merge 순서 관리가 필요하지만 현재는 내용이 일치하므로 실질적 충돌은 없다. 둘째, `08_41_30/_retry_state.json` 이 `agents_pending` 목록이 비어 있지 않은 중간 상태로 커밋되어 있어, orchestrator 가 파일 기반 재개를 시도하는 경우 예상치 못한 sub-agent 재실행이 발생할 수 있다. 셋째, WS ack 에 `queued` 필드가 추가된 것이 `execution.submit_form` 등 나머지 세 ack 에도 실제 spec 예시로 반영됐는지 확인이 필요하다. 의도치 않은 상태 변경, 시그니처 파괴적 변경, 외부 서비스 호출 등 높은 수준의 부작용은 발견되지 않았다.

---

## 위험도

LOW
