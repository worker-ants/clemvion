# Code Review 통합 보고서

## 전체 위험도
**LOW** — 13개 reviewer(security·performance·architecture·requirement·scope·side_effect·maintainability·testing·documentation·database·concurrency·api_contract·user_guide_sync) 전원 실행 완료, Critical 0건·Warning 0건. 1라운드(`19_44_33`)가 남긴 Warning 2건(CHANGELOG 누락, 동시 경합 e2e 미검증)은 후속 커밋(`a4a4791a7`)에서 정확히 해소됨을 이번 2라운드가 재검증했다. 남은 항목은 전부 INFO(선택적 개선/트레이드오프 기록)뿐이다. **forced 화이트리스트(database, documentation, maintainability, requirement, scope, security, side_effect, testing) 8명 전원 결과 확보됨 — 누락 없음.**

## Critical 발견사항

없음.

## 경고 (WARNING)

없음. (1라운드 Warning 2건은 이번 diff 이전에 이미 해소 완료 — requirement/scope/documentation/testing/concurrency 리뷰가 각각 독립적으로 해소 확인.)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 데이터베이스/보안 | 합성 제약 이름(`webhook_endpoint_reservation_owner`)이 실재 UNIQUE/CHECK 제약이 아니라 트리거의 `RAISE EXCEPTION ... USING CONSTRAINT` 라벨 — 동작엔 문제 없으나 `\d` 로 조회하는 운영자가 혼동할 수 있음 | `migrations/V133__webhook_endpoint_reservation.sql:51-55`, `triggers.service.ts:222-236` | 이미 SQL 주석·서비스 JSDoc·마이그레이션 헤더 3곳에 명시됨 — 조치 불요(참고) |
| 2 | 성능/데이터베이스 | `CREATE TRIGGER ... ON trigger` 가 마이그레이션 트랜잭션 종료까지 `trigger` 테이블에 `SHARE ROW EXCLUSIVE` 를 보유 — 배포 적용 중 웹훅 트리거 생성/수정 API 쓰기가 짧게 큐잉됨 | `migrations/V133__webhook_endpoint_reservation.sql:65-74` | 의도된 설계(순서 보장), CHANGELOG·헤더에 이미 문서화 — 저트래픽 구간 배포 권장만 참고 |
| 3 | 성능 | 트리거 함수가 매 발동마다 `INSERT ... ON CONFLICT DO NOTHING` + 별도 `SELECT` 2단계 왕복 — 정확성(경합 판정) 목적의 의도적 선택, 저빈도 경로라 부하 무관 | `migrations/V133__webhook_endpoint_reservation.sql:38-49` | 조치 불요 — 단순 합치기는 경합 판정 의미를 깨뜨릴 위험 |
| 4 | 아키텍처 | 도메인 불변식(강제=DB 트리거, 해석=서비스) 사이의 계약이 컴파일러가 검증 못 하는 SQL 문자열 리터럴(`webhook_endpoint_reservation_owner`) 하나로만 연결됨 | `migrations/V133__...sql:52-56` ↔ `triggers.service.ts:233-236` | 조치 불요 — 양방향 단위/e2e 테스트로 리스크 완화됨. 3번째 라벨 추가 시 상호 참조 주석 유지 |
| 5 | 아키텍처/요구사항/API계약 | `WebhookEndpointReservation` 엔티티가 `TypeOrmModule.forFeature`에 등재되지 않아 Repository/CRUD 경로가 없음 — `ROOT_ENTITIES`(스키마 선언 전용)에만 존재 | `triggers.module.ts:29`, `database/root-entities.ts:66` | 조치 불요 — 의도된 설계, 1라운드에서 이미 처분 확인됨 |
| 6 | 테스트 | `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES`(production Set)가 export 되지 않아 테스트가 동일 문자열 2개를 독립 리터럴로 복제 — "이름 제거/변경" 회귀는 잡지만 "이름 추가" 방향 회귀는 구조적으로 못 잡음 | `triggers.service.spec.ts:3029-3032` vs `triggers.service.ts:233-236` | 테스트 전용 export 또는 재노출 헬퍼 도입 검토 — 이름 추가 시 테스트 목록 자동 동기화 |
| 7 | 부작용/테스트 | 신규 동시-경합 e2e 가 커밋/롤백 두 분기 각각 예약 행을 생성하며, `finally` 가 workspace/user만 지우고 예약 행 자체는 (설계대로) 지우지 않아 공유 e2e DB 에 실행마다 2개씩 영구 누적됨 | `test/webhook-endpoint-reservation.e2e-spec.ts` 두 번째 `it`의 `finally` | 결함 아님(프로덕션 의도 재현) — 파일 헤더 주석에 "이 행은 영구히 남는다" 한 줄 추가 고려 |
| 8 | 유지보수성 | 신규 폴링 루프의 반복 횟수(200)·간격(25ms)이 이름 붙은 상수 없이 리터럴로만 존재(전체 대기 5초가 곱으로 암묵적) — 코드베이스의 다른 e2e 폴링 루프도 동일 스타일이라 이번 코드만의 이탈은 아님 | `test/webhook-endpoint-reservation.e2e-spec.ts:260-268` | 차단 사유 아님 — 다음에 만질 때 `MAX_WAIT_MS`/`POLL_INTERVAL_MS` 로 명명 고려 |
| 9 | 동시성 | 인터리빙 감지가 폴링 기반(최대 5초) — 극단적으로 자원 부족한 CI 러너에서 타임아웃 가능(에러 메시지는 명확) | 동일 파일 `waitUntilSecondBlocks` | 조치 불요 — flaky 보고 시 타임아웃 연장으로 충분 |
| 10 | 동시성 | 타임아웃 분기에서 `loser`/`winner` 프라미스가 `await` 되지 않고 남을 수 있으나 rejection 핸들러가 이미 붙어 있고 `finally`의 `client.end()`가 서버 측에서 트랜잭션을 자동 정리 — 실질 부작용 없음 | 동일 파일, 신규 `it` 본문 | 조치 불요 |
| 11 | 데이터베이스 | `webhook_endpoint_reservation`은 설계상 append-only(삭제 경로 없음) — 웹훅 트리거 생성/경로변경 빈도가 매우 높은 워크로드에서는 장기적으로 무한 증가 | `migrations/V133__...sql:21-26` | 조치 불요 — 사용자가 "영구 보존"을 명시적으로 결정(§2.8.1), 현재 워크로드에서 성능 영향 없음 |
| 12 | API 계약 | 응답 스키마(코드·상태·details)는 완전히 하위 호환이나, **행동은 breaking** — 배포 전 성공하던 "지우거나 바꾼 경로의 타 워크스페이스 재등록"이 배포 후 항상 409로 거부됨 | `triggers.service.ts` `rethrowEndpointPathConflict` | 조치 불요 — 의도된 보안 수정이며 CHANGELOG·마이그레이션 헤더·spec 5개 파일에 이미 명시적으로 예고됨 |
| 13 | 문서화(긍정 확인) | 1라운드 Warning(CHANGELOG 누락)이 신규 `## Unreleased` 항목 + 선행 V132 항목 역참조로 정확히 해소됨 | `CHANGELOG.md` | 조치 불요 |
| 14 | 문서화(긍정 확인) | 격리 수준 주석이 "처음 쓴 문장은 실측으로 반증됨"을 숨기지 않고 정정문에 명시 — 모범적인 자기-반증형 정정 사례 | `migrations/V133__...sql:43-46` | 조치 불요 |
| 15 | 문서화 | `plan/in-progress/spec-draft-webhook-endpoint-reservation.md`가 아직 `plan/complete/`로 이동하지 않음(체크리스트 마지막 항목 `/ai-review`·`--impl-done`·트래커 해소가 미체크) | `plan/in-progress/spec-draft-webhook-endpoint-reservation.md:171-176` | 정상 시퀀싱 — 마무리 커밋에서 자연 해소 |
| 16 | 유저 가이드 동기화 | 사용자 대상 가이드(`02-nodes/triggers.mdx`/`.en.mdx`)가 V133의 "지우거나 바꾼 경로도 영구 예약된다"는 강화된 보장을 아직 언급하지 않음(회색지대) — 다만 이미 spec Rationale·1라운드 documentation 리뷰가 같은 근거("소유자 관점에서 달라지는 것 없음, 충돌은 기존 409로 안내됨")로 검토·수용한 사안과 사실상 동일선상 | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:87,95`, `.en.mdx:84` | 선택 사항 — 문장 한 줄 추가 가능하나 필수 차단 사유 아님, 재지적성 fix PR 불요 |
| 17 | 스코프(긍정 확인) | `webhook-trigger.e2e-spec.ts`의 중복 단언 헬퍼(`expectConflict`/`expectPathConflict`)가 하나로 통합됨 — 1라운드 지적을 정확히 해소하는 계획된 조치, 범위 이탈 아님 | `test/webhook-trigger.e2e-spec.ts` | 조치 불요 |
| 18 | 유지보수성/테스트(재확인) | 테스트 케이스 생성기가 메서드×표면×이름 3축 `flatMap`/`map` 중첩 — 조건 분기가 아니라 순환 복잡도엔 기여하지 않으며 JSDoc이 각 축을 설명 | `triggers.service.spec.ts:3034-3039` | 허용 범위 — 축이 하나 더 늘면 `cartesian(...)` 헬퍼 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 정보 노출 방지·TOCTOU 차단 긍정 확인, 합성 제약 이름 INFO 1건 |
| performance | LOW | 트리거 2단계 왕복·배포 중 짧은 락 INFO, N+1/앱레벨 반복 없음 |
| architecture | LOW | 도메인 불변식의 문자열 계약, 엔티티 Repository 부재 INFO 2건 |
| requirement | NONE | spec 5개 문서와 line-level 일치, 1라운드 Warning 2건 해소 재확인 |
| scope | NONE | 1라운드 이후 증분(CHANGELOG·e2e·리뷰 커밋) 전부 계획된 조치, 이탈 없음 |
| side_effect | LOW | 경합 e2e의 예약 행 2개 영구 누적(설계 의도) INFO |
| maintainability | NONE | 헬퍼 중복 해소 확인, 폴링 상수 미명명 등 INFO 3건 |
| testing | NONE | 유닛 16개 실행 통과, `CONFLICT_NAMES` export 부재로 "추가 방향" 회귀 둔감 INFO |
| documentation | NONE | 1라운드 Warning(CHANGELOG)·INFO 다수 정확히 반영 확인 |
| database | LOW | 트랜잭션/동시성/인덱스 견고, append-only 무한 증가·배포 중 락 INFO |
| concurrency | LOW | 1라운드 Warning(동시 실행 미검증) 실효적으로 해소 확인, 폴링 타임아웃 INFO |
| api_contract | NONE | 스키마 하위 호환, 행동은 breaking(의도됨) INFO 1건 |
| user_guide_sync | LOW | `triggers.mdx` V133 뉘앙스 미반영 회색지대 INFO 1건(이미 수용된 결정과 동일선상) |

## 발견 없는 에이전트

없음 — 전 13개 에이전트가 최소 1건 이상의 INFO(대다수는 참고/긍정 확인)를 남겼으나, Critical·Warning 은 어느 에이전트에서도 0건이다.

## 권장 조치사항

1. (선택) `TRIGGER_ENDPOINT_PATH_CONFLICT_NAMES` 를 테스트 전용으로 export 하거나 재노출 헬퍼를 두어, 향후 이름 추가 시 테스트 매트릭스가 자동 동기화되도록 한다 (testing #6).
2. (선택) 신규 경합 e2e 헤더 주석에 "이 두 예약 행은 영구히 남는다(프로덕션 동작 재현)"를 한 줄 추가한다 (side_effect/testing #7).
3. (선택) 신규 폴링 루프 상수(200회/25ms)를 `MAX_WAIT_MS`/`POLL_INTERVAL_MS` 로 명명한다 (maintainability #8).
4. `plan/in-progress/spec-draft-webhook-endpoint-reservation.md` 의 남은 체크리스트(`/ai-review`·`--impl-done`·트래커 해소)를 완료하고 `plan/complete/` 로 이동한다 (documentation #15) — 이번 SUMMARY 자체가 그 첫 항목을 채운다.
5. (선택, 비필수) `triggers.mdx`/`.en.mdx` 에 "지우거나 경로를 바꿔도 그 경로는 계속 우리 워크스페이스 소유로 남는다"는 문장을 추가할지 팀 판단에 맡긴다 (user_guide_sync #16) — 필수 차단 사유 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (13명)
  - **제외**: 아래 표 (1명)
  - **강제 포함(router_safety)**: `database, documentation, maintainability, requirement, scope, security, side_effect, testing` (8명) — **forced 전원 결과 확보됨(누락 없음)**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 가 이번 diff(마이그레이션·엔티티·서비스 predicate·테스트) 에 신규 의존성 추가 없음으로 판단해 제외 |
