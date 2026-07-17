# 정식 규약 준수 검토 — `plan/in-progress/rag-tool-row-distinct-ui.md`

검토 모드: spec draft 검토 (--spec)
대조 규약: `spec/conventions/conversation-thread.md` (전문 로드, 669줄) + `.claude/docs/plan-lifecycle.md` + CLAUDE.md

## 발견사항

- **[WARNING]** §9.2 강제 열거(아이콘·컨테이너·chip 목록) 갱신이 Phase 1 계획에서 누락
  - target 위치: target 문서 "Phase 1 — spec 개정" 항목 1~8 (특히 항목 3 "§9.1 매핑표 행 추가")
  - 위반 규약: `spec/conventions/conversation-thread.md` §9.2 "시각 구분 신호 (3중 강제)" — 항목1 아이콘 열거(`👤 vs 🤖 vs 🧩 vs 🔧 vs ℹ️ vs ❌`), 항목2 컨테이너 열거(`chat bubble vs full-width 회색 카드 vs 가운데정렬 라인(system 회색/system_error 빨간)`), 항목3 chip 열거(`presentation/tool/system/system_error 은 헤더에 chip 노출`)
  - 상세: §9.1 매핑표에 행을 추가하는 것과 §9.2 의 강제 열거 목록을 갱신하는 것은 별개 지점이다. 실측 대조 결과 §9.2 는 정적 표가 아니라 **글자 그대로 source 이름·글리프를 나열**하는 산문이며, `system_error` 도입 시(§8.3 Rationale) 이 열거 3곳 모두에 `❌`·"가운데정렬 라인(system/system_error)"·`system_error` chip 언급이 실제로 추가돼 있다(현재 본문이 그 결과). target 의 Phase 1 리스트는 §9.1 만 명시하고 §9.2 갱신을 별도 스텝으로 두지 않아, 실제 spec 작성 시 이 갱신이 누락될 위험이 있다 — 누락되면 §9.1 은 `rag` 를 7번째 source 로 그리는데 §9.2 의 강제 열거(사람이 읽는 3중 신호 규칙 원문)는 6개만 나열하는 self-drift 가 생긴다.
  - 제안: Phase 1 에 "§9.2 강제 열거 갱신 — 아이콘 목록에 `🔎`, 컨테이너 목록에 점선 라인 타입, chip 목록에 `rag`(`KB · N chunk(s)`) 추가" 를 명시적 항목으로 추가.

- **[WARNING]** §9.11 "세 변환 path" 헤딩 서수 및 등가성 정의가 `injectRagItems` 성격과 어긋날 가능성
  - target 위치: target 문서 "Phase 1" 항목 6, "Phase 2" 항목 1
  - 위반 규약: `spec/conventions/conversation-thread.md` §9.11 "변환 함수 contract" — "세 변환 path 의 책임" 표, 등가성 관계 `threadTurnsToConversationItems(turns) ⊆ messagesToConversationItems(messages)`
  - 상세: §9.11 의 등가성은 **같은 turn 을 `turns`(thread snapshot)와 `messages`(emit) 두 소스에서 각각 도출한 ConversationItem 다중집합**이 동치·부분집합 관계라는 전제 위에 있다. 그런데 자동 RAG 주입은 `ConversationTurn`/`ConversationThread` 도메인 밖의 sidecar 메타(`meta.turnDebug[].ragSources`)에서 오고, KB guidance 는 system prompt 안에 흡수돼 `ai_message.messages[]` 에 별도 message 로 나타나지 않는다(target 문서 자신도 "LLM 호출 직전"·"엔진이 컨텍스트를 주입"이라 명시). 즉 `injectRagItems` 는 §9.11 이 다루는 "turns↔messages 이중 표현의 동치" 구조와 대응하는 message-side 짝이 없다. 그럼에도 target Phase 1 항목 6 은 "등가성 서술"을 그대로 요구해, 실제로는 성립하지 않는 등가성을 억지로 기술하게 될 위험이 있다. 또한 §9.11 표 위 산문이 명시적으로 "**세** 변환 path" 라고 서수를 못박고 있어, 4번째 함수 등재 시 이 서수 표현도 함께 갱신하지 않으면 본문(3)과 표(4행)가 자기모순된다.
  - 제안: 실제 스펙 작성 단계에서 (a) §9.11 헤딩의 "세" → "네" 갱신, (b) `injectRagItems` 가 기존 subset 등가성 대신 어떤 invariant(예: idempotency — 같은 `turnDebug` 재적용 시 중복 삽입 없음, 또는 live/history 양쪽에서 동일 위치·개수로 삽입)를 만족하는지 별도로 명문화. "등가성 없음이 결론"이면 그 자체를 §9.11 에 적어야지 §9.11 의 subset 문구를 그대로 재사용하지 않는다.

