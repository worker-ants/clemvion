# 유지보수성(Maintainability) 리뷰

## 검증 방법

이 changeset 은 이미 8라운드(`01_49_18`~`04_18_01`) 리뷰-수정 루프를 거쳤고, 직전 라운드(8R,
`04_18_01/RESOLUTION.md`)는 "추가 라운드 없이 종결 가능"을 명시적으로 판단했다. 그 판단을
그대로 받지 않고, 실제 코드 파일 9개(`source-scan.ts`/`.spec.ts`, `audit-action-binding-guard.ts`,
`engine-error-code-anchor-guard.ts`, `masked-reject-callers-guard.ts`/`.spec.ts`,
`nullable-type-lie-cast-guard.ts`/`.spec.ts`, `redis-fail-open-catalog-guard.ts`)를 `Read`로
직접 열어 HEAD 상태를 확인했다(`git diff origin/main --stat`로 diff 대상 10개 파일이 프롬프트의
파일 1~10과 정확히 일치함을 먼저 확인). 저장소는 읽기만 했고 아무것도 쓰지 않았다.

구체적으로 다음을 직접 대조했다:

- **7R WARNING**(`masked-reject-callers.spec.ts` 상단 JSDoc orphan) — 현재 파일을 열어 "이 가드는
  `.spec.ts` 도 봐야 한다" JSDoc(11~24줄)이 자기 `describe('스캔 대상에 \`.spec.ts\` 가 포함된다', …)`
  바로 위에, "Manual 실행 경로가…" JSDoc 이 자기 `describe('resolveTriggerParameters 직접 호출부
  허용목록', …)` 바로 위에 각각 정확히 붙어 있음을 확인 — **정상 반영됨**.
- **8R WARNING**(`findUntypedNullableColumns` 가 `widenedEntityFields` 와 다른 판정 함수를 쓰던
  비대칭) — 현재 `nullable-type-lie-cast-guard.ts:113`에서 `findUntypedNullableColumns` 도
  `isNullableType(tsType)` 을 쓰고 있음을 확인. `isNullableType` docstring(180~183줄)이 소비처가
  둘임을 명시하고, `.spec.ts` 의 `it.each` 대칭 캐너리(공백 없음/순서 반대/표준 표기, 두 함수 각각)도
  존재함을 확인 — **정상 반영됨**.
- `collectSourceFiles`/`listSourceFiles`/`listProductionSources`/`collectScanTargets` 4개
  가드의 `import`문에서 미사용 `fs` 가 실제로 제거됐는지(`audit-action-binding-guard.ts`) /
  여전히 쓰이는 파일(`fs` 사용 카운트 > 0)에서는 남아 있는지를 grep 으로 대조 — 불일치 없음.

## 발견사항

새로 발견한 CRITICAL/WARNING 은 없다. 아래 두 항목은 **round 2(`02_12_38`)/round 3(`02_57_22`)
부터 반복 확인되고 있는 기존 INFO의 재확인**이며, 코드에서 여전히 유효함을 이번에도 직접
대조했다. 새 유예 결정이 필요한 변화는 없다.

