# 정식 규약 준수 검토 — RAG 주입 행 신설 + 도구 행과 시각 구분 (2회차)

검토 대상: `plan/in-progress/rag-tool-row-distinct-ui.md` (spec draft, `--spec` 모드)
1회차: `review/consistency/2026/07/17/11_32_25/convention_compliance.md` (WARNING 4 + INFO 2)
비교 대상 정식 규약: `spec/conventions/conversation-thread.md`(전문 직접 로드, 668줄), `spec/5-system/6-websocket-protocol.md` §4.4, `spec/5-system/9-rag-search.md` §4.1, `.claude docs`(CLAUDE.md / plan-lifecycle.md)

> **선행 메모 — prompt payload 는 stale**: `_prompts/convention_compliance.md` 에 임베드된 target 사본은 target 실 파일보다 mtime 이 이르다(payload 11:47:40 생성, 실 파일 11:54:49 수정). diff 결과 실 파일은 payload 대비 함수/컴포넌트 명명이 `mergeRagInjectionItems`/`RagInjectionRow`/`RagInjectionDetail` → **`mergeRagRetrievalItems`/`RagRetrievalRow`/`RagRetrievalDetail`** 로 전량 치환되어 있다(그 외 내용 동일). 본 리뷰는 **실 파일(`plan/in-progress/rag-tool-row-distinct-ui.md`) 기준**으로 작성했다 — 오케스트레이터의 "처분" 요약("함수명은 `injectRagItems` → `mergeRagInjectionItems`")은 이 재명명 이전 상태를 가리키므로 최신화 필요.

---

## 발견사항

### 1회차 처분 충족 여부 (요청 (a))

- **W1 → 항목4 (§9.2 열거 갱신, L123)**: 충족. §9.2 는 "① 아이콘: 👤 vs 🤖 vs 🧩 vs 🔧 vs ℹ️ vs ❌ — 서로 겹치지 않는 글리프" 를 **열거**로 명시하고 있어(원문 확인), 항목4 가 이 열거에 🔎 를 추가하도록 명시한 것은 규약이 실제로 요구하는 지점을 정확히 짚었다.
- **W2 → 항목6 (§9.11 서수, L128/L130)**: **부분 미충족** — 아래 "새 발견 WARNING 1" 참조. "두 1차 변환 함수"·"세 변환 path" 를 **함께** 갱신하라는 지시가 실제로는 과도할 수 있다.
- **W3 → 항목6 (§9.3 관계 명시, L125-127)**: 충족. blockquote 가 `turnDebug` 를 "제3의 소스" 로 명확히 구분하고 "1행의 대체가 아닌 보완" 으로 서술하도록 지시한 점, §8.1 D4 범위 명확화(항목7)와 연계한 점 모두 W3 의 요구를 satisfy.
- **W4 → Phase2 항목6 (result-timeline.tsx, L166)**: **부분 충족** — "확인"이 아니라 실제 렌더 구현 + CT-S18 양 surface 검증을 요구하도록 강화된 점은 맞으나, 근거로 인용한 "§9.6 적용 surface" 자체가 이 요구를 실제로 강제하는지는 재검토 필요 (아래 새 발견 WARNING 5).
- **I1 → 항목5 (§9.6 그룹 분류 제외, L124)**: 충족. `isAssistantContentBlank` 미적용을 `system_error` 문구와 대칭으로 명시했다.
- **I2 (frontmatter owner) → 미처분**: 아래 "요청 (c)" 항목에서 별도 분석.

### 새로 추가된 Phase 1 항목 7~14 검증 (요청 (b))

