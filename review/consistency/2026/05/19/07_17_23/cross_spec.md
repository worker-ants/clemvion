# Cross-Spec 일관성 검토 결과

검토 대상: `spec/4-nodes/3-ai/` (0-common.md §11 신설, 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md §1/§4/§6 갱신)
검토 모드: 구현 착수 전 (`--impl-prep`)

---

### 발견사항

- **[INFO]** `Workspace.settings.timezone` 참조 — `spec/1-data-model.md` 와 정합, 단 Schedule default timezone 역할 이중 명시
  - target 위치: `0-common.md §11.3` "Timezone SoT 정책" — `Workspace.settings.timezone` 을 AI 시스템 컨텍스트 prefix 의 timezone SoT 로 사용
  - 충돌 대상: `spec/1-data-model.md §2.2` Workspace.settings 설명 — `settings.timezone` 이 "AI 노드의 System Context Prefix ([Spec AI 공통 §11.3]) 와 Schedule 의 default timezone 이 본 값을 참조" 로 명시
  - 상세: target 의 §11.3 은 AI 시스템 컨텍스트용 timezone SoT 를 정의하고, `spec/1-data-model.md §2.2` 는 동일 필드가 Schedule 의 default timezone 역할도 겸한다고 설명한다. 두 문서 모두 같은 값을 참조하므로 직접 모순은 없다. 단, target §11.3 주석에서 "Schedule 의 timezone ([spec/1-data-model.md §2.9]) 은 cron trigger 의 firing 기준 — 본 §11 의 AI 시스템 컨텍스트와 별개 SoT" 라고 명시해 Schedule.timezone 필드와 Workspace.settings.timezone 을 의도적으로 분리하고 있다. 이 분리가 `spec/2-navigation/3-schedule.md §2` 의 "기본: 워크스페이스 설정" 과 정합한지 확인 필요 (Schedule 생성 시 UI 기본값이 Workspace.settings.timezone 을 내려주는 것은 일치; Schedule row 에 저장된 timezone 이 firing 기준이 되는 것도 일치 — 별개 필드·별개 SoT 로 공존).
  - 제안: 현재 기술로 충돌 없음. 동기화 권장 수준 — `spec/2-navigation/3-schedule.md §2` 에 "스케줄 생성 시 기본값으로 워크스페이스 설정을 사용하지만, 저장 후에는 Schedule.timezone 이 독립 SoT" 라는 한 줄을 보완하면 미래 혼동을 방지할 수 있다.

- **[INFO]** `systemPrompt build ordering` — `spec/conventions/conversation-thread.md §5` 와 정합, SoT 명시 일치
  - target 위치: `0-common.md §11.4` "주입 위치 및 ordering" — ordering 의 단일 SoT 를 §11.4 로 선언
  - 충돌 대상: `spec/conventions/conversation-thread.md §5` (AI Agent 자동 주입) — 동일 ordering 을 언급하면서 "단일 SoT 는 [Spec AI 공통 §11.4]" 로 위임
  - 상세: 두 문서가 같은 ordering (`[System Context Prefix] → [사용자 systemPrompt] → [KB/condition suffix] → [thread injection]`) 을 기술하고 있으며, conversation-thread.md 가 §11.4 에 SoT 를 명시적으로 위임하고 있어 충돌 없음.
  - 제안: 정합 확인됨. 추가 조치 불필요.

- **[INFO]** `spec/conventions/cafe24-api-metadata.md §5.3` — "두 채널 보완" 관계 정합, 추가 충돌 없음
  - target 위치: `0-common.md §11.6` "Cafe24 등 MCP 도구와의 cross-check" 및 §Rationale
  - 충돌 대상: `spec/conventions/cafe24-api-metadata.md §5.3` — AI Agent 도구 description 자동 suffix 규약
  - 상세: target 은 systemPrompt prefix (§11) 와 도구 description suffix (cafe24-api-metadata §5.3) 가 "보완 관계" 임을 명시하고, 두 채널이 한 묶음 결정 (2026-05-18) 임을 CHANGELOG 에 기록. cafe24-api-metadata.md §5 Timezone Semantics 는 역방향으로도 "AI 시스템 프롬프트 prefix ([Spec AI 공통 §11]) 와 함께 두 채널 노출" 을 Rationale 에 명시. 상호 일관성 확인됨.
  - 제안: 정합 확인됨. 추가 조치 불필요.

