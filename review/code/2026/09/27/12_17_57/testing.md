# 테스트(Testing) 리뷰 — folders-contract-e2e (2R, `omitUndefined` 헬퍼 추출 이후)

이번 라운드의 실질 diff 는 1R(`review/code/2026/09/27/11_53_51`) W1 처분으로 추가된 `omitUndefined` 공용 헬퍼(`codebase/backend/src/common/utils/omit-undefined.ts` + `.spec.ts`)와, 트리거·폴더 두 `update()`가 그 헬퍼를 호출하도록 바뀐 부분이다. 나머지 파일 대다수(`review/code/2026/09/27/11_53_51/**`, `review/consistency/2026/09/27/10_39_26/**`)는 이전 라운드의 리뷰 산출물이 커밋된 것이라 테스트 관점에서 별도로 볼 코드가 없다.

## 발견사항

- **[INFO]** `omit-undefined.spec.ts` 에 "빈 객체 입력" 캐너리가 없다 — 헬퍼 자체 스펙이 아니라 소비자 테스트에 의존
  - 위치: `codebase/backend/src/common/utils/omit-undefined.spec.ts` (describe 블록 전체, 4개 `it()` 중 `{}` 입력 케이스 없음)
  - 상세: `omitUndefined({})` → `{}` (no-op)이라는 경계는 이 헬퍼 자신의 스펙에는 없고, 소비자 쪽 `folders.service.spec.ts` 의 "빈 본문이면 로드한 값을 그대로 저장한다" 테스트가 간접적으로만 이 경로를 지난다. 헬퍼가 이제 `folders`·`triggers` 두 모듈이 공유하는 유틸이 된 만큼, 이 자명해 보이는 경계(빈 입력 → 빈 출력, 그리고 모든 키가 `undefined`인 입력 → `{}`)를 헬퍼 자체 스펙에서 직접 단언해 두면 향후 세 번째 소비자가 붙을 때도 소비자 테스트 없이 헬퍼만으로 신뢰할 수 있다.
  - 제안: `omit-undefined.spec.ts` 에 `expect(omitUndefined({})).toStrictEqual({})` 와 `expect(omitUndefined({ a: undefined, b: undefined })).toStrictEqual({})` 캐너리 2개 추가. 차단 사유는 아니다.

- **[INFO]** `omitUndefined<T extends object>` 의 타입 제약이 배열을 허용하지만 구현은 배열을 일반 객체로 붕괴시킨다 — 테스트에 없음
  - 위치: `codebase/backend/src/common/utils/omit-undefined.ts:12` (`export function omitUndefined<T extends object>(obj: T): Partial<T>`)
  - 상세: 배열도 `object` 이므로 타입 체커는 `omitUndefined([1, undefined, 3])` 호출을 막지 않는다. 하지만 구현은 `Object.entries` → `Object.fromEntries` 라 결과가 `{ '0': 1, '2': 3 }` 형태의 일반 객체가 되어 배열성(길이·`Array.isArray`)을 잃는다 — JSDoc 이 말하는 "얕은 사본"과 실제 반환 형태가 배열 입력에서는 어긋난다. 지금 두 호출부(`folders`·`triggers` 의 PATCH 부분 본문)는 항상 평범한 DTO 객체만 넘기므로 실제로 이 경로를 타지 않지만, 공용 유틸로 승격된 이상 다음 소비자가 배열을 넘기면 조용히 틀린 값을 돌려줄 수 있다.
  - 제안: 제약을 `T extends Record<string, unknown>` 처럼 배열을 배제하는 타입으로 좁히거나, 이 사용처가 "PATCH 부분 본문"으로 국한됨을 JSDoc 에 명시하고 배열 미지원을 캐너리 하나(`expect(() => …).not.toThrow()` 가 아니라 "배열이면 결과가 배열이 아니다"를 보여주는 경계 테스트)로 문서화. 차단 사유는 아니다.

- **[INFO]** 새 헬퍼의 두 소비자(`folders`·`triggers`) 중 `triggers.service.ts` 쪽엔 이번 diff 로 새로 추가된 회귀 테스트가 없다 — 기존 테스트가 대신 지킨다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:615-622` (로컬 필터 → `omitUndefined(rest)` 치환)
  - 상세: 순수 리팩터(동작 동일한 호출부 교체)라 새 테스트가 필수는 아니다. plan 의 뮤턴트 표(H4: "트리거가 헬퍼를 거치지 않음")가 기존 트리거 단위 테스트("PATCH 에서 생략된 필드는 로드된 값을 유지한다")로 KILLED 됨을 실측했다고 기록해, 이 회귀 그물이 실제로 작동함을 확인했다는 점은 견고하다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** 폴더 단위 테스트의 `mockRepository.save` 는 TypeORM 이 저장 후 nullable 컬럼의 `undefined` 를 `null` 로 채우는 실제 동작(JSDoc·plan 이 언급하는 "거짓 null" 메커니즘)을 재현하지 않는다
  - 위치: `codebase/backend/src/modules/folders/folders.service.spec.ts:22-24` (`save: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'new-id', ...data }))`)
  - 상세: 이 mock 은 입력을 그대로 스프레드할 뿐이라, "옛 코드에서 하위 폴더 PATCH 응답에 `parentId: null` 이 거짓으로 실렸다"는 증상은 **단위 계층에서는 재현되지 않는다** — 실제로 이 증상은 e2e(C·E)로만 잡힌다는 점이 plan 에도 명시돼 있다. Mock 이 실동작(TypeORM 특이 동작)과 의도적으로 괴리돼 있고 그 괴리를 e2e 가 메운다는 계층 분리가 문서화돼 있어 새로운 결함은 아니다.
  - 제안: 조치 불요 — 이미 알려진 의도적 스코프 경계(1R testing 리뷰가 동일 지점을 지적했고 문서화된 계층 분리로 수렴).

## 회귀 테스트 유효성 확인

1R 에서 `toBeDefined()` → `expect(result.parentId).toBeNull()`(INFO 8), 빈 본문 테스트 신설(INFO 9)로 처분된 두 건 모두 `folders.service.spec.ts:227-233`, `:137-148` 에 실제로 반영돼 있음을 확인했다. plan 의 뮤턴트 표(M1~M5, H1~H4)가 예측/실측을 나란히 적어 각 테스트가 실제로 어떤 뮤턴트를 죽이는지 실증한 방식은 이 리뷰 기준으로도 이례적으로 견고하며, 위에서 짚은 로직(H1 뮤턴트가 `omitUndefined` 를 `v != null` 로 바꿨을 때 "allows moving to root" 테스트가 RED 가 된다는 추론)도 코드를 직접 대조해 일관성을 확인했다.

## 요약

핵심 변경은 `undefined` 필터 관용구를 트리거·폴더 두 사본에서 공용 헬퍼(`omitUndefined`)로 추출한 순수 리팩터이며, 헬퍼 자체에 대한 전용 스펙(falsy 보존·불변성·얕음·실제 결함 형태 재현 4개 케이스)이 새로 생겼고 두 소비자 쪽 기존/신규 회귀 테스트가 헬퍼 경유 여부를 각각 가른다(H1~H4 뮤턴트 KILLED 실측). 1R 테스트 리뷰가 지적한 두 INFO(값 미검증 테스트, 빈 본문 경계)는 실제로 커밋에 반영돼 해소됐다. 남은 갭은 헬퍼 자체 스펙의 자명한 경계(빈 객체 입력)와 `T extends object` 가 배열까지 허용하는 타입 느슨함 정도로, 전부 비차단 수준이다.

## 위험도

LOW
