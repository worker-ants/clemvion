# Resolution — cafe24 expired self-healing (review/code/2026/05/18/11_29_07)

본 RESOLUTION 은 `/ai-review` 11 reviewer (38 issues — Critical 2 · WARNING 17 · INFO 21) 의 처리 내역을 기록한다.

## 처리 (본 PR 안에서 fix)

| ID | 카테고리 | 발견사항 | 조치 | commit/file |
|----|----------|----------|------|-------------|
| W-3 (req) | Requirement | enqueue 실패 시 알림 발사 단언 누락 | scanner spec 의 graceful 케이스에 `notificationsService.createMany` 호출 단언 추가 | `integration-expiry-scanner.service.spec.ts` |
| W-12 (test) | Testing | `refreshTokenViaQueue` 공개 메서드 전용 단위 테스트 없음 | `cafe24-api.client.spec.ts` 의 `queue-backed refresh` describe 안에 `refreshTokenViaQueue (public entry)` sub-describe 추가 — 큐 바인딩 / 폴백 두 케이스 | `cafe24-api.client.spec.ts:1410+` |
| W-13 (test) | Testing | refresh 후 두 번째 `getForExecution` 실패 (`lookup_failed`) 미테스트 | `cafe24-mcp-tool-provider.spec.ts` 에 케이스 추가 | `cafe24-mcp-tool-provider.spec.ts` |
| W-15 (sec) | Security | 큐 미바인딩 폴백 silent → 운영 모니터링 신호 결여 | `Cafe24ApiClient.refreshTokenViaQueue` 폴백 진입 시 `logger.warn` 추가 | `cafe24-api.client.ts` |
| W-16 (doc) | Documentation | `spec/4-nodes/3-ai/0-common.md §11` CHANGELOG 2026-05-18 항목 누락 | CHANGELOG 행 추가 (mcpDiagnostics 스냅샷 의미 보강) | `spec/4-nodes/3-ai/0-common.md` |
| W-17 (doc) | Documentation | `buildMcpDiagnosticsMeta` JSDoc 에 PR 브랜치명 하드코딩 | 날짜 기반 표기로 변경 (`2026-05-18 시점에는 ...`) | `ai-agent.handler.ts` |
| I-8 (req) | Requirement | plan 체크박스 미동기화 (A/B/D 완료된 항목들이 `[ ]`) | A/B/D 모든 체크박스 `[x]` 갱신 + Follow-up 섹션 추가 | `plan/in-progress/cafe24-expired-self-healing.md` |
| I-9 (req) | Requirement | spec §9.6 Rationale 에 buildTools 진입점 미등록 | §9.6 에 "Refresh 진입점은 셋 — 모두 동일 BullMQ 큐 경유" bullet 추가 (이미 spec 갱신 사이클에서 반영) | `spec/4-nodes/4-integration/4-cafe24.md §9.6` |
| I-12 (test) | Testing | non-AuthFailed (transport) refresh 오류 경로 미테스트 | `expired_refresh_failed` 가 ECONNRESET 등에도 적용됨을 검증하는 케이스 추가 | `cafe24-mcp-tool-provider.spec.ts` |
| I-13 (test) | Testing | 빈 문자열 `refresh_token` 엣지 미테스트 | scanner spec 에 `refresh_token: ''` 케이스 추가 (refresh-capable 분기 미진입 → expired flip) | `integration-expiry-scanner.service.spec.ts` |
| I-14 (test) | Testing | `mcpDiagnostics: undefined` backward-compat 미테스트 | `cafe24-mcp-tool-provider.spec.ts` 에 `mcpDiagnostics` omit 호출 케이스 추가 | `cafe24-mcp-tool-provider.spec.ts` |
| I-21 (doc) | Documentation | non-auth 오류 catch 주석이 "다음 buildTools 호출에서 재시도" 로 buildTools 내 자동 재시도 오해 가능 | 주석 명확화 — "본 buildTools 패스 안에서 자동 재시도하지 않음 / 다음 노드 실행 시 자연 재시도" | `cafe24-mcp-tool-provider.ts` |

## Critical 평가 (blocker 아님)