- **Inv-9 번호 연속성 (항목8, L132)**: **정합 확인**. `spec/conventions/conversation-thread.md` §9.9 는 현재 Inv-1~Inv-8 8개만 정의(연속 결번 없음, L571-578 실측) — Inv-9 는 정확히 다음 순번이다. 번호 자체는 문제 없음.
- 그러나 §9.9 의 절 서두 문장이 **"다음 8가지 불변량은..."** 로 카운트를 명시하는데(원문 L567), 항목8 은 Inv-9 행 추가만 지시할 뿐 이 서두 카운트("8가지"→"9가지") 갱신을 언급하지 않는다 — §9.11 에서 이미 문제로 지적된 것과 **동일 계열의 서수 drift** 가 §9.9 에도 잠재한다. → 아래 새 발견 WARNING 2.
- 항목7(§8.1 D4), 항목9(§9.12), 항목12-13(websocket-protocol §4.4), 항목14(rag-search §4.1) 는 모두 실측으로 근거를 확인했다 — `websocket-protocol.md` 에 `nodeOutput.meta.turnDebug` 가 wire 필드로 명시적으로 문서화된 곳이 없음(§4.4.5 `conversationThread`, `conversationConfig` 만 문서화됨, L420-441 확인), `9-rag-search.md` §4.1(L296)이 "Preview 탭 = chip-only" 로 서술되어 있어 항목14 의 drift 주장이 정확함, `RagSource` 스키마(L277-289)에 timestamp 필드가 없어 항목9 의 전제가 정확함을 모두 확인했다. 이 네 항목 자체는 규약 위반이 없다.

### 요청 (c) — frontmatter `owner: developer` 와 Phase 1 spec 개정의 역할 경계

CLAUDE.md 는 "개발자(`developer`) 는 `codebase/**`, `plan/**`, `review/**/RESOLUTION.md` 쓰기 권한, **`spec/` read-only**" 그리고 "구현 중 spec 변경 필요 시 `developer` 는 멈추고 `project-planner` 위임" 을 명시한다. 본 plan 은 frontmatter `owner: developer` 이면서 **Phase 1 전체가 spec 개정**(`conversation-thread.md` §A, `6-websocket-protocol.md` §B, `9-rag-search.md` §C 3개 파일)이다.

