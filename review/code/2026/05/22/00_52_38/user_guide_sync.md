# 유저 가이드 동반 갱신(User Guide Sync) 검토 결과

검토 대상 worktree: `chat-channel-telegram-0c106c`
검토 범위: `HEAD~7..HEAD` 커밋 세트 (chat-channel 신규 모듈 구현 전체)
검토일: 2026-05-22

---

## 발견사항

### [WARNING] Chat Channel 설정(config.chatChannel) 이 triggers.mdx 에 미반영

- **변경 파일**: `codebase/backend/src/modules/triggers/triggers.service.ts`, `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`, `codebase/backend/src/modules/triggers/entities/trigger.entity.ts`
- **매트릭스 항목**: "통합 신규/제공자 변경" — `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키 동반 갱신 필요
- **누락된 동반 갱신**: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` + `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx`
- **상세**: `triggers.service.ts` 에 Chat Channel 라이프사이클(`setupChannel`, `teardownChannel`)이 추가됐고, `chat-channel-config.dto.ts` 가 신규 생성됐다. Webhook 트리거에 `config.chatChannel` 갈래가 추가된 것은 트리거 설정 스키마의 중요한 확장이다. 현재 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 는 `notification` / `interaction` 두 채널만 다루고 Chat Channel 설정 방법(botToken 입력 방법, `setupChannel` 결과, `rotate-bot-token` API 호출 방법, `chat_channel_health` 상태 확인 방법 등)이 전혀 없다. 사용자가 Telegram Chat Channel 연결 방법을 유저 가이드에서 찾을 수 없는 상태다.
- **제안**: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 에 "Chat Channel 연결 (Telegram 봇)" 절을 추가한다. `config.chatChannel` 페이로드 예시, `chatChannelHealth` 상태 표시, `POST /api/triggers/:id/chat-channel/rotate-bot-token` bot token 회전 방법을 안내한다. `triggers.en.mdx` 에도 영문 절을 동반 작성한다.

---

### [WARNING] Telegram 공급자 통합 가이드 문서 미작성

- **변경 파일**: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts`, `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-client.ts`, `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-message.renderer.ts`, `codebase/backend/src/modules/chat-channel/providers/telegram/telegram-update.parser.ts`
- **매트릭스 항목**: "통합 신규/제공자 변경" — `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키 동반 갱신
- **누락된 동반 갱신**: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` + `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx` (신규)
- **상세**: Telegram 어댑터가 완전히 새로운 서버사이드 통합 공급자로 추가됐다. 사용자는 Telegram 봇 생성 방법, BotFather API token 발급, Webhook URL 등록(`setupChannel` 자동 처리 여부), 봇이 수신·처리하는 메시지 유형 등에 대한 가이드가 필요하다. `06-integrations-and-config/` 하위에 cafe24 통합처럼 `telegram.mdx` / `telegram.en.mdx` 가 없다. 사용자가 Telegram 봇 연결 방법을 전혀 찾을 수 없다.
- **제안**: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` 와 `telegram.en.mdx` 를 신규 작성한다. BotFather 봇 생성, bot token 발급·입력 흐름, Chat Channel 활성화 방법, 지원하는 프레젠테이션 노드 유형(Form, Carousel, Chart, Table, Template), 인터랙션 명령 처리를 안내한다.

---

### [WARNING] Chat Channel 신규 모듈에서 발행하는 HTTP error code 의 ko 매핑 누락

