# 정식 규약 준수 검토 — spec-telegram-chat-channel-ui-polish

검토 대상: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-05-23

---

## 발견사항

### [WARNING] Frontmatter 스키마 필드명 불일치 — `created` vs `started`

- **target 위치**: 파일 상단 frontmatter (lines 2–7), 특히 `created: 2026-05-23` 필드
- **위반 규약**: `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마
  > `started: 2026-05-13  # ISO 날짜` — 날짜 필드 키가 `started` 로 명시됨
- **상세**: target 문서는 `created: 2026-05-23` 을 사용하고 있으나, `plan-lifecycle.md §4` 의 공식 스키마는 `started` 를 요구한다. `created` 는 정의된 키가 아니다. `consistency-checker` 의 `plan_coherence` 체커가 이 필드를 읽어 동시 작업 추적 및 worktree 충돌 검출에 활용하므로, 필드명 불일치는 자동화 도구가 해당 값을 파싱하지 못하는 문제로 이어질 수 있다.
- **제안**: frontmatter 의 `created: 2026-05-23` 을 `started: 2026-05-23` 으로 rename.

---

### [WARNING] Frontmatter 스키마에 없는 추가 필드 다수 포함

- **target 위치**: 파일 상단 frontmatter (lines 2–7), `status`, `owner`, `branch`, `related_pr`, `priority` 필드
- **위반 규약**: `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마
  > 공식 정의된 3개 필드: `worktree`, `started`, `owner`
- **상세**: target 문서는 정식 스키마에 없는 `status`, `branch`, `related_pr`, `priority` 를 추가로 선언하고 있다. plan-lifecycle.md 는 허용 필드를 3개로 제한하며, `worktree` 필드에 관해서도 스키마는 `<task_name>-<slug>` 디렉토리 이름만 기재하도록 하나, 여기서는 전체 경로(`.claude/worktrees/telegram-chat-channel-spec-polish-49c49b`)가 들어가 있다 — 이 자체는 minor issue 이나 명세와 다른 형식이다.
  - `status` : 공식 스키마에 없음. 라이프사이클 상태는 파일 위치(in-progress/ ↔ complete/) 로 관리 — 별도 필드 불필요(plan-lifecycle.md §1).
  - `branch`, `related_pr`, `priority` : 공식 스키마에 없음.
- **제안**: 공식 스키마(`worktree`, `started`, `owner`)만 유지. 추가 필드가 필요하다고 판단될 경우, plan-lifecycle.md 에 필드 확장을 명시적으로 추가하는 규약 갱신이 선행되어야 한다. `worktree` 값은 디렉토리 이름(`telegram-chat-channel-spec-polish-49c49b`)만 기재.

---

### [CRITICAL] `ChatChannelConfig.uiMapping.visualNode` 현행 enum 과 결정 3의 교체 대상 명칭 불일치 — 규약 직접 변경 의도 명시 필요

- **target 위치**: 결정 3 섹션, "기존 `text_only` 와 `photo` 의 2-enum 명세를 폐기하고 위 3-enum 으로 교체"
- **위반 규약**: `spec/conventions/chat-channel-adapter.md` §2.3 `ChatChannelConfig`
  > 현행 규약의 `uiMapping.visualNode` 타입: `"photo" | "text_only"`
- **상세**: 결정 3은 기존 `text_only` → `text` 로 rename + `auto` 신설하여 `"text" | "photo" | "auto"` 로 교체한다고 명시한다. 이는 `spec/conventions/chat-channel-adapter.md §2.3` 의 정식 enum 정의(`"photo" | "text_only"`)를 직접 변경하는 사항이다. target 문서(plan)는 이 변경을 **영향 spec 파일** 목록에 포함시키고 있으나(`spec/conventions/chat-channel-adapter.md §2.3`), plan 문서 자체의 결정 서술에서 "기존 text_only 와 photo 의 2-enum 명세를 폐기"라는 표현이 현행 규약 값과 정확히 대응한다.
  - 채택 시 규약 §2.3 의 `visualNode?: "photo" | "text_only"` 가 `visualNode?: "text" | "photo" | "auto"` 로 교체되어, 해당 타입을 참조하는 모든 adapter 구현 + 테스트 + spec 이 동시 갱신 의무를 가진다 (`chat-channel-adapter.md §7` 의 변경 관리 조항: "본 인터페이스 변경은 다음 두 spec 동시 갱신 의무").
  - plan 이 지정한 동시 갱신 대상(`spec/5-system/15-chat-channel.md §4.1`, `spec/4-nodes/7-trigger/providers/telegram.md §5.4`)은 §7 요건과 일치하나, **Changelog 항목 추가** 의무(컨벤션의 Changelog 섹션 존재)가 plan 에 명시되지 않았다. plan 은 "Changelog 한 줄" 만 언급하는데, 기존 Changelog 형식(`| 날짜 | 내용 |` 표)에 맞추어 기재할 것을 명시해야 한다.
- **제안**: plan 결정 3 서술에 다음을 명시적으로 추가:
  1. `spec/conventions/chat-channel-adapter.md §7` 의 변경 관리 조항 인용 — 동시 갱신 의무 범위(spec 2개 + 구체 provider 명세 전체) 재확인.
  2. Changelog 신규 행 포맷을 `| 2026-05-23 | §2.3 visualNode enum: "photo"\|"text_only" → "text"\|"photo"\|"auto" 교체, text_only deprecated. ... |` 형식으로 미리 draft.
  이는 규약 invariant 를 깨는 변경이므로 plan 실행 시점에 두 spec 파일 + codebase 어댑터의 동시 갱신을 누락하면 시스템 불일치가 발생한다.

---

### [WARNING] `hasBotToken` boolean 필드 — 규약 미등록 신규 API 응답 필드

- **target 위치**: 결정 2 섹션, "UI 는 ref 의 존재 여부를 별 boolean 필드 `chatChannel.hasBotToken: true` 로 알 수 있음"
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` (현행 타입 정의에 미존재)
- **상세**: `chatChannel.hasBotToken` 은 API 응답(`GET /api/triggers/:id`)의 `config.chatChannel` 객체에 노출되는 새 boolean 필드이다. 이 필드는 현행 `ChatChannelConfig` 타입 정의에 없으며, plan 이 이를 규약 차원에서 추가한다고 명시하지 않았다. plan 은 `spec/5-system/15-chat-channel.md §5.4` 보강 대상으로 언급하나, `spec/conventions/chat-channel-adapter.md §2.3` 의 `ChatChannelConfig` 인터페이스 타입에도 동시 반영이 필요함을 명시하지 않는다.
  - `chat-channel-adapter.md §7` 의 변경 관리 조항: 인터페이스 변경 시 두 spec 동시 갱신 의무. `ChatChannelConfig` 에 `hasBotToken?: boolean` 추가 시 §7 이 적용된다.
