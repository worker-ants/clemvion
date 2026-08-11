# Plan 정합성 검토 — spec-sync-stop-editor-and-forbidden-routes.md

대상: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` (§1·§2·§3 체크박스 처리 +
"실측" 절 신설 + 후속 1건 등재) vs `spec/conventions` 번들(impl-done, diff-base `origin/main`).

## 검증 방법

- `git diff origin/main...HEAD` 로 `spec/conventions/node-cancellation.md` · `swagger.md` ·
  `spec/3-workflow-editor/3-execution.md` · `codebase/backend/src/modules/**/*.controller.ts`
  실제 diff 를 직접 대조.
- §2 "실측" 표의 수치를 **독립 구현**(별도 Python 데코레이터-블록 파서, 2회 재작성)으로 재현.
- `plan/complete/auth-workspace-membership-guard.md`(선행 P0, `status: complete`) ·
  `plan/in-progress/backend-lint-gate-broken-on-main.md`(형제 developer plan) ·
  `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(node-cancellation.md
  에 대해 아직 미해결 결정을 쥔 planner 위임 문서) · `plan/in-progress/node-cancellation-residual-signal-propagation.md`
  (동일 spec 파일의 `pending_plans` 참조 plan) 를 열어 대상 텍스트·파일과의 교차를 확인.

## 발견사항

- **[INFO]** 후속 항목의 section 인용이 부정확하다 (§5-4 → 실제로는 §2-4)
  - target 위치: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md`
    "## 실측" 절 "3번 3건은 조용히 넘기지 않는다" 문단 + "## 후속" 절
    (`workflow-assistant.controller.ts` 401 누락 항목)
  - 관련 plan: 같은 문서 자체(후속 등재 1건)
  - 상세: 두 곳 모두 "401 문서화 누락은 별개 갭이다(§5-4 는 401 도 요구한다)" 라고 적었다.
    그러나 실제로 "보호된 엔드포인트는 기본적으로 `@ApiUnauthorizedResponse` 를 포함합니다"
    라는 401 요구 문구는 `swagger.md` **§2-4 "상태 코드 응답 규칙"**(대상 bundle 라인
    534-547)에 있다. `§5-4 "새 엔드포인트 체크리스트"`(라인 660-671)는 403(`@ApiForbiddenResponse`)
    만 명시적으로 요구하며 401 체크박스는 없다. 401 요구 자체는 실재하므로 **후속 항목의
    실체(작업 필요성)는 유효**하지만, 인용 section 번호가 틀려 나중에 이 항목을 집행할
    사람이 §5-4 를 열어보면 근거를 못 찾는다.
  - 제안: target(같은 plan 파일)의 "§5-4" 두 곳을 "§2-4"로 정정. 이 plan 은 여전히
    `in-progress/` 라 다음 편집에서 함께 고치면 된다(별도 turn 불요).

- **[INFO]** §2 실측 표의 raw 서브합계에 ±1 노이즈 — 결론(51/0)에는 영향 없음
  - target 위치: "## 실측 (2026-08-11 착수)" §2 대상은 51건이다 표
  - 관련 plan: 없음 (자체 검증 절)
  - 상세: 독립 파서로 재현한 결과 `전체 라우트 222`(일치) · `둘 다 있음 64`(일치) ·
    사전-diff `@ApiForbiddenResponse` 있음 `79`(일치, `post-diff 130 − 신규 51 = 79`로 역산
    확인) · **재스캔 후 대상 0건**(claim "재스캔 결과 잔여 0건" 과 일치)까지 전부 재현됐다.
    다만 raw `@WorkspaceId()` 소비 라우트 수는 내 파서로 **142**(표는 141), `@Roles()` 있음은
    **76**(표는 75) 으로 각각 +1 차이가 났다. 포함-배제로 역산하면
    `142 − 76 − 79 + 64 = 51` 로 대상 수는 동일하게 나온다 — 즉 이 ±1 은 두 서브지표에
    **상쇄**돼 최종 51/0 판정에는 영향을 주지 않는다. 별도 in-progress plan
    (`auth-guard-reflection-hardening.md`)이 언급한 "`@WorkspaceId()` 145회"는 또 다른
    지표(라우트당 boolean 이 아니라 **토큰 출현 횟수**, `grep -c` 로 145 재현됨)라 서로
    다른 질문에 대한 답이며 상충이 아니다. `alerts.controller.ts` 육안 대조(4라우트 중
    1건만 대상) 주장도 직접 열람으로 확인, 정확했다.
  - 제안: 조치 불요. 결론(51건 확정, 0건 잔존)은 신뢰할 수 있다.

## 4번 (선행 plan 파일 충돌) 확인 결과 — 충돌 없음

`git diff origin/main...HEAD --stat -- codebase/backend` 로 target 이 건드린 파일을 전수
확인: `alerts` · `auth-configs` · `dashboard` · `background-runs` · `executions` · `folders` ·
`integrations` · `knowledge-base/graph` · `llm-model-config` · `model-config` ·
`notifications` · `schedules` · `statistics` · `workflow-assistant` · `workflow-versions` ·
`workflows` 컨트롤러 16개(+57/-0, 51 데코레이터 + 6 import).

`backend-lint-gate-broken-on-main.md` 는 본체(`#1104`)와 타입체크 갭 후속 PR 이 이미
머지 완료됐고, 남은 `[ ]` 는 두 건뿐이다:
1. `secret-store` LIKE 메타문자 정규식 공유 검토 — 대상 파일이 `secret-resolver.service.ts`
   류이고 컨트롤러가 아니다.
