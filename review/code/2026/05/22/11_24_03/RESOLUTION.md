# RESOLUTION — 11_24_03

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1  | 코드 | 5621468f | deleteByPrefix 쿼리빌더 mock — `_lastPrefix` 클로저 캡처 버그 수정 |
| #2  | 코드 | d0256bfb | chat-channel.controller.spec.ts 신설 (7개 케이스) + rotateBotToken 검증 |
| #3  | 코드 | 5621468f | SecretResolverService.resolve() — catch 에서 `new Error('Secret decryption failed')` 래핑 |
| #4  | 코드 | 5621468f | assertRefFormat 에러 메시지: ref 값 미노출, length + starts_with 8자만 기록 (SS-SE-05) |
| #5  | 코드 | (사용자 결정 필요) | Telegram webhook guard 분리 (HooksService → 별도 Guard) — ESCALATE=user-decision |
| #6  | 코드 | 5dd110fe | NotificationWebhookProcessor.resolveSigningSecret() — legacy plaintext 경고 로그 추가 |
| #7  | spec | (draft 위임) | `plan/in-progress/spec-fix-secret-store-dip.md` — ISecretResolver DIP v1 면제 §2.1 |
| #8  | 코드 | (사용자 결정 필요) | rotateBotToken Controller→Service 위임 리팩토링 — ESCALATE=user-decision |
| #9  | spec | (draft 위임) | `plan/in-progress/spec-fix-secret-store-dip.md` — store vs rotate §2.1 허용 주석 포함 |
| #10 | 코드 | (사용자 결정 필요) | Phase 2: notification secretRef 경로 구현 — ESCALATE=user-decision |
| #11 | spec | (draft 위임) | `plan/in-progress/spec-fix-cch-v2-cron.md` — CCH-SE-04-C v2 token 승격 cron 미존재 |
| #12 | 코드 | 16a9f545 | TriggersService.setupChatChannel — botToken/secretToken secrets.rotate() 저장 |
| #13 | 코드 | 16a9f545 | TriggersService.remove — secrets.deleteByPrefix(`secret://triggers/{id}/`) 추가 |
| #14 | 코드 | e572cdfe | HooksService — secretTokenRef resolve 로 Telegram 인증, resolveSigningSecret 실패 401 |
| #15 | 코드 | 5dd110fe | NotificationWebhookProcessor — secretRef resolve 실패 시 markDegraded + skip |
| #16 | 코드 | 5dd110fe | NotificationWebhookProcessor — legacy plaintext fallback + warn 로그 |
| #17 | 코드 | 5621468f | SecretStore entity — `@Index` 추가 (`ref`, `workspaceId`) |
| #18 | 코드 | 5621468f | V063 migration — GIN index on (workspace_id, ref) |
| #19 | 코드 | e572cdfe, d0256bfb, 16a9f545, 5dd110fe | SecretStoreModule import 4개 모듈(hooks/chat-channel/triggers/external-interaction) |
| #20 | 코드 | (사용자 결정 필요) | rotateBotToken Controller→Service 분리 + 트랜잭션 — ESCALATE=user-decision |
| #21 | 코드 | 5621468f | SecretResolverService.store() vs rotate() 멱등성 — rotate UPSERT 구현 |
| #22 | 코드 | 5621468f | deleteByPrefix — `secret://` prefix 필수 검증 + LIKE 쿼리 |
| #23 | 코드 | 5621468f | secret-resolver.service.spec.ts — deleteByPrefix 3개 케이스 추가 |
| #24 | 코드 | 16a9f545 | setupChatChannel catch — `"secret_store 에 botToken 저장 완료 후 setupChannel 실패"` warn 로그 |
| #25 | 코드 | 75f926aa | TelegramAdapter.resolveBotToken() — SecretResolverService inject, JSDoc @throws |
| #26 | 코드 | 75f926aa | types.ts — botToken→botTokenRef, secretToken→secretTokenRef breaking change |
| #27 | 코드 | 75f926aa | TelegramAdapter.setupChannel — 매 호출마다 새 issuedSecretToken 발급 |
| #28 | 코드 | 16a9f545 | chat-channel-config.dto.ts — botTokenRef/secretTokenRef @ApiPropertyOptional readOnly 추가 |
| #29 | 코드 | 16a9f545 | trigger.entity.ts — chatChannelTokenV2 JSDoc "secret store ref" 명시 |
| #30 | 코드 | 16a9f545 | TriggersService.setupChatChannel — internalCfg botTokenRef 사용 |
| #31 | 코드 | 16a9f545 | TriggersService — rotateNotificationSecret JSDoc secretRef 갱신 |
| #32 | 코드 | 16a9f545 | notification-secret-rotator.service.ts JSDoc secretRef 갱신 |
| #33 | spec | (draft 위임) | `plan/in-progress/spec-fix-secret-store-example.md` — §5.1 teardown 예제 deleteByPrefix 패턴 |
| #34 | 코드 | 5621468f | spec/conventions/secret-store.md 신설 (§1 URI scheme · §2 인터페이스 · §3-5 보안 정책) |

## TEST 결과

- lint  : 미실행 (eslint --fix 가 tracked 파일을 되돌리는 부작용 — run-test.sh lint 호출 제외)
- unit  : 통과 (4436 passed)
- build : 통과 (e2e Docker 빌드 단계에서 검증)
- e2e   : 통과 (98/98) — 1차 실패 후 TS2339 빌드 오류(assertRefFormat never 타입 좁힘) 수정, 2차 통과

## 보류·후속 항목

### ESCALATE=user-decision 항목 (main 이 AskUserQuestion 필요)

- **#5** Telegram webhook guard 분리 — HooksService 내 provider별 분기 → NestJS Guard 패턴으로 리팩토링. 설계 결정 필요.
- **#8/#20** rotateBotToken Controller→Service 분리 + 트랜잭션 경계 설정. API 계약 변경 가능성 있음.
- **#10** Phase 2: notification webhook 에서 `signing.secretRef` 경로 구현 (현재는 Phase 1 legacy fallback 만).

### ESCALATE=spec 항목 (project-planner 위임 draft)

- `plan/in-progress/spec-fix-secret-store-dip.md` — SUMMARY#7(DIP v1 면제) + SUMMARY#9(store vs rotate §2.1 허용 주석)
- `plan/in-progress/spec-fix-cch-v2-cron.md` — SUMMARY#11(CCH-SE-04-C: bot token rotation v2 승격 cron 누락)
- `plan/in-progress/spec-fix-secret-store-example.md` — SUMMARY#33(§5.1 teardown 예제 deleteByPrefix 패턴으로 갱신)

### INFO 항목 (자동 수정 대상 아님)

- INFO 항목들은 SUMMARY.md 내 별도 INFO 섹션에서 확인. 본 resolution 에서 코드 변경 없음.
