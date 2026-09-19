# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원이 전문 확보(success, 재시도 대상 없음)로 완료됐고, CRITICAL 판정은 어느 checker 에서도 나오지 않았다(전원 WARNING/INFO만 보고).

## 전체 위험도
**MEDIUM** — Critical 은 없으나, 서로 다른 checker 4곳이 독립적으로 실질적 WARNING(HTTP redirect 미추종의 gap 재도입, Google 자동갱신 자기모순, preview-test 예외 범위 문구 미개정, 신규 에러코드의 근접-동형 충돌, 관련 plan 교차참조 누락)을 보고했다 — spec 반영 시점에 함께 처리할 필요가 있다.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | HTTP 연결 테스트가 3xx redirect 를 따라가지 않아, `integration` 인증 노드의 실제 실행(최대 5홉 follow)과 어긋난다 — redirect 뒤에서만 인증을 거부하는 서비스는 `success: true` 로 오판될 수 있음. 이 PR 이 막으려는 문제(틀린 자격증명도 성공)의 축소판을 HTTP redirect 경로에 재도입 | §5.3 HTTP/REST — 테스트 item B, "리다이렉트는 따라가지 않고…" | `spec/4-nodes/4-integration/1-http-request.md` §4 실행 로직 step 9 (최대 5홉 follow + 매 홉 SSRF 재검증) | (a) 연결 테스트도 최소 1홉 follow(+SSRF 재검증)하도록 맞추거나, (b) "한계" 문단에 redirect 뒤 인증 거부는 검출 못 함을 명시 |
| 2 | cross_spec | item C 삽입문 "Google 은 토큰 갱신도 없다"가 같은 문서 다른 절의 "Google 도 자동 갱신을 보장한다" 서술과 병합 후 명시적으로 자기모순됨(둘 다 코드 대조로 사실 확인 결과 draft 쪽이 맞고 §9.1/§10.3/§10.5 쪽이 기존 drift) | §5.1 Google — 테스트 item C Rationale 삽입문 | 같은 파일 §9.1(`autoRefresh` 설명) · §10.3(provider 표 Google Refresh ✓) · §10.5("google" 자동갱신 보장 서술) | §5.1 삽입문에 §9.1/§10.3/§10.5 상충 각주 추가. 여력 있으면 같은 PR 에서 §9.1/§10.3/§10.5 Google 행에도 "문서상 지원이나 refresh 미구현" caveat 동시 추가 |
| 3 | rationale_continuity | §9.2 preview-test "외부 호출 없음" 원칙을 Cafe24 하나에서 MakeShop·Google·GitHub·Webhook 넷으로 확장하면서, 그 경계를 "Cafe24 한정"이라 못박은 옛 Rationale 문장과 §5.5 본문의 대조 서술("Cafe24 의 사전 검증이 외부 호출을 하지 않는 것과 의도적으로 다르다")을 개정하지 않고 그대로 남김 — 정합 판단 근거를 다음 독자가 못 찾음 | draft §E(§9.2 표 변경) + 신설 §G Rationale | 기존 `## Rationale` "SMTP 연결 테스트를 verify() 로 구현" 항의 "Cafe24 한정" 문구, §5.5 본문 대조 서술 | 신설 G 항목에 "preview-test 외부 호출 없음 원칙 범위 갱신" 한 문장 추가(Cafe24·MakeShop vs Google·GitHub·Webhook 사유 구분), 옛 항목에 forward-reference/취소선 정정, §5.5 본문도 같은 타이밍에 갱신 |
| 4 | plan_coherence | target 이 "같은 PR" 로 예정한 developer 구현이 `IntegrationsService.dispatchTest` 응답 shape 을 건드리는데, 같은 endpoint/DTO 를 이미 다른 in-progress plan 이 겨누고 있어(MCP 전용 필드 3종 미선언 + `assertMatchesContract` 미배선) 그 사실을 인지·교차참조하지 않음 | 체크리스트 3번째 항목("구현 — --impl-prep · 테스터 둘…") / `## 비대상` 절 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3403` (`/api/integrations/:id/test` MCP 전용 응답 필드 미선언 항목) | `## 비대상` 또는 `## Rationale` 에 해당 plan 포인터 한 줄 추가(합칠 필요는 없음, 조율 메모) |
| 5 | naming_collision | 신규 `DB_CONNECT_FAILED` 가 기존 `DB_CONNECTION_ERROR` 와 철자가 거의 동일(`DB_CONNECT` 까지 완전 겹침)한데, 정확히 같은 driver 조건(PostgreSQL class 28 · MySQL `ER_ACCESS_DENIED_ERROR`)을 기존은 포함(母집합 큼, credential-rotation retry 통일 목적)하고 신규는 `DB_AUTH_FAILED` 로 분리해 제외(母집합 다름) — 근접 동형인데 母집합이 반대인 최초 사례 | §A(490행 부근) · §F 신규 코드 vocabulary 행 | `codebase/backend/src/nodes/core/error-codes.ts:32` `ErrorCode.DB_CONNECTION_ERROR`, `database-query.handler.ts` `classifyDbError` 계열, `spec/4-nodes/4-integration/2-database-query.md:340,348`, 회귀 테스트(`database-query.handler.spec.ts:614-626,865-879`) | §A/§F 본문에 "`DB_CONNECT_FAILED` 는 노드 런타임 `DB_CONNECTION_ERROR`(handshake 인증 포함)와 母집합이 다르다 — 인증 실패는 `DB_AUTH_FAILED` 로 먼저 분리"라는 대비 문장 추가 (이름 자체 변경보다 이 방법을 권장 — 기존 `_CONNECT_FAILED` 접미 패턴 유지) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | item D 괄호 설명 부정확 — Cafe24 Private·MakeShop 은 애초 preview-test(Step 3) 자체를 거치지 않고 `pending_install` 로 직행하는데 "OAuth 서비스 넷 모두 preview-test 가 구조 검증만" 이라 뭉뚱그림 | item D 아래 괄호 | "Google·GitHub·Cafe24 Public 은 preview-test 가 구조 검증만; Cafe24 Private·MakeShop 은 애초 Step 3 를 타지 않고 pending_install 로 직행(§3.2)" 로 정정. spec 본문에 그대로 옮겨 적힐 경우 WARNING 이상으로 격상 필요 |
| 2 | cross_spec + naming_collision (병합) | 신규 5개 코드가 기존 노드-런타임 코드와 이름이 근접해(`DB_CONNECTION_ERROR`/`DB_CONNECT_FAILED`, `HTTP_5XX`/`HTTP_SERVER_ERROR`, HTTP 3종 전반) 두 namespace(노드 `output.error.code` vs `IntegrationTestResult.code`) 혼동 소지. DB 쌍은 위 WARNING #5 로 이미 격상됨 | item F/G, §14.1 신규 5행 | G Rationale 에 근접-쌍 명시적 나열 + §14.1 신규 5행 각각에 `EMAIL_CONNECT_FAILED` 행과 동일한 "노드 런타임과 별개" 대비 설명 추가 |
| 3 | cross_spec | §4.3 Rotate credentials·§9.4 `INTEGRATION_TEST_FAILED` 어디에도 "HTTP 는 401/403 반환 시에만 자격증명 거부 검출" 한계가 상호참조되지 않아 §4.3 만 읽으면 오해 소지 | item B Rationale vs §4.3/§9.4 | §4.3 또는 §9.4 에 "HTTP 통합은 base_url 이 401/403 반환하는 경우에만 자격증명 거부 검출(§5.3)" 각주 추가 |
| 4 | rationale_continuity | DB 연결 테스트가 노드 실행 경로의 커넥션 풀(§2-database-query.md Rationale, pub/sub 무효화)을 우회한다는 사실이 명시되지 않아 향후 "연결 테스트도 풀에 편입시켜야 하나" 혼동 소지 | §5.4 item A / 신설 G | "이 일회성 연결은 노드 실행 경로의 커넥션 풀과 별개이며 그 풀에 캐시되지 않는다" 한 줄 추가 |
| 5 | rationale_continuity | DB·HTTP 연결 테스트 실패가 `consecutive_network_failures` 카운터에서 제외됨(구조적으로는 이미 배제되나 명시 선례는 Cafe24 뿐)이 문서화되지 않음 | 신설 G Rationale | "DB·HTTP 연결 테스트 실패도 consecutive_network_failures 에 합산하지 않는다(연결 테스트 endpoint 카운터 제외 선례 확장)" 한 문장 추가 |
| 6 | convention_compliance | checker 입력 번들이 예산 초과로 `node-output.md`·`swagger.md`·`secret-store.md` 등 다수 conventions 파일을 절단(harness 레벨 기존 이슈, target 결함 아님). 이번엔 저장소 원본을 직접 열어 보강해 결론에 영향 없음 | 검토 payload 자체 | target 수정 불요 — `--spec` 번들 예산 이슈로 별도 트래킹(기존에 알려진 이슈) |
| 7 | convention_compliance | §14.1 신규 다섯 행 중 "원인" 칸이 draft 단계에서 행 단위로 아직 완결되지 않음(§5.3/§5.4 본문 서술을 표로 옮기는 작업이 남음) | item F | spec 반영 단계(체크리스트 2번)에서 A·B 항목 조건 서술을 "원인" 칸에 옮기면 기존 표 포맷과 자연히 맞음 — 특별 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | HTTP redirect 미추종 gap 재도입(WARNING) + Google 자동갱신 자기모순(WARNING) |
| rationale_continuity | MEDIUM | §9.2 preview-test "외부 호출 없음" 예외 확장 시 옛 "Cafe24 한정" 문구 미개정(WARNING) |
| convention_compliance | NONE | CRITICAL/WARNING 없음. error-codes.md 명명규약·네임스페이스 분리 전부 준수 확인(신규 5개 코드 grep 0건 실증) |
| plan_coherence | LOW | 같은 endpoint/DTO 겨누는 `spec-draft-nullable-notation-followups.md` 미해결 항목과 교차참조 누락(WARNING) |
| naming_collision | LOW | `DB_CONNECT_FAILED` vs 기존 `DB_CONNECTION_ERROR` 근접-동형·母집합 불일치(WARNING), HTTP 3종은 INFO |

