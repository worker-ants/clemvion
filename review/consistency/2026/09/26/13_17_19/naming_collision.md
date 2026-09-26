# 신규 식별자 충돌 검토 — success-advert (swagger §2-4 · §5-2)

## 범위

이번 --impl-prep 의 실제 target 은 이미 커밋된 `spec/conventions/swagger.md` 변경(24084fd0e:
§2-4 "라우트는 성공 응답을 하나 이상 광고한다" · 상태 코드 표 3xx 행 · §5-2
`ApiOkWrappedNullableResponse` · §5-4 체크리스트 문구 · Rationale 불릿 교체)과, 그 spec 을
근거로 다음 단계에서 구현할 `plan/in-progress/success-advert.md` (성공 응답 광고 없는 라우트
11곳을 채우는 작업)이다. 번들에 포함된 `2-navigation/2-trigger-list.md` ·
`3-workflow-editor/4-ai-assistant.md` · `5-system/1-auth.md` · `5-system/2-api-convention.md` ·
`5-system/14-external-interaction-api.md` 는 diff 없이 related-spec 으로만 실려 있어(git diff
확인 결과 이번 커밋은 `spec/conventions/swagger.md` 단독 변경) 신규 식별자 출처가 아니다.

## 발견사항

- **[INFO]** `ApiOkWrappedNullableResponse` — 충돌 없음, 명명 관례 정확히 준수
  - target 신규 식별자: `ApiOkWrappedNullableResponse(Dto)` (`spec/conventions/swagger.md` §5-2 표,
    새 줄)
  - 기존 사용처: 없음 — `codebase/` 전체에서 grep 0건 확인
  - 상세: `codebase/backend/src/common/swagger/api-wrapped.ts` 의 기존 export
    (`ApiOkWrappedResponse` · `ApiOkWrappedOneOfResponse` · `ApiCreatedWrappedResponse` ·
    `ApiAcceptedWrappedResponse` · `ApiOkWrappedArrayResponse` · `ApiOkPaginatedResponse`)와
    같은 `ApiOk<Modifier>Response` 패턴을 그대로 따른다. `@ApiFoundResponse` (3xx 표 신규 행에서
    참조)도 `@nestjs/swagger` 가 이미 내보내는 표준 데코레이터(302 Found)이지 target 이 새로
    지어낸 이름이 아니다(`node_modules/@nestjs/swagger/dist/decorators/api-response.decorator.d.ts`
    에 선언돼 있음을 확인).
  - 제안: 없음 — 그대로 구현 진행 가능.

- **[WARNING]** workflow-assistant 응답 DTO 6종의 이름이 아직 정해지지 않았고, 일반명("세션"·
  "세션 상세"·"메시지")을 그대로 쓰면 다른 모듈의 기존 DTO 와 개념이 겹친다
  - target 신규 식별자: `plan/in-progress/success-advert.md` "실측" 표의 `workflow-assistant`
    행 — "응답 DTO(세션 · 세션 상세 · 메시지 + 중첩 셋) + 래퍼. `latest` 는 … 새 래퍼
    `ApiOkWrappedNullableResponse`" (구체적 클래스명 미정)
  - 기존 사용처:
    - `codebase/backend/src/modules/auth/dto/responses/session.dto.ts:4` `export class SessionDto`
      (로그인 세션 표시 정보) 및 같은 파일 60행 `export class SessionListDto` (`{ items: [] }`)
    - `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts:33`
      `export class MessageResponseDto` (이메일 변경 request/resend/cancel 의 단순 결과 메시지
      `{ message: string }`)
  - 상세: "세션"·"메시지"는 이 저장소에서 이미 다른 의미(인증 세션, 단순 상태 메시지)로 쓰이는
    도메인 용어다. 만약 구현 시 `SessionDto`/`SessionListDto`/`MessageResponseDto` 같은 이름을
    그대로 붙이면 (a) 클래스명이 정확히 겹칠 경우 `dto-class-name-collision.spec.ts` 가드(AST,
    `modules/`·`common/` 전수)가 빌드 시점에 차단하지만, (b) 겹치지 않는 유사명(예:
    `AssistantSessionDto` vs `SessionDto`)이라도 OpenAPI `components.schemas` 목록에서 "세션"을
    뜻하는 스키마가 두 종류(로그인 세션 vs 워크플로우 어시스턴트 대화 세션) 존재하게 되어 API
    소비자가 혼동할 수 있다. 다행히 같은 모듈의 기존 형제 DTO(`CreateAssistantSessionDto` ·
    `UpdateAssistantSessionDto` · `AssistantMessageRequestDto`)가 이미 `Assistant` 도메인
    접두 관례를 쓰고 있어 그 관례를 따르면 이 충돌은 피해진다.
  - 제안: 새 응답 DTO 6종(목록·상세·생성·수정·삭제·메시지)도 기존 형제와 같은 `Assistant` 접두
    관례를 따라 `AssistantSessionDto` / `AssistantSessionListDto` / `AssistantSessionDetailDto` /
    `AssistantMessageDto`(또는 동등한 `Assistant` 접두 이름)로 짓는다 — grep 확인 결과 이
    이름들은 현재 저장소에 존재하지 않아 충돌 없음. `latest` 엔드포인트는 §5-2 신규 헬퍼
    `ApiOkWrappedNullableResponse(AssistantSessionDetailDto)` (혹은 그에 준하는 이름) 형태로
    엮는다.