| ID | 발견사항 | 평가 | 조치 |
|----|----------|------|------|
| C-1 | 핵심 성공 테스트 (`enqueues cafe24-token-refresh at 0d`) 의 `scanner.run(now)` 완료 단언 미명시 | `await scanner.run(now)` 단독 호출은 throw 시 jest 가 자동 fail — 단언 누락 아님. `.resolves.toBeDefined()` 로 통일은 스타일 선호 | 본 PR 의 다른 케이스(`does not crash scan`)와 graceful 케이스가 이미 `.resolves.toBeDefined()` 사용. 핵심 성공 케이스는 await 단독 유지 (jest 의 표준 흐름). 향후 spec refactor 시 일관성 검토 follow-up. |
| C-2 | `tryRecoverExpired` 의 refresh → DB 재조회 race window | `Cafe24ApiClient.refreshViaQueue` 가 `waitUntilFinished` 로 worker DB commit 종료 후 반환 (기존 spec). 본 PR 의 `refreshTokenViaQueue` 도 동일 경로 (private `refreshViaQueue` 위임). 재조회가 stale 일 가능성은 replica lag 시나리오 한정 — 발생 시 `expired_refresh_failed` 로 graceful skip (false-skip). 다음 노드 실행이 새 buildTools 발사 시 자가 회복. blocker 아님. | follow-up plan 에 모니터링 항목 등재. |

## Deferred (follow-up, plan 의 Follow-up 섹션 등재)

| ID | 발견사항 | 사유 |
|----|----------|------|
| W-1 (req) | non-auth 오류의 별도 skipReason vocabulary (`expired_refresh_network_error` 등) | spec §6.2 vocabulary 확장 필요 — 운영 모니터링 신호로 분리 가치 발생 시 spec 갱신 후 도입. 현재 inline 주석으로 정책 명시. |
| W-2 (req) | `isCafe24RefreshCapable` 의 TypeORM AES transformer 경유 명시 | scanner 의 `integrationRepository.find` 는 entity 경유라 transformer 자동 적용. 본 함수는 entity-level — 별도 raw query 우회 호출 사이트 없음. 주석 추가는 코드 노이즈 대비 가치 작음. |
| W-4 (req) | `serviceType !== 'cafe24'` ref 의 `not_capable` skipReason push | 외부 MCP provider (McpToolProvider) 가 자기 summary 를 push 하는 것이 정합. 현재 외부 provider 는 mcpDiagnostics 미사용 — 외부 MCP 경로 활성화는 follow-up. |
| W-5 (req) | 0d cafe24 분기 알림 발사 정책 spec 명시 | spec §11.1 갱신 시 명시한 "status 변경 없음 — worker 가 결과에 따라 수행" 가 사실상 알림은 발사. 명시적 한 줄 추가는 follow-up. |
| W-6 (maint) | `hasRefreshToken` 유틸 통합 | 현재 2 사이트 inline 유지 (scanner 의 `isCafe24RefreshCapable` + provider 의 `tryRecoverExpired`). 3 사이트째 진입 시 추출. |
| W-7~9 (maint) | 테스트 ctx 리터럴 / savedExpired 검증 / guard clause | refactor 범위 — 본 PR 의 logic 변경과 분리. |
| W-10 (arch) | `ProviderBuildCtx.mcpDiagnostics` push-only 계약 강화 | 인터페이스 변경 범위 큼 — `buildTools` 반환 타입 재설계 follow-up. |
| W-11 (arch) | `buildTools` 가 refresh 큐 enqueue 수행하는 책임 범위 | `AgentToolProvider` 인터페이스에 `precheck(ctx)` hook 도입은 KB/MCP 양쪽 영향 — design 변경 follow-up. |
| W-14 (test) | `buildMcpDiagnosticsMeta` 핸들러 통합 검증 | ai-agent.handler.spec 의 fixture 확장 필요 — 단위 helper 동작은 자명, 통합 검증은 follow-up. |
| I-* 그 외 | `addBulk` 일괄 처리 / `RefreshCapableProvider` registry / replica lag 모니터링 / source 라벨 세분화 / `serverCount` 등 mcpDiagnostics 다른 필드 / `pushSummary` 헬퍼 / `toMcpDiagnosticsMeta` rename 등 | 디자인 / 운영 신호 / refactor 영역 — plan 의 Follow-up 섹션에 등재. |

## 후속 plan 동기화

본 PR 의 plan (`plan/in-progress/cafe24-expired-self-healing.md`) §C 의 spec 정정 5건 + §A/B/D 모든 항목 `[x]` 표시. Follow-up 섹션에 미완 5건 등재. 모든 항목 처리 시 `plan/complete/` 로 `git mv` — 본 commit 에 포함.

## e2e 정책

본 PR 은 cafe24 outbound (oauth/token endpoint) mock 부담이 커 e2e 면제 정책 ([`plan/in-progress/cafe24-backlog-residual.md` B-5-8 alt](../../../../plan/in-progress/cafe24-backlog-residual.md)) 그대로 적용. unit / integration 으로 충분 커버 (총 405 tests passed in cafe24/ai-agent/expiry-scanner 범위, 3887 in full suite — 회귀 0).
