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

## TEST 결과 (최종 — 후속 fix 10건 포함)

- **lint**: 통과 (`lint-20260524-203312.log`)
- **unit**: 통과 (`unit-20260524-203340.log` — backend 4723 + frontend 2281, +12 DTO 신규 케이스)
- **build**: 통과 (`build-20260524-203418.log`)
- **e2e**: 통과 (`e2e-20260524-203517.log` — 20 spec 119 tests)

## 보류·후속 항목 (모두 본 PR 안에서 추가 처리 — 2026-05-24 사용자 결정)

원래 별 plan 으로 이관 권고였으나, 사용자 결정 "다 완료하고 PR" 에 따라
본 PR 의 후속 commit 으로 일괄 해소:

| 항목 | 분류 | Fix commit |
|---|---|---|
| spec slack §6 / discord §6 inbound-signing hex 형식 명세 (lowercase hex 32 / 64) | spec 보강 | `40ef296f` |
| spec discord §3.1 `options` 배열에 `reply` sub-command 추가 | spec 보강 | `40ef296f` (실제 discord.adapter.ts 는 이미 reply 구현 — spec 만 정합화) |
| spec 15-chat-channel §5.4.1.1 신설 — `inboundSigning` PATCH 정책 (v1 차단 + v2 결정 후보 3종) | spec 결정 | `40ef296f` |
| spec secret-store §2.1 store/rotate 표현 명확화 — `rotate()` 권장 | spec 보강 | `40ef296f` |
| spec chat-channel-adapter §1 `revokeBotToken?` 옵션 메서드 신설 + §1.1 표 추가 | spec 보강 | `40ef296f` |
| spec swagger.md §1-5 신설 — `writeOnly: true` / `readOnly: true` 사용 가이드 | spec 보강 | `40ef296f` |
| `tryRevokeOldBotToken` OCP 해소 — adapter 인터페이스 사용으로 hard-cast 제거 | refactor | `f08a3efc` |
| `sanitizeChatChannelForResponse` allow-list 전환 — `CHAT_CHANNEL_RESPONSE_STRIP_KEYS` 상수 | refactor | `f08a3efc` |
| `BOT_TOKEN_INVALID` throw 신설 — rotate setupChannel 401/403 → 400, 기타 → 502 `CHAT_CHANNEL_SETUP_FAILED` | feature | `006ac494` |
| `trigger-dto-validation.spec.ts` 에 `ChatChannelConfigDto` 12 케이스 신설 | testing | `006ac494` |

**여전히 별 plan 으로 남는 항목** (본 PR 범위 밖):
- 정규식 인라인 중복 (`packages/` 공유 상수 추출) — 장기 refactor. 단기는 backend/frontend 주석에 동기화 의무 명시 (이미 적용됨).
- `chat-channel-dispatcher-split` plan 진입 결정 — 사용자 결정 사안 (`status: ready` 갱신만 완료).

## 자가 검증

- [x] `## 조치 항목` 섹션 있음 (Critical 2 + Warning 9 + Info 7 + 후속 10건)
- [x] `## TEST 결과` 섹션 있음
- [x] `## TEST 결과` 의 e2e 줄이 "통과" 형식
- [x] 보류 항목 별 plan / 후속 commit 모두 cross-reference

## 자가 검증

- [x] `## 조치 항목` 섹션 있음
- [x] `## TEST 결과` 섹션 있음
- [x] `## TEST 결과` 의 e2e 줄이 4가지 형식 중 "통과" 형식
- [x] 보류 항목 별 plan 권고 명시
- [x] 본 RESOLUTION 은 수동 흐름 (developer) — `## TEST 결과` 의 e2e 가 "통과" (자동 흐름의 환경 차단 형식 아님)
