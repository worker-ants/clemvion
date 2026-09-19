# 아키텍처(Architecture) 리뷰 — 웹훅 경로 영구 예약 (V133)

## 검토 범위

`CHANGELOG.md`, `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql`,
`webhook-endpoint-reservation.entity.ts`(신규), `app.module.spec.ts`/`root-entities.ts`(엔티티 등재),
`triggers.controller.ts`(Swagger 문구), `triggers.service.ts`/`triggers.service.spec.ts`(충돌 판정 확장),
`deletion-cascade-indexes.e2e-spec.ts`/`webhook-endpoint-reservation.e2e-spec.ts`/`webhook-trigger.e2e-spec.ts`(e2e),
`plan/in-progress/spec-draft-webhook-endpoint-reservation.md`, `review/code/2026/09/19/19_44_33/**`(직전 라운드 산출물).
`triggers.module.ts`, `workspace.entity.ts` 등 diff 밖 파일도 모듈 경계·순환 의존 확인을 위해 직접 열어 대조했다.

## 발견사항

- **[INFO]** 도메인 불변식("경로를 한 번 예약하면 영구히 그 워크스페이스 소유") 강제가 DB 트리거(V133)에, 그 트리거가 낸 에러의 **해석**(무엇이 충돌이고 어떤 HTTP 계약으로 번역할지)은 서비스 계층에 갈라져 있고, 둘을 잇는 계약이 컴파일러가 검증 못 하는 **문자열 리터럴**(`webhook_endpoint_reservation_owner`)이다
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:52-56` (`RAISE EXCEPTION … USING CONSTRAINT = 'webhook_endpoint_reservation_owner'`) ↔ `codebase/backend/src/modules/triggers/triggers.service.ts:233-236`(`TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`)
  - 상세: 이 자체는 V132 가 이미 도입한 패턴(단일 문자열 상수)의 **연장**이라 이번 diff 가 새로 만든 아키텍처는 아니다. 다만 두 층 사이의 계약이 SQL 문자열 리터럴 하나로만 이어져 있어, 한쪽(마이그레이션의 라벨 문자열 또는 서비스의 Set 원소)만 바뀌면 타입체커는 아무것도 잡지 못하고 조용히 409→500 으로 계약이 좁아진다는 실패 모드는 여전하다. 이번 PR 은 이 실패 모드를 알고, `isEndpointPathUniqueViolation` 양방향(맞는 이름 → 좁힘 / 다른 이름 → 통과)과 e2e(`webhook-endpoint-reservation.e2e-spec.ts` 의 `OWNER_LABEL` 상수 대조)로 실측 커버해 리스크를 낮췄다. 도메인 규칙이 인프라(DB 트리거)와 서비스로 나뉘어 사는 것은 동시성 정합성(TOCTOU 회피)을 위한 의도적 트레이드오프이며 V132 때부터 반복 검증된 결정이라 재론할 사안은 아니다.
  - 제안: 조치 불요. 다만 향후 세 번째 충돌 라벨이 추가될 경우를 대비해, 라벨 문자열을 SQL·TS 양쪽에서 참조하는 단일 원천(예: 마이그레이션 헤더 주석에 "이 문자열을 바꾸면 `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES` 도 바꿔라" 식의 상호 참조는 이미 있음 — 유지)만 지키면 된다.

- **[INFO]** `WebhookEndpointReservation` 엔티티가 `TriggersModule` 의 `TypeOrmModule.forFeature([...])`에 등재되지 않아 애플리케이션 코드에서 이 테이블에 대한 Repository/CRUD 경로가 전혀 없다 — `ROOT_ENTITIES`(스키마 동기화 검증용)에만 존재
  - 위치: `codebase/backend/src/modules/triggers/triggers.module.ts:29`(`TypeOrmModule.forFeature([Trigger, Execution, Schedule, AuthConfig])` — `WebhookEndpointReservation` 없음) vs `codebase/backend/src/database/root-entities.ts:66`
  - 상세: 강제·읽기·쓰기가 전부 DB 트리거/수동 SQL(e2e)뿐이라는 설계상 의도된 결과이며, 직전 라운드(`review/code/2026/09/19/19_44_33/maintainability.md` INFO 6 상당, RESOLUTION.md INFO 6 항목)에서 이미 검토·조치 불요로 처분된 사안이다. TypeORM `@Entity` 클래스가 "스키마 선언"이라는 단일 목적으로만 존재하는 것은 이례적이지만, `entity-schema-declarations` 가드가 이 클래스를 DB 스키마와 대조하는 유일한 소비자라는 점에서 이 저장소의 기존 관례(엔티티=스키마 선언 SoT)에 부합한다.
  - 제안: 조치 불요 — 이미 처분된 사안 재확인.

## 정합성이 확인된 항목 (참고, 오탐 방지)

- **OCP**: `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`(단일 문자열)를 `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`(`ReadonlySet<string>`)로 일반화한 것은 향후 세 번째 충돌 라벨이 추가돼도 `isEndpointPathUniqueViolation` 본체를 고치지 않고 Set 원소만 늘리면 되는 구조라 확장에 열려 있다.
- **순환 의존성 없음**: `WebhookEndpointReservation` → `Workspace` 단방향 참조이고, `Workspace` 엔티티는 `User` 만 참조해 `triggers` 쪽으로 되돌아오는 임포트가 없다(`workspace.entity.ts` 직접 확인). `TriggersModule` 도 이 신규 엔티티 때문에 `WorkspacesModule` 을 새로 임포트할 필요가 없다.
- **모듈 경계**: 웹훅 경로 소유권이라는 개념은 `trigger.endpoint_path` 의 파생 개념이라 `modules/triggers/entities/` 아래 두는 것이 기존 `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`/`isEndpointPathUniqueViolation` 이 이미 `triggers.service.ts` 에 사는 것과 일관된 배치다. `workspaces` 모듈에는 이 개념에 대한 코드가 추가되지 않았다(FK 는 있지만 참조뿐).
- **레이어 책임 분리**: 컨트롤러(Swagger 문구), 서비스(에러 판정·번역), 엔티티(스키마 선언), 마이그레이션(강제)의 4단 분리가 이번 diff 전체에서 유지된다 — 컨트롤러가 DB 구현 세부(제약 이름)를 알지 못하고, 서비스만 그 세부를 안다.
- **DIP 관점**: 서비스가 구체적인 DB 예외 형태(`err.constraint`)에 직접 의존하지 않고 `common/db/pg-error.ts` 의 `pgErrorConstraint()`/`isPostgresUniqueViolation()` 추상화를 통해서만 접근한다 — 이번 diff 도 그 SoT 를 그대로 재사용해 규율을 깨지 않았다.
- **응집도**: `reserve_webhook_endpoint_path()` 트리거 함수는 "새 경로를 예약하거나 기존 예약의 주인을 확인한다"는 단일 책임만 가지며, 워크스페이스 삭제 시 예약을 어떻게 처리할지는 FK `ON DELETE SET NULL` 로 선언적으로 위임해 함수 본체에 삭제 처리 로직을 섞지 않았다.

## 요약

이번 diff(V133 웹훅 경로 영구 예약)는 새 아키텍처 패턴을 도입하기보다 V131/V132 가 이미 확립한 "동시성 불변식은 DB 트리거가, 그 트리거가 낸 에러의 HTTP 계약 번역은 서비스가" 라는 레이어링을 그대로 연장한다. 모듈 경계(트리거 도메인 안에 소유권 개념 배치)·순환 의존성(없음)·OCP(문자열 상수 → Set 일반화)·DIP(공용 pg-error 추상화 재사용) 모두 기존 관례와 정합적이며 새로 도입된 결합은 대부분 이미 알려지고 양방향 테스트로 방어된 것(라벨 문자열 계약)이다. 유일하게 눈에 띄는 특징은 도메인 불변식이 서비스 계층이 아니라 DB 트리거에 산다는 점과, 그로 인해 신규 엔티티가 Repository 없이 스키마 선언 전용으로만 존재한다는 점인데, 둘 다 문서화된 의도적 트레이드오프이고 직전 리뷰 라운드에서 이미 검토·수용됐다. 아키텍처 관점에서 이 변경을 막을 이유는 없다.

## 위험도

LOW
