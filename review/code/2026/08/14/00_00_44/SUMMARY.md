# Code Review 통합 보고서

## 전체 위험도
**LOW** — 신규 취약점·기능 결함 없음. `updateReturningRows` 헬퍼로 TypeORM `UPDATE`/`DELETE … RETURNING` 튜플 shape 오인 버그(8개 소비 지점)를 정정하는 순수 버그 수정이며, 오히려 사문화돼 있던 admission cap·CAS 락·OAuth state anti-replay 방어가 되살아난다. 실질 WARNING 은 1건(OAuth 콜백 경로 e2e 부재)뿐이고, forced 화이트리스트 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 확보되어 미이행 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | user_guide_sync | 인증 흐름(OAuth 소셜 로그인 콜백) CRITICAL 버그 수정인데 e2e 보강이 없다. 매트릭스가 "가이드 갱신 + e2e 한 묶음"으로 명시한 `auth-session-flow-change` 항목 중 e2e 쪽이 비어 있다. 회귀 방어가 여전히 `dataSource.query` mock 경계 안쪽 unit 테스트에만 의존 — 드라이버/TypeORM 버전이 다시 바뀌어 shape 이 달라지면 mock 값이 실제 응답과 재차 괴리돼 같은 클래스 회귀를 다시 놓칠 수 있는 구조가 그대로 남는다. | `codebase/backend/src/modules/auth/auth-oauth.service.ts`(handleCallback), `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts`(unit mock 뿐) | `codebase/backend/test/auth-oauth.e2e-spec.ts` 등에 실제 테스트 DB에 `auth_oauth_state` 행을 심고 `/api/auth/oauth/callback` 왕복(정상 성공 + 만료/재사용 거절)을 검증하는 e2e 추가. plan 후속 체크리스트에 명시 등재 권고 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | OAuth `state` anti-replay 검사가 튜플 shape 오인으로 무력화돼 있던 결함을 바로잡는다(fail-closed 였어 실질 우회는 없었을 것으로 판단) | `auth-oauth.service.ts:137,146,153,160` | 조치 불요, 배포 후 관측 로그 확인 권장 |
| 2 | security | `updateReturningRows` 의 `detail` 문자열에 쓰이는 `provider` 는 화이트리스트 검증 후에만 사용되어 로그 인젝션 여지 없음 | `auth-oauth.service.ts:137,151` | 조치 불요 |
| 3 | security | 8개 소비 지점 모두 파라미터 바인딩 유지 — SQL 인젝션 신규 표면 없음 | execution-engine/knowledge-base/auth-oauth 각 UPDATE/DELETE | 조치 불요 |
| 4 | security | 하드코딩 시크릿·자격증명 없음(전수 grep) | 변경 전체 파일 | 조치 불요 |
| 5 | performance | `updateReturningRows` 는 O(1) 함수라 오버헤드 무시 가능 | `update-returning-rows.ts:36-57` | 조치 불요 |
| 6 | performance | N+1 신규 도입 없음, 8개 지점 모두 기존 단건 쿼리 유지 | execution-engine/knowledge-base 각 지점 | 조치 불요 |
| 7 | performance | 버그 수정으로 admission 경로의 2초 지연 우회가 없어져 오히려 성능 개선(e2e 4191→2242ms) | `execution-engine.service.ts` `admitExecutionOrDefer` | 조치 불요 |
| 8 | performance | 구조적 회귀 가드 테스트가 대형 소스 파일을 중복 `readFileSync` — 프로덕션과 무관, CI 영향 미미 | `update-returning-rows.spec.ts` | 급하지 않음, 여력 되면 파일 읽기 1회로 통합 |
| 9 | requirement | 과거 라운드 mutation/coverage 서술 정정을 위한 spec 각주 소급 반영이 plan 에만 등재, `project-planner` 턴 미착수 | `plan/in-progress/update-returning-tuple-shape.md` §후속 | 코드 리뷰 관점 조치 불요, planner 턴에서 5개 spec 문서에 각주 반영 |
| 10 | side_effect | 배포 후 이벤트/메트릭(`EXECUTION_STARTED`, `recordRunningSegmentStart`, `emitTerminalExecutionMetrics`) 발동 패턴이 실질적으로 달라진다 — 의도된 결과, 이중 발화 없음, plan 에 배포 관측 항목 등재됨 | `execution-engine.service.ts:2950-2961,8545-8577` | 조치 불요, 배포 시 대시보드 공유만 확인 |
| 11 | side_effect | KB 재추출/재임베딩 CAS 락 409 거절과 재큐 실제 documentId 전달이 처음으로 라이브가 됨 | `knowledge-base.service.ts` reExtractAll/reEmbedAll/retryFailedDocuments | 조치 불요, plan 추적 완료 |
| 12 | side_effect | 신규 헬퍼는 순수 함수, 전역상태/env/IO 없음 | `update-returning-rows.ts:36-57` | 없음 |
| 13 | side_effect | 커밋된 리뷰 산출물에 로컬 절대경로 기록 — 기존 저장소 관행, 이번 diff 신규 아님 | `review/**/_retry_state.json` | 조치 불요(범위 밖) |
| 14 | maintainability | `knowledge-base.service.ts` 내 헬퍼 반환값 변수명 불일치(`rowsOut` x2, `resetRows` x1) — 3라운드 연속 INFO 유예 | `knowledge-base.service.ts:544,578,751` | 급하지 않음, 다음 손볼 때 통일 |
| 15 | maintainability | 두 구조적 회귀 가드 스펙의 `SRC`/regex 보일러플레이트 중복 — 기존 유예("세 번째 가드 생기면 추출") | `assert-row-array.spec.ts:54`, `update-returning-rows.spec.ts:50` | 조치 불요(기존 유예 유지) |
| 16 | maintainability | `auth-oauth.service.ts` 호출 스타일이 나머지 7곳과 다름(인라인 await) — 의도적, 가드 주석에 근거 명시 | `auth-oauth.service.ts:146-152` | 조치 불요 |
| 17 | testing | OAuth 콜백 경로에 실제 드라이버/e2e 검증 없음(unit mock 뿐) — user_guide_sync WARNING 1 과 동일 갭의 testing 관점 서술 | `auth-oauth.service.spec.ts` | e2e 백로그 등재 권고(필수 아님) |
| 18 | testing | `updateReturningRows` 가 `[null,1]` 류 "형태 이상한 튜플"에 대한 명시적 테스트 없음(이론적 엣지케이스, 실측 근거 없음) | `update-returning-rows.ts` (`Array.isArray(result[0])` 분기) | 필수 아님, 여력 되면 1건 고정 |
| 19 | documentation | `knowledge-base.service.ts:727` 주석이 정의되지 않은 "①" 라벨을 참조(포워드 레퍼런스, 최초 커밋부터 존재, 5라운드 미지적) | `knowledge-base.service.ts:727` | 필수 아님, "① 과 같은" → 함수명/역할로 직접 지칭 권장 |
| 20 | documentation | `assertRowArray` JSDoc 이 자매 헬퍼 `updateReturningRows` 를 역참조하지 않음(3라운드 연속 "선택사항"으로 유예) | `assert-row-array.ts:1-15` | 조치 불요(기존 유예 유지) |
| 21 | documentation | CHANGELOG 미기재는 유실이 아니라 근거·구체 내용과 함께 plan 후속에 정상 추적 중 | `plan/in-progress/update-returning-tuple-shape.md` §후속 | 없음 |
| 22 | database | `reEmbedAll` 의 CAS 락 UPDATE→reset UPDATE→idle 복귀 UPDATE 세 단계가 단일 트랜잭션이 아님(기존 구조, 이번 diff 는 shape 처리만 교체) | `knowledge-base.service.ts` `reEmbedAll` | 조치 불요(스코프 밖), 추후 `reExtractAll` 처럼 `dataSource.transaction()` 으로 묶는 것을 별도 항목으로 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | OAuth state anti-replay 무력화 결함을 바로잡는 수정 확인, SQL 인젝션/시크릿 노출 없음 |
| performance | NONE | O(1) 헬퍼, N+1 없음, admission 지연 오히려 개선 |
| requirement | NONE | 구조적 가드 카운트 Node 재현 일치, 4개 jest 스위트 GREEN, spec 대조 일치 |
| scope | NONE | 828줄 코드/plan 변경이 plan 단일 결함과 1:1 대응, drive-by 변경 없음 |
| side_effect | LOW | 사문화됐던 이벤트/메트릭·CAS 락·재큐가 처음 라이브 — 의도된 결과, 이중 발화 없음 |
| maintainability | LOW | 이전 4라운드 WARNING 전부 해소 확인, 잔여는 3라운드 연속 유예된 INFO 뿐 |
| testing | LOW | OAuth 콜백 e2e 부재(경로 신뢰도는 unit-only), 극단 shape 테스트 미비 |
| documentation | NONE | 이전 CRITICAL 1건 + WARNING 다수 전부 해소 확인, 잔여 INFO 2건은 기존 유예 |
| database | LOW | reEmbedAll 3단계 비-트랜잭션 잔존(기존 구조), 그 외 트랜잭션/인덱스/N+1 문제 없음 |
| user_guide_sync | LOW | auth-session-flow-change 매칭 — 가이드는 이미 정확, e2e 쪽 WARNING 1건 |