- **제안**: 결정 2 또는 "영향 spec 파일" 표에 `spec/conventions/chat-channel-adapter.md §2.3` 에 `hasBotToken?: boolean` 을 추가해야 함을 명시. 단, `hasBotToken` 은 in-memory `ChatChannelConfig` 가 아닌 API 응답 전용 필드일 경우, 별도 Response DTO 에만 반영하고 `ChatChannelConfig` 인터페이스 변경을 피하는 방안도 검토해야 함을 plan 에 기재 권장.

---

### [WARNING] 에러 코드 케이스 매트릭스의 `error envelope` 응답 포맷 — 규약 참조 미명시

- **target 위치**: 결정 4 섹션, 케이스 매트릭스의 404/401 행의 "error envelope"
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 (`output.error` 표준 형태), 및 `swagger.md §2-4` 상태 코드 응답 규칙
- **상세**: plan 은 404/401 케이스에서 "error envelope" 를 반환한다고 명시하나, 이 envelope 의 구체 형식을 특정 규약에 연결하지 않는다. 프로젝트에는 `GlobalExceptionFilter` 가 출력하는 `ErrorResponseDto` (`swagger.md §5-5`) 가 단일 에러 응답 포맷 SoT 이다. "error envelope" 가 해당 포맷과 동일한지, 또는 별도 포맷인지 plan 에서 명시하지 않아 구현 시 모호성이 발생할 수 있다.
  - `swagger.md §5-5`: `ErrorResponseDto` 는 `GlobalExceptionFilter` 출력을 1:1 로 표현. 모든 에러 응답은 이 포맷을 따르는 것이 규약 의도.
