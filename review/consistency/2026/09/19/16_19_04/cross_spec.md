# Cross-Spec 일관성 검토 — spec/2-navigation/4-integration.md (연결 테스트 Database·HTTP 구현, impl-done)

## 발견사항

- **[WARNING]** `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드가 두 spec 문서에서 다르다 (422 vs 400) — 이번 델타가 그 줄을 만졌는데도 고치지 않았다
  - target 위치: `spec/2-navigation/4-integration.md` §9.4 — 이번 PR 이 바로 이 줄에 "연결 테스트가 무엇을 확인하는지는 서비스마다 다르다…" 설명을 추가했다(`git diff origin/main...HEAD -- spec/2-navigation/4-integration.md` 참조). 그런데 `INTEGRATION_TEST_FAILED (422)` 표기 자체는 그대로 남겼다.
  - 충돌 대상: `spec/5-system/11-mcp-client.md` L539 — "`POST /api/integrations/:id/test` 후 갱신) 는 테스트 실패 시 `INTEGRATION_TEST_FAILED` (`BadRequestException`, HTTP 400) 를 던진다" 라고 명시.
  - 상세: 실제 구현(`IntegrationsService.rotate()`)은 `INTEGRATION_TEST_FAILED` 를 `BadRequestException`(400)으로 던진다 — `11-mcp-client.md` 의 400 이 코드와 일치하고, `4-integration.md §9.4` 의 422 는 코드와 불일치한다. 이 PR 전에는 rotate 의 연결 테스트가 구조 검증만이라 거의 실패하지 않아 이 표기 차이가 드러날 일이 적었지만, 이번 PR 로 Database·HTTP 가 실제 자격증명 오류로 흔히 실패하게 되면서 이 코드가 실제로 자주 발생하는 경로가 됐다 — 문서 간극이 처음으로 사용자에게 노출될 가능성이 커졌다.
  - 이미 등재된 항목: `plan/in-progress/spec-draft-nullable-notation-followups.md` (2026-09-19 등재, `--impl-prep review/consistency/2026/09/19/13_21_00` WARNING 1, `plan/complete/spec-draft-integration-connection-tests.md` "비대상" 처리) — 아직 미해결(`- [ ]`), planner 결정 대상으로 남아 있다. 새로 발견한 문제는 아니나, 이번 델타가 그 줄을 직접 편집하면서도 근본 불일치를 정정하지 않았다는 점을 다시 확인.
  - 제안: 이번 PR 범위에서 정정하지 않을 거면 §9.4 행에 "rotate 경로는 400 — §5-system/11-mcp-client.md 참조, 정합화는 트래커 항목 참고" 정도의 상호 참조만이라도 남겨 다음 독자가 두 문서를 별개 진실로 오인하지 않게 할 것. 최종적으로는 하나로 통일(422 vs 400) 필요.

- **[WARNING]** 사용자 가이드가 이번 spec 정정(Google 자동갱신 미구현)과 반대로 여전히 "Google 은 자동 갱신 지원" 이라고 말한다
  - target 위치: `spec/2-navigation/4-integration.md` §10.5 (이번 델타) — "`google` 은 refresh_token 을 받지만 갱신 경로가 구현돼 있지 않고 이 통합을 쓰는 노드도 없다" 로 정정.
  - 충돌 대상: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` / `.en.mdx` 의 기존 tip 문단(이번 diff 에서 손대지 않은 부분) — "refresh_token 자동 갱신을 지원하는 통합(Cafe24·MakeShop·Google)" 이라고 여전히 명시하며, Google 을 `Need attention` 배너 대상에서 제외한다고 안내.
  - 상세: 두 문서 모두 `IntegrationDto.autoRefresh: boolean` 이 Google 에도 `true` 로 나가는 현재 코드 동작(레지스트리 `supportsTokenAutoRefresh`)을 반영하지만, spec 은 "이건 실제로 갱신되지 않는 결함" 이라고 이번에 명문화한 반면 가이드는 여전히 사용자에게 "자동 갱신되니 안심" 이라고 안내 — 만료 임박 Google 통합이 배너에서 빠진 채 방치될 위험을 그대로 사용자에게 전달한다.
  - 이미 등재된 항목: 같은 plan 트래커의 "Google 통합이 «Auto-renews» 로 보이는데 갱신 구현이 없다" 항목이 이 가이드 문장까지 명시적으로 지적하며 "코드를 정할 때 함께" 라고 defer 해 뒀다 — 미해결.
  - 제안: 코드(갱신 구현 vs `supportsTokenAutoRefresh: false`) 결정이 나기 전까지, 최소한 가이드에도 spec §10.5 와 같은 수준의 경고를 병기할 것.

