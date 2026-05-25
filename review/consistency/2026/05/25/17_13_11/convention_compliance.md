# 정식 규약 준수 검토 — convention_compliance

**검토 대상**: `plan/in-progress/spec-draft-chat-channel-template-render-outbound.md`
**검토 모드**: spec draft (--spec)
**검토일**: 2026-05-25

---

## 발견사항

### [INFO] frontmatter 에 `type: spec-draft` 비표준 필드 사용
- target 위치: 파일 frontmatter 6행 (`type: spec-draft`)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
- 상세: plan-lifecycle §4 의 공식 frontmatter 스키마는 `worktree`, `started`, `owner` 3개 필드만 정의한다. `type: spec-draft` 는 스키마에 없는 필드다. 운영상 오동작은 없지만 스키마 드리프트다. 비교: `plan/in-progress/spec-draft-chat-channel-error-notify.md` 는 `draft_for`, `status`, `target_specs` 라는 추가 필드를 사용하고 있어 프로젝트 내에서도 비표준 확장 필드 패턴이 혼재되어 있음을 확인할 수 있다.
- 제안: plan-lifecycle.md §4 에 `type?: spec-draft | ...` 필드를 공식 추가하거나, target 문서에서 해당 필드를 제거. 현재는 다른 spec-draft 파일들과 일치하는 쪽으로 스키마를 확장하는 것이 더 적절해 보임. INFO 수준 — 운영 차단 아님.

---

### [WARNING] `§ 영향 평가` 에서 `renderPresentationNode` 언급 — 결정 3 (6함수 유지) 와 모순
- target 위치: `## 영향 평가` 섹션, "chat-channel 어댑터 구현" 불릿 4번째 항: `새 함수 renderPresentationNode 추가 — Telegram/Slack/Discord adapter 모두 구현 의무`
- 위반 규약: `spec/conventions/chat-channel-adapter.md §1 Adapter Interface` / `§1.1 6함수 책임` — 6함수 인터페이스 고정 원칙. 동일 파일 내 `## 결정` 섹션과도 모순: `결정 1` 과 `## Consistency-check 회차 §Round 2 C-6 해소` 는 명시적으로 `renderPresentationNode 신설 기각` + `renderNode 시그니처 union 확장 + 6함수 유지` 를 채택했음.
- 상세: Round 2 의 C-6 해소에서 "7번째 함수 추가는 R-CCA-5 대안 2 기각 우회" 를 명시 기각하고 `renderNode` union 확장을 채택했음에도, `## 영향 평가` 의 3번째 bullet 은 여전히 `새 함수 renderPresentationNode 추가 — Telegram/Slack/Discord adapter 모두 구현 의무` 를 나열하고 있다. 이 문장은 채택된 결정(6함수 유지, `renderNode` union 확장)과 직접 모순이다. 본 draft 를 토대로 spec 본문을 작성할 때 혼동을 줄 위험이 있음.
- 제안: `## 영향 평가` 의 해당 bullet 을 `renderNode 시그니처가 EiaEvent | ChatChannelInternalEvent union 입력으로 확장 (새 함수 아님) — 기존 6함수 인터페이스 유지` 로 수정.

---

### [WARNING] `§1.3 ChatChannelInternalEvent` 신설 후 `spec/conventions/chat-channel-adapter.md §1.1` 6함수 표의 `renderNode` 책임 컬럼 보강 범위가 spec 갱신안과 기존 convention 본문 사이에서 명확하지 않음
- target 위치: `## Spec 갱신안 §A §1.1 — 6함수 유지, renderNode 책임 문장만 보강` 섹션
- 위반 규약: `spec/conventions/chat-channel-adapter.md §1.1` — 기존 `renderNode` 행의 "책임" 컬럼은 `EIA payload → ChannelMessage[]. side-effect free` 로 정의됨.
- 상세: 갱신안의 표는 `renderNode` 의 책임 컬럼을 `EiaEvent | ChatChannelInternalEvent payload → ChannelMessage[]. side-effect free.` 로 보강한다고 명시하는데, 이는 맞다. 그러나 기존 convention 본문의 `§1 Adapter Interface` 의 TypeScript `interface ChatChannelAdapter` 내 JSDoc 주석 (`renderNode` 메서드 설명)은 `EIA outbound 이벤트 → 외부 채널 메시지 변환` 으로만 기술되어 있어, 표만 보강하고 interface 블록 JSDoc 도 함께 보강해야 하는 사실이 갱신안에서 누락되어 있다. spec 본문 반영 시 두 위치 (interface JSDoc + §1.1 표) 를 함께 갱신하지 않으면 convention 내부 불일치가 발생한다.
- 제안: 갱신안 §A §1.1 항목에 "interface ChatChannelAdapter 블록의 `renderNode` JSDoc 도 동시 보강 필요" 를 명시 추가. 또는 spec 반영 시 담당자가 두 위치를 함께 처리한다는 주석 보강.

---

