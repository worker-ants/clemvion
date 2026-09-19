# Rationale 연속성 검토 — entity-column-declaration-drift (컬럼 층 가드 확장)

## 검토 대상 정정

프롬프트의 `Target 문서`(`spec/2-navigation/`)는 예산 절단으로 대부분 생략되어 있었고, 프롬프트 말미의
"(main 추가) 예산 절단 보정" 지시에 따라 실제 검토 대상을 다시 특정했다: 이 작업이 실제로 건드리는 것은
`spec/2-navigation/` 이 아니라

- 이미 커밋된 엔티티 아홉 곳 수정(`73bc0f1c3`, `type: 'uuid'` 다섯 · `enumName` 둘 · `default` 둘)
- 워킹트리에 **아직 커밋되지 않은** `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 컬럼 층 가드 확장

이다. `spec/1-data-model.md`(루트 파일이라 scope 로 못 줌) · `plan/in-progress/entity-column-declaration-drift.md` ·
선행 `plan/complete/entity-schema-declaration-drift.md` · 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md`
를 직접 Read/git diff 로 대조했다.

## 발견사항

- **[INFO]** 가드 방향성 반전("컬럼 정의는 이 가드 밖" → "컬럼 층은 양방향") 은 근거를 갖춘 번복이라 문제 아님, 다만 spec Rationale 에는 미러링 안 됨
  - target 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 헤더 주석(워킹트리 diff) — "컬럼 정의(타입 · 기본값 · enum 이름)는 이 가드 밖이다" 를 "컬럼 층은 양방향이다 …" 로 교체
  - 과거 결정 출처: `plan/complete/entity-schema-declaration-drift.md` §"비대상 — 컬럼 층" ("이 PR 의 클래스… 와 층이 달라 트래커에 올린다") 및 그 커밋(`4157bc557`)이 쓴 원 주석 문구
  - 상세: 이전 PR 은 컬럼 층 검사를 명시적으로 **제외**하며 "인덱스·제약 층만 이 가드가 본다" 는 문장을 코드에 박아 두었다. 이번 워킹트리 diff 는 그 문장을 지우고 컬럼 층(타입 · NULL · 기본값 · enum 타입 이름 · 추가 · 삭제)을 **양방향**(선언 초과도 결함, DB 초과도 결함)으로 새로 연다 — 인덱스·제약 층의 기존 원칙("선언 생략은 결함이 아니다", 단방향)과는 반대 방향의 판정을 같은 파일 안에 공존시킨다.
    이것이 "무근거 번복"(점검관점 3)에 해당하는지 확인했다: 트래커 항목(`spec-draft-nullable-notation-followups.md` 4651행)이 이미 "넓히면 «선언 생략» 과 «거짓 선언» 을 가르는 기준부터 정해야 한다" 는 조건을 명시적으로 걸어 두었고, `plan/in-progress/entity-column-declaration-drift.md` 가 "사용자 결정(2026-09-19): «고치고 가드 확장»" 으로 그 조건을 충족한 뒤 착수했다. 아홉 곳을 전부 명시 선언으로 고쳐 "타입을 생략해도 추론값이 선언이 된다" 는 트래커의 우려(생략 vs 거짓 선언 경계가 모호해지는 사례)를 원천적으로 없앴다 — 애매한 경계 없이 UNDECLARED_COLUMNS(완전 미선언, `embedding` 둘)만 예외로 두는 이분법으로 정리됐다. 따라서 이 번복은 **새 근거를 갖춘 번복**이라 점검관점 3 위반은 아니다.
  - 제안: 코드 주석 · plan 파일에는 근거가 충분히 실려 있으나, `spec/1-data-model.md` 의 `## Rationale` "`code:` 에 전용 e2e 가드 셋 (2026-09-19)" 항목은 세 가드 이름만 나열하고 각 가드의 방향성(단방향/양방향) 차이는 적지 않는다. 선행 인덱스·제약 가드의 방향성 설계도 spec Rationale 에 없던 선례이므로 **이번에도 mirroring 을 강제할 근거는 없다** — 다만 다음에 이 가드를 세 번째로 확장하는 사람이 방향성 규칙을 코드 주석에서만 찾게 되므로, 여유가 있다면 위 Rationale 항목에 "인덱스·제약=단방향, 컬럼=양방향" 한 줄을 보강하는 편이 다음 사람에게 낫다(강제 아님).

