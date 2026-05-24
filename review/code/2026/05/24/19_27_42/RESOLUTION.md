# RESOLUTION — trigger-create-multi-provider-ui ai-review (2026/05/24 19:27:42)

## 조치 항목

| SUMMARY # | Reviewer | 발견 | Fix commit |
|---|---|---|---|
| C-1 | security / requirement / side-effect / architecture | SS-SE-01 plaintext DB 일시 기록 | `24694c50` (stripChatChannelPlaintext + unit assertion) |
| C-2 | requirement / scope / side-effect / testing | PR #305/#306/#307 회귀 | `git rebase origin/main` (충돌 0건, 자동 흡수 — commit hash 없음, rebase 자체로 base 7 commit 모두 origin/main 위로 재배치) |
| W-1 | security | DTO `@MinLength(32)` 누락 | `24694c50` (decorator + e2e "너무 짧은 plaintext" 케이스) |
| W-2 | security · scope · testing | `ownerEmailVerified=false` 회귀 가드 제거 | rebase 로 복원 |
| W-6 | testing | SS-SE-01 unit test save 시점 검증 누락 | `24694c50` (`mock.calls[0]` assertion) |
| W-7 | testing | Discord plaintext 누락 e2e 없음 | `24694c50` (대칭 케이스 추가) |
| W-8 | scope | 완료 plan + review/consistency 산출물 삭제 | rebase 로 자동 복원 |
| W-10 | maintainability | Slack/Discord 입력 블록 중복 + a11y htmlFor 동일 | `24694c50` (단일 conditional 블록 + id provider 별 분리) |
| W-12 | documentation · api_contract | DTO `writeOnly: true` 누락 | `24694c50` (`@ApiPropertyOptional({ writeOnly: true })` + botToken 도 추가) |
| W-13 | documentation | plan 본문 (a) 채택 vs 실제 (b) 구현 불일치 | `24694c50` (plan "(b) 채택" 정정) |
| I-1 | security | regex `/i` flag — uppercase hex 허용 | `24694c50` (backend service + frontend client 양쪽 `/i` 제거) |
| I-4 | requirement | provider 변경 시 plaintext state 잔류 | `24694c50` (onChange clear) |
| I-5 | requirement | `inboundSigningRef` backtick 리터럴 직접 조합 | `24694c50` (`buildSecretRef` helper 사용) |
| I-8 | architecture | `setupChatChannel` 중복 타입 캐스트 | `24694c50` (DTO 정식 필드 직접 접근) |
| I-13 | maintainability | `assertInboundSigningPlaintextByProvider` exhaustiveness 무음 위험 | `24694c50` (doc + 신규 provider 추가 의무 명시) |
| I-15 | documentation | `botToken` description telegram 한정 | `24694c50` (3 provider description) |
| I-16 | documentation | user-guide 내부 spec ID 노출 | `24694c50` (HTML 주석 `{/* ... */}` 처리) |
| I-17 | documentation | invariant 주석 소멸 | rebase 로 PR #306 fixture JSDoc 복원 |

## TEST 결과

- **lint**: 통과 (commit 후 재실행 `lint-20260524-195247.log` — backend ESLint + frontend Next lint)
- **unit**: 통과 (`unit-20260524-195315.log` — backend 4711 + frontend 2281, SS-SE-01 신규 assertion 통과)
- **build**: 통과 (`build-20260524-195342.log` — backend Nest + frontend Next 빌드)
- **e2e**: 통과 (`e2e-20260524-195604.log` — 20 spec 119 tests, 신규 chat-channel-trigger-create + 기존 chat-channel-{slack,discord} 모두 PASS)

## 보류·후속 항목

본 PR 머지를 차단하지 않으나 별 plan 으로 추적:

| 항목 | 분류 | 권고 plan |
|---|---|---|
| spec slack §6 / discord §6 에 inbound-signing hex 형식 (Slack hex32 / Discord hex64) 명세 추가 | spec 보강 | `project-planner` 위임 — 본 plan 의 구현 코드 (`assertInboundSigningPlaintextByProvider`) 가 사실상 SoT 가 된 상태를 spec 으로 끌어올림 |
| spec discord §3.1 `options` 배열에 `reply` sub-command 추가 (현재 §5.1 normative 와 §3.1 분리 상태) | spec 보강 | `project-planner` 위임 |
| spec 15-chat-channel §5.4.1 single-path 표에 inboundSigning PATCH 정책 (PATCH 허용/차단/rotation API 신설) 결정 | spec 결정 | `project-planner` 위임 — 결정 후 service `assertChatChannelInputSafe` 의 update 경로 완화 (uiMapping/rateLimit 만 PATCH 가능) |
| `tryRevokeOldBotToken` 의 adapter 인터페이스 우회 캐스트 — OCP 위반 | refactor | 별 plan — `ChatChannelAdapter.revokeBotToken?` 옵션 메서드 추가 + Slack adapter 구현 |
| `sanitizeChatChannelForResponse` allow-list 전환 (현재 destructure strip 4종 누락 위험) | refactor | 별 plan — `STRIP_KEYS` 상수 도입 |
| `chat-channel-trigger-create.e2e-spec.ts` 의 `BOT_TOKEN_INVALID` throw 신설 (auth.test / GET /applications/@me 401/403 → 400) | feature | 별 plan — rotate-bot-token + setupChannel 의 에러 매핑 |
| `trigger-dto-validation.spec.ts` 에 `ChatChannelConfigDto` class-validator 단위 케이스 추가 (DTO MinLength/MaxLength/IsIn 검증) | testing | 별 plan 또는 다음 sweep |
| `BOT_TOKEN_INVALID` 에러 코드 backend src 에 throw 처음 도입 | feature | 위 항목과 묶음 |
| 정규식 인라인 중복 (frontend client + backend service + DTO JSDoc) — `packages/` 공유 상수 추출 | refactor | 장기 — 단기적으로는 주석으로 동기화 의무 명시 (이미 commit `24694c50` 의 frontend 주석에 backend 정합 명시) |

## 자가 검증

- [x] `## 조치 항목` 섹션 있음
- [x] `## TEST 결과` 섹션 있음
- [x] `## TEST 결과` 의 e2e 줄이 4가지 형식 중 "통과" 형식
- [x] 보류 항목 별 plan 권고 명시
- [x] 본 RESOLUTION 은 수동 흐름 (developer) — `## TEST 결과` 의 e2e 가 "통과" (자동 흐름의 환경 차단 형식 아님)