- **[INFO]** `triggers` `notification/rotate-secret` · `interaction/revoke-token` 신규 응답
  DTO 2종도 이름 미정 — 기존 "회전(rotate)" 계열 명명 관례를 따르면 충돌 없음
  - target 신규 식별자: 위 두 엔드포인트의 응답 DTO (plan 은 필드만 명시:
    `{ secret, rotatedAt }` · `{ token }`)
  - 기존 사용처: `codebase/backend/src/modules/triggers/dto/responses/`
    `chat-channel-rotate-bot-token-response.dto.ts` 의 `ChatChannelRotateBotTokenDto` /
    `ChatChannelRotateBotIdentityDto`(동일 모듈, "회전" 계열 선례) — 그 외 `Secret`/`Token`
    접미 클래스는 `auth`(`AccessTokenDto` · `RefreshTokenDto`) · `external-interaction`
    (`RefreshTokenResponseDto`)에 있으나 전부 다른 도메인(로그인 토큰 · EIA 토큰 refresh)이라
    직접 충돌은 아니다.
  - 상세: 이름을 아직 정하지 않아 실제 충돌은 없다. 다만 `interaction/revoke-token` 응답에
    generic 이름(`TokenResponseDto`/`RevokeTokenResponseDto`)을 붙이면
    `external-interaction/dto/responses/refresh-token-response.dto.ts` 의
    `RefreshTokenResponseDto`(같은 EIA 계열 "토큰" 응답)와 개념적으로 인접해 OpenAPI 스키마
    목록에서 구분이 흐려질 수 있다.
  - 제안: 같은 모듈의 `ChatChannelRotateBotTokenDto` 선례처럼 도메인 접두를 붙여
    `NotificationRotateSecretResponseDto` / `InteractionRevokeTokenResponseDto` 식으로 지어
    "무엇을 회전/폐기하는 응답인가"를 이름에서 바로 드러낸다.

## 요약

이번 target 인 `spec/conventions/swagger.md` §2-4/§5-2 변경 자체가 새로 도입하는 식별자는
`ApiOkWrappedNullableResponse` 하나뿐이며, 저장소 전체 grep 0건 + 기존 `ApiOk*Response` 명명
패턴과 정확히 일치해 충돌이 없다(`@ApiFoundResponse` 참조도 라이브러리 기존 데코레이터). 다음
단계로 예정된 구현 plan(`success-advert.md`)이 도입할 6~8개 응답 DTO 는 아직 클래스명이
확정되지 않았는데, 그중 workflow-assistant 세션/메시지 DTO 는 "세션"·"메시지"라는 이미 다른
의미로 쓰이는 도메인 용어를 그대로 옮기면 `auth.SessionDto`/`SessionListDto` ·
`users.MessageResponseDto` 와 개념이 겹칠 위험이 있어 WARNING 으로 표시했다(리터럴 동명은
`dto-class-name-collision` 가드가 빌드 시점에 잡아 CRITICAL 로 번지지는 않는다). triggers 의
두 신규 DTO 는 이름 공백 상태이므로 INFO 로 명명 관례(도메인 접두)를 미리 제안했다. 전체적으로
차단 사유는 없다.

## 위험도

LOW
