# 부작용(Side Effect) 리뷰 — 웹훅 경로 영구 예약 (V133, 2라운드)

## 검토 범위 및 방법

전체 diff(`CHANGELOG.md`, V133 마이그레이션·엔티티·엔티티 등록, `triggers.service.ts`/`triggers.controller.ts`,
`triggers.service.spec.ts`, `deletion-cascade-indexes.e2e-spec.ts`, `webhook-endpoint-reservation.e2e-spec.ts`(신규),
`webhook-trigger.e2e-spec.ts`(B7~B9 추가), spec 문서 5건, 1라운드 review/consistency 산출물 커밋)을 대상으로 했다.
1라운드 side_effect 리뷰(`review/code/2026/09/19/19_44_33/side_effect.md`)가 핵심 부작용(신규 DB 트리거의 발동 범위,
`triggerRepository.save`/`.update()` 전수 확인, `isEndpointPathUniqueViolation` 시그니처)을 이미 깊게 검증해 두었고,
이번 라운드의 실질적 diff 는 (a) CHANGELOG 항목 추가, (b) `triggers.service.spec.ts` 의 이름 매트릭스 확장,
(c) `webhook-endpoint-reservation.e2e-spec.ts` 의 **동시 경합 e2e 신설**, (d) review/consistency 산출물 커밋이다.
저장소 파일은 읽기(Read/Grep/Bash)만 수행했고 뮤테이션하지 않았다 — `git status --short` 로 확인, 세션 시작 시점과
동일하게 `review/code/2026/09/19/20_13_30/`(본 리뷰 산출 디렉터리) 외 변경 없음.

## 발견사항

- **[INFO]** 신설 동시-경합 e2e 가 공유 e2e Postgres 의 `webhook_endpoint_reservation` 테이블에 **영구 orphan 행을 매 실행마다 2개씩 누적**시킨다
  - 위치: `codebase/backend/test/webhook-endpoint-reservation.e2e-spec.ts` — `it('동시에 처음 잡는 같은 경로 …')` 블록의
    `finally`(파일 끝 근방, `await db.query('DELETE FROM workspace WHERE id = ANY($1)', [[ws.a, ws.b]])` 줄)
  - 상세: 이 테스트만 (파일의 첫 `it` 과 달리) 임시 스키마 + `ROLLBACK` 격리를 쓰지 않고 공유 `public` 스키마에 실제
    `user`/`workspace`/`workflow`/`trigger` 행을 커밋한다(두 커넥션이 서로의 쓰기를 봐야 하므로 파일 헤더 JSDoc 이 이를
    "예외" 로 명시). `finally` 에서 `workspace` 를 지우면 FK cascade 로 `workflow`/`trigger` 는 삭제되지만,
    `webhook_endpoint_reservation.workspace_id` 는 설계대로(V133 `ON DELETE SET NULL`) `NULL` 로만 바뀌고 **행 자체는
    지워지지 않는다** — `committed`/`rolledBack` 두 경로(둘 다 `crypto.randomUUID()`) 각각에 대해 소유자 없는 예약 행이
    테이블에 영구히 남는다. 테스트 주석("무작위 경로라 다른 테스트와 겹치지 않는다")은 **충돌**만 다뤘지 **누적**은
    다루지 않는다 — CI 가 매번 볼륨을 초기화하면(`make e2e-down -v`) 문제가 되지 않지만, 로컬에서 같은 e2e DB 를 초기화 없이
    반복 실행하면(`make e2e-test` 반복, watch 모드 등) 이 테이블이 실행 횟수만큼 무한히 커진다. 프로덕션에서도 같은
    현상(주인 없는 예약은 지우지 않음)이 **의도된 설계**이므로 테스트가 그 현실을 정확히 재현한 것 자체는 결함이
    아니지만, 그 결과로 테스트 스위트가 반복 실행될 때마다 공유 인프라 상태를 단조 증가시키는 유일한 e2e 파일이 됐다는
    점은 기록해 둘 가치가 있다(같은 파일의 다른 `it`, 그리고 `webhook-trigger.e2e-spec.ts` B7~B9 은 트리거/워크플로/
    워크스페이스까지는 지우되 예약 행이 생기는 경로 자체가 이 트리거 함수를 통하므로 동일한 종류의 orphan 을 각기 1~2개씩
    남긴다 — 이 라운드에서 신설된 경로만 별도로 2개를 더한다).
  - 제안: 결함으로 보지 않으며 차단 사유는 아니다. 다만 (1) 테스트 헤더 주석에 "충돌 회피" 뿐 아니라 "이 두 행은
    영구히 남는다(프로덕션 동작 재현)" 한 줄을 추가하거나, (2) 이미 로컬 반복 실행 시 e2e DB 크기가 문제가 되는 경우가
    생기면 이 파일이 원인 후보 1순위임을 알아두는 정도로 충분하다.

