# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-ai-timezone-context.md`
검토 모드: spec draft (--spec)

---

### 발견사항

- **[CRITICAL]** `cafe24-api-metadata.md` §5 신설로 기존 §5/§6/§7/§8 앵커가 무효화됨
  - target 신규 식별자: `## 5. Timezone Semantics` (새 §5)
  - 기존 사용처:
    - `spec/conventions/cafe24-api-metadata.md:186` `## 5. 신규 endpoint 추가 절차` → §6 으로 밀림
    - `spec/conventions/cafe24-api-metadata.md:203` `## 6. MCP Bridge 와의 매핑` → §7 으로 밀림
    - `spec/conventions/cafe24-api-metadata.md:227` `## 7. allowlist 와의 관계` → §8 으로 밀림
    - `spec/conventions/cafe24-api-metadata.md:233` `## 8. CHANGELOG` → §9 으로 밀림
    - 이 섹션들을 직접 앵커로 참조하는 외부 파일:
      - `spec/4-nodes/4-integration/4-cafe24.md:370` → `cafe24-api-metadata.md#6-mcp-bridge-와의-매핑`
      - `spec/4-nodes/4-integration/4-cafe24.md:378` → `cafe24-api-metadata.md#7-allowlist-와의-관계`
      - `spec/2-navigation/4-integration.md:975` → `cafe24-api-metadata.md#7-allowlist-와의-관계`
      - `spec/4-nodes/4-integration/4-cafe24.md:124,554,591` → `cafe24-api-metadata.md#4-wire-format-…` (§4 앵커는 변동 없으나 §5+ 이후의 내부 참조가 흔들림)
  - 상세: target 의 §5 삽입으로 기존 §5→§6, §6→§7, §7→§8, §8→§9 로 번호가 전체 shift 된다. `4-cafe24.md` CHANGELOG (line 591) 는 2026-05-16 에 §4 envelope 을 삽입할 때도 동일 패턴의 앵커 renaming 을 수행했음을 보여준다 — 이번에도 같은 작업이 필요하다. 갱신 누락 시 `#6-mcp-bridge-와의-매핑` / `#7-allowlist-와의-관계` 링크가 broken anchor 가 된다 (2개 파일 3곳).
  - 제안: (A) 신규 §5 삽입 후 `4-cafe24.md:370,378` 및 `4-navigation/4-integration.md:975` 의 앵커를 각각 `#7-mcp-bridge-와의-매핑` / `#8-allowlist-와의-관계` 로 갱신. (B) 대안으로, §5 를 파일 끝 전 CHANGELOG 바로 앞(현재 §8 뒤)인 §8.5 나 §9 위치에 신설하면 기존 §5-§8 을 shift 하지 않아도 된다 — 단, "앞 섹션이 뒤 섹션보다 일반 규약인 것이 자연스럽다"는 가독성 이유로 target 이 §5 위치를 선택한 것이므로 (A) 경로가 적절하다.

---

- **[WARNING]** `0-common.md` 기존 §11 "CHANGELOG" 가 새 §12 로 밀림 (CHANGELOG entries 내 자기 참조 일관성)
  - target 신규 식별자: `## 11. 시스템 컨텍스트 자동 주입 (System Context Prefix)` (새 §11)
  - 기존 사용처: `spec/4-nodes/3-ai/0-common.md:147` `## 11. CHANGELOG` (기존 §11) — "기존 §10 CHANGELOG → §11 로 번호 변경" 이라는 CHANGELOG 항목 자체(line 152)에 §11이 언급됨
  - 상세: target 의 새 §11 삽입으로 현재 `## 11. CHANGELOG` 가 `## 12. CHANGELOG` 로 밀린다. CHANGELOG 자체는 외부 링크 대상이 아니므로 broken anchor 직접 발생 가능성은 낮으나, CHANGELOG 항목 본문 "기존 §10 CHANGELOG → §11 로 번호 변경"이 부정확한 기록이 된다. 또한 향후 이 파일을 참조하는 spec 이 생길 때 일관성이 깨질 수 있다.
  - 제안: 신규 §11 삽입 시 기존 CHANGELOG 항목 중 "§11" 숫자를 "§12" 로 갱신하거나, CHANGELOG 행에 "기존 §11 CHANGELOG → §12 로 번호 변경" 내용을 반영한 새 행을 추가한다.

---

