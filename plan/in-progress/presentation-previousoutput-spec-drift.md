---
worktree: presentation-previousoutput-spec-drift-e74b2f
started: 2026-07-23
owner: project-planner
---

# presentation spec 의 `previousOutput` 폐기 서술 정정 (선재 drift)

> 작성일: 2026-07-23
> 트리거: `/consistency-check --impl-done spec/4-nodes/6-presentation` 의 **CRITICAL 1건**.
>
> 산출물은 branch `claude/isconversationoutput-refactor-dc0472` 의
> `review/consistency/2026/07/23/15_33_52/`(SUMMARY.md + ADJUDICATION.md)에 커밋돼 있으나
> **본 worktree(=origin/main 기준)에는 아직 없다** — 링크하면 dangling 이므로 핵심 판정을
> 아래에 self-contained 로 인용한다:
>
> > CRITICAL 은 실재하나 그 diff 에 귀속되지 않는다. 해당 branch 는 spec 변경 0파일 ·
> > `previousOutput` 등장 0건이고, 모순 서술은 #516(2026-06-10)·#909(2026-07-11)에 landing 한
> > origin/main **선재** 항목이다. `--impl-done` 은 diff-scoped 검사인데 checker 들이 영역
> > 전문을 읽어 영역 선재 drift 를 CRITICAL 로 올렸다(plan_coherence 가 그 스코프 어긋남을
> > 스스로 WARNING 으로 표면화). 해소하려면 presentation spec 을 편집해야 하는데 CLAUDE.md 가
> > developer 의 `spec/` 을 read-only 로 못박으므로 **planner 로 분리**한다.

## 문제 — 세 SoT 가 모순한다 (실측)

| # | 출처 | 상태 |
|---|---|---|
| 1 | `codebase/backend/src/modules/execution-engine/button-interaction.service.ts` `buildResumedStructuredOutput()` | 재개 출력에 **`previousOutput` 무조건 주입** (nested chain 은 strip). 코드 주석이 *"legacy transitional field … Do NOT add new consumers … Removal is tracked as a Phase 3 precondition"* 로 명시 |
| 2 | `spec/conventions/node-output.md` §4.2 (정식 규약, SoT) | *"**단 Phase 3 완료 전 과도기 예외**: presentation resume 경로(`ButtonInteractionService`)는 재개 출력에 `previousOutput`(nested chain 은 strip)을 transitional legacy 필드로 여전히 보존한다 — Phase 3 정리 시 제거 예정 (코드 주석 SoT)"* → **코드와 일치** |
| 3 | `spec/4-nodes/6-presentation/**` 4곳 | *"폐기"* · *"모두 폐기"* · *"사용 금지"* · *"금지 필드"* 로 **단정** → 1·2 와 정면 모순 |

읽는 사람이 "이미 제거된 필드" 로 오해한다. 실제로는 재개 출력에 **지금도 존재**한다.

## 대상 4곳 (전수 grep 확인 — presentation 영역 내 `previousOutput` 등장 전부)

| # | 위치 | 현재 문구 |
|---|---|---|
| 1 | `0-common.md:136` | "이전 초안의 `output.type: 'form'`, …, `previousOutput` 등의 필드는 **폐기**" |
| 2 | `3-chart.md:228` | "옛 포맷에서 … `output.previousOutput` 을 사용했다면 **모두 폐기**" |
| 3 | `3-chart.md:271` | "별도 `previousOutput` 필드 **사용 금지** (Principle 4.2)" |
| 4 | `4-form.md:258` | "⚠ **금지 필드** (Principle 1.1.4 / 4.2): …, `output.previousOutput`, …" |

> checker SUMMARY 는 `1-carousel.md`/`2-table.md`/`5-template.md` §5.5 JSON 예시도 지목했으나,
> **전수 grep 결과 그 세 문서에는 `previousOutput` 언급이 없다**. 지적의 실질은 "예시가 실제
> 재개 출력에 있는 필드를 보여주지 않는다"는 **누락** 쪽이다 — §비목표 참조.

## 개정 방침

**완전 폐기 → "신규 소비 금지(과도기 보존)"** 로 정확도를 올린다. 세 가지를 지킨다:

1. **필드가 현재 존재한다는 사실**을 감추지 않는다.
2. **신규 소비는 금지**라는 원래 의도는 유지한다 (이게 4곳이 말하려던 핵심이다).
3. **값 도메인 SoT 는 `node-output.md` §4.2** 임을 링크로 명시해 다음 갱신이 한 곳에서 시작되게 한다.

