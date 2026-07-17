### 발견사항

- **[INFO]** target 문서 번들에 실제 관련 spec(`interaction-type-registry.md`) 본문이 누락됨 — 별도 검증으로 보완
  - target 위치: prompt 의 "구현 대상 spec 영역: `spec/conventions/`" 번들 (`_prompts/cross_spec.md` L42~1655)
  - 충돌 대상: 없음 — 번들링 자체의 이슈
  - 상세: 이번 diff(`interaction-type-exhaustiveness.test.ts`, 정규식→TS AST 파싱 전환)가 SoT 로 참조하는 `spec/conventions/interaction-type-registry.md` 전문이 번들에 전혀 포함되지 않았다. 대신 `audit-actions.md`·`cafe24-api-catalog/_overview.md`·`application.md`·`application/*.md`(수백 field row) 등 이번 diff 와 무관한 대용량 문서가 알파벳/디렉터리 순으로 크게 자리를 차지했고, `interaction-type-registry.md`(`i-` 로 시작, 디렉터리 순으로 훨씬 뒤)에 도달하기 전에 잘린 것으로 보인다("관련 spec 본문" 부록에는 `interaction-type-registry` 로의 **링크 1건**만 등장, 본문은 없음). 이는 기존에 확인된 "impl-done spec 번들 버그"(target spec 본문 미적재 → 오탐 BLOCK) 와 같은 패턴이다.
  - 제안: 본 checker 는 워킹트리 절대경로로 `spec/conventions/interaction-type-registry.md` 와 실제 diff(`git diff 099f63ccadfdf9ce99d42c7dae0253d2557ae86d..HEAD`)를 직접 읽어 독립 검증했다(아래 요약 참조) — 그 결과에 근거해 CRITICAL 없음으로 판단한다. 향후 동일 번들링 결함 재발 방지를 위해 대용량 카탈로그 디렉터리(`cafe24-api-catalog/**`)를 번들에서 별도 처리하거나 diff 가 실제로 참조하는 `code:`/`spec_impact` 파일을 우선 포함하도록 번들러 개선을 권고(비차단, harness 개선 항목).

- **[INFO]** diff-base 재확인 필요 — `origin/main` 이 fork-point 대비 앞서 있어 그대로 diff 하면 오염됨
  - target 위치: prompt L18 `diff-base=origin/main`
  - 충돌 대상: 없음 — diff-base 산정 이슈
  - 상세: `git merge-base HEAD origin/main` = `099f63ccadfdf9ce99d42c7dae0253d2557ae86d`. `origin/main` 은 이 fork-point 이후 2개 커밋(`cdad5a1ec`, `29aa918a6` — 후자가 `spec/conventions/frontend-layering.md` 신설)을 추가로 포함한다. 따라서 `git diff origin/main`(working tree 기준) 을 그대로 사용하면 `spec/conventions/frontend-layering.md` 삭제·`spec/0-overview.md` 축소 등 **본 PR 이 만들지 않은 변경까지 diff 에 섞여** reverse-diff 오염이 발생한다(기존에 문서화된 실패 패턴과 동일).
  - 제안: fork-point SHA(`099f63ccadfdf9ce99d42c7dae0253d2557ae86d`) 를 diff-base 로 명시해 재산출할 것. 본 checker 는 fork-point 기준 diff 로 재확인했으며, 실제 변경분은 `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` 1개 코드 파일 + `plan/in-progress/interaction-type-guard-comment-false-negative.md` + 이전 세션 `review/consistency/2026/07/17/19_54_00/**` 산출물뿐이다. `spec/**` 파일은 이번 diff 에서 전혀 수정되지 않았다(`git diff <fork-point>..HEAD -- spec/conventions/interaction-type-registry.md` 무출력).

