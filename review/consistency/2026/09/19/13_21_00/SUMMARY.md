# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 success, 전문 확보 완료)

## 전체 위험도
**MEDIUM** — Critical 없음. `INTEGRATION_TEST_FAILED` 상태코드 삼각 불일치(400/422)와 HTTP 연결
테스터의 SSRF 메시지 일반화 미계승(내부 IP/hostname 노출 가능) 두 건이 구현 착수 전 정리할
가치가 있는 WARNING.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 CRITICAL 이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드가 3곳에서 어긋남(422 vs 400) — 이번 PR 이 Database·HTTP rotate 실패 경로를 처음 이 예외에 태우고 400 을 기대하는 e2e 로 굳히려는 지점 | `spec/2-navigation/4-integration.md` §9.4 (`INTEGRATION_TEST_FAILED (422)`) | `spec/5-system/11-mcp-client.md:539`("BadRequestException, HTTP 400" 실측 서술) · `spec/5-system/2-api-convention.md §6`(422=비즈니스 로직 오류 원칙, 의미상 422 지지) | `plan/in-progress/integration-db-http-testers.md` 트래커 언급에 두 근거를 함께 적어 "단순 미구현"이 아니라 "spec 3곳 불일치"임을 명시. 또는 `error-codes.md §3` historical-artifact 레지스트리에 등재. 또는 preview-test/`:id/test`(200+success:false)처럼 rotate 도 예외를 던지지 않는 방향으로 통일해 400/422 논쟁 자체를 제거 |
| 2 | rationale_continuity | HTTP 연결 테스터가 SSRF 차단 메시지 일반화(정찰면 축소) invariant 를 명시적으로 계승하지 않음 — 리다이렉트 홉이 내부 IP/hostname 으로 향할 경우 API 응답에 그대로 노출될 위험 | `plan/in-progress/integration-db-http-testers.md` §설계 HTTP 불릿(SSRF → `HTTP_BLOCKED`, "메시지 일반화" 문구 누락 — DB 불릿엔 있음) | `spec/4-nodes/4-integration/2-database-query.md` `## Rationale`("HTTP_BLOCKED 도 2026-07-05 동일 일반화 완료" 명시) · 실제 구현 `http-request.handler.ts` 의 `SSRF_BLOCKED_CLIENT_MESSAGE` 치환 로직 | plan 의 HTTP 테스터 불릿에 "SSRF → `HTTP_BLOCKED`(메시지 일반화, 노드와 같은 `SSRF_BLOCKED_CLIENT_MESSAGE` 재사용, 원본은 `logger.warn`)" 명시. 예외로 두려면 `spec/2-navigation/4-integration.md` Rationale 에 그 예외와 적용 범위(첫 홉 vs 리다이렉트 홉)를 새로 명시 |
| 3 | plan_coherence | spec-draft 가 "developer 턴 확인" 으로 명시 위임한 DTO 두 항목(`PreviewTestResultDto`/`TestConnectionResultDto` 의 `code` 미선언)이 구현 plan 체크리스트에 안착하지 않음 — 이번 PR 이 preview-test 경로에서도 신규 `DB_*`/`HTTP_*` 코드값을 실제로 생산하게 되어 결함 표면이 넓어짐 | `plan/in-progress/integration-db-http-testers.md` `## 체크리스트`(7항목 중 DTO 확인 항목 없음) | `plan/in-progress/spec-draft-integration-connection-tests.md` `## 비대상`(교차참조) · `plan/in-progress/spec-draft-nullable-notation-followups.md` L3403·L3592(미체크 트래커 항목) | 체크리스트에 "PreviewTestResultDto/TestConnectionResultDto `code` 서술 확인" 항목 명시 추가. 최소한 두 트래커 항목에 "integration-db-http-testers PR 이 신규 코드값을 추가 생산함" 역참조 남길 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | §6 캐비엇의 `§9.3` 참조가 실제로는 `§9.2`(pending_install 가드/`INTEGRATION_INCOMPLETE`)를 가리킴(사전 존재) | `spec/2-navigation/4-integration.md:742` | `§9.3` → `§9.2` 정정 (필수 아님) |
| 2 | cross_spec | 신규 5개 에러 코드(`DB_AUTH_FAILED` 등) 저장소 전체 grep 0건 재확인 — 이전 라운드 우려 해소, `status_reason` 소문자 충돌도 해소됨 | §14.1 | 조치 불요 (확인 기록) |
| 3 | convention_compliance | `IntegrationTestResult` 응답 서술이 문서 전반에서 `{ data: ... }` 봉투 없이 축약 서술(§9.4 가 이미 일반 규칙 선언, 대응 DTO/wrapper 는 실제로 올바르게 구현됨) | §5.3·§5.4·§9.1·§9.4 | §5.x 상단에 "값은 §9.4 의 `data` 내부" 캐비엇 추가 (선택) |
| 4 | convention_compliance | §5.4(선행 절)가 §5.5(후행 절)를 전방 참조 | §5.4:506 | 근거를 `error-codes.md` 또는 최초 도입 절로 통일 (선택) |
| 5 | plan_coherence | `spec-draft-integration-connection-tests.md` 의 "spec 반영(planner 커밋)" 체크리스트 항목이 이미 커밋(`74087dff6`)됐는데도 미체크 | `plan/in-progress/spec-draft-integration-connection-tests.md` `## 체크리스트` | 체크 완료로 갱신 |
| 6 | naming_collision | 신규 두 행이 인용하는 기존 `HTTP_{status}` 표기가 실제 코드 리터럴(`HTTP_4XX`/`HTTP_5XX`)과 문자 그대로 다름(기존 행, 이번 target 이 만든 문제 아님) | §14.1 `HTTP_{status}` 행 | 후속으로 `HTTP_4XX`/`HTTP_5XX` 로 정정 (이번 PR 필수 아님) |
| 7 | naming_collision | 신규 테스터 파일 두 개의 실제 경로/이름 미확정 — 충돌 판정 보류(선례 검색은 0건 확인됨) | `plan/in-progress/integration-db-http-testers.md` §설계 | 구현 착수 시 `database-connection-tester.ts`/`http-connection-tester.ts` 등 "connection-tester" 접미 계열로 명시하고 plan 에 확정 기재 |
| 8 | naming_collision | 신규 requirement ID·endpoint·이벤트명·ENV var 도입 없음 확인 | 전체 diff | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `INTEGRATION_TEST_FAILED` 상태코드 400(mcp-client.md 실측)/422(4-integration.md·api-convention.md) 삼각 불일치, 이번 PR 이 e2e 로 굳히려는 지점 |
| rationale_continuity | MEDIUM | HTTP 연결 테스터가 SSRF 메시지 일반화 invariant 를 명시적으로 계승하지 않아 리다이렉트 홉의 내부 IP/hostname 노출 위험 |
| convention_compliance | LOW | 정식 규약(`error-codes.md`/`audit-actions.md`/`swagger.md`/`review-citations.md`) 위반 없음. 오히려 기존 소문자 에러 코드 위반을 스스로 정정. 응답 봉투 축약 서술은 INFO |
| plan_coherence | LOW | spec-draft 가 위임한 DTO(`code` 미선언) 확인 항목이 구현 plan 체크리스트에 미반영 |
| naming_collision | NONE | 신규 에러 코드 5종 전량 grep 0건으로 충돌 없음 확인. 새 requirement ID/endpoint/env var 도입 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선 항목 없음 — 아래는 구현 착수 전 정리 권장 순)
2. HTTP 연결 테스터 구현 시 `SSRF_BLOCKED_CLIENT_MESSAGE` 재사용을 plan 에 명시(WARNING #2) — 정보 노출 방지 차원에서 구현 코드 작성 전에 반영
3. `INTEGRATION_TEST_FAILED` 400/422 불일치를 트래커에 근거(mcp-client.md:539, api-convention.md §6)와 함께 명시하거나 예외-미던짐 방향 검토(WARNING #1) — e2e 로 400 을 고정하기 전에 결정
4. 구현 plan 체크리스트에 `PreviewTestResultDto`/`TestConnectionResultDto` `code` 확인 항목 추가 + 트래커 역참조(WARNING #3)
5. INFO 8건은 여유 있을 때 정정(§9.3→§9.2 오기재, spec-draft 체크리스트 동기화, `HTTP_{status}` 표기 정정, 테스터 파일명 확정 등)
