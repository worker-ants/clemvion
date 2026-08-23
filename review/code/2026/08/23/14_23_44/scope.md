# 변경 범위(Scope) 리뷰 — masking-gate-consolidation

## 발견사항

- **[WARNING] `developer` 역할이 `spec/` 을 직접 수정 — CLAUDE.md 권한표 위반**
  - 위치: `spec/conventions/egress-masking.md:83` (게이트 숫자, unified diff 기준 — 취소선 처리된 문장), 신규 삽입 `spec/conventions/egress-masking.md:85`~`92`
  - 상세: 이 커밋(9eb285129)은 `codebase/**`·`plan/**` 외에 `spec/conventions/egress-masking.md` §3 의 "알려진 stale 트리거" 문단을 직접 정정했다. CLAUDE.md 의 Skill 체계 표는 `developer` 쓰기 권한을 `codebase/**, plan/**, review/**/RESOLUTION.md` 로 명시하고 **`spec/` 는 read-only** 라 못 박았으며, "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 이라고 별도로 강조한다. 내용 자체는 이 작업이 실측으로 반증한 자기 예고를 취소선+정정하는 것이라 사실관계는 정확하고 위험도는 낮지만, 절차상 이 파일을 건드릴 권한은 `project-planner` 에게 있다. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 트래커 항목 자체가 "착수 시 이 표를 동반 갱신한다" 라고 사전에 지시해 두었다는 점에서 계획된 반경 안의 수정이긴 하나, 그 지시가 `spec/` 쓰기 권한을 developer 에게 위임하는 근거가 되지는 않는다 — 트래커 문구도 결국 project-planner 소관 문서다.
  - 제안: 다음 라운드에서는 이 정정을 별도 `project-planner` 턴으로 넘기거나(권장), 최소한 developer 가 `spec/` 을 직접 건드릴 수 있는 예외 조건(예: 자기 자신이 만든 예측을 실측으로 반증하는 1~2문장 정정)이 있다면 CLAUDE.md 에 명문화해 이런 경계 모호성을 없앨 것을 제안한다.

## 정합성 확인 (문제 없음)

- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` — import 교체(`redactStoredDataForResponse`/`redactStoredErrorForResponse` → `redactStoredFieldsForResponse`)와 `toNodeExecutionDto` 내 3줄 마스킹 호출을 스프레드 1줄로 교체한 것뿐, 문맥 주석은 무변경. 의도된 리팩터 범위와 정확히 일치.
- `codebase/backend/src/modules/executions/executions.service.ts` — `maskIfPresent` 함수(및 그 docstring)를 통째로 `redact-stored-error.ts` 로 **이동**(신규 로직 없음, 본문 바이트 동일), 4개 마스킹 호출부를 헬퍼 호출로 교체, 그 위에 있던 JSDoc(읽기 표면 목록 표·타입 참조)만 새 심볼명에 맞춰 갱신. 임포트도 옛 두 심볼 제거·새 두 심볼 추가로 깨끗하게 정리됐고 잔여 미사용 임포트 없음.
- `codebase/backend/src/shared/utils/redact-stored-error.ts` — 기존 두 함수(`redactStoredErrorForResponse`/`redactStoredDataForResponse`) 본문은 한 글자도 안 건드리고 파일 끝에 신규 함수 3개(`redactStoredFieldsForResponse`/`maskIfPresent`/`redactNodeExecutionRow`)만 추가(diff hunk 가 `@@ -69,3 +69,91 @@` 로 순수 append). 포맷팅 변경이나 무관 정리 없음.
- `plan/in-progress/masking-gate-consolidation.md`(신규) — CLAUDE.md 의 plan frontmatter 스키마(`worktree`/`spec_impact` 등) 준수, 작업 범위·실측·뮤테이션 검증 결과를 기록. 범위 초과 없음.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 해당 트래커 항목 1건만 국소적으로 체크·정정(diff hunk 1개), 문서의 다른 부분은 무변경.
- `review/consistency/2026/08/23/13_55_36/**` (8개 파일) — CLAUDE.md 가 강제하는 `/consistency-check --impl-prep` 의 표준 산출물로, `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 규약을 그대로 따른다. 임의 생성물이 아니라 의무 절차의 부산물.
- 임포트/포맷팅/주석 단독 변경, 기능 확장(over-engineering), 무관 파일 수정은 발견되지 않았다.

## 요약

전체 diff(14파일, +693/−78)는 선언된 작업 — "`inputData`·`outputData`·`error` 마스킹 게이트 4곳을 헬퍼 2개로 통합" — 의 경계 안에 매우 타이트하게 머문다. 코드 변경 3파일은 헬퍼 이동/신설과 4개 호출부 교체 그 이상도 이하도 아니며, 곁다리 리팩터링·기능 확장·포맷팅 뒤섞임·불필요한 임포트 정리는 없다. 유일한 경계 이슈는 `spec/conventions/egress-masking.md` 를 developer 커밋이 직접 수정한 것으로, 내용 자체는 이 작업이 만든 실측(자기 예고 반증)을 정확히 반영해 위험도는 낮지만 CLAUDE.md 의 명시적 역할별 쓰기 권한(`spec/` read-only for developer)과 충돌한다.

## 위험도
LOW
