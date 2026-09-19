# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 전문 확보, Critical 발견 없음.

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건 중 2건은 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 등재된 기존 미해결 항목의 재확인이며, 신규 WARNING 1건(타입 경계)은 spec 변경이 아닌 후속 코드 harden 제안.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | (없음) | — | — | — | — |

## planner 인계 (권한 밖 Critical)

(없음) — Critical 발견이 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, naming_collision | `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드가 두 spec 문서에서 다름(422 vs 400) — 이번 PR이 §9.4 줄을 직접 편집했는데도 정정하지 않음. 실제 코드(`BadRequestException`, 400)는 `11-mcp-client.md` 와 일치, `4-integration.md §9.4` 의 422 는 불일치 | `spec/2-navigation/4-integration.md` §9.4 | `spec/5-system/11-mcp-client.md` L539 | 정정하지 않을 거면 §9.4 에 "rotate 경로는 400, 정합화는 트래커 항목 참고" 상호참조라도 남길 것. 최종적으로 422/400 하나로 통일 필요. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 미해결로 등재됨 |
| 2 | cross_spec | 사용자 가이드가 "Google 은 refresh_token 자동 갱신 지원" 이라 안내하는데, 이번 spec 정정(§10.5)은 "갱신 경로 미구현, 소비 노드도 없음" 이라고 명시 — 만료 임박 Google 통합이 `Need attention` 배너에서 계속 빠질 위험 | `spec/2-navigation/4-integration.md` §10.5(이번 델타) | `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` / `.en.mdx` 기존 tip 문단(diff 밖) | 코드(갱신 구현 vs `supportsTokenAutoRefresh: false`) 결정 전까지 가이드에도 spec §10.5 수준의 경고 병기. 이미 같은 트래커에 "코드를 정할 때 함께" 로 defer 등재됨 |
| 3 | naming_collision | 신규 `IntegrationTestResult.code` 값 5종(`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`)이 노드 런타임 `ErrorCode`(`DB_CONNECTION_ERROR`·`HTTP_TRANSPORT_FAILED`)와 이름이 근접한데, `IntegrationTestResult.code` 필드가 비literal `string` 이라 두 namespace 를 섞어 비교해도 컴파일러가 못 잡음 | `integrations.service.ts:80` (`IntegrationTestResult.code?: string`) | `codebase/backend/src/nodes/core/error-codes.ts` `ErrorCode` enum | spec 조치는 이미 충분(문서로 namespace 분리 명시). 코드에서 `code` 필드를 두 namespace 의 literal union 으로 좁히는 후속 harden 제안 — 이번 PR 스코프 밖, spec 변경 불요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, plan_coherence | Rationale·트래커가 아직 `plan/in-progress/` 에 있는 `spec-draft-integration-connection-tests.md` 를 `plan/complete/` 경로로 선반영 인용(dangling reference) | `spec/2-navigation/4-integration.md` `## Rationale` 신설 절 말미 | 각 plan 체크리스트에 이미 "마무리 커밋에서 이동" 항목이 있음 — 세션 마무리 시 `git mv` 수행 여부만 재확인 |
| 2 | cross_spec | §14.1 신규 행이 "`HTTP_{status}`" 표기를 그대로 따랐는데, 노드 spec 은 실제로 `HTTP_4XX`/`HTTP_5XX` 두 값만 발행 (기존 §9.2 표기를 신규 행이 답습한 것으로, 이번 PR 이 새로 만든 불일치는 아님) | `spec/2-navigation/4-integration.md` §14.1 신규 행 | 다음 정리 턴에서 `HTTP_{status}`→`HTTP_4XX`/`HTTP_5XX` 일괄 정정 시 이번 신규 두 행도 포함. 이미 트래커에 낮은 우선순위로 등재됨 |
| 3 | cross_spec | `preview-test`/`:id/test` 가 실제 외부 접속을 수행하게 됐는데도 `@WorkspaceId()`/`@Roles()` 없음(throttle 만) — 내부망 SSRF 프로브 오라클 위험 프로파일 증가 | `codebase/backend/src/modules/integrations/integrations.controller.ts` `previewTest()` | RBAC/보안 결정이 나면 `spec/5-system/1-auth.md` 일반 RBAC 규칙과 대조해 예외 명문화. 이미 트래커에 등재됨(`review/code/2026/09/19/13_58_22`, `15_02_57`) |
| 4 | rationale_continuity | §5.3 `test_path` 필드·"경고 배너" 서술의 소멸이 신설 Rationale 절에 개별 언급 없이 사라짐 — 전체 취지(미구현 약속 정리)와 결은 같아 보이나 문서만으로 완전히 닫히지 않음 | `spec/2-navigation/4-integration.md` §5.3 | 신설 Rationale 또는 §5.3 인접 각주에 "`test_path`·경고 배너는 필드 표·구현 어디에도 실재한 적 없어 함께 정리" 한 문장 추가 |
| 5 | plan_coherence | 리팩터링으로 공유 모듈(`buildPgConnection`·`buildHttpCredentials` 등)이 추출되며 `node-output-redesign/{http-request,database-query}.md` plan 의 라인 인용이 어긋남(결론 불변, 라인만 드리프트) | `plan/in-progress/node-output-redesign/{http-request,database-query}.md` | 다음에 두 문서를 열 때 "2026-09-19 이후 라인 재검증 필요" 한 줄 추가. 이번 PR 체크리스트 추가는 불요(범위 밖 문서) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 422/400 상태코드 불일치·Google 가이드 미동기화 재확인(WARNING, 기존 트래커 등재), plan/complete 선반영 참조·§14.1 표기·preview-test RBAC(INFO) |
| rationale_continuity | LOW | 신규 Rationale 이 기존 3개 Rationale 선례(SMTP verify·카운터 제외·§9.1 경계)를 날짜 각주로 정상 확장. §5.3 test_path 소멸만 INFO |
| convention_compliance | NONE | 신규 에러코드 5종·DTO 필드·감사 액션·i18n 가이드 구조 모두 정식 규약 준수, 위반 없음 |
| plan_coherence | LOW | 세 관련 plan 과 정합, 미해결 결정 우회 없음. node-output-redesign 라인 드리프트·plan/complete 선반영(INFO) |
| naming_collision | LOW | 신규 식별자(코드 5종·파일 8개·export 9개) 전수 grep 충돌 없음. `IntegrationTestResult.code` 타입 경계 없음(WARNING, 후속 harden) |

## 권장 조치사항
1. (선택, 이번 PR 불필수) §9.4 에 422/400 상호참조 한 줄 추가하거나, planner 턴에서 `spec/2-navigation/4-integration.md` §9.4 와 `spec/5-system/11-mcp-client.md` L539 중 하나로 통일 결정.
2. (선택) 사용자 가이드 mdx 에 Google 자동갱신 미구현 경고를 spec §10.5 수준으로 병기.
3. (후속 harden, 비차단) `IntegrationTestResult.code` 를 literal union 타입으로 좁혀 노드 런타임 `ErrorCode` 와의 문자열 혼동을 컴파일 타임에 방지.
4. 세션 마무리 커밋에서 `plan/in-progress/{spec-draft-integration-connection-tests.md, integration-db-http-testers.md, spec-draft-integration-db-test-waits.md}` 를 `plan/complete/` 로 이동(각 체크리스트에 이미 명시된 항목) — 이동 전까지 spec Rationale 의 경로 참조는 dangling.
5. (선택) rationale_continuity INFO #4 — §5.3 test_path/경고배너 소멸 사유를 Rationale 절에 한 문장 추가.
