# Code Review SUMMARY — trigger-create-multi-provider-ui

**세션**: `review/code/2026/05/24/19_27_42/`
**범위**: `git diff origin/main..HEAD` (rebase 전 base `04e678f1`, 7 commit 885a9742..db93ffb6)
**Reviewer**: 14개 중 10개 실행, 4개 router skip (concurrency / performance / database / dependency)

## 전체 위험도

**CRITICAL** → **해소 완료** (commit `24694c50` 일괄 조치 + `git rebase origin/main` 으로 PR #305/#306/#307 흡수)

## Critical 발견 (2건, 모두 해소)

| # | Reviewer | 발견 | 위치 | 해소 |
|---|---|---|---|---|
| C-1 | security · requirement · side-effect · architecture | SS-SE-01 위반 — `mergeExternalConfig` 가 plaintext (botToken + inboundSigningPlaintext) 그대로 config 에 넣어 `triggerRepository.save` 시 DB JSONB 일시 기록. adapter 미등록 early-return 경로 영구 잔류 | `triggers.service.ts` `create()` / `update()` / `mergeExternalConfig()` | `stripChatChannelPlaintext` 헬퍼 신설, mergeExternalConfig 호출 전 strip. setupChatChannel 은 원본 dto.chatChannel 별도 인자. unit test `triggerRepo.save.mock.calls[0]` assertion 추가. **commit `24694c50`** |
| C-2 | requirement · scope · side-effect · testing | PR #305 (formData 10KB cap + spec §12.7) + PR #306 (emailVerified e2e) + PR #307 (password_hash bcrypt 가드) 누락 — worktree base `04e678f1` 이후 main 머지된 3 PR 미반영. 그대로 머지 시 세 기능 회귀 | `ai-agent.handler.ts`, `spec/4-nodes/3-ai/1-ai-agent.md §12.7`, `chat-channel-discord.e2e-spec.ts`, `e2e-chat-channel-fixture.ts` | `git rebase origin/main` (충돌 0건 자동 흡수). lint/unit (4711) / build / e2e 모두 회귀 0건 검증 |

## Warning 발견 (13건, 모두 해소 또는 후속 plan 이관)

| # | Reviewer | 발견 | 해소 |
|---|---|---|---|
| W-1 | security | DTO `@MinLength(32)` 누락 (defense-in-depth) | `@MinLength(32)` + e2e 짧은 plaintext 케이스. **commit `24694c50`** |
| W-2 | security · scope · testing | `ownerEmailVerified=false` 회귀 가드 제거 | rebase 로 복원 |
| W-3 | requirement | Slack hex32 / Discord hex64 형식이 spec 미명시 | 별 후속 plan (project-planner) |
| W-4 | requirement | update 경로 inboundSigningPlaintext 무조건 필수 | 별 후속 plan (spec §5.4.1 PATCH 정책 결정 후) |
| W-5 | requirement | Discord §3.1 options 배열에 `reply` 누락 | 별 후속 plan (project-planner) |
| W-6 | testing | SS-SE-01 unit test save 시점 검증 누락 | `mock.calls[0]` assertion 추가. **commit `24694c50`** |
| W-7 | testing | Discord plaintext 누락 e2e 없음 | 추가. **commit `24694c50`** |
| W-8 | scope | 완료 plan + review/consistency 산출물 삭제 | rebase 로 자동 복원 |
| W-9 | architecture | `tryRevokeOldBotToken` OCP 위반 (adapter 우회 캐스트) | 별 후속 plan (refactor) |
| W-10 | maintainability | Slack/Discord inbound-signing 블록 중복 + htmlFor id 동일 (a11y) | 단일 블록 통합, id provider 별 분리. **commit `24694c50`** |
| W-11 | maintainability | `sanitizeChatChannelForResponse` destructure strip 누락 위험 | 별 후속 plan (allow-list 전환) |
| W-12 | documentation · api_contract | DTO `writeOnly: true` 누락 (Swagger 응답 plaintext 노출) | `@ApiPropertyOptional({ writeOnly: true })` 추가. **commit `24694c50`** |
| W-13 | documentation | plan 본문 (a) 채택 vs 실제 (b) 구현 불일치 | plan 본문 "(b) 채택" 으로 정정. **commit `24694c50`** |

## Info 발견 (18건, 주요 항목 해소)

본 commit 에서 해소:
- regex `/i` flag 제거 (backend service + frontend client) — lowercase hex 강제
- frontend provider onChange 시 plaintext clear
- `buildSecretRef` helper 사용 — backtick 리터럴 직접 조합 제거
- `setupChatChannel` 중복 타입 캐스트 제거
- `assertInboundSigningPlaintextByProvider` exhaustiveness doc 추가
- user-guide 내부 spec ID (`R-S-2` / `R-CC-13` / `R-D-3`) HTML 주석 처리
- `botToken` description multi-provider 화 + writeOnly

후속 plan 이관:
- formData 10KB cap 롤백 (rebase 로 복원됨)
- DTO 단위 테스트 부재 (`trigger-dto-validation.spec.ts` 에 ChatChannelConfigDto 케이스 추가)
- `chat-channel-trigger-create.e2e-spec.ts` 의 `BOT_TOKEN_INVALID` throw 신설
- 정규식 인라인 중복 (`packages/` 공유 상수 — 장기)

## 본 PR 머지 가능 여부

**가능** — Critical 2건 모두 해소, Warning 다수 즉시 fix, 별 후속 plan 권고 항목은 RESOLUTION.md 의 "보류·후속" 절에 명시.

## Router 결정

- 실행 10명: security, requirement, scope, side_effect, maintainability, testing, documentation, architecture, api_contract, user_guide_sync
- Skip 4명: concurrency / performance / database / dependency (변경 성격상 비해당)
