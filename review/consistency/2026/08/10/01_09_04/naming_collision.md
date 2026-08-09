# 신규 식별자 충돌 검토

## 진단 메모 (알려진 결함 대응)

prompt_file 이 지목한 `## 구현 변경 사항` diff 섹션이 번들 예산에 밀려 프롬프트에 없었다. 대신
워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)에서
`git diff origin/main...HEAD --stat` / `git log origin/main..HEAD --oneline` / `Read`(절대경로)로
직접 diff·현재 코드를 확인해 분석했다. 실제 변경 범위는 prompt 의 target(`spec/conventions/`)이
아니라 `.claude/docs/plan-lifecycle.md` §4 신설 게이트 + `codebase/frontend/src/lib/docs/__tests__/`
(plan-scan.ts 신설 등) + 다수 `plan/complete/*.md` frontmatter 정정이었다. orchestrator 가 전달한
"이번에 신설된 식별자" 목록을 기준으로 코드·plan 전수를 직접 grep/Read 해 판정했다.

## 발견사항

- **[WARNING]** 신규 plan frontmatter 필드 `merged_pr` 가 기존 `pr` 필드 관례를 재발명
  - target 신규 식별자: `merged_pr` — `plan/complete/c1-pr2-aiturn-blueprint.md:5` (`merged_pr: 625`, 종전 `status: complete (PR #625 머지)` 자유서술을 분리한 것)
  - 기존 사용처: 동일 의미("이 plan 을 머지한 PR 번호")로 **이미 5개 완료 plan** 이 `pr:` 필드를 쓰고 있다 — `plan/complete/fix-carousel-waiting-status.md:10`(`pr: 498`), `plan/complete/execution-engine-typed-errors.md:7`(`pr: 598, 599`), `plan/complete/fix-presentation-tool-default.md:6`(`pr: 438`), `plan/complete/embedding-model-ux.md:6`(`pr: 492`), `plan/complete/workflow-execution-turn-timing.md:6`(`pr: 445`).
  - 상세: 둘 다 정확히 같은 개념(머지된 PR 번호)을 담는 필드인데 이름이 다르다. `plan-lifecycle.md §4` 는 "`priority`/`status`/`title` 등 추가 필드는 허용" 이라고만 하고 정식 필드명을 지정하지 않아 자유 확산 중이었고, 이번 신규 파일이 기존 관례(`pr`)를 알지 못한 채 `merged_pr` 을 새로 만들었다. 참고로 직전 code-review(`review/code/2026/08/09/23_43_28/scope.md`)가 이미 이 필드의 스키마 미등재를 INFO 로 지적했으나, 그 리뷰는 "저장소 전수 검색 결과 `merged_pr:` 필드는 이 파일 1건에만 존재한다(신규 1회성 필드)"라고만 확인했다 — 리터럴 `merged_pr:` 로만 검색해 동의어 `pr:` 관례의 존재를 놓쳤다. 즉 "1회성 신규 필드"라는 그 리뷰의 전제 자체가 절반만 맞다: 이름은 1회성이지만 개념은 기존 관례의 병행 재발명이다.
  - 제안: 새 필드를 기존 관례에 맞춰 `pr: 625` 로 통일하거나, 의도적으로 다른 이름이 필요하면(예: `merged_pr` 이 향후 다른 의미로 확장될 계획이 있다면) `plan-lifecycle.md §4` 에 두 필드의 구분을 명시할 것. 현재는 어느 게이트/오디트도 이 필드를 읽지 않아(코드 전수 검색 결과 `.pr`/`frontmatter.pr` 참조 0건) 기능 파손은 없지만, 향후 `/spec-coverage` 류 grep 기반 감사나 신규 게이트가 한쪽 필드명만 읽으면 나머지가 조용히 누락된다.