### 제안 문구

1·2·4 (열거형 "폐기/금지" 목록): `previousOutput` 을 그 목록에서 **분리**하고 각주를 단다 —

> `previousOutput` 은 위 목록과 성격이 다르다: **폐기 예정이나 아직 제거되지 않았다.**
> presentation resume 경로(`ButtonInteractionService`)가 재개 출력에 지금도 주입한다
> ([node-output §4.2](../../conventions/node-output.md#42-폐기할-필드--구조) 과도기 예외).
> **신규 소비 금지** — 이전 뷰 값이 필요하면 `output` 최상위 런타임 필드를 직접 읽는다.
> Phase 3 정리 시 코드·spec 동시 제거.

3 (`3-chart.md:271` 표 행): "별도 `previousOutput` 필드 사용 금지" →
"resumed 에서도 동일 값 유지. 재개 출력에 `previousOutput` 이 함께 실리지만 **신규 소비 금지**
(과도기 legacy — [node-output §4.2](../../conventions/node-output.md#42-폐기할-필드--구조))".

## 동반 정정 (같은 배치, cross_spec WARNING 2건)

| # | 위치 | 정정 |
|---|---|---|
| A | `0-common.md` **:394**(§10.9 서술) · **:426**("4-layer SSOT 정렬" 불릿) — **2곳** | Continuation Bus 메시지 타입 **"5종" → "6종"** (`retry_last_turn` 누락). 대조 SoT: `spec/5-system/4-execution-engine.md` §7.4(:893)·**§9.3(:1162) 이 이미 "6종" 으로 명시** — 그 앵커를 직접 인용해 근거를 강화한다. "`retry_last_turn` 은 본 절 dispatch 범위 밖(별도 `RetryTurnService` 경로)" 단서 병기 |
| B | `0-common.md` Rationale "form submission wire format wrap" 절 | 재개 dispatch 함수명 오기 `waitForAiConversation` → **`processAiResumeTurn`**, "loop 재진입" → **"no-op park(재파킹)"** (full B3 아키텍처·같은 문서 §10.9 본문과 통일) |

> **초안의 "3곳" 은 틀렸다 (실측 정정)**: `grep -n "5종" 0-common.md` → `:14`·`:394`·`:426` 3건이나
> **`:14` 는 무관한 개념**이다 — "PRD Presentation 노드 5종" 링크 앵커(`#9-presentation-노드-5종`)로,
> 노드 종류 수를 뜻한다. Rationale 절에는 해당 문구가 아예 없다. → 치환 대상은 **`:394`·`:426` 2곳**이며,
> **blind 전체 치환 금지** (같은 문서의 `:14` 앵커가 깨진다).

### 동반 정정 C — sibling plan 3곳 (plan_coherence WARNING #1)

`plan/in-progress/node-output-redesign/` 이 target 이 지금 고치는 것과 **동일한 오류를 그대로 서술**해,
spec 만 고치면 plan 레이어에서 drift 가 재생산된다. 실측 확인:

| 파일 | 라인 | 현재 서술 |
|---|---|---|
| `chart.md` | :46 | "옛 `output.type: 'chart'` / … / `output.previousOutput` **모두 폐기**" |
| `form.md` | :77 | 금지 필드 목록에 `output.previousOutput` |
| `README.md` | :263 | "`output.previousOutput` **폐기** … 핵심 정리 항목은 모두 spec 본문에 **반영 완료**" |

→ 각 지점에 "**신규 소비 금지 — Phase 3 까지 과도기 보존**([node-output §4.2](../../spec/conventions/node-output.md))"
각주를 단다. `README.md:263` 의 "반영 완료" 는 특히 오해를 키우므로 예외를 명시한다.

## 비목표 (이번 범위 밖)

- **Phase 3 자체** (`ButtonInteractionService` 에서 `previousOutput` 제거) — 코드 작업이고 별건.
  이번 개정은 그때까지의 **문서 정합화**다.
- **`1-carousel.md`/`2-table.md`/`5-template.md` §5.5 JSON 예시에 `previousOutput` 추가** —
  예시에 legacy 필드를 새로 그려 넣으면 "신규 소비 금지" 와 상충하는 신호를 준다. 각 문서가
  `0-common.md` 를 이미 참조하므로 1의 각주로 충분하다고 본다. (판단 근거를 Rationale 에 기록)
- `output.interaction.type` "4값 중" 표현(INFO 1), `resumed` status 미emit 갭 cross-ref(INFO 4) —
  둘 다 낮은 우선순위 INFO 로 별건.

## 체크리스트

- [x] `/consistency-check --spec` (본 draft 대상) — planner 의무. **BLOCK: NO** (`review/consistency/2026/07/23/15_59_12/`), WARNING 2건·INFO 5건 본 draft 에 반영
- [x] `previousOutput` 4곳 정정 (`0-common.md:136` · `3-chart.md:228·271` · `4-form.md:258`)
- [x] 동반 정정 A (5종→6종, **2곳** — `:14` 앵커는 미변경 확인)
- [x] 동반 정정 B (함수명 2곳 + "loop 재진입"→"no-op park(재파킹)" 2곳)
- [x] 동반 정정 C (sibling plan 3곳 — `node-output-redesign/{chart,form,README}.md`)
- [x] 개정 근거 기록 — 본 plan §Rationale (구조 선택·frontend 3자 정리·Phase 3 dangling 추적처)
- [ ] `/ai-review`

## Rationale

**왜 "폐기" 를 지우지 않고 "신규 소비 금지" 로 바꾸나**: 원 문구의 의도(=이 필드에 의존하지 마라)는
옳다. 틀린 건 **시제**다 — 이미 제거된 것처럼 쓰여 있어 재개 출력을 실제로 열어본 사람이 spec 을
불신하게 된다. 의도는 보존하고 사실만 정정한다.

**왜 `node-output.md` 를 SoT 로 링크하나**: 과도기 예외의 원문이 거기 있고 Phase 3 완료 시
갱신해야 할 지점도 거기다. 4곳이 각자 서술하면 이번과 같은 drift 가 재발한다.

**왜 목록에서 분리 + 각주 구조인가** (cross_spec INFO 2): `node-output.md` §4.2 는 항목을 목록에
남겨두고 문장 안에 캐비어를 붙이는 관용구를 쓴다. 여기서는 **분리 + 각주**를 택한다 — 그 4곳은
"금지 필드 열거" 문맥이라 목록 안에 두면 각주를 읽지 않은 사람이 "제거됨" 으로 스캔한다. 사실은
같고 구조만 다르다.

**Phase 3 는 3자 정리다** (cross_spec INFO 3, 실측): `previousOutput` 의 소비자는 backend 뿐이
아니다 — frontend `run-results/renderers/presentation-renderers.tsx:543-546` 이 resumed 페이로드에서
`raw.previousOutput` 을 읽어 **data fallback 으로 사용**한다(테스트도 :287 fixture 로 고정). 따라서
Phase 3 제거는 **backend(`ButtonInteractionService`) · spec · frontend renderer 3자 동시** 작업이다.
"backend 필드만 지우면 끝" 이라고 읽히지 않게 각주에 명시하지 않되 본 Rationale 에 기록해 둔다.

**Phase 3 추적처가 dangling 이다** (plan_coherence INFO 5, 실측): `ButtonInteractionService` 코드
주석이 가리키는 `memory/node-specs-improvement-progress.md` 는 **저장소에 존재하지 않는다**. 즉 현재
Phase 3 를 추적하는 살아있는 문서가 없다. 이번 개정은 그 dangling 참조를 presentation 4곳으로
**확산시키지 않도록** 각주에서 파일 경로를 인용하지 않고 "Phase 3 정리 시" 로만 쓴다. 추적처 신설은
별건(§비목표).

## 검증

- `spec-link-integrity` 등 docs 가드 **18 files / 2658 passed**.
  - 중간에 내가 지어낸 앵커 2건이 잡혔다: `#93-큐-토폴로지`(실제 `### 9.3 BullMQ 큐 목록`),
    `0-common.md#45-interaction-payload`(§4.5 단독 헤딩이 **없음** → 상위 `## 4. 출력 포맷` 앵커로 교정).
    **교훈: 앵커는 추측하지 말고 `grep '^#\+'` 로 실제 헤딩을 확인하고 쓴다.**
- `grep -c "waitForAiConversation\|loop 재진입"` → **0** (동반 정정 B 잔여 없음).
- `0-common.md:14` 의 "Presentation 노드 5종" 링크 앵커는 **미변경** — 무관 개념(노드 종류 수)이라
  blind 치환했으면 링크가 깨졌을 지점이다.
