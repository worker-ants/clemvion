# 테스트(Testing) 리뷰 — entity-nullable-column-type-mismatch 배치 3 후속 (관계 데코레이터 캐너리)

## 검증 절차 메모

- `codebase/backend`에서 `npx jest src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 실행 → **31/31 GREEN** (변경 전 상태 확인).
- 뮤테이션 검증(`widenedEntityFields`의 동명 충돌 배제 루프 제거)을 스크래치 백업 후 시도하던 중, **다른 병렬 리뷰어가 같은 파일(`nullable-type-lie-cast-guard.ts`)을 동시에 편집해 내 뮤테이션이 그들의 편집으로 덮어써지는 것을 `git diff`로 직접 관측했다**(그들의 변경은 `WIDENED_DECL`을 `@(?:Column)`만 남기는 다른 뮤테이션이었다). 오염된 상태에서 나온 jest 실패 3건은 내 가설 검증에 쓸 수 없는 값이라 폐기했다. 즉시 스크래치 백업(`cp`, 뮤테이션 전 md5 `4d05d6f1…`와 동일 확인)으로 원복했고, 이후 `git status --short`/`git diff`가 모두 clean함을 확인했다. **결과적으로 plan이 주장하는 "충돌 배제 제거 시 3건 RED / 관계 데코레이터만 WIDENED_DECL에서 빼면 2건 RED"는 이번 리뷰에서 독립적으로 재검증하지 못했다** — collision으로 중단됐을 뿐이지 그 주장을 반증한 것은 아니다.
- `git status --short` 최종 확인: repo는 이 리뷰가 만든 산출물(`review/code/2026/09/04/08_18_51/`) 외에는 clean.

## 발견사항

- **[INFO]** 새 대조군 2건이 전부 `@ManyToOne`만 쓰고, `WIDENED_DECL`이 함께 잡는다고 주석에 명시한 `@OneToOne`은 이 spec 파일 전체(기존 테스트 포함)에서 단 한 번도 등장하지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:373-376`(새로 추가된 docstring, "관계 데코레이터끼리의 충돌 — 위 `@Column` 대조군과 대칭" 절이 `@ManyToOne`·`@OneToOne`을 모두 언급), 새 테스트는 `:387`·`:417`
  - 상세: 가드 구현(`nullable-type-lie-cast-guard.ts:168-169`)의 `WIDENED_DECL` 정규식은 `@(?:Column|ManyToOne|OneToOne)`로 세 데코레이터를 동등하게 매칭하고, 이번에 추가된 docstring도 "`@Column`·`@ManyToOne`·`@OneToOne`을 모두 잡는다"고 명시적으로 주장한다. 그런데 실제 테스트는 두 신규 케이스 모두 `@ManyToOne`만 쓰고, 파일 전체를 훑어도 `@OneToOne`을 쓰는 fixture가 없다(`grep -n OneToOne` 결과 docstring 언급 2곳뿐). 정규식 알터네이션의 세 번째 분기가 이 diff가 새로 주장하는 "관계 종류를 구분하지 않는다"는 명제에 대해 전혀 검증되지 않은 채로 남는다.
  - 제안: 두 신규 대조군 중 하나(또는 `it.each`로 확장)를 `@OneToOne`으로 바꿔 세 데코레이터 알터네이션이 실제로 모두 발화함을 확인한다. 비용이 낮고(픽스처 문자열 한 줄 교체) 이 diff가 스스로 세운 주장(대칭성)을 실제로 닫는다.

- **[INFO]** 두 번째 신규 대조군(`@Column`과 관계가 섞인 충돌)은 첫 번째 대조군·기존 `@Column`-only 대조군과 달리 `findStaleSpecCasts`까지 검증하지 않고 `widenedEntityFields(...).has('mixed')`만 단언한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:417-444`
  - 상세: 비교 대상인 `:387-415`("관계 데코레이터끼리의 동명 충돌")와 기존 `:344-370`("다른 엔티티에서 non-null 인 동명 필드")은 둘 다 `b.spec.ts` fixture를 만들어 `widenedEntityFields` → `findStaleSpecCasts` 두 함수를 연쇄로 검증한다. 이번 신규 케이스만 `.spec.ts` fixture 생성과 `findStaleSpecCasts` 호출이 빠져 있다. `findStaleSpecCasts`가 `widened.has(field)`로 순수 파생되는 구조(`nullable-type-lie-cast-guard.ts:236-250`)라 실질적 위험은 낮지만("종류를 구분하지 않는다"는 제목의 실제 소비 지점은 `findStaleSpecCasts`이므로), end-to-end 확인이 빠진 것은 형제 테스트들과의 비대칭이다.
  - 제안: 형제 테스트와 동일하게 `b.spec.ts`(`mixed: null as unknown as string`) fixture를 추가하고 `findStaleSpecCasts([...], w)`가 0건임을 마저 단언하면 세 대조군의 검증 깊이가 맞춰진다.

- **[INFO]** 뮤테이션 검증 시도가 병렬 리뷰어의 동시 편집과 충돌해 완주하지 못함 (본문 "검증 절차 메모" 참고).
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (해당 파일은 이 diff의 리뷰 대상은 아니고, 신규 테스트가 소비하는 형제 파일)
  - 상세: 결함이 아니라 리뷰 인프라 관측 사항이다. plan(`entity-nullable-column-type-mismatch.md:241-243`)이 적은 "뮤테이션이 두 축을 정확히 가른다(3건 RED / 2건 RED)" 주장은 이번 세션에서 독립 재현하지 못했다 — 반증도 아니고 확인도 아닌 상태로 남는다.
  - 제안: 없음(정보 공유 목적). 후속 세션에서 다시 검증하려면 병렬 fan-out이 끝난 뒤 단독으로 돌리는 것이 안전하다.

## 요약

이번 diff는 이전 리뷰(10R INFO#12)가 지적한 "관계 데코레이터끼리의 동명 충돌에 캐너리가 없다"는 갭을 메우는 순수 테스트 추가다. `withFiles` tmpdir 픽스처로 완전히 격리되어 있고, 이름은 `[대조군]` 접두사로 의도(정상 동작을 고정하는 캐너리이지 버그 수정이 아님)를 명확히 표현하며, 기존 31개 테스트는 변경 후에도 모두 GREEN이다(로컬 재실행 확인). 다만 신규 docstring이 명시적으로 주장하는 "`@Column`·`@ManyToOne`·`@OneToOne`을 구분하지 않는다"는 명제 중 `@OneToOne` 분기는 두 신규 테스트 모두 `@ManyToOne`만 사용해 실제로는 검증되지 않았고, 두 번째 신규 테스트는 형제 테스트 대비 `findStaleSpecCasts`까지의 end-to-end 검증이 한 단계 짧다 — 둘 다 정정 비용이 낮은 INFO 수준 갭이다. plan 문서(`entity-nullable-column-type-mismatch.md`)의 체크박스·서술은 실제 diff 내용(테스트 2건 추가)과 일치한다.

## 위험도

LOW
