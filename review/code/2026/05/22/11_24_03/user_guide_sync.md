# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 분석 개요

PROJECT.md §변경 유형 → 갱신 위치 매핑 (변경 시 동반 갱신 매트릭스) 를 기준으로 변경 set 을 점검했다.

변경 파일 목록 (git diff --name-only HEAD):

- `codebase/backend/src/modules/chat-channel/types.ts` — `ChatChannelConfig.botToken` → `botTokenRef`, `secretToken` → `secretTokenRef`, `SetupResult.issuedSecretToken` 신규
- `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` — `SecretResolverService` 경유 botToken resolve
- `codebase/backend/src/modules/chat-channel/chat-channel.controller.ts` — rotate-bot-token 엔드포인트 secret store 전환
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — `botToken` → `botTokenRef` guard 변경
- `codebase/backend/src/modules/hooks/hooks.service.ts` — `secretToken` → `secretTokenRef` + SecretResolver.resolve
- `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts` — signing secret SecretResolver 경유
- `codebase/backend/src/modules/triggers/triggers.service.ts` — rotateNotificationSecret secret store 전환
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` — swagger 설명 갱신
- `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` — 포함
- `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx` — 포함
- 그 외 spec, plan, test, module 파일들

---

## 매트릭스 trigger 매칭 결과

### Trigger 1: 통합 신규/제공자 변경

**해당 파일**: `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` (Telegram 제공자 실질 변경)

**매트릭스 middle column**: `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키

**검증**:
- `telegram.mdx` — 변경 set 에 포함. §7 제한 사항에 CCH-SE-03 AES-256-GCM 암호화 보관 설명이 정확히 추가됨.
- `telegram.en.mdx` — 변경 set 에 포함. 동일 내용 영문 반영됨.
- dict 키 변경 — 이번 변경에서 새 UI 문자열(TSX 신규 한국어 리터럴)이 추가된 파일 없음. `codebase/frontend/src/lib/i18n/dict/` 변경 없음 → 매트릭스 dict 키 동반 갱신 요건 해당 없음.

**판정**: 동반 갱신 충족.

---

### Trigger 2: 통합 변경 — 코드 예제(docs) 와 실제 API 의 미묘한 괴리 검토

`telegram.mdx` §2 의 코드 예제는 여전히 `"botToken": "<BotFather에서 받은 token>"` 을 사용한다.

실제 DTO (`chat-channel-config.dto.ts`) 도 여전히 `botToken` 을 input 필드로 받는다 (내부에서 즉시 secret store 에 저장하고 ref 로 교체). 즉, API 입력 인터페이스는 변경 전후로 동일하게 `botToken` plaintext 를 받는다. 이 설계는 DTO swagger 설명("입력으로만 사용 — 서버가 즉시 secret store 에 암호화 보관하고 config 에는 ref만 저장. 응답·조회 시에는 마스킹.")에 명시되어 있다.

따라서 docs 의 `botToken` 코드 예제는 외부 API 사용자 관점에서 여전히 유효하다. 문서와 API 인터페이스 사이 불일치 없음.

---

### Trigger 3: warningCode / errorCode 신규 발행 없음

`codebase/backend/src/nodes/core/error-codes.ts` 변경 없음, `warningRules` 변경 없음. `codebase/frontend/src/lib/i18n/backend-labels.ts` 동반 갱신 필요 없음.

---

### Trigger 4: 신규 UI TSX 문자열 없음

`codebase/frontend/src/**/*.tsx` 변경 없음. i18n parity 검토 불요.

---

### Trigger 5: 신규 섹션 디렉토리 없음

`codebase/frontend/src/content/docs/` 에 신규 디렉토리 생성 없음. `locale.ts` 등록 검토 불요.

---

### Trigger 6: 노드 신규 추가 없음

`codebase/backend/src/nodes/<cat>/<name>/` 신규 파일 없음 (`table.handler.spec.ts` 는 기존 노드의 spec 변경).

---

### Trigger 7: 인증·권한·세션 흐름 변경 — 해당 없음

`codebase/backend/src/auth/**` 변경 없음. webhook secret 검증 로직은 `07-workspace-and-team/` 와 무관한 Chat Channel 인증 흐름이므로 해당 docs 갱신 불요.

---

## 발견사항

발견된 누락 없음. 모든 매트릭스 trigger 에 대해 동반 갱신이 충족되거나 해당 없음 판정.

---

## 요약

PROJECT.md 매트릭스 기준 총 9개 trigger 유형 검토. 변경 set 에서 매칭된 trigger 는 "통합/제공자 변경 (Telegram)" 1건이며, 동반 갱신 대상인 `telegram.mdx` + `telegram.en.mdx` 양쪽이 모두 같은 변경 set 에 포함되어 정상 충족. 신규 i18n 키, warningCode/errorCode, 신규 노드, 신규 섹션 디렉토리 해당 없음. 누락 0건.

## 위험도

NONE
