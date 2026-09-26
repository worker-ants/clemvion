# 성능(Performance) 리뷰 — request-body-guard

## 발견사항

- **[INFO]** 프로덕션 핫패스 — 요청당 배열 리터럴 재할당 제거 (긍정적 변경)
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:18-24`(신설 `UNVALIDATED_METATYPES` 모듈 top-level 상수), `:92-94`(`toValidate` 소비)
  - 상세: 리팩터 전에는 `toValidate(metatype)` 호출마다(= `@Body()`가 있는 요청마다, `CustomValidationPipe` 는 전역 파이프로 매 요청 실행) `const types: Function[] = [String, Boolean, Number, Array, Object]` 로 5-요소 배열 리터럴을 **매번 새로 할당**했다. 이번 diff 는 그 리터럴을 모듈 top-level `Object.freeze([...])` 상수로 승격하고 `toValidate` 는 `UNVALIDATED_METATYPES.includes(metatype)` 만 호출한다 — 요청당 배열 할당이 완전히 제거됐다. `.includes()` 의 시간복잡도(O(5) 선형 탐색)는 변경 전후 동일하므로 알고리즘적 이득은 아니고, 고빈도 요청 경로에서 마이너 GC 압력을 줄이는 순수 최적화다.
  - 제안: 조치 불요 — 이미 개선된 방향. 참고로 기록.

- **[INFO]** 신설 가드(`request-body-advertised*`)는 프로덕션 요청 경로가 아니라 테스트/CI 시점 1회 실행 코드
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts`(`scanRequestBodyAdvertised`, 게이트 72~), `codebase/backend/src/shared/testing/swagger-probe.ts`(`bodyArgIndexes`, 게이트 174~181)
  - 상세: `scanRequestBodyAdvertised` 는 라우트 목록(실측 78개 `@Body()` 자리, 35개 컨트롤러)을 한 번 순회하며 라우트마다 `Reflect.getMetadata` 를 상수 횟수(자리 탐색 1회 + `design:paramtypes` 1회 + 필요 시 `@ApiExcludeEndpoint`/`@ApiBody` 조회)만 호출한다 — 반복문 안에 DB·네트워크 호출은 없고, 순수 in-memory reflection 뿐이라 N+1 성격의 문제는 아니다. `bodyArgIndexes` 의 `Object.entries().filter().map().sort()` 체인도 메서드당 인자 수(통상 1~5개)에 대해서만 도는 다중 패스라 실질 비용은 무시할 수준이다. `beforeAll` 이 `src/modules` 전체를 동적 로드하는 비용(120초 타임아웃)은 형제 가드 `forbidden-response-codes-guard.ts` 가 이미 쓰던 기존 패턴을 재사용한 것으로, 이번 diff 가 새로 추가한 비용이 아니다.
  - 제안: 조치 불요 — 테스트 스위트 실행 시간에만 영향을 주며, 규모(라우트 수십~백 단위)에서 선형 스캔은 적절한 자료구조 선택이다.

- **[INFO]** `violations.sort()` — 컨트롤러/핸들러명 2키 정렬은 위반 건수(정상 시나리오 0건, 베이스라인 0)에 대해서만 동작
  - 위치: `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts` — `scanRequestBodyAdvertised` 반환부의 `violations.sort(...)`
  - 상세: `Array.prototype.sort` 는 O(n log n) 이지만 n 은 "위반 건수"이고 정상 상태에서 0, 워스트케이스로도 전체 `@Body()` 자리 수(78) 를 넘지 않는다. 성능상 우려되는 규모가 아니다.
  - 제안: 조치 불요.

## 요약

이번 변경 세트는 (1) 저장소 정적 가드(`request-body-advertised`) 신설 — 테스트/CI 시점에 1회 실행되는 reflection 기반 순수 스캔으로, 반복문 내 DB/네트워크 호출·대규모 데이터 적재·블로킹 I/O·부적절한 자료구조 등 성능 관점의 문제가 없다(라우트 수·파라미터 수 규모에서 선형 스캔은 합당한 선택이다), (2) `CustomValidationPipe.toValidate` 의 비검증 타입 목록을 지역 배열 리터럴에서 모듈급 `Object.freeze` 상수로 승격한 순수 리팩터 — 오히려 매 요청 배열 재할당을 없애는 **긍정적**(비록 미미하지만) 프로덕션 핫패스 최적화다. 캐싱·비동기화·자료구조 재설계가 필요한 지점은 발견되지 않았고, CRITICAL/WARNING 급 성능 결함은 없다.

## 위험도

NONE
