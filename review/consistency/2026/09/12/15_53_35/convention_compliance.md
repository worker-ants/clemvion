# 정식 규약 준수 검토 — `spec/5-system/15-chat-channel.md`

검토 모드: `--impl-prep` (scope=`spec/5-system/`). 대조 대상: `spec/conventions/error-codes.md` ·
`secret-store.md` · `redis-keys.md` · `audit-actions.md` · `swagger.md` · `chat-channel-adapter.md` ·
`node-output.md` · `interaction-type-registry.md` · `egress-masking.md` · `spec-impl-evidence.md`,
그리고 이 spec 이 직접 인용하는 `spec/5-system/2-api-convention.md` §6/naming.

## 발견사항

- **[INFO]** `BOT_TOKEN_INVALID` 가 형제 코드들과 도메인 prefix 를 공유하지 않는다
  - target 위치: §5.4 응답 계약 표(400 행) · §4.1 `botToken` 필드 주석 · R-CC-23
  - 위반 규약: `spec/conventions/error-codes.md` §1 "도메인 prefix (권장)" —
    `CHAT_CHANNEL_*` 로 그룹화하는 형제 코드 4종(`CHAT_CHANNEL_NOT_CONFIGURED` ·
    `CHAT_CHANNEL_PROVIDER_UNKNOWN` · `CHAT_CHANNEL_ENDPOINT_REQUIRED` ·
    `CHAT_CHANNEL_SETUP_FAILED`)과 달리 `BOT_TOKEN_INVALID` 만 prefix 가 없다.
  - 상세: error-codes.md §1 은 도메인 범주화가 의미 있는 코드에 `<DOMAIN>_<CONDITION>` prefix 를
    권장한다. 같은 표 안에서 4/5 가 `CHAT_CHANNEL_` prefix 를 쓰는데 `BOT_TOKEN_INVALID` 만
    비어 있어 표기가 섞인다. 다만 이는 규약이 "권장"이라고 명시한 항목이라 CRITICAL/WARNING
    급 위반은 아니며, 코드가 이미 backend 전역(`types.ts` `CREDENTIAL_REJECTED_CODE`,
    telegram/slack/discord adapter, `triggers.service.ts`, 다수 테스트)에 폭넓게 배선돼
    있어 §2 "이름 정확성 향상만을 위한 rename 은 하지 않는다" 원칙상 지금 rename 압력을
    만드는 것도 바람직하지 않다.
  - 제안: 신규 결정 불필요 — 현행 유지가 규약의 rename 정책과 정합한다. 다만 이 비대칭이
    의도(자격증명 거부는 provider-agnostic 개념이라 provider 카테고리 자체를 넘는 별도
    범주라는 뜻)라면, error-codes.md §3 historical-artifact 예외 레지스트리에 한 줄
    등재해 "왜 이 코드만 prefix 가 없는가"를 명문화하는 편이 다음 리뷰 라운드의 재지적을
    막는다.

## 교차 확인 — 위반 없음을 확인한 항목

- **에러 코드 표기**: `VALIDATION_ERROR` / `WORKSPACE_ID_REQUIRED` / `RESOURCE_NOT_FOUND` /
  `INVALID_BOT_TOKEN` / `CHAT_CHANNEL_*` 4종 / `INVALID_FIELD`(details) 모두 `UPPER_SNAKE_CASE`
  로 `error-codes.md` §1 표기 규칙 준수. `AUTH_CONFIG_NOT_FOUND` 와의 구분 등 §5.3 "top-level
  이미 도메인 특화 코드" 판별 기준도 정확히 인용.
- **502 신설**: R-CC-23 이 이 저장소 최초의 `BadGatewayException` 사용을 도입하며
  `spec/5-system/2-api-convention.md §6`(HTTP 상태 코드 카탈로그, 실측: 355행에 `CHAT_CHANNEL_SETUP_FAILED`
  행 존재) 과 `spec/conventions/swagger.md §2-4`(실측: `502 외부 provider 호출 실패 |
  @ApiBadGatewayResponse` 행 존재) 양쪽에 카탈로그 갱신을 요구했고, 두 곳 모두 실제로 갱신돼
  있음을 직접 확인했다 — "도입은 카탈로그 신설이 완결해야 한다"는 자기 요구를 스스로 지켰다.
- **Secret ref URI**: `secret://triggers/{triggerId}/bot-token` · `inbound-signing` ·
  `bot-token.v2` 모두 `spec/conventions/secret-store.md §1` 의 `secret://<scope>/<resourceId>/<name>`
  스킴, kebab-case `name`, `.v2` grace 접미 규칙과 일치.
- **Redis 키**: `chat-channel:{triggerId}:{conversationKey}` 는 `spec/conventions/redis-keys.md §3`
  전역 인벤토리에 이미 등재된 §1 형태 규칙의 **명시적 예외**(용도 세그먼트 없음)와 정확히 일치 —
  신규 위반이 아니라 문서화된 기존 예외의 재사용.
  `cc:rl:*` / `cc:dedup:*` 축약 접두 사용도 같은 인벤토리에 사전 등재돼 있다.