- **[WARNING]** §9.3 데이터 소스 표에 `rag` 행 추가 시 기존 "conversation Preview 탭" 행과의 관계 미정의
  - target 위치: target 문서 "Phase 1" 항목 5
  - 위반 규약: `spec/conventions/conversation-thread.md` §9.3 "데이터 소스 선택" — 표는 "UI 용도" 행마다 "1차 소스" 1개를 정의하는 구조
  - 상세: 현재 §9.3 표의 "conversation Preview 탭" 행은 1차 소스가 `conversationThread.turns` snapshot 하나로 고정돼 있다. target Phase 1 항목 5 는 `rag` 행을 별도로 추가해 1차 소스를 `meta.turnDebug[].ragSources` 로 정의하려 하는데, 이는 **같은 UI 표면(conversation Preview 탭)이 두 개의 서로 다른 소스(turns snapshot + turnDebug)를 동시에 참조**하는 패턴이 되어, "UI 용도당 1차 소스 1개" 로 짜인 현재 §9.3 표 구조가 이 병렬-합성 패턴을 표현하지 못한다.
  - 제안: `rag` 행을 별도 행으로 추가하는 동시에, 기존 "conversation Preview 탭" 행 비고에 "`rag` 합성을 위해 `turnDebug` 를 보조 소스로 병용"과 같은 상호 참조를 남기거나, §9.3 표 자체의 컬럼 구조(주 소스/보조 소스 구분)를 함께 검토.

- **[WARNING]** Phase 2 의 `result-timeline.tsx` wiring 이 "확인"으로만 기술돼 양쪽 surface 동시 적용 의무 충족 여부 불명확
  - target 위치: target 문서 "Phase 2" 항목 4, 5
  - 위반 규약: `spec/conventions/conversation-thread.md` §9.6 "적용 surface (동시 적용 의무)", §9.9 Inv-5, §9.12 §3 "적용 surface (동시 적용 의무)" — 모두 "conversation Preview 탭"과 "실행 트리 timeline(`ResultTimeline`)" 두 surface 에 신규 시각 정책을 동시 적용할 것을 명시적으로 강제하는 선례
  - 상세: Phase 2 항목 4 는 `result-detail.tsx` 에 `injectRagItems` 를 명시적으로 "배선"한다고 적었지만, 항목 5 는 `result-timeline.tsx` 에 대해 "Inv-5(양 surface 동일 결과) 준수 **확인**"이라고만 적어, 실제로 `rag` 행이 `ResultTimeline` 표면에도 나타나도록 코드 변경이 필요한지, 이미 공유 파이프라인을 타서 자동 반영되는지가 계획 문서만으로 판별되지 않는다. CT-S18 검증 항목(a)는 "🔎 RAG 행과 🔧 도구 행이 각각 별도 row 로 노출"만 요구해 어느 surface 인지 명시하지 않는데, §9.6/§9.12 선례상 두 surface 모두를 의미하는 것이 자연스럽다.
  - 제안: Phase 2 항목 5 를 "동일 items 파이프라인 공유 여부 확인, 미공유 시 `result-timeline.tsx` 에도 `injectRagItems` 배선" 으로 명확화하거나, CT-S18/19 검증 기준에 "양 surface" 를 명시적으로 못박아 §9.6/§9.9 Inv-5 의 선례를 명시적으로 상속.

