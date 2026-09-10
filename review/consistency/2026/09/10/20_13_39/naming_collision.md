# 신규 식별자 충돌 검토 — spec-draft-chat-channel-patch-token.md

## 발견사항

- **[CRITICAL]** `R-CC-17` 신설 제안이 **같은 문서에 이미 존재하는 `R-CC-17` 과 정면 충돌**
  - target 신규 식별자: `R-CC-17` — target `## 변경안 C.`: `"15-chat-channel.md 신설 Rationale R-CC-17 — 우회의 형태와 처방의 함정"` (담을 내용: 우회 형태·처방의 함정·기각한 대안)
  - 기존 사용처: `spec/5-system/15-chat-channel.md:689` `### R-CC-17. \`render_form\` v1 임시 텍스트 fallback + presentation renderer shape 처리` — 완전히 다른 주제(ai-agent `render_form` presentation 의 v1 fallback 처리)로 이미 존재. 같은 파일 `:683`, `:704` 에서 자기 참조로 인용되며, 외부 파일 `spec/conventions/chat-channel-adapter.md:382`(`[R-CC-17]` 링크)에서도 cross-file 로 인용되고 있어 **활발히 참조 중인 ID**다.
  - 상세: `15-chat-channel.md:606` 은 이 문서의 신규 Rationale 이 `R-CC-N` prefix 로 **일련번호 유일성**을 지키도록 명시적으로 규약화한 절이다(정확한 문구: *"검토자가 외부 참조와 혼동할 위험이 있어 prefix 채택"*). 현재 이 파일의 R-CC 계열은 `R-CC-10, 11, 12, 13, 15, 16, 17, 18, 19, 20` 이 이미 부여돼 있다(`R-CC-14` 는 결번, 재사용 대상 아님 — 과거 삭제/미부여로 추정, 이번 검토 범위 밖). target 이 그대로 반영되면 한 문서 안에 **동일 ID 로 두 개의 서로 무관한 결정**(render_form v1 fallback ↔ PATCH bot-token 우회 처방)이 공존하게 되어, 앵커(`#r-cc-17-...`)는 텍스트가 달라 기술적으로는 갈라지더라도 **"R-CC-17" 이라는 사람이 읽는 식별자 자체가 무엇을 가리키는지 모호**해진다. 특히 이미 cross-file 로 인용된 ID 라 기존 인용(`chat-channel-adapter.md:382`)이 새 항목과 혼동될 위험이 실질적이다. 이는 등급 기준의 "동일 식별자가 다른 의미로 이미 사용 중" 에 정확히 해당하는 CRITICAL 이다.
  - 제안: target 의 신설 Rationale ID 를 **`R-CC-21`**(현재 마지막 `R-CC-20` 다음 일련번호, 결번 `R-CC-14` 재사용은 추가 혼동을 낳으므로 피할 것)로 변경. `plan/in-progress/spec-sync-chat-channel-gaps.md` 등 같은 파일에 걸린 다른 in-progress plan 을 확인한 결과 `R-CC-21` 을 선점한 다른 항목은 없다(2026-09-10 기준).

- **[WARNING]** `details.field='chatChannel.botToken'` 이 형제 `botTokenRef`/`inboundSigningPlaintext` 와 **다른 명명 형태**를 가진 채 같은 표·같은 문맥에 나란히 등장
  - target 신규 식별자: `details.field='chatChannel.botToken'` (target `변경안 A` 표 1행 — `config.chatChannel.botTokenRef`(ref) 와 `botToken`(plaintext) 둘 다 400 을 받는 **같은 표 셀**에서, 전자는 `details.field='botTokenRef'`, 후자는 `details.field='chatChannel.botToken'` 로 병기)
  - 기존 사용처: `spec/5-system/15-chat-channel.md:376`(`details.field='botTokenRef'`, prefix 없는 flat 형태), `:390`(`details.field='inboundSigningPlaintext'`, 동일하게 flat), `spec/2-navigation/2-trigger-list.md:120,176`(동일). 전체 spec 에서 실제 사용 중인 `details.field` 값은 `botTokenRef` / `endpoint_path` / `inboundSigningPlaintext` / `type` 뿐이며 전부 **flat(단일 토큰, 객체 경로 prefix 없음)** 형태다.
  - 상세: 문자열 자체의 충돌(동일 값이 다른 의미로 이미 쓰이는 경우)은 없다 — `chatChannel.botToken` 은 `details.field` 값으로는 신규다. 그러나 target 이 이미 스스로 짚었듯("형제 세 필드가 규약에서 이탈해 있다") **개념적으로 같은 자원(봇 토큰 — ref 형태 vs plaintext 형태)의 두 표현**이 하나는 flat(`botTokenRef`), 하나는 nested-with-prefix(`chatChannel.botToken`) 로 **서로 다른 형태**를 갖게 된다. 두 값이 **같은 표의 같은 행, 같은 PATCH 엔드포인트의 같은 검증 실패 문맥**에 나란히 등장하므로, `details.field` 를 파싱해 필드별 UI 메시지를 분기하는 클라이언트 입장에서는 "chatChannel 객체 하위 필드는 flat 인가 nested 인가" 를 필드마다 다르게 처리해야 하는 비일관 계약이 된다. (target 이 이 비일관성의 원인 — 기존 것은 놔두고 신규만 규약대로 감 — 을 스스로 설명하고 있어 "인지 못한 충돌" 은 아니지만, 검토 관점 상 "혼동 가능"에 해당해 WARNING 으로 기록한다.)
  - 제안: 두 가지 중 하나를 문서에 명시적으로 덧붙이는 것을 권한다 — (1) 이 표 행에 각주로 "형태 비일관은 알려진 규약 이탈이며 형제 정정은 별 후속(§Rationale 참조)" 임을 한 번 더 표 옆에도 명시하거나, (2) `details.field` 가 필드마다 다른 depth 를 가질 수 있음을 `3-error-handling.md` 의 nested-path 규정 옆에 "필드 마다 실제 방출 depth 는 검증 계층(class-validator DTO vs 서비스 가드 literal throw)에 따라 다를 수 있다" 는 일반 주석으로 못박아, 이후 이런 비일관이 재발할 때마다 "왜 다른가" 를 매번 재설명하지 않게 한다. (신규 값 자체를 바꾸라는 요구는 아님 — target 의 D-1 판단·근거는 유효.)

