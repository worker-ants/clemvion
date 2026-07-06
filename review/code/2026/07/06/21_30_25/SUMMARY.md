# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 급 실질 결함 없음. 유일한 실질 WARNING 은 이미 plan 에 후속 phase 로 추적 중인 SPEC-DRIFT(spec 이 "미구현"으로 남아있으나 코드가 구현 완료)이며, 4개 reviewer(architecture/maintainability/testing/user_guide_sync)는 manifest 상 `success` 이나 출력 파일이 디스크에 없어 내용 통합 불가 — 재시도 필요.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | spec 본문(`mcp-client.md` §6.2/§8.2)이 `mcpDiagnostics` 구조화 객체(`attempted`/`serverCount`/`toolCalls`/`resourceReads`/`promptGets`/`errors[]`) 및 `MCP_TIMEOUT`/`MCP_CONNECT_FAILED`/`MCP_LIST_FAILED` granular emit 을 구현 완료 후에도 여전히 "미구현 (Planned)"로 서술 — 코드가 spec 을 앞서간 상태 | `spec/5-system/11-mcp-client.md` §6.2(L353 "구현 현황" 노트), §8.2 skipReason vocabulary 문단 | spec 갱신은 이미 `plan/in-progress/spec-sync-mcp-client-gaps.md` 후속 phase(`[ ] spec 동기화 + /consistency-check --spec`)로 추적 중 — project-planner 가 해당 phase 에서 §6.2/§8.2 및 `1-ai-agent.md` §7.1 예시를 실제 emit shape 로 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 새 `mcpDiagnostics.errors[].message` 가 서버 로그/DB 전용이던 원시 에러 문자열을 사용자 대면 meta 로 노출 범위 확대. `sanitizeMcpErrorMessage` 는 제어문자 제거+길이 clamp만 하고 시크릿/URL redaction 없음 (자격증명 유출 코드 경로는 미발견) | `mcp-tool-provider.ts` `openServer()`, `mcp-error-codes.ts` `sanitizeMcpErrorMessage` | 후속 검토 대상으로 등록, URL/토큰 패턴 redaction 추가 고려 |
| 2 | 요구사항 | call-phase(`tools/call`/`resources/read`/`prompts/get`) 실패는 여전히 `mcpDiagnostics.errors[]` 에 누적되지 않음 — spec §8.1 표는 이미 "누적"을 약속 중 | `spec/5-system/11-mcp-client.md` §8.1 표 | 의도된 범위 축소(plan 에 deferred 로 명시). 조치 불필요, 후속 PR 추적 유지 |
| 3 | 요구사항 | `McpErrorPhase` 의 `'initialize'` literal 이 현재 생산 코드에서 미사용 (connect 단계 실패 전부 `'connect'` 로 emit) | `mcp-diagnostics.ts` `McpErrorPhase` | 조치 불필요 — SDK 가 connect/initialize 를 분리 노출하지 않아 의도된 설계 |
| 4 | 범위(Scope) | `ai-turn-executor.ts` 에 기능과 무관한 타입 캐스트 제거(`as ResumeState` 등)가 동반 — behavior-preserving, 리스크 낮음 | `ai-turn-executor.ts` | **해소됨**: eslint --fix 부작용으로 판명, 5개 캐스트 전부 복원 |
| 5 | 부작용 | `withTimeout` 이 이제 `TimeoutError`(Error 서브클래스) reject — message 포맷 불변으로 하위호환 유지되나, `McpClientService` 는 아직 이 분류를 소비하지 않음 | `with-timeout.ts` | 후속 PR 로 명시 |
| 6 | 부작용 | `meta.mcpServerSummaries` → `meta.mcpDiagnostics` 필드명 변경 — backend 전역 잔존 참조 없음 확인, 프런트엔드에는 아직 소비 코드 없음 | `ai-turn-executor.ts` | 프런트엔드가 향후 소비 시 신규 키 기준 |
| 7 | 문서화 | `1-ai-agent.md` §7.1 예시에 `serverSummaries[]` 가 생략 — 실제 emit shape 와 불일치 | `1-ai-agent.md` L485-491 | spec 동기화 phase 에서 함께 정정 예정 |
| 8 | 문서화 | plan 문서의 `TimeoutError` "McpClientService 공유" 서술이 실제 소비 범위(현재 `McpToolProvider` 만)와 미세한 불일치 | `plan/in-progress/spec-sync-mcp-client-gaps.md` | 사소함, 문구 다듬음 |
| 9 | 동시성 | 여러 MCP 서버 병렬 open 시 공유 accumulator 로 동기 `push` — 현재 안전하나 향후 provider 구현에 `await` 이 push 전에 끼면 TOCTOU 위험 잠재 | `mcp-tool-provider.ts` | 신규 provider 추가 시 체크리스트화 권장 |
| 10 | 성능 | 신규 카운터 집계와 `finalizeMcpDiagnostics` 모두 O(1)~O(작은 배열) — 성능 영향 없음 | `mcp-diagnostics.ts` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | mcpDiagnostics.errors[] 원시 에러 노출 범위 확대(redaction 없음), 그 외 인젝션/인증우회/하드코딩 시크릿 없음 |
| performance | NONE | 전 항목 O(1)~예산상한 내 |
| requirement | LOW | [SPEC-DRIFT] spec "미구현" stale(plan 추적 중), call-phase errors 미커버(의도된 deferred) |
| scope | LOW | 무관한 타입 캐스트 정리 동반(해소됨) |
| side_effect | LOW | 필드명 rename 프런트 소비처 미확인 외 안전 |
| documentation | LOW | [WARNING] spec 본문 "미구현" stale, 소스 JSDoc 우수 |
| concurrency | LOW | 병렬 open/카운터 집계 안전 |
| architecture | 재시도 필요 | output 파일 디스크에 없음 (write 차단) |
| maintainability | 재시도 필요 | output 파일 디스크에 없음 |
| testing | 재시도 필요 | output 파일 디스크에 없음 |
| user_guide_sync | 재시도 필요 | output 파일 디스크에 없음 |

## 권장 조치사항

1. `architecture`, `maintainability`, `testing`, `user_guide_sync` 4개 reviewer 재실행 — output 파일 write 차단(harness bgIsolation)으로 통합 누락.
2. `plan/in-progress/spec-sync-mcp-client-gaps.md` 의 "spec 동기화" phase 완료로 [SPEC-DRIFT] 해소 — project-planner 위임.
3. (낮은 우선순위) `sanitizeMcpErrorMessage` 에 URL/토큰 redaction 추가 검토.
4. (낮은 우선순위) `mcpServerSummaries` → `mcpDiagnostics` rename 프런트엔드 소비 코드 grep 확인.

## 라우터 결정

- `routing_status=done`:
  - **실행(11)**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, user_guide_sync
  - **제외(3)**: dependency(신규 의존성 없음), database(스키마/쿼리 변경 없음), api_contract(내부 필드명 변경, 공개 API 계약 불변)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing
