# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실제 취약점(cross-execution 캐시 응답 재생, CWE-639)을 정확히 겨냥해 닫은 보안 수정. Critical 없음. WARNING 2건은 모두 테스트 완결성/문서 최신화에 관한 것으로 병합 차단 사유 아님.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | unit(`scopedKey`)·e2e(`idempotencyCacheKey`) 두 테스트 키-조립 헬퍼가 거의 동일한 로직을 각각 정의하면서 필수 문자열 파라미터 순서가 서로 반대(`scopedKey(rawKey, executionId, route)` vs `idempotencyCacheKey(executionId, rawKey, route)`). 둘 다 `string` 타입이라 TS가 순서 오류를 못 잡음 — 인자 순서 착각으로 조용히 잘못된 키를 단언할 위험 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:68`, `codebase/backend/test/external-interaction.e2e-spec.ts:129` | 두 헬퍼 인자 순서 통일 또는 `{ executionId, rawKey, route }` 옵션 객체 시그니처로 전환 |
| 2 | testing | "route 축" 유닛 테스트가 GET 키만 검증하고 SET 키의 route 스코프는 검증하지 않음 — 같은 describe 블록 JSDoc 이 명시한 "GET/SET 양쪽 모두 단언" 원칙이 "execution 축" 테스트(`redisA.set`/`redisB.set` 명시 검증)에는 지켜지지만 이 테스트엔 미적용. 실제 위험은 낮음(GET/SET 이 동일 `redisKey` 지역변수 공유 + e2e IDEM-5가 실 Redis 로 상쇄) | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:839-864` | "route 축" 테스트에 `redis.set` 호출 인자 단언(`scopedKey('k', DEFAULT_EXECUTION_ID, 'cancel')`) 한 줄 추가 |
| 3 | documentation | 테스트 파일 top-of-file 모듈 독스트링이 신규 4번째 `describe`(캐시 키 스코프, §R8) 블록을 색인하지 않아 stale — 900줄+ 대형 파일에서 향후 편집자가 이 블록 존재를 놓칠 수 있음 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:1-26` | 상단 독스트링에 4번째 describe(execution+route 스코프, GET·SET 양축 고정) 한 문단 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / architecture / side_effect / maintainability / testing (중복 통합) | 캐시 키의 `route` 축이 `context.getHandler().name`(런타임 함수 이름) 리플렉션에 의존 — 현재 빌드(`nest build`→순수 tsc, minifier 없음)와 실사용(컨트롤러에 `interact`/`cancel` 두 라우트만 부착)에서는 안전. 향후 빌드 파이프라인이 minify 되거나 인터셉터가 동명 핸들러를 가진 다른 컨트롤러에 재사용되면 route 축 붕괴 가능성(단, `executionId` 축이 여전히 분리해 실전 충돌엔 이중 조건 필요) | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:113` | 현재 조치 불필요. 향후 재사용/빌드 변경 시 명시적 상수(데코레이터/enum)로 전환 검토, 또는 클래스 JSDoc/빌드 설정 근처에 캐너리 주석 |
| 2 | side_effect | Redis 키 포맷 변경으로 배포 시점 기준 구-포맷 캐시 엔트리가 조회되지 않는 채 고아가 됨 — 데이터 오염 아니고 TTL(24h)로 자연 만료, 배포 직후 일시적으로 재요청이 캐시 미스로 한 번 재처리될 수 있음 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:115` | 조치 불필요(허용 가능한 트레이드오프). 필요시 CHANGELOG 에 전환기 창 한 줄 언급 |
| 3 | architecture / maintainability (중복 통합) | 캐시 키 포맷 문자열(`interaction:idempotency:<executionId>:<route>:<key>`)이 프로덕션 1곳 + 테스트 헬퍼 2곳(unit/e2e)에 독립 하드코딩 — 블랙박스 회귀 테스트로서는 의도된 패턴(구현 재사용 대신 재구현)이나 포맷 변경 시 3곳 동기화 필요 | `idempotency.interceptor.ts:115`, `idempotency.interceptor.spec.ts:73`, `external-interaction.e2e-spec.ts:134` | 현재 조치 불필요. 세 번째 포맷 변경 시 프로덕션 상수/빌더 export 후 테스트가 import 하는 형태 리팩터 고려 |
| 4 | maintainability | `intercept()` 에 스코프 키 산출 로직(~19줄)이 추가되며 메서드가 길어짐 — early-return 가드로 중첩은 얕게 유지, 차단 수준 아님 | `idempotency.interceptor.ts:91-170` | 향후 축 추가 시 `resolveScopedKey()` 같은 private 헬퍼 분리 검토 |
| 5 | documentation | CHANGELOG 항목이 실질적으로 cross-execution 정보 노출(보안 성격) 수정임에도 제목에 "보안 수정" 라벨 없음 — 인접 항목(워크스페이스 멤버십 검증 누락)은 "보안 수정" 명시, 이 항목은 "스코프"라는 중립 단어만 사용 | `CHANGELOG.md:3` | 필수는 아니나 제목/본문에 "(보안)" 또는 "정보 노출" 태그 추가 고려 |
| 6 | testing | 유닛 테스트의 `DEFAULT_ROUTE = 'interact'` 상수가 실제 컨트롤러 메서드명과 컴파일 타임 결속이 없음 — 메서드 리네임을 유닛 테스트가 탐지 못함(e2e IDEM-5는 탐지) | `idempotency.interceptor.spec.ts:62-65` | 조치 불필요(참고용) |
| 7 | side_effect | fail-open 경로(`req.interaction` 부재)에서 매 요청 `Logger.warn` 호출 추가 — 현재 두 라우트 모두 Guard 가 선행해 사실상 도달 불가능, 향후 Guard 없는 라우트에 재사용 시에만 로그 폭주 유의 | `idempotency.interceptor.ts:105-107` | 조치 불필요, 재사용 시에만 확인 |

