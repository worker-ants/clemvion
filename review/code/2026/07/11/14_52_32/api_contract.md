# API 계약(API Contract) 리뷰

## 리뷰 대상 요약

본 변경은 `external-interaction` 모듈의 응답 DTO 를 flat `dto/responses.dto.ts` 1개 파일에서
`dto/responses/{execution-status-response,interact-ack-response,refresh-token-response}.dto.ts`
3개 파일로 분리(swagger 규약 §5-1 준수)하고, import 표면을 갱신한 순수 리팩터링이다.
`git diff origin/main...HEAD` 기준 rename 추적 결과 `ExecutionStatusDto`/`CurrentNodeDto`/
`WaitingContextBaseDto`/`ButtonsContextDto`/`NodeOutputContextDto` 클래스 본문은 상대경로 주석
조정(`../` 1단 추가) 외 바이트 단위로 동일하며, `InteractAckDto`/`RefreshTokenResponseDto` 도
클래스 정의가 그대로 이동했다(내용 변경 없음). 신규 파일은 `execution-status-response.dto.spec.ts`
하나로, 실제 `SwaggerModule.createDocument()` 를 빌드해 `ExecutionStatusDto` 의 OpenAPI 스키마
표현(oneOf 닫힌 union, discriminator 부재, nullable/required, additionalProperties 개방 여부)을
검증하는 회귀 가드다.

컨트롤러(`interaction.controller.ts`)의 라우트·HTTP 메서드·상태 코드·가드·인증 데코레이터·
서비스(`interaction.service.ts`)의 응답 조립 로직(`getStatus`/`interact`/`cancel`/`refreshToken`)은
import 경로만 바뀌었을 뿐 로직 변경이 없다. 이는 앞선 PR(#904, #909, #912)에서 이미 도입된
`context` 닫힌 oneOf + 부재 표현(§5.4) 설계를 그대로 유지한다.

## 발견사항

- **[INFO]** 응답 DTO 분리는 wire 계약에 영향 없는 순수 구조 리팩터링
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/*.ts`,
    `interaction.controller.ts`, `interaction.service.ts`
  - 상세: `git diff origin/main...HEAD` 로 rename 추적 시 `ExecutionStatusDto` 등 클래스 본문은
    JSDoc 내 상대 경로(`../../../../../../spec/...` → `../../../../../../../spec/...`, 파일이
    한 단계 깊은 디렉토리로 이동했으므로) 외 diff 가 없다. `InteractAckDto`/`RefreshTokenResponseDto`
    도 원본 `responses.dto.ts` 의 클래스 정의가 그대로 복사됐다(문자열 동일 확인). 컨트롤러/서비스는
    import 문만 3개 파일로 나뉘어 갱신됐고 라우트·HTTP 상태코드·가드·에러 매핑 로직은 불변.
  - 제안: 없음(정보성). `plan/in-progress/eia-context-schema-followups.md` 의 "DTO 위치 정규화"
    항목이 본 변경으로 해소되므로, 커밋 이력상 이미 별도 커밋(`31bbbac31`)으로 반영된 것으로 보임 —
    plan 체크박스 최신화 여부만 developer 측에서 확인 권장(API 계약 범위 밖).

- **[INFO]** 신규 스키마 회귀 테스트가 §5.4/swagger §1-4 규약을 실측 검증
  - 위치: `execution-status-response.dto.spec.ts`
  - 상세: 데코레이터 메타데이터만 읽지 않고 `SwaggerModule.createDocument()` 로 실제 OpenAPI 문서를
    빌드해 (1) `@ApiExtraModels` 누락으로 인한 dangling `$ref` 부재, (2) `context` 가 discriminator
    없는 닫힌 2-variant `oneOf`(추가 `additionalProperties`/`type` 없음), (3) `conversationThread` 는
    키 생략(optional, non-nullable) vs `result`/`error` 는 `null` 표현(nullable) 이원화, (4) 내부
    payload(`nodeOutput`/`buttonConfig`)는 여전히 열린 map 임을 검증한다. `interactionType` 이
    unsound discriminator 라는 이전 PR(#904) 결정을 코드 주석·테스트 양쪽에서 재확인하고 있어
    회귀 방지 효과가 명확하다.
  - 제안: 없음.

- **[INFO]** 하위 호환성 — breaking change 없음
  - 위치: 컨트롤러 라우트 전체(`POST :id/interact`, `POST :id/cancel`, `POST :id/refresh-token`,
    `GET :id`)
  - 상세: URL 경로, HTTP 메서드, 상태 코드(202/200), 에러 코드 체계(`STATE_MISMATCH`,
    `EXECUTION_TERMINATED`, `EXECUTION_NOT_FOUND`, `TOKEN_*`, `RATE_LIMITED` 등), 인증
    스킴(`interaction-token` Bearer), rate-limit 메타데이터 모두 diff 에 나타나지 않는다.
    응답 바디 스키마(`ExecutionStatusDto`/`InteractAckDto`/`RefreshTokenResponseDto`)의 필드
    구성·nullable/required 규칙도 이전 PR 에서 이미 확정된 것을 그대로 유지한다.
  - 제안: 없음.

## 요약

이번 변경은 `external-interaction` 응답 DTO 를 모듈 관례(swagger §5-1)에 맞춰 파일 단위로
분리한 순수 리팩터링과, 그 결과물(`ExecutionStatusDto`)의 OpenAPI 스키마 표현을 실제 문서
빌드로 검증하는 회귀 테스트 추가로 구성된다. 라우트·HTTP 상태코드·에러 응답 형식·인증/인가·
페이지네이션(해당 없음)·요청 검증 로직 등 API 계약의 실질 표면은 전혀 변경되지 않았으며,
클래스 본문도 rename 추적 결과 바이트 단위로 동일함을 확인했다. 기존 API 클라이언트에
영향을 주는 breaking change 는 없다.

## 위험도

NONE
