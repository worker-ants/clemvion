# Cross-Spec 일관성 검토 — spec-draft-chat-channel-drift-3

## 사전 조치 — 프롬프트 예산 절단 보정

번들의 `<!-- @bundle-file -->` 절단 표시로 `spec/5-system/15-chat-channel.md`(83,915자)·
`spec/4-nodes/7-trigger/providers/{telegram,slack}.md`·`spec/5-system/2-api-convention.md`·
`spec/conventions/{secret-store,chat-channel-adapter}.md` 본문이 **전부 생략**돼 있었다
(`review/consistency/2026/09/11/07_22_40/_prompts/cross_spec.md:1017-1046`). 이 여섯 파일이
바로 target 의 `spec_impact` 대상이라 실물 없이는 cross-spec 판정이 불가능하므로, 현재 worktree
(`spec-chat-channel-drift-3-4d19bc`, `spec/` 미변경 상태)에서 해당 파일들을 직접 열어 대조했다.

## 검증한 사실관계 (cross-spec 판정의 전제)

- `grep -rnE "(SecretResolver|secrets|this\.secrets)\.store\b" spec/` → **정확히 10건**, 전부
  target 의 `spec_impact` 6개 파일 안에 있다 (`slack.md:278`·`telegram.md:58,219`·
  `15-chat-channel.md:200,201,373,390`·`chat-channel-adapter.md:354,359`·
  `secret-store.md:301`). target 이 주장하는 "10곳, 전량 열거 완료"는 **spec/ 전역 기준으로
  참**이다 — 다른 영역에 누락된 11번째 자리는 없다.
- `codebase/backend/src/modules/triggers/triggers.service.ts:945-972`
  (`normalizeNotificationSecretRef`) 는 실제로 `this.secrets.rotate(...)` 를 호출한다 —
  `secret-store.md:301` 예시 코드의 `store()` 는 이 구현과 어긋난다. 같은 파일 `§2.1` 호출
  규약 표(142-149행)는 이미 "Trigger 생성 (**notification** / chatChannel 설정 포함) →
  `rotate()` 권장" 이라 적고 있어, `secret-store.md` 는 **자기 문서 §2.1 vs §5.1 예시 코드가
  이미 모순** 상태였다 — target 의 C2 판단(자기-문서 내 모순)은 사실이다.
- `codebase/backend/src/modules/triggers/triggers.service.ts:722-745`
  (`assertChatChannelAlreadySetUp`) 는 target 이 D-2 에서 서술한 두 분기(`chatChannel` 미설정
  트리거에 사후 부착 → `details:{field:'chatChannel'}`, `provider` 전환 시도 →
  `details:{field:'provider'}`, 둘 다 `code` 필드 없음)와 정확히 일치한다.
