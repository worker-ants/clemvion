# 변경 범위(Scope) Review — SSRF 에러 메시지 일반화 (HTTP Request, 재실행 13_54_11)

대상 changeset: 27개 파일. 핵심 코드 2개(`http-request.handler.ts`, `.spec.ts`), spec 문서 3개(`1-http-request.md`, `2-database-query.md`, `spec/2-navigation/4-integration.md`), 무관 spec 오타 1개(`spec/5-system/2-api-convention.md`), 나머지 21개는 선행 `--impl-prep` consistency-check 산출물(`review/consistency/2026/07/05/12_55_17/**`, 8개) + 직전 code-review 산출물(`review/code/2026/07/05/13_32_17/**`, 13개, 본 재실행의 SUMMARY/RESOLUTION 포함)이다.

비교 근거: `plan/in-progress/http-ssrf-all-auth-followups.md` 14행 미체크 항목("SSRF 에러 메시지 클라이언트 일반화: http-safety.ts 의 SSRF_BLOCKED: hostname "..." 메시지가 차단 host/IP 를 output.error.message 로 노출(정찰 면). 클라이언트엔 일반화, 상세는 서버 로그 — http-safety 는 HTTP/DB/Email 공용이라 3노드 영향 audit 동반"), `review/consistency/2026/07/05/12_55_17/SUMMARY.md` 의 "확정 작업 스코프" 1~4항, 직전 review 의 `review/code/2026/07/05/13_32_17/RESOLUTION.md`(WARNING#1 fix 지시).

## 발견사항

- **[INFO]** 핵심 코드 변경(`http-request.handler.ts`)은 plan 항목·직전 리뷰 WARNING#1 을 정확히 좁게 이행
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`
  - 상세: 이번 diff(직전 13_32_17 세션 대비 증분)는 (1) preflight SSRF catch 에 `logger.warn` 원본 보존 추가, (2) `logUsage` error.message 를 `SSRF_BLOCKED_CLIENT_MESSAGE` 로 일반화(직전 리뷰 security WARNING#1 정확히 해소), (3) redirect 한도초과·redirect 대상 재검증 실패를 각각 `IntegrationError(HTTP_BLOCKED)` 로 승격 + `logger.warn` 추가, (4) 바깥 catch 에 `IntegrationError` 분기 신설. 4가지 모두 plan 항목("일반화 + 3노드 audit")과 직전 SUMMARY WARNING#1("logUsage 도 일반화, logger.warn 은 원본 보존")이 요구한 범위 내이며, `SSRF_BLOCKED_CLIENT_MESSAGE` 상수 재사용으로 중복 도입도 없다. 스코프 밖 리팩토링·기능 확장 없음.
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트 3건(redirect-hop 케이스, hop5 초과 케이스, `Logger.prototype.warn` spy)은 직전 리뷰 testing WARNING ×3 을 정확히 커버하는 회귀 테스트 — 기능 확장 아님
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` (신규 `it` 2건 + 기존 케이스에 `warnSpy`/`logUsage` 단언 추가)
  - 상세: 직전 세션(13_32_17) testing.md 가 지적한 3개 갭 — "redirect-hop logUsage 미검증", "logger.warn 원본 보존 미검증", "hop5 초과 경로 테스트 부재" — 을 각각 정확히 메운다. `RESOLUTION.md` 의 조치표와 실제 diff 가 1:1 대응.
  - 제안: 조치 불필요.

- **[INFO]** `2-database-query.md` 1개 Rationale 문단 수정은 이번 HTTP 작업의 필연적 cross-reference 갱신 — 스코프 밖 아님
  - 위치: `spec/4-nodes/4-integration/2-database-query.md` (Rationale "메시지 일반화" 서브섹션, "HTTP/Email follow-up" → "HTTP 는 2026-07-05 동일 일반화 완료 + `logger.warn` 보존" 로 갱신)
  - 상세: 이 문서 자신이 미리 "동일 원칙을 HTTP/Email follow-up 과 공유한다"고 예고해 둔 상태였고, 이번 HTTP 구현 완료로 그 예고가 실현됐으므로 문구를 "완료"로 정정하는 것은 CLAUDE.md 가 요구하는 spec-코드 정합 유지의 일부다. DB Query 자체의 로직·코드는 변경되지 않았다(문서 1개 문단만).
  - 제안: 조치 불필요.

- **[INFO]** `spec/2-navigation/4-integration.md` 1-line 각주 추가도 대칭 갱신 — 스코프 내
  - 위치: `spec/2-navigation/4-integration.md` (`HTTP_BLOCKED` 행에 "redirect 대상·한도 초과 SSRF 포함" + "메시지는 host/IP 미포함 일반화" 각주 추가)
  - 상세: 직전 세션의 `cross_spec.md` INFO 항목("HTTP_BLOCKED 행만 DB_HOST_BLOCKED 행과 달리 일반화 각주 없음")이 지적한 비대칭을 해소. 코드 변경과 정확히 대응하는 최소 문서 갱신.
  - 제안: 조치 불필요.

- **[INFO]** `spec/5-system/2-api-convention.md` 앵커 오타 수정 1건은 이번 SSRF 작업과 무관 — 그러나 harm 없음, 재확인 결과 별도 커밋 소속
  - 위치: `spec/5-system/2-api-convention.md` (`#...-datitems-유지` → `#...-dataitems-유지` 앵커 slug 오타)
  - 상세: 직전 세션(13_32_17) scope.md 가 이미 동일 사실을 확인했다 — `git log` 상 이 1-line 수정은 target 커밋(`ea09f1d7f`)이 아닌 그 직전 별도 커밋(`70f6c3b17`, `docs(spec): api-convention Rationale anchor 오타 수정`)에 속하며, review payload(`meta.json`) 생성 시 diff base 산정 과정에서 changeset 에 섞여 든 것으로 판단된다(리뷰 payload 스냅샷 경계 이슈, 실제 커밋 경계 문제 아님). 내용도 SSRF 와 완전 무관한 문서 오타이고 위해 없음. 이번 재실행(13_54_11) payload 에도 동일하게 포함돼 있어 반복 재확인한다.
  - 제안: 코드/문서 조치 불필요 — 이미 사실 확인됨(직전 scope 리뷰와 결론 동일). 재발 방지 차원에서 향후 review payload 생성 시 diff base(`--branch origin/main` 등)를 정확히 맞추는 것을 권고(반복 관측이나 이번 리뷰 세션이 직접 고칠 항목은 아님).

- **[INFO]** `review/consistency/**`(8개) + `review/code/2026/07/05/13_32_17/**`(13개, 이번 재실행분의 직전 SUMMARY/RESOLUTION 포함) 산출물 포함은 절차상 정당 — scope 위반 아님
  - 위치: `review/consistency/2026/07/05/12_55_17/*`, `review/code/2026/07/05/13_32_17/*`
  - 상세: CLAUDE.md 는 `developer` 의 구현 착수 직전 `consistency-check --impl-prep` 을, 그리고 구현 완료 후 `/ai-review` + Critical/Warning 대응(RESOLUTION.md)을 상시 의무로 규정한다. 두 산출물 세트는 각각 그 절차의 필수 증적이며, "무관한 파일·영역 수정"에 해당하지 않는다. 이번 재실행(13_54_11)의 changeset 에 직전 review 세션(13_32_17) 산출물 전체가 다시 나타나는 것은 diff 범위(브랜치 vs 워킹트리) 산정 방식에 따른 자연스러운 결과로 보이며, 신규로 추가된 실질 파일이 아니다.
  - 제안: 조치 불필요.

- **[INFO, 참고]** plan 파일(`http-ssrf-all-auth-followups.md`) 체크박스는 이번 changeset 에 포함되지 않음 — 완료 표시가 아직 반영 안 됨
  - 위치: `plan/in-progress/http-ssrf-all-auth-followups.md:14`
  - 상세: 이번 구현이 그 14행 항목("SSRF 에러 메시지 클라이언트 일반화")을 정확히 이행했음에도, 27개 변경 파일 목록에 이 plan 파일 자체는 없다 — 체크박스가 아직 `[ ]` 상태로 남아 있을 가능성이 높다. 이는 "스코프 밖 변경이 섞였다"는 문제가 아니라 반대로 "완료된 작업의 흔적을 plan 에 반영하는 마무리 갱신이 이번 changeset 에 없다"는 완결성 이슈이며, 직전 세션의 plan_coherence.md 제안 (2)("완료 후 체크박스 [x] 갱신 + 근거 기록")이 아직 이행되지 않은 것으로 보인다. Scope 확장/축소 문제는 아니므로 정보 제공 목적으로만 기록.
  - 제안: 이번 PR 커밋 범위에 `plan/in-progress/http-ssrf-all-auth-followups.md` 14행 체크박스 `[x]` 전환 + 완료 근거(PR 번호)를 추가할 것을 권고(별도 조치 요구는 아니며, scope reviewer 관점의 CRITICAL/WARNING 대상 아님).

## 요약

이번 changeset 은 `plan/in-progress/http-ssrf-all-auth-followups.md` 의 명시적 미체크 항목("SSRF 에러 메시지 클라이언트 일반화")과 직전 code-review 세션(13_32_17)의 SUMMARY/RESOLUTION 이 확정한 조치 항목(logUsage 일반화, logger.warn 원본 보존, redirect-hop/hop5초과 테스트 추가)을 정확히, 그리고 그 범위 내에서만 이행했다. 코드 변경은 SSRF 차단 메시지 일반화 + redirect SSRF 라우팅 정합화라는 좁은 목표에 집중돼 있고, 신규 테스트도 이 변경의 회귀 방지 목적에 정확히 대응하며, spec 문서 갱신 2건(`1-http-request.md`, `2-database-query.md`, `2-navigation/4-integration.md`)도 코드 변경의 필연적 동반 문서화다. 유일한 무관 항목(`2-api-convention.md` 앵커 오타)은 별도 선행 커밋 소속임이 이미 이전 리뷰에서 확인됐고 실질 위해가 없다. 요청 범위를 벗어난 리팩토링·기능 확장·무관한 코드 수정·불필요한 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
