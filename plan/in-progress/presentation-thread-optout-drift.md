---
worktree: presentation-thread-optout-drift-4fc462
started: 2026-07-23
owner: project-planner
---

# presentation `§4.6 excludeFromConversationThread` 서술 정밀화 (선재 drift)

> 작성일: 2026-07-23
> 트리거: `/consistency-check --impl-done spec/4-nodes/6-presentation`
> (`review/consistency/2026/07/23/18_40_40`, branch `claude/isconversationoutput-refactor-dc0472`)
> 의 **CRITICAL 1건**. 그 diff(테스트/주석 전용)에 귀속되지 않는 **영역 선재 drift** 이고
> developer 가 `spec/` read-only 라 planner 로 분리됐다.
> 선행: PR [#997](https://github.com/worker-ants/clemvion/pull/997) — **같은 영역의 첫 번째**
> 선재 drift(`previousOutput`) 정정.

## checker 의 지적과 그 처방 — 지적은 맞고 **처방은 틀렸다**

checker 요지: *"§4.6 이 presentation 5노드가 `excludeFromConversationThread` 를 갖는다고
`status: implemented` 로 명문화하나 5개 schema 전수 grep 0건. SoT 는 AI 3노드 전용으로 명시"* →
처방으로 **(a) 구현하거나 (b) §4.6 삭제/`Planned` 격하**를 제시했다.

**(b) 를 그대로 적용하면 실재하는 동작의 문서를 지운다.** 실측으로 층위를 분리해야 한다.

## 실측 — 두 층위가 서로 다른 상태다

| 층위 | 상태 | 근거 |
|---|---|---|
| **런타임 opt-out 게이트** | **구현됨 · 전 노드 일괄 적용** | `conversation-thread.service.ts:202` 의 `appendInternal` 첫 줄이 `if (this.isOptedOut(args.node)) return;`. `isOptedOut`(:243)은 `node.config?.excludeFromConversationThread === true` 를 **노드 종류 무관** 하게 읽는다. 모든 `append*` 가 `appendInternal` 을 거치므로 presentation 경로도 포함 |
| **presentation 인터랙션의 thread push** | **구현됨** | `form-interaction.service.ts:280` · `button-interaction.service.ts:534` 가 `appendPresentationInteraction` 호출 → `appendInternal`(:86) 경유 |
| **presentation schema 의 필드 선언 / UI 노출** | **미구현** | 5개 schema 전수 grep **0건**. 대조군: AI 노드는 `buildConversationContextSchemaFields`(`ai-agent.schema.ts:414`)로 선언 |
| **수동 설정 시 실제 동작 여부** | **동작한다** | 5개 schema 모두 `.passthrough()` (carousel/table/form 9회, template 7, chart 4) → 선언되지 않은 키도 config 에 보존되고 위 게이트가 읽는다 |

→ 정확한 사실은 **"동작은 되는데 UI/schema 표면이 없다"** 이다. §4.6 이 틀린 건 *동작* 이 아니라
**"5노드가 필드를 *가진다*"** 는 **표면(schema/UI) 주장**이다.

## 개정 방침 — 삭제가 아니라 층위 분리

§4.6 을 **유지**하되 두 층위를 명시적으로 갈라 적는다:

1. **동작(구현됨)**: presentation 인터랙션은 thread 에 자동 push 되며, 노드 config 에
   `excludeFromConversationThread: true` 가 있으면 **런타임 게이트가 존중해 silent skip** 한다.
   이 게이트는 `ConversationThreadService.appendInternal` 의 공통 진입점에 있어 노드 종류를
   가리지 않는다.
2. **표면(미구현)**: presentation 5노드 schema 는 이 필드를 **선언하지 않는다**. 따라서
   설정 UI 에 노출되지 않으며(`Advanced > Conversation` 그룹 없음), `.passthrough()` 덕에
   수동/API 설정만 통한다. **UI 노출은 Planned** — 필요해지면 AI 노드처럼 공유 fragment
   선언을 추가한다.
3. **frontmatter**: `status` 를 실제 상태에 맞게 조정하고 `code:` 에 게이트 구현 파일
   (`conversation-thread.service.ts`)을 포함할지 판단한다.

## 비목표

- **필드를 5개 schema 에 실제 선언**(checker 처방 (a)) — 코드 작업이고 UI 노출 여부는 제품 결정이다.
  본 작업은 **문서를 사실에 맞추는 것**이며, 구현은 수요가 생길 때 별건.
- **동반 WARNING (`form.handler.ts` 의 `{ ...rawConfig }` spread 가 node-output.md §7 D1 위반)** —
  `codebase/` 라 **developer 범위**다. 형제 4개 핸들러는 명시 열거(`configEcho`)를 쓰고 carousel 은
  *"future credential-shaped fields can't slip in via spread"* 주석까지 달아 회피 중인데 form 만
  예외다. 별건 백로그로 분리한다.

## `--spec` 검사 반영 (19_48_09, BLOCK: NO / WARNING 4)

BLOCK 은 아니나 프로젝트 관례상 WARNING 은 반영한다. 4건 모두 **방향을 미리 pin** 하는 성격이라
착수 전에 확정해 둔다:

| WARNING | pin |
|---|---|
| 1 `conversation-thread.md §2.4` 대칭 편집이 "확인" 에만 머묾 | **"조치" 로 격상.** §2.4 끝에 추가할 문구를 확정: *"게이트(`appendInternal`)는 노드 종류 무관 공통 적용 / **필드 선언** SoT 는 AI 3노드 shared fragment 한정 — presentation 5노드는 schema 미선언이지만 `.passthrough()` 라 수동 설정 시 동일하게 동작한다."* |
| 2 frontmatter `status` 판단이 `spec-impl-evidence.md §3` 가드와 충돌 소지 | **`status: implemented` 유지, `pending_plans` 신설 없음.** §3 의 "구현 surface" 는 **코드 계약**이고 런타임 게이트는 전 노드 완비다. UI 노출은 계약이 아니라 affordance — 이걸로 status 를 내리면 `pending_plans` 를 채울 실존 plan 이 없어 가드가 즉시 fail 한다(본 plan §비목표 1이 표면 갭 추적 plan 을 만들지 않기로 이미 결정) |
| 3 `form.handler.ts` D1 위반 "별건 분리" 미실행 + sibling plan 모순 | **실제로 분리한다.** 실측 확인: `node-output.md §7 D1` 제목이 *"config echo 구현 방식 — **명시 enumeration 의무화**"* 이고 `form.handler.ts:44` 는 `config: { ...rawConfig }` spread. 반면 sibling `node-output-redesign/form.md:154`(2026-06-25)는 이를 *"가장 충실한 raw echo 구현"* 이라 **정반대로 평가** — D1 이후 갱신되지 않은 stale 서술이다. 두 sibling 문서에 재검토 각주를 달고 developer 후속 task 로 등록 |
| 4 `UI 그룹: Advanced > Conversation` 라벨이 실제 GROUP 상수와 불일치 | **라벨 삭제.** AI 카테고리 실제 상수는 평면 문자열 `'Conversation Context'`(`conversation-context-schema.ts:27`, `conversation-thread.md:187` 도 동일). 계층형 `A > B` 표기는 코드 근거가 없고 UI 노출 자체가 Planned 이므로, 미확정 라벨을 남기느니 지우고 "구현 시 AI 공유 GROUP 재사용 여부 결정" 으로 대체 |

INFO 미조치: `0-overview.md §6.1` 각주(status 를 안 내리므로 불필요) · `§4.6` 헤딩 레벨(선재 구조 흠,
앵커 파손 위험이 이득보다 큼) · 완료 plan 이관(별 turn) · `code:` 경로 보강(status 유지라 불요) ·
파일명 접미사(강제 아님).

## 체크리스트

- [x] `/consistency-check --spec` (본 draft) — planner 의무. **BLOCK: NO**, WARNING 4건 위 표로 pin
- [x] `0-common.md §4.6` 을 동작/표면 2층위 표로 정밀화 (+ `Advanced > Conversation` 라벨 삭제 — WARNING 4)
- [x] `conversation-thread.md §2.4` 에 "게이트 적용 범위 ≠ 필드 선언 범위" 캐비어 추가 (WARNING 1)
- [x] sibling `node-output-redesign/form.md` 에 D1 재검토 각주(`:154` 인라인) **+ `## 종합 개선안` 에 `- [ ] (impl)` 추적 bullet** 추가 (WARNING 3). 세션 task chip 도 함께 띄웠으나 그건 repo 산출물이 아니므로 추적의 근거는 이 bullet 이다
- [x] frontmatter `status: implemented` 유지 확인 (WARNING 2 — 변경 없음이 결론)
- [x] `/ai-review` — 20_05_09 (C0/W2, 전량 반영) → `review/code/2026/07/23/20_05_09/RESOLUTION.md` 에 수렴 판정

## Rationale

**왜 삭제·격하가 아닌가**: §4.6 이 서술하는 **동작은 실재하고 지금도 작동한다**(게이트가 노드 종류를
가리지 않으며 schema 가 passthrough 라 수동 설정이 통한다). 삭제하면 "이 필드를 넣어도 무시된다" 는
**반대 방향의 거짓**이 된다. 틀린 건 표면 주장 하나뿐이므로 그 한 줄만 정확히 고친다.

**왜 checker 처방을 그대로 따르지 않았나**: checker 는 "schema grep 0건" 에서 곧바로 "미구현" 을
추론했으나, 이 저장소는 `.passthrough()` 를 쓰므로 **schema 선언 ≠ 동작 여부**다. 같은 세션의
`previousOutput` 건에서도 내가 "0-common 패턴을 확인 없이 복사" 해 정반대 오류를 만들었다가
`/ai-review` 에 잡혔다 — **처방을 적용하기 전에 실동작을 실측한다**.

**이 영역은 두 번째다**: `--impl-done` 이 같은 영역에서 연속 두 번 선재 CRITICAL 을 냈다
(#997 `previousOutput` → 본 건). `spec/4-nodes/6-presentation` 에 standing drift 가 누적돼 있고
`--impl-done` 은 diff 무관하게 영역 전체를 보므로, 이 영역 `code:` glob 에 걸리는 어떤 변경도
누적 부채를 먼저 갚아야 통과한다. 세 번째가 또 나오면 **영역 일괄 정리**를 별도 작업으로 세우는
편이 낫다 (2026-07-23 사용자 판단: 이번 건까지는 개별 정정으로 진행).

## 검증

- docs 가드(`spec-link-integrity` 포함) **18 files / 2661 passed**.
- `status: implemented` 유지 확인 — `spec-impl-evidence.md §3` 가드 충돌 없음(WARNING 2 결론대로).

> **checker 의 README 인용은 부정확했다 (실측 정정)**: WARNING 3 은 `node-output-redesign/README.md`
> `:190`·`:328` 도 "form 은 D1 부합" 이라 주장한다고 했으나, `:190` 은 단순 노드 나열이고 `:328` 은
> D1 결정 행으로 오히려 *"명시 enumeration + spread 회피"* 라고 **정확히** 적혀 있다. 실제 모순은
> `form.md:154` **한 곳**뿐이라 거기에만 각주를 달았다. 지적의 핵심(두 plan 이 같은 코드에 상반된
> 결론)은 옳았고 위치 인용만 넓었다.