- **[INFO]** `WIDENED_DECL` 상수명이 실제 매칭 범위보다 좁게 읽힌다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:168-169`
    (선언), 필터링은 `:199`(`widenedEntityFields` 내부 `isNullableType(tsType) ? widened : nonNull`)
  - 상세: 정규식 자체는 `@Column`/`@ManyToOne`/`@OneToOne` 이 붙은 **모든** 필드 선언(nullable 여부
    무관)에 매치한다. "widened"라는 이름만 보면 이미 nullable 필터링이 끝난 결과를 매치하는
    것으로 오인하기 쉽다 — 실제 필터링은 호출부 루프 안에서 `isNullableType` 으로 별도 수행된다.
    8R 에서 `isNullableType` 을 두 함수(`widenedEntityFields`/`findUntypedNullableColumns`)의
    공유 판정으로 승격하며 소비처가 둘임을 docstring 에 명시했지만, `WIDENED_DECL` 이름 자체의
    "필터링 전"이라는 성격은 여전히 문서화돼 있지 않다.
  - 제안: 조치 불필요(반복 유예). 이 상수를 다음에 만질 때 `COLUMN_OR_RELATION_DECL` 류 이름으로
    바꾸거나, 선언 바로 위에 "이 정규식 자체는 nullable 여부를 가리지 않는다" 한 줄을 추가.

- **[INFO]** `collectTsFiles` 를 그대로 위임하는 1줄 래퍼 함수가 4개의 서로 다른 이름
  (`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)으로
  남아 있고, `engine-error-code-anchor-guard.ts` 한 곳은 래퍼 없이 `collectTsFiles` 를 직접
  호출한다
  - 위치: `audit-action-binding-guard.ts:47-48`, `masked-reject-callers-guard.ts:48,51`,
    `nullable-type-lie-cast-guard.ts:38-40`, `redis-fail-open-catalog-guard.ts:93-94`,
    `engine-error-code-anchor-guard.ts:157`(직접 호출)
  - 상세: walker **로직**의 중복(재귀 `readdirSync`)은 `collectTsFiles` 하나로 완전히 제거됐다.
    남은 것은 순수 명명 비일관성뿐이다 — 지금은 4개 이름 전부 `collectTsFiles` 의 동의어인데,
    다음 독자는 이름이 다르니 로직도 다르다고 오인할 수 있다(리팩터 전에는 실제로 미묘하게
    달랐다). 각 가드의 spec 이 이미 그 이름을 참조하므로 이번 diff 범위에서 통일하지 않은 것은
    합리적 판단이고, 각 함수가 한 줄이라 실질 위험은 낮다.
  - 제안: 조치 불필요(반복 유예, 5R 부터 "다음에 그 파일들을 개별적으로 만질 때 정리"로 명시적
    유예). 지금 통일하면 5개 가드의 공개 표면을 동시에 바꾸는 별건이 된다.

## 확인된 정상 항목 (이번 라운드 재검증)

- `source-scan.ts`/`nullable-type-lie-cast-guard.ts`/`nullable-type-lie-cast.spec.ts` 신규
  공개 함수(`collectTsFiles`·`stripLiterals`·`widenedEntityFields`·`findStaleSpecCasts`·
  `isNullableType`)마다 "왜 필요한가"·"왜 오탐이 없는가"·"한계" 절을 갖춘 JSDoc 이 일관되게
  달려 있다. 함수 길이는 전부 20줄 내외 이하, 중첩은 최대 2~3단으로 관리 가능한 수준이고
  순환 복잡도가 높은 함수는 없다.
- 4개 소비 가드 파일의 `import` 정리(불필요해진 `fs` 제거·필요해진 `collectTsFiles` 추가)가
  실제 사용 여부와 정확히 일치함을 grep 으로 재확인(미사용 import 없음).
- `withFiles`/`withFixture`(1R W3) 중복 제거, `stripLiterals` 전용 테스트 7건(1R W2),
  `collectTsFiles` 정렬 분기의 `nested-sibling.ts` 픽스처(1R W1 반증 이후 보강)가 모두 현재
  코드에 그대로 남아 있음을 확인.

## 요약

새 리뷰 라운드에서도 CRITICAL/WARNING 급 유지보수성 결함은 발견되지 않았다. 직전 두 라운드가
발견·수정한 항목(7R: `masked-reject-callers.spec.ts` JSDoc orphan, 8R: `findUntypedNullableColumns`
판정 함수 비대칭)이 현재 코드에 정확히 반영돼 있음을 코드에서 직접 확인했다. 남은 것은 2R/3R
부터 반복 확인·유예돼 온 INFO 2건(`WIDENED_DECL` 이름이 매칭 범위보다 좁게 읽힘, 1줄 래퍼 함수
4개의 이름 비일관)뿐이며 둘 다 이번에도 유효하지만 조치가 필요한 급은 아니다. 함수 단위가
짧고 단일 책임을 유지하며, 신규 공개 함수마다 "왜/한계/오탐 여부" 절을 갖춘 JSDoc 관례가
일관되게 지켜지고 있어 이 changeset 은 유지보수성 관점에서 수렴 상태로 판단한다.

## 위험도

LOW