- **[WARNING]** `TERMINAL_STATUSES` — backend 전역에서 이미 다른 도메인 의미로 광범위 사용 중인 이름을 frontend 신규 상수가 그대로 재사용
  - target 신규 식별자: `TERMINAL_STATUSES` — `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:93` (plan 문서의 종료 `status` 값 집합: `complete`/`implemented`/`applied`/`superseded`)
  - 기존 사용처: 동일 이름이 backend 에 이미 광범위하다 — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:499`(`ExecutionEngineService.TERMINAL_STATUSES`, 워크플로 **실행(execution)** 종료 상태), `codebase/backend/src/modules/external-interaction/interaction.service.ts:44`, 그리고 `codebase/backend/test/*.e2e-spec.ts` 10여 개 파일(`const TERMINAL_STATUSES = ['completed','failed','cancelled']`) — 전부 "실행 종료 상태"라는 별개 도메인 의미.
  - 상세: 이름은 동일하지만 가리키는 개념이 전혀 다르다(plan 문서 라이프사이클 vs 워크플로 실행 상태). TS 모듈 스코프가 분리돼 있고(backend↔frontend 간 import 없음) 코드 레벨 실충돌은 없으나, 이 저장소는 grep 기반 전수 감사(`/spec-coverage`, 수동 조사)에 크게 의존하는 관례가 있고 과거에도 "grep 한 철자만 보면 타언어/타도메인 표현을 놓친다"는 실패가 반복 기록돼 있다. `TERMINAL_STATUSES` 로 전수 grep 하면 두 도메인이 뒤섞여 나오고, "종료 상태 집합"이라는 이름만으로는 실행 상태용인지 plan 문서용인지 구분되지 않는다.
  - 제안: 급한 파손은 없으므로 차단 사유는 아니나, `PLAN_TERMINAL_STATUSES` 처럼 도메인 접두를 붙이면 grep 가독성과 향후 감사 도구의 오분류를 예방할 수 있다.

- **[WARNING]** `collectCompletePlanMarkdown`(신규) 와 `collectCompletePlans`(기존, Gate C) — 이름 유사 + 순회 로직 완전 중복, 이번 통합에서 누락
  - target 신규 식별자: `collectCompletePlanMarkdown` — `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:81`
  - 기존 사용처: `collectCompletePlans` — `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59` (module-private, export 안 됨)
  - 상세: 두 함수는 `plan/complete/**` 를 순회하며 `archive/` 디렉터리 제외, `0-`/`_` 접두 파일 제외라는 **동일한 규칙**을 각각 손으로 재구현한다(`walkPlanMarkdown` 의 `recurse: true` 분기와 `collectCompletePlans` 의 while-stack 순회가 1:1 대응). `plan-scan.ts` 자신의 모듈 헤더 코멘트가 "이 저장소에 plan 트리를 순회하는 walker 가 네 벌 있었고 서로 조용히 어긋났다 → 하나(`walkPlanMarkdown`)로 합친다"고 명시적으로 선언하는데, 정작 Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 는 그 "네 벌" 중 하나로 인용만 되고(주석: "Gate C(`collectCompletePlans`)와 ... 같은 면제 규칙을 쓴다") 실제 통합 대상에서는 빠졌다. 이름도 `collectCompletePlans` vs `collectCompletePlanMarkdown` 로 한 단어(`Markdown`) 차이라 grep·자동완성 시 어느 쪽이 정본인지 헷갈리기 쉽다.
  - 제안: 이번 PR 이 표방한 "스캔 소스 단일화" 원칙을 끝까지 적용해 Gate C 도 `collectCompletePlanMarkdown`(또는 `plan-scan.ts` 의 `walkPlanMarkdown`)을 재사용하도록 리팩터하거나, 당장 안 한다면 두 함수 중 한쪽의 제외 규칙이 바뀔 때 반대쪽도 갱신해야 한다는 사실을 두 파일 모두에 상호 참조 코멘트로 명시해 둘 것.

- **[INFO]** `collectLivePlanMarkdown` 이 두 개의 import 경로로 동시에 노출됨 (`plan-scan.ts` 정본 + `spec-links.ts` 재-export)
  - 상세: `spec-links.ts:17`에서 `plan-scan`으로부터 import 한 뒤 `spec-links.ts:289`에서 `export { collectLivePlanMarkdown };`로 재노출한다. `spec-links.test.ts:6`는 여전히 `spec-links`쪽 경로로 import 하는 반면, `plan-frontmatter.test.ts:9`·`plan-scan.test.ts:8`는 `plan-scan`에서 직접 import 한다. 동일 함수 참조(re-export)라 기능적 충돌·의미 차이는 없지만, "스캔 소스는 하나" 라는 이 PR 의 취지와 달리 소비 경로는 두 갈래로 남아 있다.
  - 제안: `spec-links.test.ts` 의 import 를 `./plan-scan` 직접 참조로 정리하고, 외부 소비자가 남아 있지 않다면 `spec-links.ts` 의 재-export 를 제거(또는 유지 사유를 주석으로 남길 것).

- **[INFO]** `PlanMdFile` 신규 인터페이스 — 이름 충돌은 아니나 기존 `SpecMdFile`/`SpecRecord` 와 필드 구조 완전 동일
  - 상세: `PlanMdFile { absPath, relPath }`(`plan-scan.ts:24`)는 `SpecMdFile { absPath, relPath }`(`spec-links.ts:119`)와 필드가 100% 동일하다. `Plan`/`Spec` 접두가 명확히 구분돼 있어 명명 자체는 문제없고 실제 충돌 아님 — 참고로만 남긴다(공유 타입으로 통합할 여지는 있으나 본 검토 범위 밖).

- **요구사항 ID / API endpoint / 이벤트·메시지명 / 파일 경로 충돌**: 해당 없음. 이번 변경은 `.claude/docs/plan-lifecycle.md`(내부 운영 문서) + frontend build-guard 테스트 헬퍼 + `plan/complete/*.md` frontmatter 정정으로, 새 요구사항 ID·API endpoint·webhook/queue/SSE 이벤트명을 도입하지 않는다. 신규 파일 `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` 의 경로도 같은 디렉터리의 기존 관례(`spec-links.ts`, `spec-frontmatter-parse.ts` — non-test 헬퍼를 `__tests__/` 안에 두는 패턴)를 그대로 따르며 기존 파일과 겹치지 않는다.

## 요약

기능을 깨는 CRITICAL 충돌은 없다. 다만 세 건의 WARNING 이 같은 성격을 공유한다 — 신규 식별자(`merged_pr`, `TERMINAL_STATUSES`, `collectCompletePlanMarkdown`)가 저장소 어딘가에 이미 존재하는 **동의어/유사 로직**을 인지하지 못한 채 병행 도입됐다. `merged_pr`↔`pr` 은 plan frontmatter 스키마가 두 이름으로 분절되는 문제이고(직전 코드 리뷰가 리터럴 검색만으로 "1회성"이라 오판했던 지점), `TERMINAL_STATUSES` 는 backend 실행-상태 도메인과 이름이 겹쳐 grep 기반 감사 도구의 오분류 소지가 있으며, `collectCompletePlanMarkdown`↔`collectCompletePlans` 는 이 PR 자신이 선언한 "스캔 소스 단일화" 목표를 Gate C 한 곳에서만 놓친 것이다. 셋 다 현재는 조용히 공존할 뿐 즉시 파손을 일으키지 않지만, 향후 한쪽만 읽는 자동화(감사 스크립트·신규 게이트)가 추가되는 순간 데이터 누락으로 이어질 수 있어 후속 정리를 권한다.

## 위험도

MEDIUM
STATUS=success