## 권장 조치사항

1. spec 반영 시(`spec/2-navigation/4-integration.md` 편집 시점) §9.2/§5.5/Rationale 세 지점을 한 커밋에서 함께 갱신 — "Cafe24 한정" 옛 문구가 새 4-서비스 확장과 병존해 자기모순되는 상태로 커밋되지 않도록(WARNING #3).
2. 같은 커밋에서 §5.1 Google Rationale 삽입문에 §9.1/§10.3/§10.5 상충 각주 추가(WARNING #2) — 이미 이번 조사로 사실관계(refresh 미구현)가 확정됐으므로 가능하면 §9.1/§10.3/§10.5 Google 행도 함께 정정.
3. HTTP 연결 테스트의 redirect 미추종 한계를 "한계" 문단에 명시하거나 최소 1홉 follow 로 설계를 조정(WARNING #1) — 어느 쪽이든 §4.3/§9.4 상호참조도 함께 추가(INFO #3).
4. §A/§F 본문에 `DB_CONNECT_FAILED` vs `DB_CONNECTION_ERROR` 母집합 차이 대비 문장 추가(WARNING #5), §14.1 신규 5행에 `EMAIL_CONNECT_FAILED` 식 "노드 런타임과 별개" 설명 병기(INFO #2).
5. `## 비대상` 또는 `## Rationale` 에 `spec-draft-nullable-notation-followups.md:3403` 포인터 한 줄 추가해 developer 턴이 같은 endpoint 를 만질 것을 인지하도록 조율(WARNING #4).
6. 커넥션 풀 비편입 명시(INFO #4), `consecutive_network_failures` 제외 명시(INFO #5), item D 괄호 정정(INFO #1)은 저비용이므로 같은 PR 에서 함께 반영 권장.
