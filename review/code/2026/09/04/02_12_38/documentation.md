# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `findStaleSpecCasts` 의 "왜 오탐이 없나" 절이 실제 판정 방식보다 넓게 주장한다 — `widened` 가 필드명 전역 집합이라 **다른 엔티티**의 동명 비-nullable 필드도 걸린다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:172-181` (docstring, "## 왜 오탐이 없나"), 근본 원인은 `:144`(`widenedEntityFields` 가 `Set<string>` — 어느 엔티티인지 정보를 버린다) 및 `:183-197`(`findStaleSpecCasts` 가 `widened.has(field)` 로만 판정, 파일이 어느 엔티티를 다루는지 무시)
  - 상세: docstring 은 "판정이 **기계적**이다. 필드가 `| null` 이면 `null` 을 넣는 데 캐스트가 필요 없다 — 걸린 자리는 예외 없이 제거 가능하고, 실제로 제거하면 `tsc` 가 그대로 통과한다" 고 단언한다. 그런데 `widenedEntityFields` 는 필드 **이름**만 모은 전역 `Set<string>` 을 돌려주고, `findStaleSpecCasts` 는 그 이름이 spec 안의 `<field>: null as unknown as` 패턴과 일치하는지만 본다 — **어느 엔티티의 필드인지는 전혀 추적하지 않는다.** 실제로 저장소를 정적으로 훑어 보면 같은 필드명이 한 엔티티에서는 `| null` 로 넓혀지고 다른 엔티티에서는 non-null 로 남아 있는 사례가 **20건** 존재한다(예: `userId`·`workflowId`·`title`·`scope`·`resourceId`·`resourceType`·`expiresAt`·`trigger`·`triggerId` 등 — `AuditLog.userId` 는 non-null 인데 `LoginHistory.userId` 는 `| null`). 만약 어떤 `.spec.ts` 가 non-null 엔티티(예: `AuditLog`)의 fixture 를 `{ userId: null as unknown as string }` 로 만든다면(그 필드가 실제로 non-null 이라 정당한 캐스트), `findStaleSpecCasts` 는 이를 "낡은 캐스트" 로 **오탐**한다 — `userId` 라는 이름이 전역 집합에 있기 때문이다. 이 오탐을 docstring 의 "예외 없이 제거 가능하고 tsc 가 통과한다" 는 말을 믿고 실제로 지우면, 그 필드는 여전히 non-null 이므로 **`tsc` 가 실패한다** — docstring 의 핵심 주장이 자기모순에 빠진다. 같은 파일의 자매 한계(`WIDENED_DECL` 의 "추가 데코레이터 1개까지만" — 리뷰 INFO#1)는 정확히 이런 형태의 한계를 이미 docstring 에 명시하는 관례를 따르는데, 이 절만 그 관례를 어기고 존재하지 않는 보장을 약속한다. 오늘 저장소에 라이브 오탐이 없는 것은(잔존 0) 우연이지, 설계가 막고 있는 게 아니다 — 이 20개 필드명 중 하나를 향후 어떤 spec 이 정당하게 `null as unknown as` 로 캐스트하는 순간 재발한다.
  - 제안: docstring 의 "왜 오탐이 없나" 절에 이 스코프 한계("판정은 필드 *이름* 단위이지 (엔티티, 필드) 쌍 단위가 아니다. 동명 필드가 다른 엔티티에서 non-null 이면 오탐 가능")를 명시하거나, 근본적으로 `widenedEntityFields` 가 파일별(엔티티별) 정보를 함께 반환하도록 바꿔 `findStaleSpecCasts` 가 spec 파일 안의 엔티티 참조와 대조하도록 스코프를 좁히는 것을 고려. 최소한 "예외 없이 제거 가능"·"기계적" 이라는 절대적 표현은 낮추고, 이 저장소가 반복해서 지키는 관례(주장은 반증 가능해야 하고, 한계는 명시해야 한다)를 여기에도 적용할 것.

## 검증된 항목 (문제 없음)

- 이전 라운드(`01_49_18`) W4 — `stripLiterals` JSDoc 이 `countCalls` 위에 잘못 얹혀 orphan 이 됐던 문제: `source-scan.ts` 를 직접 열어 확인, 현재 `stripLiterals`(57~76행)와 `countCalls`(84~89행)가 각자 자신의 JSDoc 을 정확히 갖고 있다. 수정이 실제로 반영됨.
- 이전 라운드 W1(`sort()` 커버리지 반증) — `source-scan.spec.ts` 픽스처에 `nested-sibling.ts` 가 추가돼 정렬 분기가 실제로 관측 가능함을 코드로 확인. docstring 도 초판의 틀린 판단을 취소선 없이 정정문("초판은 … 틀렸다")으로 남겨 이력이 보존됨.
- 이전 라운드 W2(`stripLiterals` 무테스트) — `describe('stripLiterals', …)` 전용 스위트 7건(따옴표 보존·템플릿 멀티라인·이스케이프 조기종료 안 함·리터럴 밖 불변·다중 리터럴·알려진 한계 고정)이 실제로 존재.
- `WIDENED_DECL` 의 "추가 데코레이터 1개까지만" 한계(INFO#1)는 docstring(`nullable-type-lie-cast-guard.ts:134-139`)에 정확히 반영돼 있고, 실측("저장소 전수에 그런 조합은 없다") 문구도 근거로 남아 있음.
- `masked-reject-callers-guard.ts`/`redis-fail-open-catalog-guard.ts`/`audit-action-binding-guard.ts`/`engine-error-code-anchor-guard.ts` 의 walker 함수 docstring 은 `collectTsFiles` 위임 이후에도 여전히 정확함(빈 `.spec.ts`·`.d.ts` 제외 등 서술이 실제 동작과 어긋나지 않음). `.d.ts`·`node_modules`/`dist` 필터가 일부 소비처에 새로 조용히 적용된 변화는 이미 `source-scan.ts`(축별 실측 표)와 plan 문서 양쪽에 명시적으로 문서화돼 있어 추가 조치 불필요.
- `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 완료 체크박스 서술("가드가 자기 spec 을 잡았다", "탐지 능력을 뮤테이션으로 실증했다", 5-way 파일 집합 동등성 507/818/1261/818/818)은 실제 코드·구조와 일치함. README·CHANGELOG 는 이 diff 범위(내부 테스트/가드 인프라)에서 갱신 대상이 아님 — 프로젝트 관례상 plan 문서가 그 역할을 대신함.
- `review/code/2026/09/04/01_48_39/`·`01_49_18/` 하위에 커밋된 이전 리뷰 세션 산출물(`meta.json`·`_retry_state.json`·`SUMMARY.md`·`RESOLUTION.md` 등)은 이 프로젝트 관례상 `review/` 가 gitignore 대상이 아니라 정상적으로 추적되는 산출물이며, 문서화 관점에서 별도 조치가 필요한 결함이 없음.

## 요약

이번 diff 는 문서화 규율이 전반적으로 높다 — 신규 공개 함수(`collectTsFiles`·`stripLiterals`·`widenedEntityFields`·`findStaleSpecCasts`)마다 "왜 필요한가/한계/오탐 여부" 절을 갖춘 JSDoc 을 달았고, 이전 리뷰 라운드에서 지적된 W1(반증된 "원리적으로 불가능" 주장)·W2(비대칭 테스트 커버리지)·W4(orphan JSDoc)가 실제로 정정·수정된 것을 코드에서 직접 확인했다. 다만 신규 "왜 오탐이 없나" 절 하나는 구현이 실제로 보장하는 것보다 강한 주장을 하고 있다 — `widenedEntityFields` 가 필드명을 엔티티 단위로 스코프하지 않아 20개의 실측된 동명 충돌 필드가 향후 정당한 캐스트를 오탐으로 잡을 수 있는데도 "예외 없이 제거 가능" 이라 못박고 있다. 이 PR 이 스스로 반복해서 강조하는 원칙(설계 근거는 실측/반증 가능해야 하고, 한계는 이웃 함수들처럼 명시해야 한다)을 이 한 곳만 벗어난 셈이다.

## 위험도
LOW
