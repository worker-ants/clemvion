# 정식 규약 준수 검토 결과

**대상**: `plan/in-progress/ai-presentation-tools.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-22

---

## 발견사항

### 1. Frontmatter 필드명 불일치

- **[WARNING]** `created` 키 사용 — plan-lifecycle 스키마는 `started` 를 요구
  - target 위치: frontmatter 5번째 행 (`created: 2026-05-22`)
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
    ```yaml
    started: 2026-05-13   # 스키마 정의
    ```
  - 상세: plan-lifecycle.md §4 는 날짜 필드 키를 `started` 로 고정한다. `created` 는 정의되지 않은 키이며, consistency-checker 의 `plan_coherence` 검사는 `started` 키를 기준으로 동시 작업 추적을 수행한다. `created` 를 사용하면 해당 검사에서 worktree 활성 여부를 판단하지 못할 수 있다.
  - 제안: `created: 2026-05-22` → `started: 2026-05-22` 로 변경.

### 2. Frontmatter `worktree` 값에 전체 경로 사용

- **[WARNING]** `worktree` 필드에 전체 경로 기재 — plan-lifecycle 스키마는 디렉토리 이름(slug)만 요구
  - target 위치: frontmatter 3번째 행 (`worktree: .claude/worktrees/ai-presentation-tools-9b7c5c`)
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
    ```yaml
    worktree: <task_name>-<slug>   # 디렉토리 이름만
    ```
  - 상세: 스키마 예시(`worktree: <task_name>-<slug>`)와 `consistency-checker` 의 `plan_coherence` checker 가 `worktree` 필드를 디렉토리 이름(예: `ai-presentation-tools-9b7c5c`)으로 조회한다고 가정하면, 전체 경로를 기재할 경우 충돌 검출이 깨진다. 다른 plan 파일들과의 형식 일관성도 훼손된다.
  - 제안: `worktree: .claude/worktrees/ai-presentation-tools-9b7c5c` → `worktree: ai-presentation-tools-9b7c5c` 로 변경.

### 3. Frontmatter 비표준 `title` · `status` 필드 존재

- **[INFO]** `title`, `status` 필드는 plan-lifecycle.md §4 스키마에 정의되지 않음
  - target 위치: frontmatter 1번째, 4번째 행
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마` — 정의된 키: `worktree`, `started`, `owner`
  - 상세: `title` 과 `status: in-progress` 는 추가 정보를 제공하지만 정식 스키마 외 키다. 과잉 기재라 해서 기능상 문제를 직접 유발하진 않으나, 스키마 일관성 관점에서 불필요한 필드다. `status: in-progress` 는 파일 위치(`plan/in-progress/`)로 이미 표현되므로 중복.
  - 제안: 비표준 필드 제거 혹은, 공식 스키마 갱신(`title` 허용 명시) 중 팀 선택. `status` 는 폴더 위치로 충분하므로 제거 권장.

### 4. `conversation-thread.md` §1.2 `data?` 필드 확장 누락 언급

- **[WARNING]** §2.10 의 "ConversationTurn 확장" 내용이 정식 규약 cross-ref 없이 명세됨
  - target 위치: §2 결정사항, 항목 10 (`ConversationTurn 확장: 기존 \`data?\` 자유 필드에 \`presentations: PresentationPayload[]\` 추가`)
  - 위반 규약: `spec/conventions/conversation-thread.md §1.2 ConversationTurn` — `data?` 필드는 `node-output §4.5` 의 단일 정의에 위임하도록 기술되어 있음
  - 상세: `ConversationTurn.data?` 의 shape 은 `spec/conventions/node-output.md §4.5` 가 단일 진실이다. 여기에 `presentations: PresentationPayload[]` 를 추가하려면 `conversation-thread.md §1.2` 의 `data?` 행 설명과, 필요 시 `node-output.md §4.5` 의 타입 목록을 함께 갱신해야 한다. plan §4.1 작업 단위에서는 `spec/conventions/conversation-thread.md §1.2 data? 설명에 presentations 필드 한 줄 cross-ref (선택)` 로 표현되어 있으나, `ConversationTurn.data?` shape 단일 진실(`node-output §4.5`)을 갱신해야 하는지의 결정이 명확하지 않다. `data?` 를 그냥 확장하면 `node-output §4.5` 와 drift 가 발생한다.
  - 제안: §4.1 작업 목록에 `spec/conventions/node-output.md §4.5` 갱신 여부를 명시적으로 결정사항으로 추가. `ConversationTurn` 에 별도 top-level 필드 `presentations?` 를 추가하는 것이 `data?` shape drift 를 회피하는 더 안전한 패턴임을 검토할 것.

### 5. `output.result.response` 에서 `presentations` 분리 규칙과 node-output Principle 8.2 정합 확인 권장