- **Audit action**: `trigger.chat_channel_bot_token_rotated` 는 `spec/conventions/audit-actions.md §3`
  레지스트리에 등재된 과거분사(§2.1) 표기와 일치. §5.4.1 의 정정 문단(*"`chat-channel.rotate-bot-token`
  이라 적혀 있었다"* → resource dot-prefix·언더스코어·과거분사 위반을 스스로 지적하고 `trigger.*`
  로 정정)도 audit-actions.md §1 구조 규칙에 정확히 부합.
- **엔드포인트 명명**: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 은
  `spec/5-system/2-api-convention.md` 의 "RPC-style sub-channel action" 예외
  (`/api/{resource}/{id}/{channel}/{action}`) 표에 **이 엔드포인트 자체가 예시로 등재**돼
  있어 명명 규약과 완전히 정합.
- **DTO 명명**: `ChatChannelConfigDto` / `ChatChannelUiMappingDto` / `ChatChannelUpdateConfigDto`
  / `ChatChannelBotIdentityDto` 는 `spec/conventions/swagger.md §1-7` 의 "`Update` 접두는
  top-level 요청 바디에만" 규칙과 그 nested 변형 예외(`<Domain><Role>Dto`) 에 그대로
  부합한다 — 해당 절 자체가 이 chat-channel DTO 군을 실례로 들어 규칙 범위를 정의하고 있다.
- **wire 계층 구분**: CCH-MP-06 의 "`output.output.rendered`" 정정(취소선 처리된
  `~~output.rendered~~`)은 `spec/conventions/node-output.md` 상단의 "wire envelope 은
  `NodeHandlerOutput` 래퍼 전체를 싣는다" 정본 서술과 정확히 같은 결론이며, 같은 문서가
  열거하는 "wire 전용 (chat-channel 렌더러)" 8키 중 `payload`/`title`/`rendered`/`nodeType`
  legacy flat fallback 언급과도 정합.
- **frontmatter 스키마**: `status: partial` + `code:` glob 다수 + `pending_plans:` 3개 조합은
  `spec/conventions/spec-impl-evidence.md` §3 예시(“backend + 일부 frontend 구현 완료, 후속
  plan 남음” 패턴)와 일치하며, 참조된 `pending_plans` 3개 파일(`chat-channel-discord-gateway.md`
  · `chat-channel-slack-socket-mode.md` · `chat-channel-visual-ssr-png.md`) 모두 실존을 확인했다.
  `triggers/` 하위 glob 을 명시 경로 대신 좁은 glob 3개로 바꾼 근거(§7 인접 rationale)도
  spec-impl-evidence.md R-1(“넓은 트리 글롭으로 가드만 통과시키는 것은 아무것도 가리키지
  않는 것과 같다”)을 정확히 인용하며 실측(27개 vs 10개, 차집합 0)으로 뒷받침한다.
- **문서 구조**: `# Spec: Chat Channel` → `## Overview (제품 정의)`(내부 `### 1/2/3` 하위
  섹션) → 본문 `## 3~8`(번호가 Overview 내부 넘버링과 이어짐) → `## Rationale` 구조는
  같은 디렉토리의 다른 spec(`14-external-interaction-api.md` 등)과 동일한 패턴이라
  CLAUDE.md/SKILL.md 가 권장하는 Overview/본문/Rationale 3섹션 관례를 그대로 따른다.

## 요약

`spec/5-system/15-chat-channel.md` 는 명명(에러 코드/Redis 키/Secret ref/Audit action/엔드포인트/DTO)·
출력 포맷(HTTP 상태·에러 envelope·wire 계층 구분)·문서 구조·API 문서(swagger 데코레이터·DTO 패턴)
전 축에서 `spec/conventions/**` 의 정식 규약과 매우 높은 수준으로 정합한다. 특히 최근 커밋들
(R-CC-23 setupChannel 실패 분류, T1/T2 code glob 정리)은 도입과 동시에 관련 카탈로그
(`2-api-convention.md §6`, `swagger.md §2-4`, `secret-store.md`, `spec-impl-evidence.md`)를
스스로 인용·검증하며 갱신한 흔적이 실측으로 확인된다. CRITICAL/WARNING 급 위반은 발견하지
못했다. 유일한 지적은 `BOT_TOKEN_INVALID` 가 형제 에러 코드들의 `CHAT_CHANNEL_` prefix 관례에서
벗어난 INFO 수준의 표기 비대칭이며, 이는 규약이 "권장"으로 명시한 항목이라 즉시 수정을 요하지
않는다. 이번 `--impl-prep` 검토가 대상으로 하는 developer 작업(`chat-channel-input-rules.ts`
구조 정리, `spec_impact: none`)은 spec 텍스트를 건드리지 않으므로, 본 검토 결과는 착수를
막을 요인이 없음을 뒷받침한다.

## 위험도

NONE
