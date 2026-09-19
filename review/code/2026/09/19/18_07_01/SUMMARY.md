# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(둘 다 "탐지는 있으나 예방/문서 참조가 회귀에 취약한" 저비용 보강 여지)이며, 머지를 막을 사유는 없음. forced whitelist(7명) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | 새로 쓴 JSDoc이 아직 존재하지 않는 `plan/complete/entity-column-declaration-drift.md` 경로를 근거로 인용한다. 실제 신규 plan 은 `plan/in-progress/entity-column-declaration-drift.md` 이며 해당 plan 의 체크리스트(`/ai-review`·`--impl-done`·`complete/` 이동)가 아직 미완료라 병합 시점에도 그 경로는 존재하지 않을 수 있다 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:26` | 지금은 `plan/in-progress/...` 를 가리키도록 고치거나, plan 이 `complete/` 로 이동되는 커밋에서 이 주석도 함께 갱신하도록 그 이동 체크리스트에 포함 |
| 2 | 테스트 | 읽기 전용 세션 "예방" 계층(`installExtensions: false`, `extra.options='-c default_transaction_read_only=on'`) 자체를 검증하는 자동 회귀 테스트가 없다 — 누군가 이 옵션을 지워도 카탈로그 비교만으로는 잡히지 않아(확장 생성 실패는 catalog 를 바꾸지 않음) 스위트가 계속 GREEN 이다 | `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:545-551` | 두 옵션 값을 확인하는 가벼운 구조적 단언(`expect(readOnly.options.installExtensions).toBe(false)` 류)을 추가하거나, RO1 뮤턴트(읽기 전용 세션에서 실제 DDL 실행 시도)를 별도 `it()` 로 승격. 최소한 옵션 옆에 "지우면 조용히 회귀한다" 경고 주석 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트/부작용/DB | `default` 메타데이터 추가 2건(`model-config.kind`, `workflow-assistant-session.lastInteractionAt`)으로 인한 INSERT `RETURNING` 확장이 전용 단언 없이 "전체 e2e 통과" 로만 확인됨. 다만 두 호출부 모두 항상 값을 명시적으로 채워(`kind` 없으면 `BadRequestException`, `lastInteractionAt` 은 서비스가 항상 세팅) 실측 위험은 낮음 | `model-config.entity.ts:46`, `workflow-assistant-session.entity.ts:75-79` | 안전망이 실제 작동함(값 생략 시 DB 기본값이 채워짐)을 겨냥한 좁은 통합 테스트 추가를 고려 |
| 2 | 보안/DB | 인덱스 `where` 절·CHECK `expression` 을 이스케이프 없이 DDL 문자열에 직접 보간(`normalizedPredicate`/`normalizedCheck`). 값의 출처가 커밋된 엔티티 데코레이터 리터럴뿐이라 외부 입력 도달 경로 없음, 코드도 재사용 금지를 주석으로 명시 | `entity-schema-declarations.e2e-spec.ts:276-296, 298-315` | 현행 유지. 향후 다른 목적(사용자 입력이 섞이는 스크립트)으로 재사용하지 않도록 경고 주석 유지 |
| 3 | 테스트 | 판별력 대조군 테스트(`COLUMN_LEVEL`/`COLUMN_LEVEL_SAMPLES` 검증)가 DB 를 전혀 쓰지 않는 순수 함수 테스트인데 파일의 `beforeAll`(실 DB 연결)에 묶여 있어 DB 없이는 실행 불가 | `entity-schema-declarations.e2e-spec.ts:514-525` | 파일 응집성을 위해 현 위치도 합리적. e2e 실행 비용이 문제되면 unit 계층 분리 고려 |
| 4 | 유지보수성 | `.log()` 호출 결과를 담는 변수명 `log` 가 메서드명과 겹쳐 "로거"로 오독될 여지 | `entity-schema-declarations.e2e-spec.ts:552, 555` | `sqlMemory`/`schemaLog` 등 내용을 드러내는 이름으로 변경 |
| 5 | 유지보수성 | 신규 `it` 하나가 (1)부작용 없음 (2)컬럼 층 문 미발생 (3)예외 목록 신선도 — 세 성격의 검증을 한 블록에 묶어 실패 시 원인 판별에 한 단계 필요 | `entity-schema-declarations.e2e-spec.ts:527-569` | 셋업 비용(readOnly DataSource init + log()) 트레이드오프상 현 구조도 무리 없음. 진단 편의를 높이려면 module-level 캐시로 분리 고려 |
| 6 | 유지보수성 | `COLUMN_LEVEL_SAMPLES.caught` 표본과 다섯 정규식 패턴의 대응 관계가 암묵적(순서·주석 없음) | `entity-schema-declarations.e2e-spec.ts:80-90` | 표본 옆에 짧은 인라인 주석(`// ADD`, `// DROP COLUMN` 등) 추가 고려. 판별력 테스트가 이미 자동 검증하므로 실질 위험은 낮음 |
| 7 | 보안 | e2e DB 접속 정보가 소스에 하드코딩된 fallback 값(`clemvion-e2e` 등)으로 존재. 기존에 `beforeAll` 인라인이던 것을 `dataSourceOptions()` 함수로 리팩터링한 것뿐이며 신규 도입 아님(환경변수 오버라이드 가능, 로컬 e2e 전용) | `entity-schema-declarations.e2e-spec.ts:184-196` | 현행 유지 가능 |
| 8 | 부작용 | 새 테스트가 매 실행마다 두 번째 `DataSource`(커넥션 풀)를 열었다 닫음 — `try/finally` 로 누수는 없으나 병렬 e2e 실행 시 커넥션 슬롯 추가 점유 | `entity-schema-declarations.e2e-spec.ts` (readOnly DataSource 블록) | 조치 불요. 향후 e2e 병렬도를 크게 올릴 계획이 있으면 참고 |
| 9 | 부작용 | `typeorm/driver/postgres/PostgresConnectionOptions`·`typeorm/driver/SqlInMemory` 서브패스 `import type` — 런타임 영향 0(타입 전용, 컴파일 시 소거)이나 TypeORM 이 공개 export 하지 않는 경로라 마이너 업그레이드 시 빌드 타임 실패 가능성 | `entity-schema-declarations.e2e-spec.ts:6-7` | 조치 불요 — 사유가 이미 파일 상단 주석에 남아있음 |
| 10 | 요구사항 | `model_config.kind` 에 `default: 'chat'` 신규 선언 — spec 표는 이 필드를 판별자로만 서술하고 기본값을 명시하지 않음. 다만 이 값은 기존 마이그레이션(`V088__model_config_rename_kind.sql`)에 이미 있던 DB 사실을 엔티티가 뒤늦게 반영한 것뿐 | `model-config.entity.ts:46` | spec 표에 기본값을 명시할 정도로 세밀하지 않은 기존 관례라 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 하드코딩 e2e 자격증명(기존값 리팩터)·DDL 문자열 보간(스코프 제한됨) 등 INFO만, Critical/Warning 없음 |
| requirement | NONE | 트래커 지목 9곳 전부 마이그레이션 원본·스키마 비교기 실측으로 교차 검증 완료. spec 은 이미 정확했음(SPEC-DRIFT 아님) |
| scope | NONE | 변경 범위가 plan 실측 표와 1:1 대응, 무관한 정리·포맷팅 변경 없음 |
| side_effect | NONE | 3라운드 WARNING(읽기 전용 세션 CREATE EXTENSION 시도)이 `installExtensions: false` 로 해소됨을 TypeORM 소스로 직접 확인 |
| maintainability | LOW | 변수명 1건·테스트 응집도 1건·표본-패턴 대응 표기 1건, 전부 INFO 수준 가독성 여지 |
| testing | LOW | WARNING 1건(읽기전용 세션 예방 계층 자체의 자동 회귀 테스트 부재) + INFO 2건 |
| documentation | LOW | WARNING 1건(JSDoc이 아직 없는 `plan/complete/` 경로를 조기 인용) |
| database | LOW | DDL 문자열 보간·`RETURNING` 확장 등 INFO만, 트랜잭션/커넥션 관리 견고 |
| user_guide_sync | NONE | 매트릭스 22개 change_type 전수 대조, 매칭 0건 — 해당 없음 |

