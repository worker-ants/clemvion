# Code Review 통합 보고서 — chat-channel-secret-store-pgcrypto

## 전체 위험도
**HIGH** — Testing CRITICAL 2건 포함. secret store 인프라 도입 + 5개 모듈 plaintext→ref 전환 대규모 PR.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| #1 | Testing | `deleteByPrefix` in-memory mock 버그 — `_lastPrefix` 미설정으로 삭제 0건. 단위 테스트 미존재. | `secret-resolver.service.spec.ts` L43–60 | mock `where()`에서 `params.prefix` → `_lastPrefix` 세팅; 단위 테스트 추가. |
| #2 | Testing | `rotate-bot-token` 6단계 로직에 대한 컨트롤러 단위 테스트 미존재. | `chat-channel.controller.ts` (변경분) | `chat-channel.controller.spec.ts` 신설. |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| #3 | Security | `assertRefFormat` 에러 메시지에 ref 값 포함 — plaintext bot token 로그 노출 가능. SS-SE-05 위반. | `secret-resolver.service.ts:assertRefFormat` | `'invalid ref format (input length=' + ref.length + ')'` |
| #4 | Security | `resolve()` 원본 crypto 에러 raw re-throw — 암호화 실패 상세 노출 가능. | `secret-resolver.service.ts:resolve` catch | 추상화된 에러로 교체, 원본은 로그에만. |
| #5 | Security | `secretTokenRef` 미설정 시 Telegram webhook 인증 완전 skip — SSRF/봇 스푸핑 노출. | `hooks.service.ts` | `chatChannelHealth !== 'healthy'` 시 webhook 거부 가드 추가 권장. |
| #6 | Security | legacy plaintext fallback 경로 경고 로그 없음 — 마이그레이션 미완료 추적 불가. | `notification-webhook.processor.ts:resolveSigningSecret` | `logger.warn('legacy plaintext signing secret detected (triggerId=...)')` 추가. |
| #7 | Architecture | DIP 미완 — `ISecretResolver` 인터페이스 없이 구체 클래스에 직접 의존. spec §2 gap. | 5개 소비자 모듈 전체 | spec 위임 (deleteByPrefix를 spec §2에 추가 포함). |
| #8 | Architecture | Controller에 비즈니스 오케스트레이션 로직 집중 (약 60줄). | `chat-channel.controller.ts:rotateBotToken` | `TriggersService.rotateBotToken(...)` 메서드로 위임. |
| #9 | Requirement | 신규 trigger 생성 시 `store` 대신 `rotate` 사용 — spec §2.1 호출 규약 위반 의심. | `triggers.service.ts:setupChatChannel` | `store` 사용 또는 spec §2.1 멱등성 허용 예외 명시 (spec 위임). |
| #10 | Requirement | notification.signing.secret 최초 저장 → secretRef 변환 경로 누락 — 신규 trigger secretRef 항상 공란. | `triggers.service.ts`, plan §Phase 2 | `create/update`에서 `secrets.store` 호출 + config에 `secretRef`만 남기는 코드 추가 또는 Phase 2 완료 확인. |
| #11 | Requirement | `chat_channel_token_v2` v2 → primary 승격 cron 미존재 — v2 ref 저장이 dead code. | `chat-channel.controller.ts:rotateBotToken` | 승격/만료 cron 추가 또는 spec §CCH-SE-04 구현 여부 명확화. |
| #12 | Testing | `setupChatChannel` 신규 secret store 경로 (botToken store, webhookSecret store, fallback) 미테스트. | `triggers.service.spec.ts` | `setupChatChannel` describe 신설 — `secrets.rotate` 2회 호출, issuedSecretToken 없을 때 미호출, setupChannel throw 시 fallback 검증. |
| #13 | Testing | `remove` 메서드의 `deleteByPrefix` 호출 검증 없음. | `triggers.service.spec.ts` | `secrets.deleteByPrefix`가 `secret://triggers/<id>/`로 호출됨을 검증. |
| #14 | Testing | `secretTokenRef` resolve 실패 → `UnauthorizedException` 경로 미테스트. | `hooks.service.spec.ts` | `secrets.resolve.mockRejectedValueOnce(new Error(...))` → 401 검증. |
| #15 | Testing | `resolveSigningSecret` secretRef resolve 실패 → `markDegraded` 경로 미테스트. | `notification-webhook.processor.spec.ts` | `secrets.resolve.mockRejectedValueOnce(...)` → degraded + skip 케이스. |
| #16 | Testing | legacy plaintext fallback 경로 명시적 테스트 없음. | `notification-webhook.processor.spec.ts` | 테스트명에 "(legacy plaintext fallback)" 명시. |
| #17 | Database | `ref CHECK constraint`이 `ALTER TABLE`로 분리 — 신규 테이블이라 즉각 위험 없으나 패턴 불일치. | `V063__secret_store.sql` | 향후 기존 테이블 적용 시 `NOT VALID → VALIDATE` 패턴 사용. |
| #18 | Database | `promoteRotatedNotificationSecrets` 반복문 내 N+1 쿼리. | `triggers.service.ts` | 단기 현구조 유지 가능, 향후 batch 처리 검토. |
| #19 | Dependency | `HooksModule`의 `SecretStoreModule` 직접 import — transitive 중복 가능. | `hooks.module.ts` | 직접 사용 여부 확인. |
| #20 | Maintainability | `rotate` 내부 2회 DB 조회 (findOne + update/insert). | `secret-resolver.service.ts:rotate` | TypeORM `upsert(entity, ['ref'])` 활용. |
| #21 | Maintainability | `legacyPlaintext` 파라미터가 항상 `null` — 사문화. | `notification-webhook.processor.ts` | 별도 메서드 분리 또는 주석 명시. |
| #22 | Maintainability | Telegram 인증 블록 인라인 — provider 추가 시 유지보수 부담. | `hooks.service.ts` | `validateWebhookAuth(config, headers)` private 메서드 추출. |
| #23 | Maintainability | `SecretResolverService` mock 리터럴 5개+ spec 파일 중복. | `triggers.service.spec.ts`, `hooks.service.spec.ts` 등 | `test/factories/secret-resolver.mock.ts` 공용 팩토리 생성. |
| #24 | Side Effect | `setupChatChannel` 실패 시 botTokenRef DB 기록 후 경고 로그 없음. | `triggers.service.ts:setupChatChannel` catch | 실패 시 경고 로그 추가. |
| #25 | Side Effect | `TelegramAdapter` constructor 시그니처 변경 — `grep -r "new TelegramAdapter"` 미수행. | `telegram.adapter.ts` | 코드베이스 전수 검색 필요. |
| #26 | Side Effect | `ChatChannelConfig.botToken → botTokenRef` breaking change — read-path fallback 없음. | `chat-channel/types.ts` | 미배포 전제 주석으로 명시. |
| #27 | Documentation | `TelegramAdapter.resolveBotToken` JSDoc 부정확 (`@throws` 미기재). | `telegram.adapter.ts` | `@throws` 추가, 설명 단순화. |
| #28 | Documentation | 응답 DTO의 `botTokenRef`/`secretTokenRef` `@ApiProperty` 미기재. | `dto/chat-channel-config.dto.ts` | `@ApiPropertyOptional` 추가. |
| #29 | Documentation | `Trigger.chatChannelTokenV2` JSDoc "v1 plaintext stub" — 구현과 불일치. | `entities/trigger.entity.ts` | "secret store ref 보관" 으로 갱신. |
| #30 | Documentation | `rotateNotificationSecret` JSDoc step 2/3이 `config.signing.secret` (plaintext) 참조. | `triggers.service.ts` | `signing.secretRef` 로 수정. |
| #31 | Documentation | `promoteRotatedNotificationSecrets` JSDoc stale. | `triggers.service.ts` | `secretRef` 로 갱신. |
| #32 | Documentation | `NotificationSecretRotatorService` JSDoc `signing.secret → signing.secretRef`. | `notification-secret-rotator.service.ts` | JSDoc 갱신. |
| #33 | Spec/Documentation | `spec/conventions/secret-store.md §5.1` 예제 코드 `delete botToken` 라인 — 실제 구현과 불일치. | `spec/conventions/secret-store.md` L164–170 | 예제 재작성 (spec 위임). |
| #34 | Scope | `table.handler.spec.ts` PR과 무관한 포맷팅 전용 변경이 diff에 포함. | `table.handler.spec.ts` | 별도 커밋/PR 권장 (기능 영향 없음). |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 |
|---|----------|----------|
| I-1 | Security | masterKey 힙 메모리 상주 — v2 과제로 추적 (`onModuleDestroy` wipe). |
| I-2 | Security | masterKey 공용 재사용 — 도메인 분리 후속 검토. |
| I-3 | Security | `parseMasterKey` SHA-256 KDF fallback — 프로덕션 가이드에 "64-char hex 강제" 명시 필요. |
| I-4 | Security | `deleteByPrefix` LIKE 메타문자 이스케이프 미수행 — 내부 prefix라 실제 위험 낮음. |
| I-5 | Security | `secret_store` workspace_id FK 미설정 — orphan row 가능성. |
| I-6 | Security | rotate-bot-token Telegram grace 미지원. |
| I-7 | Security | setupChannel 실패 시 botTokenRef config 저장 — degraded 상태 관리 정상. |
| I-8 | Security | `deleteByPrefix` workspace 소유권 검증 없음 — JSDoc 주의 명시 권고. |
| I-9 | Security | `chokidar@3.6.0` optional/peer — CVE 미확인, npm audit 추적. |
| I-10 | Requirement | `spec/1-data-model.md §2.21.1` "pgcrypto 백엔드" stale 표현 — spec 수정 위임. |
| I-11 | Requirement | `ChatChannelConfigDto.botToken` 응답 마스킹 명세 없음 — spec 보완 위임. |
| I-12 | Architecture | 순환 의존성 없음. |
| I-13 | User Guide | `telegram.mdx`/`telegram.en.mdx` 동반 갱신 충족. 누락 0건. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | HIGH | CRITICAL 2건 + WARNING 5건 |
| security | MEDIUM | assertRefFormat 로그 노출, resolve raw re-throw, telegram skip, legacy fallback 무경고 |
| requirement | MEDIUM | store vs rotate spec §2.1, Phase 2 secretRef 경로 누락, v2 cron 미존재 |
| database | MEDIUM | N+1 쿼리, CHECK constraint 패턴 |
| side_effect | MEDIUM | constructor 시그니처, breaking change |
| architecture | LOW | DIP 미완, Controller 로직 집중 |
| dependency | LOW | transitive 중복 가능성 |
| maintainability | LOW | mock 중복, rotate 2회 조회 |
| documentation | LOW | JSDoc 4건 오래된 내용 |
| scope | LOW | table.handler.spec.ts 무관 변경 |
| user_guide_sync | NONE | 누락 0건 |

---

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, user_guide_sync (11명)
  - **강제 포함(router_safety)**: security, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database

  | 제외된 reviewer | 이유 |
  |-----------------|------|
  | performance | SecretResolver 호출은 필요 지점에만 — I/O 루프·캐싱 문제 없음 |
  | concurrency | async/await 패턴 표준적 — 락/뮤텍스/워커/큐 변경 없음 |
  | api_contract | HTTP 라우트 변경 없음 — 내부 helper 패턴만 변경 |
