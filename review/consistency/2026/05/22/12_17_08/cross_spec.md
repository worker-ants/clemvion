# Cross-Spec 일관성 검토 결과

검토 모드: --impl-prep  
검토 대상: `spec/2-navigation/` (전 파일)  
검토 기준 spec: `spec/1-data-model.md`, `spec/5-system/1-auth.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/14-external-interaction-api.md`, `spec/data-flow/10-triggers.md`

---

## 발견사항

### 1. **[WARNING]** Trigger `name` 필드 — 워크스페이스 내 유일성·길이 제약이 데이터 모델에 없음

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스 — Overview 카드, `name` 행: "1~120 자, 워크스페이스 내 unique 강제는 백엔드 (충돌 시 409)"
- **충돌 대상**: `spec/1-data-model.md` §2.8 Trigger 테이블 정의 및 §3 인덱스 전략
- **상세**: 데이터 모델은 Trigger.name 을 `String` (길이 무지정) 으로 정의하며, `(workspace_id, name) UNIQUE` 인덱스가 존재하지 않는다. Integration 등 다른 엔티티에는 `(workspace_id, name) UNIQUE` 가 명시되어 있으나 Trigger 에는 없다. 구현 시 이 제약이 DB 에 없으면 409 응답이 발화되지 않으며, 반대로 DB 에 추가하면 기존 데이터에 중복이 있을 경우 마이그레이션이 실패할 수 있다.
- **제안**: `spec/1-data-model.md` §2.8 Trigger 테이블에 `name VARCHAR(120)` 길이 제약과 `(workspace_id, name) UNIQUE` 인덱스를 §3 인덱스 전략 테이블에 추가하거나, target spec 에서 해당 uniqueness 주장을 제거·약화한다.

---

### 2. **[WARNING]** v1.1 예약 endpoint 경로 `/auth/rotate-secret` 가 API 규약의 sub-channel 패턴과 불일치

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §3 API 표, `POST /api/triggers/:id/auth/rotate-secret` — v1.1 예약, 경로명 TBD 명시
- **충돌 대상**: `spec/5-system/2-api-convention.md` §2.2 URL 구조 — RPC-style sub-channel action 예외 열거: `notification/rotate-secret`, `interaction/revoke-token`, `chat-channel/rotate-bot-token`
- **상세**: API 규약은 RPC-style sub-channel 예외를 `{channel}/{action}` 형태로 허용하며 예시 채널로 `notification`, `interaction`, `chat-channel` 을 열거한다. Target spec 이 제안하는 `/auth/rotate-secret` 의 채널 세그먼트 `auth` 는 이 열거에 없다. TBD 로 표기되어 있고 별 plan 에 확정을 위임했으나, 확정 전에 `/webhook-auth/rotate-secret` 등 다른 후보 경로와 비교해 API 규약 §2.2 를 먼저 업데이트해야 한다. EIA spec 이 이미 사용하는 `/notification/rotate-secret` 패턴과 일관성을 갖추는 것이 권장된다.
- **제안**: plan/in-progress/eia-secret-rotation-revoke-api.md 에서 경로를 확정할 때 API 규약 §2.2 채널 목록에 해당 채널 세그먼트를 명시적으로 추가한다.

---

### 3. **[INFO]** `TRIGGER_ENDPOINT_PATH_CONFLICT` 세부 코드 표기 방식이 에러 응답 형식과 불일치

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §3 PATCH /api/triggers/:id 주석: "409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)"
- **충돌 대상**: `spec/5-system/3-error-handling.md` §2.1 기본 형식, `spec/5-system/2-api-convention.md` §5.3 에러 응답
- **상세**: 에러 응답 표준 형식은 `error.code` (최상위 에러 코드) + `error.details[]` (배열, 각 항목에 `field`, `message`, `code`) 구조다. Target spec 은 "세부 코드" 라는 별도 레벨을 언급하는데, 이것이 `error.code` 를 `TRIGGER_ENDPOINT_PATH_CONFLICT` 로 교체하는 것인지, 아니면 `error.details[0].code` 에 넣는 것인지 명확하지 않다. 다른 spec 에서 이 패턴이 사용된 사례가 없어 구현자가 혼동할 수 있다.
- **제안**: Target spec §3 주석을 에러 형식에 맞게 수정한다. 예: 최상위 `error.code = 'RESOURCE_CONFLICT'`, `error.details = [{ field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT', message: '...' }]` 로 명시.