### [INFO] `spec/conventions/chat-channel-adapter.md §3` 표 헤더가 갱신안에서 부분 변경됨 — 기존 표와의 관계 명시 필요
- target 위치: `## Spec 갱신안 §A §3 — 매핑 표` 섹션 — "기존 §3 매핑 표에 행 추가" 설명 뒤에 나오는 두 번째 표의 헤더가 `EIA / Internal event type | 입력 payload | 출력 ChannelMessage 시퀀스` 로 변경됨
- 위반 규약: `spec/conventions/chat-channel-adapter.md §3` — 현재 헤더는 `EIA event type | 입력 payload | 출력 ChannelMessage 시퀀스`
- 상세: 기존 §3 매핑 표 전체의 헤더를 `EIA / Internal event type` 으로 바꿔야 하는지, 아니면 신규 행만 별도 표(§3.x 등)로 두는지가 명확하지 않다. 본문에서 "기존 §3 매핑 표에 행 추가" 라고 되어 있으나 헤더가 달라지면 사실상 표 전체 교체에 해당한다. 일관성을 위해 기존 표 헤더도 `EIA / Internal event type` 으로 통일하거나, 신규 행 위에 각주/인라인 주석으로 `Chat-channel-internal 이벤트 포함` 을 명시하는 방식이 더 명확하다.
- 제안: 갱신안에서 기존 §3 표 헤더도 함께 `EIA / Internal event type` 으로 교체할지를 명시. 또는 "기존 표 헤더 변경 없이 신규 행만 추가한다 — 신규 행은 셀 내부에 `(chat-channel-internal — §1.3)` 을 명시하는 것으로 충분" 이라는 결정을 문서에 추가. INFO 수준 — 반영 시 혼동 방지용.

---

### [INFO] `§ Spec 갱신안 B §3.3 — CCH-MP-01 보강` 의 CCH-MP-01 ID 갱신 행이 표 추가인지 기존 행 교체인지 불명확
- target 위치: `### B. spec/5-system/15-chat-channel.md §3.3 — CCH-MP-01 보강` 섹션
- 위반 규약: CLAUDE.md `## 정보 저장 위치` 의 "단일 진실 원칙" — 요구사항 ID 는 `spec/<영역>/*.md` 본문에서 단일 진실.
- 상세: 갱신안이 `CCH-MP-01 (갱신)` 표를 신규로 보여주는데, 이는 기존 `CCH-MP-01` 행을 교체하는 것인지 또는 보완 행을 추가하는 것인지 명시되지 않았다. 만약 "같은 ID 의 두 행" 이 공존하면 단일 진실 원칙 위반이다 (요구사항 ID 중복). 이 점이 draft 에서 명확히 선언되지 않았기 때문에 spec 반영 담당자가 혼동할 여지가 있다.
- 제안: "기존 CCH-MP-01 행을 아래 내용으로 교체 (replace)" 임을 명시. 기존 행 텍스트 일부를 인용해 교체 대상을 특정하는 것이 더 명확함.

---

### [INFO] `§ Spec 갱신안 D CHANGELOG` 에 `spec/5-system/14-external-interaction-api.md` Changelog 항목이 Rationale 변경으로 분류되어 있으나 실제 변경 성격이 명확하지 않음
- target 위치: `### D. CHANGELOG 항목 추가` 마지막 bullet — `14-external-interaction-api.md (R10 본문 보강 행은 Rationale 변경이므로 별도 CHANGELOG 행 추가)`
- 위반 규약: CLAUDE.md `## 정보 저장 위치` — `결정의 배경·근거 → 해당 spec 문서 끝의 ## Rationale`. 본문 Rationale 에 추가된 내용이 맞다면 Changelog 항목 분류는 올바르다. 단, §C 갱신안의 변경 대상이 `§R10 본문 마지막` 이라고 되어 있어 Rationale 가 아닌 §R10 이라는 요구사항 본문에 추가되는 것처럼 읽힌다.
- 상세: 갱신안 C 는 `§R10 본문 마지막에 한 줄 보강` 이라고 기재했는데, `R10` 이 해당 spec 의 Rationale 섹션 항목인지 아니면 요구사항 본문 항목인지가 draft 에서 명시되지 않았다. 만약 R10 이 요구사항 ID 라면 Rationale 변경이 아니라 요구사항 본문 변경이다.
- 제안: §C 갱신안에 `§R10` 이 Rationale 항목임을 명시 (`## Rationale` 섹션의 R10 임을 한 줄로 확인). 또는 CHANGELOG 분류를 `요구사항 보강` vs `Rationale 보강` 으로 구분 명시.

---

## 요약

target 문서(`plan/in-progress/spec-draft-chat-channel-template-render-outbound.md`)는 plan-lifecycle 의 frontmatter 스키마 (`worktree`/`started`/`owner` 3필드)를 기본적으로 준수하고, `spec-draft-` prefix 명명 규약을 따르며, 문서 내 결정·근거 구조도 전반적으로 convention 정신에 부합한다. 그러나 `## 영향 평가` 섹션에서 Round 2 C-6 해소로 명시 기각된 `renderPresentationNode` 신설이 여전히 미수정 상태로 남아 있어, 채택된 결정(6함수 유지)과 직접 모순되는 WARNING 이 1건 존재한다. 이 불일치가 spec 본문 반영 시 7번째 함수 신설로 잘못 구현될 위험이 있다. 나머지 항목은 INFO 수준(비표준 frontmatter 필드, 표 헤더 명세 불명확, 교체/추가 구분 미명시)으로 운영 차단은 아니나 반영 시 혼동 방지를 위해 보강이 권장된다. `spec/conventions/chat-channel-adapter.md §1 interface JSDoc` 보강 누락도 WARNING 수준으로 확인된다.

---

## 위험도

MEDIUM
