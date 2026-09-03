# 테스트(Testing) 리뷰 — repo-guard walker 통합(`collectTsFiles`) + `findStaleSpecCasts` 재검토

이 배치는 직전 라운드(`01_49_18`)에서 testing 리뷰어가 낸 WARNING 2건(W1 `sort()` "원리적으로
못 잡는다" 오판, W2 `stripLiterals` 무테스트)이 이미 수정·반영된 **이후** 상태다. 이번 리뷰는
그 수정을 신뢰하지 않고 직접 재검증했고, 별도로 새 코드 경로(`findStaleSpecCasts` /
`widenedEntityFields`)를 처음부터 다시 훑어 새 갭을 찾았다.

## 검증 절차 (뮤테이션 재현, 저장소 트리는 cp 로 원복·확인 완료)

1. `collectTsFiles` 의 `return out.sort();` → `return out;` 로 뮤테이션 → `source-scan.spec.ts`
   가 **2건 RED**(정확히 `nested-sibling.ts` 순서 불일치를 짚어냄). W1 수정이 실제로 회귀를
   잡는다는 RESOLUTION.md 의 주장을 직접 재현해 확인했다.
2. `stripLiterals` 를 항등 함수로 뮤테이션 → `source-scan.spec.ts` 전용 테스트 4건 RED **+**
   `nullable-type-lie-cast.spec.ts` 의 "저장소 전수" 테스트가 **자기 자신
   (`nullable-type-lie-cast.spec.ts`) 을 다시 offender 로 지목하며 RED**. plan 문서가 적은
   "② `stripLiterals` 를 항등으로 바꾸니 자기 spec 을 다시 잡아 RED" 주장을 재현해 확인했다.
3. 두 뮤테이션 모두 원본을 scratch(`mktemp` 아래)에 `cp` 해 둔 뒤 고쳤고, 확인 직후 `cp` 로
   즉시 원복했다(`diff` 로 바이트 동일 확인, `git status --short` 로 저장소 clean 확인 — 세션
   출력 디렉터리(`review/code/2026/09/04/02_12_38/`) 외 잔여물 없음).
4. `source-scan.spec.ts` · `nullable-type-lie-cast.spec.ts` · 4개 소비처 spec
   (`audit-action-binding.spec.ts` 등) 을 원본 상태로 재실행 — **112 tests, 6 suites 전부
   GREEN**.

## 발견사항

- **[WARNING]** `findStaleSpecCasts` 가 넓혀진 필드명을 **엔티티 구분 없이 전역 `Set<string>`**
  으로 판정해, 서로 다른 엔티티에 우연히 같은 필드명이 있으면 **정당한 캐스트를 오탐(false
  positive)으로 잡는다** — docstring 의 "왜 오탐이 없나" 절이 주장하는 "걸린 자리는 예외 없이
  제거 가능" 이 성립하지 않는 반례를 재현했다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:144-154`
    (`widenedEntityFields` — 필드명을 소유 엔티티와 무관하게 하나의 전역 `Set` 에 누적),
    `:172-178`(오탐 없음을 주장하는 docstring "## 왜 오탐이 없나"),
    `:183-197`(`findStaleSpecCasts` — 인자로 받는 `widened: ReadonlySet<string>` 자체가
    엔티티 컨텍스트를 갖지 않는다). 테스트 갭 위치는
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:215-335`
    (`describe('넓혀진 필드를 겨눈 낡은 spec 캐스트', …)`) — 이 블록의 모든 케이스가 **단일
    `ENTITY` fixture** 만 쓰고, "같은 필드명·다른 엔티티" 조합은 어디에도 없다.
  - 상세: `widenedEntityFields([entityA, entityB])` 는 `entityA.foo`(`| null`, widened)와
    `entityB.foo`(non-null, not widened)를 구분하지 않고 필드명 `foo` 하나만 `Set` 에 넣는다.
    `findStaleSpecCasts` 는 이 전역 집합만 보고 `<field>: null as unknown as` 를 매치하므로,
    `entityB` 를 다루는 spec 이 (엔티티 B 의 `foo` 가 non-null 이라 정당하게 필요한) 캐스트를
    쓰면 **entityA 의 `foo` 가 widened 라는 이유만으로** offender 로 잡힌다. 실제로 재현했다
    (scratch, 저장소 비변경):
    ```
    EntityA.foo: string | null   (widened, @Column type: 'varchar')
    EntityB.foo: SomeOtherType   (non-null, 캐스트가 실제로 필요)
    entityB.spec.ts: const f = { foo: null as unknown as SomeOtherType };

    widenedEntityFields([A, B]) => Set { 'foo' }
    findStaleSpecCasts([entityB.spec.ts], widened) =>
      [{ file: 'entityB.spec.ts', field: 'foo' }]   ← 오탐
    ```
    "저장소 전수" 테스트가 지금은 0건으로 통과하는 것은 **현재 저장소에 이런 필드명 충돌이
    우연히 없기 때문**이지, 술어가 이 축을 구조적으로 막아서가 아니다 — `WIDENED_DECL` 의
    "추가 데코레이터 1개까지" 한계(리뷰 INFO#1)와 같은 종류의, **위음성이 아니라 위음성의
    반대(오탐) 방향**이라는 점에서 오히려 더 시끄러운 실패 모드다(정당한 캐스트를 지우라고
    요구하게 됨).
  - 제안: 최소 조치로 (a) 이 반례를 겨눈 대조군 테스트를 추가해 "지금은 발생하지 않는다"는
    사실을 명시적으로 고정하거나(현재는 암묵적으로 "저장소 전수 0건"에만 의존), (b) 저장소
    전수 스캔 직전에 필드명 충돌 여부를 별도로 assert 해 두 축이 우연히 섞이는 순간 (오탐이
    아니라) 조기에 사람이 인지하게 한다. 근본 수정(엔티티별로 scope 를 나눠 판정)은 지금 실
    피해가 없다는 점에서 급하지 않지만, docstring 의 "예외 없이" 문구는 이 반례가 있는 한
    과장이므로 최소한 한 줄 한계 기재는 필요하다(이 파일의 다른 함수들이 이미 하는 관례).

- **[INFO]** `WIDENED_DECL` 의 "추가 데코레이터 1개까지" 알려진 한계(리뷰 INFO#1, 3명 공통
  지적·직전 라운드에서 docstring 기재로 조치 완료 처리됨)는 여전히 **RED 방향 pinning 테스트가
  없다** — 같은 diff 안에서 `stripLiterals` 의 "`${}` 중첩 백틱" 한계는
  `[알려진 한계]` 테스트로 고정했는데(그래서 "한계를 없애면 여기가 깨진다" 는 신호를 준다),
  `WIDENED_DECL` 쪽은 docstring 기재로만 남아 있어 같은 diff 안에서 두 "알려진 한계"가
  서로 다른 엄격도로 처리됐다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:134-142`
    (`WIDENED_DECL` 정의와 한계 docstring). 대응 pinning 테스트가 없는 자리는
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:231-236`
    (`ManyToOne` + `JoinColumn` 1개만 검증, 2개 이상 스택은 미검증).
  - 상세: 저장소 전수에 해당 조합이 없다는 실측 근거로 이미 낮은 우선순위로 처분된 항목이라
    재조치를 요구하지 않는다. 다만 `stripLiterals` 예시가 "docstring 한계 + RED pinning 테스트"
    조합을 이 diff 안에서 이미 시범 보였으므로, 다음에 `WIDENED_DECL` 을 만질 때 같은 패턴을
    적용하면 두 "알려진 한계" 표기 수준이 맞아떨어진다.
  - 제안: 조치 불필요(이미 처분됨). `it.skip` 이나 `[알려진 한계]` 네이밍으로 2단 스택
    데코레이터 fixture 를 넣고 "현재는 누락됨"을 명시 고정하면 표기가 대칭이 된다 — 낮은
    우선순위.

## 요약

이전 라운드 WARNING 4건 중 testing 소관 2건(`sort()` 오판 정정, `stripLiterals` 테스트 추가)은
문서상 주장뿐 아니라 **직접 뮤테이션 재현으로 실제 동작을 재검증**했고 둘 다 참이었다 —
`collectTsFiles` 의 `sort()` 제거는 `nested-sibling.ts` 픽스처 덕분에 2건 RED, `stripLiterals`
항등화는 전용 테스트 4건과 "저장소 전수" 자기지시 테스트가 함께 RED 를 낸다. `withFiles`/
`withFixture` 통합(W3)·JSDoc 위치 정정(W4)도 실제 파일에서 확인했다. 다만 이번 리뷰가 새로
찾은 갭이 하나 있다: `findStaleSpecCasts` 가 넓혀진 필드명을 엔티티 구분 없이 전역으로
판정해서, 서로 다른 엔티티가 같은 필드명을 쓰면 정당한 캐스트를 오탐으로 잡는다 — docstring 의
"오탐이 없다" 는 절대적 주장과 어긋나는 반례를 scratch 재현으로 확인했다(저장소 원본은
불변). 오늘 저장소에는 그런 이름 충돌이 없어 실피해는 0 이지만, 테스트도 문서도 이 축을
전혀 다루지 않는다. `WIDENED_DECL` 의 데코레이터 스택 한계는 이미 처분된 INFO 라 참고로만
남긴다. 신규 코드(`collectTsFiles`, `stripLiterals`, `widenedEntityFields`,
`findStaleSpecCasts`) 전반의 테스트 격리(tmpdir 기반, 실소스 불변형)·가독성(각 테스트가 "왜"를
설명)·회귀 방어는 이 저장소 평균 대비 높은 수준이다.

## 위험도

LOW — 신규 오탐 축은 오늘 실피해가 0 이고(전수 스캔 GREEN, 실제 충돌 부재), 영향 범위도
프로덕션 런타임이 아니라 CI 가드/테스트 인프라에 한정된다. 다만 문서화된 보장("오탐 없음")이
실제 구현보다 넓다는 점에서 WARNING 으로 기록해 다음 배치에서 필드명 충돌이 실제로 발생했을 때
"가드 버그" 로 오인되지 않도록 한다.
