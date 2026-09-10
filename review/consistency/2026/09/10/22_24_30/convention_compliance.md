# 정식 규약 준수 검토 — spec-draft-telegram-signing-carveout

대상: `plan/in-progress/spec-draft-telegram-signing-carveout.md` (검토 모드: `--spec`)

## 검토 방법

`spec/conventions/**` 중 프롬프트에 본문이 포함되지 않은 274개 파일은 "본문 없음 = 무관"으로
간주하지 않고, target 이 직접 인용한 파일(`secret-store.md`, `chat-channel-adapter.md`,
`swagger.md`, `audit-actions.md`, `review-citations.md`, `error-codes.md`)을 저장소에서 직접
`Read`/`grep` 하여 target 의 주장을 실측 대조했다. 아울러 target 이 참조하는 실제 spec 문서
(`spec/5-system/15-chat-channel.md`, `spec/2-navigation/2-trigger-list.md`,
`spec/data-flow/14-chat-channel.md`)의 현재 줄 내용도 직접 열어 target 의 인용(A1~A14·B1~B2)이
실측과 맞는지 대조했다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 검증을 통해 확인된 사항이다 (INFO — 소극적 확인).

- **[INFO]** 컨벤션 미변경 판단이 실측과 일치함
  - target 위치: "이미 그어져 있던 경계" 절 (컨벤션 대조 주장)
  - 관련 규약: `spec/conventions/secret-store.md §5.5`, `spec/conventions/chat-channel-adapter.md
    §2.3`/`§2.4`
  - 상세: target 은 *"conventions/secret-store.md §5.5·conventions/chat-channel-adapter.md
    §2.3/§2.4 가 이미 server-issued(telegram) vs provider-issued(slack/discord) 두 축을 같은
    어휘로 가른다"* 고 주장한다. 두 파일을 직접 열어 대조한 결과 정확하다 — `secret-store.md
    §5.5`는 "(a) server-issued — Telegram 등 adapter 의 setupChannel 이 randomBytes 로 발급"
    /"(b) provider-issued — Slack signing secret / Discord public key, 사용자 manual 입력" 으로
    이미 명시적으로 갈라 놓았고, `chat-channel-adapter.md §2.3` 의 `inboundSigningRef` JSDoc 표와
    `§2.4` 의 `SetupResult.issuedInboundSigning` 필드 설명("Slack / Discord 처럼 사용자가 manual
    입력하는 provider 는 본 필드를 채우지 않는다")도 동일 구분을 이미 담고 있다. 이번
    carve-out 이 `spec/conventions/**` 자체의 개정을 요구하지 않는다는 target 의 결론은 실측과
    맞는다.
  - 제안: 없음 (수정 불필요 — 확인용 기록).

- **[INFO]** 미러 문서(B1·B2) 인용의 정확성 확인
  - target 위치: "변경안 — 다른 파일" B1(`spec/2-navigation/2-trigger-list.md:176`),
    B2(`spec/data-flow/14-chat-channel.md:151`)
  - 관련 규약: 없음 (사실관계 확인)
  - 상세: 두 파일을 직접 열어 대조한 결과, B1 의 *"bot token·inbound signing 값은 요청 전후로
    동일하고"*(현재 `2-trigger-list.md` PATCH 설명 문단에 그대로 존재)와 B2 의 *"`secret_store`
    무변경"*(현재 `data-flow/14-chat-channel.md` §1.3 표의 "`chatChannel` 이 실린 PATCH" 행 sink
    칸에 그대로 존재)이 정확히 일치한다. telegram 을 가르지 않는 provider-무관 blanket 서술이라는
    target 의 진단이 맞다.
  - 제안: 없음.

- **[INFO]** DTO 명명 이연(deferral) 결정이 기존 명명 선례와 일치
  - target 위치: "이 턴에 하지 않는 것" — `ChatChannelPatchConfigDto` → 구현 턴에서
    `ChatChannelUpdateConfigDto`
  - 관련 규약: `spec/conventions/swagger.md` §1 (DTO 패턴) — "Patch" 접두 금지 규칙 자체는
    **없음**(전수 grep 확인, `PatchDto` 패턴 매치 0건).
  - 상세: target 은 3R 검토가 "swagger.md 에 Patch 금지 규칙이 없어 규약 위반이 아니라 신설
    안건을 올바르게 별 트래커로 넘긴 것"이라 확인했다고 적는다. `swagger.md` 전문을 grep 한
    결과 확인은 정확하다(명시적 naming 규칙 없음). 다만 이번 검토에서 한 걸음 더 나가
    `codebase/backend/src/modules/triggers/dto/` 를 직접 열어보면, 같은 모듈의 기존 PATCH DTO 가
    이미 `UpdateTriggerDto`(`update-trigger.dto.ts`) 로 명명되어 있어 **"Update" 가 이 모듈의
    실질 선례**임이 확인된다(`PatchDto` 패턴은 저장소 전체에 0건). target 이 구현 턴에서
    채택하기로 이미 못박은 이름(`ChatChannelUpdateConfigDto`)이 정확히 이 선례와 일치하므로,
    명시 규약 부재 + 실질 선례 일치라는 두 사실이 target 의 결정을 이중으로 뒷받침한다.
  - 제안: 없음 — 구현 턴에서 실제로 `ChatChannelUpdateConfigDto` 로 명명되는지만 후속 확인.

- **[INFO]** review-citations.md 상 bare `hh_mm_ss` 인용은 이 문서에 적용되지 않음
  - target 위치: 문서 전반의 "1R"/"2R"/"3R"/"`21_37_56`"/"`22_04_23`" 등 bare 시각 인용
  - 관련 규약: `spec/conventions/review-citations.md` §2("bare `hh_mm_ss` 금지")·§3(적용 범위 표)
  - 상세: §3 적용 범위 표는 `plan/**` 문서를 **명시적으로 "대상 아님"**으로 분류한다("인용하는
    라운드와 같은 세션에서 쓰이고, 문서 자체가 그 맥락을 담는다"). target 은 `plan/in-progress/`
    아래 파일이므로 이 규약의 날짜-포함 요구가 걸리지 않는다 — 위반 아님.
  - 제안: 없음. (단, A1~A14/B1~B2 변경안이 실제로 `spec/**` 본문에 반영될 때 그 산문 자체에
    bare `hh_mm_ss` 인용을 새로 심지 않도록 주의 — 현재 변경안 문구에는 그런 인용이 없음을
    확인했다.)

- **[INFO]** ID 명명 스킴(R-CC-N / CCH-XX-NN) 준수
  - target 위치: A1~A14 전반 (기존 `R-CC-10`/`R-CC-21`/`CCH-AD-02` 등 인용, 신규 ID 미도입)
  - 관련 규약: `spec/5-system/15-chat-channel.md` "Rationale ID 컨벤션" 절(자체 문서 내
    명명 규칙 — `R-CC-N` prefix, `CC`=Chat Channel)
  - 상세: target 은 새 Rationale ID 를 신설하지 않고 기존 `R-CC-10`/`R-CC-21` 본문을 좁히는
    식으로만 편집한다. 기존 ID 스킴과 충돌 없음.
  - 제안: 없음.

- **[INFO]** 감사 액션(audit-actions.md) 관련 사실 주장 확인
  - target 위치: D-B "(c) audit mixing — 전용 audit action 이 없다 — 우회할 대상 자체가 없다"
  - 관련 규약: `spec/conventions/audit-actions.md` §3 도메인별 분류 레지스트리
  - 상세: 레지스트리를 직접 열람한 결과 `trigger` 리소스에는
    `notification_secret_rotated`/`chat_channel_bot_token_rotated`/`interaction_token_revoked`
    세 액션만 있고 inbound-signing(서명 자료) 회전 전용 액션은 없다. target 의 사실 주장과
    일치한다.
  - 제안: 없음.

## 요약

target 은 실제 규약 개정을 요구하지 않는 **spec 산문 정정 전용** 트래커이며, `spec/conventions/**`
의 명명·출력 포맷·문서 구조·API 문서·금지 항목 다섯 관점 어디에서도 규약 위반을 도입하지
않는다. 오히려 target 자신이 3회의 선행 라운드에서 "컨벤션 문서를 고칠 필요가 없다"·"DTO
명명 규칙 신설은 규약 위반이 아니라 올바른 트래커 분리"라고 내린 판단을, 본 검토가
`secret-store.md §5.5`·`chat-channel-adapter.md §2.3/§2.4`·`swagger.md`·`audit-actions.md`·
`review-citations.md` 원문을 직접 열어 독립적으로 재확인했고 모두 실측과 일치했다. 문서 내
인용(A1~A14·B1~B2)이 가리키는 실제 spec 줄 내용도 대조 결과 정확했다. bare 시각 인용(`1R`/`2R`
등)은 `review-citations.md` §3 이 `plan/**` 을 명시적으로 적용 대상에서 제외하므로 위반이
아니다. 결론적으로 규약 준수 관점에서 이 target 을 막을 사유가 없다.

## 위험도

NONE
