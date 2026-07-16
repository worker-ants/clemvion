### 발견사항

이번 대상(target) 범위인 `spec/conventions/` 는 `origin/main` 대비 실제 diff 가 다음 4개 파일에 대한 **경미한 텍스트 수정뿐**이며, 새로 도입된 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·설정키·파일 경로가 전혀 없다.

- `spec/conventions/cross-node-warning-rules.md` — 링크 경로만 `plan/in-progress/parallel-p2-followups.md` → `plan/complete/parallel-p2-followups.md` 로 정정 (plan 이동 반영)
- `spec/conventions/execution-context.md` — 동일한 링크 경로 정정
- `spec/conventions/node-cancellation.md` — 동일한 링크 경로 정정
- `spec/conventions/spec-impl-evidence.md` — `spec-link-integrity.test.ts` 가드 (c) 스캔 범위에 대한 서술을 정정하는 산문 clarification 뿐 (신규 식별자 없음, 기존 가드 이름·anchor 그대로)

`git diff --name-status origin/main -- spec/conventions/` 로 확인한 결과 신규 생성 파일도 없다 (전부 `M`). 따라서 위 6개 점검 관점(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트명 / 환경변수·설정키 / 파일 경로) 중 어느 것도 target(`spec/conventions/`) 범위 안에서 트리거되지 않는다.

참고로 이번 커밋 셋에는 target 범위 밖(`spec/5-system/11-mcp-client.md`)에 새 Rationale anchor `R-wontdo-cached-capabilities` 가 도입되어 있으나, 이는 이미 확립된 `R-wontdo-*` 명명 선례(`6-websocket-protocol.md`의 `R-wontdo-rawws-rest`, 문서 §601 에서 명시적으로 그 선례를 따른다고 자기-인용)를 그대로 따르고 있어 기존 anchor 와 충돌하지 않는다 — target 범위 밖이라 정식 발견사항으로 등재하지 않고 참고로만 남긴다.

### 요약
target 범위(`spec/conventions/`)의 실제 변경분은 plan 이동에 따른 상대링크 경로 수정 3건과 가드 동작 설명을 바로잡는 산문 clarification 1건뿐이며, 신규 식별자(요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·파일 경로)를 전혀 도입하지 않는다. 따라서 신규 식별자 충돌 관점에서 검토할 대상 자체가 없다.

### 위험도
NONE