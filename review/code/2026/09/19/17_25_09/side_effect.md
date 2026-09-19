# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `default` 를 새로 선언한 두 컬럼은 INSERT 시 RETURNING 절이 늘어나고, 저장 후 엔티티 객체의 해당 필드값이 DB 응답으로 덮어써진다
  - 위치: `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46` (`kind` — `@Column({ length: 20, default: 'chat' })`), `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79` (`lastInteractionAt` — `default: () => 'now()'`)
  - 상세: TypeORM `EntityMetadata.getInsertionReturningColumns()`(`typeorm/metadata/EntityMetadata.js:678-687`, 이번 워크트리에 설치된 `typeorm@0.3.31` 소스로 직접 확인)는 `column.default !== undefined` 인 컬럼을 **값을 앱이 명시적으로 설정했는지와 무관하게** 무조건 INSERT RETURNING 대상에 포함시키고, `ReturningResultsEntityUpdator.insert()` 가 그 결과를 `manager.merge()` 로 엔티티 객체에 되써넣는다. 즉 `kind`·`lastInteractionAt` 은 두 엔티티 모두 원래 앱이 값을 명시적으로 채워 `save()` 하는 필드(`ModelConfigService`/`CreateModelConfigDto.kind` 는 required, `workflow-assistant-session.service.ts:94` 의 `lastInteractionAt: now`)라 실질적으로 다른 값이 오지는 않지만, `default` 를 선언하는 순간부터 매 INSERT 마다 이 두 컬럼이 RETURNING 절에 추가되고 저장 직후 엔티티 프로퍼티가 "앱이 설정한 그 JS 값" 이 아니라 "DB 라운드트립을 거친 값" 으로 한 번 더 대입되는 것은 이 diff 이전에는 없던 동작 변화다. `Edge.type`/`Node.category` 처럼 diff 전부터 이미 `default` 가 있던 컬럼(`enumName` 만 추가)에는 이 변화가 해당하지 않는다 — 새로 `default` 를 얻은 두 컬럼만의 신규 영향이다.
  - 제안: 이미 `plan/in-progress/entity-column-declaration-drift.md` "런타임 영향" 절이 이 사실을 정확히 예고하고 전체 e2e(backend 354 + Playwright 51)로 확인했다고 기록돼 있어 추가 조치는 불필요해 보인다. 다만 `save()` 직후 반환된 엔티티 객체를 참조 동일성(reference equality)이나 얕은 비교로 "변경 없음" 판정에 쓰는 코드가 향후 추가된다면 이 RETURNING 병합 때문에 어긋날 수 있다는 점만 인지해 두면 된다 — 현재 코드베이스에는 그런 패턴이 없음을 확인했다.

- **[INFO]** `synchronize: false` 로 전 DataSource 가 고정돼 있어, 이번 컬럼 데코레이터 변경(`type`/`enumName`/`default`)이 앱 기동 시 자동 DDL 을 유발하지 않는다
  - 위치: `codebase/backend/src/app.module.ts:112`, `codebase/backend/src/modules/knowledge-base/eval/eval-cli.module.ts:49`, `codebase/backend/src/scripts/encrypt-auth-config.ts:53`
  - 상세: 세 DataSource 정의 전부 `synchronize: false` 를 명시해, 엔티티 메타데이터가 실제 DB 와 달라도(혹은 이번처럼 실제 DB 에 맞게 정정돼도) TypeORM 이 자동으로 `ALTER TABLE`/`CREATE TYPE` 등을 실행하지 않는다. 새로 추가된 `entity-schema-declarations.e2e-spec.ts` 의 컬럼 층 테스트도 `createSchemaBuilder().log()`(SQL 기록 전용, 실행 안 함)만 쓰고, 호출 전후 `information_schema.columns`/`pg_type` md5 해시를 직접 비교해 "DB 를 바꾸지 않는다"는 전제를 스스로 검증한다(`codebase/backend/test/entity-schema-declarations.e2e-spec.ts:523-535`) — 실제로 확인차 파일을 열어 해당 어서션을 확인했다. 의도치 않은 파일시스템/DB 부작용 경로는 없다.
  - 제안: 없음 — 확인 목적의 기록.

