# 테스트(Testing) 리뷰 — entity-column-drift-b83f15 (4라운드)

## 범위 확인

실제 코드 변경은 엔티티 컬럼 데코레이터 8건(`alert-rule` · `edge` · `integration-usage-log` · `llm-usage-log` ·
`model-config` · `node` · `workflow-assistant-session` · `workspace-invitation` 엔티티)과, 이를 지키는
`codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 의 컬럼 층 가드 확장이다. `plan/in-progress/*.md` ·
`review/consistency/**` 산출물은 이번 세션의 코드 변경이 아니라 이전 라운드의 검토 기록이라 테스트 관점 평가
대상에서 제외했다. 이미 3라운드(`17_04_28`·`17_25_09`·`17_45_35`)를 거치며 판별력 대조군·읽기 전용 세션·
카탈로그 비교 등 핵심 테스트 갭이 순차적으로 메워졌다 — 아래는 그 이후 남은 것만 다룬다. `entity-schema-declarations.e2e-spec.ts` 는 프롬프트에서 절단돼 저장소 원본을 `Read` 로 직접 열어 전문을 확인했다.

## 발견사항

- **[WARNING]** 읽기 전용 세션의 "예방" 계층 자체는 자동 회귀 테스트가 없다 — 유일한 검증은 1회성 수동 로그 확인
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:545-551` (`installExtensions: false`, `extra: { options: '-c default_transaction_read_only=on' }`)
  - 상세: `plan/in-progress/entity-column-declaration-drift.md` 의 3라운드 보강 기록에 따르면, `initialize()` 가 `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` 를 시도하다 읽기 전용 세션에 거부당하고 TypeORM 이 그 실패를 **조용히 삼키는** 것을 Postgres 서버 로그로 직접 확인해 `installExtensions: false` 를 추가했다. 이 회귀는 애초에 카탈로그 비교(559행 `expect(await catalog()).toEqual(before)`)로 잡히지 않는다 — 확장 생성 시도가 실패해도 catalog 자체는 바뀌지 않기 때문이다. 즉 이 파일 안에는 "예방"(읽기 전용 세션 + `installExtensions: false`) 을 검증하는 자동 단언이 하나도 없고, 누군가 나중에 `installExtensions: false` 를 지우거나 `extra.options` 를 제거해도 이 테스트 스위트는 계속 GREEN 이다 — 조용한 쓰기 시도가 Postgres 에러 로그로만 다시 새어 나갈 뿐 CI 는 알아채지 못한다. plan 문서에 있는 RO1 뮤턴트(읽기 전용 `DataSource` 에서 `build()` 를 먼저 호출)도 저장소 밖 scratch 에서 1회 수동으로만 실행됐고, 이 파일 자체에는 그 시나리오를 재현하는 테스트가 없다.
  - 제안: 두 가지 중 하나를 자동화 대상으로 남길 것을 권장한다 — (1) `installExtensions`/`extra.options` 필드가 의도한 값인지 확인하는 가벼운 구조적 단언(`expect(readOnly.options.installExtensions).toBe(false)` 류)을 컬럼 테스트에 추가해 설정 자체의 회귀를 최소한이라도 잡거나, (2) RO1 뮤턴트(읽기 전용 세션에서 실제 DDL 실행 시도)를 별도 `it()` 로 승격해 "예방" 계층이 실제로 막는지를 라이브로 확인한다. 최소한 두 설정 옵션 옆에 "이 값을 지우면 테스트가 GREEN 인 채로 조용히 회귀한다" 는 경고 주석을 남기면 다음 사람이 실수로 걷어내는 것을 막을 수 있다.

- **[INFO]** `default` 선언 추가(엔티티 `kind`·`lastInteractionAt`)로 인한 `RETURNING` 런타임 변화가 엔티티별 전용 단언 없이 "전체 e2e 통과" 로만 확인됐다 — 다만 실측상 위험은 낮다
  - 위치: `codebase/backend/src/modules/model-config/entities/model-config.entity.ts:46`(`default: 'chat'`), `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:75-79`(`default: () => 'now()'`)
  - 상세: plan 문서가 "`default` 를 선언하면 TypeORM 이 insert 뒤 `RETURNING` 으로 그 컬럼을 받아 엔티티 객체에 채운다... 값은 DB 기본값 그대로라 의미는 같다. e2e 전체로 확인한다" 라고만 적어, 이 특정 동작 변화(예: `kind` 를 생략하고 insert 했을 때 엔티티 객체에 `'chat'` 이 채워지는지)를 겨냥한 단언은 없다. 직접 확인해 보니 두 필드 모두 애플리케이션 계층이 항상 명시적으로 값을 채운다 — `model-config.controller.spec.ts` 는 `kind` 가 없으면 `BadRequestException` 을 던지는 것을 이미 단언하고, `workflow-assistant-session.service.ts:94` 는 세션 생성 시 `lastInteractionAt: now` 를 항상 명시적으로 넣는다. 따라서 새 DB 기본값은 정상 경로에서는 사실상 죽은 코드(안전망)이고, "전체 e2e 통과" 로 충분히 커버된다는 판단은 타당하다.
  - 제안: 조치 불요에 가깝다. 다만 두 컬럼 모두 향후 애플리케이션 계층의 명시적 세팅이 제거되는 리팩터가 있을 경우를 대비해, 이 안전망이 실제로 작동함(예: `kind` 를 생략한 insert 가 `'chat'` 을 돌려준다)을 겨냥한 좁은 통합 테스트를 하나 추가해 두면 "e2e 전체가 우연히 통과했다" 는 반례를 배제할 수 있다.

- **[INFO]** 판별력 대조군 테스트(514-525행)가 DB 없이 도는 순수 함수 테스트인데도 `beforeAll` 의 실DB 연결에 묶여 있다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:514-525` (`it('컬럼 층 패턴 — …')`) 는 `db`/`ds` 를 전혀 참조하지 않는 동기 테스트다
  - 상세: 이 파일의 `beforeAll` 은 `db.connect()` + `ds.initialize()` 를 반드시 거쳐야 하므로, `isColumnLevel`/`COLUMN_LEVEL`/`COLUMN_LEVEL_SAMPLES` 만 검증하는 이 순수 로직 테스트도 e2e DB 가 떠 있어야만 실행된다(DB 가 없으면 `beforeAll` 실패로 이 테스트 자체가 돌지 못한다). 정규화 비교 판별력 테스트(331행)처럼 실제로 DB 가 필요한 테스트와 달리, 이 테스트는 순수 함수라 unit 계층으로 옮기면 DB 기동 없이 더 빠르고 독립적으로 돌 수 있었다.
  - 제안: 이번 가드의 응집성(한 파일에 컬럼 층 로직 전부)을 위해 현재 위치도 합리적인 선택이라 강하게 이동을 요구하진 않지만, 만약 이 파일의 e2e 실행 비용이 향후 문제가 되면 이 대조군 테스트만 `*.spec.ts` unit 계층으로 분리하는 것을 고려할 수 있다.

## 요약

핵심 회귀(아홉 컬럼 선언 각각, 컬럼 층 패턴의 판별력, `log()` 호출 전후 카탈로그 불변)는 이미 촘촘한 뮤테이션
검증(plan 문서의 C1~C9·A1~A2·R1~R2·P1~P4·S1·RO1)을 거쳐 라이브 e2e 테스트(`entity-schema-declarations.e2e-spec.ts`
527행)와 판별력 대조군(514행)으로 자동화돼 있다 — 3라운드에 걸친 이전 리뷰 피드백이 잘 반영됐다. 이번 라운드에서
남은 것은 "탐지"는 되지만 "예방" 계층 자체는 자동 검증되지 않는 좁은 틈(읽기 전용 세션 설정 회귀가 GREEN 을
유지한 채 조용히 재발할 수 있음)과, `default` 추가로 인한 `RETURNING` 런타임 변화가 전용 단언 없이 전체 e2e
통과로만 뒷받침된다는 점(다만 애플리케이션 계층이 이미 두 값을 항상 명시적으로 채우고 있어 실측 위험은 낮음)
정도다. 둘 다 머지를 막을 사유는 아니고, WARNING 1건은 "설정 옵션 회귀가 소리 없이 되돌아갈 수 있다"는
저비용·고가치 보강 여지로 남긴다.

## 위험도

LOW
