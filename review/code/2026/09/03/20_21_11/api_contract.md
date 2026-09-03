# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `invitedBy?: string | null` 의 optional key(`?`) 표기가 실제 wire 동작(키 상시 존재, 값만 null)과 어긋남 — **이미 추적 중인 사안, 재-flag 아님**
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:109-110`
  - 상세: `workspaces.controller.ts` 의 `listInvitations` 핸들러(`data: invitations.map((i) => ({ id, email, role, expiresAt, invitedBy: i.invitedBy, createdAt }))`)는 `invitedBy` 키를 조건부로 생략하지 않는다 — 항상 존재하고 값만 `string | null`이다. 그런데 DTO 는 `@ApiPropertyOptional` + `invitedBy?: string | null` 로 선언돼 OpenAPI 스키마가 `required: false` 를 문서화한다. 같은 파일의 `InvitationMetaDto.invitedByName: string | null`(`:154-155`, non-optional `@ApiProperty({ nullable: true })`)은 정확히 같은 "상시 존재+nullable" 상황을 required 로 표현해 형태가 갈린다.
    이 갭의 원인은 이번 diff 가 아니라 **규약 `spec/5-system/2-api-convention.md §5.4` 문면 자체**에 있다 — §5.4 는 "`null`(상시 존재) 필드는 `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` 로 쓰라" 고 명시하는데, `field?:` 자체가 "키가 없을 수 있다" 는 뜻이라 같은 절의 "상시 존재" 정의와 내적으로 모순된다. `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 `- [ ] 후속(planner 턴) — §5.4 의 field?: 표기와 기존 선례가 어긋난다` 항목이 이미 이 사안을 planner 턴 결정으로 열어 둔 상태이고, developer 는 "규약 문면을 그대로 따랐다" 는 근거로 이번 PR 범위에서 스코프 아웃했다. 직전 리뷰 라운드(`20_02_03`)의 api_contract 리포트가 동일 사안을 WARNING 으로 냈고 통합 SUMMARY 가 "이미 planner 턴 추적 중" 이라는 이유로 INFO 로 합의 수렴했다 — 이번 라운드에서도 코드는 변경되지 않았으므로 같은 판정을 유지한다.
  - 제안: 조치 불요(이번 PR 범위 밖). §5.4 문면 정정 또는 `sourceIp`/`invitedByName` 선례 통일은 planner 턴에서 일괄 결정.

- **[INFO]** DTO nullability 완화는 하위 호환 방향(widening)이며 breaking change 아님
  - 위치: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts:105-110`, `CHANGELOG.md:3-23`
  - 상세: `invited_by` 컬럼이 `ON DELETE SET NULL`(V017)이라 초대자 계정 삭제 시 런타임에 이미 `null` 이 응답 바디에 실리고 있었다(핸들러가 코어션 없이 그대로 통과). 종전 Swagger 계약(`@ApiProperty({format:'uuid'})`, required·non-null)이 이 실제 동작보다 좁게(거짓으로) 문서화돼 있었을 뿐이고, 이번 변경은 스키마를 실제 wire 동작에 맞추는 widening 정정이다. 응답 바이트는 변경 전과 동일 — 실제 클라이언트 동작에 영향 없음. FE(`frontend/src/lib/api/workspaces.ts:154`)는 이미 `invitedBy: string | null` 로 소비 중이라 이 변경으로 새로 깨지는 소비자가 없다. `CHANGELOG.md` 에 종전/지금 표 + 영향 문단이 정확히 기록돼 있어 계약 변경 공지 요건도 충족한다.
  - 제안: 조치 불요.

- **[INFO]** 회귀 캐너리 테스트가 API 계약(통과 동작)을 인자까지 정확히 고정 — 직전 라운드 WARNING(인자 미검증) 정정 확인
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.spec.ts:60-103`
  - 상세: `listInvitations` 에 대해 "초대자 삭제 → `invitedBy: null` 을 코어션 없이 그대로 응답" 케이스와 "초대자 생존 → id 그대로 응답" 대조군을 검증하며, 두 테스트 모두 이제 `expect(invitations.listPending).toHaveBeenCalledWith('ws-1', user.sub)` 로 호출 인자까지 확인한다(직전 리뷰 라운드 W1 이 지적한 "결과값만 검증" 갭이 해소됨 — 같은 파일의 다른 describe 블록 관례와 일치). `?? ''` 같은 암묵적 coercion 회귀를 잡을 수 있는 계약 테스트로 판단.
  - 제안: 조치 불요.

- **[정보/해당없음]** `plan/in-progress/entity-nullable-column-type-mismatch.md`, `review/code/2026/09/03/20_02_03/*`(직전 라운드 산출물) 는 실행 코드가 아니며 API 계약에 직접 영향 없음. `review/code/**` 신규 파일 추가는 CLAUDE.md 가 지정한 저장 위치(코드 리뷰 산출물)와 일치.

- **[정보/해당없음]** 이번 diff 범위에 URL/경로 설계·페이지네이션·에러 응답·요청 검증·인증/인가 변경 없음. `GET /api/workspaces/:id/invitations` 엔드포인트 자체(Admin+ 가드, 경로, 페이지네이션 미적용 여부 등)는 diff 밖이라 이번 판정에서 제외.

## 요약

이번 diff 의 핵심은 `WorkspaceInvitationDto.invitedBy` 를 required/non-nullable 에서 optional/nullable(`string | null`)로 넓히는 Swagger·타입 정정이며, `invited_by` 컬럼의 `ON DELETE SET NULL`(V017) 로 인해 이미 존재하던 런타임 동작(문서화되지 않은 `null` 응답)을 계약에 반영하는 **정합화** 성격의 변경이다. widening 방향이라 breaking change 가 아니고, FE 는 이미 nullable 로 소비 중이며, `CHANGELOG.md` 에 계약 변경이 정확히 공지돼 있다. 신규 컨트롤러 테스트가 이제 결과값과 호출 인자를 함께 고정해(직전 라운드 W1 정정) 계약 회귀를 잘 방어한다. `invitedBy?:` 의 optional key 표기가 "키 상시 존재" 실제 동작과 형태상 어긋나는 지점이 하나 남아 있으나, 이는 이번 diff 가 만든 것이 아니라 규약 §5.4 문면 자체의 내적 모순이고 이미 planner 턴 항목으로 추적 중이므로 이번 PR 범위 밖으로 판단한다. 그 외 버전 관리·URL 설계·페이지네이션·인증/인가 관점에서는 이번 diff 범위 안에 해당 변경이 없다.

## 위험도

LOW