- **[INFO]** "AST 가드" ↔ "grep" 용어 병용은 본 변경 이전부터 존재하며 target 과 무관 — 이미 추적 중인 후속 항목
  - target 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` (정규식 → TS AST 리터럴 수집으로 전환)
  - 충돌 대상: `spec/conventions/interaction-type-registry.md` §1.2 rule 3, §2.1(`system_error`/`rag` 행)의 "grep 대상 파일"/"grep 검증 대상" 표현
  - 상세: `interaction-type-registry.md` 는 이 가드를 최초 도입 시점부터 일관되게 "AST 가드"로 불러왔고(§1.2 rule 3, §2.1 두 행, §5 Rationale), "grep" 은 그 검증 동작(등록 파일에서 문자열 리터럴을 스캔)을 가리키는 부차적 shorthand 로 병용돼 왔다. 이번 diff 는 실제 구현을 `ts.createSourceFile` 기반 진짜 AST 파싱으로 바꿔 그동안 spec 이 불러온 명칭에 **뒤늦게 수렴**시킨 것으로, spec 진술과 모순되지 않는다. 다만 "grep 대상 파일"/"grep 검증 대상" 잔여 표현은 이제 구현 실체(순수 AST, 정규식 완전 제거)와 다소 어긋나 신규 독자에게 오해 소지가 있다 — 이는 이전 `--impl-prep` cross-spec 검토(`review/consistency/2026/07/17/19_54_00/cross_spec.md` INFO #1)가 이미 지적했고, 본 plan 문서(`plan/in-progress/interaction-type-guard-comment-false-negative.md` "후속" 절)도 비차단 후속 항목으로 명시 이월했다.
  - 제안: 신규 조치 불요(중복 보고 방지) — project-planner 가 별도 후속 턴에서 `interaction-type-registry.md` §1.2/§2.1 의 "grep" 표현을 "(AST 스캔) 대상 파일" 류로 다듬는 선택적 doc-sync 만 남는다. 본 PR 의 필수 선행 조건 아님.

- **[INFO]** `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES` 목록·enum 값 목록·SoT 위치는 무변경 확인
  - target 위치: `interaction-type-exhaustiveness.test.ts` L40-44 (`REGISTRY_SITES`), L167-169 (`SOURCE_REGISTRY_SITES`)
  - 충돌 대상: `spec/conventions/interaction-type-registry.md` §1.2 표 (Frontend 처리 분기 열), §2.1 표 (UI 분기 위치 열)
  - 상세: 코드의 `REGISTRY_SITES`(`use-execution-events.ts`/`apply-execution-snapshot.ts`/`use-result-detail-waiting.ts`) 와 `SOURCE_REGISTRY_SITES`(`conversation-utils.ts`) 는 spec §1.2/§2.1 이 나열한 "AST 가드 대상" 파일 집합과 정확히 일치한다. enum 값 소스(`INTERACTION_TYPE_VALUES`/`CONVERSATION_SOURCE_VALUES`, `interaction-type-registry.ts`)도 무변경. 이번 diff 는 매칭 알고리즘(정규식→AST 파싱)만 바꿨을 뿐 매트릭스 구조·등록 사이트·SoT 경로 어느 것도 건드리지 않았다.
  - 제안: 조치 불요.

### 요약
이번 target 의 실제 변경 범위(fork-point `099f63ccadfdf9ce99d42c7dae0253d2557ae86d` 기준 diff 로 확인)는 `interaction-type-exhaustiveness.test.ts` 1개 파일의 **내부 매칭 메커니즘**(정규식 grep → TypeScript 컴파일러 API 기반 AST 리터럴 수집)을 바꾸는 것뿐이며, `spec/**` 은 이번 diff 에서 전혀 수정되지 않았다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 다른 spec 영역과 충돌하지 않는다. 코드가 그동안 spec 이 명명해온 "AST 가드"라는 이름에 실체가 뒤늦게 수렴하는 방향이라 오히려 spec-구현 정합성이 개선됐다. 다만 본 검토용 prompt 번들 자체에 결함이 있었다 — ① `interaction-type-registry.md` 본문이 대용량 `cafe24-api-catalog/**` 덤프에 밀려 번들에서 누락됐고 ② 명시된 `diff-base=origin/main` 이 fork-point 대비 앞서 있어 그대로 쓰면 무관한 삭제(예: `spec/conventions/frontend-layering.md`)까지 diff 에 섞이는 reverse-diff 오염 위험이 있었다. 본 checker 는 워킹트리 절대경로 직접 조회와 fork-point 기준 재계산으로 이를 우회해 독립 검증했으며, 그 결과 실질 cross-spec 충돌은 없다. "grep"/"AST" 용어 병용 잔재는 이미 이전 impl-prep 검토와 plan 문서가 비차단 후속으로 기록해 둔 상태라 신규 보고 대상이 아니다.

### 위험도
NONE