- **[WARNING]** `0-common.md` §10 "Conversation Context (자동 컨텍스트 주입)" 와 새 §11 "시스템 컨텍스트 자동 주입" 제목 유사 — 혼동 가능성
  - target 신규 식별자: `## 11. 시스템 컨텍스트 자동 주입 (System Context Prefix)` 의 제목
  - 기존 사용처: `spec/4-nodes/3-ai/0-common.md:129` `## 10. Conversation Context (자동 컨텍스트 주입)`. `spec/4-nodes/3-ai/1-ai-agent.md:27,29,55` 에서 `공통 §10` 앵커로 3곳 참조. `spec/conventions/conversation-thread.md:3` 에서도 `Spec AI 공통 §10` 으로 참조.
  - 상세: §10 은 ConversationThread 기반의 멀티턴 컨텍스트 주입(사용자 대화 히스토리 injection), §11 은 systemPrompt 앞에 붙이는 현재 시각/timezone prefix 다. 역할이 명확히 다르나, 두 제목 모두 "자동 주입"·"컨텍스트"를 공유하여 처음 읽는 기여자가 혼동할 수 있다.
  - 제안: §11 제목을 "시스템 컨텍스트 자동 주입" 대신 "실행 환경 컨텍스트 자동 prefix" 또는 "AI 노드 시스템 프롬프트 자동 prefix" 처럼 §10 과 키워드 공유를 줄이는 이름으로 변경. 부제 `(System Context Prefix)` 를 앞으로 이동해 주 제목으로 쓰는 것도 유효하다.

---

- **[INFO]** `spec/4-nodes/3-ai/0-common.md` §10 앵커가 새 §11 삽입 후에도 유효한지 확인 필요
  - target 신규 식별자: §11 삽입
  - 기존 사용처: `spec/4-nodes/3-ai/1-ai-agent.md:27,29,55` 와 `spec/conventions/conversation-thread.md:3` 에서 `0-common.md#10-conversation-context-자동-컨텍스트-주입` 앵커를 4곳에서 사용
  - 상세: Markdown 앵커는 헤딩 번호가 아니라 헤딩 텍스트 기반이다. §10 제목 "Conversation Context (자동 컨텍스트 주입)" 는 변경되지 않으므로 앵커 `#10-conversation-context-자동-컨텍스트-주입` 은 §11 삽입 후에도 유효하다. 단, 프로젝트 내 §번호 참조 스타일(예: `공통 §10`)을 사용하는 본문 텍스트(링크가 아닌 산문)는 여전히 §10 을 가리키므로 별도 갱신 불요. 명시적 확인 권장.
  - 제안: spec 개정 시 `grep -rn "§10\|§11" spec/4-nodes/3-ai/` 로 산문 내 번호 참조가 새 배치와 불일치하는지 최종 확인.

---

- **[INFO]** `spec/4-nodes/3-ai/2-text-classifier.md` / `3-information-extractor.md` 의 config 표에 `includeSystemContext` / `systemContextSections` 추가 — 기존 충돌 없음 (확인 결과)
  - target 신규 식별자: `includeSystemContext` (Boolean), `systemContextSections` (String[])
  - 기존 사용처: `spec/4-nodes/3-ai/{1-ai-agent,2-text-classifier,3-information-extractor}.md` 의 config 표, 및 backend 코드 `codebase/backend/src/` 전체 grep 결과 — 해당 식별자 사용처 없음
  - 상세: 두 config 필드 모두 기존 spec·코드에서 사용되지 않아 충돌은 없다. 단, `systemContextSections` 가 허용하는 문자열 리터럴 `'time'` / `'timezone'` / `'workspace'` / `'node'` 는 모두 프로젝트 내 기존 개념 이름과 겹치는 단어지만, 이들은 열거 리터럴(union type) 로만 사용되므로 식별자 충돌이 아님.
  - 제안: 없음. 단, 구현 시 zod schema 의 `z.enum(['time', 'timezone', 'workspace', 'node'])` 타입 정의가 Node.category 같은 기존 enum 과 네임스페이스가 분리되어 있는지 확인 권장.

---

### 요약

target 이 도입하는 신규 식별자 중 실제 충돌·broken-reference 가 발생하는 지점은 `cafe24-api-metadata.md` 의 §5 삽입이다. 기존 §5 "신규 endpoint 추가 절차" / §6 "MCP Bridge 와의 매핑" / §7 "allowlist 와의 관계" 가 각각 §6/§7/§8 로 밀리는데, 이미 `spec/4-nodes/4-integration/4-cafe24.md` 두 곳과 `spec/2-navigation/4-integration.md` 한 곳에서 `#6-mcp-bridge-와의-매핑` 및 `#7-allowlist-와의-관계` 앵커를 직접 사용하고 있어 갱신하지 않으면 broken link 가 된다. 이 패턴은 2026-05-16 §4 삽입 때도 동일하게 발생해 그 시점에 앵커를 수동 갱신한 선례가 있다. `0-common.md` 의 새 §11 삽입으로 인한 CHANGELOG 밀림과 §10/§11 제목 유사성은 Warning 수준으로, 기능 충돌이 아닌 가독성·기록 정합성 이슈다. 신규 config 필드(`includeSystemContext`, `systemContextSections`) 및 새 섹션 컨텐츠 내용 자체에는 기존 식별자와의 의미 충돌이 없다.

### 위험도

MEDIUM