- **[INFO]** §9.6 `rag` 제외 서술에 `isAssistantContentBlank` 미적용 명시가 빠짐 (system_error 문구 완전 대칭 제안)
  - target 위치: target 문서 "Phase 1" 항목 4
  - 위반 규약: 없음 — `spec/conventions/conversation-thread.md` §9.6 의 기존 `system_error` 제외 문구와의 대칭성 제안
  - 상세: 기존 §9.6 은 `system_error` 제외를 서술하며 "`isAssistantContentBlank` 평가 미적용" 을 명시적으로 덧붙인다. `rag` 는 애초에 `source === 'ai_assistant'` 요건(§9.6 조건 1)에서 이미 탈락하므로 기능적으로는 문제 없지만, target 의 항목 4 문구는 이 부분을 생략했다.
  - 제안: 실제 spec 작성 시 `system_error` 제외 문구를 그대로 복제(대상 source 명만 `rag` 로 교체)해 패턴 이탈 없이 완전 대칭을 유지 권장.

- **[INFO]** frontmatter `owner: developer` 와 Phase 1(spec 개정)의 역할 경계
  - target 위치: target 문서 frontmatter `owner: developer`, "Phase 1 — spec 개정" 헤딩
  - 위반 규약: 직접 위반 아님 — CLAUDE.md Skill 체계 표 참고("project-planner: spec/**, plan/**" / "developer: codebase/**, plan/**, review/**/RESOLUTION.md — spec/ read-only")
  - 상세: `.claude/docs/plan-lifecycle.md` §4 의 frontmatter 스키마 자체는 `worktree`/`started`/`owner` 3필드 필수·형식만 규정하며 `owner` 값에 제약을 두지 않는다 — 이 관점에서 target frontmatter(`worktree: rag-tool-row-distinct-ui-e39447`, `started: 2026-07-17`, `owner: developer`)는 **스키마 자체는 완전히 준수**한다 (worktree 이름도 실제 디렉토리와 일치, started 도 ISO 형식). 다만 target 문서는 Phase 1 에서 `spec/conventions/conversation-thread.md` 직접 개정을 지시하는데, frontmatter `owner` 는 `developer` 로 고정돼 있다. CLAUDE.md 는 "spec/ 변경 → project-planner", "developer 는 spec/ read-only" 를 명시하므로, 실행 시 Phase 1 을 project-planner 서브에이전트가 담당하는 한 정합적이나 plan 문서 자체에는 이 역할 전환이 드러나지 않는다.
  - 제안: 필수 수정 사항은 아니나, 여러 phase 가 서로 다른 role 경계를 넘나드는 경우 Phase 헤딩에 담당 role 을 명시(예: "Phase 1 — spec 개정 (project-planner 담당)")하면 혼동을 줄일 수 있다.

## 정합성 확인 (위반 아님 — 대조 결과 기록)

