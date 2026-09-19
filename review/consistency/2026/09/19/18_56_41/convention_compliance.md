# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`

## 검토 대상

`plan/in-progress/spec-draft-webhook-endpoint-reservation.md` (검토 모드: `--spec`, 웹훅 경로 영구 예약 draft).
spec 본문 변경 대상은 `spec/1-data-model.md` · `spec/5-system/12-webhook.md` · `spec/2-navigation/2-trigger-list.md` ·
`spec/5-system/3-error-handling.md` · `spec/data-flow/10-triggers.md` 다섯 곳(§변경 A~E).

## 발견사항

- **[INFO]** DB `RAISE EXCEPTION` 의 합성 "제약 이름" 이 기존 명명 패턴과 다르다
  - target 위치: `## 설계` 다섯째 불릿 — "제약 이름 `webhook_endpoint_reservation_owner`"
  - 위반 규약: 정식 등재된 `spec/conventions/**` 항목은 아니다 — `spec/1-data-model.md` 본문에 **비공식으로 정착한** 명명 관례(`chk_login_history_event` 처럼 CHECK 는 `chk_<table>_<column>`, `idx_integration_workspace_service_mall`·`idx_trigger_endpoint_path` 처럼 인덱스는 `idx_<table>_<cols>`, FK 는 postgres 기본 `<table>_<column>_fkey`)와의 정합
  - 상세: 기존 구현(`codebase/backend/src/modules/triggers/triggers.service.ts`)의 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_endpoint_path'` 는 **실재하는 DB 오브젝트 이름**을 그대로 서비스 코드가 매칭한다. 반면 draft 의 `webhook_endpoint_reservation_owner` 는 실제 UNIQUE/CHECK 제약이 아니라 트리거 함수가 `RAISE EXCEPTION ... USING CONSTRAINT = '...'` 로 **가상으로 부여하는 라벨**로 읽힌다(PK 는 이미 `(endpoint_path)` 하나뿐이라 이 이름의 실제 DB 오브젝트가 없다). 기술적으로는 유효한 패턴이지만, "서비스가 기존 `idx_trigger_endpoint_path` 위반과 함께 위의 409 로 옮긴다" 는 문장이 두 서로 다른 종류의 대상(실재 인덱스 vs 가상 라벨)을 같은 매칭 메커니즘으로 묶는다는 점을 명시하지 않아, 구현 단계에서 "정말 이 이름의 제약을 새로 만들어야 하는가" 라는 오독 여지가 있다.
  - 제안: 구현 절 문장에 "실제 DB 제약이 아니라 트리거가 raise 시 붙이는 논리적 라벨" 임을 한 문장 명시하거나, 아니면 실제로 `webhook_endpoint_reservation` 테이블에 소유자 불일치를 표현하는 이름 있는 제약(예: 트리거 함수 내부 명명 규칙을 `idx_`/`chk_` 계열과 나란히 두는 이름)으로 구체화한다. 정식 규약 자체는 이 층위(RAISE 라벨)를 다루지 않으므로 이는 규약 위반이라기보다 스타일 제안이다.