- **[INFO]** `VALIDATION_ERROR` 재사용은 이 문서의 기존 코드 명명 관례와 **일치** — 문제 없음, 근거만 보강 제안
  - target 신규 식별자: 없음 (기존 `VALIDATION_ERROR` 재사용, 신규 에러 코드 미신설)
  - 기존 사용처: 동일 문서 `:360~364` 에 `CHAT_CHANNEL_NOT_CONFIGURED` / `CHAT_CHANNEL_PROVIDER_UNKNOWN` / `CHAT_CHANNEL_ENDPOINT_REQUIRED` / `CHAT_CHANNEL_SETUP_FAILED` / `BOT_TOKEN_INVALID` 등 `CHAT_CHANNEL_*`·도메인 특정 코드가 이미 존재
  - 상세: 확인 결과 이 문서는 두 계층을 이미 분리해 쓰고 있다 — ① `POST /rotate-bot-token` 처럼 **엔드포인트의 업무 로직 실패**(provider 미등록, setup 실패 등)는 `CHAT_CHANNEL_*` 전용 코드, ② `PATCH /api/triggers/:id` 의 **DTO whitelist 위반**(허용 안 된 필드가 실렸다)은 전부 `VALIDATION_ERROR` + `details.field` 로 필드를 구분(형제 `botTokenRef`·`inboundSigningPlaintext` 가 선례). target 의 `botToken` PATCH 차단은 정확히 ②의 사례이므로 `VALIDATION_ERROR` 재사용은 신설 코드보다 오히려 기존 관례에 더 부합한다. 새 `CHAT_CHANNEL_*` 코드를 만들었다면 그것이 오히려 계층 혼선(②를 ①의 네임스페이스로 승격)이었을 것이다.
  - 제안: 조치 불필요. 다만 이 ①/② 계층 분리가 문서 어디에도 명문화돼 있지 않아 다음 사람이 "왜 여기만 VALIDATION_ERROR 인가" 를 또 물을 수 있다 — §5.4.1 정당화 문단(target 의 변경안 B)에 "DTO whitelist 위반은 `VALIDATION_ERROR`, 업무 로직 실패는 `CHAT_CHANNEL_*`" 한 줄을 얹으면 재질문을 막을 수 있다(선택 사항, 이번 턴 필수 아님).

## 요약

target 이 신규 도입하는 두 식별자 중 `R-CC-17` 은 **같은 문서 안에서 이미 다른 의미로 활발히 인용되고 있는 Rationale ID 와 정면 충돌**하는 CRITICAL 이다 — 이 문서 자신이 세운 "R-CC-N 은 검토자 혼동 방지를 위한 유일 식별자" 규약을 target 자신이 어기는 형태라 반드시 `R-CC-21` 등 미사용 번호로 교체해야 한다. `details.field='chatChannel.botToken'` 은 문자열 자체의 충돌은 없으나 형제 `botTokenRef` 와 형태(depth)가 달라 같은 표·같은 문맥에서 비일관하게 보이는 WARNING 이며, target 문서가 이 비일관을 이미 자각하고 있으므로 방치보다는 각주 보강을 권한다. `VALIDATION_ERROR` 재사용은 이 문서의 기존 코드 계층 관례(업무로직=`CHAT_CHANNEL_*`, DTO 검증=`VALIDATION_ERROR`+`details.field`)와 정확히 부합해 문제가 없다. 요청 사항 1의 "R-17"(trigger-list.md 로컬)·"R17"(EIA, prefix 없음)·"R-CC-17" 세 형태 간의 혼동 위험은, `R-CC-17` 충돌이 애초에 그 세 값과의 유사성 때문이 아니라 **같은 문서·같은 prefix 안에서의 직접 재사용**이기 때문에 발생한 것이라 셋의 표기 차이 자체는 추가 위험 요인이 아니다(오히려 `CC` prefix 는 이 세 형태를 가르기 위해 도입된 장치이며 제 역할을 하고 있다) — 다만 `R-CC-21` 로 교체해도 "R-17"/"R17"/"R-CC-N" 세 형태가 한 저장소에 공존하는 구조 자체는 남으므로, 이는 이번 target 의 책임 범위를 넘는 기존 컨벤션 이슈로 별도 후속(예: Rationale ID 전역 컨벤션 문서화) 대상으로만 남겨둔다.

## 위험도

HIGH
