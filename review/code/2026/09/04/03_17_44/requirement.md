# 요구사항(Requirement) 리뷰 — `repo-guards` walker 통합 + 낡은 spec 캐스트 가드 (4R)

## 검증 방법

정적 diff 판독에 더해 실행 가능한 것은 직접 돌려 확인했다(저장소 트리에는 아무 것도 쓰지 않음 —
`git status --short` 로 확인, 세션 시작·종료 시 동일하게 `review/code/2026/09/04/03_17_44/` 만 존재):

- `npx jest --testPathPatterns="(source-scan|audit-action-binding|engine-error-code-anchor|masked-reject-callers|nullable-type-lie-cast|redis-fail-open-catalog)"`
  → **6 suites / 117 tests 전부 PASS**
- `grep -rln readdirSync codebase/backend/src/repo-guards/__tests__/ codebase/backend/src/common/__test-utils__/`
  → `source-scan.ts`·`source-scan.spec.ts` 2곳만(자기 자신) — 5개 가드 파일에서 `readdirSync` 잔존
  **0**, plan 문서의 "사본 5개 제거" 주장과 일치
- `npx ts-node -e "..."` 로 `widenedEntityFields`/`findStaleSpecCasts` 를 실제로 실행:
  `entities: 41, specs: 443, widened.size: 115, offenders: 0` — plan 문서의
  "2026-09-04 실측 135 → 115"·"저장소 잔존 0" 주장과 **정확히 일치**
- `grep -n lockedUntil codebase/backend/src/modules/auth/auth.service.spec.ts` → `lockedUntil: null,`
  (캐스트 없음) — plan 이 "제거한 4건" 중 하나로 적은 `lockedUntil` 이 실제로 정리돼 있음을 확인
- `spec/conventions/*.md` 전수에서 `nullable`·`TypeORM`·`@Column`·`design:type` grep →
  이 diff 의 대상 영역(내부 test-tooling/repo-guard)을 직접 규정하는 spec 본문 없음(회색지대,
  1R~3R 리뷰가 이미 같은 결론을 냈고 재확인됨)
- TODO/FIXME/HACK/XXX grep → 대상 8개 파일 전부 0건

## 발견사항

