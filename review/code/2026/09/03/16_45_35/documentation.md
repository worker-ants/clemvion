# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** plan 문서가 실제로 넓혀지지 않은 필드를 "넓혔다" 고 주장한다 — `NodeExecution.inputData`
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:197`
  - 상세: "`NodeExecution.inputData`/`outputData`/`error` 를 넓히자 그 전제가 거짓이 됐고 `tsc` 가 2건으로 잡았다" 라고 적혀 있으나, 실제 diff(`codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts`)에서 넓혀진 필드는 `outputData`·`error`·`interactionData`·`finishedAt`·`durationMs` 뿐이고 **`inputData` 는 diff 에 나타나지 않는다**. 직접 확인한 현재 소스도 `@Column({ name: 'input_data', type: 'jsonb', default: {} })` / `inputData: Record<string, unknown>;` 로 여전히 non-null 이다(69-70행, `nullable: true` 자체가 없음). `redact-stored-error.ts` 의 원래(취소선 처리된) 전제 문구도 "엔티티가 **두** 컬럼을 non-null 로 선언" 이라고 명시해 실제로는 2개(`outputData`, `error`)임을 스스로 확인시켜 준다 — 197행의 3개 나열과 모순된다.
  - 제안: 197행을 `` `NodeExecution.outputData`/`error` `` 로 정정(2개). `inputData` 는 이 배치에서 건드리지 않았고 DB 자체가 `nullable: true` 가 아니므로 대상이 아니었음을 명시하면 향후 audit 이 "inputData 도 nullable 화됐다" 로 오인하는 것을 막는다.

- **[WARNING]** plan 체크리스트가 두 곳으로 쪼개졌다 — `## 할 일` 밖에 새 체크박스 섹션이 생김
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:146`(`## 할 일` 헤딩) vs `:168`(`## 배치 2 — 비대칭 해소 (완료)` 헤딩), 신규 체크박스는 `:203-220`
  - 상세: 이 문서는 원래 `## 할 일` 한 헤딩 아래에 모든 체크박스를 모으는 구조였다(146행). 이번 diff 는 그 헤딩 **아래**에 있던 "배치 2 기준을 정한다" 불릿을 지우고, 대신 `## 할 일` 섹션이 끝난 **뒤**(168행)에 새 H2 `## 배치 2 — 비대칭 해소 (완료)` 를 만들어 그 안에 자체 체크박스(`- [x] 배치 2 기준`, `- [ ] 배치 3 기준` 등, 203-220행)를 넣었다. 결과적으로 이 plan 의 "할 일" 은 이제 두 헤딩(`## 할 일` 과 `## 배치 2 …`)에 분산돼 있고, `## 할 일` 만 훑는 독자는 배치 2/3 관련 체크박스를 놓친다. 이 저장소는 정확히 이 패턴(본문 체크박스 vs 별도 체크리스트 섹션 비동기화)으로 이미 반복 결함을 냈던 이력이 있다.
  - 제안: 배치 2 의 체크박스 5개(203-220행)를 `## 할 일` 섹션 안으로 옮기거나, 최소한 `## 할 일` 상단에 "배치 2 이후 체크박스는 `## 배치 2` 절 참조" 같은 상호 참조 문구를 추가한다.

- **[WARNING]** 항목 `(d) Schedule.lastRunAt` 이 "완료" 와 "미해결 후보" 로 동시에 표기돼 있다
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:204`(완료 체크) vs `:210-211`(동일 항목이 "배치 3 후보" 목록에 그대로 잔존)
  - 상세: 204행은 `- [x] **(d) `Schedule.lastRunAt`** — 배치 2 에 포함돼 해소` 로 명시적으로 완료 처리했다. 그런데 바로 아래 "배치 3 기준" 후보 목록(원래 "배치 2 기준을 정한다" 불릿 아래 있던 (a)~(e) 후보 나열이 이번 diff 에서 손대지 않고 그대로 "배치 3 기준" 으로 재라벨링됨)에는 여전히 `**(d) `Schedule.lastRunAt`** — `nullable: true` 인데 타입은 `Date` 다 … 비대칭이 남았다` 라는 문장이 취소선·주석 없이 남아 있다. 배치 3 착수 시 이 후보 목록만 보고 (d) 를 다시 작업 대상으로 오인할 수 있다.
  - 제안: 210-211행의 (d) 서술에 취소선을 긋거나 "→ 배치 2 에서 해소, 204행 참조" 주석을 붙인다.

- **[INFO]** 신규 H2 헤딩 앞에 빈 줄 누락
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:167`(직전 리스트 항목 마지막 줄) → `:168`(`## 배치 2 — 비대칭 해소 (완료)`)
  - 상세: 167행("...형제 가드 4개를 함께 건드려야 해 이 배치에 넣지 않는다.")과 168행의 새 헤딩 사이에 빈 줄이 없다. GitHub 렌더러는 관용적으로 처리하지만 CommonMark 엄격 파서에서는 리스트 항목의 연속 문단으로 오인될 여지가 있는 형태다.
  - 제안: 167/168행 사이에 빈 줄 삽입.