## 발견 없는 에이전트

- scope (findings 섹션 자체가 "없음")

## 권장 조치사항

1. (WARNING) `entity-schema-declarations.e2e-spec.ts:26` 의 JSDoc 이 인용하는 `plan/complete/entity-column-declaration-drift.md` 경로를 현재 위치(`plan/in-progress/...`)로 수정하거나, 해당 plan 이 `complete/` 로 이동되는 커밋의 체크리스트에 이 주석 동반 갱신을 포함시킨다.
2. (WARNING) 읽기 전용 세션 예방 계층(`installExtensions: false`, `extra.options`)이 조용히 되돌아가도 현재 스위트는 GREEN 을 유지한다 — 옵션 값 자체를 확인하는 가벼운 단언 추가 또는 RO1 뮤턴트를 자동 테스트로 승격.
3. (INFO, 선택) `default` 추가로 인한 `RETURNING` 런타임 변화(kind/lastInteractionAt)를 겨냥한 좁은 통합 테스트를 추가해 "전체 e2e 통과"가 우연이 아님을 명시적으로 뒷받침.
4. (INFO, 선택) 유지보수성 3건(변수명 `log`→`sqlMemory`, 표본-패턴 인라인 주석, 테스트 응집도) — 병합을 막지 않는 낮은 우선순위 가독성 개선.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, user_guide_sync` (9명)
  - **제외**: 표 (reviewer · 이유, 5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(엔티티 메타데이터 정정 + e2e 가드) 와 관련성 낮음 |
  | architecture | 상동 |
  | dependency | 상동 (신규 의존성 추가 없음) |
  | concurrency | 상동 (동시성 관련 로직 변경 없음) |
  | api_contract | 상동 (API 엔드포인트/계약 변경 없음) |
