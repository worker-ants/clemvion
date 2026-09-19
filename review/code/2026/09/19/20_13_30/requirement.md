# 요구사항(Requirement) 충족 리뷰 — 웹훅 경로 영구 예약 (V133, 2라운드)

## 검토 방법

`plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 를 설계 SoT 로, `spec/1-data-model.md` §2.8.1 · `## Rationale`
«지운 · 바꾼 웹훅 경로의 영구 예약» · `spec/5-system/3-error-handling.md` §1.10 · `spec/2-navigation/2-trigger-list.md` §2·§3 ·
`spec/5-system/12-webhook.md` «endpointPath 가변성» · `spec/data-flow/10-triggers.md` §2.1 을 계약 SoT 로 삼아, 실제 코드
(`V133__webhook_endpoint_reservation.sql`, `webhook-endpoint-reservation.entity.ts`, `triggers.service.ts`,
`triggers.controller.ts`, `triggers.service.spec.ts`, `webhook-endpoint-reservation.e2e-spec.ts`,
`webhook-trigger.e2e-spec.ts` B7~B9, `deletion-cascade-indexes.e2e-spec.ts`, `root-entities.ts`/`app.module.spec.ts`)를
Read/Grep 으로 직접 열어 line-level 로 대조했다. 이 diff 는 이미 1라운드 코드 리뷰(`review/code/2026/09/19/19_44_33`,
Critical 0·Warning 2)와 3라운드 consistency check(18:56/19:11/19:21, 전부 BLOCK:NO)를 거쳐 Warning 2건이 후속 커밋
(`a4a4791a7`)으로 해소된 상태이며, 이번 2라운드에서는 그 해소분(동시 경합 e2e, CHANGELOG 신설)까지 포함해 전체를
독립적으로 재검증했다.

추가로 다음을 직접 실측·추론했다(선행 리뷰가 다루지 않은 부분):
- `TriggersService.update()` 의 실제 저장 경로(`m.save(Trigger, { id: target.id, ...patch })`, 622행 부근)를 읽어
  "TypeORM 의 변경분 save 라 경로를 바꿀 때만 SET 한다"는 마이그레이션 주석(V133 SQL 63~64행)이 실제 구현과 맞는지 확인 —
  `defined` 가 `dto` 에 명시된 필드만 포함하고 `workspaceId` 는 애초에 `dto`/`rest` 에 없어 `update()` 경로에서 결코
  같이 SET 되지 않음을 확인(합치).
- `create()` 경로(497~504행)는 `INSERT` 이므로 `UPDATE OF` 컬럼 제한과 무관하게 트리거가 항상 발화함을 확인(합치).
- `trigger.workspace_id` 가 `NOT NULL`(`V001__initial_schema.sql:145`)임을 확인 — `reserved_by IS DISTINCT FROM
  NEW.workspace_id` 비교에서 `NEW.workspace_id` 가 NULL 이 되는 경로가 없음을 확인(주인 없는 예약(NULL) vs 새
  요청자만 비대칭적으로 NULL 일 수 있고, 그 방향은 정확히 "주인 없는 예약은 아무도 못 쓴다" 요구를 구현).
- `UpdateTriggerDto` 에 `type` 필드가 없어 API 로는 트리거 타입 변경(따라서 `endpoint_path` 최초 UPDATE 부여)이
  불가능함을 확인 — 이 경로는 SQL e2e 시나리오 (3)이 수동 SQL로만 문제 삼고 있고 정확히 거부됨을 확인.

## 발견사항