- **[INFO]** §2.11·§6 에서 언급하는 "downstream 노드의 `output.result.response` 는 텍스트만 운반" 패턴은 `node-output.md Principle 8.2` 의 LLM 응답 텍스트 경로(`output.result.response`)와 일치하나, `presentations` 의 최종 귀속 위치(`output.result.presentations?` vs `output.presentations?` vs ConversationTurn 전용)가 spec draft 에 아직 명시되지 않음
  - target 위치: §2 항목 10·11, §6 완료 조건 2번째 항목
  - 위반 규약: `spec/conventions/node-output.md Principle 8.2` — LLM 계열 노드의 도메인 결과는 `output.result.*` 아래에 모인다
  - 상세: `presentations` 가 AI Agent 의 `NodeHandlerOutput.output` 에 어떤 경로로 실려나가는지(예: `output.result.presentations[]` vs `output.presentations[]` vs ConversationTurn 에만 내재화) 가 plan 본문에 정의되지 않았다. §4.3 에서 `_resumeState.presentations accumulator` 로 누적하다가 turn 종료 시 어떤 output path 로 surfacing 되는지가 모호하다. `output.result.response` 가 텍스트만 운반한다는 완료 조건은 명시되어 있지만, presentations 의 공식 output path 가 없으면 downstream 노드가 `$node["AI"].output.???` 로 참조할 수 없다.
  - 제안: §2 또는 §4.1 에 "presentations 의 output path (`output.result.presentations[]` 또는 ConversationTurn 전용 비노출)" 를 명시적 결정사항으로 추가. Principle 8.2 정합을 위해 `output.result.presentations[]` 경로를 권장.

### 6. `PRESENTATION_RENDER_SCHEMA_INVALID` 에러 코드 — node-output Principle 3.2 에 정의된 UPPER_SNAKE_CASE 준수 확인

- **[INFO]** 에러 코드명 자체는 규약 준수
  - target 위치: §2 항목 7, §4.1 `§10 에러 코드` 목록
  - 위반 규약: 없음 (준수)
  - 상세: `PRESENTATION_RENDER_SCHEMA_INVALID` 는 `node-output.md Principle 3.2` 의 `code` 는 `UPPER_SNAKE_CASE` 요건을 충족한다. 단 plan 이 "에러 코드 신설 없이 meta 로 surface 만" 도 가능하다고 열어 두었는데, meta 로만 노출할 경우 `Principle 3.2` 의 `output.error.code` 패턴 대신 `meta.presentationSchemaViolations` 로 기록하는 것은 규약상 허용된다(`meta` 는 실행 메트릭 — Principle 2). 최종 결정을 spec draft 에 명기 권장.

### 7. `WebSocket` 이벤트 이름 `execution.ai_message` 에 규약 참조 누락

- **[INFO]** §2 항목 11 에서 WebSocket 이벤트를 언급하나 spec/conventions 참조가 없음
  - target 위치: §2 항목 11 (`WebSocket 이벤트: 기존 \`execution.ai_message\` 누적 스냅샷에 presentations 포함`)
  - 위반 규약: 직접 위반 없음 (INFO)
  - 상세: `conversation-thread.md §9.7 WS 이벤트 → store 변환 계약` 의 `ai_message` REPLACE 정책 표에서, `ai_message` snapshot 에 presentations 가 포함될 경우 carry-over 정책이 어떻게 적용되는지를 명시해야 한다. plan 이 "누적 스냅샷에 포함" 으로만 기술하면 §9.7 의 carry-over 계약과 충돌 여부가 모호하다.
  - 제안: §4.1 spec 갱신 목록에 `spec/conventions/conversation-thread.md §9.7 ai_message carry-over 정책` 과의 정합성 확인 항목 추가.

---

## 요약

`plan/in-progress/ai-presentation-tools.md` 는 기능·설계 내용 자체는 규약과 충돌하는 요소가 적으나, **plan 문서 메타 레이어(frontmatter)에서 두 가지 규약 위반**이 존재한다. `started` 키 대신 `created` 를 사용한 것과 `worktree` 필드에 전체 경로를 기재한 것은 plan-lifecycle.md 스키마 직접 위반으로, consistency-checker 의 worktree 충돌 검출 기능이 오작동할 수 있다. 설계 내용 면에서는 `ConversationTurn.data?` 단일 진실(`node-output §4.5`)과의 drift 위험, `presentations` 의 `output.*` 경로 미결정이 구현 착수 전 해소가 필요한 WARNING 수준 항목이다. 에러 코드 명명·WebSocket 이벤트 참조 등은 INFO 수준으로 규약 정합성 제안에 해당한다.

---

## 위험도

**MEDIUM**

(frontmatter 스키마 위반 2건이 도구 자동화 오작동을 유발할 수 있으며, `presentations` output path 미결정이 구현 단계에서 node-output Principle 8.2 위반으로 이어질 위험이 있음)