## SPEC-DRIFT

없음.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | cross-execution 캐시 재생(CWE-639) 취약점을 실제로 닫는 수정. `executionId`는 Guard 검증 후 서버 합성값이라 위조 불가, fail-closed 설계 확인. INFO 1건(향후 재사용 시 route 축 리스크) |
| performance | NONE | 순수 문자열 세그먼트 2개 추가뿐, O(1) Redis 연산 구조 불변. INFO 3건(키 길이 무시 수준 증가 등) |
| architecture | LOW | 레이어 경계·순환 의존 없음. INFO 2건(route 축 리플렉션 의존, 키 포맷 3중 하드코딩) |
| requirement | NONE | spec(EIA §R8, data-flow §2.2)과 line-level 일치 확인. INFO 4건(전부 정보성 확인, §9.2 레지스트리 갭은 이미 별도 추적 중) |
| scope | NONE | 4개 파일 모두 단일 의도(캐시 키 스코프)에 직접 종속. 불필요한 리팩토링/무관 파일 없음 |
| side_effect | LOW | 전역 상태/네트워크 대상/공개 시그니처 불변. INFO 4건(구 캐시 엔트리 고아화, route 리플렉션 브리틀니스 등) |
| maintainability | LOW | 기존 스타일 준수, 새 매직넘버 없음. WARNING 1건(테스트 헬퍼 인자 순서 불일치) |
| testing | LOW | 유닛 29/29 통과, tsc 에러 0건 직접 재현. WARNING 1건(route 축 SET 검증 누락, 위험은 낮음) |
| documentation | LOW | spec 정합 확인, 주석 품질 우수. WARNING 1건(테스트 파일 독스트링 stale) |

## 발견 없는 에이전트

- security, performance, requirement, scope — WARNING/CRITICAL 없음(INFO 또는 전무).

## 권장 조치사항
1. (선택) `idempotency.interceptor.spec.ts` "route 축" 테스트에 `redis.set` 호출 인자 단언 한 줄 추가 — GET/SET 동시 검증 원칙과 실제 테스트 일치화.
2. (선택) unit(`scopedKey`)/e2e(`idempotencyCacheKey`) 두 헬퍼 인자 순서 통일 또는 옵션 객체화 — 향후 복붙 실수 예방.
3. (선택) 테스트 파일 상단 독스트링에 4번째 describe(§R8 캐시 키 스코프) 색인 추가.
4. (선택) CHANGELOG 항목 제목에 보안 성격 명시 라벨 고려.

이상 모두 병합을 막을 사유는 아니며, 이번 diff 자체는 실제 보안 결함을 정확히 겨냥해 닫은 수정으로 판단됨.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation (9명)
  - **제외**: 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨 (누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 diff 범위 밖 (패키지 의존성 변경 없음) |
  | database | router 판단상 이번 diff 범위 밖 (DB 스키마/쿼리 변경 없음) |
  | concurrency | router 판단상 이번 diff 범위 밖 |
  | api_contract | router 판단상 이번 diff 범위 밖 (공개 API 계약 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 범위 밖 (사용자 가이드 문서 대상 아님) |
