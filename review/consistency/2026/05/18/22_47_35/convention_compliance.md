# 정식 규약 준수 검토 — `spec/data-flow/8-notifications.md`

## 발견사항

- **[INFO]** 문서 구조: Overview 섹션이 최상위 `## Overview` 로 존재하나 Rationale 이 문서 말미에 배치되어 권장 3섹션(Overview / 본문 / Rationale) 구성을 준수함. 위반 없음.

- **[INFO]** 파일명 규약: `spec/data-flow/8-notifications.md` — `N-name.md` 숫자 prefix 패턴(CLAUDE.md 명명 컨벤션 표) 준수. 위반 없음.

- **[INFO]** DTO 명명 위치(swagger.md §5-1): spec 본문 §4.2 에서 dismiss DTO 경로를
  - `dto/responses/dismiss-notification-response.dto.ts` (`DismissNotificationResponseDto`)
  - `dto/responses/dismiss-all-notifications-response.dto.ts` (`DismissAllNotificationsResponseDto`)
  로 명시. `codebase/backend/src/modules/notifications/dto/responses/` 하위로 정확히 기술되어 있어 `spec/conventions/swagger.md §5-1` 패턴과 일치함.

- **[INFO]** 래퍼 헬퍼 명칭: spec §4.2 에서 `ApiOkWrappedResponse(DismissNotificationResponseDto)` / `ApiOkWrappedResponse(DismissAllNotificationsResponseDto)` 를 명시. `spec/conventions/swagger.md §5-2` 의 `ApiOkWrappedResponse(Dto)` 헬퍼와 정확히 일치.

- **[INFO]** DTO shape 기술: 일괄 dismiss 응답 `{ affected: number }` 에 대해 "기존 `MarkAllReadResultDto` 와 동일 shape 이라도 의미가 다르므로 별도 클래스로 분리" 라고 명시. swagger.md §5-1 의 "비밀값 마스킹" / "별도 DTO 생성" 정신에 부합하며, `PickType` 재사용 가능성도 §5-1 을 인용해 언급함.

- **[INFO]** WebSocket 이벤트 표기(§Rationale "WebSocket emit 표기 정정"): 본 개정으로 `notification:new` → `notification.new`, `user:<userId>` → `notifications:<userId>` 로 정정한다는 근거가 Rationale 에 명시되어 있으며, `spec/5-system/6-websocket-protocol.md §4.4` 를 권위 문서로 참조함. 본 문서 자체는 정정 후 점 표기(`notification.new`)와 올바른 채널명(`notifications:<userId>`)을 §1·§2.2 에서 사용하고 있어 규약(참조 spec 의 정식 채널 prefix 와 gateway 코드) 과 일치함.

- **[WARNING]** `§3` 상태 전이 다이어그램에서 endpoint 경로 표기 혼용 가능성
  - target 위치: `## 3. 상태 전이` mermaid 다이어그램 내 `PATCH /notifications/:id/read`
  - 위반 규약: `spec/conventions/swagger.md §2-4` (상태 코드 응답 규칙) 및 Rationale §"옛 spec 의 `PATCH /notifications/read-all` 표기 정정"
  - 상세: 다이어그램은 `PATCH /notifications/:id/read` 와 `POST /notifications/mark-all-read` 를 나란히 표기한다. 단건 읽음 처리가 `PATCH` 임은 스펙에서 허용된 것으로 보이나, 동사 정책(POST 액션 endpoint vs PATCH 상태 변경)이 W-48 미결 상태라고 Rationale 에서도 언급함. 이 혼용이 spec 자체의 의도적 결정임을 본문에서 명확히 서술하지 않아 독자 혼선이 가능함.
  - 제안: `## 3` 상태 전이 다이어그램 바로 아래 또는 §4.2 에 "단건 읽음 처리 `PATCH /notifications/:id/read` 는 W-48 미결 단계에서 현 코드 구현을 따른 것이며, W-48 종결 후 일괄 검토 대상" 임을 한 줄로 명시하면 충분히 해소됨. 규약 자체 갱신은 불필요(W-48 issue 로 관리 중).

- **[WARNING]** `hasRecentByResource` 헬퍼 내 `title` 파라미터가 중복 방지 key 에 포함
  - target 위치: `## 4.4` 및 `## Rationale "중복 방지에 dismissed row 포함"` — `hasRecentByResource(workspaceId, type, resourceId, title, withinMs)` signature
  - 위반 규약: `spec/conventions/swagger.md` 직접 위반은 아니나, 데이터 모델 정합성 측면. spec 본문에서 `(workspace, type, resourceId, title)` 4-tuple 로 중복 방지를 하는데, `title` 을 key 에 포함하면 동일 사건이지만 title 이 변경된 경우 24h 가드가 우회됨. 이 설계 결정이 규약 레벨의 문서에서 공식화된 것은 없으며 data-flow spec 에서만 언급됨.
  - 상세: title 을 key 에 포함하는 이유가 spec 어디에도 서술되어 있지 않다. `(workspaceId, type, resourceId)` 3-tuple 로 충분할 수 있으며, title 변경 시 guard 우회라는 사이드 이펙트가 발생한다는 위험이 있다.
  - 제안: Rationale 에 "title 을 중복 방지 key 에 포함한 이유" 항목을 추가하거나, title 을 key 에서 제외하는 방향으로 헬퍼 signature 를 재검토. spec 규약 수준의 변경은 아니지만, 현재 Rationale 에 언급이 없어 누락 의심.

## 요약

`spec/data-flow/8-notifications.md` 는 정식 규약(`spec/conventions/swagger.md`, CLAUDE.md 명명 컨벤션) 에 대체로 충실하다. 파일명 prefix 패턴, 권장 3섹션(Overview / 본문 / Rationale), DTO 경로 패턴, 공용 래퍼 헬퍼(`ApiOkWrappedResponse`) 사용, WebSocket 이벤트 표기 정정까지 모두 규약과 일치한다. WARNING 두 건은 규약 직접 위반보다는 설계 근거의 서술 누락과 잠재적 사이드 이펙트 미명시에 해당한다. CRITICAL 위반은 없다.

## 위험도

LOW
