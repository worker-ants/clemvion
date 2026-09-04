# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 새 대조군 테스트 2건 중 하나만 파이프라인 전체(`widenedEntityFields` + `findStaleSpecCasts`)를 검증하고, 다른 하나는 `widenedEntityFields` 만 검증한다 — docstring 의 "대칭" 표현이 두 테스트 서로 간에는 완전히 대칭이 아니다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` — `it('[대조군] 관계 데코레이터끼리의 동명 충돌도 판정에서 뺀다', ...)` (게이트 387) vs `it('[대조군] `@Column` 과 관계가 섞인 충돌도 뺀다 — 종류를 구분하지 않는다', ...)` (게이트 417)
  - 상세: 게이트 372~386 의 docstring 은 "위 `@Column` 대조군과 대칭" 이라 소개한다. 바로 위 기존 `@Column`-only 대조군(게이트 344~370, `userId` 충돌)은 `widenedEntityFields().has(...)` 와 `findStaleSpecCasts(...).toHaveLength(0)` 둘 다 검증한다. 새 테스트 1(`target`, 게이트 387~416)은 동일하게 `b.spec.ts` 캐스트까지 만들어 두 단계를 다 검증하지만, 새 테스트 2(`mixed`, 게이트 417~444)는 `b.spec.ts` 픽스처가 없고 `widenedEntityFields` 단계만 검증한다. 다만 plan 파일(`plan/in-progress/entity-nullable-column-type-mismatch.md` 게이트 241~242)이 적은 뮤테이션 결과("`WIDENED_DECL` 에서 관계 데코레이터만 빼면 2건 RED")는 두 새 테스트가 `widenedEntityFields` 단에서만 갈리므로 실제로는 일관된다 — 결함이라기보다 의도된 최소 검증으로 보이지만, "대칭" 이라는 문구가 독자에게 두 테스트의 검증 깊이가 같다는 인상을 줄 수 있다.
  - 제안: 의도적 생략이면 docstring 에 "widenedEntityFields 단계만 확인하며, `findStaleSpecCasts` 대칭 검증은 위 `userId`/`target` 사례로 이미 커버된다" 정도로 한 줄 보강하거나, 테스트 2 에도 `b.spec.ts` + `findStaleSpecCasts` 단언을 추가해 실질적 대칭을 맞춘다.

- **[INFO]** 새 docstring 이 인용한 실재 충돌 3건(`integration`/`trigger`/`user`) 중 2건(`integration_oauth_state`↔`integration_usage_log` 의 `integration` 필드, `execution`↔`schedule` 의 `trigger` 필드)을 실제 엔티티 소스와 대조해 확인 — 정확함
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:379-381` (게이트)
  - 상세: `integration-oauth-state.entity.ts` 는 `@ManyToOne(() => Integration, { nullable: true })` + `integration: Integration | null`, `integration-usage-log.entity.ts` 는 `@ManyToOne(() => Integration)` (non-null) + `integration: Integration` — docstring 주장과 일치. `execution.entity.ts` 의 `trigger: Trigger | null`(nullable) vs `schedule.entity.ts` 의 `trigger: Trigger`(non-null) 도 일치. `user`(`login_history`↔`audit_log`) 는 시간 관계상 미확인이나 나머지 둘의 정확도로 볼 때 신뢰도가 높다.
  - 제안: 없음 (정보성 — 정확성 확인 완료로 기록).

## 요약

이번 diff 는 (1) `nullable-type-lie-cast.spec.ts` 에 관계 데코레이터끼리의 동명 충돌을 다루는 대조군 테스트 2건 추가, (2) `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 해당 후속 항목을 미완료→완료로 갱신하는 것이다. 새 테스트의 JSDoc 스타일 docstring 은 이 저장소의 확립된 관례(왜 필요한가·실측 수치·날짜·뮤테이션 검증 결과)를 그대로 따르고 있으며, 인용한 3건의 실재 충돌 중 2건을 소스와 대조한 결과 정확했다. plan 파일 갱신도 코드 변경(테스트 2건 추가)과 1:1로 대응하고, 취소선 보존·리뷰 라운드 인용(`리뷰 10R INFO#12`) 등 이 저장소의 편집 규약을 지켰다. README·API 문서·CHANGELOG·환경변수 문서 갱신은 이 변경의 성격(내부 테스트 전용, 공개 인터페이스·설정 없음)상 불필요하다. 유일한 지적은 두 신규 테스트 간 검증 깊이의 비대칭이 docstring 의 "대칭" 표현과 미세하게 어긋난다는 점으로, 기능적 결함이 아니라 문서 표현의 정밀도 문제다.

## 위험도
NONE
