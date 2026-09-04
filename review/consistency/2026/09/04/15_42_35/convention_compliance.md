# 정식 규약 준수 검토 — `spec/5-system/` (impl-done)

## 검토 범위 및 방법

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`.
- `spec/5-system/` 델타: 0개 파일 (이 브랜치는 해당 spec 영역을 변경하지 않음 — 정상).
- 구현 diff: 2개 파일 / 125줄 —
  `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts`
  및 그 `.spec.ts`. `ExecutionStatusDto` 의 `durationMs`/`currentNode`/`context`/`result`/`error`
  5개 필드를 `@ApiPropertyOptional` + `field?: T | null` 에서 `@ApiProperty({ nullable: true })` +
  `field: T | null` 로 전환.
- 대상 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/plan-in-progress-items-b0c80b`)를
  절대경로로 직접 `Read` 하여 diff 반영 후의 파일 전체(`execution-status-response.dto.ts`)를
  재확인했다 (diff 스니펫만으로 판단하지 않음).
- 대조한 정식 규약: [`spec/conventions/swagger.md`](../../../../../../spec/conventions/swagger.md)
  §1-4·§5-1, [`spec/5-system/2-api-convention.md §5.4`](../../../../../../spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략),
  [`spec/conventions/error-codes.md`](../../../../../../spec/conventions/error-codes.md) §1·§3.

## 발견사항

이번 diff 범위에서 **정식 규약 위반(CRITICAL/WARNING)은 발견되지 않았다.** 오히려 diff 는
규약이 명시적으로 요구하는 형태로의 정정이다 — 근거는 아래와 같다.

- **[INFO] diff 는 API 규약 §5.4 및 swagger 규약 §1-4 를 문자 그대로 따른다**
  - target 위치: diff `execution-status-response.dto.ts` — `durationMs`/`currentNode`/`context`/`result`/`error` 5개 필드
  - 대조 규약: `spec/5-system/2-api-convention.md §5.4` "DTO 선언이 wire 를 반영해야 한다" —
    "**`null` 을 쓰는(상시 존재)** 필드 → `@ApiProperty({ nullable: true })` + `field: T | null`".
    동일 취지가 `spec/conventions/swagger.md` §1-4 예시 코드와 그 바로 아래 Rationale
    ("`@ApiPropertyOptional` 이 아니라 `@ApiProperty({ nullable: true })` 인 이유")에도 명문화돼 있다.
  - 상세: 변경 전 코드는 이 다섯 필드에 `@ApiPropertyOptional`(= `ApiProperty({ required: false })`
    의 별칭) + optional `?`를 썼다. §5.4 규약상 이 필드들은 "종결 전에는 null" 처럼 **키가 상시
    존재하고 값만 null 일 수 있는** 케이스이므로, `@ApiPropertyOptional` 을 쓰면 OpenAPI 가
    `required: false` 로 노출돼 "상시 존재" 계약과 모순된다 — 이것이 바로 §5.4·swagger.md §1-4 가
    지목하는 반례 패턴이다. diff 는 이 모순을 없애고 규약이 요구하는 형태(`@ApiProperty({nullable:true})`
    + `field: T | null`)로 정확히 정렬시켰다.
  - 교차검증: 같은 파일의 `WaitingContextBaseDto.conversationThread` 필드는 diff 로 건드리지 않았고,
    여전히 `@ApiPropertyOptional()` + `conversationThread?: ConversationThread`(`| null` 없음)를 쓴다.
    이 필드는 §5.4 의 "키 생략(present-when-available)" 케이스(SSE wire 형식 일치가 사유)로 문서화돼
    있어 반대 패턴이 정확한 선택이다 — 두 패턴이 한 파일 안에서 규약대로 갈려 있다.
  - 제안: 없음(규약 준수 상태). 참고로 diff 가 반증한 것은 규약이 아니라 **그 규약을 반영하지
    못하고 있던 기존 코드**였다 — 커밋 메시지 계보(`d8b7cb93e`, `2b2602fbd`, `cce8a188b`)와
    일치한다.

- **[INFO] 닫힌 union(`context`) 의 `@ApiExtraModels`/`oneOf`/discriminator 생략 패턴도 규약 일치**
  - target 위치: `ExecutionStatusDto` 클래스 선언부(`@ApiExtraModels(ButtonsContextDto, NodeOutputContextDto, CurrentNodeDto)`) 및 `context` 필드의 `oneOf` 선언 (diff 미변경 부분, 대조용으로 재확인)
  - 대조 규약: `spec/conventions/swagger.md` §1-4 "닫힌 union" 패턴 + Rationale
    "`discriminator` 는 판별자가 sound 할 때만"
  - 상세: `context` 는 `interactionType` 이 sound discriminator 가 아니므로(버튼 fallthrough 케이스)
    `discriminator` 를 선언하지 않고 `oneOf` 만 쓰는데, 이는 swagger.md 가 명시한 정확한 규칙이다.
    diff 는 이 부분을 건드리지 않았지만 인접 필드 정정이 이 기존 정합성을 깨지 않았음을 확인했다.
  - 제안: 없음.

- **[INFO] `spec/5-system/1-auth.md` 의 lower_snake_case 에러 코드 예외 표기가 error-codes.md §3 레지스트리와 정합**
  - target 위치: `1-auth.md §1.5.4` "명명 — historical-artifact 예외" 콜아웃
  - 대조 규약: `spec/conventions/error-codes.md §3` (Historical-artifact 예외 레지스트리) —
    `invitation_not_found`/`invitation_expired`/`invitation_already_used`/`invitation_email_mismatch`/
    `forbidden`/`rate_limited` 행
  - 상세: `1-auth.md` 는 이 초대 흐름 코드들이 `UPPER_SNAKE_CASE` 원칙(`node-output.md §3.2`)의
    예외이며 "초대 API 한정" 임을 명시하고, `error-codes.md §3` 레지스트리를 SoT 로 정확히 인용한다.
    두 문서를 대조한 결과 문구·범위가 일치하며 새로 도입된 예외가 아니다(이번 diff 와도 무관 — 이
    영역은 델타 0).
  - 제안: 없음(정보성 확인).

## 요약

이번 검토 대상(`spec/5-system/`, --impl-done)의 spec 델타는 0 이고, 실제 코드 diff 는 EIA
`ExecutionStatusDto` 의 5개 nullable-상시존재 필드를 `@ApiPropertyOptional` 오용에서
`@ApiProperty({ nullable: true })` 로 정정한 125줄짜리 좁은 변경이다. 이 변경을 `spec/5-system/2-api-convention.md §5.4`
와 `spec/conventions/swagger.md §1-4`(및 그 Rationale)에 문자 단위로 대조한 결과, diff 는 두 문서가
명시적으로 규정한 DTO 선언 형태를 정확히 구현한 것으로 확인됐다 — 오히려 변경 전 코드가 규약
위반 상태였고 diff 가 이를 교정했다. 같은 파일 내 다른 필드(`conversationThread`, 닫힌 union
`context`)의 기존 패턴도 각각 해당 규약 조항과 정합함을 재확인했다. `1-auth.md` 의
lower_snake_case 에러 코드 예외 표기도 `error-codes.md §3` 레지스트리와 어긋나지 않는다. 정식
규약 위반 CRITICAL/WARNING 은 발견되지 않았다.

## 위험도

NONE
