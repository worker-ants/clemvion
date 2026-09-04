# 정식 규약 준수 검토 — convention_compliance

## 검토 범위에 대한 조치

prompt_file 이 지정한 target(`spec/`)은 386개 파일이 컨텍스트 예산 초과로 생략되었고
`spec/conventions/` 정식 규약 모음도 `(없음)`으로 비어 있었다(`feedback_consistency_spec_mode_budget.md`
에 기록된 기존 결함과 동일 증상). 프롬프트만으로는 판정이 불가능해 파일시스템에 직접
접근해 재구성했다:

- `git diff origin/main --stat` 로 실제 변경 파일을 특정 — `spec/1-data-model.md`,
  `spec/data-flow/10-triggers.md`, `plan/in-progress/spec-draft-schedule-index.md`(신규),
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(부분 갱신) 4개뿐이었다.
  나머지 380여 개 생략 파일은 이번 diff 와 무관.
- 관련 정식 규약을 직접 Read — `spec/conventions/migrations.md`, `spec/conventions/spec-impl-evidence.md`,
  `.claude/skills/project-planner/SKILL.md`, `.claude/docs/plan-lifecycle.md`.
- 직전 라운드(`review/consistency/2026/09/04/22_34_55/`)의 convention_compliance 결과(NONE,
  INFO 2건)를 대조 기준으로 사용 — 이번 커밋(`713213080`)이 그 INFO 2건을 실제로 해소했는지
  재검증했다.

## 발견사항

(CRITICAL/WARNING 없음)

- **[INFO]** 직전 라운드 INFO 2건이 이번 커밋에서 해소됨 — 새 결함 아님, 확인 기록
  - target 위치: `plan/in-progress/spec-draft-schedule-index.md` frontmatter `started:` /
    "### 답은 (c)" 단락
  - 상세: (1) `started: 2026-09-04` — 세션 현재일(2026-09-04)과 일치, 직전 라운드가 지적한
    "하루 앞섬" 문제 해소. (2) 배수 서술이 "31배"에서 "현재 상태(5.99 ms) 대비 20배"로
    정정되어 표의 median 값(5.99 → 0.30 ms ≈ 19.97배)과 정합, 5,000행 규모의 "6.6배"도
    표 값(0.589/0.089 ≈ 6.6)과 일치.
  - 위반 규약: 해당 없음(규약 위반이 아니라 이전 INFO 의 해소 확인)
  - 제안: 없음.

- **[INFO]** migrations.md §2 V번호 정책 — 실측으로 재확인, 문제 없음
  - target 위치: `spec/1-data-model.md:914`, `spec/data-flow/10-triggers.md:175` 의
    `V110` 표기
  - 위반 규약: `spec/conventions/migrations.md` §2 (V번호는 항상 main max+1)
  - 상세: `ls codebase/backend/migrations` 실측 결과 현재 main 의 max 는 `V109`(및 페어
    `.conf`)이므로 `V110`은 미점유 상태로 정책과 일치한다. 표기 형식(`CONCURRENTLY, V<N>`)도
    같은 표의 기존 관례(`V095`·`V034`·`V048`·`V047`·`V086` 행)와 동일한 패턴을 그대로 따른다.
  - 제안: 없음(발견 아님, 확인 기록). 다만 `migrations.md §5` 절차상 developer 착수 직전
    재확인이 필요하다는 점은 직전 라운드 INFO #4 가 이미 지적했으므로 중복 언급하지 않는다.

## 검토 내용 요약 (관점별)

1. **명명 규약** — 신규 plan 파일명 `spec-draft-schedule-index.md` 는 `project-planner/SKILL.md`
   §명명 컨벤션의 `plan/in-progress/spec-draft-<name>.md` 패턴을 따른다. 마이그레이션 번호
   `V110` 은 `migrations.md` §1·§2 (단조 증가, snake_case, alphanumeric suffix 없음) 준수.
   인덱스 열 표기(`(workspace_id, next_run_at)`)도 기존 표의 컬럼 튜플 표기 관례와 동일.
2. **출력 포맷 규약** — 이번 변경은 API 응답/이벤트 페이로드/에러 코드를 건드리지 않는다
   (DB 인덱스·spec 서술 한정). `spec/conventions/swagger.md`·`error-codes.md`·`node-output.md`
   적용 대상 아님.
3. **문서 구조 규약** — `spec-draft-schedule-index.md` 는 `project-planner/SKILL.md` L31 이
   요구하는 "draft 본문 끝에 `## Rationale`" 을 충족(L199 `## Rationale`, 하위에 "왜 (d) 가
   아니라 (c) 인가"·"기각한 대안" 서브섹션 포함 — Rationale 관례인 "기각된 대안" 서술도
   실측(§1·§2)에 근거해 실제 이력을 반영). frontmatter 는 `plan-lifecycle.md §4` 3필드
   스키마(`worktree`/`started`/`owner`) 를 모두 충족.
4. **API 문서 규약** — 해당 변경 범위 밖(OpenAPI/DTO 변경 없음).
5. **금지 항목** — `spec-impl-evidence.md §1` 제외 목록(`EXCLUDE_BASENAMES`)에 `1-data-model.md`
   가 명시 등재돼 있어, 이 문서의 `status: implemented` frontmatter 는애초에 frontmatter-evidence
   가드 대상이 아니다 — 즉 "V110 마이그레이션이 아직 존재하지 않는데 `status: implemented`
   spec 이 그 인덱스를 서술한다"는 것은 **규약 위반처럼 보이지만 §1 제외 규정에 의해
   위반이 아니다**(확인을 위해 실제로 `spec-frontmatter-parse.ts` 대상 판정 조건을 규약
   문서에서 직접 대조함). `spec/data-flow/10-triggers.md` 역시 §1 명시 제외
   (`spec/data-flow/**`, frontmatter 자체 없음)로 동일하게 대상 외. 두 파일 모두 append-only
   위반(§3, 기존 V002 파일 미수정 확인)·outOfOrder 위반도 없음.

## 요약

diff 로 좁혀 본 실제 변경분(`spec/1-data-model.md`·`spec/data-flow/10-triggers.md` 의 Schedule
인덱스 서술 정정 + 이를 뒷받침하는 `plan/in-progress/spec-draft-schedule-index.md` 신설 +
`spec-draft-nullable-notation-followups.md` 의 해당 항목 종결 갱신)은 명명·문서 구조·frontmatter
스키마·마이그레이션 번호 정책 등 정식 규약 전 항목에서 위반이 확인되지 않았다. 직전
라운드(22_34_55)가 지적한 convention 관련 INFO 2건도 이번 커밋에서 실제로 해소된 것을
확인했다. `spec/1-data-model.md`가 아직 존재하지 않는 `V110`을 `status: implemented`
상태로 서술하는 점은 처음엔 §5 항목 위반처럼 보였으나, `spec-impl-evidence.md §1`의
`EXCLUDE_BASENAMES`(1-data-model.md·data-flow/**)에 의해 애초에 그 가드의 적용 대상이
아님을 규약 원문 대조로 확인했다 — 오탐 후보를 실측으로 배제한 것이며 실제 위반은
아니다.

## 위험도

NONE
