# 신규 식별자 충돌 검토 — `spec/2-navigation/` (--impl-prep)

## 검토 범위와 방법

검토 모드는 `--impl-prep`(scope=`spec/2-navigation/`) — 구현(웹훅 경로 영구 예약, `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`)
착수 직전 스코프 검토다. 이 스코프에서 실제로 diff 가 난 파일은 `spec/2-navigation/2-trigger-list.md` 하나이며
(`git show c8dd613e0 -- spec/2-navigation/2-trigger-list.md` 로 확인), 변경 내용은 §2.3.1 `endpointPath` 행과 §3 PATCH 註
두 곳에 "다른 워크스페이스가 예약한 경로" 문구와 `[데이터 모델 §2.8.1](../1-data-model.md#281-webhookendpointreservation)` 링크를
추가한 것뿐이다. 즉 `spec/2-navigation/` 자체는 **새 식별자를 도입하지 않고**, 같은 커밋에서 `spec/1-data-model.md` 에 신설된
`WebhookEndpointReservation` 을 참조만 한다.

따라서 검토는 두 층으로 나눴다:

1. `spec/2-navigation/2-trigger-list.md` 가 참조하는 대상(`WebhookEndpointReservation` / `§2.8.1` / 앵커)이 실제로 존재하고,
   그 존재가 저장소 다른 곳의 동명 식별자와 부딪히지 않는가.
2. 이 스코프의 구현 착수가 곧 건드릴 코드 식별자(엔티티명·테이블명·DB 트리거명·제약 라벨·마이그레이션 번호)가 기존 코드베이스와
   충돌하지 않는가 — `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` §변경/구현계획에 적힌 식별자를 전수 grep.

이전 `--spec` 단계 검토(`review/consistency/2026/09/19/18_56_41/naming_collision.md`, 위험도 NONE)가 이미 같은 신규
식별자 집합을 대조했다. 본 검토는 그 이후 실제로 반영된 spec 커밋(`c8dd613e0`) 기준으로 같은 대조를 재확인하고, 그때 남았던
INFO(트리거 이름 미지정)가 해소됐는지 추가로 본다.

## 대조표

