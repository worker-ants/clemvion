# 테스트(Testing) 리뷰 — 웹훅 경로 영구 예약 (V133)

## 발견사항

- **[INFO]** `expectConflict`(B5, 기존)와 `expectPathConflict`(B7/B8, 신규)가 같은 파일 안에서 바이트 단위로 동일한 단언 블록을 두 벌 유지
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` — 파일 스코프 `const expectPathConflict = (res: request.Response) => { ... }` (B7 직전에 신설) vs `it('B5. ...')` 본문 내부의 `const expectConflict = (res: request.Response) => { ... }` (기존, 이번 diff 밖)
  - 상세: 두 헬퍼는 `status===409` · `error.code==='RESOURCE_CONFLICT'` · `error.details` 두 키 · `JSON.stringify(res.body)` 에 `'워크스페이스'` 미포함, 네 단언을 한 글자도 다르지 않게 반복한다. 이 PR 자체가 다른 곳(`triggers.service.spec.ts` 상단 주석, `pg-error-fixtures.ts` 헤더 주석)에서 "fixture/단언을 각 spec 이 손으로 다시 만들면 SoT 중복이 테스트에 재발한다" 는 교훈을 명시적으로 남기고 있는데, 같은 패턴이 한 파일 안에서 재발했다. 나중에 응답 계약이 바뀌면(예: 메시지 포함 여부, details 키 추가) 두 곳 중 하나만 고치고 넘어갈 위험이 있다.
  - 제안: `expectPathConflict` 를 파일 최상단 공용 헬퍼로 유지하고 B5 의 `expectConflict` 를 그것을 재사용하도록 교체(또는 반대로 통합). 두 헬퍼가 의미상 동일하므로 이름도 하나로 통일하는 편이 다음 리뷰어의 "왜 둘인가" 질문을 없앤다.

- **[INFO]** `WebhookEndpointReservation` 엔티티는 저장소 어디에서도 `@InjectRepository` 로 주입되지 않는다 — ORM 경로 자체가 런타임에 실행되지 않음
  - 위치: `codebase/backend/src/modules/triggers/entities/webhook-endpoint-reservation.entity.ts` (엔티티 정의), `codebase/backend/src/database/root-entities.ts:11,66` (등록)
  - 상세: 쓰기·읽기는 전부 V133 DB 트리거(`reserve_webhook_endpoint_path()`)와 raw SQL(e2e 의 `db.query`)로만 일어난다. 따라서 이 엔티티의 `@Column`/`@PrimaryColumn`/`@Index`/`@ManyToOne` 데코레이터가 실제로 검증되는 유일한 경로는 `entity-schema-declarations.e2e-spec.ts` 의 제네릭 스키마-diff 비교뿐이다(그 자체는 `ROOT_ENTITIES` 를 순회하므로 이번 등록으로 자동 커버되어 회귀 그물은 확보돼 있다 — 별도 조치 불요). 다만 "엔티티가 실제 Repository 경로로 한 번도 왕복되지 않는다" 는 사실은 향후 이 엔티티에 조회/관리 API 를 얹을 때(예: 예약 해제 운영 기능 — draft `## 비대상` 이 이미 "필요가 생기면 따로" 로 남겨 둔 항목) 이 엔티티 정의가 실전 검증 없이 방치돼 있었다는 점을 알아 둘 필요가 있다.
  - 제안: 조치 불필요(현재 설계상 의도된 형태). 다음에 Repository 를 붙이는 PR 이 있다면 그때 최소 1개의 실제 `find`/`save` 단위 테스트를 추가할 것.

## 커버리지 평가 (상세)

핵심 변경 경로는 3계층 모두에서 실측 가능한 형태로 테스트됐다:

