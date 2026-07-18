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
  developer 는 `spec/` read-only 라 여기서 이월한다.
  **[해소 2026-07-18]** grep 표현 6곳 전부 정정: §1.2 rule 3(3곳) · §2.1 `system_error`/`rag`
  두 행(3곳) · §5 rule 2 · §5 강도-정정 노트(ai-review 가 지적한 "마지막 문단") · 추가로
  §4 endReason 표의 "grep 할 사본"(게이트 미지적이나 동일 방향의 잔여 표현이라 일관성 정정).
  spec 쓰기 의무 `/consistency-check --spec` 수행 → **BLOCK: NO**(checker 5/5, Critical 0,
  WARNING 1 = 본 체크박스 미갱신 bookkeeping·같은 커밋에서 해소, INFO 4 전부 corpus-wide 비강제).
  산출: `review/consistency/2026/07/18/11_21_17/SUMMARY.md`.
- [x] **[developer, 선택]** `lib/conversation/interaction-type-registry.ts` 상단 JSDoc ·
  `IS_MULTI_TURN_INTERACTION` 위 주석의 "grep 가드" 표현 → "AST 가드" 정정
  (`/ai-review` INFO #1).
  **[해소 2026-07-18]** "grep 가드" 3곳(JSDoc L14·L63·L64) → "AST 가드". 순수 주석, 동작 무변경.
- [x] **[developer, 선택]** self-test fixture 보강 (`/ai-review` INFO #2·#3·#4):
  union 타입 선언·객체 프로퍼티 값 형태 추가, 정규식 리터럴 비오염 케이스 명시 단언,
  등록 사이트가 `.tsx` 로 확장될 때 `ts.ScriptKind` 확장자 분기.
  **[해소 2026-07-18]** (a) union 타입 선언(`| "x"`)·객체 프로퍼티 값(`k: "x"`) 형태를
  self-test fixture 에 추가, (b) 정규식 리터럴 비오염 단언(`/ghost_regex/g` → 미수집) 추가.
  **양방향 mutation 프로브로 실효 실증**: (a) 는 수집기를 `=== RHS` 로 좁히면 red, (b) 는
  substring 매칭(#972 이전 계열)으로 회귀하면 red — 둘 다 진짜 가드.
  **(c) `.tsx` `ts.ScriptKind` 분기는 철회**: TS/TSX 두 모드가 문자열 리터럴을 **동일 수집**함을
  프로브 6종 JSX 형태로 실측(TS parser error-recovery 가 JSX 내부 리터럴도 토큰화). 즉 어떤
  fixture 로도 red 를 못 만드는 **vacuous 가드**라, 본 저장소 §5 원칙("가드는 '깨뜨려 봤다'로만
  신뢰")에 따라 미추가. 현행 사이트 전부 `.ts` 라 실 리스크도 없음(향후 `.tsx` 사이트 등록 시
  그때 실 필요와 함께 도입). 이 vacuous 성이 곧 원 결함(#968 false-negative)과 같은 계열이라
  추가하지 않는 게 정합.
- [ ] **[harness, 비차단]** impl-done INFO #1·#2 — consistency 번들러가 `cafe24-api-catalog/**`
  대용량 덤프에 밀려 target spec 본문을 누락하는 문제, `origin/main` 이 fork-point 보다
  앞설 때의 reverse-diff 오염. 둘 다 이 저장소의 기존 known failure pattern 이며 이번에도
  재현됐다(checker 들이 fork-point SHA 재계산으로 자체 우회).
  **[심각도 격상 2026-07-18]** ②③ 구현의 `/consistency-check --impl-prep spec/conventions/`
  (`review/consistency/2026/07/18/12_04_53/`)에서 번들러가 실 target(`interaction-type-registry.md`)을
  **"일부 누락"이 아니라 100% 치환**(`cafe24-api-catalog/**` 222개 field 파일이 예산 소진)하는
  더 심한 형태로 재현. checker 5/5 가 worktree 파일 직접 조사로 우회해 BLOCK:NO 는 유효.
  본 항목은 interaction-type-guard 작업과 무관한 harness 인프라 결함이라 **별도 harness task 로 분기**
  (아래 종결 처리 참조) — 이 분기로 본 plan 의 종결 조건을 충족한다.

> **종결 조건**: 위 4건이 모두 해소되면(또는 별 plan 으로 분기되면) `complete/` 로
> `git mv` + `chore(plan): mark interaction-type-guard-comment-false-negative complete`.
> Gate C 대비 frontmatter `spec_impact` 는 이미 리스트 형식으로 채워져 있다.
