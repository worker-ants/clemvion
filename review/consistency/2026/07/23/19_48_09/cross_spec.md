### 발견사항

- **[WARNING]** `conversation-thread.md §2.4` 와 개정될 `presentation/0-common.md §4.6` 의 "필드 정의 SoT" 서술 정합 확정 방식이 target 에 없음
  - target 위치: `plan/in-progress/presentation-thread-optout-drift.md` "개정 방침" §1~§3, 체크리스트 `- [ ] conversation-thread.md §2.4 와 "몇 노드가 이 필드를 갖는가" 서술 정합 확인`
  - 충돌 대상: `spec/conventions/conversation-thread.md` §2.4 (opt-out), `spec/4-nodes/6-presentation/0-common.md` §4.6 (현재 텍스트)
  - 상세: 실측 결과 `conversation-thread.md §2.4` 는 이미 "필드 정의의 단일 진실은 **3 노드 공통 공유 fragment**"라고 명시해 presentation 은 스키마 SoT 에서 원래 배제돼 있었다(즉 §2.4 자체는 정확했고, drift 는 presentation 쪽 §4.6 이 "5 노드가 필드를 *가진다*"고 잘못 서술한 데 있었다). target 의 "개정 방침"은 §4.6 을 동작/표면 2층위로 고치겠다는 방향은 맞으나, §2.4 쪽은 "확인"만 체크리스트에 있고 **구체 편집 문구가 target 본문에 없다**. §2.4 는 "각 노드에 공통 boolean config" 로 시작해 필드 존재 자체는 범-노드적으로 서술하고 바로 다음 문장에서 "필드 정의 SoT = 3 노드" 로 좁히는 2단 구조인데, presentation 쪽이 "표면 미구현·passthrough 로만 동작" 으로 새로 서술되면 §2.4 도 대칭적으로 "presentation 5 노드는 게이트(런타임)만 공유하고 필드 선언은 없다" 는 대조 문장을 추가해야 두 문서가 같은 사실을 같은 어휘로 말하게 된다. 이 대칭 편집이 실제로 이뤄지지 않으면(체크리스트 항목이 "확인"에 그치고 편집 없이 종료되면) §2.4 는 여전히 3-노드 SoT 만 언급하는 채로 남고, §4.6 은 새로 "런타임 게이트는 전 노드 공통" 이라 쓰게 되어 두 문서가 "게이트가 어디까지 적용되는가" 를 다른 정밀도로 서술하는 재발 가능한 비대칭이 남는다.
  - 제안: `spec/conventions/conversation-thread.md §2.4` 편집을 target 의 "개정 방침" 항목에 **명시적으로 추가**한다(단순 "정합 확인"이 아니라 "presentation 5 노드도 동일 `appendInternal` 게이트를 공유하되 필드 선언 SoT 에는 포함되지 않는다"는 대조 문장을 §2.4 끝에 1줄 추가). 두 문서가 정확히 같은 표현("필드 정의의 단일 진실은 3 노드", "게이트는 노드 종류 무관") 을 재사용하도록 맞추면 향후 checker 가 다시 비대칭을 CRITICAL 로 재발견하는 것을 예방한다.

