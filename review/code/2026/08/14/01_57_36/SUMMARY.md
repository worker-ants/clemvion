# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — CRITICAL 없음. 핵심 diff(TypeORM `UPDATE`/`DELETE … RETURNING` 튜플 shape 오인 8곳 수정)는 이미 9라운드 이상의 리뷰를 거쳐 정리됐고 이번 라운드의 신규 CRITICAL 은 없다. 다만 (1) side_effect 가 지적한 "지금까지 사실상 죽어 있던 프로덕션 분기(이벤트 발행·메트릭·409 거절·복구 UPDATE)가 배포 즉시 실제로 살아난다"는 큰 blast radius WARNING, (2) documentation 이 지적한 정본 plan 문서(`update-returning-tuple-shape.md`) 내부 "7곳"/"8곳" 숫자 불일치 WARNING, (3) maintainability 가 지적한 자매 회귀 가드 정규식 미통합 WARNING 이 남아 있어 LOW 가 아닌 MEDIUM 으로 유지한다. **forced(router_safety) 화이트리스트 7명(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보됨 — 누락 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | 이번 diff 는 TypeORM 튜플 shape 오인으로 지금까지 프로덕션에서 한 번도 발동한 적 없던 4갈래 분기(admission `EXECUTION_STARTED` 이벤트 발행, 2초 재큐 지연 소멸, KB 재추출/재임베딩 CAS 락의 409 거절, `updateExecutionStatus`의 종료 메트릭 기록)를 배포 즉시 실제로 살려낸다 — blast radius 가 커 관측이 필요하다 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`admitExecutionOrDefer`, `updateExecutionStatus`), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (`reExtractAll`/`reEmbedAll` CAS 락) | 이미 CHANGELOG·plan(`update-returning-tuple-shape.md` §후속)에 "배포 후 관측" 항목으로 등재됨 — 조치 불요이나, 롤아웃 직후 4갈래를 한 체크리스트로 묶어 모니터링 권장 |
| 2 | documentation | `plan/in-progress/update-returning-tuple-shape.md` 가 결함 범위를 "7곳"(frontmatter 제목·`:73`·`:188` 처방 섹션·`:216` checklist)과 "8곳"(`:57` 섹션 제목·CHANGELOG) 두 숫자로 동시 서술 — `auth-oauth.service.ts` 를 8번째 지점으로 추가한 커밋이 섹션 제목만 고치고 본문 3곳·checklist 를 놓침. 이 문서는 4개 다른 plan 파일이 "근거"로 링크하는 정본 참조라 불일치가 전파될 수 있음 | `plan/in-progress/update-returning-tuple-shape.md:2,73,188,216` vs `:57` | `:2`·`:73`·`:188`·`:216` 의 "7곳"을 "8곳"으로 정정하거나, 1차 감사 시점 서술("당시 찾은 7곳")과 현재 상태(8곳)를 구분해 명시 |
| 3 | maintainability | 두 구조적 회귀 가드(`assert-row-array.spec.ts`, `update-returning-rows.spec.ts`)의 "소비 지점을 찾는" 정규식(`CONSUMING_QUERY`/`CONSUMING`)이 글자 하나까지 동일하게 복제돼 있음 — `countCalls`/`stripComments` 는 이번 라운드에 `source-scan.ts` 로 통합됐지만 이 정규식은 통합되지 않아 향후 한쪽만 고치고 다른 쪽을 잊는 drift 위험이 남음 | `codebase/backend/src/common/utils/assert-row-array.spec.ts:62-63`, `codebase/backend/src/common/utils/update-returning-rows.spec.ts:54` | `source-scan.ts` 에 `countConsumingQueryStatements(src)` 류로 함께 이관하거나, 최소한 "자매 파일과 동일해야 한다" 주석을 양쪽에 남김 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 이 PR 은 새 취약점이 아니라 기존 취약점(OAuth state anti-replay 검증이 튜플 오인으로 무력화 — 다만 fail-closed 라 실질 우회는 없었음)을 바로잡는다 | `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`handleCallback`) | 조치 불요, 배포 후 "state 재사용/만료 거절" 발동 로그 확인 권장 |
| 2 | security | 신규/변경 raw SQL 전부 파라미터 바인딩 유지, SQL 인젝션 신규 표면 없음 | 8개 소비 지점 전체 | 조치 불요 |
| 3 | security | `remember_me` 컬럼명 대소문자 불일치로 "로그인 유지"가 항상 무시되던 별개 결함도 함께 수정됨 — 항상 더 보수적(짧은 만료)이던 방향이라 보안 영향 없음 | `codebase/backend/src/modules/auth/auth-oauth.service.ts` | 조치 불요 |
| 4 | security | 하드코딩된 시크릿/자격증명/API 키 없음 | 변경 파일 전체 | 조치 불요 |
| 5 | requirement | `updateReturningRows` 헬퍼가 TypeORM 0.3.31+pg 튜플 shape 을 정확히 흡수, 8곳 소비 지점 전수 적용을 구조적 가드로 재확인. `spec/data-flow/2-auth.md:128` 서술과도 정합(코드가 spec 을 따라가는 정상 수정) | `codebase/backend/src/common/utils/update-returning-rows.ts:55-76` | 조치 불요 |
| 6 | requirement | `spec_impact` 5개 spec 문서 소급 caveat 은 `developer` 권한 밖이라 `spec-update-node-cancellation-shutdown-classification.md` 에 project-planner 위임으로 정확히 등재됨 | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` | project-planner 턴에서 후속 반영 |
| 7 | scope | CHANGELOG 가 이번 결함과 무관해 보이는 과거 두 기능 엔트리에도 "소급 정정" 인용을 추가 — 같은 근본 원인의 정직한 후속 정정으로 확인됨, scope 위반 아님 | `CHANGELOG.md` | 조치 불요 |
| 8 | scope | `__testing__` → `common/__test-utils__/source-scan.*` 리팩토링은 직전 라운드 자신의 WARNING 에 대한 즉시 조치, `tsconfig.build.json` 순변경 0 | `codebase/backend/src/common/__test-utils__/source-scan.ts` | 조치 불요 |
| 9 | scope | `review/**` 117개 신규 파일은 SoT 저장 관례에 따른 정상 커밋 대상(6라운드 fix↔review 루프 산출물) | `review/code/2026/08/13/**`, `review/consistency/2026/08/13/**` | 조치 불요 |
| 10 | maintainability | `knowledge-base.service.ts` 5개 호출부의 지역 변수명이 `rowsOut`/`resetRows` 로 불통일 | `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:544,578,752` | 하나의 명명 규칙으로 통일 |
| 11 | maintainability | `updateReturningRows`/`assertRowArray` 첫 파라미터 이름이 `result` vs `rows` 로 다름 — JSDoc 은 "같은 계약"이라 서술 | `update-returning-rows.ts:56` vs `assert-row-array.ts:31` | 둘 다 동일 이름으로 통일 |
| 12 | maintainability | `assertRowArray` JSDoc 의 `{@link updateReturningRows}` 가 미임포트 심벌을 가리켜 링크 미해석 가능 | `assert-row-array.ts:16` | 급하지 않음 — type-only import 추가 또는 코드 스팬으로 낮춤 |
| 13 | maintainability | `auth-oauth.service.spec.ts` 에 "결함을 가린 원흉"으로 지목된 `[validState]` 행-배열 mock 형태가 4곳 남음 — 헬퍼가 양쪽 shape 모두 허용하므로 기능 안전, e2e 가 별도로 실 shape 고정 | `auth-oauth.service.spec.ts:276,296,313,327` | 필수 아님 — 시간 될 때 튜플 형태로 통일 또는 의도적 잔존 주석 추가 |
| 14 | maintainability | e2e 시드 헬퍼의 SQL VALUES 절에서 `$4` 가 `$3` 보다 먼저 등장(매핑은 정확) | `test/auth-oauth-callback.e2e-spec.ts:42-43` | 컬럼 순서 또는 params 순서를 등장 순서에 맞춤 |
| 15 | maintainability | `knowledge-base.service.ts` 5개 호출부가 "raw query→언랩→사용" 3단 관용구를 거의 동일하게 반복 | `knowledge-base.service.ts:336-755` 5개 지점 | 급하지 않음 — 6번째 유사 지점 생기면 추출 고려 |
| 16 | testing | `auth-oauth.service.spec.ts` 의 `handleCallback` 테스트 10건 중 7건이 여전히 비-튜플(`[validState]`) mock — 기능 안전(헬퍼가 양쪽 허용), e2e 가 실 shape 보완, plan 이 얇은 DB 래퍼 도입을 backlog 로 추적 중 | `auth-oauth.service.spec.ts` `describe('handleCallback')` | 즉시 조치 불요, 다음 raw UPDATE/DELETE 추가 PR 에서 전용 튜플 mock 체크리스트화 권장 |
| 17 | testing | 두 자매 가드의 `SRC` 경로 계산·`readFileSync` 루프가 여전히 각자 인라인 반복 (`countCalls`/`stripComments` 통합과 별개) | `assert-row-array.spec.ts`, `update-returning-rows.spec.ts` | 조치 불요(기존 유예 유지, 세 번째 유사 가드 생길 때 추출) |
| 18 | database | `reEmbedAll` 의 CAS 락 UPDATE 와 reset UPDATE 가 여전히 트랜잭션 밖 별도 문장 — 크래시 시 `reembed_status='in_progress'` 로 좌초 가능(이번 diff 로 도입된 문제 아님, 기존 구조). `reExtractAll` 은 이미 트랜잭션으로 닫혀 있어 비대칭 | `knowledge-base.service.ts` `reEmbedAll` (~720, ~740행) | PR 범위 밖 — `reExtractAll` 과 동일하게 `dataSource.transaction()` 으로 묶는 후속 정리 고려 |
| 19 | database | raw query 결과 타입이 `unknown` 으로 전환됨 — 검증 안 되던 예전 제네릭 주장을 런타임 판별로 대체한 개선 | `execution-engine.service.ts`, `knowledge-base.service.ts` | 조치 불요(개선으로 평가) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 기존 OAuth state anti-replay 무력화 결함을 바로잡는 순수 개선, 신규 취약점 없음 |
| requirement | NONE | 헬퍼 로직·8곳 소비 지점 전수·spec 정합 모두 직접 재검증해 일치 확인 |
| scope | LOW | 핵심 diff 는 단일 근본 원인에 수렴, CHANGELOG/리팩토링 확장은 근거 있는 파급 |
| side_effect | MEDIUM | 사문화됐던 4갈래 프로덕션 분기가 배포 즉시 살아남(WARNING, 이미 문서화됨) |
| maintainability | LOW | 자매 가드 정규식 미통합 WARNING 1건 + 명명/문서링크 수준 INFO 다수 |
| testing | LOW | 546+ 테스트 GREEN, tsc baseline 일치, 신규 CRITICAL/WARNING 없음 |
| documentation | LOW | plan 정본 문서의 "7곳"/"8곳" 숫자 불일치 WARNING 1건 |
| database | NONE | 8곳 튜플 오인 CRITICAL 결함을 정확히 수정, SQL 인젝션·트랜잭션 회귀 없음 |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원이 최소 1건 이상(INFO 포함)의 발견사항을 보고함.

