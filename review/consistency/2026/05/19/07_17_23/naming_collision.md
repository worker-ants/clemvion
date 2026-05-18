# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: `spec/4-nodes/3-ai/` (§11 System Context Prefix 관련 변경)

---

### 발견사항

- **[INFO]** `includeSystemContext` 필드명 — 기존 사용처 없음, 충돌 없음
  - target 신규 식별자: `includeSystemContext` (Boolean, 3 AI 노드 config 공통)
  - 기존 사용처: 코퍼스 전체에서 해당 필드명의 선행 사용처 없음
  - 상세: 신규 도입 식별자로 기존 엔티티·config 필드·DB 컬럼과의 이름 충돌 없음. `0-common.md §11.1`, `1-ai-agent.md §1`, `2-text-classifier.md §1`, `3-information-extractor.md §1` 네 곳에 일관 사용됨.
  - 제안: 이상 없음.

- **[INFO]** `systemContextSections` 필드명 — 기존 사용처 없음, 충돌 없음
  - target 신규 식별자: `systemContextSections` (String[], 3 AI 노드 config 공통)
  - 기존 사용처: 코퍼스 전체에서 해당 필드명의 선행 사용처 없음
  - 상세: 신규 도입 식별자. 기존 `systemPrompt`, `userPrompt` 등과 prefix가 같은 네임스페이스에 속하지만 의미 충돌 없음.
  - 제안: 이상 없음.

- **[INFO]** 허용 값 리터럴 `'time'` / `'timezone'` / `'workspace'` / `'node'` — 기존 예약어와 무관
  - target 신규 식별자: `systemContextSections` 허용 값 `'time'`, `'timezone'`, `'workspace'`, `'node'`
  - 기존 사용처: `'workspace'` 와 `'node'` 는 시스템 도메인 용어이나, 이 값들은 `systemContextSections` 배열 안에서만 사용되는 enum 값으로 다른 config 필드의 값과 혼용될 경로가 없음. `contextScope` 의 허용 값은 `'none' / 'thread' / 'lastN'` 이고, `contextInjectionMode` 의 허용 값은 `'messages' / 'system_text'` 로 교차하지 않음.
  - 상세: 충돌 없음.
  - 제안: 이상 없음.

