# 정식 규약 준수 검토 — `spec/5-system/` (chat-channel 중심, --impl-prep)

## 검토 범위와 방법

`_prompts/convention_compliance.md` 번들은 `spec/conventions/**` 대부분을 "본문 생략됨 — 컨텍스트
예산 초과"로 절단하고 있어, 번들만으로는 규약 원문을 대조할 수 없었다. 대신 워크트리의 실제
`spec/5-system/*.md` · `spec/conventions/*.md` 파일을 직접 읽어 대조했다. target 은 이번 작업
(`impl-chat-channel-binder`)과 가장 밀접한 `spec/5-system/15-chat-channel.md`(844줄 전문)를
중심으로, 교차 인용되는 `spec/conventions/{audit-actions,error-codes,secret-store,redis-keys,
chat-channel-adapter,egress-masking,swagger,review-citations,spec-impl-evidence,
interaction-type-registry,conversation-thread,node-output,migrations}.md` 및
`spec/5-system/{2-api-convention,3-error-handling}.md` 원문을 확인했다.

## 발견사항

- **[WARNING] 신규 `CHAT_CHANNEL_*` / `*BOT_TOKEN*` 최상위 에러 코드가 카탈로그에 미등재**
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4 "Bot Token Rotation API 응답 계약"
    실패 응답 표(400/502 행) 및 §5.4.1.2
  - 위반 규약: `spec/conventions/error-codes.md` §Overview("카탈로그·분류·트리거: SoT 는
    `5-system/3-error-handling.md §1`")가 위임한 카탈로그 규율 + 그 SoT 문서인
    `spec/5-system/2-api-convention.md` §5.3 "도메인 세부 사유를 어디에 싣는가"의 명문:
    *"어느 쪽을 택하든 [에러 처리 §1] 카탈로그에 등재한다. 등재되지 않은 코드는 소비자가
    존재를 알 방법이 없다."*
  - 상세: `POST /api/triggers/:id/chat-channel/rotate-bot-token`의 실패 응답 표(15-chat-channel.md
    §5.4)가 top-level 코드를 대체하는(즉 §5.3의 "top-level `code` 교체" 갈래) 신규 코드
    6종 — `INVALID_BOT_TOKEN` · `BOT_TOKEN_INVALID` · `CHAT_CHANNEL_NOT_CONFIGURED` ·
    `CHAT_CHANNEL_PROVIDER_UNKNOWN` · `CHAT_CHANNEL_ENDPOINT_REQUIRED` ·
    `CHAT_CHANNEL_SETUP_FAILED` — 를 정의한다. `spec/5-system/3-error-handling.md` 전체를
    `grep -n "CHAT_CHANNEL\|BOT_TOKEN"` 했을 때 **0건**으로, 이 6종은 §1 카탈로그 어디에도
    등재돼 있지 않다. 같은 트리거 도메인의 인접 사례들 — §1.9(워크스페이스 멤버 직접 추가),
    §1.10(트리거 endpointPath 충돌), §1.11(트리거 AuthConfig binding) — 은 전부 "도메인 spec
    참조" 전용 하위 절을 두어 카탈로그 가시성을 확보하는데, chat-channel 의 rotate-bot-token
    표면만 이 패턴에서 빠져 있다. §5.4.1.2 는 `INVALID_FIELD`(details 코드, 기존 제네릭 재사용)에
    대해서만 "신규 등재는 필요 없다"고 명시적으로 다뤄, 저자가 등재 의무 자체는 인지하고 있음을
    보여준다 — 그런데 그 판단이 "이미 있는 코드 재사용" 케이스에만 적용됐고, 이번에 실제로
    신설되는 6종 최상위 코드에는 적용되지 않았다.
  - 제안: `3-error-handling.md`에 §1.9~§1.11과 동형인 신규 하위 절(예: §1.12 "Chat Channel Bot
    Token Rotation 에러 코드 (도메인 spec 참조)")을 추가해 6종을 등재하고
    `15-chat-channel.md §5.4`를 도메인 SoT로 cross-link한다. 이 규약 자체를 완화할 이유는
    보이지 않는다 — §5.3 원칙이 신설한 지 얼마 안 된 규칙(2026-09-11 갱신분과 같은 절)이라
    아직 소급 적용 관성이 없을 뿐, 문서가 스스로 요구하는 조건을 그 문서 자신의 신규 표면이
    충족하지 못하는 상태다.

- **[INFO] `INVALID_BOT_TOKEN` ↔ `BOT_TOKEN_INVALID` — 동일 엔드포인트 안의 근접 명명**
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표 (400 행 2개)
  - 위반 규약: `spec/conventions/error-codes.md` §1 "의미 기반 명명"(이름만으로 분기 의미가
    드러나야 한다) 및 같은 근접 명명 문제를 이미 다룬 선례 `spec/5-system/3-error-handling.md`
    §1.2.1의 "근접 명명 주의" 콜아웃(`PASSWORD_INVALID` ↔ 舊 `INVALID_PASSWORD` — 결국
    `error-codes.md §5`에서 후자를 은퇴시켜 해소)
  - 상세: 같은 `rotate-bot-token` 엔드포인트의 400 응답 표 안에 `INVALID_BOT_TOKEN`(컨트롤러
    입력 검증 — `newBotToken` 누락/비-string)과 `BOT_TOKEN_INVALID`(신규 토큰의 `setupChannel`
    401/403 거부)가 토큰 순서만 바뀐 채 나란히 등장한다. 의미는 서로 다르지만("형식이 틀렸다"
    vs "provider 가 거부했다"), 문자열이 한 단어 순서 차이뿐이라 로그·문서·grep·오탈자 상황에서
    구분이 쉽게 무너진다. 이 저장소는 정확히 이 형태의 위험을 `PASSWORD_INVALID`/
    `INVALID_PASSWORD` 사례에서 "근접 명명 주의" 문구로 명시적으로 다룬 선례가 있는데,
    이번 신설 쌍에는 그런 disambiguation 각주가 없다.
  - 제안: 규약 위반은 아니나(두 코드 다 의미가 다르고 `UPPER_SNAKE_CASE`·도메인 성격도
    맞음), §5.4 표 아래에 두 코드를 구분하는 한 줄 각주(예: "`INVALID_BOT_TOKEN`은 요청 형식,
    `BOT_TOKEN_INVALID`는 provider 거부 — 근접 명명 주의")를 추가해 향후 rename 압력이나
    혼동을 미리 차단할 것을 권고. 위 CRITICAL/WARNING 항목과 달리 이것은 예방적 권고이며,
    현재 상태로 두어도 규약을 직접 어기는 것은 아니다.

## 검증해 통과로 확인한 항목 (참고용 — 정합 사례)

아래는 위반이 아니라, 광범위한 교차 대조 과정에서 규약과 정확히 일치함을 확인한 지점들이다
(다음 검토자가 같은 항목을 중복 재검증하지 않도록 기록):

- 감사 액션 명명 — `trigger.chat_channel_bot_token_rotated`(과거분사, 언더스코어)는
  `spec/conventions/audit-actions.md` §3 레지스트리에 정확히 등재돼 있고, `15-chat-channel.md`
  §5.4.1의 2026-08-11 정정 문단이 그 수정 이력을 스스로 밝히고 있다.
- `WORKSPACE_ID_REQUIRED`(§R-CC-18)와 `details[].code`↔`field` 동시 등재 규칙(§5.4.1/§5.4.1.2,
  `#1317` 배선)은 각각 `error-codes.md §5` 및 `2-api-convention.md §5.3`(2026-09-11 갱신분)의
  원문과 정확히 일치한다.
- `secret://triggers/{id}/{bot-token,bot-token.v2,inbound-signing}` ref 형식·§5.5(b) 인용은
  `spec/conventions/secret-store.md` §1/§5.5 원문과 1:1 대응한다.
- `chat-channel:{triggerId}:{conversationKey}` · `cc:rl:*` · `cc:dedup:*` Redis 키는
  `spec/conventions/redis-keys.md` §3 인벤토리에 이미 등재돼 있고, 그 문서의 "머리 2세그먼트
  형태 예외" 콜아웃까지 정합한다.
- `ChatChannelConfig`/`SetupResult`/`renderNode` 매핑 등 `spec/conventions/chat-channel-adapter.md`
  와의 교차 인용(§2.3·§2.4·§3·§3.1·R-CCA-5/7/8)은 필드명·타입·앵커까지 양방향으로 정확히
  맞물린다.
- `output.output.rendered`(NodeHandlerOutput 래퍼) 정정 서술은 `spec/conventions/node-output.md`
  Principle 0/§4.3의 원문과 일치한다.
- `execution.node.completed` 값-패턴 마스킹 캐비엇은 `spec/conventions/egress-masking.md`의
  `allowlistFanoutNodeOutput`/EIA §R17 범위 서술과 모순되지 않는다.
- `spec/**` 문서에 대한 리뷰 세션 인용(`review/consistency/2026/09/10/22_04_23` 등)은
  `spec/conventions/review-citations.md` §2가 요구하는 "전체 경로(권장)" 형식을 따른다.
- frontmatter(`status: partial` + `pending_plans:` 3건)는 `spec/conventions/spec-impl-evidence.md`
  §2/§3 스키마를 충족하고, `pending_plans:`·`code:`의 모든 경로가 실제로 존재함을 확인했다
  (`plan/in-progress/chat-channel-*.md` 3건 전부 존재, `code:` 13개 경로 전부 존재).

## 요약

`spec/5-system/15-chat-channel.md`는 `spec/conventions/**`의 관련 규약(secret-store, redis-keys,
audit-actions, chat-channel-adapter, node-output, egress-masking, swagger, review-citations,
spec-impl-evidence)과 이례적으로 촘촘하게 교차 검증되어 있으며, 과거 세션에서 발견된 정합성
갭(감사 액션 명명, WORKSPACE_ID_REQUIRED 코드/상태, details.field/code 배선 등)을 스스로
정정한 이력까지 문서에 남기고 있어 규약 준수 규율 자체는 높은 수준이다. 다만 이번 라운드에서
신설된 `POST /api/triggers/:id/chat-channel/rotate-bot-token`의 실패 응답 코드 6종이
`3-error-handling.md §1` 카탈로그에 등재되지 않아, 그 문서 자신이 요구하는 "등재 의무"
(`2-api-convention.md §5.3`)를 충족하지 못하는 상태다. 이는 구현 착수 전에 한 줄 추가로
해소 가능한 수준의 갭이며, 그 외에는 명명·출력 포맷·문서 구조 규약을 직접 위반하는 지점을
찾지 못했다.

## 위험도

LOW
