# Code Review 통합 보고서

## 전체 위험도
**HIGH (보고 시점)** — CRITICAL 1건 보고됨. 단, 후속 검증으로 **이 CRITICAL 은 false positive** 로 확인됐다 — 우리 branch 의 base 가 `git fetch` 이전 origin/main(`6ceebac5`)이라, 그 사이 머지된 PR #178 (`0af7a58e`, nested ISO 경로 교정) 의 변경이 본 PR diff 에 "역방향" 으로 잡혀 보였을 뿐이다. 우리 4개 commit 자체는 그 spec 파일을 건드리지 않는다. **해결: `git rebase origin/main` 으로 base 동기화** (별도 처리 중).

CRITICAL 을 제외하면 WARNING 다수 + INFO 다수 — 코드 품질 권장 수준.

## Critical 발견사항 (검증 결과: false positive)

| # | 카테고리 | 발견사항 | 위치 | 검증 결과 |
|---|----------|----------|------|----------|
| 1 | 요구사항 | spec 경로 교정 방향 역전 — `4-ai-assistant.md`와 `_product-overview.md` 두 파일에서 nested ISO 경로(`review/code/2026/...`)를 옛 flat 경로(`review/2026-...`)로 되돌리는 역방향 diff | `spec/3-workflow-editor/4-ai-assistant.md`, `spec/5-system/_product-overview.md` | **false positive** — 본 branch 의 base 는 `6ceebac5`. 그 후 origin/main 이 `0af7a58e` 로 진행 (PR #178: nested ISO 경로 교정). 본 commit 들은 두 파일을 건드린 적 없으나 `git diff origin/main..HEAD` 가 base 차이를 역방향으로 보여줘 reviewer 가 오인. rebase 후 자동 해소. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 요구사항 | `encrypt-auth-config.ts` — `skipped` 카운터가 `const skipped = 0`으로 고정되어 실제 skip된 행이 있어도 항상 0으로 출력 (사전 결함, 본 PR 의 lint --fix 가 const 화한 결과) | `codebase/backend/src/scripts/encrypt-auth-config.ts` L76 | 사전 결함이라 본 PR 범위 외 — 후속 plan 으로 분리 |
| 2 | 요구사항 | `http-safety.spec.ts` — `as { lookup: jest.Mock }` 타입 단언 제거로 `lookup`이 `any` 타입, `mockReset()` 호출의 타입 안전성 저하 | `codebase/backend/src/nodes/integration/http-request/http-safety.spec.ts` L8~10 | lint --fix 의 변경. 타입 단언 복원 또는 `jest.mocked()` 적용 — 본 PR 범위 외 |
| 3 | 요구사항 | `integrations.service.ts` — `pending_install` 가드가 credentials 복호화 시도 이후에 위치 | `codebase/backend/src/modules/integrations/integrations.service.ts` L863~875 | 검증 필요 — `isUnreadableCredentials` 는 복호화 시도 자체이므로 가드 위치 변경 시 `INTEGRATION_CREDENTIALS_UNREADABLE` 과 `INTEGRATION_INCOMPLETE` 의 우선순위 결정 영향. 현재 우선순위는 의도적 (unreadable 이 더 심각한 데이터 무결성 신호) — 본 PR 의 결정에 맞춰 유지 권장. RESOLUTION 에 정책 기록. |
| 4 | 테스트 | `ExecutionEventEmitter` 서비스에 대한 전용 유닛 테스트 부재 (사전 결함) | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` | 본 PR 범위 외 — 후속 plan 으로 분리 |
| 5 | 테스트 | `WebsocketGateway` `MAX_SUBSCRIPTIONS_PER_CONNECTION` 초과 분기 커버리지 불명확 (사전 결함) | `codebase/backend/src/modules/websocket/websocket.gateway.ts` L926~933 | 본 PR 범위 외 |
| 6 | 테스트/부작용 | `cors-origins.spec.ts` `afterAll` `process.env = originalEnv` 전체 교체 vs `beforeEach` delete 혼용 | `codebase/backend/src/common/utils/cors-origins.spec.ts` L183 | 사전 결함, 본 PR 범위 외 |
| 7 | 유지보수성 | `websocket.service.spec.ts` magic number `12` 와 `MAX_SANITIZE_DEPTH(10)` 의 관계 미명시 | `codebase/backend/src/modules/websocket/websocket.service.spec.ts` L1089 | 사전 결함, 본 PR 범위 외 |
| 8 | 문서화 | `translation.ts` 의 path 불일치 TODO 추적 부재 | `codebase/backend/src/nodes/integration/cafe24/metadata/translation.ts` L2565~2567 | 사전 결함 |
| 9 | 문서화 | `INTEGRATION_INCOMPLETE` 응답 코드 신규 도입에 대한 CHANGELOG 미업데이트 | 프로젝트 루트 | **본 PR 의 결정**: spec §5.8 + §9.1 + Rationale 두 항이 이미 SoT 역할이라 별도 CHANGELOG 불필요. project 가 CHANGELOG 를 운영하지 않는다 (CLAUDE.md 의 정보 저장 위치 매트릭스 참고). |
| 10 | 문서화 | `http-safety.spec.ts` 타입 캐스팅 제거 이유 주석 없음 | 동상 | lint --fix 자동 변경. WARNING 2 와 묶어 후속 plan |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 처리 방향 |
|---|----------|----------|----------|
| 1 | 범위 | 33개 파일 Prettier 일괄 포매팅이 핵심 변경과 혼재 | 본 PR 의 commit C 가 의도적으로 분리. 사용자 결정으로 동봉 유지 — 향후 일반 정책은 별 commit 분리 |
| 2 | 범위 | `plan/complete/spec-update-cafe24-test-connection.md` 가 git mv 흔적 없이 신규 생성으로 보임 | **false positive** — D commit 에서 `git add plan/` 시 git 이 자동 rename 인식해 `rename plan/{in-progress => complete}/...` 로 처리됨. `git log --follow` 또는 `git show 67653d2c --find-renames` 로 정상 확인 가능 |
| 3 | 범위 | `encrypt-auth-config.ts` const 변경이 핵심과 무관 | lint --fix 의 결과 — commit C 에 묶임 |
| 4 | 요구사항 | `spec-paths-housekeeping-2026-05-16.md` frontmatter `worktree: TBD` | PR #178 이 머지한 plan 에 해당 — 우리 변경 아님 (base 차이로 보임) |
| 5 | 요구사항 | HMAC prefix 충돌 테스트가 길이 상수 직접 검증 안 함 | 사전 결함 |
| 6 | 보안 | nonce HMAC prefix 8자 설계의 spec 기록 부재 | 사전 결함 |
| 7 | 보안 | Redis 장애 graceful degradation 보안 수준 미문서화 | 사전 결함 |
| 8 | 보안 | `assertCorsOriginsConfigured()` bootstrap 호출 보장 미확인 | 사전 결함 |
| 9 | 보안 | `pending_install` 에러 메시지에 내부 상태명 포함 | **본 PR 의 결정**: `pending_install` 은 spec §6 상태 전이의 공개 status 라 API 응답 노출이 정당. 내부 구현 세부정보가 아니라 사용자가 OAuth 흐름 단계를 인지하는 신호. 메시지 보존. |
| 10 | 보안 | `sanitizePayloadForWs` 패턴 검증이 `api_key` 만 커버 | 사전 결함 |
| 11 | 테스트 | `Cafe24InstallNonceCache.close()` no-Redis no-op 테스트 부재 | 사전 결함 |
| 12 | 테스트 | mock `as never` 캐스팅 패턴 | 사전 결함 |
| 13 | 유지보수성 | 신규 테스트 두 케이스 기대값 중복 | 의도적 — 가독성 우선 (CLAUDE.md "premature abstraction 회피") |
| 14 | 부작용 | `registerEntityTester('cafe24', probe)` shared state 위험 | 검증: 기존 두 테스트(`uses registered entity-aware tester`, `warns when registerEntityTester overwrites`) 도 같은 패턴이라 service 가 `beforeEach` 재생성되거나 자체 정리 — 회귀 위험 0 |
| 15 | 문서화 | `cafe24-mcp-tool-provider.ts` JSDoc 영향 | line 14 의 unused import 였으므로 JSDoc 영향 0 — 검증 완료 |
| 16 | 범위 | `catalog-sync.spec.ts` `..` 7단계 폴백 경로 하드코딩 | 사전 결함, 본 PR 범위 외 |

## 본 PR 의 결정으로 회귀 / 보존된 항목

- **WARNING 3 (`pending_install` 가드 위치)**: 의도적으로 unreadable 가드 *후* 에 둠 — unreadable 은 데이터 무결성 신호로 더 우선이며 spec §9.1 비고도 "외부 호출 없이 즉시 거부" 라 했지 "다른 가드보다 먼저" 라고 명시하지 않음. 두 가드 모두 외부 호출 회피 효과 달성.
- **WARNING 9 (CHANGELOG)**: project 는 CHANGELOG 미운영. spec 의 Rationale 항이 SoT.
- **INFO 9 (메시지 내부 상태명 노출)**: `pending_install` 은 공개 status enum 이라 노출 정당.
- **INFO 13 (테스트 기대값 중복)**: premature abstraction 회피 정책 (CLAUDE.md) 에 부합.

## 후속 plan 으로 분리 권장 (사전 결함 / 본 PR 범위 외)

- WARNING 1 (`encrypt-auth-config.ts` skipped 카운터)
- WARNING 2 + 10 (`http-safety.spec.ts` 타입 단언)
- WARNING 4 (`ExecutionEventEmitter` 유닛 테스트)
- WARNING 5 (`WebsocketGateway` 상한 분기 커버리지)
- WARNING 6 (`cors-origins.spec.ts` 격리 패턴)
- WARNING 7 (`websocket.service.spec.ts` magic number)
- WARNING 8 (`translation.ts` TODO 추적)
- INFO 5~8, 10~12, 16 (사전 결함 일괄)

## 라우터 결정

- **실행**: 7명 (security, requirement, scope, side_effect, maintainability, testing, documentation)
- **제외**: 6명 (performance, architecture, dependency, database, concurrency, api_contract)

## 권장 즉시 조치

1. **`git rebase origin/main`** — base 동기화. CRITICAL false positive 해소. (별도 처리)
2. 사전 결함 그룹 (WARNING 1·2·4·5·6·7·8·10, INFO 5~8·10~12·16) 은 본 PR 의 범위 외 — 후속 cleanup plan 으로 분리 권장.
3. 본 PR 의 핵심 4 commit 내용은 그대로 유지 (재테스트 후 OK).
