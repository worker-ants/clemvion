# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `invitedBy` 를 `optional`(`?`)로 선언해 "키가 항상 존재하는" 실제 응답과 어긋난다 — 같은 파일의 `InvitationMetaDto.invitedByName` 과 표기 컨벤션이 다르다
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:109-110`
    (`@ApiPropertyOptional({ format: 'uuid', nullable: true }) invitedBy?: string | null;`)
  - 상세: 실제 소스(`workspaces.controller.ts:396-404`)를 열어 확인한 결과, `listInvitations` 핸들러는
    매핑 객체를 `{ id, email, role, expiresAt, invitedBy: i.invitedBy, createdAt }` 형태로 **항상**
    구성한다 — `invitedBy` 키가 조건부로 생략되는 경로가 없다. 즉 응답 바디에는 `invitedBy` 키가
    **항상** 존재하고, 값만 `string` 또는 `null` 이다. 그런데 DTO 는 `@ApiPropertyOptional` +
    `invitedBy?: string | null` 로 선언돼 있어, 생성되는 OpenAPI 스키마는 이 필드를 `required: false`
    로 문서화한다 — "키 자체가 응답에서 생략될 수 있다"는 잘못된 신호를 클라이언트/SDK 제너레이터에
    준다.
    같은 파일 안에 이미 정반대 패턴이 있다 — `InvitationMetaDto.invitedByName: string | null;`
    (`:154-155`, `@ApiProperty({ nullable: true })`, non-optional)은 "항상 존재하지만 null 일 수
    있는" 필드를 **required + nullable** 로 정확히 표현한다. 한 파일 안에 "상시 존재하는 nullable
    필드"를 표현하는 두 가지 다른 관례(`field?: T | null` vs `field: T | null`)가 공존하게 된다.
    참고로 이 불일치는 리뷰 대상 plan 문서(`plan/in-progress/entity-nullable-column-type-mismatch.md`
    §후속 `INFO#1`)에도 **이미 인지·기록**돼 있고, developer 는 이를 "규약(§5.4) 문면을 그대로
    따른 것이고 선례와의 정합은 planner 턴 결정 사항"이라 명시적으로 스코프 아웃했다. 즉 숨겨진
    결함이 아니라 추적 중인 미해결 governance 이슈이며, 이번 diff 는 그 미해결 컨벤션을 그대로
    적용한 것이다.
  - 제안: `spec/5-system/2-api-convention.md §5.4` 의 `field?:` 표기가 확정될 때까지는, 최소한
    `WorkspaceInvitationDto.invitedBy` 를 `InvitationMetaDto.invitedByName` 과 같은 형태
    (`@ApiProperty({ nullable: true })` + `invitedBy: string | null`, non-optional)로 맞춰 같은
    파일 내 일관성을 확보하는 것을 고려. 이미 planner 턴으로 위임돼 있으므로 이번 PR 범위에서
    반드시 수정할 필요는 없음 — 다만 다음 리뷰/구현자가 "이 필드가 어떤 표기가 맞는지" 판단할 때
    참조할 수 있도록 기록.

- **[INFO]** DTO nullability 완화는 실제로는 하위 호환 방향의 수정(버그 정정)이며 breaking change 로 보이지 않음
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105-110`
  - 상세: 변경 전 `invitedBy: string`(required, non-nullable, `@ApiProperty({format:'uuid'})`)로
    문서화돼 있었으나, `invited_by` 컬럼이 `ON DELETE SET NULL`(V017)이라 대기 중 초대의 초대자
    계정이 삭제되면 런타임에 이미 `null` 이 응답 바디에 실리고 있었다(핸들러가 코어션 없이
    그대로 통과). 즉 기존 Swagger 계약이 실제 런타임 동작보다 **좁게(거짓으로) 문서화**돼 있었던
    상태이고, 이번 변경은 스키마를 실제 동작에 맞춰 넓히는(`string` → `string | null`) 정정이다.
    프런트엔드 클라이언트(`frontend/src/lib/api/workspaces.ts:154`)는 이미 `invitedBy: string | null`
    로 처리하고 있어 이 변경으로 인해 새로 깨지는 소비자는 없는 것으로 보인다. required→optional/
    nullable 로의 응답 스키마 완화는 일반적으로 하위 호환 방향(narrowing 이 아니라 widening)이라
    breaking change 로 분류하지 않음.
  - 제안: 별도 조치 불요. 다만 OpenAPI 스펙을 기준으로 클라이언트 코드를 자동 생성하는 파이프라인이
    있다면, 재생성 시 `invitedBy` 타입이 `string` → `string | null | undefined` 로 바뀌는 것을
    체인지로그에 남기는 것을 권장.

- **[INFO]** 회귀 캐너리 테스트가 실제 API 계약(응답 통과 동작)을 정확히 고정
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:60-102`
  - 상세: `listInvitations` 에 대해 "초대자 삭제 → `invitedBy: null` 을 코어션 없이 그대로 응답"
    케이스와 "초대자 생존 → id 그대로 응답" 대조군 두 케이스를 모두 검증한다. 계약 회귀(예:
    `?? ''` 같은 암묵적 coercion 도입)를 잡을 수 있는 적절한 테스트로, API 계약 관점에서
    긍정적 변경.

- **[정보/해당없음]** `plan/in-progress/entity-nullable-column-type-mismatch.md` 자체는 실행 코드가
  아닌 추적 문서로, 이번 diff 의 API 계약 판단(§5.4 표기 문제, 응답 DTO nullable 잔여 48건 재판정
  등)을 정확히 기록·planner 턴으로 위임하고 있어 프로세스상 문제 없음. 코드 변경(File 1/2)과 별개로
  추가 조치 불필요.

## 요약

이번 diff 의 핵심은 `WorkspaceInvitationDto.invitedBy` 를 required/non-nullable 에서
optional/nullable(`string | null`)로 넓히는 Swagger·타입 정정이며, 이는 `ON DELETE SET NULL`
로 인해 이미 발생하고 있던 런타임 동작(문서화되지 않은 `null` 응답)을 계약에 반영하는 **정합화**
성격의 수정이다. 프런트엔드는 이미 nullable 로 소비하고 있어 하위 호환성 파괴 위험은 낮다. 다만
같은 파일 안에서 "상시 존재하는 nullable 필드"를 표현하는 방식이 `invitedBy?: T | null`
(optional)과 `invitedByName: T | null`(required)로 갈라져 있어, 응답 스키마의 `required` 플래그가
실제 wire 동작(키는 항상 존재, 값만 null)과 어긋난다 — 이 불일치는 이미 plan 문서에 기록돼 있고
planner 턴 결정으로 위임된 상태다. 회귀를 막는 컨트롤러 단위 테스트가 함께 추가되어 계약 동작이
잘 고정돼 있다. 그 외 버전 관리·에러 응답·요청 검증·URL 설계·페이지네이션·인증/인가 관점에서는
이번 diff 범위 안에 해당 변경이 없다.

## 위험도

LOW
