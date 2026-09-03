# 테스트(Testing) 리뷰 — repo-guards walker 통합 + nullable-type-lie-cast 신규 가드

## 검증 방법

- 대상 스펙 전체(`source-scan.spec.ts`, `nullable-type-lie-cast.spec.ts`, `masked-reject-callers.spec.ts`,
  `audit-action-binding.spec.ts`, `engine-error-code-anchor.spec.ts`, `redis-fail-open-catalog.spec.ts`)를
  실행 — 10 suites / 182 tests 전부 GREEN.
- `tsc --noEmit`, `eslint` 대상 8개 파일 전부 클린(unused import 없음, `audit-action-binding-guard.ts`
  에서 `fs` import 제거가 실제로 안전한지 grep 으로 재확인).
- 뮤테이션 검증 2건을 실제로 수행(원본은 scratch 로 `cp` 백업 후 mutate → 테스트 실행 → `cp` 로 원복,
  `git status --short` 로 클린 확인 완료. `git checkout`/`restore` 미사용):
  1. `masked-reject-callers-guard.ts` 의 `listSourceFiles` 에서 `{ includeSpec: true }` 를 제거 →
     **15 tests 전부 GREEN 유지** (surviving mutant, 아래 WARNING 참조).
  2. `source-scan.ts` 의 `stripLiterals` 를 항등 함수로 치환 → `nullable-type-lie-cast.spec.ts` 의
     "저장소 전수 › 낡은 캐스트가 남아 있지 않다" 가 자기 자신의 스펙 픽스처(`parent: null as
     unknown as Probe`)를 잡아 **RED** (plan 문서가 주장한 자기-검출 뮤테이션 결과와 일치, 검증됨).
- 정규식/로직을 그대로 복제한 독립 스크립트로 `widenedEntityFields` 의 미검증 경계 3가지를
  probe(저장소 파일은 건드리지 않음, node 로만 실행): `@OneToOne` 단독 데코레이터, 기본값 대입
  (`= null`), 데코레이터 2개 이상 스택.

## 발견사항

- **[WARNING]** `listSourceFiles` 의 `includeSpec: true` 옵션이 빠져도(오타·리팩터 실수) 어떤 테스트도
  실패하지 않는다 — 이 가드가 지키려는 것(Manual 실행 경로가 `.spec.ts` 안에서도 base 함수를 직접
  호출하는 것을 잡는 것)이 조용히 무력화된다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:51`
    (`return collectTsFiles(rootDir, { includeSpec: true });`)
  - 상세: `ALLOWED_DIRECT_CALLERS` 에는 `resolve-trigger-parameters.spec.ts` ·
    `load-trigger-parameter-schema.spec.ts` 처럼 `*.spec.ts` 항목이 실제로 등재돼 있고, "죽은 항목"
    캐너리(`masked-reject-callers.spec.ts` 의 "허용목록 항목이 전부 실제 스캔에 잡힌다")는
    `fs.existsSync`/`fs.readFileSync` 를 직접 호출해 `listSourceFiles` 를 우회한다. 즉 스캔 함수
    자체가 spec 을 빼먹어도 이 캐너리는 여전히 GREEN 이다. 실측: `{ includeSpec: true }` 를
    `collectTsFiles(rootDir)` 로 되돌리는 뮤테이션을 넣고 `masked-reject-callers.spec.ts` 를
    돌리자 15/15 GREEN 유지(원복 완료, `git status --short` 클린). 이 가드가 이 PR 전체에서
    반복 강조하는 "가드가 탐지를 멈춰도 아무도 모른다" 는 결함 클래스가 옵션 배선(wiring) 층위에서
    그대로 재발한 형태다.
  - 제안: `listSourceFiles(root)` 가 `.spec.ts` 를 실제로 포함하는지 직접 단언하는 테스트를
    추가한다(예: 합성 tmp 픽스처로 `.spec.ts` 파일이 결과에 들어 있는지 확인) — `collectTsFiles`
    자체의 유닛 테스트는 있지만, 그 호출부(wrapper)가 옵션을 올바르게 전달하는지는 아무도 보지 않는다.

- **[INFO]** `widenedEntityFields` 의 `@OneToOne` 분기가 유닛 테스트로도, 저장소-전수 테스트로도
  전혀 실행되지 않는다(`@OneToOne` 관계를 쓰는 엔티티가 현재 저장소에 0개).
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:169`
    (`WIDENED_DECL` 정규식의 `@(?:Column|ManyToOne|OneToOne)` 분기), 관련 docstring `:132`
  - 상세: `nullable-type-lie-cast.spec.ts` 의 관계 테스트는 `@ManyToOne` + `@JoinColumn` 조합만
    다룬다(`ENTITY` 픽스처의 `parent` 필드). `@OneToOne` 은 docstring 에 명시적으로 언급되고
    정규식에도 포함돼 있지만, 검증 스크립트로 복제해 확인한 결과 로직 자체는 정상 동작한다
    (`@OneToOne` 단독 → 정상 검출). 다만 이 분기가 저장소 어디에서도 실행 경로를 타지 않으므로
    회귀가 나도 침묵한다.
  - 제안: `ENTITY` 픽스처에 `@OneToOne` 필드 하나를 추가하거나 별도 `it` 로 최소 커버.