- **[INFO]** Swagger 설명 문자열의 문장 구조 (선행 리뷰 재확인, 조치 불요)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:51`
  - 상세: `TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION` 이 "트리거가 이미 있거나(...), 다른 워크스페이스가 예약한
    경로다(지웠거나 바꾼 경로 — V133). 둘을 구분하지 않는다." 로 두 조건을 나열하는데 뒷절이 서술어 없이 명사구로
    끝난다. 이미 1라운드 maintainability 리뷰가 INFO 로 지적한 사안과 동일하며 기능적 결함은 아니다.
  - 제안: 조치 불요(선행 리뷰 판정 유지).

- **[INFO]** `WebhookEndpointReservation` 엔티티는 `@InjectRepository` 로 어디서도 주입되지 않는다 (선행 리뷰 재확인)
  - 위치: `codebase/backend/src/modules/triggers/entities/webhook-endpoint-reservation.entity.ts` 전체,
    `codebase/backend/src/database/root-entities.ts:11,66`
  - 상세: 쓰기·읽기는 전부 DB 트리거(`reserve_webhook_endpoint_path()`)와 raw SQL(e2e)로만 일어나 이 엔티티의
    컬럼/인덱스/FK 데코레이터는 스키마 gap 가드(`entity-schema-declarations.e2e-spec.ts`, `ROOT_ENTITIES` 순회로
    자동 편입)로만 검증된다. 의도된 설계이며 회귀 그물은 확보돼 있다.
  - 제안: 조치 불요. 향후 이 엔티티에 조회/관리 API 를 얹을 때 최소 1개의 실제 `find`/`save` 단위 테스트를 추가할 것.

- **[INFO]** spec 본문과 구현의 line-level 대조 결과 — 불일치 없음 (긍정 확인, spec fidelity)
  - `spec/1-data-model.md` §2.8.1 필드 표(`endpoint_path VARCHAR(255) PK`, `workspace_id UUID? SET NULL`,
    `reserved_at Timestamp`) ↔ `webhook-endpoint-reservation.entity.ts:24-37` 컬럼 선언 ↔
    `V133__webhook_endpoint_reservation.sql:21-26` DDL 이 타입·nullable·FK 액션 세 겹으로 정확히 일치.
  - §2.8.1 "다른 워크스페이스가 예약한 경로 ... 같은 응답(409 RESOURCE_CONFLICT · details.code=
    TRIGGER_ENDPOINT_PATH_CONFLICT) ... 경로가 한때 쓰였는지를 응답으로 알려 주지 않는다" ↔
    `triggers.service.ts` `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`(233-236)·`isEndpointPathUniqueViolation`(245-249)·
    `rethrowEndpointPathConflict`(1663-1687, 메시지 "쓸 수 없어요" 로 "쓰고 있다" 를 말하지 않음)가 정확히 대응.
  - `spec/5-system/3-error-handling.md` 234·238행의 문구("두 경우를 한 코드로 묶었다", `details.field='endpoint_path'`)
    와 `triggers.controller.ts:51` Swagger 설명·`rethrowEndpointPathConflict` 의 `details` 객체가 문구 수준까지 일치.
  - `spec/2-navigation/2-trigger-list.md:126,197` 의 "또는 다른 워크스페이스가 예약한 경로 ... 409" 문구도 동일.
  - 강제 메커니즘("BEFORE 트리거가 인덱스 검사보다 먼저", "라벨은 실재 제약이 아니다")도 SQL 헤더 주석·엔티티
    JSDoc·서비스 JSDoc·spec 본문 네 곳 모두 같은 설명을 반복 — 괴리 없음.
  - 조치 불요 — 기록 목적 INFO.

- **[INFO]** 엣지 케이스 커버리지 확인 (긍정 확인)
  - `webhook-endpoint-reservation.e2e-spec.ts` 의 SQL 레벨 테스트가 (1) 살아 있는 경로 충돌 (2) 지운 경로 재사용 시도
    (3) 바꾼 경로의 생성·PATCH 양쪽 (4) 트리거를 다른 워크스페이스로 이관하는 수동 SQL (5) 워크스페이스 삭제 후 고아
    예약까지 다섯 갈래를 전부 SAVEPOINT 로, 그리고 별도 테스트로 "동시에 처음 잡는 새 경로" 의 커밋/롤백 두 분기를
    두 개의 실제 DB 커넥션과 `pg_stat_activity` 확인으로 검증한다. `webhook-trigger.e2e-spec.ts` B7~B9 가 같은 시나리오를
    API 레벨에서 반복 검증. NULL/빈 컬렉션류 경계값(워크스페이스 없는 트리거는 존재하지 않음·`endpoint_path IS NULL` 인
    트리거는 `WHEN` 절로 애초에 트리거 미발화)도 스키마 불변식(B9)이 전수 대조.
  - 조치 불요.

- **[INFO]** TODO/FIXME/HACK/XXX 미완성 표식 없음 — 변경된 8개 애플리케이션 코드 파일 전수 grep 확인.

## 요약

V133 마이그레이션(테이블·부분 인덱스·DB 트리거·백필)과 이에 연동된 엔티티·서비스 predicate 확장·에러 메시지 일반화·
컨트롤러 Swagger 설명·3계층 테스트가 `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 의 설계 및
`spec/1-data-model.md` §2.8.1(및 연쇄 반영된 4개 spec 문서)과 line-level 로 정확히 일치한다. 독립적으로 `TriggersService`
의 실제 저장 경로(부분 객체 `save`)를 추적해 마이그레이션 주석이 주장하는 "TypeORM 의 변경분 save 라 경로를 바꿀 때만
SET 한다"는 전제를 코드 레벨에서 재확인했고, `NOT NULL workspace_id` 제약·API 로는 `type` 변경이 불가능함을 확인해
`IS DISTINCT FROM` 비교와 SQL e2e 시나리오 (3)·(4)의 타당성도 검증했다. TODO/FIXME 류 미완성 표식은 없고, 모든 에러
경로(다른 워크스페이스 충돌·고아 예약 충돌·이름 불명 UNIQUE 위반의 전역 매핑 위임)가 명시적으로 처리되며 반환값 누락
경로도 없다. 1라운드 코드 리뷰가 지적한 두 Warning(서비스 predicate 협소화로 인한 잠재적 500, CHANGELOG 누락)은 후속
커밋(`a4a4791a7`)에서 정확히 해소된 상태로 이번 재검증에서도 확인됐다. 남은 항목은 모두 INFO(선행 리뷰 재확인)이며
병합을 막을 이유가 되는 CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

NONE
