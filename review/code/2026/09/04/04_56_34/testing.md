# 테스트(Testing) 리뷰

## 컨텍스트

이 changeset 은 이미 9라운드 리뷰-수정 루프(`review/code/2026/09/04/01_48_39` ~ `04_37_28`)를
거쳤다. 직전 라운드(9R, 커밋 `34ce41086`)는 `저장소 전수` describe 블록의 이중 스캔을
`collectTsFiles(SRC_ROOT, { includeSpec: true })` 1회 호출 + `.filter()` 파생으로 바꿨다.
이번 라운드는 그 위에서 핵심 파일(`source-scan.ts`/`.spec.ts`,
`nullable-type-lie-cast-guard.ts`/`.spec.ts`, 4개 walker 소비 가드)을 직접 열어
독립적으로 재확인하고, 8R·9R 이 유예한 INFO 항목의 상태를 재검증했다.

## 발견사항

- **[INFO]** `widenedEntityFields` 의 "동명 충돌 제거" 가 `@ManyToOne`/`@OneToOne` 관계 필드끼리의 충돌에 대해서는 전용 fixture 로 고정돼 있지 않다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:192-205`(`widenedEntityFields` 본문, 특히 203 `for (const f of nonNull) widened.delete(f);`), 대조 테스트는 `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:344-370`(`[대조군] 다른 엔티티에서 non-null 인 동명 필드는 판정에서 뺀다`)
  - 상세: `WIDENED_DECL` 은 `@Column`·`@ManyToOne`·`@OneToOne` 세 데코레이터를 한 정규식 alternation 으로 묶어 같은 `widened`/`nonNull` Set 에 필드 이름만으로 합류시킨다(`nullable-type-lie-cast-guard.ts:168-169`, `192-201`). 그런데 충돌-배제를 직접 단언하는 유일한 대조군 테스트(`:344-370`)는 **양쪽 다 `@Column`** 인 `userId` fixture 만 쓴다. 관계 필드끼리(혹은 관계 vs 컬럼) 동명 충돌이 실제로 저장소에 존재하는지 확인해 봤다 — 저장소 라이브 엔티티를 읽기 전용으로 스캔한 결과(저장소 파일은 전혀 쓰지 않음) `user`·`trigger`·`integration` 세 개의 `@ManyToOne`/`@OneToOne` 필드명이 한 엔티티에서는 nullable, 다른 엔티티에서는 non-null 로 **실재**한다. `widenedEntityFields` 의 배제 로직 자체는 데코레이터 종류를 구분하지 않고 이름만 보므로 이 경우도 구조적으로 같은 코드 경로를 타 정상 배제될 것으로 보이지만(정적 판단), 그 사실을 직접 확인하는 fixture 는 없다 — 있는 대조군은 전부 `@Column` 조합뿐이다. `저장소 전수` 블록(`:439-444`, `낡은 캐스트가 남아 있지 않다`)이 오늘 통과한다는 사실이 간접 증거이긴 하지만, 그 통과는 "관계 충돌 필드를 겨눈 spec 캐스트가 현재 0건" 이라는 우연에도 의존한다 — `WIDENED_DECL`(INFO#1, 위음성)·quoted-key(9R 이전 라운드 INFO)와 같은 급의, 아직 캐너리로 고정되지 않은 경계다.
  - 제안: `[대조군]` 테스트에 관계 데코레이터 버전(예: `@ManyToOne(() => X, { nullable: true }) foo: X | null;` vs 다른 엔티티의 `@ManyToOne(() => Y) foo: Y;`)을 `it.each` 로 하나 추가하거나, 최소한 `widenedEntityFields` docstring 의 "이름 충돌" 절에 "이 배제는 `@Column`/관계 데코레이터를 구분하지 않는다"를 한 줄 명시한다. 급하지 않음 — 오늘 저장소에서 이 경계가 발현하지 않았다(관계 충돌 3건 모두 spec 에 낡은 캐스트가 없음, `저장소 전수` 블록 GREEN).

## 회귀 확인 (새 발견 아님 — 상태 재검증)

- 9R 이 유예한 두 INFO(`04_37_28` testing.md — quoted-key 위음성 · 멀티라인 캐스트 미검증)는 이번 라운드에도 코드·테스트 양쪽에 변경이 없어 **그대로 열려 있다**. 9R 커밋 메시지가 "INFO 조치 없음 #12·#13" 으로 명시적으로 유예했으므로 회귀가 아니라 확인된 현상 유지다.
- 9R 의 이중 스캔 제거(`entities`/`specs` 를 `collectTsFiles(SRC_ROOT, { includeSpec: true })` 1회 호출에서 `.filter()` 로 파생)는 순수 리팩터라 별도 신규 테스트가 필요하지 않다 — 기존 "[전제] 엔티티·spec 대상이 비어 있지 않다"(`:430-433`)와 "낡은 캐스트가 남아 있지 않다"(`:439-444`)가 그대로 회귀 안전망 역할을 한다. `entities`/`specs` 파생 결과가 리팩터 전후 동일함(41/443)을 커밋 메시지가 실측으로 남겼고, 직접 읽어 본 코드도 `.entity.ts`/`.spec.ts` 확장자가 상호 배타적이라 필터 순서를 바꿔도 결과가 갈릴 수 없는 구조임을 확인했다.
- 4개 walker 소비 가드(`audit-action-binding-guard.ts`/`engine-error-code-anchor-guard.ts`/`masked-reject-callers-guard.ts`/`redis-fail-open-catalog-guard.ts`)의 소비 spec(`audit-action-binding.spec.ts` 등)은 이번 라운드에서도 변경이 없고, `collectTsFiles` 위임으로 바뀐 이후에도 각 가드의 기존 저장소-전수 단언이 그대로 GREEN 이라는 사실 자체가 walker 통합의 회귀 테스트 역할을 한다.

## 강점 (참고용, 조치 불필요)

- **Mock 없음, 실제 fs + tmpdir**: 모든 신규 로직(`collectTsFiles`/`widenedEntityFields`/`findStaleSpecCasts`)이 순수 함수 + 실제 파일시스템 픽스처로 테스트된다. `node:fs` non-configurable 프로퍼티 때문에 spy 를 포기한 이력이 주석에 남아 있어, mock-실제 동작 괴리 위험이 구조적으로 낮다.
- **테스트 격리**: `withFiles`(단일 파일은 `withFixture` 얇은 래퍼)가 `mkdtempSync`/`try-finally rmSync` 로 모든 픽스처를 격리한다. `collectTsFiles` 테스트도 `beforeEach`/`afterEach` 로 독립 tmpdir 을 쓴다.
- **엣지 케이스 매트릭스**: `| null` 표기 변형(공백 없음·순서 반대·표준)을 `widenedEntityFields`·`findUntypedNullableColumns` 양쪽에 대칭 `it.each` 로, `stripLiterals`/`stripComments` 는 이스케이프·다중 리터럴·알려진 한계(중첩 백틱)까지 고정한다.
- **Vacuous-test 방지**: `[전제]` 테스트(스캔 대상 비어있지 않음·허용목록에 `.spec.ts` 실재·넓혀진 필드 실재)가 이 저장소가 반복 겪은 "GREEN 이 증거가 아니다" 실패 모드를 명시적으로 차단한다.
- **뮤테이션 검증 이력**: `sort()` 제거·`includeSpec` 옵션 제거·동명 충돌 배제 로직 제거를 각각 뮤테이션해 RED 를 실측(9라운드 RESOLUTION 기록)한 흔적이 코드 주석·plan 문서에 남아 있어, "이 테스트가 실제로 그 결함을 잡는가"가 사후 검증돼 있다.

## 요약

핵심 신규 로직은 이미 9라운드에 걸쳐 정상 경로·표기 변형·이름 충돌(Column 축)·주석/리터럴
오탐 방지까지 촘촘한 `it.each`/대조군 테스트와 실제 뮤테이션 검증을 축적했다. 이번 라운드에서
코드를 직접 열어 독립 재확인한 결과 새로운 Critical/Warning 급 커버리지 갭은 찾지 못했다.
유일하게 새로 발견한 것은 `widenedEntityFields` 의 동명-충돌 배제 로직이 `@Column` 조합으로만
직접 검증돼 있고 `@ManyToOne`/`@OneToOne` 관계 필드끼리의 충돌(저장소에 `user`·`trigger`·
`integration` 3건 실재, 함수 구조상 정상 배제될 것으로 보이나 전용 fixture 없음)은 캐너리로
고정돼 있지 않다는 점이다 — `WIDENED_DECL` 데코레이터-1개 한계·quoted-key 위음성과 같은 급의,
아직 미고정 경계다. 9R 이 명시적으로 유예한 두 INFO(quoted-key·멀티라인 캐스트)는 이번
라운드에도 변경 없이 열려 있음을 재확인했다(회귀 아님, 유지된 유예).

## 위험도

LOW
