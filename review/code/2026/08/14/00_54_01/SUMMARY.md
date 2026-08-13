# Code Review 통합 보고서

## 전체 위험도

**LOW** — CRITICAL 없음. WARNING 2건(둘 다 기능 결함이 아닌 방어/문서의 "한쪽만 하드닝됨" 패턴)만 발견됐고, forced whitelist(documentation·maintainability·requirement·scope·security·side_effect·testing) 7명 전원 결과가 정상 확보됐다(누락 없음).

이 PR 은 신규 기능이 아니라, TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE ... RETURNING` 을 `[rows, rowCount]` 튜플로 반환하는데 8개 소비 지점(execution-engine 2·knowledge-base 5·auth-oauth 1)이 이를 행 배열로 오인해 온 결함을 신규 헬퍼 `updateReturningRows()` 로 일원화해 수정하는 fix다. 이미 5~8라운드의 선행 ai-review/consistency-check 를 거쳐 CRITICAL 4건(소셜 로그인 상시 실패·모순 주석·거짓 커버리지 주장 2건)이 조치된 상태에서 진행된 최종 라운드이며, 이번 라운드는 신규 CRITICAL 없이 잔여 비대칭 2건만 새로 찾았다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 구조적 회귀 가드 `assertRowArray(...)` 호출 수 카운터가, 같은 커밋이 자매 카운터(`updateReturningRows` 호출 수)에 적용한 "주석 언급 스트리핑" 하드닝을 받지 못했다. 지금은 대상 파일에 `assertRowArray(` 를 언급하는 주석이 없어 GREEN 이지만, 이 PR 자신이 실측으로 증명한 "주석 언급이 카운트를 부풀려 호출 누락을 가린다"는 결함 클래스가 이 카운터에는 여전히 열려 있다. | `codebase/backend/src/common/utils/assert-row-array.spec.ts:72` | `update-returning-rows.spec.ts` 의 `stripComments`/`countHelper` 패턴을 `assert-row-array.spec.ts:72` 의 `guards` 계산에도 동일 적용(공유 유틸로 추출 고려) |
| 2 | documentation | `CHANGELOG.md` 에 동일한 `finalizeGuarded`(0행이면 저장·이벤트 발행 skip) 방어를 서술하는 두 섹션이 있는데, 이번 PR 최종 커밋이 붙인 "소급 정정" 블록이 그중 나중 섹션의 항목 번호만 가리켜, 더 앞선(PR 이전부터 존재) 섹션만 읽는 독자는 "이미 검증된 동작"으로 오인하게 된다(실제로는 튜플 오인으로 그 방어가 한 번도 발동한 적 없었음). | `CHANGELOG.md:312-316`(정정 누락) vs `:354-368`(정정 적용됨) | `:312-316` 섹션 끝에 짧은 소급 정정 한 줄 추가, 또는 중복 서술 두 섹션을 통합 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | OAuth state 소비 확인·KB CAS 락 2곳(reExtractAll/reEmbedAll)이 튜플 오인으로 항상 "존재함"/"거절 안 됨"으로 판정되던 것이 이 PR 로 정상 작동 복원(replay/expiry 거절, 동시 요청 409) — 새 취약점이 아니라 사문화됐던 방어의 재활성화 | `auth-oauth.service.ts`(handleCallback), `knowledge-base.service.ts`(reExtractAll/reEmbedAll) | 조치 불요 — plan 에 배포 후 관측 항목 등재됨 |
| 2 | security | `execution-engine.service.ts` `updateExecutionStatus` 의 `persisted` 판정도 같은 패턴으로 정확도 개선. SQL 인젝션·시크릿 하드코딩·에러 메시지 민감정보 노출 전부 미발견 | `execution-engine.service.ts` | 조치 불요 |
| 3 | scope | diff 133개 파일 중 117개(~9,400줄)가 review/consistency 산출물 — 프로젝트 상시 강제 review/fix 워크플로의 정규 산출물이라 컨벤션 위반 아님. 실제 애플리케이션 코드는 16개 파일뿐 | `review/code/**`, `review/consistency/**` | 조치 불요 — 리뷰 시 16개 코드 파일에 집중 권장 |
| 4 | scope | `auth-oauth.service.ts` 한 파일에 두 버그 수정(튜플 오인 + `rememberMe` snake_case 미매핑)이 동반됨 — 후자는 전자 때문에 도달 불가능했던 dead code였음이 diff 내 문서화되어 인과관계상 합리적 | `auth-oauth.service.ts`(AuthOAuthStateRow, handleCallback) | 조치 불요 |
| 5 | side_effect | 프로덕션에서 ~2개월 죽어 있던 분기 5개(admission cap 거절·동시 cancel 종결 이벤트·KB CAS 락 409·빈 KB idle 복귀)가 배포 즉시 재활성화 — 의도된 목적이며 plan 에 "배포 후 관측" 항목으로 등재됨 | `execution-engine.service.ts`(admitExecutionOrDefer, updateExecutionStatus), `knowledge-base.service.ts` | 조치 불요 — 배포 직후 짧은 모니터링 윈도우 권장 |
| 6 | side_effect | 공개 API 응답 필드 `graphRequeued`/`embeddingRequeued` 의 값 의미가 실질적으로 바뀜(이전엔 항상 고정에 가까운 오값, 이제 실제 재큐 문서 수) | `knowledge-base.service.ts:523,557,582`, controller:260-265 | 조치 불요 — 필요시 CHANGELOG/릴리스노트에 한 줄 권장 |
| 7 | maintainability | 같은 헬퍼 언랩 결과를 담는 지역 변수 이름이 `rowsOut`(2곳)과 `resetRows`(1곳)로 통일되지 않음 | `knowledge-base.service.ts:544,578` vs `:751` | `embeddingRows`/`graphRows`/`resetRows` 등으로 통일 권장 |
| 8 | testing | execution-engine admission "0행 매칭" 테스트가 이 PR 이 고친 버그 자체에는 판별력 없음(기존 라운드가 이미 확인·유예) | `execution-engine.service.spec.ts:4426` | 조치 불요(기존 유예 유지) |
| 9 | testing | e2e 거절 3케이스(만료·부재·provider 불일치)가 `error=` 존재 여부만 단언, 분기 구분 안 함(기존 라운드가 이미 확인·유예) | `auth-oauth-callback.e2e-spec.ts:110-134` | 조치 불요(기존 유예 유지) |
| 10 | database | `reEmbedAll` 의 CAS 락 UPDATE 와 문서 reset UPDATE 가 단일 트랜잭션으로 묶여 있지 않음(기존 구조, 이번 diff 는 shape 처리만 교체) — 자매 함수 `reExtractAll` 은 트랜잭션으로 묶여 있어 비대칭 | `knowledge-base.service.ts:714-761` | 조치 불요(스코프 밖, plan 후속 등재됨) — 다음에 손댈 때 `dataSource.transaction()` 고려 |
| 11 | database | 신규 e2e "만료된 state" 케이스가 심은 행이 DELETE 대상이 아니라(WHERE expires_at > NOW()) 테스트 후 정리되지 않음 | `auth-oauth-callback.e2e-spec.ts:110-115` | 필수 아님 — 명시적 cleanup 추가 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. 두 보안 가드(OAuth state, KB CAS 락)가 이 PR 로 정상 작동 복원 |
| requirement | NONE | 핵심 결함 처방 완결, 이전 라운드 CRITICAL 정정 확인, 관련 테스트 스위트 전부 GREEN |
| scope | LOW | 리뷰 산출물 비중 큼(컨벤션 부합, 문제 아님), 동반 버그 수정 1건(인과관계 문서화됨) |
| side_effect | LOW | 오랫동안 죽어있던 분기 5개 재활성화 + API 필드 값 의미 변화(둘 다 의도된 목적, plan 등재됨) |
| maintainability | LOW | 변수명 통일성 미흡 1건(INFO) |
| testing | LOW | assertRowArray 카운터 하드닝 비대칭(WARNING 1건) |
| documentation | LOW | CHANGELOG 소급 정정 불완전(WARNING 1건) |
| database | LOW | reEmbedAll 트랜잭션 미분리 + e2e 행 미정리(둘 다 기존/저위험 INFO) |

## 발견 없는 에이전트

- requirement (WARNING/CRITICAL 없음 — INFO 성격의 재확인 근거만 서술)

## 권장 조치사항

1. `assert-row-array.spec.ts:72` 의 `guards` 카운터에 `update-returning-rows.spec.ts` 의 주석 스트리핑 로직을 동일 적용해 자매 가드 간 하드닝 비대칭을 해소한다 (testing WARNING).
2. `CHANGELOG.md:312-316` 섹션에도 `finalizeGuarded` 0행-skip 방어가 `8332d9a20` 이전엔 발동하지 않았다는 소급 정정을 추가하거나, 두 섹션의 중복 서술을 통합한다 (documentation WARNING).
3. (저우선) `knowledge-base.service.ts` 의 `rowsOut`/`resetRows` 변수명을 통일하고, `reEmbedAll` 을 다음에 손댈 기회에 `reExtractAll` 과 동일하게 트랜잭션으로 묶는 것을 고려한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 7명 전원 결과 확보됨 — 화이트리스트 미이행 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(반환값 shape 언랩만 교체, 쿼리 텍스트/알고리즘 변경 없음)에 성능 영향 표면 없음 |
  | architecture | 기존 헬퍼 패턴(assertRowArray)과 동일 층위의 유틸 추가로 아키텍처 변경 없음 |
  | dependency | 신규/변경 외부 의존성 없음 |
  | concurrency | 신규 동시성 제어 로직 도입 아님(기존 advisory lock/트랜잭션 구조 유지, 반환값 해석만 교체) — 단 이 판단은 side_effect·database reviewer 가 실질적으로 동시성 관련 항목(CAS 락 재활성화 등)을 이미 커버함 |
  | api_contract | HTTP 요청/응답 스키마(JSON) 변경 없음(쿠키 Max-Age·내부 필드 값 의미 변화만) |
  | user_guide_sync | 사용자 대면 문서/가이드 변경 대상 아닌 순수 내부 버그 수정 |