- **[INFO]** `findStaleSpecCasts` 의 `stripComments`→`stripLiterals` 합성 순서가, 같은 줄에
  URL 등 `//` 를 포함한 문자열 리터럴이 **캐스트보다 앞에** 오면 그 캐스트를 조용히 놓친다
  (위음성 방향 — 이 가드의 존재 이유와 정면으로 어긋나는 방향)
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:237`
    (`const src = stripLiterals(stripComments(fs.readFileSync(file, 'utf8')));`)
  - 상세: 직접 재현 스크립트로 확인 —
    `const f = { url: 'https://x.test', widenedAt: null as unknown as Date };` 한 줄을
    현재 순서(`stripLiterals(stripComments(x))`, 즉 주석 제거를 **먼저** 함)로 처리하면
    `stripComments` 의 `/\/\/.*$/gm` 가 문자열 안의 `https://x.test` 의 `//` 를 주석 시작으로
    오인해 그 줄의 나머지(캐스트 포함)를 전부 잘라낸다 → `SPEC_CAST` 매치 **0건**. 순서를
    뒤집으면(`stripComments(stripLiterals(x))`, 리터럴 내용을 먼저 비움) 같은 입력에서
    `widenedAt` 을 정상 검출한다 — 스크립트로 두 경로 모두 실측(재현 스크립트는 scratch 에만
    작성, 저장소 미변경). 저장소 전수 grep(`https?://[^'"]*['"][^\n]*null\s+as\s+unknown\s+as`,
    `.spec.ts` 대상) 결과 **현재 실재하는 사례는 0건**이라 지금 당장의 회귀는 아니다.
  - `stripComments`·`stripLiterals` 각각의 JSDoc 은 자신의 한계를 정직하게 적어 뒀지만
    (`stripComments`: URL 트레이드오프 / `stripLiterals`: 중첩 백틱), 이 파일에서 **두 함수를
    합성할 때 생기는 새 상호작용**은 `findStaleSpecCasts` docstring 의 "왜 오탐이 없나" 절에서
    다뤄지지 않는다 — 그 절은 이름 충돌(정밀도) 만 논증하고 이 합성 순서로 인한 재현율 문제는
    다루지 않는다.
  - 제안: 코드 fix 대상이라기보다 문서화 갭에 가깝다(같은 PR 이 `WIDENED_DECL` 데코레이터
    개수 제약을 이미 이렇게 처리했다 — "저장소 전수에 없다, 넓히지 않는다, 실재하면 이 주석이
    판단 기록이 된다"). 필수는 아니나, 순서를 `stripComments(stripLiterals(x))` 로 뒤집으면
    이 위음성 경로 자체가 원천적으로 닫힌다(부작용 없음도 재현 스크립트로 확인) — 원한다면
    간단한 fix.

- **[INFO]** `SPEC_CAST` 정규식이 프로퍼티/타입 표기 형태(`field: null as unknown as X`)만
  매치하고, 대입문 형태(`obj.field = null as unknown as X`)는 구조적으로 못 본다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:203`
    (`const SPEC_CAST = /(\w+)\s*:\s*(?:null|undefined)\s+as\s+unknown\s+as\b/g;`)
  - 상세: 자매 술어 `countNullAsUnknownAsCasts`(프로덕션 소스 대상, `findCastOffenders` 가 씀)는
    `/\bnull as unknown as\b/g` 로 필드명과 무관하게 **모든** 형태(대입문 포함)를 잡는다.
    `findStaleSpecCasts` 는 어떤 필드가 넓혀졌는지 판정에 필드 *이름*이 필요해서 콜론 앞
    식별자를 요구하는 지금 형태가 됐지만, 그 결과 `mockUser.lockedUntil = null as unknown as
    Date;` 같은 대입문 형태의 낡은 캐스트는 `widened` 대조 자체가 안 되어 **조용히 통과**한다
    (위음성). `.spec.ts` 전수(`grep -rlP '\w+\s*=\s*(null|undefined)\s+as\s+unknown\s+as\b'`)를
    확인한 결과 **현재 이 형태의 실사례는 가드 자신의 픽스처 문자열 3건뿐**이고 실제 낡은
    캐스트는 없다(위 offenders=0 실측과 일치) — 지금은 잠재적 한계다.
  - 이 한계는 `SPEC_CAST` 바로 위 JSDoc(`foo: null as unknown as Bar 의 foo`)에도,
    `findStaleSpecCasts` 자신의 "왜 별도 술어인가"/"오탐 없음은 …" 절에도 언급되지 않는다 —
    이 PR 이 다른 두 한계(데코레이터 개수·중첩 백틱)는 정확히 이런 형태로 명시했는데 이
    지점만 비대칭이다.
  - 제안: 문서화 갭. `obj\.(\w+)\s*=` 형태를 추가로 매치하도록 정규식을 넓히거나, 최소
    "대입문 형태는 안 본다" 를 docstring 에 한 줄 추가.

- **[정보성 확인, 결함 아님]** 3R 리뷰(`01_49_18`)가 지적한 W1~W4 와 INFO#1(데코레이터 1개
  제약)이 이번 라운드 코드에 실제로 반영돼 있음을 직접 재확인했다 — `stripLiterals` 전용 테스트
  7건(`source-scan.spec.ts:289-335`), JSDoc 삽입 위치 정정(`countCalls` 의 JSDoc 이
  `source-scan.ts:84-90` 에서 정상적으로 자신의 선언 바로 위에 있음), `withFiles`/`withFixture`
  일반화(`nullable-type-lie-cast.spec.ts:55-78`), `WIDENED_DECL` 한계 docstring
  (`nullable-type-lie-cast-guard.ts:160-166`). 회귀 없음.

## 요약

핵심은 `repo-guards/__tests__/` 의 디렉터리 walker 사본 5개를 `collectTsFiles(root,
{ includeSpec })` 하나로 통합하고, `stripLiterals` 를 노출해 새 가드
`widenedEntityFields`/`findStaleSpecCasts`(`| null` 로 넓혀진 엔티티 필드를 겨눈 `.spec.ts` 의
낡은 `null as unknown as` 캐스트 검출)를 완성한 것이다. 직접 실행한 6 suites/117 tests 전부
PASS, `readdirSync` 잔존 0, `widened.size=115`·`offenders=0` 실측이 plan 문서의 정량 주장과
정확히 일치했고, `lockedUntil` 등 앞서 손으로 제거했다고 적은 캐스트가 실제로 정리돼 있음도
확인했다. 이 변경 영역(내부 test-tooling/repo-guard)을 직접 규정하는 `spec/` 본문은 없어
spec fidelity 위반은 없다(회색지대). TODO/FIXME 없음, 모든 경로에서 적절한 값(빈 배열/Set)을
반환한다. 이번 라운드에서 새로 발견한 것은 CRITICAL/WARNING 급이 아니라 **미문서화된 두 위음성
경로**(주석-리터럴 합성 순서·대입문 형태 미탐지)뿐이며, 둘 다 저장소 전수 확인 결과 현재
실사례는 0건이라 잠재적 한계다 — 이 PR 이 이미 정확히 이런 종류의 한계를 여러 곳에서 실측·
문서화하는 관례를 세워 놓은 만큼, 같은 대우(문서화 또는 간단한 fix)를 받을 만하다.

## 위험도

LOW
