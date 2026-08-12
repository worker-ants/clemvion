# Code Review 통합 보고서

## 전체 위험도
**LOW** — 코드 자체는 6~7차례 누적 리뷰를 거쳐 완전히 수렴(CRITICAL/WARNING 0건)했으나, security reviewer 가 **리뷰 절차 결함**을 지적했다: "idempotency 캐시 키 미스코프" 항목이 4개 이전 라운드에 걸쳐 "plan 백로그에 이미 등재돼 있다"고 반복 주장됐지만 실제로는 `plan/in-progress/backend-lint-gate-broken-on-main.md` 어디에도 그 항목이 존재한 적이 없다. 강제 화이트리스트(forced reviewer) 7명 전원 결과는 확보되었으나, 이 절차 결함은 "clean" 으로 읽혀서는 안 되며 이번 라운드에서 실제로 plan 에 기록되어야 한다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | idempotency 캐시 키가 execution/인증 컨텍스트로 미스코프됐다는 보안 항목이 4개 리뷰 라운드(`16_29_45`→`16_53_26`→`17_07_45`→`18_07_36`/`18_52_47`)에 걸쳐 "plan 백로그에 이미 등재돼 있다"고 반복 주장됐으나, `plan/in-progress/backend-lint-gate-broken-on-main.md` 를 직접 grep 대조한 결과 해당 항목은 실제로 한 번도 추가된 적이 없다. 처분표에 "기록하겠다"고 쓰고 그 턴에 실제로 안 적은 패턴의 재발(이전에 동일 커밋 `567c1919d` 가 다른 항목에서 스스로 지적·수정했던 바로 그 실패 클래스). | `plan/in-progress/backend-lint-gate-broken-on-main.md` (해당 항목 부재), 대조: `review/code/2026/08/12/{16_29_45,16_53_26,17_07_45}/RESOLUTION.md`, `review/code/2026/08/12/{18_07_36,18_52_47}/security.md` | 이번 라운드(최종 라운드)에서 "idempotency 캐시 키가 `executionId`/인증 컨텍스트로 스코프되지 않음 — 409/410 캐싱이 실제 발동 경로가 되며 노출 표면이 이론상 위험에서 실제로 전환됨" 항목을 plan 백로그에 **실제로** 추가할 것. 지금 안 하면 다음 세션도 "이미 등재됨"이라는 틀린 진술을 근거로 또 건너뛸 가능성이 높다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | idempotency 캐시 키가 `Idempotency-Key` 헤더 값에만 바인딩되고 execution/인증 컨텍스트로 스코프되지 않음(선재 설계). 이번 diff 로 409/410 캐싱이 dead code 에서 실제 동작 경로로 전환되며 노출 표면이 이론상 서술에서 실질로 전환됨. 다만 `InteractionGuard` 가 인터셉터보다 먼저 실행돼 인증 우회는 없고, 캐시된 payload 는 고정 코드/enum 값만 담아 현재 민감정보 노출은 없음. | `idempotency.interceptor.ts:95,135-140,186-201` | 후속으로 `redisKey` 에 `executionId`(또는 인증 scope 식별자) 포함 — 위 WARNING #1 의 plan 등재와 함께 처리 |
| 2 | security | 캐시된 예외 payload 가 24h Redis 보존됨 — `interaction.service.ts` 의 향후 변경이 예외 메시지에 민감정보를 섞으면 노출 창이 "1회"에서 "24h 재현 가능"으로 확대되는 잠재 회귀 지점 | `idempotency.interceptor.ts:189-196` | `interaction.service.ts` 409/410 throw 지점 변경 시 payload 재확인 |
| 3 | security/testing | `isErrorStatusCacheable`(닫힌 allowlist), `storeEntry`(직렬화 실패 격리), e2e 신규 테스트(파라미터화 쿼리, 매회 `randomUUID()` 키) — 새 취약점·하드코딩 시크릿 없음 확인 | `idempotency.interceptor.ts:214-257`, `external-interaction.e2e-spec.ts` | 없음 |
| 4 | requirement | `isErrorStatusCacheable`/성공 채널 판정이 Spec EIA §R8 닫힌 목록(2xx·409·410)과 line-level 정확 일치. `>= 400`/`=== 400` 두 오답 축약이 코드 구조상 불가능 | `idempotency.interceptor.ts:177,255-257` vs `spec/5-system/14-external-interaction-api.md:1053-1059` | 없음 |
| 5 | requirement | `EIA-RL-02`(동일 키 24h 동일 응답 재현) 충족을 e2e(`IDEM-1`/`IDEM-3`)·단위 테스트가 상태코드·error.code·캐시 payload 까지 직접 단언하여 확인. `requestId` 비재현 caveat 도 CHANGELOG·필터 동작과 일치 | `idempotency.interceptor.spec.ts:272-387`, `external-interaction.e2e-spec.ts:371-550` | 없음 |
| 6 | requirement/documentation | plan 백로그 미착수 항목(`readKey`/`hashBody` 경계값 테스트) 부속 지시가 이미 해소된 R8 갭을 미해결 전제로 참조(과거형 아님) — 이전 라운드가 이미 식별·유예한 것과 동일, 신규 아님 | `plan/in-progress/backend-lint-gate-broken-on-main.md:569-571` | 필수 아님. 여유 있으면 과거형으로 정정(`:572` 참조) |
| 7 | scope | 83개 파일(핵심 코드/테스트 3, CHANGELOG 1, plan 2, spec 1, 리뷰 산출물 74) 전부 단일 의도(§R8 캐시 재설계)로 수렴. `spec/data-flow/15-external-interaction.md` 캐비트 삭제는 developer read-only 경계에 있으나 narrow exception 패턴 반복 적용이며 consistency checker 이미 확인 완료 | 전역 | 없음 |
| 8 | maintainability | `JSON.parse(cached.responseJson)` 두 상호배타 분기에 중복 등장(시각적 중복, 6라운드 연속 지적·유예), 성공/에러 판정 팩터링 비대칭(named fn vs 인라인), `intercept()` 63줄 6갈래 분기, e2e 가 `REDIS_KEY_PREFIX` 를 3곳에 리터럴 하드코딩(단일 출처 아님) | `idempotency.interceptor.ts:88-150,137,143,177,255-257`, `external-interaction.e2e-spec.ts:425,495,538` | 전부 필수 아님. 여유 있으면 `REDIS_KEY_PREFIX` export+import 로 단일화 |
| 9 | testing | 3xx 성공채널 상한 경계값 `300` 자체 미행사(304만 행사), 캐시 엔트리 내부 `responseJson` 필드 손상 시 무방비(엔트리 전체 손상은 방어됨) — 둘 다 선재·저위험, plan 에 이미 기록됨 | `idempotency.interceptor.ts` (`cacheTapped` 300 경계, `intercept()` JSON.parse 2곳) | 조치 불필요 |
| 10 | documentation | 클래스 상단 요약 JSDoc 이 이번에 정식 동작이 된 "캐시 히트 시 409/410 예외 재현"을 bullet 로 명시하지 않음(3라운드 전부터 "제안, 필수 아님"으로 유예) | `idempotency.interceptor.ts:49-57` | 필수 아님. 여유 있으면 bullet 한 줄 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 코드 자체 위험 낮음(WARNING 1건은 리뷰 절차 결함 — plan 미기록), INFO 3건(캐시 스코프 선재 설계, 24h 보존, allowlist/직렬화 안전 확인) |
| requirement | LOW | §R8 요구사항 line-level 정확 일치 확인, INFO 4건(전부 확인용/경미 문서 잔재) |
| scope | NONE | 83개 파일 전부 단일 의도로 수렴, 무관한 변경 없음 |
| side_effect | NONE | 부작용 표면 무변화, 전역 mock 격리·에러 흡수 없음 재확인 |
| maintainability | NONE | 신규 결함 없음, INFO 6건 전부 4~6라운드 연속 유예된 선택적 개선 |
| testing | NONE | 25/25 GREEN, 뮤테이션 재실측(3 RED) 방어 유효, INFO 2건 선재·저위험 |
| documentation | NONE | 문서-코드 정합 재확인, INFO 2건 다라운드 유예된 경미 사항 |

