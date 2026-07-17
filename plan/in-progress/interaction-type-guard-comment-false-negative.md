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
- [ ] 9. `/ai-review` + Critical/Warning fix
- [ ] 9-4. `/consistency-check --impl-done` (spec-linked 코드 변경)

## 후속 (본 PR 범위 밖)

- spec `interaction-type-registry.md` 의 "grep 대상 파일"/"코드 grep 결과" 류 잔여
  표현 → "등록 사이트 파일"/"코드 AST 파싱 결과" 로 다듬기. consistency INFO #1 이
  트리비얼 doc-sync 로 권고 (비차단, developer 는 spec read-only 라 project-planner 몫).