---

### 4. **[INFO]** Dashboard recent executions 의 Trigger 출처 분류 정의 중복

- **target 위치**: `spec/2-navigation/0-dashboard.md` §5 최근 실행 이력 — Trigger 열: "분류 규칙·보조 라벨 정책은 [실행 내역 spec §2.4 Trigger 출처 분류](./14-execution-history.md#trigger-출처-분류) 참조"
- **충돌 대상**: `spec/2-navigation/14-execution-history.md` §2.4 Trigger 출처 분류
- **상세**: 대시보드 spec 은 분류 규칙을 실행 내역 spec 으로 위임해 단일 정의를 유지하고 있다. 충돌은 없으나, `spec/2-navigation/0-dashboard.md` §5 테이블에 `subworkflow` 출처가 누락되어 있다 (`subworkflow`/`manual`/`schedule`/`webhook`/`unknown` 으로 나열하면서 화면 UI 에서는 `subworkflow` 아이콘 라벨이 표시되지 않음). Dashboard 화면이 `parent_execution_id` 기반 서브워크플로우 출처를 표시할지 여부가 불명확하다.
- **제안**: `spec/2-navigation/0-dashboard.md` §5 Trigger 열 설명에 `subworkflow` 포함 여부를 명시하거나, "실행 내역 spec 의 5가지 출처 모두 동일하게 표시" 를 명기한다.

---

### 5. **[INFO]** Schedule 삭제 cascade 다이얼로그 텍스트와 `spec/2-navigation/3-schedule.md` 설명 중복

- **target 위치**: `spec/2-navigation/2-trigger-list.md` §4.2 확인 다이얼로그 — schedule 타입 본문 텍스트: "연결된 스케줄도 함께 삭제됩니다 (스케줄 ID `{scheduleId}`). 다음 실행 예정 시각: `{nextRunAt}`."
- **충돌 대상**: `spec/2-navigation/3-schedule.md` §3 Trigger 자동 생성 규칙 — "Schedule 삭제: 연결된 Trigger cascade 삭제 (확인 다이얼로그에 '연결된 트리거도 함께 삭제됩니다' 안내)"
- **상세**: 충돌은 아니나 동일 동작(Trigger 삭제 시 Schedule cascade)의 UI 텍스트가 두 spec 에 각자 서술되어 있다. 3-schedule.md 는 "연결된 트리거도 함께 삭제됩니다" (Schedule 화면에서 삭제), 2-trigger-list.md 는 "연결된 스케줄도 함께 삭제됩니다" (Trigger 화면에서 삭제) 로 방향이 다르므로 실제 충돌은 없지만, 두 화면의 확인 다이얼로그 텍스트가 서로 다른 spec 에 분산되어 동기화 누락 위험이 있다.
- **제안**: i18n 키(`triggers.delete.confirm.schedule`, `schedules.delete.confirm`) 를 단일 장소에 모아두는 별도 i18n spec 이나 convention 을 도입하거나, 각 spec 이 상대 spec 을 명시적으로 참조하도록 관계 주석을 추가한다.

---

## 요약

`spec/2-navigation/` 전 파일은 대체로 다른 영역 spec 과 일관성이 높다. Trigger-Schedule 동기화 규칙, cascade 방향, RBAC 권한 매트릭스, audit log 액션 명명, API 응답 형식, 실행 출처 분류 등은 데이터 모델·인증·API 규약·데이터 플로우 spec 과 모순 없이 정렬되어 있다. 가장 주의해야 할 항목은 **[WARNING 1]** 로, `2-trigger-list.md §2.3.1` 이 도입하는 Trigger name 의 워크스페이스 내 유일성·길이 제약이 `spec/1-data-model.md` 에 반영되어 있지 않아 마이그레이션 단계에서 실제 충돌이 발생할 수 있다. **[WARNING 2]** 의 v1.1 예약 endpoint 경로 문제는 plan 단계에서 해결될 예정이나 API 규약 §2.2 업데이트가 선행되어야 한다. INFO 항목들은 명명 비일관성 및 동기화 권장 사항으로 구현 차단 수준은 아니다.

## 위험도

MEDIUM
