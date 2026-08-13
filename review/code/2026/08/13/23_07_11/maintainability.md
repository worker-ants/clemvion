# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

- **[WARNING]** 같은 함수 안 형제 분기 중 한쪽만 `unknown` 전환에서 빠졌다 — 이미 2라운드 전에 지적됐는데도 미수정.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:533` (embedding 재큐 분기 `const rows = await this.dataSource.query<{ id: string }[]>(...)`) vs `:569` (바로 옆 graph 재큐 분기 `const rows: unknown = await this.dataSource.query(...)`)
  - 상세: 이번 PR 의 핵심 원칙은 "`.query<T>()` 의 제네릭은 검증되지 않는 거짓 주장이므로 `unknown` 으로 받고 `updateReturningRows` 가 실제 shape 을 판별한다"는 것이고(`update-returning-rows.ts:1-19` JSDoc, `execution-engine.service.ts:2916-2920` 주석), 실제로 `retryFailedDocuments` 안의 두 형제 분기(embedding/graph) 중 graph 분기(`:569`)와 KB 의 나머지 4개 호출부는 전부 `unknown` 으로 통일됐다. 그런데 embedding 분기(`:533`)만 옛 `query<{ id: string }[]>` 제네릭이 남아 "이 값은 이미 행 배열"이라는, 이번 결함의 근본 원인이 됐던 바로 그 거짓 주장을 계속 하고 있다. `updateReturningRows()` 가 런타임에 올바르게 언랩하므로 지금 당장 기능 결함은 아니지만, 다음 리팩터링에서 누군가 `rows` 를 헬퍼 없이 직접 `.map`/`.length` 하는 코드를 추가해도 컴파일러가 "행 배열"이라고 믿고 통과시킨다 — 정확히 이번 결함이 재발하는 경로다. 이 정확한 지점은 직전 라운드(`review/code/2026/08/13/22_45_24/concurrency.md` INFO 1)에서 이미 한 번 지적됐는데 이번 라운드 diff 에도 그대로 남아 있다.
  - 제안: `:533` 도 `const rows: unknown = await this.dataSource.query(...)` 로 통일한다. 한 줄짜리 수정이고, 같은 파일의 나머지 4곳과 즉시 대조 가능해 리뷰 부담도 낮다.

- **[INFO]** "자매 지점 전수" 구조적 회귀 가드 두 벌(`assert-row-array.spec.ts`, `update-returning-rows.spec.ts`)이 `SRC` 계산·`readFileSync`·정규식 카운팅 보일러플레이트를 거의 동일하게 각자 인라인 구현한다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts:53-62` (`SRC`, `CONSUMING_QUERY` 정의) vs `codebase/backend/src/common/utils/update-returning-rows.spec.ts:42-46` (`SRC`, `CONSUMING` 정의)
  - 상세: 두 describe 블록 모두 "파일을 읽어 정규식으로 소비 지점 수를 센다"는 동일 패턴을 독립 구현한다(변수명만 `CONSUMING_QUERY`/`CONSUMING`). 대상(SELECT 자리 vs UPDATE/DELETE 자리)이 달라 완전 통합은 과할 수 있으나, 공유 유틸로 뽑지 않으면 세 번째 유사 가드가 생길 때 같은 보일러플레이트가 또 복제된다. 직전 라운드(`22_45_24/maintainability.md` INFO 1)에서 이미 지적됐고 "급하지 않음"으로 유예된 항목이라 이번에도 그대로다 — 재확인 목적으로만 기재.
  - 제안: 조치 불요(기존 유예 결정 유지). 세 번째 유사 가드가 생기는 시점에 `test/utils/count-pattern-in-file.ts` 류 추출을 고려.

- **[INFO]** `it.each` placeholder 변수명이 자매 스펙과 여전히 다르다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:23` (`(_l, v) =>`) vs `codebase/backend/src/common/utils/assert-row-array.spec.ts:27` (`(_label, value) =>`)
  - 상세: 직전 라운드(`22_45_24/maintainability.md` INFO 3)에서 이미 지적된 사소한 네이밍 흔들림이며 이번 diff 에도 미수정 상태다. 기능 영향 없음.
  - 제안: 조치 불요(저비용이나 우선순위 낮음). 다음에 이 파일을 손댈 때 `_label`, `value` 로 맞추는 정도.

- **[INFO]** `execution-engine.service.spec.ts` 에 이번 라운드 새로 추가된 판별 테스트 두 쌍이 arrange 보일러플레이트(`svcAny` 캐스트 + `updateExecutionStatus` 호출 골격)를 그대로 반복한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4599-4612` (`persisted=true`) / `:4614-4625` (`persisted=false`)
  - 상세: 두 테스트는 mock 값(`[[{id}],1]` vs `[[],0]`)과 기대값(`true`/`false`)만 다르고 `svcAny` 타입 캐스트·`updateExecutionStatus` 호출 인자 구조는 동일하다. 같은 diff 의 admission 판별 테스트 쌍(`:4405-4446`, 이미 직전 라운드 `20_36_35/maintainability.md` INFO 4 로 지적됨)과 동일한 패턴이며, 이 파일 전체가 케이스별 개별 `it()` + 인라인 mock 컨벤션을 이미 쓰고 있어 이번 추가도 그 컨벤션에서 벗어나지 않는다.
  - 제안: 필수 수정 아님 — 기존 파일 컨벤션과 일관되므로 그대로 두어도 무방.

## 요약

이번 diff(소셜 로그인 `auth-oauth.service.ts` CRITICAL 수정 + 판별 테스트 보강까지 포함한 전체 브랜치 변경분)는 두 차례 리뷰 라운드(`20_36_35`, `22_45_24`)를 거치며 이미 정리된 헬퍼(`updateReturningRows`)·JSDoc·구조적 가드 위에서 마지막 결함(auth-oauth 8번째 소비 지점)과 테스트 위생(판별 뮤턴트)을 닫는 마무리 라운드다. 헬퍼 자체는 여전히 짧고 단일 책임이며, 신규 회귀 테스트도 정상/예외/판별 경로를 고르게 커버한다. 가장 실질적인 잔여 항목은 `knowledge-base.service.ts` 안에서 형제 분기 하나가 `unknown` 전환을 놓쳐 "제네릭이 실제 shape 을 보장한다"는, 이번 결함의 근본 원인이었던 거짓 주장을 그 자리만 계속하고 있는 것이다 — 직전 라운드에서 이미 지적됐는데도 이번 라운드까지 넘어왔다는 점에서 사소하지만 눈여겨볼 만하다. 나머지는 전부 이미 두 차례 리뷰에서 문서화되고 유예/수용된 저비용 INFO 성격(정규식 가드 보일러플레이트 중복, `it.each` 네이밍 흔들림, 신규 판별 테스트의 arrange 반복)이라 새로운 부채는 아니다. CRITICAL 급 유지보수성 결함은 없다.

## 위험도

LOW
