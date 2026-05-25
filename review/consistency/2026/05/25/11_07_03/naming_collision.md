# 신규 식별자 충돌 검토 — chat-channel-error-notify spec draft

검토 대상: `plan/in-progress/spec-draft-chat-channel-error-notify.md`
검토 일시: 2026-05-25

---

## 발견사항

### [WARNING] Convention §3.1 신설 — 기존 §3 앵커 cross-link 와의 간섭 가능성

- target 신규 식별자: `spec/conventions/chat-channel-adapter.md` 의 신규 절 `### 3.1 Execution Failed 분류 알고리즘`
- 기존 사용처:
  - `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/providers/discord.md` line 201: `[Convention §3 매핑 표](../../../conventions/chat-channel-adapter.md#3-eia-event--rendernode-매핑)`
  - `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/providers/slack.md` line 182: `[Convention §3 매핑 표](../../../conventions/chat-channel-adapter.md#3-eia-event--rendernode-매핑)`
- 상세: §3 (최상위 섹션 `## 3. EIA Event → renderNode 매핑`) 자체에 `#3-eia-event--rendernode-매핑` 앵커가 붙어 있고, 두 provider spec 이 이 앵커를 직접 link 한다. 신규 §3.1 삽입은 §3 섹션 자체를 변경하지 않으므로 앵커 ID 는 유지된다. 따라서 **직접 충돌은 없다.** 그러나 §3 의 "EIA Event → renderNode 매핑" 표 안에 `execution.failed` 행이 변경(Change 2a)되면 해당 표의 내용을 참조하는 링크는 의미상 갱신을 수반한다. 위험도는 link 깨짐이 아니라 독자가 링크를 따라갔을 때 콘텐츠가 바뀌어 있는 혼동 수준에 그친다.
- 제안: 수용 가능. §3.1 신설 후 양 provider spec (slack.md, discord.md) 의 §3 cross-link 텍스트를 "Convention §3 매핑 표" → "Convention §3 매핑 표 / §3.1 분류 알고리즘" 으로 명확화하면 독자 혼동이 추가로 줄어든다 (필수 변경은 아님).

---

### [WARNING] Convention `R5` 식별자 — 기존 파일에서 쓰이는 `R5` 와 다른 범위

- target 신규 식별자: `spec/conventions/chat-channel-adapter.md` 에 신규 `### R5. Execution Failed 분류 helper 를 Convention 에 두는 이유`
- 기존 사용처:
  - `/Volumes/project/private/clemvion/spec/4-nodes/7-trigger/providers/telegram.md` line 211: `### R5. group chat 무한 차단 vs 사용자 선택 (2026-05-21)` — telegram.md 파일 내부의 지역 R5
  - `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` line 468: `### R5. provider 디렉토리 위치 — '4-nodes/7-trigger/providers/' (2026-05-21)` — 15-chat-channel.md 파일 내부의 지역 R5
  - `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` line 833: `### R5. 외부 WebSocket 채널 신설 — 보류 (2026-05-21)` — EIA spec 의 지역 R5
- 상세: `R5` 는 각 spec 파일 내부 로컬 번호이므로 파일 경계가 다르면 같은 번호가 여러 파일에 존재하는 것이 허용된다. 본 draft 가 새로 추가하는 R5 는 `chat-channel-adapter.md` 에 추가되는 것으로 기존 R1~R4 의 다음 번호로 올바르다. chat-channel-adapter.md 에는 현재 R1~R4 만 있으며 R5 는 없다. 단, `15-chat-channel.md §5.3` 에서 `EIA §R5` (EIA spec 의 R5) 를 명시적으로 인용하는 문장이 있어(`[EIA §R5]`) 독자가 "chat-channel-adapter.md §R5" 와 "EIA §R5" 를 혼동할 여지가 있다.
- 제안: 수용 가능. 다만 차후 cross-spec Rationale 참조 시 파일 prefix 를 명시하는 컨벤션(예: `[CCH-adapter §R5]`)을 권장한다. 현재 시스템 spec 의 cross-ref 패턴(`[EIA §R10]`, `[EIA §R5]` 등)과 충돌하지는 않는다.

---

### [INFO] §3.5 renumber — 기존 `#### 3.5 비기능 요구사항` 를 §3.6 으로 밀어냄

- target 신규 식별자: `spec/5-system/15-chat-channel.md` 의 `#### 3.5 실행 실패 사용자 안내 (CCH-ERR-*)` 신설, 기존 §3.5 (`비기능 요구사항`) 를 §3.6 으로 renumber
- 기존 사용처:
  - `/Volumes/project/private/clemvion/spec/5-system/15-chat-channel.md` 내부 참조: `CCH-NF-01` / `CCH-NF-02` / `CCH-NF-03` 가 본문·Rationale 여러 곳에서 `#35-비기능-요구사항` 앵커가 아닌 `CCH-NF-*` ID 로만 참조됨 — 앵커 경로 `#35-비기능-요구사항` 직접 참조는 확인된 파일 범위 내에서 없음.
  - `/Volumes/project/private/clemvion/spec/5-system/12-webhook.md` line 310: `(CCH-NF-01)` ID 로만 참조 (앵커 아님).
  - `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md` 및 기타 — CCH-NF-* ID 로만 참조.
