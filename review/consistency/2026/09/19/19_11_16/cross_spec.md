# Cross-Spec 일관성 검토 — `spec/2-navigation/` (--impl-prep, 웹훅 경로 영구 예약)

검토 대상: `spec/2-navigation/2-trigger-list.md` 를 중심으로, 착수 예정 기능인 **웹훅 엔드포인트 경로 영구 예약**
(`WebhookEndpointReservation`, `spec/1-data-model.md §2.8.1`)이 이미 반영된 spec 5개 파일(`spec/1-data-model.md` ·
`spec/5-system/12-webhook.md` · `spec/5-system/3-error-handling.md` · `spec/data-flow/10-triggers.md` ·
`spec/2-navigation/2-trigger-list.md`) 사이의 정합성, 그리고 이 문서가 참조하는 인접 영역
(`spec/5-system/1-auth.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`,
`spec/7-channel-web-chat/5-admin-console.md`)과의 충돌 여부를 확인했다.

## 발견사항

이 변경으로 인한 CRITICAL/WARNING 급 cross-spec 충돌은 발견하지 못했다. 확인한 교차점은 다음과 같이 전부 정합했다.

- **에러 코드 계약 일치**: `2-trigger-list.md` §2.3.1 `endpointPath` 행과 §3 PATCH 주석의 "다른 워크스페이스가 예약한 경로 …
  409 `RESOURCE_CONFLICT` / `TRIGGER_ENDPOINT_PATH_CONFLICT`" 문구가 `spec/5-system/3-error-handling.md` §1.10 의 코드 설명,
  `spec/1-data-model.md` §2.8.1 의 강제 규칙, `spec/5-system/12-webhook.md` "endpointPath 가변성" 절과 단어 단위로 동일하다.
  세 문서 모두 "예약됨/살아있는 트리거와 겹침을 구분하지 않는다"는 응답 비구분 정책까지 일치시켰다.
- **데이터 모델 SoT 일관**: `spec/1-data-model.md` §2.8.1 의 필드(`endpoint_path` PK · `workspace_id` FK SET NULL ·
  `reserved_at`)·인덱스(§3 표)·ER 다이어그램(§1, `WebhookEndpointReservation (1:N, … 지우지 않음, §2.8.1)`)이
  `spec/data-flow/10-triggers.md` §2.1 Postgres 표의 `webhook_endpoint_reservation` 행과 동일한 사실(트리거 `BEFORE
  INSERT OR UPDATE`, `ON CONFLICT DO NOTHING`, 라벨 `webhook_endpoint_reservation_owner`)을 중복 서술 없이 포인터로
  연결한다.
- **삭제 cascade 서술과 상충 없음**: `2-trigger-list.md` §4.3 cascade 표는 트리거 삭제의 하류 영향을 나열하지만
  `WebhookEndpointReservation` 을 언급하지 않는다 — 이는 누락이 아니라 설계와 부합한다. §2.8.1 은 "트리거 행을 지우는
  경로는 건드리지 않는다"(예약은 생성·경로변경 시점에만 쓰이고 삭제로 지워지지 않음)고 명시하므로, 삭제가 예약에 미치는
  "효과"는 애초에 없다. §4.3 도입부("이 표는 하류 영향과 상류 원인을 함께 담는다")의 범위와 어긋나지 않는다.
- **웹챗 콘솔과의 정합**: `spec/7-channel-web-chat/5-admin-console.md` 의 인스턴스 삭제 서술("삭제 시 설치된 위젯이 동작을
  멈춘다 — 공개 webhook path 소멸")과 endpointPath 생성 규약 위임("기존 webhook 트리거 생성 규약을 그대로 따른다")은 영구
  예약 도입 이후에도 그대로 성립한다 — 삭제된 인스턴스의 옛 경로가 다른 워크스페이스에 의해 가로채이지 못하게 막는 것이
  바로 이번 기능의 목적이며, 콘솔 스펙은 이를 바꿀 필요가 없다(실제로 plan 설계 절이 이 케이스를 "왜" 섹션에서 직접
  언급하며 웹챗을 "더 넓게 아는 사람" 사례로 인용한다).
- **RBAC/권한 모델과 무관**: 예약 강제는 DB 트리거(`trg_trigger_reserve_endpoint_path`) 층에서 이루어지고, 기존
  Trigger CRUD 역할 매트리스(`editor`+ 생성/수정, `spec/5-system/1-auth.md` §3.2)나 AuthConfig RBAC(§3.2 표,
  `2-trigger-list.md` §2.3.1 Auth Config 행의 "Admin+ 전용" 서술)에 변경을 요구하지 않는다. "예약 해제" 운영 기능은
  명시적으로 비대상(plan `## 비대상`)이라 새 권한 계층도 생기지 않는다.
- **앵커 무결성**: 신설 문서 전반에서 반복 사용되는 상호 참조 앵커 `../1-data-model.md#281-webhookendpointreservation`
  은 실제 헤딩 `### 2.8.1 WebhookEndpointReservation` 의 GitHub 스타일 슬러그(`281-webhookendpointreservation`)와
  일치한다 — 깨진 링크 없음.

## 요약

착수 예정인 "웹훅 경로 영구 예약" 기능은 이미 `spec/1-data-model.md`(§2.8.1 신설) · `spec/5-system/12-webhook.md` ·
`spec/5-system/3-error-handling.md`(§1.10) · `spec/data-flow/10-triggers.md`(§2.1, Rationale) · 대상 문서
`spec/2-navigation/2-trigger-list.md`(§2.3.1, §3) 다섯 곳에 동일한 에러 코드·필드·정책 문구로 정합되게 반영돼 있으며,
직전 `--spec` 게이트(BLOCK:NO, WARNING 1건은 이미 설계에 반영됨)를 통과한 상태다. 이번 cross-spec 재검토에서도 데이터
모델·API 계약·삭제 cascade 서술·RBAC·인접 도메인(웹챗 콘솔) 어느 축에서도 새로운 모순을 찾지 못했다. `2-trigger-list.md`
번들에 포함된 다른 절(§2.1 Chat Channel/EIA 참조, R-1~R-17, §2.3.1 필드 권한 매트릭스)도 각각의 SoT(EIA §7, Chat Channel
§4~§5, auth §3.2)와 인용이 정확히 맞물려 있어 이번 변경이 그 영역들의 기존 결정을 흔들지 않는다.

## 위험도

NONE
