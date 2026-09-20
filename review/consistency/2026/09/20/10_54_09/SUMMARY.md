# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전문 확보, Critical 발견 없음.

## 전체 위험도
**LOW** — 코드 전용 방어 리팩터(SSRF 가드 소비자 4곳의 catch 를 `instanceof SsrfBlockedError` 로 가르는 변경)로 spec 계약 위반·명명 충돌은 없으나, 신규 "가드 고장" 분기를 반영하지 못한 spec 문서 완결성 갭 2건이 남아 있음(이미 트래커에 등재됨).

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | 신규 "SSRF 가드 판정 아닌 오류(가드 자체 고장)" 트리거가 `INTEGRATION_CALL_FAILED`/관련 코드의 "닫힌 열거"형 표에 미반영 | `spec/4-nodes/4-integration/0-common.md` §4.2, `1-http-request.md` §4 step 8·§6, `2-database-query.md` §6.2 | 병합된 코드(`http-request.handler.ts` 354-578행, `database-query.handler.ts` 262-345행)가 가드 고장 시 `IntegrationError('INTEGRATION_CALL_FAILED', …)` 를 명시적으로 던지는 4번째 경로를 추가했으나 세 문서는 여전히 완결된 열거처럼 읽힘. `1-http-request.md` §4 step 8은 "SSRF 가드 실패=항상 HTTP_BLOCKED" 로 조건 없이 서술해 같은 문서 §6과도 어긋남 | planner 턴에서 세 문서에 "SSRF 가드가 판정(`SsrfBlockedError`) 아닌 오류를 던졌을 때" 한 줄씩 추가. **이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 owner:planner 로 등재됨** — 신규 조치 아닌 회수 확인 |
| 2 | convention_compliance, cross_spec | `1-http-request.md` frontmatter `code:` 목록에 `http-redirect.ts` 누락 | `spec/4-nodes/4-integration/1-http-request.md` frontmatter `code:` (4개 항목만 나열) | 실제 워킹트리 `codebase/backend/src/nodes/integration/http-request/http-redirect.ts` — §4 step 9(리다이렉트 5홉 SSRF 재검증) 구현체이며 이번 PR 에서도 수정·신규 테스트(`http-redirect.spec.ts`) 추가됨. `spec-code-paths.test.ts` 는 "≥1 매치"만 요구해 이 갭으로는 안 깨짐 | 위 항목과 함께 planner 턴에서 `code:` 에 `http-redirect.ts` 추가. **이미 같은 트래커 항목에 병기돼 등재됨** |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance, rationale_continuity | 같은 근본 원인("가드 고장")이 preflight(`INTEGRATION_CALL_FAILED`/`DB_CONNECT_FAILED`) vs 리다이렉트 홉(`HTTP_TRANSPORT_FAILED`)에서 서로 다른 코드로 나가는 비대칭 | `http-request.handler.ts` preflight catch vs `http-redirect.ts` `followRedirectsSafely` 전송 catch | 신규 조치 불요 — `/ai-review` 3라운드가 W1/W2 로 이미 지적·수렴 처리(`review/code/2026/09/20/10_38_57` RESOLUTION), 오늘 가드의 유일한 비판정 오류는 API 단에서 실제 도달 불가함이 실측됨. 트래커에 두 해법 후보와 함께 등재됨 |
| 2 | rationale_continuity, convention_compliance | 가드 "고장" 메시지는 `sanitizeMessage`(자격증명 패턴만)만 거쳐 원문이 그대로 나가고, 차단 **판정**(§8.3)과 같은 host/IP 완전 제거 고정 문구를 쓰지 않음 — 판정 분기와 마스킹 강도 비대칭 | `http-request.handler.ts`/`database-query.handler.ts`/`database-connection-tester.ts` 신규 `if (!(err instanceof SsrfBlockedError))` 분기 | 신규 조치 불요 — 오늘 가드가 던질 수 있는 유일한 비판정 오류(`isBlockedHostname` 의 `TypeError`)에는 host/IP 가 없어 실제 유출 경로 없음(실측됨). 이미 트래커에 owner:developer·낮음으로 등재됨 |
| 3 | plan_coherence | 자식 plan(`plan/in-progress/ssrf-catch-instanceof.md`) 체크리스트 잔여 3건(`/ai-review` 수렴 · `--impl-done` · 트래커 해소·`plan/complete/` 이동) 미해소 | `plan/in-progress/ssrf-catch-instanceof.md` | 이번 `--impl-done`(본 검토)이 BLOCK: NO 로 수렴하므로, 마무리 커밋에서 체크리스트 3건 체크 + `plan/complete/` 로 이동 + 트래커의 선(先)-참조 경로 정합성 재확인 |
| 4 | convention_compliance | (범위 밖 참고) `spec-draft-nullable-notation-followups.md` 가 `plan/complete/ssrf-catch-instanceof.md` 를 선-참조하지만 실제 경로는 아직 `plan/in-progress/` | 트래커 문서 | `spec_impact: none` 이고 어떤 spec frontmatter 도 이 경로를 참조하지 않아 가드에 안 걸림 — 위 INFO#3 의 마무리 커밋에서 자연 해소 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 세 문서의 `INTEGRATION_CALL_FAILED` 열거가 신규 "가드 고장" 트리거를 못 담음(WARNING) + frontmatter `code:` 누락(INFO) |
| rationale_continuity | LOW | D4 라우팅·§8.2/§8.3·§6.3.1 C1/C2·`DB_HOST_BLOCKED` 전용 코드 등 기존 Rationale 재도입/번복 없음. 문서 갭·마스킹 비대칭은 이미 트래커 등재(INFO) |
| convention_compliance | LOW | error-codes.md/node-output.md 준수. frontmatter `code:` 누락 + 에러 코드 표 미등재 WARNING 2건(이미 트래커 등재), INFO 3건 |
| plan_coherence | NONE | target spec 계약과 충돌 없음. 자식 plan 체크리스트 3건 미해소(마무리 커밋 대기) |
| naming_collision | NONE | 신규 식별자 도입 없음 — 전부 기존 정의(`SsrfBlockedError`/`DB_CONNECT_FAILED`/`HTTP_CONNECT_FAILED`/`INTEGRATION_CALL_FAILED`/`sanitizeMessage`) 재사용, 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선 사항 없음 — BLOCK: NO)
2. 다음 `project-planner` 턴에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 이번에 등재된 항목(owner:planner)을 소비: (a) `0-common.md` §4.2 / `1-http-request.md` §4·§6 / `2-database-query.md` §6.2 세 문서에 "SSRF 가드가 판정 아닌 오류를 던진 경우" 한 줄씩 추가, (b) `1-http-request.md` frontmatter `code:` 에 `http-redirect.ts` 추가.
3. 이번 `--impl-done` 통과를 반영하는 마무리 커밋에서: `plan/in-progress/ssrf-catch-instanceof.md` 체크리스트 3건 체크 후 `plan/complete/` 로 이동, 트래커의 선-참조 경로가 그 시점에 정합해지는지 재확인.
4. INFO 항목(가드 고장 시 코드 비대칭, 마스킹 강도 비대칭)은 이미 실제 도달 불가가 실측돼 있으므로 즉시 조치 불요 — 트래커에 등재된 대로 후속 턴에서 처리.