| 신규/참조 식별자 | 종류 | grep 결과 |
|---|---|---|
| `WebhookEndpointReservation` | 엔티티(TypeORM, 아직 코드 없음) | `spec/1-data-model.md`(신설 §2.8.1) · `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` · `spec/2-navigation/2-trigger-list.md`(참조)만 매치. `codebase/backend/src/database/root-entities.ts` 등 기존 엔티티 목록에 동명 클래스 없음. `codebase/backend/src` · `codebase/frontend/src` 전체에서 `Reservation` 매치는 cafe24 order 도메인(`metadata/store.ts`) 하나뿐이고 의미 무관 |
| `webhook_endpoint_reservation` (테이블) | DB 테이블 | 기존 migrations(`V001`~`V132`)·엔티티에 동명 테이블 없음 |
| `§2.8.1` (data-model.md 신설 절, anchor `#281-webhookendpointreservation`) | 문서 섹션 번호 | `### 2.8 Trigger` 다음이 `### 2.9 Schedule` 이던 빈 슬롯에 삽입 — 기존 `2.8.1` 헤딩 없었음. 저장소 전역에서 이 앵커를 참조하는 곳은 이번에 함께 갱신된 `spec/2-navigation/2-trigger-list.md`(2곳) · `spec/5-system/12-webhook.md` · `spec/5-system/3-error-handling.md`(2곳) · `spec/data-flow/10-triggers.md`(2곳) 뿐, 다른 의미로 쓰던 기존 참조 없음 |
| `trg_trigger_reserve_endpoint_path` (DB 트리거명) | DB object | `V001__initial_schema.sql` 의 `trg_<table>_updated_at` 계열(`trg_trigger_updated_at` 등) 및 `V081__rerank_config.sql` 의 `trg_rerank_config_updated_at` 과 문자열 겹침 없음. 이전 --spec 검토의 INFO("트리거 이름 미지정")가 이번 반영에서 명시적으로 해소됨(`spec/1-data-model.md:287`, `plan/.../spec-draft-webhook-endpoint-reservation.md:50` 모두 "V001 의 `trg_trigger_updated_at` 과 별개"를 명시) |
| `webhook_endpoint_reservation_owner` (제약 라벨, `RAISE … USING CONSTRAINT`) | 라벨(실제 named constraint 아님) | 기존 migrations 의 `_owner` 계열 식별자(`tool_owner_id`, `uq_workflow_test_dataset_owner_name`, `uq_workspace_personal_owner`)와 문자열 겹침 없음. spec·plan 이 "실재 제약이 아니라 라벨"임을 스스로 명시해 독자가 실제 pg_constraint 항목으로 오인할 위험을 이미 차단 |
| `reserved_at` (컬럼명) | 컬럼 | 저장소 전역 grep 0건(신규) |
| `V133` (마이그레이션 번호) | migration version | `codebase/backend/migrations/` 최신은 `V132__trigger_endpoint_path_global_unique.sql` — `V133*` 파일 없음. 다른 `plan/in-progress/*.md` 어디에도 V133 을 예약하는 언급 없음(grep 결과 `spec-draft-webhook-endpoint-reservation.md` 자기 자신만). 번호 경합은 `migrations.spec.ts` · `scripts/check-migration-versions.py` · `check-duplicate-versions.sh` 3중 가드가 빌드/CI 시점에 잡는 영역이라 별도 조정 불요 |
| `TRIGGER_ENDPOINT_PATH_CONFLICT` (재사용, 신규 아님) | 에러 세부 코드 | `spec/5-system/3-error-handling.md:238` 기존 코드의 **의미 확장**(같은 코드가 "동시 중복"과 "예약 위반" 둘 다 커버) — 새 코드를 만들지 않기로 한 것이 설계 의도(응답 구분 안 함)이므로 충돌 아님 |
| `isEndpointPathUniqueViolation` / `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` / `rethrowEndpointPathConflict` (기존 코드 식별자) | 함수/상수 | `codebase/backend/src/modules/triggers/triggers.service.ts:228,237,1654` 에 이미 존재 — 구현 계획은 이름을 바꾸지 않고 `isEndpointPathUniqueViolation` 이 `idx_trigger_endpoint_path` 와 `webhook_endpoint_reservation_owner` 두 제약명을 함께 인식하도록 **내부 로직만 확장**한다. 이름 재사용에 의한 충돌 없음 |
| 신규 엔티티/서비스 파일 경로(예상) | 파일 경로 | `codebase/backend/src/modules/triggers/entities/*reservation*` · `codebase/backend/**/*webhook-endpoint*` grep 0건 — 착수 시 새로 만들 파일이 기존 파일과 겹치지 않음 |

## 발견사항

CRITICAL/WARNING 없음.