- **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT` 재사용의 의미 확장이 `error-codes.md` 예외 레지스트리에 등재되지 않음
  - target 위치: `## 설계` 둘째 불릿, `## 변경 D`
  - 위반 규약: `spec/conventions/error-codes.md` §1 "의미 기반 명명" · §3 historical-artifact 레지스트리
  - 상세: draft 는 기존 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`(현재 의미: "동일 `endpointPath` 트리거가 이미 존재")를 "다른 워크스페이스가 예약한 경로" 라는 **새 조건**까지 포괄하도록 넓힌다. `error-codes.md` §1 은 "의미가 분기되거나 새 조건이 생기면 새 코드를 신설한다" 고 원칙을 밝히지만, draft 의 Rationale(§Rationale "응답을 구분하지 않는 이유")이 **정보 노출 방지**를 근거로 의도적으로 코드를 통일했다고 명시적으로 설명하므로, 이는 원칙의 무분별한 위반이 아니라 원칙이 상정하지 않은 예외(보안상 의도적 비구분)에 해당한다. 다만 `error-codes.md` 자신은 이런 "의도적 정보 비공개를 위한 코드 통합" 유형을 별도로 인정하지 않는다(§3 은 "이름이 부정확한" 경우만 다룬다).
  - 제안: 변경 D(`spec/5-system/3-error-handling.md` §1.10)에 "두 조건을 하나의 코드로 묶은 이유(정보 노출 방지)" 를 한 줄 남기면(draft 는 이미 그 문장을 갖고 있으므로 그대로 §1.10 본문에 반영), 나중에 이 카탈로그만 보는 독자가 "왜 세분화하지 않았나" 를 다시 묻지 않는다. `error-codes.md` §3 예외 레지스트리에 신규 행을 추가할 필요는 없다 — 이름 자체가 부정확해진 것은 아니기 때문이다(오히려 "endpointPath 충돌" 이라는 상위 의미를 유지한 채 세부 사유가 늘었을 뿐이다).

## 정합성이 확인된 항목 (참고)

아래는 정식 규약과 충돌 소지가 있어 보였으나 실측 결과 **문제 없음**으로 확인된 지점이다 (오탐 방지용 기록):

- **frontmatter**: `worktree`/`started`/`owner` 3필수 필드([`.claude/docs/plan-lifecycle.md §4`](../../../../../../.claude/docs/plan-lifecycle.md)) 모두 존재. `spec_impact` 5개 경로 전부 실재 파일로 확인(`spec/1-data-model.md`·`spec/5-system/12-webhook.md`·`spec/2-navigation/2-trigger-list.md`·`spec/5-system/3-error-handling.md`·`spec/data-flow/10-triggers.md`) — bare `- none` 리스트 오류 없음.
- **에러 응답 형식**: 409 `RESOURCE_CONFLICT` + `details.code`/`details.field` 조합은 [`5-system/2-api-convention.md §5.3`](../../../../../../spec/5-system/2-api-convention.md) 의 "도메인 세부 사유는 `details` 에 싣는다" 원칙과 기존 `TRIGGER_ENDPOINT_PATH_CONFLICT` 선례를 그대로 따른다.
- **DB 명명**: `webhook_endpoint_reservation`(단수 snake_case) 은 `execution_token`·`llm_config`·`alert_rule` 등 기존 테이블 명명과 일치. `WebhookEndpointReservation`(PascalCase) 은 ER 다이어그램의 엔티티 표기(`IntegrationUsageLog`·`ExecutionToken` 등)와 일치.
- **인용 정확성**: `## 변경` A~E 각 항목이 가리키는 삽입 지점을 실측 대조한 결과 전부 정확했다 — `12-webhook.md` "넷째 불릿"(실제 508~513행 중 4번째, 513행), `2-trigger-list.md` §2 126행·§3 197행, `3-error-handling.md` §1.10(232행, `TRIGGER_ENDPOINT_PATH_CONFLICT` 행 238행), `data-flow/10-triggers.md` "정정 (2026-09-18)" 인용 블록(257~260행), `1-data-model.md` §2.8(239~265행, §2.8.1 슬롯 미사용 확인) 모두 실재.
- **마이그레이션 규약**: 체크리스트의 "V133" 은 확정 값이 아니라 구현 착수 시 `ls migrations | tail -2` 로 재확인해야 할 자리로 남겨 두어 [`spec/conventions/migrations.md §5`](../../../../../../spec/conventions/migrations.md) 절차와 충돌하지 않는다.
- **트래커/선행 plan 인용**: `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` «비대상» 및 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 2026-09-19 등재 항목이 실측상 draft 서술과 정확히 일치.

## 요약

target 문서는 새 spec 파일이나 새 명명 패턴을 창조하지 않고, 기존 `TRIGGER_ENDPOINT_PATH_CONFLICT`/`RESOURCE_CONFLICT` 에러 코드·`details.field`/`details.code` 응답 포맷·PascalCase 엔티티/snake_case 테이블 명명·plan frontmatter 스키마·spec 문서 삽입 지점 인용을 전부 기존 정식 규약과 실제 spec 본문에 대조해 정확히 재사용한다. 유일하게 규약 문서가 다루지 않는 영역은 DB 트리거 함수가 raise 하는 합성 "제약 이름" 의 명명인데, 이는 `spec/conventions/**` 가 규정하지 않는 구현 세부(구현 단계에서 실제 제약인지 논리적 라벨인지만 명확히 하면 충분)이고, 코드 재사용에 대한 의미 확장도 draft 스스로 근거(정보 노출 방지)를 명시하고 있어 규약의 정신을 벗어나지 않는다. 두 발견사항 모두 INFO 등급의 스타일/명료성 제안이며 CRITICAL·WARNING 급 위반은 없다.

## 위험도

LOW
