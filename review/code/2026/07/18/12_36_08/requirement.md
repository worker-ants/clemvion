# 요구사항(Requirement) 리뷰 — interaction-type-guard-fixes

## 검증 방법

정적 리뷰에 더해 다음을 실행 검증했다:
- `npx vitest run src/lib/__tests__/interaction-type-exhaustiveness.test.ts` → 7 tests 전부 pass.
- Mutation 실측: `scriptKindForFile(fileName)` 호출부를 하드코딩 `ts.ScriptKind.TS` 로 되돌려
  재실행 → 신규 self-test `"parses angle-bracket syntax by extension, through the guard's
  own entrypoint"` 가 정확히 red 로 전환(나머지 6개는 green 유지), 이후 원복해 clean 확인.
  즉 "역방향 캐스트 회귀를 막는다"는 주석의 주장이 실측으로 성립한다.
- `npx eslint` 대상 2파일 → 클린.
- `grep -n "grep"` 대상 2파일 → 0건(주석의 "grep 가드" → "AST 가드" 정정이 두 파일 내에서
  전량 반영됐음을 확인 — plan 체크리스트 주장과 일치).

## 발견사항

- **[INFO]** `spec/conventions/interaction-type-registry.md` 워딩이 이 워크트리에서는 아직
  "grep 대상 파일"/"grep 검증 대상"/"코드 grep 결과" 로 남아 있어, 리뷰 대상 두 파일이 이미
  전량 "AST 가드" 로 정정된 것과 문면상 어긋나 보인다.
  - 위치: `spec/conventions/interaction-type-registry.md` §1.2 rule 3, §2.1 두 행, §5.
  - 상세: 이 워크트리는 fork-point `463aee139` 기준이고, `origin/main` 은 그 이후 별도 PR
    `22cc48ef3`(#977, `docs(spec): interaction-type-registry — grep 서술을 AST 스캔
    용어로 정정`)에서 동일 워딩을 이미 전량 교정했다(`git diff 463aee139 origin/main --
    spec/…` 로 실측 확인, 두 리뷰 대상 파일은 origin/main 과도 무변경). 즉 이번 PR 이
    도입한 불일치가 아니라 **branch 분기로 인한 일시적 staleness**이며, 내용(매트릭스·enum
    목록·rule 2/3 계약·§5 mutation 서술)은 두 버전이 동일 — 텍스트 명칭만 stale. `spec/`
    은 developer 쓰기 권한 밖이라 이 PR 범위에서 고칠 수 없고, plan
    (`plan/in-progress/interaction-type-guard-comment-false-negative.md` 후속 항목 1)도
    이를 "origin/main 에서 이미 해소, merge/rebase 시 자동 합류"로 명시 종결 처리했다.
  - 제안: 코드 fix 불필요. 이 브랜치가 `origin/main` 과 merge/rebase 될 때 스펙 파일이
    자동으로 정정된 버전으로 수렴한다(두 버전이 해당 라인에서 텍스트 diff 만 있고 구조적
    충돌 없음). 별도 조치 불요 — SPEC-DRIFT 도 아님(코드가 아니라 브랜치 동기화 문제).

- **[INFO]** `collectCodeStringLiterals` 는 `StringLiteral`/`NoSubstitutionTemplateLiteral`
  만 수집하고, 보간이 있는 템플릿 리터럴의 정적 파트(`TemplateHead`/`Middle`/`Tail`)는
  수집하지 않는다.
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:132-149`
  - 상세: 현재 `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES` 실제 코드에는 enum 값이 보간 템플릿
    안에 정적 텍스트로 실려 있는 사례가 없어(실행 결과로 확인) 오탐/누락을 유발하지 않는다.
    이 PR 이전부터 있던 범위이며 이번 변경으로 새로 생긴 문제가 아니다.
  - 제안: 현재로선 조치 불요. 향후 등록 사이트가 보간 템플릿 형태로 분기를 표현하게 되면
    함께 확장 검토.

## 요구사항 충족 관점 평가

두 파일의 변경은 "AST 가드가 주석 안 인용을 오매칭하던 false-negative(PR #968) 를 해소한다"는
의도된 기능을 실제로 구현하고 있고, 이번 라운드는 그 위에서 남아 있던 두 개의 정밀 결함(①
`.ts` 캐스트 리터럴이 `.tsx` 하드코딩으로 유실되는 역방향 케이스, ② self-test 가 실제
`collectCodeStringLiterals` 엔트리포인트를 `.tsx` 파일명으로 한 번도 통과하지 않아 되돌림
회귀를 못 잡던 문제)를 `scriptKindForFile(fileName)` 파생 + 엔트리포인트를 직접 관통하는
대칭 self-test 로 닫는다. 직접 실행한 vitest 스위트(7/7 pass)와 하드코딩 되돌리기 mutation
실측(정확히 새 self-test 만 red)으로 "주장한 회귀 방지"가 실제로 성립함을 확인했다. 반환값·
에러 경로(`missing.length > 0` 시 사이트·값 나열 후 throw)도 기존 로직 그대로 보존되어 있고
TODO/FIXME 류 잔존 주석은 없다. `interaction-type-registry.ts` 는 주석(용어) 정정만이고
`INTERACTION_TYPE_VALUES`/`CONVERSATION_SOURCE_VALUES`/`IS_MULTI_TURN_INTERACTION`
등 컴파일타임 단언 로직은 무변경이라 회귀 위험이 없다. spec 본문과의 line-level 불일치는
"grep" 잔여 워딩 1건뿐이며, 이는 이번 PR 이 만든 것이 아니라 브랜치가 origin/main 의 이미
머지된 별도 spec 정정 PR(#977)을 아직 못 받은 상태에서 오는 것으로, 실측상 merge 시 자동
해소된다(구조적 충돌 없음, 내용 자체는 두 버전이 동일). 두 파일 범위 내에서 CRITICAL/WARNING
급 결함은 발견되지 않았다.

## 위험도
NONE