- 상세: 실제 앵커 URL `#35-비기능-요구사항` 을 외부에서 직접 참조하는 링크는 검색된 범위에서 발견되지 않았다. 요구사항 ID `CCH-NF-*` 자체는 변경되지 않으므로 ID 수준 충돌은 없다. 단, 앵커 기반 링크가 향후 작성될 가능성을 위해 draft 가 `CCH-NF-*` 를 새 §3.6 으로 이동한다는 사실을 명확히 표기하면 좋다 (이미 draft 본문에 명시되어 있음).
- 제안: 현재 명시 방식으로 충분. 추가 조치 불필요.

---

### [INFO] `CCH-ERR-01` ~ `CCH-ERR-05` 신규 prefix — 기존 CCH 계열과 겹침 없음

- target 신규 식별자: `CCH-ERR-01`, `CCH-ERR-02`, `CCH-ERR-03`, `CCH-ERR-04`, `CCH-ERR-05`
- 기존 사용처: `spec/` 전체에서 `CCH-AD-*`, `CCH-CV-*`, `CCH-MP-*`, `CCH-SE-*`, `CCH-NF-*` prefix 만 사용됨. `CCH-ERR-*` 는 어떤 파일에도 존재하지 않음.
- 상세: prefix 가 완전히 신규이므로 충돌 없음.
- 제안: 없음.

---

### [INFO] `languageHints` 신규 키 6개 — 기존 키와 겹침 없음

- target 신규 식별자: `executionFailedThirdParty4xx`, `executionFailedThirdParty5xx`, `executionFailedThirdParty`, `executionFailedTimeout`, `executionFailedRateLimit`, `executionFailedInternal`
- 기존 사용처: `spec/` 와 `codebase/` 전체에서 기존 `languageHints` 키는 `groupChatRefusal`, `executionStarted`, `executionCompleted`, `executionStillRunning`, `help` 5종만 사용됨. 신규 6개 키와 동일한 문자열은 어디에도 없음.
- 상세: `executionCompleted` / `executionStillRunning` 와 `executionFailed*` 는 접두사 `execution` 공유이나 suffix 가 달라 직관적 구분이 된다. 혼동 가능성 없음.
- 제안: 없음.

---

### [INFO] 신규 TypeScript 인터페이스 `ExecutionFailureClass` / 함수 `classifyExecutionFailure` — 기존 코드베이스와 충돌 없음

- target 신규 식별자: `interface ExecutionFailureClass`, `function classifyExecutionFailure`
- 기존 사용처: `codebase/` 전체 검색에서 두 식별자 모두 존재하지 않음.
- 상세: 신규 파일 `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` 에 도입 예정으로, 충돌 없음.
- 제안: 없음.

---

### [INFO] Rationale `R-CC-15` — 기존 R-CC-14 다음으로 연속적, 충돌 없음

- target 신규 식별자: `R-CC-15` in `spec/5-system/15-chat-channel.md`
- 기존 사용처: 동 파일 내 최고 번호는 `R-CC-14` (line 597). `R-CC-15` 는 존재하지 않음.
- 상세: 연속 증가 패턴 준수, 충돌 없음.
- 제안: 없음.

---

### [INFO] 파일 경로 충돌 — 신규 spec 파일 추가 없음, 기존 파일 6개 수정만

- target 신규 식별자: 신규 파일 경로 없음. 기존 파일 `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/7-trigger/providers/telegram.md`, `spec/4-nodes/7-trigger/providers/slack.md`, `spec/4-nodes/7-trigger/providers/discord.md`, `spec/5-system/3-error-handling.md` 수정.
- 기존 사용처: 해당 경로들은 이미 존재하는 파일 — 신규 파일 생성 충돌 없음.
- 제안: 없음.

---

## 요약

target draft 가 도입하는 신규 식별자 중 CRITICAL 또는 실질적 의미 충돌이 발생하는 항목은 없다. CCH-ERR-* prefix, 6개 languageHints 키, `ExecutionFailureClass` / `classifyExecutionFailure` 타입명, `R-CC-15` Rationale ID 는 모두 기존 코퍼스에 존재하지 않아 완전 신규다. Convention `R5` 는 chat-channel-adapter.md 로컬 번호로 적절하며 같은 번호가 타 파일에서 사용되는 것은 파일 범위가 다르므로 허용된다. §3.5 renumber 는 앵커 직접 참조가 외부에서 확인되지 않아 실질 충돌이 없다. 단, Convention §3.1 신설로 `#3-eia-event--rendernode-매핑` 앵커를 참조하는 기존 slack.md / discord.md 두 링크의 텍스트가 의미상 stale 될 수 있으므로 동반 명확화를 권장한다 (blocking 사안은 아님).

## 위험도

LOW