- **[INFO]** Rationale 이 아직 `in-progress` 인 plan 파일을 `plan/complete/` 경로로 인용
  - target 위치: `spec/2-navigation/4-integration.md` `## Rationale` 신설 절 "연결 테스트 — Database · HTTP 는 실제로 접속한다…" 말미 — "근거·실측: `plan/complete/spec-draft-integration-connection-tests.md`."
  - 충돌 대상: 실제 파일은 `plan/in-progress/spec-draft-integration-connection-tests.md` (frontmatter `status: in-progress`, 이번 브랜치에서 `plan/complete/` 로 이동한 커밋 없음). 본 검토 프롬프트 자신도 "함께 볼 plan" 목록에서 이 파일을 `plan/in-progress/` 경로로 지목하고 있다.
  - 상세: 지금 이 링크(경로)로는 파일을 찾을 수 없다 — 아직 이동되지 않은 plan 을 완료 위치로 미리 인용한 선반영 오기. plan 이동은 보통 세션 마무리 커밋에서 일괄 처리되므로 이 자체가 치명적이지는 않으나, 이 커밋만 놓고 보면 근거 추적이 끊긴다.
  - 제안: 같은 PR/세션에서 plan 을 `plan/complete/` 로 이동하는 커밋을 반드시 동반하거나, 그 전까지는 Rationale 이 `plan/in-progress/…` 를 가리키게 할 것.

- **[INFO]** §14.1 의 "노드는 `HTTP_{status}` 로 낸다" 표기가 노드 spec 의 실제 세분화(`HTTP_4XX`/`HTTP_5XX`)와 다르다 (기존에 이미 추적된 낮은 우선순위 항목, 재확인만)
  - target 위치: `spec/2-navigation/4-integration.md` §14.1 신규 행 `HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR` — "노드는 같은 응답을 `HTTP_{status}` 로 낸다"
  - 충돌 대상: `spec/4-nodes/4-integration/1-http-request.md` §6 에러 코드 표 — 노드는 `HTTP_4XX` / `HTTP_5XX` 두 값으로 발행(단일 `HTTP_{status}` 패턴 아님).
  - 상세: 이 표기 차이는 이번 델타가 새로 만든 것이 아니라 §9.2 행(수정되지 않은 기존 줄)에도 이미 `HTTP_{status}` 표현이 쓰이고 있었고, 이번 신규 행이 그 기존 표현을 그대로 따랐을 뿐이다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "낮음" 우선순위 INFO 로 이미 등재(`--impl-prep review/consistency/2026/09/19/13_21_00` INFO 6) — 재지적 목적이 아니라 이번 델타가 같은 절 안에서 그 비일관성을 한 곳 더 늘렸다는 점만 기록.
  - 제안: 다음 정리 턴에서 `HTTP_{status}` 표기를 `HTTP_4XX`/`HTTP_5XX` 로 일괄 정정할 때 이번에 추가된 §14.1 두 행도 함께 볼 것.