## 발견 없는 에이전트

없음 (전 에이전트가 최소 INFO 이상 보고, 단 6/7 에이전트의 실질 위험도는 NONE/LOW 수준의 확인·유예 항목뿐)

## 권장 조치사항
1. **[최우선]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 "idempotency 캐시 키가 `executionId`/인증 컨텍스트로 스코프되지 않음" 항목을 **이번 라운드에서 실제로** 추가할 것 — 4개 라운드가 "이미 등재됨"이라 반복 주장했으나 실제로는 존재하지 않았다. 지금 안 하면 이 관찰 사항이 review 이력 파일에만 남고 소실된다.
2. (선택) `REDIS_KEY_PREFIX` 를 인터셉터에서 export 하여 e2e 의 3곳 하드코딩 리터럴을 단일 출처로 정리.
3. (선택) 클래스 최상단 docstring bullet 에 "409/410 캐시 히트 시 예외로 재현" 한 줄 추가.
4. (선택) plan 백로그의 `readKey`/`hashBody` 경계값 테스트 항목 부속 지시를 과거형으로 정정(이미 해소된 R8 갭 참조 제거).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (forced 전원 결과 확보됨 — 이행 완료)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단상 이번 변경(캐시 대상 정합화)과 무관 |
  | architecture | 라우터 판단상 이번 변경과 무관 |
  | dependency | 라우터 판단상 이번 변경과 무관 |
  | database | 라우터 판단상 이번 변경과 무관 |
  | concurrency | 라우터 판단상 이번 변경과 무관 |
  | api_contract | 라우터 판단상 이번 변경과 무관 |
  | user_guide_sync | 라우터 판단상 이번 변경과 무관 |
