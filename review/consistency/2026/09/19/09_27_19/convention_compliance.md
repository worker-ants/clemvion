# 정식 규약 준수 검토 — entity-index-drift (`--impl-done`, scope=`spec/3-workflow-editor/`)

## 검토 대상 실제 델타 (예산 절단 확인 후 절대경로로 직접 확인)

- spec 델타(scope 내): `spec/3-workflow-editor/4-ai-assistant.md` (36줄, `ff530fc8a`)
- 구현 diff(7파일): 6개 엔티티(`workflow-assistant-session` · `node-execution` · `node` · `edge` ·
  `integration-expiry-dispatch` · `workspace`)의 인덱스·제약 데코레이터 정정 + 신규 e2e 가드
  `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` (`ffd58da4e`, `6e18aa4d8`)
- 두 commit 모두 `git -C <worktree> diff origin/main...HEAD` 로 직접 대조. `spec/1-data-model.md` 등
  scope 밖 spec 은 변경되지 않았음(diff 0)을 확인.

## 발견사항

이번 라운드에서 신규 CRITICAL·WARNING 은 없다. 앞선 라운드(`08_07_50`)가 잡은 CRITICAL 1 · WARNING 1
(§13 i18n 표의 금지어 "엣지"·보간 문법 혼재·"워크플로" 오탈)은 `ff530fc8a` 로 전부 해소된 상태를
실측으로 재확인했다 — 아래 "확인했으나 위반 없음" 참조. `0-canvas.md`·`5-version-history.md` 의
잔여 INFO(§8.1 예시문 "엣지", Rationale 섹션 부재, id 명명)는 이번 diff 가 그 파일을 건드리지 않아
scope 밖이며 `08_33_13` 라운드가 이미 기록했으므로 반복하지 않는다.