- **[INFO]** 새로 확립된 TypeORM nullable 타이핑 규약이 영구 문서(`spec/conventions/`)에 없다
  - 위치: `spec/conventions/`(해당 문서 부재) — 관련 서술은 `plan/in-progress/entity-nullable-column-type-mismatch.md:102-106`("배치 규칙 — 이제 두 단계다": `\| null` 로 넓히고 같은 `@Column` 에 `type:` 이 없으면 명시)
  - 상세: "`nullable: true` 컬럼은 TS 타입도 `\| null` 로 넓히고, `type:` 이 없으면 DB 실제 타입을 조회해 명시한다(안 그러면 `design:type` 이 `Object` 로 방출돼 TypeORM 부팅이 깨진다)" 는 실전에서 검증된 규약이 현재 `repo-guards` 가드 코드와 이 plan 문서에만 존재한다. 이 프로젝트 규약상 "정식 규약" 은 `spec/conventions/<name>.md` 에 두게 돼 있는데, 이 plan 이 `complete/` 로 이동하면(라이프사이클상 예정된 경로) 신규 엔티티 작성자가 이 규약을 발견하기 어려워진다(가드 테스트는 위반을 잡아 주지만 "왜" 를 설명하지 않는다).
  - 제안: 배치 3 완료 시점(또는 plan 종결 시점)에 `spec/conventions/` 에 짧은 규약 문서(또는 `codebase/backend` 쪽 CONTRIBUTING/README) 신설을 고려. 이번 diff 를 막을 정도는 아니라 INFO.

- **[INFO]** `redact-stored-error.ts` docstring 자기정정 — 모범 사례로 확인됨 (조치 불요)
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:128-136`(`maskIfPresent` docstring)
  - 상세: 기존 전제("시그니처가 `\| null` 을 안 적는 것은 의도다")를 삭제하지 않고 취소선으로 보존한 채, 반증 날짜(2026-09-03)·반증 근거(엔티티가 처음부터 `nullable: true` 였다)·정정된 결론을 나란히 남겼다. CLAUDE.md 의 자기반증형 소정정 컨벤션(원문 보존 + 정정 근거 명시)에 정확히 부합하는 좋은 사례라 별도 조치 불필요.

## 요약

리뷰 대상은 대부분 TypeORM 엔티티의 `nullable: true` 컬럼 타입을 `\| null` 로 정합화하는 순수 타입 정정(런타임 동작 불변, e2e/lint/tsc 확인됨)이라 코드 자체의 독스트링·인라인 주석은 건드릴 필요가 없었고 실제로도 스테일해진 주석이 없다. 유일하게 서술을 갱신해야 했던 `redact-stored-error.ts` 는 원문을 취소선으로 보존하며 정정한 모범 사례다. 반대로 `plan/in-progress/entity-nullable-column-type-mismatch.md` 자체에서는 세 가지 정확성/구조 문제(넓히지 않은 `NodeExecution.inputData` 를 넓혔다고 서술, `## 할 일` 체크리스트가 새 헤딩으로 분산, `(d) Schedule.lastRunAt` 항목이 완료·미해결 두 군데에 남음)가 발견됐다 — 코드에 영향은 없지만 이 프로젝트가 반복적으로 데어 온 "plan 서술/체크리스트 비동기" 클래스와 정확히 같은 모양이라 WARNING 으로 표기한다. README·API 문서·CHANGELOG·설정 문서·예제 코드 항목은 이번 변경 범위(내부 타입 정정, 동작 불변)와 무관해 해당 없음으로 판단했다(CHANGELOG 미기재는 동일 이니셔티브의 선행 배치 1 커밋(`255aa8597`)도 마찬가지였던 전례와 일치해 결함으로 보지 않았다).

## 위험도

LOW