- `plan-lifecycle.md` §4 의 `owner` 필드 정의("planner / developer / 사용자 본인 등")는 "이 plan 을 누가 실행하는가"를 의미하므로, `owner: developer` 로 고정된 채 Phase 1(spec 쓰기)이 정규 phase 로 포함되면 스키마상 "developer 가 spec 을 쓴다"로 읽힌다 — CLAUDE.md 의 역할 경계와 문면상 충돌.
- 실무적으로는 (i) 세션이 Phase 1 실행 시점에 `project-planner` 스킬로 전환해 수행하거나 (ii) 동일 worktree 안에서 orchestrating Claude 가 두 역할을 순차 invoke 하는 방식으로 우회될 여지가 있으나, **plan 문서 자체에는 그 전환을 명시하는 문구가 없다** — "착수 전 `/consistency-check --spec` 2회차 의무" (L114) 만 있을 뿐 "project-planner 위임" 절차가 문서화되어 있지 않다.
- 이 정황은 I2 가 1회차부터 미처분으로 남은 것과 일치한다. **권고**: (a) frontmatter 에 phase-scoped owner 명시(예: `owner: project-planner (Phase 1) → developer (Phase 2+)`), 또는 (b) Phase 1 을 `project-planner` 소유의 별도 plan 으로 분리하고 본 plan 은 그 완료를 선행조건으로 참조, 또는 최소 (c) Phase 1 착수 문구에 "본 phase 는 project-planner 위임으로 수행" 명시. 이 판단 자체는 spec/conventions/** 의 직접 위반은 아니고 CLAUDE.md 워크플로 규약과의 긴장이므로 등급은 WARNING 으로 유지한다.

---

### 새로 발견한 이슈

- **[WARNING 1] `RagRetrieval*` 명명이 문서 자체의 "주입" 프레이밍과 불일치**
  - target 위치: L128, L130, L158, L160, L162, L164 (전량 `mergeRagRetrievalItems`/`RagRetrievalRow`/`RagRetrievalDetail`)
  - 위반 규약: `spec/conventions/conversation-thread.md` 자체가 요구하는 것은 아니나, 본 plan 이 스스로 표방하는 명명 원칙(L130 naming_collision 각주 — "`ai_tool` 재사용을 기각한 이유"(L183) 등)과 자기모순.
  - 상세: 문서 전체가 이 UI 요소의 의미를 일관되게 "**주입**"으로 서술한다 — 결정2(L66) "행은 '이 턴에 **주입**이 일어났다'는 시간축 이벤트", "위치"(L79) "RAG **주입**은 그 턴의 LLM 호출 **직전**", Rationale(L185) "행은 '언제 무엇이 **주입**됐나'(시간축)". 그런데 실제 채택된 식별자는 `RagRetrieval*` 이고, Phase 2 항목3 의 blockquote(L162)는 "`RagRetrieval*` 은 이름 자체가 '도구 호출이 아니라 **주입 이벤트**'라는 본 작업의 핵심 구분을 담는다" 라고 주장한다 — **이름은 Retrieval인데 그 이름이 "주입"을 담는다고 서술**하는 자기모순이다. 게다가 "Retrieval" 은 RAG(Retrieval-Augmented Generation)의 백엔드 검색 단계(`RagSearchService`, [`9-rag-search.md` §3 유사도 검색](../../../../spec/5-system/9-rag-search.md)) 와 개념적으로 겹쳐, 이 행이 "KB 검색 자체를 보여주는 행"으로 오인될 여지가 있다 — 문서가 `ai_tool` 재사용을 기각한 논거("잘못된 인과 전달", L183)와 같은 계열의 위험이다. `injectRagItems`→`mergeRagInjectionItems` 재명명 사유(L130, `injectConversationContext()`/`contextInjectionMode`/`conversation-context-injection.ts` 와의 어휘 충돌)는 남아있는데, 그 다음 단계로 `Injection`→`Retrieval` 재명명을 정당화하는 서술은 어디에도 없다(L130 각주는 "merge*Items 패턴을 따른다"만 설명, 가운데 명사를 왜 Retrieval 로 정했는지는 미설명).
  - 제안: 명명을 재검토한다. `RagSource[]` 타입(§1.2.2, L119)이 이미 확정돼 있으므로 그와 정합하는 `RagSourceRow`/`mergeRagSourceItems` 또는 `RagContextRow`/`mergeRagContextItems` 등 "Injection"(기존 컨텍스트 자동주입 기능과 충돌)도 "Retrieval"(백엔드 검색 단계와 충돌)도 피하는 제3의 어휘를 고려하거나, `Retrieval` 을 유지한다면 L162 의 "주입 이벤트" 서술과 L66/L79/L185 의 "주입" 프레이밍을 그 선택에 맞춰 함께 정정해야 한다.

- **[WARNING 2] §9.11 "두 1차 변환 함수" 갱신 지시가 과도할 수 있음**
  - target 위치: L128 ("§9.11 서두의 '두 1차 변환 함수'·'세 변환 path' 서수 표현도 함께 갱신")
  - 위반 규약: `spec/conventions/conversation-thread.md` §9.11 (L621-632 "두 1차 변환 함수는... 동치여야 한다: `threadTurnsToConversationItems(turns) ⊆ messagesToConversationItems(messages)`")
  - 상세: §9.11 의 "두 1차 변환 함수" 는 `messagesToConversationItems`/`threadTurnsToConversationItems` 만을 가리키며, 이 둘 사이의 부분집합 동치 계약을 서술하는 문장이다. `mergeOrphanToolItems` 는 이 "두 1차 변환 함수"에 포함되지 않고 별도의 "**세** 변환 path" 책임 표(L633-639, 3행)에만 등재돼 있다 — merge 류 함수는 "1차 변환"이 아니라 "later-stage 병합"으로 이미 구분돼 있는 기존 패턴이다. `mergeRagRetrievalItems(items, turnDebug)` 는 시그니처·역할이 `mergeOrphanToolItems(threadItems, prev)` 와 동형(merge, 병합)이며 `turnDebug` 라는 제3의 orthogonal 소스에서 오므로 thread⊆messages 동치 계약에 애초에 참여하지 않는다. 따라서 "세 변환 path"→"네 변환 path"(책임 표 행 추가)는 맞지만, "두 1차 변환 함수"까지 "세 개"로 바꾸는 것은 §9.11 자체의 기존 구분(1차 변환 vs merge)과 모순되는 부정확한 편집을 유발할 위험이 있다.
  - 제안: 항목6 지시를 "세 변환 path → 네 변환 path (책임 표에 `mergeRagRetrievalItems` 행 추가)"로 한정하고, "두 1차 변환 함수"는 **변경하지 않는 것이 기본값**임을 명시. 만약 실제로 RAG 항목을 동치 계약에 포함시켜야 할 이유가 있다면(예: turnDebug 기반 항목도 langue thread/messages 양쪽에서 파생 가능해야 한다는 새 요구) 그 근거를 별도로 적어야 한다.

- **[WARNING 3] §9.9 Inv-9 추가 시 절 서두의 "8가지" 카운트 미갱신**
  - target 위치: L132 (항목8, `Inv-9` 신설)
  - 위반 규약: `spec/conventions/conversation-thread.md` §9.9 서두 (L567) "다음 **8가지** 불변량은 §9 변경 / 구현 변경 / store lifecycle 정책 변경 시 반드시 유지돼야 한다."
  - 상세: Inv-9 가 추가되면 이 문장의 "8가지"는 사실과 어긋난다. 이는 W2 가 §9.11 에서 이미 지적한 것과 **동일 클래스의 서수 drift**이며, 라운드1 처분이 그 교훈을 §9.9 에는 아직 일반화하지 못했다.
  - 제안: 항목8 문구에 "§9.9 서두의 '8가지' → '9가지' 갱신"을 명시적으로 추가.

- **[WARNING 4] §9.1 표 행 추가 시 위젯 스코프 예외 blockquote 의 행수 카운트 미갱신**
  - target 위치: L122 (항목3, "§9.1 매핑표 행 추가")
  - 위반 규약: `spec/conventions/conversation-thread.md` §9 서두 스코프 예외 blockquote (L413) "(§9.1 표는 **6행**이지만 그중 `system_error` 는 frontend-합성 source 라(§1.1.1) 위젯 wire 에 애초 도달하지 않는다 — 위젯이 수신하는 도메인은 backend enum 5값뿐이다.)"
  - 상세: `rag` 행이 §9.1 에 추가되면 표는 6행→7행이 된다. `rag` 역시 `system_error` 와 마찬가지로 frontend-합성 source(backend 5값 enum에 없음, §1.1.2 신설분)이므로, 이 blockquote 의 논리("frontend-합성 source 는 위젯 wire 에 도달하지 않는다")가 `rag` 에도 그대로 적용돼야 한다 — 즉 "6행"→"7행" + 제외 대상이 `system_error` 단독이 아니라 `system_error`·`rag` **두 개**로 바뀌어야 정합하다. 항목3~14 어디에도 이 blockquote 갱신이 명시돼 있지 않다.
  - 제안: 항목3(§9.1) 또는 항목7(§8.1)에 "§9 서두 위젯 스코프 예외 blockquote의 '6행'/`system_error` 단독 서술을 '7행'/`system_error`+`rag` 로 갱신" 을 추가.

- **[WARNING 5] "§9.6 적용 surface" 인용이 RAG 행의 dual-surface 렌더 요구를 정확히 뒷받침하지 않음**
  - target 위치: L166 (Phase 2 항목6), L150 (CT-S18 (e))
  - 위반 규약: `spec/conventions/conversation-thread.md` §9.6 "적용 surface" (L484-489)
  - 상세: §9.6 의 "적용 surface" 서브섹션은 명시적으로 "**본 정책**은 다음 두 timeline surface 에 동시 적용 의무"라고 시작하는데, 여기서 "본 정책"은 §9.6 표제인 **tool-call 그룹 시각 정책**(parent-child 그룹핑)만을 가리킨다 — "모든 conversation 항목 타입이 두 surface 에 렌더돼야 한다"는 일반 규칙이 아니다. `rag` 행은 tool-call 그룹핑 대상이 아니므로(§9.6 그룹 분류 제외, 항목5) 이 조항의 적용 범위 밖이다. 따라서 Phase 2 항목6·CT-S18(e) 가 "§9.6 적용 surface" 를 근거로 `rag` 의 dual-surface 렌더를 "강제"한다고 서술하는 것은 인용 오류다. 실제로 이런 일반 규칙에 가장 가까운 것은 §9.12 §3 "적용 surface (동시 적용 의무)"(요소별 시각·소요시간 노출, 3개 surface) 이나 이 역시 "타임스탬프/소요시간 표시"에 국한된 조항이며, `rag` 항목 자체가 두 surface 에 **존재해야** 한다는 일반 규칙은 conversation-thread.md 어디에도 명시적으로 없다(암묵적으로는 `result-timeline.tsx`/`conversation-timeline-item.tsx` 가 frontmatter `code:` 목록에 있고 §8.3 AST exhaustiveness guard(Phase 2 항목5)가 "모든 처리 분기 위치 등록"을 강제하는 데서 유도될 뿐).
  - 제안: RAG 행을 두 surface 에 렌더한다는 엔지니어링 결정 자체는 타당하지만, 그 근거를 "§9.6 적용 surface 강제"로 서술하지 말고 "§8.3 AST exhaustiveness guard(Phase 2 항목5)에 의한 귀결" 또는 "governed code 목록(frontmatter)상 두 surface 모두가 conversation-thread.md 범위이므로 신설 source 는 대칭 렌더가 기본"으로 근거를 정정. 필요하면 §9.6 을 "tool-call 그룹 정책"에서 "모든 신규 conversation source 는 두 surface 동시 렌더가 기본"이라는 좀 더 일반적인 원칙으로 확장 개정하는 것도 고려할 수 있다(이 경우는 규약 갱신).

- **[WARNING 6] "D4"/"D6" 라벨의 문서 간 명명 충돌 (기존 drift, 승계됨)**
  - target 위치: L85, L101, L103, L106, L127, L131, L140 (전량 "D4" 참조)
  - 위반 규약: 명명 규약 관점 — `spec/conventions/node-output.md` L110 "`**D4 (2026-05-17)**`: Integration 계열 노드의 SSRF 차단·credential resolve 실패는... Runtime 에러 포트로 라우팅", `spec/5-system/4-execution-engine.md` L1520 "`**D4 — 멀티턴 turn-단위 park**`" — 둘 다 conversation-thread.md 의 "D4"(Preview 1차 소스 = conversationThread snapshot)와 **완전히 다른 결정**을 같은 라벨로 부른다.
  - 상세: `conversation-thread.md` 안에서도 "D4"는 §8.1 본문 어디에도 `**D4 결정**:` 형태의 명시적 헤더로 정의된 적이 없고(§1.5/§4/§8.1/§9.3 등에서 괄호 인용으로만 등장), node-output.md·execution-engine.md 의 "D4"는 **명시적으로 헤더 정의된** 서로 다른 결정이다. 저장소 전체에서 "D4"를 검색하면 최소 3개의 무관한 결정이 나온다. 본 plan 은 이 기존 모호성을 새로 만든 것은 아니지만(round1 이전부터 존재하는 spec drift), 항목7·항목13 이 "D4" 라벨을 그대로 승계·확장하면서 문제를 해소하지 않고 넘어간다.
  - 제안: 본 plan 의 책임 범위를 벗어나는 정정이므로 필수는 아니나, 항목7 실행 시 "§8.1 D4" 대신 "§8.1 Conversation Preview 렌더 규칙 분리 결정(§8.1 본문, 통칭 'D4')" 처럼 최초 1회는 라벨의 스코프를 명확히 하는 각주를 addendum 으로 남기는 것을 권고. 근본 해결(전역 D-라벨 네임스페이스 정리)은 별도 spec-drift 후속 과제로 이관.

---

### INFO

- **[INFO 1] Phase 1 §A 항목 번호 중복 ("6." 이 두 번)**
  - target 위치: L125 "6. **§9.3 데이터 소스 표**" / L128 "6. **§9.11 변환 contract 표**" — 이후 L131 "7."로 이어짐.
  - 상세: markdown 순서목록 번호가 6, 6, 7... 로 잘못 매겨져 있다(§9.3 항목 삽입 후 renumber 누락으로 추정). 규약 위반은 아니나 이 Phase 1 체크리스트가 "각 처분이 규약을 충족하는지" cross-reference 되는 감사 대상 문서이므로 가독성·추적성에 영향.
  - 제안: 6→6a/6b 또는 순차 6/7/8...로 재번호.

- **[INFO 2] §8.6 제목이 상위 §8("Rationale")과 동일하게 "Rationale" 로 중복**
  - target 위치: L135 (항목11 "**§8.6 Rationale**"), L179 ("## Rationale 초안 (§8.6)")
  - 상세: `conversation-thread.md` §8 자체가 "## 8. Rationale" 이고 그 하위 §8.1~§8.5 는 모두 **구체적 결정명**을 제목으로 쓴다(예: "8.3 `system_error` source 신설"). 새 §8.6 을 문자 그대로 "Rationale" 로 제목 붙이면 상위 절과 제목이 겹쳐 §8 서브섹션 명명 패턴과 어긋난다.
  - 제안: §8.3 선례를 따라 "8.6 `rag` frontend 합성 source 신설" 등 구체적 제목으로 명명.

- **[INFO 3] Phase 1 draft 의 CT 시나리오 표가 실제 §9.10 4열 스키마 대비 1열(1차 테스트 파일) 누락**
  - target 위치: L148-152 ("### CT 시나리오" 표, 컬럼 3개: ID/시나리오/검증)
  - 상세: `conversation-thread.md` §9.10 의 실제 표는 ID/시나리오/검증/**1차 테스트 파일** 4열이다(L584 헤더 확인). plan 문서 자체의 요약 표라 치명적이지 않으나, 항목10("§9.10 CT-S18/19/20 + 충족 테스트 매핑")이 실제 spec 편집 시 이 4열 스키마를 그대로 유지해야 함을 명시적으로 상기.

---

## 요약

1회차 CRITICAL(§8.1 D4·§9.3·websocket-protocol §4.4 경계 위반)에 대한 이번 회차의 "기존 관행 정식화" 해소 방향은 코드 실측에 근거가 탄탄하고, 4개 WARNING·2개 INFO 처분도 대부분 실제 규약 조항을 정확히 짚어 충족시켰다(§9.2 열거, §9.3 관계 명시가 특히 정확). 다만 신규로 추가된 Phase 1 항목 7~14 를 §9.9/§9.11/§9(위젯 스코프)/§9.6 원문과 대조한 결과, 이번 회차가 스스로 도입한 서수·카운트("두 1차 변환 함수", "8가지 불변량", "6행")를 일부만 갱신 대상으로 인지하고 있어 §9.11 에서 이미 겪은 것과 동일한 클래스의 drift 가 §9.9·§9(위젯 스코프)에 잠재해 있다. 또한 "§9.6 적용 surface" 를 RAG 행의 dual-surface 렌더 근거로 인용한 것은 그 조항의 실제 스코프(tool-call 그룹 정책)를 벗어난 부정확한 인용이다. 가장 눈에 띄는 것은 target 실 파일이 prompt payload 작성 이후 `mergeRagInjectionItems`→`mergeRagRetrievalItems` 로 재명명됐는데, 그 개명이 문서 전체가 일관되게 쓰는 "주입" 프레이밍과 Phase 2 항목3 자체 서술("이름 자체가 주입 이벤트를 담는다")과 정면으로 모순된다는 점 — 이는 코드/spec 반영 전에 반드시 정리해야 할 자기모순이다. frontmatter `owner: developer` 와 Phase 1 spec 개정의 역할 경계 긴장(I2)은 이번 회차도 미처분 상태이며, 최소한 project-planner 위임 절차를 plan 문서에 명문화할 것을 권고한다.

## 위험도

MEDIUM — CRITICAL 급 신규 위반은 없으나, RagRetrieval 명명 자기모순(WARNING1)과 §9.6 인용 오류(WARNING5)는 Phase 1 착수 전 정정하지 않으면 spec/코드에 그대로 전파될 실질적 위험이 있고, §9.9/§9.1 카운트 drift(WARNING2-4)는 §9.11 에서 이미 한 번 지적된 문제 클래스가 재발한 것이라 처분 프로세스의 완결성에 의문을 남긴다.
