# Plan 정합성 검토 — target: `spec/data-flow/` (--impl-done)

## 컨텍스트 재구성

이번 diff(`origin/main...HEAD`, code_areas 범위)는 `source-scan.ts`/`.spec.ts`,
`update-returning-rows.spec.ts`, `kb-stats.helper.ts`/`.spec.ts` 5개 backend 파일 변경이다.
이는 `plan/in-progress/update-returning-tuple-shape.md`(frontmatter `worktree:
raw-update-guard-scope-0e154c` — 이 워크트리 자신)의 §체크리스트 항목
**"구조적 가드가 '이 3개 파일' 하드코딩이다"**를 "래퍼가 아니라 발견형 가드로" 완료 처리한
작업과 정확히 일치한다. 실제 `git diff --stat` 로 확인하니 `plan/in-progress/
update-returning-tuple-shape.md` 자체도 73줄 갱신되어 있고(diff 프롬프트의 code_areas 필터가
`plan/` 을 제외해 위 diff 블록엔 안 보일 뿐), 그 갱신 내용(허용목록 4-tuple, CTE/변수SQL/
2단계중첩 blind spot 고정, 뮤테이션 표, 4라운드 리뷰 이력)이 코드 diff 와 문장 단위로
정합한다 — plan 문서와 코드가 stale 없이 동기 상태다.

## 발견사항

없음. 아래는 검토 과정에서 확인한 정합 근거이며, CRITICAL/WARNING 급 결함은 발견되지 않았다.

- **미해결 결정과의 충돌 없음**: 이 diff 는 `spec/` 을 전혀 건드리지 않는다(코드+테스트+
  `plan/`+`review/` 만). plan frontmatter 가 명시하듯 "developer 는 `spec/` 쓰기 권한이
  없어 이번 PR 로는 못 넣는다"는 제약을 그대로 지켰다. plan §후속에 남아 있는 두
  `[planner 위임]` 항목(① raw SQL shape 불변식의 `spec/conventions/` 승격, ② 소급 각주
  5건 — `spec/data-flow/2-auth.md` 포함)은 이번 diff 가 시도하지도, 우회하지도 않았다 —
  여전히 미해결 상태로 plan 에 정직하게 남아 있다(이전 라운드 `review/consistency/2026/08/
  30/12_17_21/plan_coherence.md` 가 이미 같은 항목을 WARNING 으로 지적했고, 이번 diff 는
  그 스코프를 건드리지 않았으므로 그 경고가 재발하지도, 해소되지도 않았다).
- **선행 plan 미해소 없음**: `discover()`/`findUnguarded` 가 스캔하는 대상 중
  `execution-engine.service.ts` 의 raw `UPDATE…RETURNING` 지점(`finalizeStalledExhausted`
  등)은 QueryBuilder `.update().returning().execute()` 형태라 애초에 이 가드의 스캔 대상인
  `.query(` 리터럴 축 밖이며, `updateReturningRows` 경유 지점(admission/updateExecutionStatus
  등, 이 plan 이 이미 §처방으로 고정한 8곳)은 새 발견형 가드의 허용목록에 없어도
  `guardCountOf(rel) >= rawCount` 로 정상 통과한다 — `eia-terminal-payload.md`(완료,
  durationMs 종결 payload)나 `ie-resume-turn-boundary-cancel.md`(8라운드 종결, 감사메모
  해소 2026-08-29) 가 이 diff 의 전제인 셈인데, 둘 다 이미 해소된 상태로 직접 확인했다.
- **후속 항목 누락 없음**: `source-scan.ts` 에 추가된 두 함수(`countRawUpdateReturning`/
  `hasRawUpdateReturning`)는 새 import 없이 순수 함수로 남아 있어, `plan/in-progress/
  auth-guard-reflection-hardening.md:338` 가 `__test-utils__` 전체에 걸어 둔 유예 조건
  ("devDependency import 없는 순수 함수인 동안 tsconfig.build.json exclude 불필요")을
  깨지 않는다 — 오히려 그 조건을 그대로 지킨 채 확장했다. 다른 in-progress plan 중
  `updateReturningRows`/`source-scan`/`raw UPDATE`/`countRawUpdateReturning`/
  `findUnguarded` 를 언급하는 파일은 `auth-guard-reflection-hardening.md`·
  `eia-terminal-payload.md`·자기 자신 셋뿐이며 셋 다 확인한 대로 충돌·미반영 없음.

## 요약

이 diff 는 `update-returning-tuple-shape.md` 가 이미 추적 중인 단일 체크리스트 항목("구조적
가드의 손 큐레이션 한계")을 발견형 가드로 완결한 작업이며, plan 문서 자체가 동일 커밋 범위에서
동기 갱신됐다. `spec/` 비접촉, 타 plan 의 미해결 `[planner 위임]` 항목 비접촉·비우회, 선행
전제(플랜 8곳 처방·QueryBuilder 예외·순수 함수 유예 조건) 모두 실측으로 확인된 대로 유지된다.
plan 정합성 관점에서 지적할 결함이 없다.

## 위험도
NONE
