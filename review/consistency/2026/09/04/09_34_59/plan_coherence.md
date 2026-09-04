# Plan 정합성 검토 — `spec-draft-nullable-notation-followups.md`

## 발견사항

- **[WARNING]** §5.4 정정이 `spec/conventions/swagger.md` §1-4 의 정본 예제와 곧바로 어긋난다
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` ③ 변경안
    (`spec/5-system/2-api-convention.md` §5.4 DTO 선언 규칙 줄 정정)
  - 관련 plan: `plan/in-progress/entity-nullable-column-type-mismatch.md` 의
    "후속(planner 턴) — §5.4 의 `field?:` 표기와 기존 선례가 어긋난다" 항목(target 이 그대로
    옮겨온 원 항목)
  - 상세: 현행 §5.4(`spec/5-system/2-api-convention.md:184`)는 DTO 선언 규칙 각주로
    `[Swagger 규약 §1-3](../conventions/swagger.md#1-3-optional-필드)` 를 직접 링크한다.
    그런데 `swagger.md` §1-4(닫힌 union 예시, L92-104)는 `ExecutionStatusDto.context` 를
    그대로 옮겨 적은 정본 예제이고, 이 예제는 `@ApiPropertyOptional({..., nullable: true})`
    + `context?: ButtonsContextDto | NodeOutputContextDto | null` — target 이 "현행 문면(70곳,
    곧 폐기될 형태)" 로 지목한 바로 그 패턴이다. 실측(`execution-status-response.dto.ts:132-174`):
    같은 파일의 `durationMs?:`·`currentNode?:`·`context?:`·`result?:`·`error?:` 다섯 필드 모두
    코드 주석에 "(키 present — API 규약 §5.4)" 라고 **상시 존재**를 명시하면서도 `?:` +
    `@ApiPropertyOptional({nullable:true})` 로 선언돼 있다 — item③ 이 고치려는 결함의 실물이다.
    target 은 §5.4 텍스트만 고치고 `swagger.md` 는 `spec_impact` 에 없어, 정정 이후에도
    개발자가 `swagger.md` §1-4 를 따라가면 새로 폐기된 패턴을 그대로 재생산한다 — 규약 두
    문서(§5.4 규칙 vs swagger.md 예제)가 서로 다른 것을 가르치는 상태가 된다.
  - 제안: target 의 `spec_impact` 에 `spec/conventions/swagger.md` 를 추가하고, §1-4 예제를
    (a) 새 규칙에 맞는 필드로 교체하거나 (b) "상시 존재 필드는 §5.4 참조" 각주를 붙인다.
    최소한 target 본문에 이 예제 충돌을 인지·기록해야 다음 사람이 두 문서를 대조하지 않고도
    안다.

