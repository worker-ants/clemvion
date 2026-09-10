# 정식 규약 준수 검토 — `spec/5-system/15-chat-channel.md` (`--impl-prep`)

검토 대상: `spec/5-system/15-chat-channel.md` §5.4.1 / §5.4.1.1 / R-CC-10 / R-CC-21
(planner PR `df1962e25` #1311 이 확정한 "PATCH 는 비밀을 쓰지 않는다" 처방). 개발자 세션
`impl-chat-channel-patch-token`이 이 spec 을 SoT 로 구현에 착수하기 직전 상태.

## 0. 검토 방법

- 대상 파일을 직접 `Read`/`grep` — bundle 프롬프트는 `spec/conventions/**` 대부분을 예산
  초과로 절단했으므로 (`chat-channel-adapter.md`·`secret-store.md`·`error-codes.md`·
  `swagger.md`·`audit-actions.md`·`review-citations.md` 전부 절단), 해당 규약 원문을 저장소에서
  직접 열어 대조했다.
- `git show df1962e25`로 이번 PR의 실제 diff(A~H)를 확인하고, 세 파일(`15-chat-channel.md`·
  `2-navigation/2-trigger-list.md`·`data-flow/14-chat-channel.md`) 간 교차 인용이 새 문면과
  정합한지 실측.
- 같은 커밋에 동봉된 `review/consistency/2026/09/10/{20_13_39,20_29_00,20_47_53}` 세 라운드의
  `convention_compliance.md`/`SUMMARY.md`를 먼저 읽어, 이미 **draft 단계에서 처분된 항목**을
  재지적하지 않도록 배제했다 (해당 라운드는 C0/W0로 수렴).
- 기존 구현 `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`를 대조해
  `writeOnly`/`@IsEmpty()` 기존 패턴이 규약과 이미 정합한지 확인(신규 PATCH DTO 설계와의
  정합성 판단 근거).

## 발견사항

- **[INFO]** `details.field` 가 두 SoT 표 모두에서 여전히 미확정 placeholder
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1 3행(`botToken` plaintext 차단)·
    §5.4.1.1 3행(`inboundSigningPlaintext`/`inboundSigning` 차단)
  - 관련 규약: [`2-api-convention.md §5.3`](../../../../../spec/5-system/2-api-convention.md#53-에러-응답)
    — "형태 선택은 발행 지점의 책임이며, 그 엔드포인트를 문서화하는 절에 어느 형태인지 적는다."
  - 상세: 두 행 모두 `details.field` 값을 "**미확정 — 후속 e2e 확인 대기**"로 명시적으로
    비워 두었다. 이것은 규약 위반이 아니다 — `3-error-handling.md §2.1`이 미구현 세부 shape를
    "계획(Planned)"으로 명시 유예하는 선례를 이미 갖고 있고, `20_29_00` 라운드가 이 정확한
    지점을 검토해 "완전한 공백 대신 명시적 placeholder를 쓰라"고 권고했으며 현재 문면이 그
    권고를 이미 반영한 상태다. 다만 이 PATCH 정책이 구현 대상인 이번 세션에서 `details.field`
    실값이 확정되지 않으면 §5.3의 "형태를 적는다" 요구가 계속 미이행 상태로 남는다.
  - 제안: 플랜 체크리스트의 "`details.field` 실제 페이로드 캡처" 항목대로 e2e 구현 후 이
    두 자리를 구체값으로 채운다(신규 CRITICAL/WARNING 아님 — 이미 추적 중인 항목).

- **[INFO]** R-CC-21 "기각한 대안"의 리뷰 인용에 세션 경로가 없음
  - target 위치: `spec/5-system/15-chat-channel.md` R-CC-21 "처방의 함정" 절
    (*"리뷰가 처음 제시한 처방은 *PATCH 전용 DTO 에서 `botToken` 제외*였다"*)
  - 관련 규약: [`conventions/review-citations.md §3`](../../../../../spec/conventions/review-citations.md#3-적용-범위--맥락-없이-읽히는-자리)
    — `spec/**` 문서는 리뷰 인용 규약의 **적용 대상**(살아 있는 문서라 맥락 없이 오래 읽힘)이다.
  - 상세: 이 문장은 특정 리뷰 세션을 가리키지 않는 서술이라 §2가 금지하는 "bare `hh_mm_ss`"
    위반은 아니다(애초에 시각 표기가 없다). 다만 §3의 취지(수개월 뒤 읽는 사람이 어느 라운드가
    이 "함정"을 제기했는지 스스로 해소할 수 있어야 함)에 비추면, 날짜+경로 인용을 붙이는 편이
    다음 사람이 그 판단의 근거를 추적하기 쉽다. §4가 기존 bare 인용의 소급 정리를 요구하지
    않는다는 점, 그리고 이 문서 전체가 지금까지 어떤 review 세션도 경로로 인용한 선례가 없다는
    점(`grep` 0건)을 감안하면 이 문서의 기존 관례 이탈도 아니다 — 강제 사유는 아님.
  - 제안: 해당 리뷰 라운드(추정: `20_13_39` 또는 그 이전 draft 라운드)를 특정할 수 있으면
    한 줄 인용을 덧붙인다. 문서 완성도 제안이며 이 세션의 구현 착수를 막을 사유는 아니다.

## 확인된 것 — 위반 없음

- **에러 봉투 형식** (`2-api-convention.md §5.3`): `details.field='botTokenRef'`처럼 **객체 형태**
  `details: { field, code, … }`를 쓰는 것은 §5.3가 명시적으로 허용하는 두 형태(배열/객체) 중
  하나이며, 기존 `TRIGGER_ENDPOINT_PATH_CONFLICT` 선례와 같은 패턴이다. `VALIDATION_ERROR`는
  400의 시스템 전역 기본 코드로 `error-codes.md §1`의 prefix-less 예외 범주에 정확히 해당한다.
- **감사 액션 명명** (`conventions/audit-actions.md`): `POST /api/triggers/:id/chat-channel/
  rotate-bot-token` 및 그 감사 액션 `trigger.chat_channel_bot_token_rotated`는 레지스트리
  (§3, `trigger` 과거분사 행, 2026-08-11 등재)와 정확히 일치한다. 이번 PATCH diff는 새 감사
  액션을 만들지 않는다.
- **secret ref 관례** (`conventions/secret-store.md`): 신설 4행("`chatChannel` 이 실린 PATCH")의
  "`botTokenRef` 는 config 에서 보존되는 것이 아니라 trigger id 에서 재유도된다(`buildSecretRef`)"
  서술은 §5.4/§5.5의 `buildSecretRef({ scope, resourceId, name })` 헬퍼 재사용 패턴과 정합하고,
  §1.1("비대상 필드도 응답 바디에는 나가지 않는다")의 정신과도 §5.4.2 `hasBotToken` derived
  필드 설계가 일치한다.
- **API 문서 규약** (`conventions/swagger.md §1-5`): "secret store 입력 plaintext(`botToken`,
  `inboundSigningPlaintext`)는 항상 `writeOnly: true` 동반" 의무는 이미 기존
  `ChatChannelConfigDto`(`codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:183,280`)에
  반영돼 있고, `botTokenRef`/`inboundSigning`(내부 전용 필드)의 `@IsEmpty()` 패턴도 이미 존재한다
  — 신설될 PATCH 전용 DTO가 같은 패턴(`writeOnly` + `@IsEmpty()`)을 그대로 확장하면 규약과
  충돌하지 않는다. spec 본문이 이 데코레이터 조합을 재서술하지 않는 것은 누락이 아니라, 이미
  swagger.md가 그 필드명을 예시로 직접 지목하는 범용 규약이기 때문이다.
- **문서 구조** (CLAUDE.md 3섹션 권장): 파일은 `## Overview (제품 정의)` → 본문(`## 3. 처리 흐름`
  ~ `## 8. 호환성`) → `## Rationale`의 3섹션 구조를 유지한다. 신설 `### R-CC-21`은 `## Rationale`
  섹션 안, 기존 `R-CC-20` 바로 뒤에 붙어 헤딩 계층·소속이 올바르다.
  - **Rationale ID 컨벤션** 부합: `R-CC-N`(`CC` prefix) 시퀀스가 10~13, 15~20, 21로 이어지며
    `14`는 의도적 영구 결번(이전 라운드가 `git log -S`로 재현 확인)이다. 새 번호를 결번(14)에
    채우지 않고 max+1(21)을 쓴 것은 `error-codes.md §5`(은퇴 코드 재사용 금지)와 같은 정신의
    저장소 관례를 따른다.
- **크로스 스펙 정합** — 같은 PR이 함께 고친 `spec/2-navigation/2-trigger-list.md §3`·
  `spec/data-flow/14-chat-channel.md §1.3`을 대조한 결과, "`chatChannel` 이 실린 PATCH가
  secret store를 바꾸지 않는다"는 문장과 "PATCH가 `chatChannel` 객체를 통째로 교체한다"는
  기존 서술(2-trigger-list.md) 사이의 잠재적 모순도 "botTokenRef는 소멸하지 않고 재유도된다"
  라는 명시 문장으로 이미 해소돼 있다.

## 요약

`spec/5-system/15-chat-channel.md`의 이번 PATCH-비밀-차단 확정 문면(§5.4.1/§5.4.1.1/R-CC-10/
R-CC-21)은 `spec/conventions/**`의 명명·에러 봉투 형식·감사 액션 명명·secret ref 관례·Swagger
writeOnly 의무·Rationale ID 부여 관례 어디와도 충돌하지 않는다. 이미 `--spec` 3라운드
(20_13_39→20_29_00→20_47_53)를 거쳐 convention_compliance 축이 NONE으로 수렴한 draft가 거의
그대로 적용됐고, 교차 파일(2-trigger-list.md·data-flow/14-chat-channel.md) 정합도 재확인했다.
남은 두 항목은 모두 INFO — `details.field` 미확정 placeholder(이미 후속 e2e로 추적 중)와
R-CC-21의 비-경로 리뷰 인용(이 문서에 기존 경로-인용 선례가 아예 없어 이탈도 아님) — 이며
구현 착수를 막을 CRITICAL/WARNING은 없다.

## 위험도

NONE