- **[INFO]** `spec/0-overview.md` Rationale 의 Flyway 채택 배경이 실제 ORM(TypeORM)과 어긋남 — 이번 diff 와 무관한 기존 drift
  - target 위치: 이번 작업 범위 밖(참고용으로 번들에 포함된 `spec/0-overview.md` Rationale)
  - 과거 결정 출처: `spec/0-overview.md` `## Rationale` "### DB 마이그레이션 도구로 Flyway 채택 (§2.8)" — "Backend 가 NestJS + Prisma 를 사용하므로 `prisma migrate` 를 그대로 쓰는 것이 가장 자연스러운 선택지였다", "Prisma client 의 schema 와 Flyway SQL 의 schema 가 이중으로 존재"
  - 상세: 이번 entity-column-drift 작업이 다루는 엔티티 파일은 전부 TypeORM 데코레이터(`@Column`·`@PrimaryGeneratedColumn` 등)이고, `codebase/backend/package.json` 에 `prisma`/`@prisma/*` 의존성이 없다(`typeorm@^0.3.31` 만 있음, `schema.prisma` 파일 없음). 즉 이 문서가 배경으로 든 "Prisma ↔ Flyway 이중 스키마" 전제 자체가 현재 코드베이스와 맞지 않는다 — 실제는 "TypeORM 엔티티 데코레이터 ↔ Flyway SQL" 이중 스키마이고, 이 세션이 지금 고치는 문제(엔티티 선언이 DB 와 다른 아홉 곳)가 바로 그 실제 이중구조의 drift 사례다. 이 오기는 이번 diff 가 만든 것도 아니고 scope 밖이라 이번 작업을 막을 이유는 아니지만, "합의된 원칙"(Flyway 채택 배경) 서술이 실제 아키텍처보다 넓게/다르게 말하고 있어 다음 사람이 "Prisma schema 를 찾아야 하나" 오해할 수 있다.
  - 제안: 별도 planner 턴에서 "Prisma" → "TypeORM 엔티티 데코레이터" 로 정정(트래커에 등재 권장). 이번 plan 의 `spec_impact: none` 판정에는 영향 없음(이 항목은 이번 diff 의 대상 문서가 아님).

## 요약

이번 target(엔티티 아홉 곳 컬럼 선언 수정 + `entity-schema-declarations.e2e-spec.ts` 컬럼 층 가드 확장)은 과거 Rationale 이 명시적으로 기각한 대안을 재도입하지 않았고, 합의된 설계 원칙(Flyway=SoT, `synchronize:false`, 인덱스·제약 가드의 단방향성)을 그대로 보존한 채 별도 층(컬럼)에만 새 규칙을 추가했다. "컬럼 정의는 가드 밖" 이라던 이전 문구의 번복도 트래커에 미리 등재된 미해결 질문("선언 생략 vs 거짓 선언 경계")과 그에 대한 명시적 사용자 결정("고치고 가드 확장")을 근거로 이뤄져, 점검관점 3(무근거 번복)에 해당하지 않는다. 발견된 두 항목은 모두 INFO 수준 — 하나는 새 가드 방향성을 spec Rationale 에 한 줄 보강하면 좋다는 제안(강제 아님, 선례상 필수 아님), 다른 하나는 이번 diff 와 무관하게 이미 존재하던 `spec/0-overview.md` 의 Prisma/TypeORM 서술 drift 발견이다. Rationale 연속성 관점에서 이번 target 을 막을 근거는 없다.

## 위험도

LOW