- **[INFO]** `isNullableType` 이 `Type | null = <default>` 형태(필드에 기본값이 붙은 선언)에서는
  `null` 을 인식하지 못해 `widened` 판정에서 빠진다 — 문서화되지 않은 위음성 경로.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:180`
    (`isNullableType`), `WIDENED_DECL` 의 타입 캡처 그룹 `([^;]+)` 이 `= null` 까지 통째로 삼킨다.
  - 상세: 복제 스크립트로 확인 — `fooAt: Date | null = null;` 을 넣으면 `widenedEntityFields` 가
    `fooAt` 을 포함하지 않는다(`= null` 이 붙어 `split('|')` 결과가 `['Date ', ' null = null']`
    이 되어 정확히 `'null'` 과 일치하지 않음). 현재 저장소 엔티티 grep 결과 `| null = ` 패턴은
    0건이라 지금 당장 오탐/누락을 만들지는 않지만, 가드의 존재 이유가 "표기 형태에 기대지 않는다"
    (docstring 에 이미 순서·공백 케이스를 명시)는 것과 결이 다른 미포함 경로다.
  - 제안: 심각도는 낮음(위음성 방향이라 가드 철학과 방향은 일치) — 우선순위는 낮지만, 다른 표기
    변형(공백·순서)처럼 명시적으로 "알려진 한계" 로 docstring 에 남기거나 최소 한 줄 테스트로
    고정해 두면 다음 사람이 재발견하지 않는다.

- **[INFO]** `WIDENED_DECL` 이 문서화한 "데코레이터 2개 이상 스택 시 조용히 누락" 한계가
  `stripLiterals` 의 "템플릿 `${}` 중첩 백틱" 한계와 달리 회귀-고정 테스트가 없다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 의
    `WIDENED_DECL` 상단 docstring(`한계 — 추가 데코레이터는 1개까지만 본다` 절, 약 152~163줄대)
  - 상세: 같은 파일/같은 diff 세트 안에서 `stripLiterals` 의 알려진 한계(중첩 백틱)는
    `source-scan.spec.ts` 에 `[알려진 한계]` 라벨의 `it` 로 명시적으로 고정돼 있는 반면(§Mock
    적절성이 아니라 §회귀 테스트 관점에서 비대칭), `@ManyToOne`+`@JoinColumn`+`@Index` 처럼
    데코레이터 2개 이상이 스택된 경우의 "조용한 누락" 은 복제 스크립트로 재현은 했지만 저장소
    안에는 그 한계를 고정하는 테스트가 없다. docstring 은 "저장소 전수에 그런 조합은 없다
    (2026-09-04 실측)" 을 근거로 대는데, 그 실측 자체를 지키는 캐너리가 없어 다음에 그런 필드가
    추가되면 감지 없이 조용히 통과한다 — 이 PR 이 다른 가드에서 반복 강조하는 "캐너리로 고정"
    관례와 어긋난다.
  - 제안: `it('[알려진 한계] 데코레이터 2개 이상 스택은 조용히 누락한다', …)` 형태로 하나만
    추가해 `stripLiterals` 와 대칭을 맞춘다. 필수는 아니고, 낮은 우선순위.

## 강점 (참고)

- `collectTsFiles` 유닛 테스트가 4축(스펙 포함 여부·`.d.ts`·`node_modules`/`dist`·정렬)을 각각
  독립 `it` 로 분리하고, 정렬 분기를 `nested-sibling.ts` 한 파일로 관측 가능하게 만든 픽스처
  설계가 정교하다. 초판의 "이 환경에서는 원리적으로 못 잡는다" 는 잘못된 주장을 리뷰가 반증한
  이력까지 주석에 남겨, 다음 사람이 같은 착오를 반복하지 않게 했다.
- `stripLiterals` 는 알려진 한계(중첩 백틱)를 실패 케이스가 아니라 `[알려진 한계]` 로 라벨링해
  "고칠 버그" 와 "의도된 경계" 를 테스트 이름만으로 구분되게 했다 — 가독성이 좋다.
  `withFixture`/`withFiles` 를 하나로 합친 것도 "사본을 없애는 diff 안에서 새 사본을 만들었다"
  는 자기 지적을 실제로 반영한 결과다.
- `nullable-type-lie-cast.spec.ts` 의 이름-충돌 오탐 케이스(대조군 `userId` 시나리오)는 바로 앞
  PR 에서 반증된 실패 모드(DTO 필드명 매칭 48건 중 44건 오탐)를 재도입하지 않았음을 실제
  테스트로 고정했고, "저장소 전수" 하위 3개 테스트가 전제(entities>30, specs>300, widened>100)를
  먼저 단언해 공허한 GREEN(vacuous pass)을 막은 설계도 견고하다.
- 탐지 능력 자체를 GREEN 이 아니라 뮤테이션(옛 캐스트 되살리기·`stripLiterals` 항등화)으로
  실증한 시도가 plan 문서에 기록돼 있고, 본 리뷰에서 `stripLiterals` 항등화 뮤테이션을 재현해
  주장이 사실임을 재확인했다(위 "검증 방법" §2).
- 5개의 walker 사본을 단일화하면서도 각 가드의 회귀 스펙(`masked-reject-callers.spec.ts` 의
  7가지 우회 형태 `it.each` 등)이 리팩터 후에도 전부 그대로 GREEN — 인터페이스만 위임으로
  바뀌었을 뿐 개별 가드의 판정 로직·테스트는 건드리지 않은 안전한 리팩터.

## 요약

핵심 리팩터(walker 5사본 → `collectTsFiles` 단일화)와 신규 가드(`findStaleSpecCasts`)는 유닛
테스트 밀도가 높고, 특히 정렬 분기·자기-검출(self-catch) 뮤테이션 등 까다로운 케이스를 실제
뮤테이션으로 실증해 둔 점이 눈에 띈다. 실행 결과 10 suites/182 tests 전부 GREEN, tsc/eslint
클린을 확인했다. 다만 `collectTsFiles` 의 `includeSpec: true` 옵션이 wrapper(`listSourceFiles`)
층위에서 빠지는 배선 실수는 어떤 테스트도 잡지 못한다는 것을 뮤테이션으로 직접 확인했다 — 이
가드가 막으려는 정확한 실패 모드("가드가 조용히 약해져도 아무도 모른다")가 옵션 전달 지점에서
재발할 수 있는 사각지대다. 나머지는 저severity 의 문서화되지 않은 경계 케이스(`@OneToOne` 단독
분기 미실행, 기본값 대입 위음성, 다중 데코레이터 스택 한계의 캐너리 부재)로, 가드 방향(위음성
쪽으로 fail)과는 일치해 당장 위험하지는 않다.

## 위험도

MEDIUM