- **[INFO]** `includeSystemContext` / `systemContextSections` config echo — CONVENTIONS Principle 7 준수 선언, 단 노드별 §7 출력 구조 표와의 명시적 연결 확인 필요
  - target 위치: `0-common.md §11.7` "config echo" — 두 필드는 Principle 7 raw config echo 대상, default 값 일치 시 생략
  - 충돌 대상: `1-ai-agent.md §7` (출력 구조) 의 config echo 설명 — "includeSystemContext / systemContextSections 는 default 값과 일치하면 echo 에서 생략 ([공통 §11.7])" 이라고 명시
  - 상세: target §11.7 의 "default 값과 일치하면 생략" 정책이 ai-agent.md §7 에서 inline 인용되어 있어 정합. text-classifier 와 information-extractor 의 §출력 구조 표에도 동일 정책이 적용되어야 한다. 확인 결과 text-classifier.md §5.1 의 config 표 설명에 `includeSystemContext` 가 명시적으로 언급되어 있지 않으나 "설정된 경우만 echo" 패턴이 적용되어 있어 묵시적으로 정합. 단 명시적 주석이 없어 구현자가 두 필드의 echo 생략 정책을 오해할 여지 있음.
  - 제안: `2-text-classifier.md §5.1` 의 config 필드 표, `3-information-extractor.md §5` 의 config 필드 표에 "includeSystemContext / systemContextSections — default 일치 시 echo 생략 ([공통 §11.7])" 주석을 각각 추가해 구현자 혼동을 방지할 것을 권장.

- **[INFO]** `$now` 변수의 UTC 고정 — `spec/5-system/4-execution-engine.md §6.2` 와 정합
  - target 위치: `0-common.md §11.2` 섹션 표 — "`$now` (execution 단위 frozen, UTC). prefix 본문에는 §11.3 의 timezone 으로 변환된 ISO 출력"
  - 충돌 대상: `spec/5-system/4-execution-engine.md §6.2` "제공 변수" — `$now` 가 UTC ISO8601 으로 정의
  - 상세: `$now` = UTC 라는 것이 두 문서 모두에서 일관되게 기술됨. target 은 이를 기반으로 prefix 에 노출할 때 Workspace.settings.timezone 으로 변환하는 로직을 §11.3 에 별도 정의. 충돌 없음.
  - 제안: 정합 확인됨. 추가 조치 불필요.

---

### 요약

`spec/4-nodes/3-ai/` 의 §11 (System Context Prefix) 신설은 기존 spec 영역 — `spec/1-data-model.md §2.2` (Workspace.settings.timezone), `spec/conventions/conversation-thread.md §5` (systemPrompt build ordering SoT), `spec/conventions/cafe24-api-metadata.md §5.3` (도구 description 자동 suffix), `spec/5-system/4-execution-engine.md §6.2` ($now UTC 정의) — 모두와 정합적이다. CRITICAL 또는 WARNING 등급의 직접 모순은 발견되지 않았다. INFO 수준으로 `2-text-classifier.md` 와 `3-information-extractor.md` 의 출력 구조 표에 `includeSystemContext` / `systemContextSections` 의 config echo 생략 정책을 명시적으로 주석 추가하는 것이 구현 시 혼동 방지에 유용하나, 이는 명확성 개선이지 충돌 수정이 아니다. 구현 착수를 차단할 이슈가 없다.

### 위험도

NONE