- **[WARNING]** `System Context` 섹션 헤더 vs. 기존 `conversationHistory` / `contextScope` 계열 필드 — 명명 혼동 가능성
  - target 신규 식별자: `0-common.md §11` 제목 "AI 노드 시스템 프롬프트 자동 prefix (System Context Prefix)", 섹션 내 LLM prefix 블록 헤더 `## System Context`
  - 기존 사용처: `0-common.md §10` "Conversation Context (자동 컨텍스트 주입)" — `contextScope`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`. 두 기능 모두 "LLM 에 무언가를 자동 주입"하는 역할이지만 의미가 다름 (§10: 과거 turn, §11: 현재 시각·환경)
  - 상세: §10 의 "Conversation Context" 와 §11 의 "System Context Prefix" 는 목적이 다르며, spec 본문(§11 첫 단락 주석)에서 이미 둘의 차이를 명시함. 그러나 구현자가 `contextScope` / `contextInjectionMode` 와 `includeSystemContext` / `systemContextSections` 를 혼동할 가능성이 존재한다. spec 문서 자체의 구분은 명확하지만, 구현 코드에서 변수명이나 서비스 메서드명에 "context" 가 겹칠 수 있다.
  - 제안: 구현 시 서비스 클래스나 빌더 메서드명에서 `buildConversationContext()` (§10 담당)와 `buildSystemContextPrefix()` (§11 담당)처럼 suffix 로 명확하게 분리할 것을 권장. spec 레벨 식별자 충돌은 아니므로 WARNING 수준.

- **[INFO]** `Workspace.settings.timezone` 참조 — 기존 SoT 와 정합
  - target 신규 식별자: §11.3 에서 `Workspace.settings.timezone` 을 첫 번째 precedence 로 참조
  - 기존 사용처: `spec/1-data-model.md §2.2 Workspace.settings` JSONB — 이미 `timezone: string?` (IANA, NAV-SC-06) 로 명세됨. `spec/1-data-model.md §2.9 Schedule.timezone` 은 별도 컬럼으로 cron firing 기준이며 §11.3 Rationale 주석에서 양자 분리를 명시함.
  - 상세: 충돌 없음. 기존 SoT 를 올바르게 참조하고 있음.
  - 제안: 이상 없음.

- **[INFO]** `process.env.TZ` 환경변수 — 기존 사용처와 충돌 없음
  - target 신규 식별자: §11.3 fallback 체인의 두 번째 단계 `process.env.TZ`
  - 기존 사용처: `spec/0-overview.md §2.1` / `spec/1-data-model.md §2.2` 에서 `process.env.TZ` 언급 없음. `spec/0-overview.md §2.7` 의 `S3_BUCKET` 환경변수 등 다수의 ENV var 가 정의되어 있으나 `TZ` 는 신규 언급. Node.js 런타임 표준 환경변수로 기존 커스텀 ENV var 와 이름 충돌 없음.
  - 상세: 표준 `TZ` 환경변수 사용으로 기존 커스텀 ENV var 와 충돌 없음.
  - 제안: 이상 없음.

- **[INFO]** `meta.contextInjection` 필드 — `includeSystemContext` 와 별개 필드, 충돌 없음
  - target 신규 식별자: `1-ai-agent.md §7.1` 표에서 `meta.contextInjection` (§10 Conversation Context 관련 기존 필드)
  - 기존 사용처: §10 Conversation Context 에서 이미 정의된 meta 필드. §11 의 신규 필드(`includeSystemContext` / `systemContextSections`)는 `meta` 에 별도 echo 필드를 추가하지 않음(§11.7 config echo 에서 `output.config` 에만 조건부 echo). `meta.contextInjection` 과 이름 충돌 없음.
  - 상세: 충돌 없음.
  - 제안: 이상 없음.

- **[INFO]** config echo 조건 — `includeSystemContext` / `systemContextSections` 의 default-suppressed echo
  - target 신규 식별자: §11.7 의 "default 값과 일치하면 echo 생략" 정책 (CONVENTIONS Principle 7 의 optional 필드 echo 규약)
  - 기존 사용처: 기존 Principle 7 은 optional 필드에 대해 동일 정책을 적용. `1-ai-agent.md §7` config echo 정책 단락에 `includeSystemContext?` / `systemContextSections?` 를 조건부 echo 대상으로 이미 병기함.
  - 상세: 기존 규약의 연장선으로 일관성 있게 적용됨. 충돌 없음.
  - 제안: 이상 없음.

---

### 요약

target (`spec/4-nodes/3-ai/` §11 System Context Prefix 신설)이 도입하는 신규 식별자는 `includeSystemContext`, `systemContextSections` (두 config 필드), 허용 값 리터럴 `'time' / 'timezone' / 'workspace' / 'node'`, 그리고 `process.env.TZ` ENV var 참조이다. 이 중 기존 코퍼스의 엔티티·DB 컬럼·API endpoint·이벤트명·환경변수·파일 경로와 CRITICAL 또는 강한 의미 충돌을 일으키는 사례는 발견되지 않았다. 다만 §10 "Conversation Context"와 §11 "System Context Prefix" 양쪽이 모두 "context"라는 단어를 공유하므로 구현 코드의 서비스·메서드 네이밍에서 혼동이 생길 가능성이 있어 WARNING 1건을 기록한다. spec 식별자 자체는 두 기능이 명확히 분리되어 있으며, `Workspace.settings.timezone` SoT 참조도 기존 데이터 모델 정의와 정합하다. 전체적으로 명명 충돌 위험도는 낮다.

### 위험도

LOW
