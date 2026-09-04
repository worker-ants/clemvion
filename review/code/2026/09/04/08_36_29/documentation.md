# 문서화(Documentation) 리뷰

## 관측된 워크트리 이상 상태 (보고 의무 — 이번 diff 의 결함 아님)

리뷰 시작 시점에 `git status --short` 를 확인한 결과, diff 대상이 아닌
`codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 가 **커밋되지 않은
상태로 수정돼 있었다** — `WIDENED_DECL` 정규식에서 `ManyToOne|OneToOne` 이 빠져 `Column` 만
남은 상태(`git diff` 로 확인). 이는 requirement.md/testing.md(`08_18_51`)가 기록한 "관계
데코레이터만 `WIDENED_DECL` 에서 빼는" 뮤테이션과 정확히 같은 모양이라, 다른 병렬 reviewer 가
지금 이 순간 뮤테이션 검증 중이거나 원복 도중인 것으로 보인다. 규약에 따라 이 파일을 건드리지
않았고 원복도 시도하지 않았다 — 관측 사실만 보고한다. 이 리뷰가 끝나는 시점까지도 이 상태가
남아 있다면 다음 사람이 오탐으로 조사할 수 있으니 후속 리뷰어/조율자가 확인할 필요가 있다.

## 발견사항

- **[WARNING]** 리뷰에서 발견돼 **의도적으로 유예된 후속 항목**(`@OneToOne` 관계 충돌 캐너리
  부재)이 `plan/` 이 아니라 `review/` 안에만 기록돼 있다 — 이 저장소 자신의 확립된 관례("진행
  중 작업은 `plan/in-progress/`" · "`review/` 는 SoT 아님, 미룬 항목은 그 턴에 `plan/` 에
  적는다")와 어긋난다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md` — 이번 diff 가 `[x]` 로
    승격한 항목(게이트 233~245, "후속 — 관계 데코레이터 동명 충돌 캐너리"). 대조:
    `review/code/2026/09/04/08_18_51/RESOLUTION.md` 게이트 50~51("**#1** `@OneToOne` 분기
    미커버... 생기면 그때"), `SUMMARY.md` INFO#1(게이트 18), `requirement.md`/`testing.md`
    각 INFO 항목.
  - 상세: 이번 diff 로 완료 처리된 원 항목("관계 데코레이터끼리의 동명 충돌 캐너리")은 애초에
    `plan.md` 자신이 "이 파일을 다음에 만질 때 `[대조군]` 테스트에 관계 버전을 `it.each` 로
    더한다" 는 형태로 **후속 작업을 plan 본문에 직접 적어 둔** 전례다. 그런데 이번 라운드
    (`08_18_51`)에서 새로 드러난 두 번째 갭 — `@OneToOne` 조합 자체는 새 대조군 2건 모두
    `@ManyToOne` 만 써서 검증되지 않았고, 저장소에 실사례가 없어 "**다음에 `@OneToOne` 실충돌이
    생기면 `it.each` 로 추가**" 라고 의도적으로 유예됐다 — 는 `plan.md` 어디에도 적히지 않았다
    (`grep -rn OneToOne plan/ spec/` 결과 **0건**). 커밋 메시지(`6dada6b16`)와 `review/` 세
    파일에만 남아 있다. `review/` 가 SoT 가 아니라는 이 저장소의 명시적 관례를 따르면, 이 조건부
    후속(트리거: 저장소에 `@OneToOne` 동명 충돌이 생김)은 다음 사람이 이 plan 파일을 다시 열었을
    때 보이는 자리에 있어야 한다. 지금 상태로는 이 plan 을 `complete/` 로 옮기는 순간 이 유예된
    항목의 유일한 기록이 통째로 사라질 위험이 있다.
  - 제안: `plan.md` 의 이번 완료 항목(게이트 233~245) 끝에 한 줄만 보태면 닫힌다 — 예:
    "> 유예: `@OneToOne` 관계끼리의 동명 충돌은 저장소에 실사례가 0건이라 캐너리를 만들지
    않았다. 생기면 이 절에 `it.each` 로 추가한다." 코드 변경은 필요 없다.

- **[INFO]** 신규 docstring(게이트 372~386)이 "`@Column`·`@ManyToOne`·`@OneToOne` 을 모두
  구분하지 않는다" 고 명시하지만, 그 주장을 뒷받침하는 새 대조군 2건은 둘 다 `@ManyToOne` 만
  쓰고 `@OneToOne` 은 이 spec 파일 전체(기존 테스트 포함)에 한 번도 등장하지 않는다 — 직접
  `grep -n OneToOne` 로 재확인, 히트는 docstring 문구 자체(게이트 376)와 가드 파일의 정규식·
  주석뿐이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 게이트
    372~386(docstring), 387(`it('[대조군] 관계 데코레이터끼리의 동명 충돌도 판정에서 뺀다'`),
    417(`it('[대조군] `@Column` 과 관계가 섞인 충돌도 뺀다'`)
  - 상세: 이 갭은 이미 지난 라운드(`08_18_51`)의 testing/requirement/documentation reviewer가
    동일하게 짚었고, `RESOLUTION.md` 가 "저장소에 그 충돌 사례가 0건이라 픽스처를 만들면 실재하지
    않는 형태를 고정하게 된다 — 생기면 그때" 로 명시적으로 조치 없음(won't-do-for-now) 처리했다.
    새로운 결함은 아니고, 이미 한 라운드 triage 를 거친 상태를 재확인한 것 — 위 WARNING 항목(그
    유예가 `plan/` 에 없다는 것)과 짝을 이루는 관측이라 함께 기록한다.
  - 제안: 위 WARNING 의 제안과 동일 — 코드를 더 만들 필요는 없고 유예 근거를 `plan.md` 에 옮기면
    충분하다.

- **[INFO]** 이전 라운드(`08_18_51`)가 잡은 검증 깊이 비대칭(INFO#2 — 두 번째 신규 대조군이
  `findStaleSpecCasts` 단계를 생략)은 후속 커밋(`6dada6b16`)에서 실제로 고쳐졌고, docstring 의
  "위 `@Column` 대조군과 대칭" 주장이 이제 코드와 일치함을 직접 확인했다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 게이트
    417~444 — `'b.spec.ts'` fixture(게이트 436)와 `findStaleSpecCasts` 단언(게이트 441)이 이제
    첫 번째 신규 대조군(게이트 387~415)과 동일한 2단계 검증을 수행한다.
  - 상세: `git show 6dada6b16 -- codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts`
    로 대조해, 지난 라운드가 지적한 정확히 그 3줄(`b.spec.ts` fixture + `findStaleSpecCasts`
    단언)이 추가됐음을 확인했다. `RESOLUTION.md`(신규 파일, 게이트 1~60)의 서술과 실제 코드가
    일치한다 — "고쳤다" 는 주장이 검증됐다.
  - 제안: 없음 — 정확성 확인 완료로 기록.

- **[INFO]** 신규 docstring 이 인용하는 저장소 실재 관계 충돌 3건(`integration`/`trigger`/
  `user`) 중, 지난 라운드가 미확인으로 남겼던 `user`(`login_history` ↔ `audit_log`) 건을 이번에
  직접 소스 대조로 확인했다 — 정확함.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 게이트
    379~381.
  - 상세: `login-history.entity.ts:31` = `@ManyToOne(() => User, { onDelete: 'CASCADE',
    nullable: true }) user: User | null` (nullable), `audit-log.entity.ts:27` =
    `@ManyToOne(() => User) user: User` (non-null) — docstring 주장과 정확히 일치(줄 번호까지
    `requirement.md` 게이트 15 인용과 동일). 이로써 3건 모두(이전 라운드 2건 + 이번 1건) 소스
    대조 검증이 끝났다.
  - 제안: 없음 — 정확성 확인 완료로 기록.

- **[INFO]** README·API 문서·CHANGELOG·환경변수 문서 갱신은 이 diff 의 성격(내부 개발 가드
  테스트 전용 추가 + plan 체크리스트 갱신, wire/DTO/설정 변경 없음)상 불필요 — `CHANGELOG.md`
  최상단 항목들이 실제 wire-format 변경(DTO nullable 승격 등)에만 항목을 여는 것과 일관된다.
  - 위치: N/A.
  - 제안: 없음.

## 요약

이번 diff 의 실질 코드 변경(`nullable-type-lie-cast.spec.ts` 대조군 2건, `plan.md` 체크리스트
갱신)은 지난 리뷰 라운드(`08_18_51`)가 지적한 검증 깊이 비대칭을 후속 커밋(`6dada6b16`)으로
정확히 고쳤음을 직접 코드 대조로 확인했고, docstring 이 인용한 저장소 실재 충돌 3건도 전부
소스와 일치함을 확인했다(이번 라운드에서 `user` 건 추가 검증). 다만 그 과정에서 의도적으로
유예된 항목(`@OneToOne` 관계 충돌 캐너리 부재, "생기면 그때")이 이 저장소 자신의 명시적 관례
("`review/` 는 SoT 아님, 미룬 항목은 `plan/` 에 적는다")를 어기고 `review/` 안에만 남아 있다 —
이 plan 파일이 `complete/` 로 이동하면 그 유예의 유일한 기록이 사라진다. 한 줄 보강으로 닫히는
낮은 비용의 항목이라 WARNING 으로 표시했다. 그 밖에 README/API 문서/CHANGELOG/환경변수 문서
갱신은 이 diff 성격상 불필요하며, 리뷰 중 diff 밖의 파일(`nullable-type-lie-cast-guard.ts`)에
커밋되지 않은 뮤테이션이 남아 있는 것을 관측해 별도로 보고했다(이번 diff 의 결함은 아님).

## 위험도
LOW
