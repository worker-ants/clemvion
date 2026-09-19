# 신규 식별자 충돌 검토 — entity-column-declaration-drift (`--impl-prep spec/2-navigation/`)

## 조사 범위 보정
프롬프트의 `spec/2-navigation/` 코퍼스는 대부분 예산 초과로 생략됐으나, 프롬프트 말미의 "(main 추가) 예산 절단 보정" 절이 지시한 대로
이 작업이 실제로 건드리는 대상은 scope 밖 루트 파일 `spec/1-data-model.md` 와 `codebase/backend` 의 엔티티 8개 파일 · e2e 가드
1개 파일이다. `git diff origin/main...HEAD`(커밋된 엔티티 수정)와 워킹트리의 미커밋 변경(`entity-schema-declarations.e2e-spec.ts` 컬럼
층 가드 초안), `plan/in-progress/entity-column-declaration-drift.md`, `spec/1-data-model.md` frontmatter/Rationale 을 직접 Read 로
확인해 신규 식별자 충돌 관점에서 검토했다.

## 발견사항

- **[WARNING]** 완료된 플랜과 진행 중 플랜의 파일명이 한 단어 차이로 매우 유사하다
  - target 신규 식별자: `plan/in-progress/entity-column-declaration-drift.md` (이번 작업, 컬럼 층)
  - 기존 사용처: `plan/complete/entity-schema-declaration-drift.md` (선행 작업 #1354, 인덱스·제약 층)
  - 상세: 두 파일명은 `entity-` + `{column|schema}` + `-declaration-drift.md` 로 한 단어("column" ↔ "schema")만 다르다. 두 플랜은
    실제로 다른 층(컬럼 vs 인덱스·제약)을 다루는 별개 작업이며, 이번 plan 본문·가드 테스트 docstring 모두 서로를 전체 경로로
    명시 교차 참조하고 있어 **문서 내부에서는 혼동 여지가 낮다**. 다만 `grep -l declaration-drift plan/` 처럼 부분 문자열로
    찾거나 대화 중 이름만 언급할 때는 두 작업을 혼동하기 쉽다(완료 vs 진행 중이라는 상태 차이까지 겹치면 "이미 끝난 작업인 줄 알고
    스킵" 하는 실수로 이어질 수 있다).
  - 제안: 이미 진행 중인 작업이라 파일명 변경은 우선순위가 낮다 — 리네임 대신, `plan/complete/` 이동 시 두 파일을 함께 참조하는
    사람을 위해 완료 커밋 메시지·트래커(`spec-draft-nullable-notation-followups.md`)에서 두 항목을 "인덱스·제약 층(#1354, complete)"
    / "컬럼 층(이 작업)" 로 층 이름을 붙여 구분해 표기하는 정도로 충분하다. 실제로 plan 본문이 이미 이렇게 하고 있어 추가 조치는
    선택사항.

- **[INFO]** 신규 module-local 상수 `UNDECLARED_COLUMNS` · `COLUMN_LEVEL` — 충돌 없음, 확인만
  - target 신규 식별자: `UNDECLARED_COLUMNS`(컬럼 층 예외 맵), `COLUMN_LEVEL`(컬럼 정의 변경 문 판별 정규식 배열) —
    `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (미커밋 초안)
  - 기존 사용처: 없음. `export` 가 없어 파일 스코프에 갇혀 있고, 저장소 전체에서 `grep -rn "UNDECLARED_COLUMNS\|COLUMN_LEVEL"` 결과가
    이 파일 내부 5곳뿐이다.
  - 상세: 같은 파일에 기존 상수 `FK_ACTION` 이 있고 이름 규약(대문자 스네이크, 역할을 그대로 서술)이 일관된다. 새 이름 둘 다 다른
    도메인(FK 액션 코드맵)과 겹치지 않고, 다른 e2e 파일의 동명 상수도 없다.
  - 제안: 조치 불요. 충돌 없음 확인 차 기록.

- **[INFO]** enum 타입 이름 `node_category` · `edge_type` (`enumName`) — 신규 식별자 아님, 기존 DB 정의 복원
  - target: `nodes/entities/node.entity.ts` 의 `enumName: 'node_category'`, `edges/entities/edge.entity.ts` 의
    `enumName: 'edge_type'` (이미 커밋됨, `73bc0f1c3`)
  - 기존 사용처: `codebase/backend/migrations/V001__initial_schema.sql`(`CREATE TYPE node_category AS ENUM (...)`,
    `CREATE TYPE edge_type AS ENUM (...)`), `V003__add_trigger_category.sql`(`ALTER TYPE node_category ADD VALUE ...`).
  - 상세: 이 두 이름은 "새로 도입"이 아니라 V001 부터 있던 DB 타입 이름을 엔티티 선언에 뒤늦게 반영한 것이다(드리프트 정정).
    다른 의미로 이미 쓰이는 동명 식별자는 없다 — 충돌 없음.
  - 제안: 조치 불요.

- **[INFO]** 파일 경로 — 신규 spec/e2e 파일 없음
  - `spec/1-data-model.md` frontmatter `code:` 목록에 `entity-schema-declarations.e2e-spec.ts` 는 선행 PR(#1354)에서 이미
    등재돼 있고, 이번 작업은 그 **동일 파일**에 테스트 1개를 추가할 뿐 새 파일 경로를 만들지 않는다. 새 엔티티·DTO·API 파일도 없다.
  - 제안: 조치 불요.

## 요약
이번 작업은 이미 존재하는 DB 스키마 사실(uuid 타입 · enum 타입 이름 · 기본값)을 엔티티 선언에 뒤늦게 반영하는 정정이며, 계획된
가드 확장도 기존 e2e 파일 안에 module-private 상수·테스트 하나를 더하는 수준이라 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·
환경변수·spec 파일 경로 어느 축에서도 기존 사용처와 다른 의미로 충돌하는 신규 식별자는 없다. 유일하게 눈에 띄는 것은 plan 파일명
`entity-column-declaration-drift.md`(진행 중)와 `entity-schema-declaration-drift.md`(완료)가 한 단어만 달라 grep·대화에서
혼동될 수 있다는 점인데, 문서 본문이 이미 서로를 전체 경로로 교차 참조해 실질 위험은 낮다.

## 위험도
LOW
