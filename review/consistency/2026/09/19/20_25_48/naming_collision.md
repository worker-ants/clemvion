# 신규 식별자 충돌 검토 — 웹훅 경로 예약 (`spec/2-navigation/2-trigger-list.md`)

## 점검 범위와 방법

- scope 델타: `spec/2-navigation/2-trigger-list.md` (기존 `endpointPath` 행 2곳에 "다른 워크스페이스가 예약한 경로" 문구 추가 — 신규 식별자를 이 문서 자체가 새로 발행하지는 않고, `spec/1-data-model.md §2.8.1`(선행 커밋 `47f946b94`)이 정의한 개념을 참조·링크만 한다)
- 구현 diff(10개 파일)에서 실제로 신규 발행되는 식별자를 전수 추출해 워킹트리(`git -C <worktree> grep`)로 기존 사용처와 대조:
  - 마이그레이션 `V133__webhook_endpoint_reservation.sql`
  - 엔티티 `WebhookEndpointReservation` / 테이블 `webhook_endpoint_reservation`
  - DB 트리거 `trg_trigger_reserve_endpoint_path` · 함수 `reserve_webhook_endpoint_path()`
  - 라벨(실재 제약 아님) `webhook_endpoint_reservation_owner`
  - 인덱스 `idx_webhook_endpoint_reservation_workspace_id`
  - 신규 e2e 파일 `webhook-endpoint-reservation.e2e-spec.ts`, 신규 테스트 라벨 `B7`/`B8`/`B9`
  - spec 앵커 `1-data-model.md#2.8.1`, `error-handling.md#1.10`(재사용) 등

## 발견사항

없음. 아래는 확인한 후보 중 충돌로 판정하지 않은 항목이다(전부 grep 실측 근거).

- **엔티티/테이블명** — `WebhookEndpointReservation` / `webhook_endpoint_reservation` 는 코드베이스 전체(`grep -rn`)에서 이 PR 이전엔 존재하지 않았고, 다른 엔티티·테이블과 이름이 겹치지 않는다. `app.module.spec.ts` REQUIRED_ENTITIES · `database/root-entities.ts` ROOT_ENTITIES 양쪽에 동반 등재돼 있어 등록 누락도 없다.
- **마이그레이션 파일명/버전** — `V133__webhook_endpoint_reservation.sql` 은 기존 최대 버전 `V132__trigger_endpoint_path_global_unique.sql` 다음 순번이고 중복 V133 파일이 없다(`ls migrations/ | grep V133` → 1건).
- **제약/라벨명** — `webhook_endpoint_reservation_owner` 는 실재 Postgres 제약이 아니라 `RAISE … USING CONSTRAINT` 로 붙이는 합성 라벨이다(코드·spec 양쪽이 이 사실을 명시). 스키마 전체(`grep -rn "CONSTRAINT webhook_endpoint_reservation_owner"`)에 동명의 실재 제약이 없어 `USING CONSTRAINT` 매칭이 다른 대상과 혼동될 여지가 없다.
- **에러 세부 코드 재사용** — `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 신규 식별자가 아니라 기존 코드(`08fbf133d` 부터 존재, `error-handling.md §1.10` SoT)를 예약 충돌에도 그대로 재사용한 것이다. spec·코드 모두 "둘을 구분하지 않는다"를 명시적으로 결정·서술하고 있어(§2.8.1 Rationale, §1.10 본문) 의도된 통합이지 우발적 충돌이 아니다.
- **spec 섹션 앵커** — `spec/1-data-model.md §2.8.1`(신설)은 기존 `§2.8`(Trigger) 아래 첫 하위 절이라 번호 충돌이 없다. `error-handling.md §1.10`은 기존 절을 그대로 확장(신규 앵커 없음).
- **테스트 라벨** — 신규 `B7`/`B8`/`B9`(`webhook-trigger.e2e-spec.ts`)는 기존 `B2`~`B6`(및 그 뒤에 위치한 `B3`)와 겹치지 않는 순번이다.
- **파일 경로 컨벤션** — `webhook-endpoint-reservation.e2e-spec.ts`는 인접한 `trigger-endpoint-path-dedupe.e2e-spec.ts` · `deletion-cascade-indexes.e2e-spec.ts`와 같은 kebab-case `*.e2e-spec.ts` 컨벤션을 따르며 기존 파일과 이름이 겹치지 않는다.
- **도메인 간 동음이의어(참고, 비충돌)** — `spec/conventions/cafe24-api-catalog/order/reservations.md`(Cafe24 "예약 주문" API 미러, entity id `reservations`)가 "Reservation" 이라는 일반 영단어를 공유하지만, 완전한 식별자(`WebhookEndpointReservation`/`webhook_endpoint_reservation` vs `reservations`)도 다르고 spec 영역(1-data-model/2-navigation vs 4-integration cafe24 미러)도 분리돼 있어 혼선 소지가 낮다. CRITICAL/WARNING 대상 아님.

## 요약

이번 델타는 `spec/2-navigation/2-trigger-list.md` 자체가 새 식별자를 발행하는 게 아니라, 선행 커밋에서 이미 도입된 `WebhookEndpointReservation`(엔티티/테이블) · `webhook_endpoint_reservation_owner`(합성 라벨) · V133 마이그레이션 등을 참조·연결하는 수준이다. 구현 diff 까지 포함해 신규 식별자를 전수 추출하고 워킹트리 전체를 대상으로 grep 대조한 결과, 기존 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·파일 경로 어느 축에서도 실제 충돌은 발견되지 않았다. 유일하게 재사용되는 식별자(`TRIGGER_ENDPOINT_PATH_CONFLICT`)는 의도적 통합으로 spec·코드 양쪽에 근거가 명시돼 있다.

## 위험도

NONE