- **[INFO]** `spec/1-data-model.md` Rationale 이 아직 이동하지 않은 plan 경로를 기정사실처럼 인용
  - target 신규 식별자: 해당 사항 아님 — 식별자 자체의 충돌은 아니고, **경로 참조의 시점 불일치**
  - 기존 사용처: `spec/1-data-model.md:1049` `근거·실측: `plan/complete/spec-draft-webhook-endpoint-reservation.md`, 구현은 V133.` — 그러나 실제 파일은 아직 `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 에 있고(체크리스트의 "구현" · "트래커 해소 · `plan/complete/` 로" 두 항목이 미완료), `plan/complete/spec-draft-webhook-endpoint-reservation.md` 는 저장소에 존재하지 않는다
  - 상세: 같은 문서의 다른 Rationale 항목들(`plan/complete/spec-draft-code-guards-and-change-summary.md` 등, `1-data-model.md:1063,1080,1122,1187,1223,1277,1310`)은 전부 **이미 구현이 끝나 실제로 `plan/complete/` 에 있는** 파일을 인용한다. 이번 항목만 구현 전(V133 미작성) 단계에서 같은 패턴으로 미래 경로를 인용해, 지금 이 링크를 따라가면 404 다. "같은 PR 안에서 developer 가 구현+이동을 함께 한다"는 전제라면 PR 완료 시점엔 참이 되므로 이름 충돌은 아니지만, PR 완료 전에 이 문서만 단독으로 읽는 사람(또는 이 --impl-prep 리뷰 시점) 기준으로는 존재하지 않는 경로를 가리킨다. 이 항목은 파일 경로 "충돌"이 아니라 "시점 선반영"이라 본 checker 의 핵심 관점(신규 식별자 vs 기존 사용처의 의미 충돌)과는 결이 다르며, plan 라이프사이클 정합성은 `plan_coherence`/`rationale_continuity` checker 의 영역과 더 가깝다. 참고로만 남긴다
  - 제안: 차단 사유 아님. developer 가 이번 PR 에서 실제로 draft 를 `plan/complete/` 로 옮기면 자동으로 해소된다 — 별도 조치 불요, 이동을 빠뜨리지 않는지만 마무리 체크리스트에서 확인

## 상세 대조 결과 (충돌 없음 확인)

1. **요구사항 ID 충돌** — `spec/2-navigation/` 스코프는 새 요구사항 ID(NAV-\*, WH-\* 등)를 신설하지 않는다. 유일한 관련 ID 인 `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 기존 코드를 재사용할 뿐 새 ID 를 부여하지 않는다.
2. **엔티티/타입명 충돌** — `spec/2-navigation/2-trigger-list.md` 는 `WebhookEndpointReservation` 을 정의하지 않고 참조만 한다. 그 정의처(`spec/1-data-model.md §2.8.1`)와 이름 자체는 저장소 전역에서 매치 0건(위 대조표)이라 충돌 없음. `TriggerDto` · `ScheduleDto` 등 기존 DTO 명과도 겹치지 않는다.
3. **API endpoint 충돌** — 이번 변경은 새 endpoint 를 만들지 않는다. 기존 `PATCH /api/triggers/:id` 409 응답의 **트리거 조건만** 넓힌다(같은 endpoint, 같은 status/code).
4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트를 신설하지 않는다.
5. **환경변수·설정키 충돌** — 새 ENV var·config key 없음.
6. **파일 경로 충돌** — `spec/2-navigation/` 내 새 파일 신설 없음(기존 `2-trigger-list.md` 수정만). 구현 예정 코드 경로(엔티티·마이그레이션)도 기존 파일과 겹치지 않음(위 대조표 마지막 행). 위 INFO 는 "겹침"이 아니라 "아직 존재하지 않는 경로를 가리키는 선반영"이라 이 항목의 핵심 충돌 유형과는 다르다.

## 요약

`spec/2-navigation/` 스코프에서 이번 구현(웹훅 경로 영구 예약)이 실제로 도입하는 새 식별자는 없다 — `2-trigger-list.md` 는 같은 커밋에서 `spec/1-data-model.md` 에 신설된 `WebhookEndpointReservation`/`§2.8.1` 을 참조만 하며, 그 신규 식별자들(엔티티·테이블·DB 트리거명·제약 라벨·컬럼·마이그레이션 번호 V133)은 저장소 전역 grep 에서 기존 사용처와 매치 0건이다. 이전 `--spec` 검토에서 남았던 유일한 INFO(DB 트리거 이름 미지정)는 이번 반영에서 `trg_trigger_reserve_endpoint_path` 로 명시돼 해소됐다. 재사용하는 유일한 기존 식별자(`TRIGGER_ENDPOINT_PATH_CONFLICT`, `isEndpointPathUniqueViolation` 등)도 의미 확장이지 다른 뜻과의 충돌이 아니다. `spec/1-data-model.md` Rationale 이 아직 이동 전인 plan 경로를 미리 인용하는 시점 불일치 1건을 참고용 INFO 로만 남기며, 이는 신규 식별자 충돌이 아니라 plan 라이프사이클 정합성 영역이라 차단 사유가 아니다.

## 위험도

NONE
