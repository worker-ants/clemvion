# 정식 규약 준수 검토 — `spec/data-flow/8-notifications.md`

## 발견사항

- **[WARNING]** 읽음/dismiss 액션 endpoint 가 `spec/5-system/2-api-convention.md §12.1` "상태 토글 패턴"과 어긋나며, target 문서가 이 divergence 를 규약과 대조해 명시하지 않음
  - target 위치: §3 상태 전이 다이어그램(`PATCH /notifications/:id/read`, `POST /notifications/mark-all-read`), §4.2 Endpoint 표(`POST /notifications/:id/dismiss`, `POST /notifications/dismiss-all`), Rationale "Dismiss endpoint 의 HTTP 동사" 전체
  - 위반 규약: `spec/5-system/2-api-convention.md §12.1` — "리소스의 상태 필드를 토글(활성/비활성 등)할 때는 전용 엔드포인트를 만들지 않고, **PATCH 본문에 변경할 필드를 포함**하는 방식을 사용한다." 적용 대상 표에 `is_read (Notification)` 이 **명시적으로 열거**되어 있고, "전용 endpoint 불필요 — `POST /:id/activate`, `POST /:id/deactivate` 등의 전용 엔드포인트를 만들지 않음" 이라고 금지 패턴까지 못박혀 있음.
  - 상세: target 문서와 실제 구현(`notifications.controller.ts`: `@Patch(':id/read')`, `@Post('mark-all-read')`, `@Post(':id/dismiss')`, `@Post('dismiss-all')`)은 모두 `PATCH /:id { is_read: true }` 같은 body-toggle 이 아니라 **sub-path 액션 endpoint** 패턴을 쓴다. `is_read` 는 §12.1 표에 Workflow/Trigger/Schedule 의 `is_active`, Node 의 `is_disabled` 와 나란히 "적용 대상" 으로 명시된 Boolean 토글 필드이므로, 표면적으로 §12.1 을 정면으로 벗어난다. target 문서의 Rationale "Dismiss endpoint 의 HTTP 동사"는 `DELETE` vs `POST` vs `PATCH+body` 세 가지를 상세히 비교했지만, **§12.1 자체를 인용하거나 "왜 기존 상태 토글 규약(`PATCH /:id{field}`)이 아니라 sub-path action 을 택했는지"를 그 규약과 짝지어 설명하지 않는다.** `dismissed_at` 은 §12.1 표에 없는 신규 차원이라 그 규약 밖일 수 있으나, 이미 §12.1 이 명시적으로 다루는 `is_read` 의 실제 형태(`PATCH :id/read`)까지 규약과 다른 경로로 굳어져 있다는 사실은 spec 문서가 짚어야 할 지점이다.
  - 제안: 두 가지 중 하나. (a) target 문서(또는 §4.2)에 "`is_read` 는 §12.1 표준 패턴(`PATCH /:id {is_read}`)이 아니라 기존에 `PATCH /:id/read` sub-path 로 정착되어 있다 — historical, §12.1 신규 적용 대상에서 제외/각주 처리" 라는 명시적 각주를 Rationale 에 추가. (b) 또는 `spec/5-system/2-api-convention.md §12.1` 적용 대상 표에서 `is_read (Notification)` 항목에 "실제로는 mark-all-read/`:id/read` 액션 endpoint 로 예외 처리됨" 각주를 남겨 규약과 구현의 divergence를 SoT 쪽에서도 승인. 코드 자체(`PATCH /:id/read` → `PATCH /:id {is_read}`)를 바꾸는 것은 breaking change 범위라 본 검토의 권고사항은 아님 — 문서 정합화만 제안.

- **[INFO]** `POST /notifications/:id/dismiss` 라우트 선언 순서 코멘트가 target 문서에는 없고 코드에만 있음
  - target 위치: §4.2 Endpoint 표
  - 위반 규약: 해당 없음 (직접적 규약 위반은 아님, 다만 `swagger.md` 의 "체크리스트" 취지상 route collision 방지 근거를 spec 에도 남기면 유지보수에 유리)
  - 상세: 코드 `notifications.controller.ts` 의 `dismiss-all` 은 `:id/dismiss` 보다 먼저 선언돼야 라우팅 충돌을 피한다는 주석이 있으나, target 문서 §4.2 표에는 이 순서 의존성 힌트가 없다.
  - 제안: 필수는 아니나, §4.2 표 근처에 "라우트 등록 순서: `dismiss-all` 이 `:id/dismiss` 보다 선행해야 함" 한 줄 추가하면 향후 리팩터 시 회귀 방지에 도움.

## 요약

`spec/data-flow/8-notifications.md` 는 명명 규약(마이그레이션 V번호 V001/V002/V010/V052/V055/V056/V070 전부 실제 파일과 일치), WebSocket 이벤트 표기(`notification.new`, `notifications:{userId}`, payload shape 이 `spec/5-system/6-websocket-protocol.md §4.4` 와 정확히 일치), 응답 DTO 규약(`swagger.md §5-1/§5-2` 의 `dto/responses/*-response.dto.ts` 위치·`ApiOkWrappedResponse` 래퍼 사용), 문서 3섹션 구조(Overview/본문/Rationale), `spec/1-data-model.md §2.19` 필드 정합 등 대부분의 정식 규약을 충실히 준수한다. 다만 알림 읽음/dismiss endpoint 가 `spec/5-system/2-api-convention.md §12.1` "상태 토글은 PATCH body, 전용 endpoint 금지" 규약과 형태상 어긋나는 기존 구현(`PATCH :id/read`, `POST mark-all-read`, `POST :id/dismiss`)을 그대로 반영하면서도, 그 규약과의 관계를 spec 본문(Rationale)이 짚지 않은 점이 유일한 WARNING 이다. 이는 신규 위반이 아니라 기존부터 존재하던 divergence이므로 시급한 차단 사유는 아니되, 규약 문서와 spec 사이의 표류를 방치하지 않으려면 각주 형태로 명시적으로 흡수해두는 것이 바람직하다.

## 위험도

LOW