## 발견 없는 에이전트

security, performance, requirement, scope, documentation — CRITICAL/WARNING 없음(INFO만 존재).

## 권장 조치사항
1. OAuth 소셜 로그인 콜백(`handleCallback`) 을 실제 DB 왕복으로 검증하는 e2e(스텁 provider 사용 가능)를 `codebase/backend/test/` 또는 `codebase/frontend/e2e/auth/**` 에 추가 — 4개월간 상시 실패했던 CRITICAL 결함 클래스의 재발을 mock 경계 밖에서 막는 유일한 방법 (WARNING #1, testing INFO #17 과 동일 갭).
2. (선택, 낮은 우선순위) `knowledge-base.service.ts` `reEmbedAll` 의 CAS 락 UPDATE + reset UPDATE 를 `reExtractAll` 과 동일하게 `dataSource.transaction()` 으로 묶어 프로세스 중단 시 좌초 가능성을 제거.
3. (선택, 급하지 않음) `rowsOut`/`resetRows` 변수명 통일, `assertRowArray` JSDoc 역참조 추가, `knowledge-base.service.ts:727` 의 "①" 포워드 레퍼런스를 함수명 기반 지칭으로 교체 — 전부 다회 라운드에 걸쳐 이미 유예된 스타일 항목으로 다음 해당 파일 수정 시 함께 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, requirement, scope, side_effect, maintainability, testing, documentation, database, user_guide_sync (10명)
  - **제외**: 아래 표 (4명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 7명 — 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단상 이번 변경(헬퍼 shape 정규화)이 아키텍처 경계에 영향 없음으로 제외 |
  | dependency | 의존성 추가/변경 없음으로 제외 |
  | concurrency | router 판단상 별도 concurrency 리뷰 불요(단, database/side_effect 에이전트가 트랜잭션·CAS 락 동시성을 부분적으로 커버함) |
  | api_contract | 컨트롤러/DTO/API 계약 변경 없음으로 제외 |

---

**forced 화이트리스트 이행 확인**: forced 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보(success + 전문 인라인 제공). 미이행 항목 없음 — "clean" 판정이 강제 화이트리스트 누락을 가리는 경우 아님.
