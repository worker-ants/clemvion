# 테스트(Testing) 리뷰 — 엔티티 컬럼 선언 정정 + 컬럼 층 가드

## 리뷰 범위

- 엔티티 컬럼 선언 수정 8건 (`alert-rule` · `edge` · `integration-usage-log` · `llm-usage-log` · `model-config` · `node` · `workflow-assistant-session` · `workspace-invitation`) — 전부 데코레이터 메타데이터(`type` · `enumName` · `default`)만 바뀌는 순수 선언 변경으로, 런타임 로직이 없어 별도 unit 테스트 대상이 아니다. 검증 수단은 아래 e2e 가드 하나로 적절하다.
- `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` — 기존 인덱스/유니크/CHECK/FK 3종 테스트에 **컬럼 층** 테스트 1개(474~486행)를 신규 추가하고 그에 필요한 `UNDECLARED_COLUMNS`(44~53행) · `COLUMN_LEVEL`(60~66행) 상수를 도입.
- `plan/in-progress/entity-column-declaration-drift.md` — 뮤테이션 검증 근거 기록.

`plan/in-progress/entity-column-declaration-drift.md`·`spec-draft-nullable-notation-followups.md`·`review/consistency/**` 는 code-review 대상이 아닌 산출물/트래커라 테스트 관점 평가에서 제외했다(단, 뮤테이션 근거표는 아래 발견사항에서 대조용으로 인용).

## 발견사항

- **[WARNING]** `COLUMN_LEVEL` 정규식 5개 분기 중 2개(`ADD "..."` 신규 컬럼 추가, `RENAME COLUMN`)가 뮤테이션 검증 밖에 있다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:60-66` (`COLUMN_LEVEL` 정의), `plan/in-progress/entity-column-declaration-drift.md` "실측 — 가드 뮤턴트" 표
  - 상세: plan 문서는 C1~C9(아홉 수정을 하나씩 되돌림) + R1/R2(패턴 자체를 뮤테이션)로 가드가 "하중을 받는다"고 주장한다. 그런데 아홉 수정의 실제 성격을 뜯어보면 C1~C5·C8·C9(타입/기본값 변경)는 `ALTER COLUMN` 문으로, C6·C7(`enumName` 추가)은 `ALTER TYPE ... RENAME TO` 문으로 떨어진다 — TypeORM 0.3.31 `PostgresQueryRunner`(`addColumn`/`changeColumn`) 소스로 직접 대조해 확인했다. 즉 아홉 수정 전부와 R1/R2 뮤테이션이 실제로 왕복 검증한 것은 5개 정규식 중 `\bALTER COLUMN\b`와 `^(ALTER|CREATE|DROP) TYPE\b` 두 개뿐이다. `^ALTER TABLE "[^"]+" ADD "`(신규 컬럼 추가)와 `\bRENAME COLUMN\b`는 이번 diff의 어떤 수정도 발생시키지 않아 **한 번도 매치되어 본 적이 없다**. 소스 대조로 문법적으로는 두 패턴이 TypeORM 이 실제로 내는 문자열(`ADD "<col>" <type>`, `RENAME COLUMN "<old>" TO "<new>"`)과 일치함을 확인했지만, 이는 이번 리뷰 시점의 1회성 정적 대조일 뿐 저장소가 반복 실행하며 지켜주는 값이 아니다. 앞으로 누가 오탈자를 내거나 TypeORM 버전업으로 포맷이 바뀌어도 이 가드는 계속 GREEN이고, "컬럼 추가"·"컬럼 이름 변경" 이라는 실제 drift 유형은 조용히 새나간다 — 이 프로젝트가 이미 겪은 "설계 근거는 쓰기 전에 뮤턴트로 반증하라" 교훈이 두 분기에서는 적용되지 않은 상태다.
  - 제안: `COLUMN_LEVEL.some(rx => rx.test(q))` 분류 자체는 순수 문자열 매칭이라 라이브 DB 없이도 테스트 가능하다. 실제 TypeORM DDL 샘플(다섯 패턴 각 1개 + `ADD CONSTRAINT`·`COMMENT ON` 같은 near-miss 2개)을 픽스처로 둔 별도 unit 테스트를 추가해 다섯 분기 전체를 결정적으로 커버할 것.

- **[WARNING]** 신규 컬럼 층 테스트만 트랜잭션/SAVEPOINT 안전장치 없이 TypeORM 비공식 내부 API 를 직접 호출한다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:474-476` (`ds.driver.createSchemaBuilder().log()`)
  - 상세: 같은 파일의 앞 세 테스트(인덱스/유니크 `331행`, CHECK `393행`)는 `inRolledBackTx`(176~183행)로 감싸 임시 테이블 생성 등 부작용을 트랜잭션 ROLLBACK 으로 반드시 되돌린다. 새 테스트는 "`log()` 는 카탈로그를 읽은 뒤 SQL 기록 모드로 DDL 을 모으기만 한다 — DB 를 바꾸지 않는다"는 **주석 하나**에 의존해 아무 보호 장치 없이 `driver.createSchemaBuilder()`(TypeORM `synchronize()` 구현이 내부적으로 쓰는, 공식 문서화되지 않은 API)를 직접 호출한다. TypeORM 마이너/패치 버전업이 이 "읽기 전용" 계약을 조용히 깨면 공유 e2e DB 스키마가 실제로 변경될 수 있고, 그 순간의 유일한 감시자가 바로 이 테스트 자신이라 스스로는 그 사고를 감지할 방법이 없다(이후 테스트들이 엉뚱한 이유로 실패하며 드러날 뿐).
  - 제안: 최소한 `log()` 호출 전후로 대표 테이블 하나의 카탈로그 스냅샷(예: `information_schema.columns` 개수/해시)을 비교해 "정말 안 바뀌었다"를 테스트 스스로 단언하거나, 다른 프로브들과 같은 패턴으로 트랜잭션/SAVEPOINT 로 감싸 방어적으로 만들 것.