1. **DB 트리거 메커니즘(SQL 레벨)** — `webhook-endpoint-reservation.e2e-spec.ts` 가 V133 SQL 을 임시 스키마(`v133_probe`)에 그대로 실행해 백필 · 같은 경로 재사용 · 지운 경로 · 바꾼 경로 · 워크스페이스 이관(수동 SQL) · 워크스페이스 삭제(주인 없는 예약) 다섯 시나리오를 SAVEPOINT 기반으로 순서대로 문는다. `trigger-endpoint-path-dedupe.e2e-spec.ts` 와 동일한 하네스 패턴(임시 스키마 + `search_path` + ROLLBACK)을 재사용해 공유 e2e DB 의 `public` 을 건드리지 않는다 — 격리 적절.
2. **서비스 계층 predicate/매핑(unit)** — `triggers.service.spec.ts` 의 `isEndpointPathUniqueViolation` 이 기존 단일 문자열 비교에서 `Set` 기반 다중 이름 매칭으로 바뀐 변경을, `method × surface × name`(2×2×2=8 케이스) 로 전수 확장했다. 이름을 대칭축으로 명시적으로 추가해 "라벨(`webhook_endpoint_reservation_owner`)을 서비스가 인식 못 하면 500 으로 샌다" 는 회귀를 실측 가능한 형태로 잠갔다(직전 consistency 리뷰의 WARNING #1 이 정확히 이 갭을 지적했고, 이번 diff 가 그것을 해소한 것으로 확인됨). "두 이름의 409 응답이 한 글자도 다르지 않다" 는 별도 테스트로 정보 노출 방지 요구사항(경로가 한때 쓰였다는 사실을 응답으로 가르지 않음)까지 직접 검증한다. 반대 방향 대조군(`idx_trigger_workspace_endpoint`, `idx_trigger_workspace_name`, 일반 Error)도 그대로 유지돼 술어가 넓어지는 회귀를 막는다.
3. **API 계약(e2e)** — `webhook-trigger.e2e-spec.ts` B7(지운/바꾼 경로 — 다른 워크스페이스 409, 같은 워크스페이스 재사용) · B8(워크스페이스 삭제 후 주인 없는 예약) · B9(트리거 정의 스키마 + 전수 불변식 쿼리)를 신설해 draft 가 약속한 사용자-관측 가능 동작(V133 §2.8.1) 을 HTTP 레벨에서 검증한다. B9 의 전수 불변식 쿼리(`trigger.endpoint_path IS NOT NULL AND reservation.workspace_id IS DISTINCT FROM trigger.workspace_id`)는 DB 트리거가 무조건적으로 적용되는 성질을 이용해 이 e2e 파일 안에서 그때까지 생성된 모든 웹훅 트리거에 대해 전역 불변식을 검증하므로, 다른 테스트의 실행 순서에 취약하지 않다(공유 DB 상태에 의존하지만 불변식 자체가 DB 트리거로 항상 강제되므로 오탐 위험이 낮다).
4. **회귀 그물 확장** — `deletion-cascade-indexes.e2e-spec.ts` 의 `EXPECTED` 배열에 새 FK 인덱스를 추가해 "새 FK 는 처음부터 인덱스와 함께" 라는 기존 원칙을 제네릭 테스트로 즉시 커버했고, `entity-schema-declarations.e2e-spec.ts` 는 `ROOT_ENTITIES` 를 순회하므로 신규 엔티티 등록만으로 컬럼·인덱스·FK 선언 정합성 검증에 자동 편입된다(위 INFO#2 참고, 추가 조치 불요).

엣지 케이스(같은 워크스페이스 재사용, 워크스페이스 삭제로 인한 주인 없음, BEFORE 트리거 우선순위, `WHEN` 절의 `workspace_id`-only UPDATE 감시) 는 SQL e2e 와 API e2e 양쪽에서 명시적으로 문고 있고, mock 은 unit 테스트에서만 쓰이며 공유 fixture(`makePgUniqueViolation`)를 통해 실제 TypeORM wrap 형태(`driverError`/`top`)와의 괴리를 최소화하고 있다. 테스트 간 의존성은 e2e 쪽이 고유 식별자(UUID/이메일)로, SQL e2e 쪽이 트랜잭션 ROLLBACK 으로 격리한다.

## 요약

이번 변경은 새 DB 트리거·서비스 predicate·API 응답 계약이라는 세 계층 모두에 대해 실측 가능한 테스트를 갖추고 있으며, 특히 직전 consistency 리뷰가 지적한 "predicate 가 이름 하나로 좁혀져 있어 새 라벨을 인식 못 하면 500 으로 샌다" 는 WARNING 을 `method × surface × name` 전수 매트릭스와 "두 이름의 응답이 동일해야 한다" 는 별도 불변식 테스트로 정확히 해소했다. 발견된 두 항목은 모두 INFO 수준으로, 하나는 같은 파일 내 단언 헬퍼의 사소한 중복(DRY, 향후 드리프트 위험), 다른 하나는 신규 엔티티가 ORM 경로로 한 번도 왕복되지 않는다는 설계상 의도된 특성에 대한 기록용 관찰이다. 두 항목 모두 병합을 막을 이유는 아니다.

## 위험도

LOW