- **제안**: 결정 4 의 spec §5.5 신설 서술에 error envelope 포맷이 `GlobalExceptionFilter` / `ErrorResponseDto` 규약을 따름을 명시. 또는 chat-channel inbound handler 가 별도 응답 형식을 사용한다면 그 이유를 Rationale 에 기재.

---

### [INFO] 결정 3 노드 타입별 v1/v2 매트릭스 표 — 규약 Changelog 항목 추가 요건

- **target 위치**: 결정 3 섹션, "노드 타입별 v1/v2 매트릭스 표 신설"
- **위반 규약**: `spec/conventions/chat-channel-adapter.md` Changelog 섹션 (존재하는 모든 변경은 Changelog 에 등재)
- **상세**: 컨벤션 문서에는 Changelog 섹션이 있고, 기존 갱신 내역이 날짜별로 상세히 기재되어 있다. plan 의 결정 3이 §2.3 enum 변경뿐 아니라 §3 매핑 표의 "시각형 노드 행 v1/v2 정책"에도 영향을 줄 가능성이 있다(v2 표 명세가 §3 표와 연관). plan 은 Changelog 갱신을 "한 줄" 로만 언급하며, §3 의 변경 여부를 명확히 하지 않는다.
- **제안**: plan 실행 시 `chat-channel-adapter.md §3` 의 시각형 노드 행(v1/v2 정책 분리 표) 도 enum 교체에 따라 `"auto"` 분기를 반영해야 하는지 확인 후 Changelog 항목에 포함.

---

### [INFO] `chatChannel_health` / `chat_channel_last_error` — snake_case 혼재 우려

- **target 위치**: 결정 2 섹션, "chatChannel_health='degraded' + chat_channel_last_error" 문자열
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` 및 `spec/5-system/15-chat-channel.md` (직접 위반은 아니나 일관성 관점)
- **상세**: plan 의 결정 2 서술에서 `chatChannel_health='degraded'` 와 `chat_channel_last_error` 는 snake_case 식별자를 사용한다. 그러나 `ChatChannelConfig` 의 필드(camelCase: `chatChannelHealth`, `chatChannelLastError`)와 대응 DB 컬럼(snake_case: `chat_channel_health`)이 혼재하는 상황에서, plan 서술이 어느 레이어의 식별자인지 구분 없이 혼용하면 개발자가 구현 시 혼란을 겪을 수 있다. 결정 1 의 §2.3.1 필드 권한 매트릭스에서는 `chatChannelHealth` (camelCase) 로 올바르게 표기하고 있으나, 결정 2 에서는 `chatChannel_health` (snake_case) 로 다르게 표기한다.
- **제안**: plan 의 결정 2 서술에서 camelCase(API/TypeScript 레이어) 와 snake_case(DB 컬럼 레이어)를 명확히 구분. API 레이어 언급이라면 `chatChannelHealth: 'degraded'` 로 통일. DB 컬럼을 가리킨다면 그 맥락을 명시.

---

## 요약

target 문서(`plan/in-progress/spec-telegram-chat-channel-ui-polish.md`)는 전반적으로 plan 의 내용·구조·Rationale 계획 면에서 높은 완성도를 보이나, 정식 규약 준수 관점에서 다음 사항이 식별된다.

**가장 중요한 사항**은 (1) frontmatter 의 `created` 키가 plan-lifecycle.md 가 요구하는 `started` 와 불일치하고, (2) `ChatChannelConfig.uiMapping.visualNode` enum 변경(`text_only` → `text`, `auto` 신설)이 `chat-channel-adapter.md §7` 의 동시 갱신 의무 조항을 트리거하는 정식 규약 직접 변경 사항임에도 불구하고, plan 에서 그 범위(구체 provider 명세 전체 동시 갱신 + Changelog 포맷)가 충분히 명시되지 않은 점이다. 특히 `visualNode` enum 변경은 기존 `"text_only"` 값을 사용하는 모든 소비자(어댑터 구현, 테스트, 관련 spec)에 파급 효과가 있으므로, 실제 spec 갱신 PR 전에 동시 변경 범위를 plan 에 명확히 기재해야 한다. `hasBotToken` 신규 필드의 `ChatChannelConfig` 반영 여부도 규약 문서와 정합이 필요하다.

---

## 위험도

**MEDIUM**