- `spec/5-system/15-chat-channel.md:591` ("같은 trigger 가 provider 를 바꾸는 경우는 미지원
  (재생성으로 처리)")·`2-trigger-list.md` R-12 (기존, "변경하려면 트리거 삭제·재생성") 는 이미
  같은 결론을 별도로 서술하고 있어 D-2 의 provider 차단 방향과 **기존 두 자리 모두와 정합**한다.
- `spec/5-system/2-api-convention.md §5.3` ("`details` 의 형태는 두 가지이고 둘 다 유효하다" —
  배열/객체) 는 target D-1 이 취하는 "값에 따라 형태가 갈린다"는 결론과 **상위 규약 수준에서
  이미 허용**돼 있다 — 이 자체는 규약 위반이 아니다(다만 아래 발견사항 참조).

## 발견사항

- **[INFO]** `data-flow/14-chat-channel.md` 의 PATCH 데이터흐름 행이 새 두 차단 분기를 반영하지 않음
  - target 위치: 변경안 D-2 / A3 (`15-chat-channel.md` §5.4.1 표에 신규 2행 추가)
  - 충돌 대상: `spec/data-flow/14-chat-channel.md:151` (`**\`chatChannel\` 이 실린 PATCH**` 행 —
    "`setupChannel()` 재호출로 provider 등록만 갱신" 이라고만 서술)
  - 상세: data-flow 문서는 성공 경로의 DB/사이드이펙트만 추적하는 것이 문서 scope
    (`data-flow/0-overview.md` Overview — "이 API 가 들어오면 어떤 table 의 어떤 column 이
    갱신되는가")이므로, 요청을 조기 거부하는 두 신규 400 분기(부작용 없음)를 이 표에 반드시
    넣어야 하는 것은 아니다. 다만 이 행이 "`chatChannel` 이 실린 PATCH" 를 마치 항상
    `setupChannel()` 까지 도달하는 것처럼 읽히게 하므로, 두 신규 사전조건(§5.4.1 신규 2행)에
    대한 각주 cross-link 한 줄을 추가하면 독자가 "이 표는 통과한 요청만 다룬다"를 오독하지
    않는다.
  - 제안: 이번 턴 필수 아님. `plan/in-progress/spec-draft-nullable-notation-followups.md` 류
    후속 트래커에 "data-flow/14-chat-channel.md PATCH 행에 §5.4.1 신규 2 분기 각주" 로 저비용
    등재 권장.

- **[INFO]** 신규 두 400 분기의 정착 위치가 표 제목("Bot Token 변경 single-path 정책")과
  주제가 어긋난다
  - target 위치: 변경안 A3 — `15-chat-channel.md` **§5.4.1** (표 제목: "Bot Token 변경
    single-path 정책") 표에 `chatChannel` 사후 부착 차단·`provider` 전환 차단 신규 2행 추가
  - 충돌 대상: 없음 (신규 추가 위치 자체의 scope 적합성 문제 — 다른 spec 자리와 내용이
    모순되지는 않는다)
  - 상세: 두 신규 분기는 "bot token 을 어떻게 바꾸는가"가 아니라 "`chatChannel` 자체를
    붙이거나 provider 를 바꿀 수 있는가"에 대한 규칙이다. 코드 근거
    (`assertChatChannelAlreadySetUp`, triggers.service.ts:715-745)도 `assertPatchCarriesNoSecrets`
    (bot token/inbound signing 값 차단, §5.4.1 이 다루는 대상)와는 별개 함수·별개 관심사다.
    같은 표 안에 섞으면 "provider 변경 정책이 어디 있는지" 찾는 다음 사람이 §5.4.1(bot
    token)이 아니라 §4.1(`Trigger.config.chatChannel` 필드 정의) 이나 새 §5.4.3 을 먼저
    찾다가 "정책이 없다"고 오판해 **중복 정의**를 만들 위험이 있다(레이어/책임 분할 관점의
    잠재 충돌).
  - 제안: 신규 2행을 §5.4.1 에 넣더라도 표 제목 아래에 "본 표는 bot token 축 외에 `chatChannel`
    필드 자체의 최초 설정·provider 불변성 정책도 함께 다룬다" 한 줄을 명시하거나, 별도 소제목
    (예: `#### chatChannel 필드·provider 불변성`)으로 시각적으로 분리해 검색 실패를 방지한다.
    (naming_collision/plan_coherence checker 의 소관과 겹칠 수 있으므로 낮은 우선순위.)

- **[INFO]** `error-codes.md §4.2`/`error-handling.md §1.3` 카탈로그 미등재는 기존 선례와 대칭
  - target 위치: 결정 D-2 하단 — "top-level code 는 기존 `VALIDATION_ERROR` 재사용이라 §1
    카탈로그 신규 등재는 불필요"
  - 충돌 대상: `spec/5-system/2-api-convention.md` "도메인 세부 사유를 어디에 싣는가" 절 —
    "어느 쪽을 택하든 [에러 처리 §1] 카탈로그에 등재한다"
  - 상세: 문면만 보면 이 규약은 예외 없이 카탈로그 등재를 요구하는 것처럼 읽히지만, 실측
    (`assertChatChannelAlreadySetUp`/`assertPatchCarriesNoSecrets`)은 `details.code` 자체를
    발행하지 않는다(§5.3 이 신규 등재를 요구하는 대상은 `details[].code` **값**이다). 기존에
    이미 같은 패턴인 `botTokenRef`/`inboundSigningPlaintext`/`botToken` 의 `details.field`
    값들도 `error-handling.md §1`에 등재돼 있지 않다 — 즉 이번 결정은 **새 비대칭을 만드는
    것이 아니라 기존 비대칭을 그대로 잇는 것**이다. Critical/Warning 판정 대상은 아니나,
    §1.7/§1.9/§1.10 처럼 "도메인 spec 참조" 스텁 subsection 을 만드는 기존 관행과 chatChannel
    영역만 계속 예외로 남는 점은 언젠가 한 번에 정리할 후속감이다.
  - 제안: 이번 턴 조치 불필요(트래커에 이미 "후속 신규 등재"로 별건 등재된 `details[].code`
    부재 항목과 함께 묶어 처리 권장).

## 요약

target 문서가 건드리는 6개 spec 파일(`15-chat-channel.md`·`2-trigger-list.md`·
`conventions/secret-store.md`·`conventions/chat-channel-adapter.md`·`providers/telegram.md`·
`providers/slack.md`)을 프롬프트 번들 절단으로 인해 실물 파일에서 직접 재확인한 결과, target 이
제시하는 세 실측(`details.field` 값-의존 두 갈래, 신규 400 두 분기, `store()`→`rotate()` 10곳)은
모두 코드·spec 실물과 정확히 일치했고, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 축에서
CRITICAL 급 모순은 발견되지 않았다. `providers/{slack,discord}.md` 의 생성 시점 flat
`details.field`(§6 정규식 검증)를 "손대지 않는다"고 판단한 것도 실측(서비스 레이어 검증)과
부합해 옳다. `1-data-model.md`·`data-flow/14-chat-channel.md`·`error-codes.md`·
`error-handling.md` 등 spec_impact 밖 인접 영역도 함께 대조했으나 새로 깨지는 계약은 없고,
data-flow 문서의 PATCH 성공-경로 서술이 신규 차단 분기를 언급하지 않는 점과 신규 2행이
"Bot Token" 표 제목 아래 놓이는 scope 부정합만 INFO 수준으로 남는다. 두 건 모두 즉시 차단 사유는
아니며 후속 저비용 정리로 충분하다.

## 위험도

LOW