## 권장 조치사항

1. `plan/in-progress/update-returning-tuple-shape.md` 의 "7곳"/"8곳" 숫자 불일치를 정정한다 — 이 문서가 4개 다른 plan 파일의 근거로 링크되므로 우선순위 높음 (documentation WARNING 2).
2. 배포 직후 side_effect 가 지적한 4갈래(이벤트 발행·admission 지연 소멸·KB CAS 409·종료 메트릭)를 한 체크리스트로 묶어 모니터링한다 — 이미 plan 에 등재된 계획과 일치시켜 실행만 남았음 (side_effect WARNING 1).
3. 여유가 있을 때 두 구조적 회귀 가드의 `CONSUMING_QUERY`/`CONSUMING` 정규식을 `source-scan.ts` 로 통합하거나 최소 "자매 파일과 동일해야 한다" 주석을 남긴다 (maintainability WARNING 3).
4. (급하지 않음) `knowledge-base.service.ts` 변수명 통일, 헬퍼 파라미터명 통일, `auth-oauth.service.spec.ts` 잔존 비-튜플 mock 정리, `reEmbedAll` CAS+reset 트랜잭션 묶기는 다음 관련 작업 시 함께 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, database (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명, 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 관련성 낮음 |
  | architecture | router 판단상 이번 diff 와 관련성 낮음 |
  | dependency | router 판단상 이번 diff 와 관련성 낮음 |
  | concurrency | router 판단상 이번 diff 와 관련성 낮음 |
  | api_contract | router 판단상 이번 diff 와 관련성 낮음 |
  | user_guide_sync | router 판단상 이번 diff 와 관련성 낮음 |