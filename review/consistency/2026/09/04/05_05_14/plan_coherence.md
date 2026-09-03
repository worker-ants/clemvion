# Plan 정합성 검토

## 검토 범위

- target: `spec/conventions/`(scope 델타 0, 정상 — 이 PR 은 코드 전용)
- 실제 diff: `codebase/backend/src/common/__test-utils__/source-scan.ts`(신규
  `collectTsFiles`·`stripLiterals` export) + `repo-guards/__tests__/` 5개 guard 파일의 walker
  통합(`audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·
  `masked-reject-callers-guard.ts`·`nullable-type-lie-cast-guard.ts`·
  `redis-fail-open-catalog-guard.ts`)
- diff 는 `plan/in-progress/entity-nullable-column-type-mismatch.md`(배치 3, §「후속 —
  `repo-guards/__tests__/` 의 공용 walker 추출」·§「후속 — 넓혀진 필드를 겨눈 낡은 `.spec.ts`
  캐스트 가드」)가 자체적으로 매우 상세히 문서화한 변경과 일치한다 — 이 plan 자체와의 정합은
  이미 잘 추적돼 있다. 아래는 **다른 plan** 과의 교차 정합성만 다룬다.

## 발견사항

- **[WARNING]** `listProductionSources` 의 mutation-coverage 갭이 다른 PR 로 조용히 닫혔는데 그 plan 이 갱신되지 않았다
  - target 위치: `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts`
    `listProductionSources`(diff 상 `collectTsFiles(srcDir)` 위임으로 교체됨)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` (`19_53_43` testing INFO 1,
    "남은 갭... 이 PR 에서 안 닫음" 항목)
  - 상세: 그 plan 은 `listProductionSources` 의 `node_modules`/`dist`/`.d.ts` 제외 분기가
    **뮤테이션으로 관측 불가**(리뷰어가 제외 조건을 무력화해도 10/10 GREEN — `src` 하위에
    그 디렉터리·확장자가 없어 분기가 발화하지 않음)라고 명시하고, 처방을 "다음에 이 가드를
    만질 때 scratch 디렉터리에 `node_modules/`·`dist/`·`*.d.ts` 를 합성해 제외 로직을 직접
    발화시키는 케이스로 닫는다" 로 적어 **다음 손질 시점**을 재개 신호로 못박아 뒀다.
    본 diff 가 정확히 "그 가드를 만지는" 사건이다 — `listProductionSources` 를
    `collectTsFiles` 위임으로 바꿨고, `collectTsFiles` 는 `source-scan.spec.ts` 에 **바로 그
    합성 fixture**(`mk('node_modules/pkg/index.ts')`·`mk('dist/bundle.ts')`·
    `mk('types.d.ts')`)로 제외 분기를 직접 발화시키는 전용 테스트를 갖췄다
    (`'node_modules'·'dist' 는 옵션과 무관하게 항상 건너뛴다'`·
    `'.d.ts' 는 옵션과 무관하게 항상 제외한다'`). 즉 `listProductionSources` 의 그 분기는
    이제 mutation-observable 하다 — 그런데 `backend-lint-gate-broken-on-main.md` 는 여전히
    이 갭을 열린 항목으로 서술하고, `entity-nullable-column-type-mismatch.md` 쪽도 이 교차
    효과를 언급하지 않는다(자기 plan 안에서의 "동작 불변" 실측만 적었다).
  - 제안: `backend-lint-gate-broken-on-main.md` 의 해당 INFO 항목에 "`collectTsFiles` 로
    위임되며 `source-scan.spec.ts` 의 합성 fixture 가 이 분기를 대신 커버 — 재확인 후 닫음"
    각주를 추가(또는 체크 완료로 정정). 재확인은 `listProductionSources` 를 되돌리는
    뮤턴트가 `source-scan.spec.ts` 스위트에서 RED 가 되는지 1회 확인이면 충분하다.

- **[WARNING]** repo-guards 3파일 패턴이 5개 guard 로 더 굳어졌는데 소유 규약 문서가 여전히 없다
  - target 위치: `spec/conventions/`(신설 없음 — 델타 0)
  - 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` §관련
    ("같은 라운드의 별건 INFO 2 — repo-guard 3파일 패턴(`*-guard.ts`/`*-fixture.ts`/`*.spec.ts`)이
    5쌍 이상 누적됐는데 소유 규약 문서가 없다. `spec/conventions/repo-guards.md` 신설 검토는
    이 항목과 독립이며 더 큰 결정이라 여기 묶지 않는다(포인터만 남긴다)")
  - 상세: 이 포인터는 2026-08-31 시점 기록이고, 그 뒤로도 **독립 plan 항목으로 승격되지
    않은 채** 방치돼 있다(저장소 전체에서 "repo-guards.md" 를 언급하는 in-progress plan 은
    이 파일 하나뿐 — grep 확인). 이번 diff 는 그 패턴을 더 심화시킨다: `repo-guards/__tests__/`
    는 현재 guard 7종(`audit-action-binding`·`engine-error-code-anchor`·`eslint-unicorn-peer`·
    `masked-reject-callers`·`nullable-type-lie-cast`·`production-build-devdep`·
    `redis-fail-open-catalog`)이고, 이 PR 이 그중 5개의 파일 수집 로직을 `source-scan.ts`
    의 `collectTsFiles` 하나로 통합해 **공유 인프라를 실질적인 하위 규약으로 굳혔다**
    (`.spec.ts`/`.d.ts` 제외, `node_modules`/`dist` skip, 정렬 — 이 넷이 이제 다섯 guard
    전체의 사실상 표준). `entity-nullable-column-type-mismatch.md` 는 이 통합을 상세히
    다루면서도 "이 패턴을 규약으로 문서화해야 하는가" 질문에는 닿지 않는다.
  - 제안: `spec-conventions-engine-error-code-surface.md` 의 포인터를 독립 plan 항목(또는
    `plan/in-progress/spec-conventions-repo-guards-doc.md` 같은 별도 파일)으로 승격하거나,
    최소한 이번 diff 로 늘어난 guard 개수·`collectTsFiles` 통합 사실을 그 포인터에 반영해
    "5쌍 이상" 수치를 갱신할 것 — 다음 세션이 stale 한 "5쌍" 을 근거로 우선순위를 오판할 수
    있다.

- **[INFO]** `raw-query-results.md` 의 `code:` frontmatter 범위가 이 diff 로 더 벌어진다
  - target 위치: `spec/conventions/raw-query-results.md` frontmatter
    `code: [... codebase/backend/src/common/__test-utils__/source-scan.ts]`
  - 관련 plan: 없음(교차 plan 충돌은 아님, spec-impl-evidence 매핑 관찰)
  - 상세: 이 규약 문서는 "raw SQL 결과를 읽는 방법"(튜플 unwrap·snake_case)만 규정하는데,
    `code:` 는 `source-scan.ts` 전체를 링크해 둔다. 이 diff 로 그 파일은 `collectTsFiles`·
    `stripLiterals` 등 라우팅상 무관한(엔티티 nullable 캐스트 가드 전용) 로직을 추가로
    보유하게 돼, 이 파일을 그 규약의 "구현 근거" 로 자동 대조하는 도구(spec-coverage 등)가
    무관한 코드를 그 규약의 증거로 오인하거나 그 반대로 읽을 여지가 커진다. 이 module 이
    이미 여러 가드가 공유하는 인프라였다는 점에서 PR 이전부터 있던 경향이 이번에 더
    벌어졌을 뿐이라 CRITICAL/WARNING 급은 아니다.
  - 제안: 급하지 않음. 다음에 `raw-query-results.md` 를 만질 때 `code:` 를 그 규약이
    실제로 정의하는 함수(`countRawUpdateReturning`/`hasRawUpdateReturning` 등)만으로 좁히거나,
    frontmatter 주석으로 "이 파일은 여러 규약이 공유하는 인프라" 라고 명시하는 것을 검토.

## 확인했으나 문제 없음으로 판정한 것

- `entity-nullable-column-type-mismatch.md` 의 미해결 "후속(planner 턴)" 3건
  (`spec/1-data-model.md` §2.9 · `2-api-convention.md` §2.2 · §5.4)은 모두 target scope
  (`spec/conventions/`) 밖이고 이번 diff 도 그 파일들을 건드리지 않는다 — 충돌 없음.
- `masked-reject-callers-guard.ts`/`audit-action-binding-guard.ts`/
  `engine-error-code-anchor-guard.ts` 의 walker 교체로 인한 파일 집합·정렬 변화는 plan 이
  이미 리팩터 전후 파일 목록을 캡처해 전수 대조(507/818/1261/818/818 전부 집합 동일)했고,
  `.d.ts`·`node_modules`/`dist` 축의 무영향도 실측(0개)으로 뒷받침돼 있다 — 이 diff 가
  스캔하는 소스 목록을 바꿀 위험은 이미 그 plan 안에서 닫혔다.
- `auth-guard-reflection-hardening.md` 의 미해결 항목("`__test-utils__` 가 devDependency 를
  import 하면 `tsconfig.build.json` exclude") 트리거는 devDependency import 여부다. 이
  diff 가 `source-scan.ts` 에 추가한 `collectTsFiles`(`node:fs`/`node:path` 만 사용)는 그
  축을 건드리지 않는다 — 트리거 미발동, 유예 유지 판단과 충돌 없음.

## 요약

target(`spec/conventions/`) 자체의 델타는 0 이라 정면 충돌은 없다. 다만 diff 가 만지는
`repo-guards/__tests__/` 공유 인프라는 두 개의 다른 in-progress plan 이 열린 상태로 추적
중인 사안과 교차한다 — 하나는 `backend-lint-gate-broken-on-main.md` 가 남겨 둔 mutation-coverage
갭이 이번 리팩터로 사실상 닫혔는데 그 plan 이 갱신되지 않았고, 다른 하나는
`spec-conventions-engine-error-code-surface.md` 가 "포인터만 남긴다" 고 명시적으로 미룬
repo-guards 규약 신설 논의가 이번 diff 로 근거(guard 개수·공유 walker)가 더 강해졌는데도
독립 항목으로 승격되지 않은 채 방치돼 있다. 둘 다 코드 정합성 문제가 아니라 **plan 문서가
현재 코드 상태를 따라가지 못하는** 유형이라 WARNING 등급이 맞고, 병합을 막을 사안은 아니다.

## 위험도

MEDIUM
