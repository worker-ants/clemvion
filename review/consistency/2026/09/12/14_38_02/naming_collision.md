# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 및 방법

- **검토 모드**: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- **spec/5-system/ 델타**: 0개 파일 (이 PR 은 spec 을 건드리지 않는다 — `plan/in-progress/impl-setup-error-code.md` 의 `spec_impact: none` 과 일치. `spec/conventions/chat-channel-adapter.md` 의 `pending_plans` 주석만 갱신됨, 계약 문구 변경 없음).
- 실제 "신규 식별자"는 **구현 코드**(`codebase/backend/src/modules/chat-channel/**`, `codebase/backend/src/modules/triggers/**`)에서 나온다. 프롬프트 번들의 diff 섹션이 예산 절단으로 비어 있어, 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/impl-setup-error-code-ddd078`)에서 `git diff origin/main...HEAD`를 직접 열람해 검토했다 (21개 파일 변경분 전수).
- 각 신규 식별자에 대해 `grep -rn`으로 저장소 전체(코드+spec) 중복 정의·다른 의미 사용 여부를 확인했다.

## 신규 식별자 인벤토리 및 충돌 검사 결과

| 신규 식별자 | 정의 위치 | 충돌 검사 |
|---|---|---|
| `CREDENTIAL_REJECTED_CODE` (값 `'BOT_TOKEN_INVALID'`) | `chat-channel/types.ts` | 값 `'BOT_TOKEN_INVALID'` 자체는 `origin/main`에 이미 존재하던 에러 코드(§5.4 SoT) — 새 상수는 기존 값을 가리키는 이름일 뿐, 재정의 없음. 유일 정의. |
| `CredentialRejectedError` (타입) | 동일 | 유일 정의, 다른 곳에서 미사용 재정의 없음 |
| `credentialRejectedError()` (팩토리 함수) | 동일 | 유일 정의. `discord/slack/telegram.adapter.ts`, `triggers.service.spec.ts`, `chat-channel-input-rules.spec.ts`에서 동일 의미로만 소비 |
| `isCredentialRejectedError()` | 동일 | 유일 정의, `chat-channel-input-rules.ts`에서만 소비 |
| `DISCORD_CREDENTIAL_REJECTED_STATUSES` | `discord.adapter.ts` | 유일 정의 |
| `SLACK_CREDENTIAL_REJECTED_ERRORS` | `slack.adapter.ts` | 유일 정의 |
| `TELEGRAM_CREDENTIAL_REJECTED_STATUSES` | `telegram.adapter.ts` | 유일 정의 |
| `telegramApiError()` (모듈 내부 헬퍼) | `telegram.adapter.ts` | 유일 정의, export 안 됨 |
| `DiscordApiError.status` (신규 필드) | `discord.types.ts` | `status`는 흔한 필드명이나 이 인터페이스 안에서 기존 `code`(Discord 원본 숫자) 필드와 네임스페이스가 명확히 분리되어 정의됨. 코드 주석이 "우리 `Error.code` 판별자와 다른 네임스페이스"임을 스스로 명시 — 혼동 방지 조치가 이미 되어 있다. |
| `@ApiBadGatewayResponse` (신규 사용, 데코레이터 자체는 `@nestjs/swagger` 기존 API) | `triggers.controller.ts` | 신규 식별자 아님 — 기존 NestJS Swagger 데코레이터의 첫 실사용. `spec/conventions/swagger.md:291`의 `502 외부 provider 호출 실패 → @ApiBadGatewayResponse` 매핑과 정확히 일치 |
| `BadGatewayException` (신규 사용, `@nestjs/common` 기존 API) | `chat-channel-input-rules.ts`, `http-exception.filter.spec.ts` | 신규 식별자 아님 — 이 저장소의 첫 실사용(0건→1건, CHANGELOG 명시). 기존 클래스라 충돌 대상 없음 |

## 기존 사용처와의 정합성 확인 (엔드포인트/응답 계약 축)

- `400 BOT_TOKEN_INVALID` / `502 CHAT_CHANNEL_SETUP_FAILED` 분류는 `spec/5-system/15-chat-channel.md §5.4`(R-CC-23), `spec/5-system/2-api-convention.md §6`, `spec/conventions/chat-channel-adapter.md §1.1.2`에 **이미 확정되어 있던 계약**(`origin/main` 시점에 이미 존재, 이번 diff 는 이 세 파일을 건드리지 않음)이고, 이번 구현 diff 는 그 계약을 코드에 실현했을 뿐이다. 새 의미의 재정의가 아니다.
- `INVALID_BOT_TOKEN`(입력 검증 실패, `triggers.controller.ts`)과 `BOT_TOKEN_INVALID`(자격 증명 거부, 이번 구현 대상)는 철자가 비슷해 혼동 소지가 있으나 **둘 다 `origin/main`에 이미 공존하던 별개 코드**이며 이번 PR 이 새로 만든 쌍이 아니다(과거 결정 사항, 재-flag 대상 아님).
- 프런트엔드 `backend-labels.ts`(`BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`), user-guide mdx 4파일, `triggers.mdx`는 이미 두 코드 문자열을 알고 있었고 이번 diff 는 **안내 문구만** 갱신(라벨 키 자체는 불변) — 신규 키 충돌 없음.
- `Error.code` 프로퍼티는 콜스택에서 4가지 네임스페이스(본 계약 문자열 / Discord 원본 숫자 `code` / EIA `event.error.code` / Node·undici 시스템 에러 `code`)가 공존한다는 사실을 구현자가 `isCredentialRejectedError()` 주석과 `discord.types.ts` 주석에 명시적으로 적어 뒀고, 판별은 화이트리스트 정확 일치로 구조적으로 격리했다 — 잠재적 이름 충돌(`code`라는 필드명 재사용)에 대한 선제 방어가 이미 코드에 있다.

## 발견사항

없음 — CRITICAL/WARNING/INFO 등급의 신규 식별자 충돌을 발견하지 못했다.

## 요약

이번 PR 은 spec 을 변경하지 않고(`spec/5-system/` 델타 0) 이미 확정된 `spec/5-system/15-chat-channel.md §5.4`·`spec/conventions/chat-channel-adapter.md §1.1.2` 계약을 코드로 실현하는 구현 전용 턴이다. 새로 도입된 식별자(`CREDENTIAL_REJECTED_CODE`, `CredentialRejectedError`, `credentialRejectedError`, `isCredentialRejectedError`, provider 별 `*_CREDENTIAL_REJECTED_*` 상수, `DiscordApiError.status` 필드)는 모두 저장소 전체에서 유일하게 정의되고 일관되게 소비되며, 기존에 다른 의미로 쓰이던 이름과 겹치지 않는다. `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED`/`INVALID_BOT_TOKEN` 등 기존 에러 코드는 재정의 없이 그대로 참조됐고, `@ApiBadGatewayResponse`/`BadGatewayException` 신규 사용은 기존 프레임워크 API·swagger 컨벤션 표와 정합한다. `code` 필드명이 다의적으로 재사용되는 잠재 위험은 구현 코드 자체가 주석으로 네임스페이스를 명시하고 화이트리스트 판별로 격리해 두어 별도 지적이 불필요하다.

## 위험도

NONE
