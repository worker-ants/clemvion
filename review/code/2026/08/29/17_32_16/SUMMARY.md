# Code Review 통합 보고서

## 전체 위험도
**LOW** — `resolveCacheHit()` 추출은 동작 변경 없는 순수 구조 리팩터로 CRITICAL/WARNING 발견 없음. 9개 reviewer(강제 7 + 라우터 선택 2) 전원 결과 확보(forced 전원 이행, 누락 없음). 유일한 LOW 판정은 maintainability 로, 실질 내용은 전부 INFO 수준(스타일 일관성·명명·주석 stale 위험)이며 블로킹 결함은 아니다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability / architecture | `resolveCacheHit` 이름이 "히트"만 연상시키지만 실제로는 캐시 미스 포함 7갈래 조회 결과 판정 전체를 담당 (docstring 이 정확히 설명해 오독 위험은 낮음) | `idempotency.interceptor.ts:222` | 필수 아님. 다음 리네이밍 기회에 `resolveCacheLookup`/`handleCacheLookupResult` 등으로 좁히면 이름·책임이 더 일치 |
| 2 | architecture | `resolveCacheHit()` 이 "반드시 `switchMap` project 함수 안에서 호출돼야 한다"는 계약(동기 throw → RxJS error 채널 변환)이 타입이 아니라 JSDoc 서술로만 강제됨. 호출부가 하나뿐인 현재는 위험 낮음 | `idempotency.interceptor.ts:213`(docstring), `:222`(시그니처) | 현재 조치 불요. 두 번째 호출부가 생기면 discriminated union 반환 또는 `resolveCacheHitOrThrow` 등 메서드명으로 계약을 드러내는 것을 고려 |
| 3 | architecture | `CacheLookup` 이 순수 데이터(`redisKey`/`bodyHash`)와 프레임워크 객체(`ExecutionContext`/`CallHandler`)를 한 인터페이스로 묶음. 단일 전용 호출부에는 적절하나 재사용 시 경계가 흐려질 수 있음 | `idempotency.interceptor.ts:72-81` | 두 번째 소비자가 생기기 전까지 조치 불요 |
| 4 | maintainability | 같은 클래스의 동급 헬퍼(`cacheTapped`, `storeEntry`)는 여전히 위치 인자를 쓰는데 `resolveCacheHit`만 `CacheLookup` 객체로 파라미터를 묶어, 클래스 내 파라미터 전달 방식이 두 스타일로 갈림 | `idempotency.interceptor.ts:222` vs `:335`, `:386` | 즉시 통일 불요. 다음에 두 헬퍼를 만질 때 같은 판단 기준(호출부 실수가 타입으로 안 잡히는지)으로 재검토할 만하다는 점을 docstring/plan 에 남겨 둘 것 |
| 5 | maintainability | `resolveCacheHit`/`CacheLookup` JSDoc 에 뮤테이션 실측 수치(13/4/2개)와 과거 리뷰 라운드 ID 를 영구 박아 둠 — 테스트 스위트 변화 시 조용히 stale 해질 수 있음(이 파일 기존 스타일과 동일, 신규 결함 아님) | `idempotency.interceptor.ts:64-67`, `:218-220`, `:208-209` | 조치 불요. 향후 정책으로 "정확한 개수" 대신 "≥N" 근사치 표기를 검토할 만함 |
| 6 | maintainability | `resolveCacheHit` 순환 복잡도가 여전히 7갈래(옮겨졌을 뿐 줄지 않음). early-return 위주라 가독성 자체는 양호 | `idempotency.interceptor.ts:222-294` | 현재 크기는 임계치 이내. 기존 관례(6→7 트리거)를 이어 "8번째 분기 발생 시 재검토" 로 남겨 둘 것 |
| 7 | security / scope / side_effect | 리뷰 라운드 중 구현자가 검증용으로 `redisKey`/`bodyHash` 를 의도적으로 바꿔 넣었다 되돌린 뮤테이션이 병렬 consistency-checker(`convention_compliance`, `rationale_continuity`) 를 일시 오염시켰음. 최종 커밋(`49b9f92b5`)·현재 워크트리 직접 대조 결과 호출부는 `{ redisKey, bodyHash, context, next }` 정상 순서이며 잔여물 없음. `review/consistency/2026/08/29/17_23_43/SUMMARY.md` 가 이미 자체 정정·투명 기록함 | `idempotency.interceptor.ts:190`, `:226` | 조치 불요(이미 원복·정정 완료). 후속 라운드에서는 뮤테이션 검증 시점과 병렬 리뷰/checker 실행 시점을 겹치지 않게 배치 |
| 8 | security | 캐시된 payload 가 형태 검증(`isIdempotencyEntry`)만 거치고 내용은 그대로 재현됨 — 기존 동작이며 이번 diff 로 신설되지 않음. 캐시 키가 `executionId`(클라이언트 조작 불가)+`route`+`Idempotency-Key` 로 스코프돼 있어 이번 범위에서 새 인젝션/권한우회 표면 없음 | `idempotency.interceptor.ts:287,293` | 조치 불요(범위 밖). `storeEntry()` 적재 대상이 향후 확장되면 재조사 |
| 9 | testing | 신규 `resolveCacheHit()`/`CacheLookup` 은 module-private 이라 전용 단위 테스트 없음 — 기존 spec 파일 컨벤션("헬퍼는 `intercept()` 를 통해서만 테스트")과 일치. 독립 재현한 뮤테이션(필드 swap→13 RED, 분기4 채널변경→4 RED)이 docstring 수치와 정밀 일치해 커버리지 신뢰도 확인 | `idempotency.interceptor.ts:222`, `:72` | 조치 불요 |
| 10 | testing | 리팩터 전후 동작 동등성을 직접 비교하는 골든/스냅샷 테스트 없음 — 기존 spec 63건 GREEN 자체가 동등성 증거이며 별도 추가는 오버엔지니어링 | 파일 전체(구조 변경 diff) | 조치 불요 |
| 11 | testing | `resolveCacheHit()`가 `switchMap` project 함수 *안에서* 호출돼야 한다는 위치 제약을 전용으로 고정하는 캐너리 테스트는 없음(기존 회귀 테스트가 부수적으로 검증) | `idempotency.interceptor.ts:189-191` | 우선순위 낮음. 원하면 "`intercept()` 는 항상 Observable 을 반환하고 동기 throw 하지 않는다"를 단언하는 캐너리 1건 추가 고려 |
| 12 | documentation | plan 완료 문단(`backend-lint-gate-broken-on-main.md`)에 착수 시점 base SHA(`98af82eeb`)는 있으나 이번 작업 자체의 커밋 SHA 는 아직 비어 있음(커밋 전 리뷰 단계라 정상) | `plan/in-progress/backend-lint-gate-broken-on-main.md:815` | 이번 turn 커밋 시 해당 문단에 커밋 SHA 를 한 줄 추가할 것 |
| 13 | documentation | CHANGELOG 미기재 — 이 diff 는 "순수 구조 변경, 동작 변경 없음"으로 5개 checker·plan·docstring 이 일치 확인했으므로 저장소 관례("운영 영향 있는 변경만 등재")상 갭이 아님 | `CHANGELOG.md`(변경 없음) | 조치 불요. 향후 다른 이유(예: fail-open 관측성)로 재검토 시 등재 필요할 수 있음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 구조 리팩터, 로직 변화 없음. "필드 스왑"은 원복된 뮤턴트임을 재확인 |
| architecture | NONE | SRP 분리 개선. `switchMap`-only 호출 계약이 타입 아닌 문서로만 강제(INFO) |
| requirement | NONE | 기능 100% 이행 확인(독립 재현: 63/63 GREEN, 뮤테이션 13 RED 정밀 일치). spec §R8/EIA-IN-11/EIA-RL-02 drift 없음 |
| scope | NONE | 10개 파일 전부 정상 범위(리팩터+plan 갱신+consistency 산출물). 뮤테이션 오염 사건 투명 기록됨(INFO) |
| side_effect | NONE | 상태변경·전역변수·시그니처·네트워크·이벤트 배선 전부 불변 확인 |
| maintainability | LOW | 명명·파라미터 전달 스타일 일관성·docstring 수치 stale 위험 등 INFO 다수, 블로킹 없음 |
| testing | NONE | 커버리지 정책과 일치. 뮤테이션 실측(13 RED, 4 RED) 독립 재현하여 정밀 일치 확인 |
| documentation | NONE | JSDoc·plan 추적성 모범적. 커밋 SHA 사후 기재 필요(INFO) |
| api_contract | NONE | 응답 상태코드·에러코드·바디 형태·인증전제 전부 동일, 외부 계약 변화 없음 |

## 발견 없는 에이전트

api_contract — CRITICAL/WARNING/INFO 발견사항 전무("없음"으로 명시).

## 권장 조치사항

1. (선택) 이번 turn 커밋 시 `plan/in-progress/backend-lint-gate-broken-on-main.md:815` 완료 문단에 이번 작업의 커밋 SHA 를 추가 — plan_coherence 가 요구한 추적성 완결.
2. (선택, 저비용) `resolveCacheHit`가 캐시 미스까지 포함한다는 점을 이름에도 반영할지 다음 리네이밍 기회에 검토(`resolveCacheLookup` 등) — 현재는 docstring 이 보완하고 있어 급하지 않음.
3. (선택, 장기) `cacheTapped`/`storeEntry` 도 `CacheLookup` 과 같은 판단 기준(호출부 실수가 타입으로 안 잡히는가)으로 재검토해 파라미터 전달 방식을 통일할지 다음 수정 시 고려.
4. 즉시 조치 불요 항목(뮤테이션 오염 사건, 캐시 payload 미검증 재현, docstring 수치 하드코딩 등)은 전부 이미 원복·정정·근거 문서화가 완료된 상태이므로 재작업 불필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 누락 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff 는 순수 구조 리팩터(로직 이동)로 성능 특성 변화 없음 |
  | dependency | 라우터 판단 — import/의존성 변경 0건 |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단 — 동시성 제어 로직 변경 없음 |
  | user_guide_sync | 라우터 판단 — 사용자 문서 대상 변경 없음 |
