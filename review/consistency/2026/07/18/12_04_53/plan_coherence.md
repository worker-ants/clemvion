### 발견사항

- **[WARNING]** Target 문서 페이로드가 실제 diff scope 와 무관 — 이미 추적된 harness 버그의 재현
  - target 위치: 본 호출의 "Target 문서" 전체 (`spec/conventions/audit-actions.md` + `spec/conventions/cafe24-api-catalog/**` 대용량 덤프, 약 1500줄)
  - 관련 plan: `plan/in-progress/interaction-type-guard-comment-false-negative.md` 후속 항목 `[harness, 비차단]`(라인 125-128) — "consistency 번들러가 `cafe24-api-catalog/**` 대용량 덤프에 밀려 target spec 본문을 누락하는 문제 … 기존 known failure pattern 이며 이번에도 재현"
  - 상세: 현재 워크트리(`interaction-type-guard-followup-bd683a`)의 실제 미커밋 diff(`git diff origin/main --stat`)는 `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 와 그 테스트 파일 2개뿐이며, `spec/conventions/` 아래 어떤 파일도 건드리지 않는다. 이 작업의 진짜 spec 연결점은 plan frontmatter `spec_impact: spec/conventions/interaction-type-registry.md` 다. 그런데 본 호출에 전달된 "Target 문서" 는 `interaction-type-registry.md` 를 전혀 포함하지 않고 대신 `audit-actions.md` + `cafe24-api-catalog/_overview.md` + `application.md` + 하위 entity 파일 다수(무관한 카탈로그 데이터, 최종 커밋 `d4b774f10`/`c234dcc6b` 로 이미 종결된 오래된 내용)로 채워져 있다. 이는 plan 이 이미 문서화한 "대용량 카탈로그 덤프가 실제 target spec 본문을 밀어낸다" 패턴이 이번 호출에서 **완전히(부분 누락이 아니라 100%) 재현**된 것으로 보인다.
  - 제안: 이 결과만으로는 실제 target(`interaction-type-registry.md`) 대비 plan 정합성을 판정할 수 없다 — 아래 발견사항은 페이로드 대신 실제 git diff/plan 파일을 직접 대조해 얻은 것이다. orchestrator 는 번들러의 파일 선택/크기 예산 로직을 점검해야 한다(이미 plan 라인 125-128 에 non-blocking 으로 등재돼 있으나, "일부 누락"이 아니라 "target 전체 치환"까지 발생함을 이번 재현으로 추가해 둘 것을 권장).

- **[WARNING]** plan 후속 체크박스가 실제 코드 상태를 반영하지 못함 (아직 미커밋)
  - target 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` (JSDoc "grep 가드"→"AST 가드" 3곳 정정), `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (union 타입 선언·객체 프로퍼티 값 fixture, regex 리터럴 비오염 케이스 `ghost_regex`, `.tsx` `ScriptKind` 분기 테스트 신설) — 둘 다 `git diff origin/main` 상 아직 **작업 트리 변경(미커밋)**
  - 관련 plan: `plan/in-progress/interaction-type-guard-comment-false-negative.md` §"후속 (본 PR 범위 밖)" 라인 118-124, 두 항목 모두 `[developer, 선택]` 로 `- [ ]` 미체크
  - 상세: 현재 diff 는 라인 118 항목("`lib/conversation/interaction-type-registry.ts` 상단 JSDoc · `IS_MULTI_TURN_INTERACTION` 위 주석의 'grep 가드' 표현 → 'AST 가드' 정정")과 라인 121 항목("self-test fixture 보강: union 타입 선언·객체 프로퍼티 값 형태 추가, 정규식 리터럴 비오염 케이스, `.tsx` 확장 시 `ts.ScriptKind` 분기") 둘 다 문언 그대로 구현한 것으로 확인된다. 그러나 plan 파일 자체는 이번 워크트리에서 전혀 수정되지 않았다(`git diff origin/main --stat -- plan/` 결과 없음) — 체크박스가 여전히 `[ ]` 다. `.claude/docs/plan-lifecycle.md` 관례("plan 체크박스 = 실제 상태 — 수행 후에만 체크하고 그 커밋에 포함")에 따르면 이 커밋에 체크박스 갱신이 동반돼야 한다.
  - 제안: 이번 커밋에 `interaction-type-guard-comment-false-negative.md` 라인 118·121 을 `[x]` 로 갱신하고 해소 근거(diff 요약)를 덧붙일 것. 두 항목이 모두 해소되면 "후속" 절의 남은 항목은 라인 125 `[harness, 비차단]` 하나뿐이므로, §"종결 조건"(라인 130-132) 재평가가 가능해진다 — 다만 harness 항목이 이번 호출로 다시 재현됐으므로(위 첫 번째 발견사항) 아직 `complete/` 이관 조건은 미충족이다.

- **[INFO]** 우발적으로 포함된 target(audit-actions.md, cafe24-api-catalog) 자체는 plan 과 정합 — 실질 충돌 없음
  - target 위치: `spec/conventions/audit-actions.md` §3 레지스트리(workflow/trigger/schedule/model_config "미구현" 표기), `spec/conventions/cafe24-api-catalog/_overview.md` §5 Coverage Matrix(합계 485/0)
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` G-1~G-4, `plan/in-progress/spec-drift-ai-agent-outport-countmax.md`(485 교차검증 인용)
  - 상세: `cafe24-backlog-residual.md` 의 G-1-remaining·G-2·G-3(a~m)·G-3l 은 전부 완료로 체크돼 있고, target 의 coverage 485/0·`KNOWN_DOCS_ABSENT` 0 서술과 정확히 일치한다. G-4 잔여 1건("재생성 시 자동 정정")은 비차단으로 명시돼 있어 충돌이 아니다. `audit-actions.md` 의 workflow/trigger/schedule/model_config "미구현" 표기와 충돌하는 미해결 결정을 가진 plan 은 `plan/in-progress/**` 전체에서 검색되지 않았다(`audit-actions`/`AUDIT_ACTIONS` grep 0건).
  - 제안: 조치 불필요 — 참고용 기록.

### 요약
본 호출의 "Target 문서" 페이로드는 실제로 검토해야 할 대상(`spec/conventions/interaction-type-registry.md`, plan `interaction-type-guard-comment-false-negative.md` 의 `spec_impact`)을 전혀 포함하지 못하고 무관한 `audit-actions.md`/`cafe24-api-catalog/**` 대용량 덤프로 치환돼 있었다 — 이는 해당 plan 이 이미 non-blocking 으로 추적 중인 harness 결함("대용량 카탈로그 덤프가 target spec 본문을 밀어냄")의 재현이다. 페이로드 대신 실제 git diff 와 plan 파일을 직접 대조한 결과, 진짜 작업(interaction-type registry 의 "grep 가드"→"AST 가드" 문구 정정 + self-test fixture 보강)은 plan 이 명시한 두 개의 선택적 후속 항목을 정확히 구현하고 있어 **결정 충돌이나 선행 조건 미해소는 없다**. 다만 plan 체크박스가 아직 미갱신 상태이므로 커밋 시 함께 갱신이 필요하고, harness 의 target-dump 치환 문제는 이번 재현으로 심각도가 "일부 누락"에서 "완전 치환"으로 격상됐음을 별도 기록해 둘 가치가 있다. 우발적으로 포함된 cafe24/audit 관련 target 자체는 대응 plan 과 완전히 정합해 추가 조치가 불필요하다.

### 위험도
MEDIUM