- **[INFO]** (1라운드 확인 재검증) `isEndpointPathUniqueViolation()` 은 시그니처는 그대로이나 매칭 범위가 이름 1개 →
  `ReadonlySet` 2개로 넓어졌고, 여전히 모듈 밖 사용처는 없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:233-249`
  - 상세: `grep -rln "isEndpointPathUniqueViolation" codebase/backend/src` 로 재확인 — `triggers.service.ts`/
    `triggers.service.spec.ts` 외 사용처 0건. `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES` 는 `export` 되지 않은 모듈-내부
    상수이고, `triggers.service.spec.ts` 의 `CONFLICT_NAMES`(3029행)는 같은 두 문자열을 **독립적으로 다시 선언**한
    리터럴이다 — 서비스가 세 번째 이름을 추가하면 이 테스트 배열을 사람이 동시에 갱신해야 매트릭스가 그 이름까지
    덮는다(안 하면 조용히 새지는 않고, 그냥 그 이름만 커버리지에서 빠진 채 그린으로 통과한다). 오늘 시점에는 회귀가
    아니며 side-effect 로 분류할 사안은 아니지만(테스트 커버리지/유지보수성 축에 더 가깝다), 향후 편집자를 위해
    기록한다.
  - 조치 불요.

- **[INFO]** (1라운드 확인 재검증) 새 `BEFORE INSERT OR UPDATE OF endpoint_path, workspace_id ON trigger` DB 트리거의
  실제 발동 범위는 오늘 기준 `TriggersService.update()` 의 diff 기반 `save()` 덕분에 "웹훅 경로 생성·실변경" 으로
  정확히 좁혀져 있다 — `triggerRepository.update()` 호출부 재확인(`chat-channel.dispatcher.ts`,
  `notification-webhook.processor.ts`, `schedules.service.ts`, `hooks.service.ts`, `triggers.service.ts` 자체 3곳)
  전부 `endpointPath`/`workspaceId` 를 SET 하지 않음을 확인했다. 이 트리거 정의 자체(`OF` 절)는 이를 보장하지
  않으므로(값이 같아도 SET 절에 나열되면 발동), 향후 이 두 컬럼을 건드리는 partial-update 코드가 추가되면 조용한
  추가 왕복(INSERT+SELECT)의 표면이 될 수 있다는 1라운드 지적은 유효하며 변경되지 않았다. 새 회귀는 아님.
  - 위치: `codebase/backend/migrations/V133__webhook_endpoint_reservation.sql:65-69`
  - 조치 불요(1라운드에서 이미 INFO 로 기록됨).

## 확인되어 문제 없음 (오탐 방지 기록)

- `WebhookEndpointReservation` 엔티티를 `ROOT_ENTITIES`/`REQUIRED_ENTITIES` 에 추가한 것은 `app.module.ts` 의
  `synchronize: false` 하에서 스키마에 부작용을 주지 않는다(재확인).
- `webhook-endpoint-reservation.e2e-spec.ts` 의 **첫 번째** `it`(백필·거부·재사용 시나리오)은 전용 스키마
  (`v133_probe`) + `search_path` + `finally { ROLLBACK }` 로 완전히 격리돼 있어 공유 `public` 을 건드리지 않는다.
  두 번째 `it`(경합)만 위에서 지적한 예외다.
- `triggers.controller.ts` 변경은 Swagger 설명 문자열 하나뿐 — 런타임 동작·응답 스키마에 영향 없음.
- `CHANGELOG.md`·`plan/**`·`review/**` 변경은 순수 문서/산출물이며 코드 실행 경로에 영향이 없다.
- 신규 FK(`webhook_endpoint_reservation.workspace_id → workspace.id ON DELETE SET NULL`)는 애플리케이션 레벨
  구독자(TypeORM subscriber)를 거치지 않는 순수 DB 레벨 캐스케이드라, 워크스페이스 삭제 시 기존 이벤트/알림/BullMQ
  처리 흐름에 새 콜백을 추가하지 않는다.
- 환경 변수 신규 읽기/쓰기, 외부 네트워크 호출 없음 — 신규 e2e 는 기존 `createDbClient()` 헬퍼(기존 관례)로 로컬
  테스트 DB 에만 접속한다.

## 요약

이번 2라운드 diff 의 실질 변경분(CHANGELOG 항목, 테스트 이름 매트릭스 확장, 동시 경합 e2e 신설)에서 CRITICAL·WARNING
급 미의도 부작용은 찾지 못했다. 1라운드가 이미 깊게 검증한 핵심 부작용(신규 DB 트리거의 발동 범위가 오늘은
"웹훅 경로 실변경" 으로 정확히 좁혀져 있다는 점, `synchronize: false` 로 엔티티 등록이 스키마에 영향을 주지 않는다는
점, `isEndpointPathUniqueViolation` 시그니처 불변)을 재확인했고 변경되지 않았다. 이번 라운드에서 새로 눈에 띈 것은
신설된 동시-경합 e2e 가 공유 e2e Postgres 의 예약 테이블에 실행마다 2개의 orphan 행을 영구히 남긴다는 점인데, 이는
프로덕션의 의도된 동작(주인 없는 예약은 지우지 않음)을 테스트가 정확히 재현한 결과라 결함은 아니지만, 반복 로컬
실행 시 공유 인프라 상태가 단조 증가하는 유일한 경로라는 점은 INFO 로 기록해 둔다.

## 위험도

LOW