- **[WARNING]** 형제 plan 이 이 세션에서 방금 만든 필드 2건이 target 이 폐기하는 패턴 그대로다
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` ③
    "마이그레이션은 이 문서가 강제하지 않는다" 절 — "기존 70곳"·"소급 면제"
  - 관련 plan: `plan/in-progress/entity-nullable-column-type-mismatch.md` "배치 3" §"새로 드러난
    축" — `AuthConfigDto.ipWhitelist`(리뷰 1R W1, 커밋 `af1651264`) ·
    "후속 축 종결" — `WorkspaceInvitationDto.invitedBy`(같은 배치, 조치 완료)
  - 상세: 실측 — `auth-config-response.dto.ts:27-28` `ipWhitelist?: string[] | null` +
    `@ApiPropertyOptional({..., nullable: true})`, `workspace-response.dto.ts:109-110`
    `invitedBy?: string | null` + `@ApiPropertyOptional({format:'uuid', nullable: true})`.
    두 필드 모두 코드 주석이 "상시 존재, 값만 null" 을 명시한다(`invitedBy` 주석: "대기 중 초대는
    그대로 남아 이 값이 `null` 로 응답된다"). 즉 item③ 의 새 규칙 기준으로는 `@ApiProperty({
    nullable: true }) field: T | null`(비-optional) 이어야 하는데, **같은 파일**
    `workspace-response.dto.ts:154-155` 의 형제 필드 `invitedByName: string | null` 은 이미 그
    형태다 — 한 파일 안에서 갈린다. 이 두 필드는 **item③ 이 다루는 형제 plan 자신이 바로
    이 세션에서** "§5.4 형태로 정정" 하며 새로 만든 것이라(entity-nullable-column-type-mismatch.md
    본문이 스스로 "배치 3 은 규약 문면을 그대로 따랐다" 고 명시) target 의 "기존 70곳" 서술에
    자연히 포함되긴 하지만, 다른 68곳과 달리 **연혁이 이 draft 가 참조하는 형제 plan 자체**이고
    필드 수가 2건뿐이라 별도 개발자 plan 을 기다릴 이유가 약하다.
  - 제안: target 본문(③ 변경안 또는 Rationale)에 이 두 필드를 "형제 plan 이 직접 만든 최신
    인스턴스" 로 명시하고, 70곳 일괄 이관과 분리해 이번 §5.4 문구 정정과 **같은 PR** 에서 2건만
    함께 고칠지, 혹은 의도적으로 70곳 배치에 남길지 결정을 적는다. 지금처럼 침묵하면 다음
    사람이 이 두 필드가 이미 "정합" 이라고 오판할 수 있다(코드 주석이 "API 규약 §5.4" 를
    직접 인용하기 때문에 신뢰도가 특히 높다).

- **[INFO]** target 완료 시 형제 plan 체크박스 동기화 지점 미명시
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 전체(별도
    "할 일"/완료 조건 절 없음)
  - 관련 plan: `plan/in-progress/entity-nullable-column-type-mismatch.md:182,190,261` (①②③에
    대응하는 세 `- [ ]` 항목) 및 그 파일 상단 경고문 — "아래 §후속의 [planner 턴] 항목이 반영되기
    전에는 완료 처리하지 말 것"
  - 상세: 세 항목은 소스 plan 에서 정확히 1:1 로 대응하고 내용도 일치한다(충돌 없음). 다만
    target 문서 자체에는 "완료 시 이 세 체크박스를 닫는다" 는 명시적 연결이 없다 — 두 plan 파일이
    구조적으로 분리돼 있어 target 이 `complete/` 로 이동할 때 형제 plan 체크박스 갱신을 빠뜨릴
    여지가 있다(이 저장소가 반복적으로 겪은 "추적처를 안 만들었다" 류 실패와 같은 모양).
  - 제안: target 완료 처리 시 `entity-nullable-column-type-mismatch.md:182,190,261` 세 항목을
    함께 체크하고 상단 경고문을 해제하는 것을 target 의 종결 조건으로 명시.

## 요약

target 의 세 항목(①②③)은 `plan/in-progress/entity-nullable-column-type-mismatch.md` 가 명시적으로
"developer 권한 밖" 으로 이월한 세 개의 미해결 planner-턴 항목과 정확히 1:1 대응하며, 실측(spec
줄 번호·엔티티 타입·§2.2 예외 2개·§5.4 L184 문면)도 저장소 현재 상태와 일치해 미해결 결정을
우회하거나 다른 plan 과 직접 충돌하는 CRITICAL 은 없다. 다만 ③ 의 §5.4 DTO 선언 규칙 정정은
파급 범위를 "기존 70곳, 이 문서가 강제하지 않음" 으로 뭉뚱그리면서, (a) 같은 규칙을 링크로
참조하는 `spec/conventions/swagger.md` §1-4 의 정본 예제가 정정 후에도 옛 패턴을 계속 가르치는
상태로 남고 `spec_impact` 에 빠져 있으며, (b) 그 "70곳" 중 2곳(`ipWhitelist`·`invitedBy`)은 다름아닌
이 draft 가 참조하는 형제 plan(`entity-nullable-column-type-mismatch.md`)이 같은 세션에서 방금
만든 것이라는 사실이 반영돼 있지 않다. 둘 다 target 을 되돌릴 필요는 없고 본문에 한두 문장을
더하거나 `spec_impact` 를 넓히는 선에서 해소되는 WARNING 이다.

## 위험도

MEDIUM
