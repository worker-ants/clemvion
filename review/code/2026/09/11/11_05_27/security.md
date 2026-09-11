# 보안(Security) 코드 리뷰

## 검토 범위

- `codebase/backend/src/common/utils/password.util.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (신규)
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts` / `.spec.ts`
- `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`
- `plan/in-progress/impl-details-code-wiring.md`, `review/consistency/2026/09/11/10_28_52/**` (메타 산출물, 보안 관점 대상 아님)

변경의 본질은 (A) 검증 실패 응답 `details[]` 원소에 `code: 'INVALID_FIELD'`를 배선, (B) DTO/서비스 두 층에 중복돼 있던 거부 메시지 리터럴을 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 상수로 단일화, (C) `ChatChannelConfigDto.botToken`에 `@MinLength(1)` 추가, (D) 이를 검증하는 unit/e2e 테스트 보강이다. 신규 인젝션 경로, 신규 인증/인가 로직, 신규 암호화 로직은 없다.

### 발견사항

- **[INFO]** `botToken`에 `@MinLength(1)`을 추가해 닫은 갭이 `SecretResolverService.rotate()` 자체에는 아직 남아 있음
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (함수 `rotate`, 대략 129~145행) — 이 파일은 이번 diff 에 포함되지 않았으나 이번 PR 이 고친 문제의 근본 원인 함수라 교차 확인함
  - 상세: 이번 PR 이 고친 것은 `ChatChannelConfigDto.botToken`(생성 경로 DTO)의 `''` 통과 문제다. 그러나 `rotate(ref, workspaceId, newPlaintext)` 자체는 `newPlaintext`가 빈 문자열이어도 그대로 UPSERT 한다 — 호출부가 DTO 검증을 우회하거나 다른 호출 경로가 생기면 다시 빈 시크릿이 저장될 수 있는 구조다. 컨트롤러의 `rotateBotToken`(`triggers.controller.ts:264-275`, `codebase/backend/src/modules/triggers/triggers.controller.ts`)은 `if (!body?.newBotToken ...)`로 별도 방어를 하고 있어 현재 공개 진입점 기준으로는 실질 악용 경로가 확인되지 않지만, 방어가 호출부마다 개별로 흩어져 있어 새 호출부가 추가될 때 재발할 수 있는 구조다.
  - 제안: 이미 plan(`plan/in-progress/impl-details-code-wiring.md` §C, checklist)에 "rotate 자체의 빈 값 가드는 별개 항목"으로 명시돼 있어 이번 PR 의 스코프 밖임을 인지하고 있다. 후속 항목으로 `SecretResolverService.rotate`/`store`에 `newPlaintext`/`plaintext` 공백 거부를 내재화해 depth-in-defense를 확보할 것을 권장 (신규 CRITICAL 은 아님 — 이번 diff 가 만든 결함이 아니라 사전에 알려진 잔여 갭).

- **[INFO]** 신규 상수 파일의 사용자 노출 메시지가 내부 API 경로를 그대로 안내함
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts:24-26` (`botToken` 메시지, `POST /api/triggers/:id/chat-channel/rotate-bot-token` 인용)
  - 상세: 에러 메시지가 실제 내부 라우트 경로를 사용자에게 노출한다. 다만 이 라우트는 Swagger 문서에도 이미 공개돼 있고(`triggers.controller.ts` `@ApiOperation`), `@Roles('editor')`로 보호되는 뮤테이션 엔드포인트라 경로 자체의 노출이 추가 공격 표면을 만들지는 않는다. 정보 노출 관점의 실질 위험은 없음 — 참고용으로만 기록.

새로 도입된 SQL/커맨드/경로 인젝션, 하드코딩된 시크릿(테스트 픽스처의 `'111:New'`, `SLACK_SIGNING_SECRET_HEX32` 등은 명백한 가짜/placeholder 값), 인증/인가 우회, 안전하지 않은 암호화(`bcrypt`/`BCRYPT_ROUNDS=12` 변경 없음), 에러 메시지를 통한 민감정보(비밀값·스택트레이스·내부 식별자 값 자체) 노출은 발견되지 않았다. `details.field`/`details.code`에 실리는 값은 전부 화이트리스트된 필드명·고정 코드 문자열이며, `authConfigId` 같은 실제 값이 아니라 필드 이름만 노출한다.

`@MinLength(1)` 추가는 "선언(`@ApiProperty({minLength:1})`)이 구현보다 넓었던" 방어 누락을 메우는 보안 긍정적 변경이며(빈 문자열이 provider 호출 전에 secret store 에 먼저 저장되는 경로를 차단), 뮤테이션 테스트로 15/15 자리를 개별 검증한 점도 회귀 방지 측면에서 긍정적이다.

### 요약

이번 PR 은 검증 에러 응답의 `details[].code` 배선, 거부 메시지 문자열의 DRY화, `botToken` 빈 문자열 거부(`@MinLength(1)`) 추가로 구성된 저위험 변경이다. 신규 인젝션·인증 우회·시크릿 하드코딩·암호화 약화는 없으며, `@MinLength(1)` 추가는 오히려 기존에 존재하던 "빈 시크릿 저장" 갭을 하나 막는 보안 긍정적 수정이다. 유일하게 짚을 점은 `SecretResolverService.rotate()` 자체가 여전히 빈 값을 가드하지 않는다는 것인데, 이는 이번 diff 가 만든 결함이 아니라 plan 에 이미 별도 항목으로 명시된 pre-existing 잔여 갭이다.

### 위험도
NONE
