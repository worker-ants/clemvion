# 정식 규약 준수 검토 결과

대상: `spec/data-flow/8-notifications.md` (--impl-prep)

## 발견사항

- **[INFO]** 상태 전이 다이어그램의 `PATCH /:id/read` 와 신규 dismiss 계열 `POST` 동사 혼재가 다이어그램만 보면 비일관으로 보일 수 있음
  - target 위치: §3 상태 전이 mermaid 다이어그램 (108~112행), §4.2 Endpoint 표
  - 위반 규약: 직접 위반 아님 — `spec/5-system/2-api-convention.md §6` (HTTP 상태 코드) 및 코드베이스 관례상 명시적 규정은 없음
  - 상세: 같은 `notification` 리소스에서 읽음 처리는 `PATCH /:id/read`, dismiss 는 `POST /:id/dismiss` 로 동사가 다르다. 그러나 본 문서의 Rationale "Dismiss endpoint 의 HTTP 동사 — `POST /:id/dismiss` 채택" 섹션이 `DELETE`·`PATCH` 대안을 모두 검토하고 `POST` 채택 근거(soft-delete 오인 방지, HTTP DELETE body 호환성, `mark-all-read` 대칭)를 상세히 기록하고 있어 의도된 설계이자 CLAUDE.md 가 요구하는 "결정의 배경·근거는 Rationale" 원칙에 정확히 부합한다. 규약 위반이 아니라 정상적인 예외 문서화 사례.
  - 제안: 현행 유지. 필요시 §4.2 표 상단에 "읽음(PATCH)과 dismiss(POST)의 동사 비대칭은 의도적—Rationale 참조" 각주를 한 줄 추가하면 다이어그램만 훑는 독자의 혼동을 줄일 수 있음 (선택적 INFO).

- **[INFO]** `spec/data-flow/**` frontmatter 부재는 규약과 완전히 부합 (검증됨, 문제 없음)
  - target 위치: 문서 전체 (frontmatter 없음)
  - 위반 규약: 해당 없음 — `spec/conventions/spec-impl-evidence.md §1` 이 `spec/data-flow/**` 를 frontmatter-evidence 가드 대상에서 명시적으로 제외한다고 규정 ("데이터 흐름 다이어그램·엔티티↔플로우 매핑 문서로, 구현 lifecycle 을 추적할 product surface 가 아님").
  - 상세: `spec/data-flow/` 디렉토리의 다른 17개 파일(`0-overview.md` ~ `15-external-interaction.md`)도 모두 frontmatter 가 없어 일관되며, target 문서만의 예외적 이탈이 아니다.
  - 제안: 조치 불필요. (분석 과정에서 확인한 사항이며 문제로 보고하는 것이 아님 — 오탐 방지 차원에서 기록)

## 정합성 확인 (문제 없음으로 확인된 항목)

아래는 상세 대조 결과 규약을 잘 따르고 있는 것으로 확인된 사항이다 (발견사항 아님, 참고용):

1. **문서 구조 규약** — `## Overview`(System role) → 본문 §1~§5(Source→Sink, Schema 매핑, 상태 전이, Dismiss 흐름, 외부 의존) → `## Rationale` 3섹션 구성이 CLAUDE.md·SKILL.md 권장 패턴과 정확히 일치.

2. **API 응답 포맷 규약 (swagger.md §5)** — 단건 dismiss 응답 DTO(`DismissNotificationResponseDto`) 및 일괄 dismiss 응답 DTO(`DismissAllNotificationsResponseDto`) 가 `codebase/backend/src/modules/notifications/dto/responses/*-response.dto.ts` 경로 패턴(swagger.md §5-1)을 정확히 따르며, 컨트롤러가 `ApiOkWrappedResponse(Dto)` 공용 래퍼(swagger.md §5-2)를 사용해 `{ data: <Dto> }` wire shape 를 생성 — spec 서술과 실제 구현이 일치.

3. **동일 shape·별도 클래스 원칙** — `DismissAllNotificationsResponseDto`(`{ affected }`)가 기존 `MarkAllReadResultDto` 와 동일 shape 이지만 의미가 달라 별도 클래스로 분리한 것은 swagger.md 어디에도 금지되지 않고, DTO 파일 JSDoc 주석에도 그 이유가 명시돼 있어 오히려 모범 사례.

4. **에러 코드 명명 규약(error-codes.md)** — 본 문서는 신규 에러 코드를 도입하지 않으며, 기존 규약과 충돌하는 인라인 문자열 코드도 없음.

5. **WebSocket 이벤트 명명** — `notification.new` 점 표기, `notifications:<userId>` 채널 표기가 `spec/5-system/6-websocket-protocol.md §4.4` 권위 표기 및 `WebsocketGateway.VALID_CHANNEL_PREFIXES` 코드와 정확히 일치 (§4.6 follow-up 이벤트명 `notification.read`/`notification.dismissed` 도 동일 prefix 일관성 유지). Rationale 에서 이 표기 결정의 근거(프로토콜 권위·gateway 코드 정합·§4.6 정합)를 상세 기술 — CLAUDE.md 의 "정보 저장 위치 단일 진실 원칙"에 부합.

6. **비-페이징 고정 컬렉션 규약과의 관계** — 본 문서 응답은 페이지네이션 목록이 아닌 단일 객체(`ApiOkWrappedResponse`)이므로 `api-convention §5.2` 비-페이징 컬렉션(`{data:{items}}`) 규약과 무관 — 혼동 소지 없음.

7. **"구현 현황" 병기 방식** — spec 전반에서 "구현됨"/"미구현 (Planned)" 을 타입별·단계별로 명확히 구분해 표기하는 방식이 프로젝트 전역에서 반복 확인되는 패턴(예: `6-websocket-protocol.md`, `spec-impl-evidence.md` 의 `status` lifecycle)과 정신적으로 일치.

## 요약

`spec/data-flow/8-notifications.md` 는 정식 규약(`spec/conventions/**`) 관점에서 CRITICAL·WARNING 수준의 위반이 발견되지 않았다. API 응답 DTO 명명·위치·wrapper 패턴은 `swagger.md` 를 정확히 따르며 실제 구현 코드와도 일치하고, WebSocket 이벤트 명명은 `6-websocket-protocol.md` 권위 표기와 완전히 동기화되어 있다. frontmatter 부재는 `spec-impl-evidence.md §1` 이 `spec/data-flow/**` 전체를 명시적으로 면제하는 규정에 정확히 부합하며 디렉토리 내 다른 파일들과도 일관된다. 유일하게 언급할 만한 것은 상태 전이 다이어그램에서 읽음(PATCH)과 dismiss(POST) 의 HTTP 동사 비대칭인데, 이는 문서 자체의 Rationale 이 대안 검토와 근거를 상세히 기록한 의도된 설계 결정으로 규약 위반이 아니라 오히려 CLAUDE.md 가 요구하는 "결정 배경은 Rationale 섹션" 원칙의 모범 사례다.

## 위험도

NONE
