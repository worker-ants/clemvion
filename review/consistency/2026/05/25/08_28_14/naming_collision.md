# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md`
검토 시각: 2026-05-25

---

## 발견사항

### 1. [INFO] `task-queue` 식별자 — 삭제 대상, 충돌 없음

- target 변경: `spec/5-system/4-execution-engine.md §9.3` 의 `task-queue` 행 삭제
- 기존 사용처:
  - `spec/5-system/4-execution-engine.md` 행 907: `§9.3` BullMQ 큐 목록 표의 `task-queue` 행 (현재 "구현 검증 후 확정/삭제" 주석 포함)
  - `spec/5-system/4-execution-engine.md` 행 974: `§11 Graceful Shutdown` 항목 2 — `BullMQ \`execution-continuation\` / \`background-execution\` / \`task-queue\` 의 active job...`
- 상세: `task-queue` 는 codebase 에 해당 큐가 존재하지 않음이 확인된 phantom 식별자다. target 은 §9.3 표에서 행 삭제를 제안하면서 §11 Graceful Shutdown 의 동반 토큰 제거도 명시하고 있으므로 두 사용처 모두 정합하게 처리된다. spec 외 다른 영역(`spec/data-flow/`, `spec/0-overview.md`, plan 파일 등)에서 `task-queue` 참조가 없음을 확인함.
- 제안: 변경 범위(§9.3 행 삭제 + §11 토큰 제거)는 target 이 이미 명시하고 있음. `grep -rn "task-queue"` 로 잔여 참조 전수 확인 후 일괄 제거 권장.

---

### 2. [WARNING] `INVALID_EXECUTION_STATE` — WS 전용 코드와 기존 REST 공용 `INVALID_STATE` 의 의미 유사성

- target 신규 식별자: `INVALID_EXECUTION_STATE` (§7.5.1 sub-section 신설 + §4.2 주석 추가)
- 기존 사용처:
  - `spec/5-system/6-websocket-protocol.md` 행 239 (main branch) / 행 242 (worktree): `§4.2` 버튼 클릭 에러 코드 표에 이미 등재. 신규 식별자가 아닌 기존 코드.
  - `spec/5-system/4-execution-engine.md` 행 750 (worktree): `§7.4` 표 — `0건 또는 다중 row 이면 즉시 client 에 에러 (INVALID_EXECUTION_STATE)` 로 이미 인라인 언급.
  - `spec/5-system/3-error-handling.md` 행 42: `INVALID_STATE` | 422 — REST 공용 에러 카탈로그에 별개 코드로 등재.
- 상세: target 의 변경 2.1(§7.5.1 신설)은 기존 WS 에러 코드(`INVALID_EXECUTION_STATE`)의 정의를 상세화하는 것이므로 새 식별자 도입이 아니다. 다만 target 본문이 명확히 설명하듯, `INVALID_EXECUTION_STATE`(WS 전용)와 `INVALID_STATE`(REST 422 공용)는 같은 의미를 두 이름으로 표현하는 historical artifact 관계다. target 이 이 구분을 §7.5.1 과 §4.2 주석 양쪽에 명시하므로 혼동 방지 조치가 포함되어 있다.
- 제안: target 의 변경 2.1 / 2.2 텍스트는 두 코드의 의미 관계와 층(layer) 분리를 이미 설명하고 있어 충분하다. `spec/5-system/3-error-handling.md §4.2` 또는 intro 에도 "WS-only error codes는 `6-websocket-protocol.md §4.2` 참조" 역참조를 추가하면 새로운 개발자가 혼동하는 경우를 추가로 줄일 수 있다 (필수 아닌 권장).

---

### 3. [INFO] `§7.5.1` 섹션 번호 — 현재 spec 에 미존재, 신설 충돌 없음

- target 신규 식별자: `§7.5.1 Publisher 측 사전 검증 — INVALID_EXECUTION_STATE`
- 기존 사용처: main branch 및 worktree spec `spec/5-system/4-execution-engine.md` 모두에서 `7.5.1` 섹션 번호가 존재하지 않음을 확인.
- 상세: `§7.5`(`Resume after Restart (rehydration)`) 아래 첫 번째 sub-section 이므로 번호 충돌 없음.
- 제안: 없음.

---

### 4. [INFO] `RESUME_BULLMQ_ATTEMPTS` — 기존 식별자, 충돌 없음

- target 이 참조하는 `RESUME_BULLMQ_ATTEMPTS` 는 이미 worktree spec `§9.3` 표와 `§11` ENV var 표에 정의된 기존 ENV var 식별자다. target 은 이를 신규 도입하지 않고 §9.3 큐 표의 `attempts` 컬럼에서 참조할 뿐이다.
- 기존 사용처: `spec/5-system/4-execution-engine.md` 행 751, 823, 905, 987 (worktree).
- 상세: 충돌 없음. `CONTINUATION_EXECUTION_QUEUE` / `BACKGROUND_EXECUTION_QUEUE` 는 codebase 상수 이름이며 spec 에는 큐 이름(`execution-continuation` / `background-execution`)으로 표현됨 — 명명 체계가 다른 레이어에서 일관성 있게 유지됨.
- 제안: 없음.

---

### 5. [INFO] 파일 경로 — 신규 파일 없음, 기존 파일 수정만

- target 이 변경하는 파일: `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md`
- 두 파일 모두 기존에 존재하는 파일이며 spec 명명 컨벤션(`N-name.md`)을 준수함. 신규 spec 파일 생성 없음.
- 상세: 충돌 없음.

---

## 요약

target 문서(`spec-update-workflow-resumable-execution-phase2-followup.md`)가 도입하거나 삭제하는 식별자 중 신규 충돌은 발견되지 않았다. `task-queue` 삭제는 spec §9.3 + §11 두 곳에 걸쳐있고 target 이 두 곳을 모두 명시하고 있어 정합적이다. `INVALID_EXECUTION_STATE` 코드는 이미 `spec/5-system/6-websocket-protocol.md §4.2` 에 존재하며, 동일 층의 REST 코드 `INVALID_STATE`(`spec/5-system/3-error-handling.md`) 와 이름이 유사해 혼동 가능성이 있으나 target 이 layer 분리 주석을 두 곳에 명시하므로 실질적 혼동 위험은 낮다. 요구사항 ID 충돌, API endpoint 충돌, 이벤트/메시지명 충돌, 환경변수 신규 충돌은 해당 없음.

## 위험도

LOW