- **[INFO]** 새 컬럼 층 e2e 테스트가 TypeORM 의 공개 계약이 아닌 내부 API(`driver.createSchemaBuilder().log()`)에 의존한다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:520-545`
  - 상세: 주석(`test:521-522`)도 "공개 계약이 아니라 TypeORM 소스로 확인한 것" 이라고 스스로 명시한다. TypeORM 버전 업그레이드로 `log()` 내부 동작이 바뀌면(예: 카탈로그를 실제로 변경하기 시작하면) 이 테스트가 그 카탈로그 md5 비교 어서션(`:535`)에서 즉시 실패하도록 self-guard 가 이미 들어 있어, 조용한 DB 부작용으로 번질 위험은 낮다. 다만 이 가드 자체가 없다면 향후 TypeORM 마이너 업그레이드가 e2e 스위트 실행 중 실 DB 를 변경하는 회귀를 조용히 통과시켰을 것이라, 그 self-guard 의 존재를 리뷰 기록으로 남긴다.
  - 제안: 없음 — 이미 방어돼 있음.

- **[INFO]** `review/consistency/2026/09/19/{10_58_34,16_54_09}/*` 신규 파일 16개는 코드 변경의 부작용이 아니라 `--impl-prep` 게이트 산출물이다
  - 위치: `review/consistency/2026/09/19/10_58_34/*`, `review/consistency/2026/09/19/16_54_09/*` (파일 12~27)
  - 상세: `CLAUDE.md` "정보 저장 위치" 표가 지정한 정식 저장 경로(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에 그대로 쓰였고, 이번 diff 의 실제 코드 변경(엔티티 8개 컬럼 선언 + 테스트/plan)과 무관한 별도 워크플로(consistency-checker) 실행 결과다. 예상치 못한 파일시스템 변경이 아니라 관례대로의 산출물 저장.
  - 제안: 없음.

## 검토했으나 부작용 아님

- `alert-rule`/`llm-usage-log`/`integration-usage-log`/`workspace-invitation` 의 `type: 'uuid'` 추가, `edge`/`node` 의 `enumName` 추가: 전부 스키마 비교 메타데이터일 뿐이며 `default` 가 없어 `getInsertionReturningColumns()` 대상에 들지 않는다 — RETURNING 절 변화 없음. 실제 물리 컬럼은 diff 이전부터 이미 `uuid`/전용 enum 타입이었으므로(plan 실측 표) Postgres 레벨 값 비교·직렬화 동작도 diff 전후로 달라지지 않는다.
- 해당 모듈들의 서비스·컨트롤러 코드에서 `workspace_id` 등을 raw SQL 로 varchar 로 캐스팅하는 자리 없음(grep 확인) — 타입 메타데이터 정정이 기존 쿼리 동작을 깨뜨릴 표면이 없다.
- 함수/메서드 시그니처, 공개 API(컨트롤러 엔드포인트·DTO) 변경 없음 — 이번 diff 는 엔티티 데코레이터 옵션(`type`/`enumName`/`default`)만 바꾸고 어떤 클래스의 public 메서드 시그니처도 건드리지 않는다. DTO 는 엔티티와 분리돼 있어(`create-model-config.dto.ts` 등) 엔티티 컬럼 메타데이터가 API 계약(Swagger/검증)에 새어 나가지 않는다.
- 환경 변수 읽기/쓰기, 네트워크 호출, 전역 변수 도입/변경 없음.

## 요약

이번 diff 는 8개 TypeORM 엔티티의 `@Column` 옵션(타입·enum 이름·기본값) 정정과 그 정합성을 잡는 e2e 가드 확장이다. 전 DataSource 가 `synchronize: false` 로 고정돼 있어 이 메타데이터 변경이 자동 DDL 을 유발하지 않음을 코드로 확인했고, 유일하게 실질적인 런타임 부작용 표면은 새로 `default` 를 얻은 두 컬럼(`model_config.kind`, `workflow_assistant_session.last_interaction_at`)이 매 INSERT 마다 RETURNING 절에 추가되고 저장 후 엔티티 필드가 DB 라운드트립 값으로 재대입되는 것인데, 이는 TypeORM 소스(`EntityMetadata.getInsertionReturningColumns`)로 직접 재현·확인했고 plan 문서도 이를 예고한 뒤 전체 e2e 로 검증했다고 기록하고 있어 의도치 않은 부작용이라기보다 이미 계측된 저위험 변화다. 새로 추가된 e2e 테스트가 TypeORM 비공개 API(`createSchemaBuilder().log()`)에 의존하지만 호출 전후 DB 카탈로그 해시를 직접 비교하는 self-guard 를 갖추고 있어 향후 그 전제가 깨지면 조용히 넘어가지 않고 테스트가 실패하도록 방어돼 있다. 함수 시그니처·공개 API·전역 상태·환경 변수·네트워크 호출 관점에서는 부작용이 없다.

## 위험도

LOW