- **[INFO]** `preview-test`/`:id/test` 가 실제 외부 접속을 수행하게 됐는데도 workspace 스코프가 없다 (RBAC 관점 재확인 — 신규 결함 아님)
  - target 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` `previewTest()` — `@WorkspaceId()`/`@Roles()` 데코레이터 없음(분당 20회 throttle 만).
  - 충돌 대상: 다른 대부분의 integrations 엔드포인트는 `@WorkspaceId()` 를 받아 워크스페이스 스코프를 강제한다(같은 컨트롤러의 다른 라우트들과 대비). RBAC 모델 자체를 어기는 신규 구조는 아니지만("어느 워크스페이스에도 속하지 않는 미리보기" 라는 기존 설계 선택), 이 PR 이후 이 엔드포인트가 실제 내부망 SSRF 프로브 오라클(포트 스캔 대용)로서의 위험 프로파일이 커졌다.
  - 이미 등재된 항목: 같은 plan 트래커에 planner 결정 대상으로 이미 등재(`/ai-review review/code/2026/09/19/13_58_22` security WARNING, `review/code/2026/09/19/15_02_57` api_contract WARNING 9) — 미해결.
  - 제안: RBAC/보안 관점 결정(워크스페이스 컨텍스트 요구 여부)이 나면 그 결과를 `spec/5-system/1-auth.md` 의 일반 RBAC 규칙과 대조해 예외로 명문화할 것.

## 검증되어 충돌이 아닌 것으로 확인된 항목 (참고)

- `resolveHttpCredentials`/`buildPgConnection`/`buildMysqlSsl` 등 노드·연결테스터 공유 모듈 추출은 순수 리팩터(동작 동일) — `1-http-request.md`·`2-database-query.md` 의 SSRF·SSL·리다이렉트(5홉) 계약과 정확히 일치.
- 신규 코드 `DB_AUTH_FAILED`/`DB_CONNECT_FAILED`/`HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR`/`HTTP_CONNECT_FAILED` 는 `spec/conventions/error-codes.md` §1 명명 규약(의미 기반, UPPER_SNAKE_CASE, 도메인 prefix) 위반 없음. `spec/5-system/3-error-handling.md` 의 "노드 수준 런타임 에러" 표는 이 신규 코드들을 의도적으로 포함하지 않는데, 이는 그 표가 `output.error.code` (`ErrorCode` enum) 전용이고 신규 코드는 명시적으로 별개 namespace(`IntegrationTestResult.code`)이기 때문 — 표 누락이 아니라 올바른 경계.
- Google/GitHub/Webhook 을 소비하는 노드가 현재 코드베이스에 없다는 target 의 주장은 `codebase/backend/src/nodes/**` 전수 확인 결과 사실과 일치.
- `INTEGRATION_INCOMPLETE`/`INTEGRATION_AUTH_UNSUPPORTED` 재사용은 `spec/4-nodes/4-integration/0-common.md` §4.2 기존 카탈로그와 일치, 새 의미 충돌 없음.

## 요약

이번 PR 의 spec 델타(§3.3·§5.1-§5.4·§5.7·§6·§9.2·§9.4·§10.3·§10.5·§14.1·Rationale) 는 데이터 모델·상태 전이·RBAC 구조를 새로 만들지 않고 기존 Integration 연결 테스트 계약을 "약속했지만 미구현" 상태에서 "Database·HTTP 는 실제 구현" 상태로 좁히는 정정이며, 노드 spec(HTTP Request·Database Query)과의 SSRF·SSL·리다이렉트 계약은 공유 모듈 추출을 통해 정확히 일치한다. 다만 이번 델타가 직접 편집한 §9.4 줄이 `spec/5-system/11-mcp-client.md` 와의 기존 422/400 불일치를 정정하지 않고 그대로 남겼고, §10.5 의 Google 자동갱신 미구현 정정이 프론트엔드 사용자 가이드에 반영되지 않아 새 spec 진실과 가이드가 서로 다른 말을 하게 됐다 — 둘 다 이미 같은 날짜 plan 트래커에 미해결 항목으로 등재돼 있어 novel 한 발견은 아니지만, "이번 델타가 만졌거나 만들어낸 자리" 라는 점에서 재확인해 기록한다. CRITICAL 급(두 영역 중 하나가 작동 불가) 충돌은 없다.

## 위험도

LOW