- **[INFO]** presentation `excludeFromConversationThread` 의 UI 그룹명이 AI 3 노드와 다르고 spec 어디에도 선례가 없음
  - target 위치: 현재 `spec/4-nodes/6-presentation/0-common.md:162` (target 이 정밀화하려는 대상 텍스트) — `UI 그룹: Advanced > Conversation`
  - 충돌 대상: `spec/conventions/conversation-thread.md:187`, `spec/4-nodes/3-ai/0-common.md:146` — AI 3 노드(`ai_agent`/`text_classifier`/`information_extractor`)는 동일 필드를 `Conversation Context` 섹션에 둔다(`spec/4-nodes/3-ai/1-ai-agent.md:165` 캔버스 목업에도 실제 헤더로 등장)
  - 상세: `grep -rn "Advanced > " spec/` 결과 이 표기는 presentation 카테고리 전체를 통틀어 이 한 줄에만 존재 — 다른 presentation 필드도, 다른 영역도 `Advanced > <subsection>` 2단 그룹 표기 관례를 쓰지 않는다. target 의 "표면(미구현)" 서술(`Advanced > Conversation` 그룹 없음)이 이 라인을 사실상 무효화하므로 지금 당장 충돌은 아니지만, 이름 자체는 향후 실제 구현 시 그대로 재사용될 위험이 있다 — 같은 필드명·같은 런타임 의미(§2.4 공통 게이트)를 가진 필드가 노드 카테고리에 따라 다른 UI 그룹 이름을 갖게 되면 사용자에게는 "다른 기능처럼" 보인다.
  - 제안: target 체크리스트의 "UI 노출은 Planned" 서술에 "구현 시 그룹명은 AI 노드와 동일한 `Conversation Context` 사용을 기본으로 하고, presentation 전용 이름이 필요하면 그 근거를 Rationale 에 남긴다"는 한 줄을 추가해 향후 구현자가 임의로 새 그룹명을 짓지 않도록 anchor 를 남긴다 (비차단, 참고용).

- **[INFO]** frontmatter `status` 조정이 `spec/0-overview.md §6.1` 의 카테고리 레벨 "구현 완료" 서술과의 정합 확인 항목이 체크리스트에 없음
  - target 위치: 체크리스트 `- [ ] frontmatter status·code: 조정 판단`
  - 충돌 대상: `spec/0-overview.md` §6.1 "노드 시스템" 행 — `Presentation(Carousel·Chart·Form·Table·Template)` 이 "구현 완료 (✅)" 카테고리에 열거
  - 상세: target 의 Rationale 은 §4.6 이 서술하는 *동작* 은 실재하므로 status 를 낮출 근거가 약하다고 스스로 밝히고 있어(§4.6 자체가 `Planned` 로 격하될 가능성은 낮아 보임), 이 항목이 실제로 `0-overview.md §6.1` 과 충돌할 가능성은 낮다. 다만 만약 `0-common.md` frontmatter `status` 가 `implemented` 이외 값(`partial` 등)으로 바뀐다면, 루트 cross-cutting 문서인 `0-overview.md §6.1` 이 presentation 카테고리를 뭉뚱그려 "구현 완료" 로 계속 표기하는 것과 세부 불일치가 생긴다.
  - 제안: frontmatter status 를 `implemented` 이외 값으로 내리기로 판단할 경우에만 `0-overview.md §6.1` presentation 행에 각주/참조를 추가하는 것을 후속 확인 항목으로 남긴다 (현재 계획대로 status 유지 시 조치 불요).

### 요약

target 자체(plan 문서)는 새 엔티티·API·요구사항 ID·상태 머신·RBAC 를 도입하지 않으며, 실측(코드 grep·`appendInternal`/`isOptedOut` 확인·5개 schema `.passthrough()` 확인)을 통해 "런타임 게이트는 노드 종류 무관 공통, presentation 은 schema 선언만 없음" 이라는 사실관계를 정확히 짚었다. 흥미롭게도 `spec/conventions/conversation-thread.md §2.4` 를 직접 열람한 결과 이 문서는 **이미** "필드 정의의 단일 진실은 3 노드 공통 fragment" 라고 정확히 서술하고 있어, drift 의 진짜 근원은 presentation 쪽 `§4.6` 하나였다는 target 의 결론이 cross-spec 관점에서도 뒷받침된다 — 즉 target 의 처방을 그대로 실행하면 기존에 존재하던 두 문서 간 비대칭(§2.4 vs 舊§4.6)이 오히려 해소된다. 남은 리스크는 그 해소가 "확인"에 그치지 않고 §2.4 쪽에도 대칭적 편집이 실제로 반영되는지, 그리고 presentation 전용 UI 그룹명이 향후 AI 노드와의 시맨틱 정합을 깨지 않는지이며, 둘 다 차단 사유는 아니다.

### 위험도
LOW