- **변경 파일**: `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts`
- **매트릭스 항목**: "신규 errorCode 발행" — `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO` 매핑 검토 + PR 본문 사용자 가시 ko 노출 명시
- **누락된 동반 갱신**: `codebase/frontend/src/lib/i18n/backend-labels.ts` 에 신규 error code 목록 기재 / PR 본문 명시
- **상세**: `chat-channel.controller.ts` 의 `rotateBotToken` 핸들러가 5종의 신규 error code 를 발행한다 (`INVALID_BOT_TOKEN`, `WORKSPACE_REQUIRED`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`). 매트릭스는 "신규 errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시"를 요구한다. 이 error code 들은 `warningRules` / `ErrorCode enum` 경로가 아닌 NestJS HTTP exception 의 `code` 필드이므로 `backend-labels.ts` 의 자동 가드 대상은 아니나, PR 본문에 "이 code 들은 영문 그대로 사용자에게 노출될 수 있다"는 명시가 필요하다. 현재 PR 본문이 이를 언급하지 않는다.
- **제안**: PR 본문에 신규 error code 6종의 목록과 "현재 `ERROR_KO` 테이블 미도입으로 영문 그대로 노출 — 향후 `backend-labels.ts` `ERROR_KO` 신설 시 흡수"를 한 문단으로 명시한다.

---

### [INFO] `security-2fa.mdx` / `security-2fa.en.mdx` 의 코드 경로 수정 — 인증 흐름 변경 아님

- **변경 파일**: `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.mdx`, `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.en.mdx`
- **매트릭스 항목**: "인증·권한·세션 흐름 변경" — `codebase/frontend/src/content/docs/07-workspace-and-team/` 관련 페이지 + e2e
- **상세**: 변경 내용이 frontmatter 의 `code:` 경로 참조만 수정한 것이다 (`webauthn.service.ts` → `webauthn/webauthn.service.ts`). 인증 흐름 자체의 변경이 아니므로 `07-workspace-and-team/` 추가 갱신이나 e2e 보강이 필요하지 않다. 회색 지대이지만 파일 경로 참조 수정 수준이므로 무관 판정.

---

### [INFO] `codebase/backend/src/nodes/integration/cafe24/metadata/order.ts` 변경 — 노드 schema 변경 여부 확인

- **변경 파일**: `codebase/backend/src/nodes/integration/cafe24/metadata/order.ts`
- **매트릭스 항목**: "노드 schema 변경 (필드 추가·라벨 변경)" — `02-nodes/integrations.mdx` FieldTable + dict + backend-labels 동반 갱신
- **상세**: 이 파일은 chat-channel PR 의 변경 집합에 포함되어 있으나 내용을 직접 확인하지 못했다. metadata 파일이므로 노드 공개 필드 변경이 아닌 내부 API 카탈로그 갱신일 가능성이 높다. chat-channel 구현과 무관한 별도 작업이 같이 커밋된 것으로 보인다. 만약 Cafe24 order 노드의 필드 추가·라벨 변경이 포함됐다면 `02-nodes/integrations.mdx` / `integrations.en.mdx` 갱신이 필요할 수 있다.
- **제안**: `order.ts` 변경이 사용자 가시 필드(label, placeholder, options 등)를 추가·변경했는지 확인한다. 단순 API 메타데이터 추가라면 해당 없음.

---

## 요약

PROJECT.md §변경 시 동반 갱신 매트릭스의 trigger 항목 중 이번 변경 세트에 매칭되는 항목은 "통합 신규/제공자 변경", "신규 errorCode 발행", "인증·권한·세션 흐름 변경", "노드 schema 변경" 4개다. 이 중 매칭 건수는 4개이고 누락이 확인된 항목은 3개다. Telegram 어댑터 신규 공급자 추가와 Chat Channel 트리거 설정 확장은 모두 사용자 가시 변경임에도 `02-nodes/triggers.mdx` 갱신 및 `06-integrations-and-config/telegram.mdx` 신규 작성이 누락되어 사용자가 기능을 사용하는 방법을 가이드에서 찾을 수 없는 상태다.

## 위험도

**MEDIUM** — CRITICAL 누락(i18n parity 파괴, locale 등록 누락)은 없으나, Telegram Chat Channel 이라는 대형 기능이 유저 가이드에 전혀 반영되지 않아 사용자 가이드 stale 상태가 장기화될 위험이 있다. 인증 흐름 변경에 의한 `07-workspace-and-team/` 추가 갱신 필요성은 없다.

---

STATUS=success ISSUES=3