2. 잔여 lint warning 47건 — 명시된 파일은 `src/scripts/migrate-node-output-refs.ts` ·
   `external-interaction/idempotency.interceptor.ts` · `triggers/triggers.service.ts` ·
   `ai-agent/tool-providers/render-tool-provider.ts` + "기타 5파일"(구체 파일명 미기재).
   위 16개 컨트롤러 중 어느 것도 이 카테고리에 속하지 않는다(서비스/스크립트 계층이지
   컨트롤러 데코레이터 표면이 아니다).

두 plan 이 겹치는 파일은 **0건**으로 확인됐다 — target 의 51건 부착 diff 는 lint-gate plan 의
잔여 작업과 물리적으로 분리돼 있다.

`auth-guard-reflection-hardening.md`(같은 P0 PR 에서 분기된 또 다른 developer 후속, 역시
`in-progress/`)도 `workspace.decorator.ts` · `roles.guard.ts` · 신규 canary 파일을 다루며
16개 컨트롤러 파일과 겹치지 않는다.

## 미해결 결정과의 충돌 검토 (1번)

`spec-update-node-cancellation-shutdown-classification.md` 가 `node-cancellation.md` 에 대해
**"결정이 필요하다 (택일)"** 절(SIGTERM/timeout 을 `failed` 로 유지할지 `cancelled` 로
재정의할지, §5.1/§8/§11 영향)을 열어 두고 있다 — target 이 같은 파일(`node-cancellation.md`)을
건드리므로 직접 대조했다. target 의 편집은 **§2.3 "사용자 cancel 버튼" bullet 에 "Editor+
전용" 권한 문구를 삽입**하는 것뿐이고, 열린 결정은 §5.1(AbortError 분류)·§8·§11 범위라 **겹치지
않는다**. 같은 파일의 또 다른 위임 항목(`#6`, "노드 경계 Execution-cancel 재확인 가드")은
문서 17번째 줄에 "2026-07-27 이행 완료" 로 이미 닫혀 있고, 그 결과물(§2.4 신설 + §2.3 bullet
의 "Execution 행만 UPDATE" 문구)이 이미 target 이 편집한 bullet 안에 포함돼 있다 — target
은 그 위에 이어붙인 것이지 되돌리거나 우회하지 않았다. 충돌 없음.

`auth-workspace-membership-guard.md`(선행 P0, target Overview 가 직접 인용)는 `status: complete`
이고 frontmatter `spec_impact` 4파일에 `spec/conventions/swagger.md` 를 포함해 이미 완결
상태다 — target 이 가정하는 전제(§5-4 확장, `@WorkspaceId()` 만으로도 403 가능)는 그 PR 에서
실제로 병합된 코드(`RolesGuard` 재구성)와 spec 텍스트(§5-4 Rationale, diff 로 직접 확인)로
뒷받침된다. 선행 조건 미해소 없음.

## 요약

target 의 §1(3-execution.md/node-cancellation.md Editor+ 반영) · §2(51건 `@ApiForbiddenResponse`
부착) · §3(swagger.md 앵커 2곳) 체크박스는 `git diff` 로 전부 실측 확인했고 서술과 일치한다.
"실측" 절의 핵심 수치(51건 대상 · 0건 잔존)는 독립 파서로 재현해 신뢰할 수 있음을 확인했다
— raw 서브합계의 ±1 노이즈는 최종 결론에 영향을 주지 않는다. 가장 실무적으로 중요했던 4번
(선행 lint-gate PR 과의 파일 충돌 가능성)은 **충돌 없음**으로 확정됐다 — 두 plan 이 만지는
파일 집합이 물리적으로 분리돼 있다. `spec-update-node-cancellation-shutdown-classification.md`
가 같은 spec 파일(`node-cancellation.md`)에 대해 열어 둔 미해결 결정과도 편집 범위가 겹치지
않는다. in-progress 유지 판단(consistency-check --spec 1건 + 후속 등재 1건만 미완)도 타당하다.
발견된 것은 후속 항목의 section 인용 오류(§5-4→§2-4) 정도의 경미한 INFO 뿐이다.

## 위험도

NONE

BLOCK: NO
STATUS: OK
