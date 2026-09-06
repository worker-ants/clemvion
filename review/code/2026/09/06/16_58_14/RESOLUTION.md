# RESOLUTION — `review/code/2026/09/06/16_58_14` (+ consistency `16_58_16`)

**원 결과**: 코드 리뷰 Critical **0** · WARNING 6 ·
consistency **BLOCK: NO** · Critical **0** · WARNING 2
**처분**: 코드 결함 2건 + INFO 1건 수정, consistency WARNING 2건 수정, 나머지 3건은
**실측과 함께** plan 등재.

---

## W4 (requirement) — 내 가드가 자기 서술보다 좁았다

`CITATION_PATTERNS[2]` 가 `` `hh_mm_ss` `` 처럼 **백틱을 요구**해서, 백틱 없이 쓴 bare
시각은 통째로 빠졌다. 그런데 바로 위 docstring 은 *"`review-citations.md §2` 가 정한 세
형태를 그대로 옮긴다 — … bare 시각. **bare 시각까지 포함하는 것이 중요하다**"* 라고
적고 있었다.

**이 PR 이 내내 쫓던 결함이 내가 새로 쓴 코드에 있었다** — 문서한 보장이 구현보다 넓다.
리뷰어가 무수정 프로브로 재현했고, 나도 fixture 를 넣어 RED 를 확인한 뒤 고쳤다.

```
/(?<![\w/-])\d{2}_\d{2}_\d{2}(?![\w-])/
```

경계를 **단어·경로 문자로만** 막는다. 앞이 `/` 면 전체 경로라 첫 패턴이 이미 잡고,
백틱·공백·괄호는 통과시킨다. 프로덕션 래칫(`EXPECTED_DTO_JSDOC_CITATIONS` 2건)은 그대로
통과 — **오탐을 새로 만들지 않았다.**

> fixture 설명은 `//` 에 뒀다. 클래스 JSDoc 에 인용을 적으면 그 자리도 위반이 돼 이
> fixture 가 두 가지를 동시에 시험하게 된다 — 물으려는 것은 **필드** 축이다. 덤으로
> 규약이 처방하는 회피처(`//`)를 그 자리에서 보여 준다.

## W2 (scope) — CHANGELOG 가 두 관심사를 한 제목에 묶고 있었다

직전 라운드(`16_28_58` W2) 지적이 미반영이었다. `## Unreleased — … (검출 3축)` →
**(검출 2축)** 으로 좁히고, JSDoc 인용 가드를 `### 곁가지 — DTO JSDoc 주석 위생
(User 컬럼과 무관)` 별도 절로 분리했다. 판정 대상도 방어 원리도 다르다.

## INFO#6 (testing) — 라벨과 커버리지가 어긋나 있었다

`pgErrorConstraint` 의 "제약 이름 없음" 케이스가 `driverError` 표면만 이름 붙여 태우고
최상위 표면은 범용 테이블에 **우연히만** 덮여 있었다. `it.each` 로 두 표면을 나란히.

## consistency `16_58_16`

| # | 처분 |
|---|---|
| W1 | 내가 `create`/`update` 에 409 계약을 구현해 놓고 **`@ApiConflictResponse` 를 안 달았다.** `swagger.md §2-4` 위반이고, **이번엔 OpenAPI 선언이 런타임보다 좁았다** — W4 의 반대 방향. `code`·`details.field`·`details.code` 를 명시해 두 엔드포인트에 선언 |
| W2 | 자매 plan `spec-draft-api-convention-verifier-registration.md` 가 열린 체크박스 0개인데 `in-progress` 로 남아 있었다. **`origin/main` 에 `#1289`(`983fd0ade`)로 머지된 것을 확인**하고 `plan/complete/` 이동 + `status: complete`. `git mv` 후 `git show :<path>` 로 staged 내용 검증 |

---

## 실측하고 등재한 것

### W6 — 가장 넓은 fallback 에 좁은 판이 남았다

`http-exception.filter.ts` 의 로컬 `isUniqueViolation` 이 **`instanceof QueryFailedError`
를 먼저 요구**한다. raw(`err.code`) 표면 23505 는 걸러져 409 가 아니라 **500** 이 된다.
`pg-error.ts` 를 SoT 로 세운 이유가 정확히 그 표면 분기인데, 국소 처리가 없는 대다수
서비스가 지나는 fallback 은 안 옮겼다.

**blast radius 를 쟀다 — 지금은 ~0 이다.** 우리 스키마를 치는 raw query 가 요청 경로에
없다(`database-query.handler.ts` 는 사용자 외부 DB, `scripts/**` 는 요청 경로 아님).
**구조적 불일치이지 현재 버그는 아니다.**

`integration-oauth` 건과 같은 범위 규율로 등재하되, **둘 중 먼저 할 것은 이쪽**이라고
적었다 — 그쪽은 동작이 옳고(두 표면을 본다) 이쪽은 좁다.

### 별건 — `src/common/__test-utils__/` 5파일이 dist 로 나간다

W3(fixture 중복 통합)을 고치다 발견했다. `tsconfig.build.json` exclude 세 항목 어디에도
`__test-utils__` 가 안 걸린다 — **실측: `tsc --listFiles` → 5건.**

**지금은 지뢰가 아니다.** 전 파일 import 가 node 내장 + 로컬뿐이라, exclude 목록 주석이
경고하는 devDependency 형태(`require("typescript")`)는 없다. 죽은 코드가 dist 에 실릴 뿐.

→ `**/__test-utils__/**` 를 **디렉터리 이름 규약**으로 막자고 등재했다. 경로로 막으면
다음에 다른 자리에 만들 때 또 샌다 — 이번에 내가 정확히 그랬다.

## 조치하지 않은 나머지

| # | 사유 |
|---|---|
| W1 scope (harness 권한) | **사용자 결정 완료** — 코드는 남기고 `CLAUDE.md` 명시는 planner 항목. 체크박스가 열려 있는 것이 정상 상태다 |
| W3 scope (트리거 계약 확산) | 리뷰어가 *"되돌릴 필요 없음, 자기 억제 작동 중"* 판정 |
| W5 api_contract (`details` shape 삼중화) | 이미 plan 등재 |
| INFO 1·2·4·5·7·8·9 | 확인 기록 · 이미 등재 · 범위 밖 |
| INFO#3 (엔티티 파일 중복 파싱) | 현재 규모에서 체감 영향 없음 |
