# 정식 규약 준수 검토 — plan/in-progress/spec-telegram-chat-channel-ui-polish.md

검토 모드: spec draft (--spec)
검토 일시: 2026-05-23
대상 파일: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`

---

## 발견사항

### 1. [CRITICAL] §7 변경 관리 — "3 spec 동시 갱신" 원자성 주장이 실제 규약과 불일치

- **target 위치**: 결정 3 첫 단락 — "chat-channel-adapter.md §7 가 enum 변경 시 3 spec 동시 갱신을 의무화하므로"
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §7 변경 관리`
- **상세**: 실제 `chat-channel-adapter.md §7` 은 본 컨벤션 인터페이스 변경 시 **두 spec** (`spec/5-system/15-chat-channel.md` + `spec/4-nodes/7-trigger/providers/<name>.md`) 동시 갱신을 의무화한다. plan 문서는 여기에 `spec/conventions/chat-channel-adapter.md` 자신까지 3번째로 추가해 "3 spec 동시 갱신"을 규약이 요구하는 것처럼 서술하지만, 규약 원문은 두 외부 spec 갱신 의무만 명시하고 컨벤션 파일 자신은 별도로 언급하지 않는다. 컨벤션 파일 자체를 수정하는 것은 당연히 commit 에 포함돼야 하지만, "규약이 3개 동시 갱신을 의무화한다"는 근거 명시가 오인을 유발한다.
- **제안**: 해당 문구를 "chat-channel-adapter.md §7 이 두 외부 spec (15-chat-channel.md / telegram.md) 동시 갱신을 의무화하고, 본 결정은 컨벤션 파일 자체(chat-channel-adapter.md §2.3) 도 수정하므로 세 파일이 한 commit 으로 묶인다" 로 수정하거나, 또는 §7 규약 자체를 "컨벤션 파일 포함 3 spec" 으로 갱신해야 한다. 후자가 더 정확한 규약 갱신이다.

---

### 2. [WARNING] 결정 3 — `visualNode` enum 기본값(`default`) 이 규약 타입 정의와 사전 불일치

