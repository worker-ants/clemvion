# 요구사항(Requirement) 리뷰 — entity nullable 배치 2 + fix 라운드

## 검토 방법

- diff 대상 25개 파일(엔티티 9개·`shared/utils/redact-stored-error.{ts,spec.ts}`·plan 문서·
  전 라운드(`16_45_35`) 리뷰 산출물 13개)을 전부 열람.
- 독립 실측으로 plan 문서·RESOLUTION.md 의 정량 주장을 재현: `tsc --noEmit`(변경 파일 관련
  신규 오류 0), `nullable-type-lie-cast.spec.ts` 12/12 PASS, `redact-stored-error.spec.ts`
  34/34 PASS, `prettier --check` 전 변경 파일 통과, AST 기반 스크립트로 "33개 nullable 파일 ·
  27 전부 넓혀짐(기존 18+이번 9) · 6 전부 안 넓혀짐 · 비대칭 0" 재현(plan 표와 정확히 일치).
- `spec/1-data-model.md` 각 필드 표기(`avatar_url`·`oauth_provider`·`oauth_provider_id`·
  `description`·`folder_id`·`endpoint_path`·`last_triggered_at`·`trigger_id`·`finished_at`·
  `duration_ms`·`input_data`·`output_data`·`error`·`executed_by`·`parent_execution_id`·
  `resource_type`·`resource_id`·`email_sent_at`)를 line-level 로 대조 — **전부 일치**.
  `NodeExecution.input_data`(비-nullable, JSONB)와 `NodeExecution.output_data`/`error`
  (nullable, JSONB?)의 비대칭도 spec 표기와 코드가 정확히 일치.
- 하류 null-역참조 가능성: strictNullChecks 켜짐 확인 후 변경된 필드명에 대한 `!` 비-null
  단언 grep — production 코드에 0건.

## 발견사항

- **[WARNING]** `RESOLUTION.md` 가 "INFO#8(신규 헤딩 앞 빈 줄 누락)을 고쳤다"고 주장하지만
  실제로는 고쳐지지 않았다.
  - 위치: `review/code/2026/09/03/16_45_35/RESOLUTION.md:54` (`- **INFO#8** 새 헤딩 앞 빈 줄 —
    W2 정정에 포함됐다.`) vs 실제 대상 `plan/in-progress/entity-nullable-column-type-mismatch.md:171`
    (`## 배치 2 — 비대칭 해소 (완료)`)
  - 상세: 실측 결과 `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 다른 모든
    H2 헤딩(16·26·36·44·50·71·80·107·146행)은 앞에 빈 줄이 있는데, 신규 `## 배치 2`(171행)만
    바로 앞 줄(170행 "...이 배치에 넣지 않는다.")과 빈 줄 없이 붙어 있다. `RESOLUTION.md` 는
    이 항목이 "W2 정정에 포함돼" 처리됐다고 명시했으나 W2 정정(`## 할 일` 상단 안내 문구
    추가)은 이 공백 문제와 무관한 별개 수정이고, 실제 파일에 빈 줄은 추가되지 않았다.
    이 프로젝트가 반복적으로 지적해 온 "실측 없이 고쳤다고 적는" 패턴과 같은 종류의 결함이며,
    다음 사람이 RESOLUTION.md 를 근거로 "이미 처리됨"이라 믿고 재확인을 건너뛸 수 있다.
  - 제안: `plan/in-progress/entity-nullable-column-type-mismatch.md:170`-`171` 사이에 빈 줄 1개
    추가. 사소하지만, `RESOLUTION.md` 의 "미조치" 목록 서술도 함께 정정(허위 완료 주장 제거)
    할 것을 권장.

- **[INFO]** `spec/1-data-model.md §2.9`(또는 대응 절) `Schedule.next_run_at` 표기(non-null
  `Timestamp`) vs 실제 DB/코드(`nullable: true` / `Date | null`) 불일치는 이 diff 가 만든 것이
  아닌 선재 spec 오류다. `plan/in-progress/entity-nullable-column-type-mismatch.md:151-158`
  에 "developer 권한 밖 — planner 턴 후속"으로 정확히 이월돼 있고, 이번 diff 는 그 필드를
  건드리지 않았다(스코프 밖 확인). 이 diff 대상인 `lastRunAt` 은 정정 완료 상태이며 spec
  표기(`last_run_at | Timestamp?`)와 일치한다. 조치 불요.

- **[INFO]** 관계(`ManyToOne`) 필드(`trigger`/`executor`/`parentExecution`/`container`/
  `toolOwner`/`folder`/`parentNodeExecution`)의 `T | null` 확장은 `spec/1-data-model.md` 가
  FK 컬럼(id)만 명세하고 navigation property 자체는 명세 대상으로 삼지 않는 회색지대다 —
  spec 위반이 아니라 spec 침묵 영역. relation `| null` 관례는 기존 6건이 이미 그렇게 프로덕션
  에서 돌고 있었다는 plan 의 실측(§배치 2)과 일치해 새로운 리스크가 아니다.

- **[INFO]** `maskIfPresent`/`redactNodeExecutionRowForResponse` 시그니처 확장은 함수명·
  docstring 이 서술하는 동작(부재 시 원본 참조 보존, copy-on-change)과 실제 구현이 정확히
  일치한다. 특히 `redactNodeExecutionRowForResponse` 의 제네릭 제약이 `inputData` 도
  `Record<string, unknown> | null` 로 넓어졌지만, 실제 `NodeExecution.inputData` 는 여전히
  non-null(narrower) 타입이라 구조적 서브타입 관계로 문제없이 대입된다 — 과잉 확장이지만
  버그는 아니다(`tsc` 신규 오류 0으로 확인).

- TODO/FIXME/HACK/XXX 주석: 변경된 11개 코드 파일 전수 grep 결과 0건.

## 요약

이번 diff(entity nullable 타입 정합화 배치 2 + 전 라운드 WARNING 4건 fix)는 TypeORM 엔티티
TS 타입을 실제 DB `nullable: true` 상태·`spec/1-data-model.md` 명세와 맞추는 순수 정적
정합화로, 런타임 동작·API 계약에 영향이 없음을 독립적으로(tsc·가드 테스트·AST 카운트 재현·
spec line-level 대조·`!` 단언 grep) 재확인했다. `redact-stored-error.ts`/`.spec.ts` 의
자기-반증형 소정정도 실제로 정확하고 시그니처·테스트가 정합하다. 유일한 발견은 전 라운드
`RESOLUTION.md` 가 "고쳤다"고 주장한 INFO#8(빈 줄 누락)이 실제로는 고쳐지지 않은 것으로,
기능에는 영향이 없으나 리뷰 문서 자체의 정확성 결함이라 WARNING 으로 기록한다. CRITICAL 은
없다.

## 위험도

LOW
