# 신규 식별자 충돌 검토 — EIA-NF-06 / EIA-NF-07

## 발견사항

충돌로 분류할 항목이 없다. 아래에 각 점검 관점별 결과를 기술한다.

### [INFO] 요구사항 ID — 충돌 없음

- target 신규 식별자: `EIA-NF-06`, `EIA-NF-07`
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/eia-seq-nfr-spec-2845e7/spec/5-system/14-external-interaction-api.md` §3.5 (line 150–154) — 기존 ID 는 `EIA-NF-01`~`EIA-NF-05` 로 번호가 끝난다.
- 상세: `EIA-NF-06` / `EIA-NF-07` 은 해당 파일 전체 및 전체 spec/ 디렉터리에서 이미 할당된 ID 가 전혀 없다. 번호 연번(`NF-01`→`NF-05` 이후 `NF-06`/`NF-07`)이므로 순차적으로 자연스럽다.
- 제안: 없음 (충돌 아님).

### [INFO] 엔티티/타입명 — 충돌 없음

- target 이 도입하는 새 명칭: 없음. `ExecutionSeqAllocator` 는 기존 spec 에 이미 정의된 컴포넌트명이며 target 이 신규 도입하는 것이 아니라 참조하는 것이다.
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/eia-seq-nfr-spec-2845e7/spec/5-system/4-execution-engine.md` (§9.2), `/Volumes/project/private/clemvion/.claude/worktrees/eia-seq-nfr-spec-2845e7/spec/5-system/6-websocket-protocol.md` (§2.2 표), `/Volumes/project/private/clemvion/.claude/worktrees/eia-seq-nfr-spec-2845e7/spec/data-flow/15-external-interaction.md` (line 133)
- 상세: target 이 새로 정의하는 엔티티·DTO·인터페이스가 없으므로 충돌 없음.

### [INFO] API endpoint — 충돌 없음

- target 은 신규 endpoint 를 도입하지 않는다. 기존 EIA endpoint 군(`/api/external/*`)은 변경 없음.
- 상세: 순수 NFR 문서화 변경이므로 API 표면 변경 없음.

### [INFO] 이벤트/메시지명 — 충돌 없음

- target 은 신규 이벤트·메시지 이름을 도입하지 않는다.

### [INFO] 환경변수·설정키 — 충돌 없음

- target 이 도입하는 새 ENV var 또는 config key: 없음. `EXECUTION_SEQ_TTL_SECONDS` 는 기존에 이미 정의된 키로, target 이 신규 도입하지 않고 참조만 한다.
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/eia-seq-nfr-spec-2845e7/spec/5-system/4-execution-engine.md` §9.2 표 (기본 86400).

### [INFO] 파일 경로 — 충돌 없음

- target 이 수정하는 파일: `spec/5-system/14-external-interaction-api.md` (기존 파일 내 §3.5 표에 2행 추가 + §R7 말미에 1문장 추가). 신규 파일 생성 없음.
- 기존 명명 컨벤션(`N-name.md`) 준수 여부: 기존 파일 수정이므로 파일명 컨벤션 충돌 없음.

---

## 요약

target(`plan/in-progress/spec-draft-eia-seq-nfr.md`)이 도입하는 신규 식별자는 요구사항 ID `EIA-NF-06` / `EIA-NF-07` 두 개뿐이다. 이 ID 들은 `/Volumes/project/private/clemvion/.claude/worktrees/eia-seq-nfr-spec-2845e7/spec/5-system/14-external-interaction-api.md` §3.5 의 기존 `EIA-NF-01`~`EIA-NF-05` 의 자연 연번으로, 전체 spec/ 및 plan/ 범위에서 이미 다른 의미로 할당된 사례가 없다. 신규 엔티티명·API endpoint·이벤트명·ENV var·파일 경로는 전혀 도입되지 않으므로 명명 충돌이 없다. 위험도 없음.

## 위험도

NONE
