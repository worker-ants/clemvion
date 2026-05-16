# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `buildFakeCafe24Integration` 반환 타입이 `Record<string, unknown>` 으로 너무 넓다
  - 위치: `integration-oauth.service.cafe24.spec.ts` — `buildFakeCafe24Integration` 함수 반환 타입 선언
  - 상세: 반환 타입을 `Record<string, unknown>` 으로 선언하면 호출 측에서 `.id`, `.status` 등 특정 프로퍼티에 접근할 때 TypeScript 가 타입 추론을 제공하지 못한다. 테스트에서 반환값을 직접 사용하지는 않으나, 향후 `expect(result.id).toBe(...)` 형태로 확장될 경우 타입 안정성이 없다.
  - 제안: 로컬 인터페이스(`FakeCafe24Integration`)나 최소한 `{ id: string; name: string; status: string; serviceType: string; mallId: string | null; credentials: Record<string, unknown>; [key: string]: unknown }` 형태의 구체적 타입으로 좁히는 것을 고려한다.

- **[INFO]** `overrides.mallId === undefined` 비교와 `overrides.credentialsMallId ?? ...` 의 혼용 — nullish 처리 불일치
  - 위치: `integration-oauth.service.cafe24.spec.ts` — `buildFakeCafe24Integration` 내부 61~64행 근처
  - 상세: `mallId` 계산은 `overrides.mallId === undefined ? 'priv-shop' : overrides.mallId` 로 `undefined` 만 감지하는 반면, `credentialsMallId` 는 `overrides.credentialsMallId ?? mallId ?? 'priv-shop'` 로 nullish coalescing 을 사용한다. 두 경로의 null/undefined 처리 의도가 다른 이유가 코드에서 명확하지 않다. `mallId: null` 을 넘기면 `credentials.mall_id` 가 `null` 이 되고, 이는 legacy 케이스를 의도한 것이지만 함수 시그니처만 읽어서는 파악하기 어렵다.
  - 제안: JSDoc 에 이미 설명이 있으나 코드 흐름 자체에 `// mallId=null → legacy row: credentialsMallId 를 별도로 지정해야 함` 형태의 인라인 주석을 추가하면 가독성이 높아진다.

- **[INFO]** `void err` 패턴 — 불필요한 표현
  - 위치: `frontend/src/app/(main)/integrations/new/page.tsx` — catch 블록 내 `void err;`
  - 상세: `void err` 는 ESLint `no-unused-vars` 경고를 억제하기 위한 관용구이지만, catch 인자를 `catch (_err)` 또는 `catch` 로 변경하면 더 간결하다. `void err` 는 처음 읽는 사람에게 의도를 설명하지 않는다.
  - 제안: `catch (_err)` 또는 주석과 함께 `/* AbortError 포함 — silent */` 로 대체한다.

- **[INFO]** 여러 metadata 파일에서 `// Phase 8x — ...` 형태의 단계 주석이 제거된 코드 블록이 `planned.ts` 에 재배치되었으나, 잔존하는 `// Phase 6d`, `// Phase 6e`, `// Phase 6f` 등 기존 Phase 주석은 그대로 남아 있다
  - 위치: `collection.ts` — 723행 근처 `// Phase 6d — collection (brands CRUD baseline)`, `notification.ts` — `// Phase 6f — Notification 보완`, `mileage.ts` — `// Phase 6e — Mileage 보완`
  - 상세: 이번 변경에서 Phase 8x 주석들을 삭제하고 해당 operation 을 `planned.ts` 로 옮겼는데, Phase 6x 주석은 같은 파일에 그대로 남아 있다. 두 패턴이 혼재하면 어떤 Phase 가 구현 완료이고 어떤 게 미구현인지 혼란을 준다. 삭제된 Phase 8x 들은 "미구현 → planned" 이동이므로 합리적이지만, Phase 6x 주석은 "구현 완료됨" 을 표시하는 것인지 또는 무의미하게 남은 것인지 불분명하다.
  - 제안: Phase 6x 주석도 동일하게 정리하거나, 주석의 의미(구현 단계 표시 vs. 미구현 경계)를 팀 컨벤션으로 명확히 한다.

- **[INFO]** `customer.ts` 의 따옴표 불일치 — 이번 변경에서 일부만 수정됨
  - 위치: `customer.ts` — `customer_paymentinfo_list` 와 `customer_paymentinfo_delete_by_id` 설명 필드
  - 상세: 이번 diff 에서 `customer_paymentinfo_list` 는 single quote → double quote 로, `customer_paymentinfo_delete_by_id` 는 double quote → single quote 로 변경했다. 즉 두 수정이 서로 반대 방향이다. 결과적으로 파일 내에서 apostrophe 를 포함하는 description 의 따옴표 스타일이 여전히 혼재할 가능성이 있다.
  - 제안: Prettier 설정이 적용되어 있다면 일관성이 보장되므로 추가 조치 불필요. 그렇지 않다면 파일 전체의 description 필드 따옴표 스타일을 통일한다.

- **[INFO]** `Cafe24PrecheckStatus` 타입 정의 — 개행 스타일 정규화만으로도 변경 포함됨
  - 위치: `integration-oauth.service.ts` — 345~347행
  - 상세: 이번 변경은 두 줄짜리 타입 선언을 한 줄로 병합하는 순수 포맷 변경이다. 기능적으로 문제없으나, Prettier 가 자동 처리했다면 별도 diff 항목으로 남지 않았을 것이다. Prettier 강제 포맷팅 CI 가 있는 경우 예방 가능한 노이즈다.
  - 제안: 현황 유지 (기능·가독성 모두 문제없음). CI prettier check 가 미적용 파일에 있다면 확인.

- **[INFO]** `planned.ts` 의 `CAFE24_PLANNED_BY_RESOURCE` 는 operation 배열이 인라인으로 늘어날수록 파일이 비대해지는 구조
  - 위치: `planned.ts` — `CAFE24_PLANNED_BY_RESOURCE` 객체 전체
  - 상세: 각 카테고리의 planned operation 을 단일 상수 객체에 모두 인라인으로 열거하는 방식이다. 이번 변경 후 여러 카테고리에 10개 이상의 항목이 추가되어 파일 길이가 상당히 늘었다. 현재 규모에서는 수용 가능하나, planned operation 이 계속 증가할 경우 카테고리별 분리 또는 외부 JSON 화를 검토해야 한다.
  - 제안: 현 시점에서는 수용 가능. 카테고리당 20개 이상 초과 시 분리 검토.

## 요약

이번 변경은 크게 네 가지 범주로 구성된다: (1) `buildFakeCafe24Integration` factory 추출로 테스트 파일의 인라인 mock 반복을 제거하고, (2) `AbortController` 도입으로 debounce precheck 의 in-flight 요청 취소를 강화하며, (3) 미구현 Cafe24 operation 을 각 metadata 파일에서 `planned.ts` 로 이동하고, (4) 코드 포맷 정규화(개행·따옴표)를 수행한다. 전반적으로 중복 코드 제거와 단일 책임 분리는 긍정적이다. factory 함수의 반환 타입이 다소 넓고 내부 null/undefined 처리 패턴이 미묘하게 혼재하는 점, `void err` 관용구의 명확성 부족, Phase 주석 정리의 불완전함 등 소소한 가독성 개선 여지가 있으나, 전반적인 유지보수성은 이전보다 향상되었다.

## 위험도

LOW