- **(a) §1.1.1/§1.2.1 문서 구조·번호 패턴**: `spec/conventions/conversation-thread.md` 실측 결과 §1.1 아래 유일한 하위 절은 §1.1.1(`system_error`), §1.2 아래 유일한 하위 절은 §1.2.1(`system_error` data shape)이며 §1.3~§1.6 은 그와 무관한 독립 형제 절이다. target 의 "§1.1.2 신설"/"§1.2.2 신설" 제안은 이 번호 체계와 정확히 정합(§1.3 이하와 번호 충돌 없음). "backend enum 5값 불변, frontend 6→7값" 서술도 §1.1.1 원문("backend `ConversationTurnSource` 5값" / "frontend... 6값")과 일치. `§8.6 Rationale` 신설 제안도 기존 §8.1~§8.5 순번과 정확히 이어짐(§8.3 이 `system_error` 신설 rationale 선례). 위반 없음.
- **(b) §9.2 3중 시각 신호 — 겹침 여부**: §9.1 매핑표 6행 실측 대조 결과 아이콘(👤/🤖/🧩/🔧/ℹ️/❌) 어느 것과도 `🔎` 가 겹치지 않고, chip 형식(`<nodeType-icon> <nodeLabel>` / tool name+badge / `<nodeLabel> · <code>`) 중 `KB · N chunk(s)` 와 동일한 것이 없다. 컨테이너는 "점선 테두리 라인(full-width, chat bubble 아님)"으로 기존 chat bubble·회색 카드·도구 카드·가운데정렬 라인(system/system_error) 어느 것과도 시각적으로 구분되는 패턴이다 — 3중 신호 자체는 겹치지 않는다(단, 이 신호를 §9.2 의 강제 열거 문구에 실제로 반영하는 절차는 위 WARNING 참고).
- **(d) §9.6 그룹 분류 제외 서술 일관성**: target "system_error 와 동일하게 groupToolCallItems 가 rag 를 unclaim 으로 두고 indent tree 에 흡수하지 않는다. Inv-2 정합" 문구는 실제 §9.6 원문의 `system_error` 제외 문구("unclaim 상태 그대로 두며 indent tree 에 흡수하지 않는다 ... Inv-2 의 '그룹 단위로만 줄어든다' 정합")와 표현·구조가 정확히 대칭. 위반 없음(세부 완전성 제안은 위 INFO 참고).
- **(e) plan frontmatter 스키마**: `.claude/docs/plan-lifecycle.md` §4 요구 3필드(`worktree`/`started`/`owner`) 모두 존재·형식 정합. `worktree` 값은 placeholder 가 아니라 실제 worktree 디렉토리명과 일치, `started` 는 `YYYY-MM-DD` ISO 형식으로 문서 본문 "작성일" 과도 일치. 스키마 위반 없음.

## 요약

target plan 은 §1.1.1/§1.2.1(system_error) 이 확립한 문서 번호·서술 패턴을 §1.1.2/§1.2.2 신설에 정확히 이식했고, §8.6 Rationale 번호·§9.6 그룹 제외 문구·§9.10 CT-S18/19 순번 부여 방식도 기존 선례와 정합적이다. §9.2 3중 시각 신호(아이콘/컨테이너/chip) 는 실측상 기존 6 source 와 겹치지 않아 신규 `rag` source 자체의 시각 설계는 견고하다. 다만 실행 절차 수준에서 네 가지 WARNING 이 있다 — (1) §9.2 의 강제 열거 목록 갱신이 Phase 1 리스트에서 누락돼 §9.1/§9.2 self-drift 위험, (2) `injectRagItems` 가 §9.11 의 turns↔messages 등가성 구조와 구조적으로 다른 성격(메시지 대응짝 없음)임에도 그 조항의 문구를 그대로 적용하려는 계획이라 실제 스펙 작성 시 등가성 정의를 억지로 짜맞출 위험, (3) §9.3 표 구조가 한 UI 표면에 두 소스가 병렬 합성되는 신규 패턴을 아직 표현하지 못함, (4) Phase 2 의 `result-timeline.tsx` wiring 이 "확인"에 그쳐 §9.6/§9.9 Inv-5 선례의 양쪽 surface 동시 적용 의무 충족이 계획만으로는 불명확. 이들은 모두 CRITICAL 은 아니며(regd, 신설 patterns 자체가 conventions 를 직접 위반하지 않음) plan 이 이미 예정한 `/consistency-check --spec` 착수 전 의무 단계에서 충분히 걸러질 수 있는 성격이나, Phase 1 항목 리스트에 명시적으로 반영해두면 실제 spec 저작 시 누락 위험이 줄어든다.

## 위험도

MEDIUM