## 긍정적으로 확인한 점 (참고, 조치 불요)

- 새 테스트의 두 번째 단언(`[...UNDECLARED_COLUMNS.keys()].filter(q => !columnLevel.includes(q))`, 483~485행)은 "예외 목록이 낡았는지"뿐 아니라 "비교기가 실제로 돌았는지"까지 함께 검증하는 vacuous-pass 방지 설계다 — 이 프로젝트가 겪은 거짓-GREEN 사례(부정 단언의 제3상태, detached 단언 등)를 피하는 좋은 패턴.
- `UNDECLARED_COLUMNS`/`COLUMN_LEVEL` 두 상수 모두 baseline(고친 뒤 326문 중 `embedding` DROP 둘만 남음)과 뮤테이션 A1(예외 제거→RED)·A2(가짜 예외 추가→RED)로 왕복 검증돼, 두 데이터 구조 자체의 정확성은 신뢰할 수 있다.
- 8개 엔티티 파일의 메타데이터 전용 변경(`type`/`enumName`/`default`)은 런타임 서비스 코드(`workflow-assistant-session.service.ts`, `model-config.service.ts` 등)가 해당 컬럼 값을 항상 명시적으로 세팅하는 것을 확인했다 — 새 DB 기본값이 실제로 발동되는 코드 경로가 없으므로 추가 통합 테스트 없이도 회귀 위험이 낮다.
- 기존 인덱스/유니크/CHECK/FK 3개 테스트는 이번 diff 와 무관한 메타데이터(엔티티 목록·관계 자체는 불변)라 회귀 없이 유효하다.

## 요약

리뷰 대상 8개 엔티티 파일은 순수 선언 변경이라 별도 유닛 테스트가 필요 없고, 검증은 신규 추가된 e2e 컬럼 층 가드(`entity-schema-declarations.e2e-spec.ts`) 하나로 수렴하는 설계가 적절하다. 그 가드 자체는 두 단계 단언(드리프트 0건 + 예외 목록 신선도)으로 vacuous-pass 를 스스로 막는 좋은 구조이고, `plan/in-progress/entity-column-declaration-drift.md`에 기록된 뮤테이션 왕복 검증(C1~C9, A1, A2, R1/R2)도 대체로 성실하다. 다만 그 뮤테이션 표가 "다섯 규칙을 검증했다"고 암시하는 것과 달리 실제로 하중을 확인한 것은 `ALTER COLUMN`·`TYPE`류 두 규칙뿐이고, `ADD "..."`(신규 컬럼)·`RENAME COLUMN` 두 규칙은 이번 diff 에서 한 번도 매치될 기회가 없어 검증되지 않은 채로 남았다(소스 대조로 문법적 정확성만 확인). 또한 새 테스트가 유일하게 트랜잭션 보호 없이 TypeORM 비공식 내부 API 를 호출하는 점도, 같은 파일의 기존 패턴과 비교하면 비대칭적인 안전장치 공백이다. 두 가지 모두 지금 당장 결함을 일으키지는 않지만, 다음 사람이 이 가드를 "다섯 패턴 다 검증됐다"고 오신하지 않도록 표시해 둘 가치가 있다.

## 위험도

LOW
