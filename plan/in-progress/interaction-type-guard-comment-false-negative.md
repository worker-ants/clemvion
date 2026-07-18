---
name: interaction-type-guard-comment-false-negative
worktree: interaction-type-regex-fix-2303a6
started: 2026-07-17
owner: developer
spec_impact:
  - spec/conventions/interaction-type-registry.md
---

# interaction-type 가드의 주석 false-negative 해소

## 배경

`codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 의
가드는 `WaitingInteractionType` / `ConversationTurnSource` 의 각 enum 값이
`REGISTRY_SITES` / `SOURCE_REGISTRY_SITES` 의 각 파일에 string literal 로
등장하는지 검사한다. 그 검사가 **정규식 grep** 이라 **주석 안의 인용까지 매칭**한다:

```ts
const pattern = new RegExp(`['"\`]${value}['"\`]`);
```

PR #968 의 testing 리뷰가 mutation 으로 실측: `use-result-detail-waiting.ts` 의
실제 분기 `waitingInteractionType === "ai_form_render"` 를 깨뜨려도 같은 파일
JSDoc 의 백틱 인용 `` `ai_form_render` `` 가 매칭돼 테스트가 green. PR #968 범위
밖이라 known limitation 주석만 남기고 이월.

위협 모델이 "enum 에 새 값 추가 시 어느 사이트가 분기를 빠뜨림" 인데 주석만으로
통과하므로 가드가 그 위협을 못 막는다. 본 저장소는 이 계열(cross-cutting enum 값
누락 → 대화 미리보기 소실)의 회귀를 #959·#961 에서 반복 겪었다.

## 설계 결정

**백틱만 빼는 것으로는 부족하다** (실측): 주석은 홑따옴표 인용도 쓴다 —
`use-execution-events.ts:344` 의 `carousel/chart/table/template → 'buttons',
ai_agent/information_extractor → 'ai_conversation', form → 'form'` 는 전부
블록 주석 안이다. 즉 인용부호 종류를 좁히는 접근은 근본 해법이 아니다.

**`=== "value"` / `case "value":` 형태 우선 매칭**도 채택하지 않는다 — 정당한
코드 분기 형태를 놓쳐 CI 거짓 실패를 낸다. 실제 사이트에 존재하는 형태만 해도:
union 타입 선언(`| "ai_form_render"`), 객체 프로퍼티 값
(`waitingInteractionType: "ai_form_render"`), `return "buttons"`,
삼항(`raw.type === "form" ? "form" : undefined`) 등 다양하다.

**채택: TypeScript 컴파일러 API 로 파싱해 코드의 string literal 토큰만 수집.**
주석은 AST 노드가 아니므로 자동 제외되고, 모든 정당한 코드 리터럴 형태는
`StringLiteral` 노드로 잡힌다 (false fail 없음). 손수 만든 주석 제거기는
정규식 리터럴(`conversation-utils.ts:141` 의 `/\[\/?user-input\]/g`,
`use-execution-events.ts:39` 의 UUID_REGEX)을 오파싱할 위험이 있어 기각.
spec 이 이미 이 가드를 "AST 가드" 로 부르므로 구현이 spec 명칭에 수렴한다.

## mutation 실측 (통과 자체는 검증이 아니다 — 깨뜨려 봤다)

`review/consistency/2026/07/17/19_54_00/` 세션과 별개로, 가드가 실제로 회귀를
잡는지 **양방향** 실측했다. 각 mutation 마다 **옛 정규식을 같은 파일에 대해 함께
실행**해 대조군을 세웠다 — 그래야 "새 가드라서 red" 인지 "원래 red 였는지" 가
갈린다.

| # | mutation | 옛 정규식 | 새 AST 가드 |
|---|---|---|---|
| (c) | 무수정 (정상 코드) | green | **green** (3 tests pass) |
| (a)·(b) | `use-result-detail-waiting.ts` 의 실분기 `=== "ai_form_render"` → `"ai_form_renderXXX"`. 같은 파일 JSDoc(L45·L47)의 백틱 인용은 **잔존** = "주석만 남은 상태" | **green** (L45 의 `` `ai_form_render` `` 에 매칭 — PR #968 이 실측한 바로 그 false negative) | **red** — `Missing WaitingInteractionType branches: use-result-detail-waiting.ts: 'ai_form_render'` |
| (a)·(b) | `conversation-utils.ts` 의 `"system_error"` 코드 리터럴 4곳 전부 → `"system_errorXXX"`. 주석 인용(L25 의 홑따옴표 `'system_error'`, L295·L301·L716 백틱)은 잔존 | **green** (L25 의 `'system_error'` 에 매칭) | **red** — `Missing ConversationTurnSource branches: conversation-utils.ts: 'system_error'` |

→ 두 가드(`REGISTRY_SITES` · `SOURCE_REGISTRY_SITES`) 모두 (a)(b)(c) 충족. 모든
mutation 은 되돌렸다(`git checkout --`, working tree clean 확인).

**false fail 없음 실측**: 무수정 코드에서 4 파일 × 각 enum 값 = 19 조합 전부
옛 정규식과 새 AST 가드의 판정이 **일치**(전부 hit). 즉 등록 사이트의 실제 분기
형태(switch case·`===`·union 타입 선언·객체 프로퍼티 값·`return`·삼항)를 하나도
놓치지 않는다.

**"백틱만 제거" 반례 실측**: `use-execution-events.ts` L342-345 주석 텍스트만
떼어내 검사하면, 백틱을 뺀 `['"]value['"]` 로도 `buttons`·`ai_conversation`·`form`
**3값 전부 여전히 매칭**된다 (주석이 홑따옴표를 쓰므로). 좁히는 접근이 왜 해법이
아닌지의 근거.

## 체크리스트

- [x] 3. `/consistency-check --impl-prep` — **BLOCK: NO** (checker 5/5, Critical 0 / Warning 0,
      INFO 3). 5개 전원 (b) 판정: spec 이 PR #272 부터 이 가드를 "AST 가드" 로 불러왔고
      구현이 그 명칭에 수렴하는 방향 → project-planner 위임 불요.
      산출: `review/consistency/2026/07/17/19_54_00/SUMMARY.md`
- [x] 5-7. 테스트 선작성 + 구현
- [x] 양방향 mutation 실측 (a) 실분기 파손 → red (b) 주석만 → red (c) 정상 → green (위 표)
- [x] 8. TEST WORKFLOW — lint PASS(60s) / unit PASS(93s, 14 files) / build PASS(176s) /
      e2e PASS(397s, 256 tests). e2e 는 면제 화이트리스트 밖 — `*.test.ts` 만 변경도
      PROJECT.md 가 명시적으로 "회색 지대, 화이트리스트 아님" 으로 규정하므로 수행.
      최초 unit 은 FAIL — 본 plan 의 frontmatter 가 `started`/`owner` 누락으로
      `plan-frontmatter` 가드에 걸림(내 결함). 보정 후 1단계부터 재수행해 전 단계 통과.
- [x] 9. `/ai-review --branch origin/main` — **위험도 LOW, Critical 0 / Warning 0** (전부 INFO).
      reviewer 7/7 실행·전원 리포트 확보, `forced_missing: []`. Critical+Warning=0 이므로
      `resolution-applier`·RESOLUTION.md 불요. 산출: `review/code/2026/07/17/22_50_56/SUMMARY.md`
- [x] 9-4. `/consistency-check --impl-done` — **BLOCK: NO** (checker 5/5, Critical 0 / Warning 0).
      산출: `review/consistency/2026/07/17/23_11_52/SUMMARY.md`

## 후속 (본 PR 범위 밖) — **이 plan 이 `in-progress/` 에 남는 이유**

본 PR 의 구현·검증 체크리스트는 전부 `[x]` 지만, 아래 후속이 미해결이라
[`plan-lifecycle.md`](../../.claude/docs/plan-lifecycle.md) §1·§2 에 따라 `complete/` 로
옮기지 않는다 — *"모든 작업·체크리스트·**후속 항목까지** 끝난 plan. 미완 항목이 단 하나라도
남으면 옮기지 않는다"* / *"미해결 follow-up 항목이 하나라도 있으면 `in-progress/`"*.
(Stop hook 이 체크박스만 세어 이동을 nudge 했으나, 위 규칙이 우선한다.)

- [x] **[project-planner]** spec `interaction-type-registry.md` §1.2 rule 3 · §2.1 두 행 · §5 의
  "grep 대상 파일"/"grep 검증 대상"/"코드 grep 결과" 류 잔여 표현 → "AST(코드 리터럴) 스캔
  대상"/"코드 AST 파싱 결과" 로 다듬기. **동일 항목을 3개 게이트가 독립 지적**했다 —
  impl-prep INFO #1(checker 5/5) · `/ai-review` [SPEC-DRIFT] #1 · impl-done INFO #3.
  세 게이트 모두 **비차단·BLOCK 아님** 으로 판정(계약·매트릭스·등록 사이트·enum 목록 불변,
  코드가 spec 의 1차 명칭 "AST 가드" 에 수렴한 방향이라 "코드가 맞고 spec 부차 서술이 낡음").
  → **origin/main 에서 별도 PR `22cc48ef3`(#977)이 이미 이 wording 을 전량 해소**(2차
  fresh review `12_07_35` SPEC-DRIFT #1 이 실측 확인). 이 worktree 는 fork-point
  `463aee139` 기준이라 아직 미수신일 뿐 — merge/rebase 시 자동 합류. developer 는
  `spec/` read-only 였고 해당 spec 변경이 upstream 에서 완료됐으므로 이 항목은 종결.
- [x] **[developer]** `lib/conversation/interaction-type-registry.ts` 상단 JSDoc ·
  `IS_MULTI_TURN_INTERACTION` 위 주석의 "grep 가드" 표현 → "AST 가드" 정정
  (`/ai-review` INFO #1). 본 PR diff 밖 파일이라 미포함됐던 것을 후속 PR 로 반영.
  파일 내 3곳(L14 JSDoc, L63·L64 Record 주석) 전부 교정.
- [x] **[developer]** self-test fixture 보강 (`/ai-review` INFO #2·#3·#4):
  union 타입 선언·객체 프로퍼티 값·return·삼항 형태를 **폼별 고유 토큰**으로 고정,
  정규식 리터럴 비오염 케이스(`/regex_only_token/g`·`/\[\/?user-input\]/g`)를
  `.includes` 로 명시 단언(regex 노드를 오수집하면 `/…/g` verbatim 이 잡힘 — 순진한
  `.has` 로는 놓침), 등록 사이트 `.tsx` 확장 시 `scriptKindForFile` 이 확장자로
  `ts.ScriptKind` 를 분기(`collectCodeStringLiterals` 가 이를 사용). **3 신규 케이스
  전부 양방향 mutation 실측** — 폼별 descent skip·regex 오수집·`scriptKind` 하드코딩
  변조 → 해당 테스트 red 확인 후 원복(working tree clean). TEST WORKFLOW:
  lint PASS(66s) / unit PASS(85s) / build PASS(123s) / e2e PASS(317s, backend 256 +
  playwright 51). e2e 는 화이트리스트 밖 → 수행(plan §8 과 동일 판단).
  **`/ai-review` (LOW, C0/W2) 후속 반영**: W1(역방향 `.ts` 각괄호 캐스트 리터럴
  유실 미고정) + W2(self-test 가 실제 fix 라인 미관통 — 舊 `.tsx` 테스트가
  `scriptKindForFile` 직접 호출·벡큐어스 `.has` 라 fix 되돌려도 green). 파스 단일
  chokepoint `parseGuardSource` 추출로 둘 다 프로덕션 경로 관통하게 배선 + 역방향
  캐스트 self-test 추가, 양방향 mutation(하드코딩 TS→정방향 red, TSX→역방향 red)
  재실측. 산출 `review/code/2026/07/18/11_39_42/{SUMMARY,RESOLUTION}.md`.
  **2차 fresh review `12_07_35` (MEDIUM, C0/W1) 후속**: W1 이 한 겹 더 깊게 —
  1차가 self-test 를 `parseGuardSource` 로 관통시켰어도 **엔트리포인트
  `collectCodeStringLiterals` 자체는 `.tsx` 파일명으로 한 번도 호출 안 됨**(내부를
  우회 하드코딩해도 green). round-2 스캐폴딩(`parseGuardSource`·`treeContainsJsx`·
  `collectStringLiteralsFrom`) 제거 → 동일 소스를 **엔트리포인트로** `.ts`/`.tsx` 두
  확장자에 흘리는 단일 대칭 테스트(`<Config>{…}`: .ts 캐스트=리터럴 유지 / .tsx JSX=유실)
  로 대체. 양방향 하드코딩 mutation(MUT-C/D) red 재실측. 단순화가 maintainability
  INFO 도 동반 해소(헬퍼 4→2). INFO #2(체크리스트 SoT 단계)·#3(파서 error-recovery
  트리아지 주석) 반영. 산출 `review/code/2026/07/18/12_07_35/{SUMMARY,RESOLUTION}.md`.
  **3차 fresh review `12_36_08` → 수렴: LOW, Critical 0 / Warning 0** (reviewer 6/6,
  forced 미이행 없음). 잔여는 전부 비차단 INFO(spec grep=브랜치 staleness·#977 upstream
  해소, TemplateExpression 미수집=현 사이트 미사용 향후과제, describe 중복/네이밍=diff
  밖 유지보수 nit). Critical+Warning=0 이라 RESOLUTION 불요. 산출
  `review/code/2026/07/18/12_36_08/SUMMARY.md`.
- [ ] **[harness, 비차단]** impl-done INFO #1·#2 — consistency 번들러가 `cafe24-api-catalog/**`
  대용량 덤프에 밀려 target spec 본문을 누락하는 문제, `origin/main` 이 fork-point 보다
  앞설 때의 reverse-diff 오염. 둘 다 이 저장소의 기존 known failure pattern 이며 이번에도
  재현됐다(checker 들이 fork-point SHA 재계산으로 자체 우회).

> **종결 조건**: 위 4건이 모두 해소되면(또는 별 plan 으로 분기되면) `complete/` 로
> `git mv` + `chore(plan): mark interaction-type-guard-comment-false-negative complete`.
> Gate C 대비 frontmatter `spec_impact` 는 이미 리스트 형식으로 채워져 있다.
