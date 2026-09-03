# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 3중 반복되는 "대조군(collision canary)" 테스트 골격 — `it.each` 로 묶지 않고 개별 `it()` 로 계속 늘어난다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:344`(`[대조군] 다른 엔티티에서 non-null 인 동명 필드는 판정에서 뺀다`, 기존) · `:387`(`[대조군] 관계 데코레이터끼리의 동명 충돌도 판정에서 뺀다`, 신규) · `:417`(`` [대조군] `@Column` 과 관계가 섞인 충돌도 뺀다 ``, 신규)
  - 상세: 세 테스트가 "엔티티 A(nullable 필드) + 엔티티 B(같은 이름, non-null) + B 를 겨눈 `null as unknown as` 캐스트 fixture → `widenedEntityFields` 로 제외 확인 → `findStaleSpecCasts` 로 0건 확인" 골격을 그대로 반복한다(구조 동일, 데코레이터 조합만 `@Column`/`@ManyToOne`/`@Column`+`@ManyToOne` 혼합으로 다름). 파일 상단 docstring(게이트 43~54)이 스스로 지적하는 "walker 5사본 중복" 문제와 동일한 성격의 반복이 이번엔 fixture 레벨에서 생기고 있다. 다만 각 테스트의 fixture 문자열이 서로 달라 파라미터화하면 테스트 이름·변수가 부자연스러워질 소지가 있고, RESOLUTION(`review/code/2026/09/04/08_18_51/RESOLUTION.md` #3)에서 이미 "구조가 달라 `it.each` 보다 개별 `it()` 이 낫다" 로 판단된 사안이다.
  - 제안: 조치 불요(이미 직전 라운드에서 검토·기각됨). 동일 3-변형(Column/관계/혼합) 골격이 네 번째로 반복되면 그때 공용 헬퍼(예: `expectExcludedFromWidened(entityA, entityB, castField)`)로 추출을 재검토.

- **[INFO]** 새 대조군 2건을 아우르는 docstring 이 두 테스트 중 첫 번째 바로 위에만 있어, 어느 테스트까지 그 설명이 적용되는지 시각적으로 모호할 수 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:372-386`(docstring) → `:387`(target 테스트) · `:417`(mixed 테스트, docstring 없이 바로 시작)
  - 상세: docstring 은 "관계 데코레이터끼리의 충돌" 과 "위 `@Column` 대조군과 대칭" 을 함께 설명하며 사실상 아래 두 `it()` 모두를 위한 도입부인데, 형태상 첫 번째 `it()` 바로 위에 붙어 있어 두 번째 `it()`(게이트 417)는 제목 문자열(`` `@Column` 과 관계가 섞인 충돌도 뺀다 — 종류를 구분하지 않는다 ``)만으로 맥락을 전달해야 한다. 다만 실제 검증 깊이는 두 테스트 모두 `widenedEntityFields` + `findStaleSpecCasts` 를 동일하게 수행하고 있어(직전 리뷰 라운드 INFO#2 지적 사항이 이미 반영된 상태 — 게이트 439~441 에서 확인), 이 항목은 순수 가독성 관찰이며 기능적 결함은 아니다.
  - 제안: 조치 불요. 필요하면 두 번째 `it()` 제목 자체가 이미 "종류를 구분하지 않는다" 로 자기 설명적이라 추가 주석 없이도 무방하다.

## 요약

이번 diff 의 실질 코드 변경은 `nullable-type-lie-cast.spec.ts` 에 대조군 테스트 2건을 추가하고 `plan/in-progress/entity-nullable-column-type-mismatch.md` 체크박스·서술을 갱신한 것뿐이다. 신규 테스트는 파일에 이미 확립된 `withFiles` tmpdir 픽스처, `[대조군]` 네이밍 접두, JSDoc 스타일 docstring(왜 필요한가·실측 수치·날짜·뮤테이션 검증) 관례를 정확히 따르고 있어 일관성 면에서 문제가 없다. 직전 리뷰 라운드(`08_18_51`)가 지적했던 두 테스트 간 검증 깊이 비대칭(INFO#2, `findStaleSpecCasts` 생략)은 이번 diff 에 반영된 코드에서 **이미 해소**되어 있음을 직접 확인했다(게이트 439~441). 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 등 전통적 위험 신호는 없으며, 유일하게 남는 것은 3번째로 반복되는 fixture 골격(대조군 테스트 3개가 동일 구조)이라는 낮은 수준의 중복인데, 이는 직전 라운드에서 이미 검토되어 "구조가 서로 달라 개별 `it()` 이 합리적" 이라 판단된 사안이라 별도 조치가 필요하지 않다. `plan/in-progress/entity-nullable-column-type-mismatch.md` 변경은 순수 문서 갱신으로 코드 유지보수성과 무관하며, `review/code/2026/09/04/08_18_51/` 하위 신규 파일들(RESOLUTION.md·SUMMARY.md·`_retry_state.json`·개별 reviewer 산출물·`meta.json`)은 이전 리뷰 라운드가 생성한 프로세스 산출물(보고서·상태 JSON)로, 함수·로직을 담고 있지 않아 가독성/네이밍/함수 길이 등 본 관점의 대상이 아니다. 전체적으로 유지보수성 리스크는 낮다.

## 위험도
LOW