- **[INFO]** 신규 e2e 가드가 `spec/1-data-model.md` frontmatter `code:` 에 등재되지 않음
  - target 위치: `spec/1-data-model.md` frontmatter (`code:` 2개 glob 항목)
  - 위반 규약: 직접 위반은 아님 — `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의("본
    spec 이 약속한 surface 의 구현 경로") 및 같은 컨벤션이 다른 문서(`migrations.md`·`egress-masking.md`
    자신)에서 실제로 지키는 관행("그 규약을 강제/시행하는 가드·테스트 파일을 `code:` 에 함께 등재")과
    비교했을 때의 완결성 관찰
  - 상세: `spec/1-data-model.md` 의 `code:` 는 `codebase/backend/src/modules/**/entities/*.entity.ts` 와
    `codebase/backend/migrations/V*.sql` 두 glob 뿐이라, 이번에 신설된 "선언↔DB 대조" e2e 가드
    (`codebase/backend/test/entity-schema-declarations.e2e-spec.ts`)는 그 경로 트리 밖(`test/`)에 있어
    어느 glob 에도 걸리지 않는다. `spec/1-data-model.md` 는 `spec-impl-evidence.md` §1 의
    `EXCLUDE_BASENAMES`(`1-data-model.md`)에 올라 있어 build 가드(`spec-code-paths.test.ts`) 대상이
    아니므로 이 누락이 CI 를 깨뜨리지는 않는다 — 순수 문서 완결성 문제다.
  - 제안: 이번 PR 의 필수 조치는 아니지만, 다음에 `1-data-model.md §2/§3`(인덱스 전략) 을 편집할 때
    `code:` 에 해당 e2e 파일을 추가해 "이 spec 의 인덱스·제약 서술을 실제로 강제하는 코드가 무엇인지"를
    독자가 frontmatter 만 보고 알 수 있게 하는 편이 `migrations.md` 의 선례(§CI workflow·가드 스크립트를
    `code:` 에 명시)와 일관적이다.

- **[INFO]** 가드 JSDoc 의 `plan/complete/entity-schema-declaration-drift.md` 선인용은 review-citations.md
  적용 범위 밖이지만, 커밋 시점 기준으로는 아직 실존하지 않는 경로다
  - target 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:15`
    (`근거·실측: \`plan/complete/entity-schema-declaration-drift.md\`.`)
  - 위반 규약: 없음 — `spec/conventions/review-citations.md` §3 은 `plan/**` 경로 인용을 명시적으로
    "대상 아님"(그 문서 자체가 맥락을 담는 same-session 인용이라)으로 분류하므로 이 컨벤션의 §2
    (bare `hh_mm_ss` 금지) 규율이 적용되는 자리가 아니다. `plan/in-progress/entity-schema-declaration-drift.md`
    는 아직 이동 전이라 인용된 경로가 이 커밋 시점엔 파일로 존재하지 않는다는 사실만 기록한다.
  - 상세: 이미 앞선 코드 리뷰 라운드(`review/code/2026/09/19/08_54_39` W3, `09_16_00` INFO4)가 같은
    지점을 지적했고 "마무리 커밋의 plan 이동으로 닫는다"로 처분이 확정돼 있다 — 신규 발견이 아니라
    기존 처분을 재확인하는 것.
  - 제안: 조치 불요(이미 계획된 마무리 커밋에서 `plan/in-progress/` → `plan/complete/` 이동으로 해소).
    본 checker 관점에서는 해당 이동이 이 PR 의 마지막 커밋 안에서 실제로 일어나는지만 재확인하면 된다.

## 확인했으나 위반 없음 (양성 결과)

- **§13 i18n 키 표** (`i18n-userguide.md` Principle 3-C·6): `assistant.edgeAdded`/`edgeRemoved` 가
  실제 코드(`dict/{ko,en}/assistant.ts`)와 동일하게 "연결선 추가"/"연결선 삭제"로 정정되어 있음(금지어
  "엣지" 소거 확인). `opAdded`/`opUpdated`/`opRemoved`/`exploreLookup`/`exploreExecutionsList`/
  `exploreExecutionDetails` 6개 키 모두 단일 중괄호 `{label}` 에서 이중 중괄호 `{{label}}` 로 정정돼
  Principle 3-C 의 `interpolate()` + `{{name}}` 컨벤션과 코드 값이 일치함을 실측(`dict/ko/assistant.ts`·
  `dict/en/assistant.ts` grep 대조). `executionNotInScope` 의 "워크플로"→"워크플로우" 오탈도 정정 확인.
  신규 키 `assistant.autoResumedHintShort` 도 ko/en 사전 양쪽에 실존(parity 위반 없음).
- **문체(해요체·금지어)** (`i18n-userguide.md`/glossary Principle 6): `planQuestionsHint`·
  `errorNoLlmConfig`·`errorRateLimit` 의 "···해 주세요" → "···해요" 변경은 글로서리 §5
  "「옵션 값을 넣어주세요」류 수동태 → 「···을 입력해요」능동태" 원칙과 방향이 일치.
- **frontmatter/spec-impl-evidence** (`spec-impl-evidence.md`): `4-ai-assistant.md` frontmatter
  (`id: ai-assistant`, `status: implemented`, `code:` 8개 glob) 는 스키마·basename 규칙 준수. 신규
  e2e 가드 등록 대상인 `plan/in-progress/entity-schema-declaration-drift.md` frontmatter
  (`title`/`status`/`owner`/`worktree`/`started`/`spec_impact: none`) 도 plan-lifecycle §4 필수 필드
  전부 충족, `spec_impact: none` 은 유효한 bare sentinel. `plan/complete/spec-draft-assistant-i18n-table-sync.md`
  의 `spec_impact:` 리스트도 실재 spec 경로 1건으로 Gate C 형식 충족.
- **DB 식별자 명명** (마이그레이션과의 정합, `migrations.md` 관점): 신규로 명명을 결정한 것이 없다 —
  엔티티에 새로 붙인 `chk_no_self_loop`·`chk_node_placement`·`idx_node_execution_exec_status_active`·
  `idx_workflow_assistant_session_wf_user_active`·`idx_workflow_assistant_session_user_recent`·
  `uq_workspace_personal_owner` 전부 기존 마이그레이션(V001·V019·V095·V109)이 이미 쓰던 실제 DB
  객체 이름을 그대로 옮긴 것임을 마이그레이션 SQL 원문과 대조해 확인. `IntegrationExpiryDispatch` 의
  `@Unique` 이름 제거도 V009 원문이 이름 없는 `UNIQUE(...)` 임과 일치.
  Append-only 원칙 위반 없음 — 이번 PR 은 `codebase/backend/migrations/**` 를 전혀 수정하지 않음(diff 0,
  `synchronize:false` 이므로 신규 마이그레이션도 불요).
- **e2e 테스트 파일 명명**: `entity-schema-declarations.e2e-spec.ts` 는 `codebase/backend/test/` 의 기존
  `<kebab-case-descriptor>.e2e-spec.ts` 명명 관례(`deletion-cascade-indexes.e2e-spec.ts` 등)와 일치.
- **API 문서 규약** (`swagger.md`): 이번 diff 의 6개 엔티티·1개 e2e 파일 중 `@ApiProperty` 등 Swagger
  데코레이터를 쓰는 곳이 없어(grep 0건) 이 축은 해당 사항 없음.
- **raw SQL 결과 읽기 규약** (`raw-query-results.md`): 신규 e2e 파일은 `pg.Client` 직접 사용이며
  `UPDATE`/`DELETE ... RETURNING` 패턴이 없어(grep 0건) 해당 사항 없음.
- **egress 마스킹 좌표계** (`egress-masking.md`): 이번 diff 는 이 좌표계의 소비처(§1 표)를 건드리지
  않음 — 무관.

## 요약

이번 라운드(`--impl-done`)에서 검토한 실제 델타(엔티티 6개의 인덱스·제약 데코레이터 정정, 신규 e2e
선언↔DB 대조 가드, `4-ai-assistant.md` §13 i18n 표 동기화)는 `spec/conventions/**` 전반에 대해 CRITICAL·
WARNING 급 위반이 없다. 직전 라운드가 잡았던 i18n 금지어·보간 문법·오탈 CRITICAL/WARNING 은 커밋
`ff530fc8a` 로 실제 사전 값과 일치하도록 정정된 것을 코드와 직접 대조해 재확인했다. DB 식별자(인덱스·
제약 이름)는 전부 기존 마이그레이션이 이미 확정한 이름을 그대로 반영한 정정이라 신규 명명 규약
위반의 여지가 없고, append-only 원칙도 지켜졌다(마이그레이션 파일 무수정). 발견한 두 건은 모두 INFO
수준 — (1) 신규 e2e 가드가 `spec/1-data-model.md` frontmatter `code:` 에 등재되지 않은 문서 완결성
관찰(빌드 비차단), (2) 가드 JSDoc 의 `plan/complete/...` 선인용이 review-citations.md 적용 범위 밖이며
이미 이전 코드 리뷰 라운드가 "마무리 커밋에서 해소"로 처분을 확정한 항목의 재확인 — 이며 둘 다 이번
PR 을 차단할 사유가 아니다.

## 위험도

NONE