- **target 위치**: 결정 3 "enum 의 의미" / "영향 spec 파일" 표 — `spec/conventions/chat-channel-adapter.md §2.3` 변경 내용 ("default `auto`")
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` (현행)
- **상세**: 현행 `chat-channel-adapter.md §2.3` 의 `visualNode` 타입은 `"photo" | "text_only"` 이고 default 가 정의되어 있지 않다. plan 은 신규 enum `"text" | "photo" | "auto"` 과 `default "auto"` 를 도입할 것을 명시하는데, 이는 이 plan 문서 자체가 아직 실제 규약 파일을 수정하기 전에 선행 결정 사항으로 기술하는 것이므로 내용의 오류는 아니다. 그러나 plan 내 여러 곳에서 규약의 현재 상태를 "이미 갱신된 것처럼" 인용하는 표현이 혼재해 혼동을 유발한다. 예: 결정 1 "§2.3.1 필드 권한 매트릭스에 9개 row 추가" 에서 `uiMapping.visualNode (edit, enum — 결정 3 의 enum 인용)` — 이 시점에는 결정 3의 enum이 아직 규약 파일에 반영되지 않은 상태다.
- **제안**: "결정 3 의 enum 인용 (spec PR 머지 후 유효)" 과 같이 미래 상태임을 명시하거나, 영향 spec 파일 표의 적용 순서 의존성을 명문화한다.

---

### 3. [WARNING] plan 문서의 "배경 > 영향 받지 않는 부분" 자기 모순 — 12-webhook.md

- **target 위치**: "영향 받지 않는 부분 (의도된 boundary)" 섹션 2번째 항목 vs. "영향 spec 파일" 표 3번째 행
- **위반 규약**: CLAUDE.md "단일 진실 원칙" (정보 저장 위치)
- **상세**: "영향 받지 않는 부분" 에 `spec/5-system/12-webhook.md` — "WH-MG-08/09 그대로" 라고 기재되어 있고, 바로 위 "영향 spec 파일" 표에는 동일 파일을 "WH-EP-07 본문에 chatChannel 예외 조항 추가 + §3.1/§7 cross-link" 로 변경한다고 명시한다. 동일 파일이 "영향 없음" 과 "영향 있음" 두 섹션에 동시에 등장해 독자에게 오해를 유발한다. "WH-MG-08/09" 에 한정해서 영향 없음을 말하는 의도이나, 섹션 제목과 표 목록을 보면 혼동이 크다.
- **제안**: "영향 받지 않는 부분" 에서 `12-webhook.md` 행을 제거하고 해당 내용을 "영향 spec 파일" 표의 변경 요약란에 통합한다. 또는 명시적으로 "WH-EP-07 에만 추가, WH-MG-08/09 는 변경 없음" 으로 동일 파일 내 scope 경계를 분리 서술한다.

---

### 4. [WARNING] 결정 4 — 에러 응답 형식 "error envelope" 의 규약 참조 부재

- **target 위치**: 결정 4 "케이스 매트릭스" — `404 | error envelope`, `401 | error envelope` 행
- **위반 규약**: 출력 포맷 규약 (에러 응답 envelope 형식의 canonical 정의 위치 불명)
- **상세**: `error envelope` 라는 용어가 plan 문서에서 정의 없이 등장한다. 이 형식이 어느 spec 또는 convention 의 규약을 따르는지 (예: `spec/5-system/12-webhook.md` 의 기존 에러 응답 구조, 또는 별도 API error 규약) 참조가 없다. 향후 developer 가 구현 시 envelope 형식을 추론해야 한다.
- **제안**: `error envelope` 를 해당 spec 문서 링크 (예: `[WH-RS-02](../5-system/12-webhook.md#wh-rs-02)` 또는 API 에러 형식 SoT) 로 대체하거나, §5.5 신설 절에 envelope 형식 예시를 명시한다.

---

### 5. [WARNING] 결정 2 — `chatChannel_health` (snake_case) 와 `chatChannelHealth` (camelCase) 혼용

- **target 위치**: 결정 2 "에러 표면화" (`chatChannel_health='degraded'` + `chat_channel_last_error`) vs. 결정 1 매트릭스 항목 (`chatChannelHealth` / `chatChannelLastError`) 및 결정 4 매트릭스 (`chat_channel_health='degraded'`)
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` — 필드 명명은 camelCase
- **상세**: 동일 필드가 plan 내에서 `chatChannelHealth`(결정 1, 3), `chatChannel_health`(결정 2 에러 표면화), `chat_channel_health`(결정 4 매트릭스), `chat_channel_last_error`(결정 2, 4) 로 네 가지 혼용 표기가 나타난다. `ChatChannelConfig` 의 in-memory 타입 및 API DTO 는 camelCase를 사용하고, DB 컬럼은 snake_case를 사용하는 규약이 있다면 어느 컨텍스트에서 어느 명명을 쓰는지 일관성이 없다.
- **제안**: plan 문서 전체에서 컨텍스트를 구분해 일관성 있는 명명을 적용한다. API/DTO 컨텍스트는 `chatChannelHealth`/`chatChannelLastError` (camelCase), DB 컬럼 컨텍스트는 `chat_channel_health`/`chat_channel_last_error` (snake_case) 로 명시적으로 분리 표기한다.

---

### 6. [INFO] plan 문서 구조 — "## Overview" 섹션 부재

- **target 위치**: plan 문서 전체 구조
- **위반 규약**: CLAUDE.md "정보 저장 위치" — 제품 정의·요구사항은 `_product-overview.md` 또는 진입 문서의 `## Overview` 에 위치. Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장
- **상세**: plan 문서가 `## 배경`, `## 결정 4건`, `## 영향 spec 파일` 등으로 구성되어 있고, 권장 3섹션 (Overview / 본문 / Rationale) 패턴과 다르다. plan 문서는 spec 문서가 아니므로 강제 적용 대상은 아니나, `plan-lifecycle.md` 의 frontmatter 스키마는 준수되어 있다.
- **제안**: plan 문서는 spec 문서가 아니므로 3섹션 구조는 필수 적용 대상이 아님 — 현재 구조 유지해도 무방. INFO 수준 제안.

---

### 7. [INFO] 결정 3 — `chat-channel-adapter.md §7` 링크 경로 불일치

- **target 위치**: 결정 3 첫 줄 — `[chat-channel-adapter.md §7](../../spec/conventions/chat-channel-adapter.md#7-변경-관리)`
- **위반 규약**: 명명 규약 / 상대 경로 기준점
- **상세**: 해당 파일이 `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` 에 위치한다면, `../../spec/conventions/...` 경로는 `plan/` 의 두 레벨 위, 즉 레포 루트 기준 상대경로로 올바르다. 그러나 동일 결정 내 다른 파일 링크는 절대 경로 형식(예: `spec/conventions/chat-channel-adapter.md`)으로 작성되어 일관성이 없다.
- **제안**: plan 문서 내 cross-link 는 프로젝트 루트 기준 절대 경로 표기(`spec/conventions/...`)로 통일하거나, 모두 상대 경로로 통일한다.

---

## 요약

target plan 문서는 CLAUDE.md 의 frontmatter 스키마(`worktree`/`started`/`owner`)와 `plan-lifecycle.md` 구조를 전반적으로 준수하고 있다. 그러나 **CRITICAL 1건**: 결정 3이 `chat-channel-adapter.md §7` 의 "3 spec 동시 갱신 의무"를 인용하지만 실제 규약은 두 외부 spec 갱신만 의무화하므로 근거 오인 위험이 있다. WARNING 4건: §7 인용 오류 파생 혼동 외에도, 동일 파일(`12-webhook.md`)이 "영향 없음"과 "영향 있음" 두 섹션에 동시 등장하는 자기 모순, `error envelope` 형식의 규약 참조 부재, `chatChannelHealth`/`chat_channel_health` 등 동일 필드의 camelCase·snake_case 혼용이 발견된다. 이 발견사항들은 developer가 spec 갱신 작업에 착수할 때 ambiguity 를 유발할 수 있으므로, spec PR 작성 전에 plan 문서를 보정하는 것을 권장한다.

---

## 위험도

**MEDIUM**
