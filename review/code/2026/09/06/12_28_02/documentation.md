# 문서화(Documentation) 리뷰

## 개요

이번 diff(`origin/main...HEAD`, 실질 변경 14개 파일)는 `User` 엔티티 컬럼 노출 검출 2축
신설(구조 축 `user-entity-exposure-guard.ts`, 이름 축 `user-secret-absence.ts`)과, 이미 네
차례의 `/ai-review`+`/consistency-check` 라운드(`10_13_22`→`10_53_48`→`11_27_53`→`11_55_36`)를
거쳐 처분된 Critical 1건·다수의 WARNING 이 누적 반영된 최종 상태다. 이번 라운드에서는 그
네 차례가 이미 지적·수정한 항목(JSDoc orphan 블록, `CREATOR_PROJECTION` 손 복제, e2e 라벨
중복·순서, stale count, `joinedAt` JSDoc 의 공개 노출 위반)이 전부 실제 코드에 반영돼 있음을
직접 열어 재확인했다 — 재발 없음. 새로 발견한 것은 아래 한 건이다.

## 발견사항

- **[WARNING]** `findEagerUserRelations`(eager 관계 검출 축)가 세 차례에 걸쳐 코드·테스트에
  완전히 자리잡았는데도, 그 축의 존재를 설명해야 할 세 문서(가드 spec 파일 헤더 JSDoc·
  CHANGELOG·plan 완료 노트) 어디에도 반영되지 않았다
  - 위치:
    - `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts` — 파일 헤더
      JSDoc `## 무엇을 세는가` 절(함수: 없음, 파일 상단 블록 코멘트. `describe('eager 관계 축', ...)`
      블록은 그 아래 `describe('\`User\` 관계 전체 로드 래칫', ...)` 안에 실존한다)
    - `CHANGELOG.md` — `## Unreleased — \`User\` 엔티티에 마지막 방어선을 세운다` 절의
      `### 택한 것 — 원인은 구조로, 결과는 이름으로` 목록(두 항목만 나열)
    - `plan/in-progress/spec-draft-nullable-notation-followups.md` — `[x] User 엔티티에
      컬럼 수준 방어를 둘지 결정` 항목의 `> 완료 (2026-09-06)` 서술 전체
  - 상세: `user-entity-exposure-guard.ts` 는 원래 "호출부(콜사이트)를 AST 로 훑어
    `relations`/`leftJoinAndSelect` 형태를 잡는" 축 하나로 시작했다. 이후 라운드
    (`review/code/2026/09/06/11_27_53` W1)가 *"`@ManyToOne(() => User, { eager: true })` 는
    호출부에 `relations` 도 `*JoinAndSelect` 도 남기지 않아 원리적으로 검출 불가능하다"*는
    별개 결함 클래스를 지적했고, 그 결과 **호출부가 아니라 엔티티 데코레이터 자체를 보는**
    완전히 다른 스캔 함수 `findEagerUserRelations`(파일 내 83~114행)를 신설했다. 이 축은
    다음 라운드(`11_55_36` W1)에서 검출력이 0이었던 것도 잡혀 fixture(`user-eager-relation.fixture.ts`)
    까지 갖췄고, 지금 `user-entity-exposure.spec.ts` 에 `describe('eager 관계 축', ...)`
    (106~136행)로 온전히 자리잡아 있다 — 즉 코드·테스트 레벨에서는 이 축이 완결된 상태다.

    그런데 같은 파일의 헤더 JSDoc(12~58행)의 `## 무엇을 세는가` 절(53~57행)은 여전히
    *"`User` 관계를 **투영 없이 통째로** 싣는 세 형태 — `relations` 배열 · `relations` 객체
    (0.3) · `leftJoinAndSelect`/`inner`"* 라고만 적어, eager 데코레이터 축을 언급하지 않는다.
    이 헤더는 "왜 이 가드인가"·"무엇을 세는가"를 신규 독자에게 요약하는 자리인데, 정작
    자신의 파일이 바로 아래에서 테스트하는 축 하나를 빠뜨렸다. CHANGELOG 의 "택한 것" 목록도
    두 항목(`user-entity-exposure-guard.ts`, `user-secret-absence.ts`)만 나열하고
    `user-entity-exposure-guard.ts` 서술 자체도 "세 형태"만 말한다. plan 완료 노트의
    "다시 잰 것" 표·"택한 것" 서술도 마찬가지로 세 형태·두 축만 언급한다.

    영향은 기능이 아니라 신뢰성이다 — 이 세 문서는 전부 "이 방어 체계가 무엇을 커버하는가"를
    사람이 판단하는 자리인데, 지금 상태로는 다음 사람이 이 헤더/CHANGELOG/plan 만 읽고
    "커버리지는 호출부 스캔 세 형태뿐"이라고 오판할 수 있다 — 실제로는 eager 데코레이터
    까지 네 번째 축으로 이미 막혀 있는데도. 같은 종류의 갱신 누락(문서가 실제 코드 진화를
    따라잡지 못함)이 이번 브랜치에서 이미 여러 번 반복됐다(JSDoc orphan, `joinedAt` 서술
    "하나"→"둘" 등) — 이번 것은 그 패턴이 검출 축 자체의 서술 범위에서 재현된 사례다.
  - 제안: 세 자리를 한 턴에 갱신한다 —
    (1) `user-entity-exposure.spec.ts` 헤더의 `## 무엇을 세는가` 절에 네 번째 항목으로
    "`@ManyToOne`/`@OneToOne` 의 `eager: true`(엔티티 데코레이터 자체 — 호출부 스캔이
    원리적으로 못 보는 형태)"를 추가.
    (2) `CHANGELOG.md` "택한 것" 목록의 `user-entity-exposure-guard.ts` 항목에 eager 축 한
    문장을 보태거나, 별도 하위 불릿으로 "그 자리에 성능 목적 eager 가 붙으면 콜사이트 스캔이
    영구히 놓친다 — 그래서 엔티티 데코레이터를 직접 보는 축을 별도로 뒀다(현재 0건, 그 0을
    계약으로 고정)"를 추가.
    (3) plan 완료 노트의 "다시 잰 것"/"택한 것" 서술에도 같은 취지를 반영(수치 자체는 이미
    "4곳" 등으로 다른 의미로 쓰이고 있으니, 새 숫자를 넣기보다 "세 번째 라운드에서 콜사이트
    스캔이 원리적으로 못 보는 eager 축을 추가했다"는 서술 한 문단으로 충분).

## 요약

이번 diff 는 4차례의 리뷰·컨시스턴시 라운드를 거치며 실질적인 문서화 결함(JSDoc 이 엉뚱한
함수 위에 얹힘, 보안 경계 리터럴 4곳 손 복제, e2e 라벨 중복·순서 역전, 테스트 제목의 stale
count, 필드 JSDoc 의 공개 OpenAPI 노출 위반)을 전부 실제로 해소한 상태였고, 이번 라운드에서
코드를 직접 열어 그 수정들이 반영돼 있음을 재확인했다 — 재발 없음. 새로 찾은 것은 검출
전략이 진화(콜사이트 스캔 2형태 → eager 데코레이터 축 추가로 확장)했는데 그 확장을 설명해야
할 세 상위 문서(가드 spec 헤더 JSDoc·CHANGELOG·plan 완료 노트)가 여전히 "세 형태"만 서술하는
한 건이다. 코드·테스트 자체는 정확하고 기능적 위험은 없으나, 이 저장소가 반복 지적해 온
"실측/서술이 코드 진화를 따라잡지 못한다"는 패턴이 검출 커버리지 서술에서 재현된 사례라
WARNING 으로 판단한다.

## 위험도

LOW
