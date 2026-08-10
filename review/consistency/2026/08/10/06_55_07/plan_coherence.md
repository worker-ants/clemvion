# Plan 정합성 검토 — 2026-08-10 06:55:07

검토 대상 2건:
- A. `plan/in-progress/spec-data-flow-structural-followups.md`
- B. `plan/in-progress/spec-fix-swagger-forbidden-response.md`

## 발견사항

### A. `spec-data-flow-structural-followups.md`

- **[WARNING]** 체크리스트 §4 항목의 "17건/4파일"이 자기모순 — 실측은 15건/4파일
  - target 위치: `## 체크리스트` 마지막 항목(`- [ ] **§4 서술형 "LLM Config" 표기**...`)
  - 관련 plan: 같은 문서 자신(내부 self-consistency). 인접 근거: `spec/data-flow/12-workspace.md`
    `### 명칭 통일 범위` Rationale(20건 — 이건 별개의, #1042 시점 pre-fix 전체 수치로 정합함,
    문제 없음)
  - 상세: 해당 체크리스트 줄은 "2026-08-08 실측 잔존 **17건 / 4파일**"이라 적고, 같은 문장
    괄호 안에서 "(`data-flow/12-workspace.md` 의 2건은 §3 이 남긴 범위 서술 자체라 대상
    아님.)"이라고 별도로 명시한다. 그런데 4개 대상 파일만 직접 실측(`grep -c "LLM Config"`)하면:
    `3-workflow-editor/4-ai-assistant.md` 7 · `3-workflow-editor/_product-overview.md` 5 ·
    `4-nodes/3-ai/_product-overview.md` 2 · `5-system/_product-overview.md` 1 = **15건**.
    "17"은 실은 spec/ 전체 잔존 수(15 + `12-workspace.md` 의 2건 = 17)이고, 같은 문장이
    스스로 그 2건을 "대상 아님"이라 배제해 놓고도 헤드라인 숫자에서는 빼지 않았다.
    `git log --since=2026-08-08 -- <4개 파일>`이 빈 결과라 — 즉 다른 PR 이 그 사이 2건을
    고쳐서 줄어든 게 아니라, **2026-08-08 원 계수 자체가 전체-스코프 수치를 부분-스코프
    라벨에 잘못 붙인 오기**다.
  - 제안: §4 착수 PR 에서 "17건" → "**15건/4파일**(+ `12-workspace.md` 별도 2건, spec/ 전체
    17건)"로 정정. 지금 그대로 두면 §4 담당자가 "15개를 찾았는데 2개가 어디 갔나" 헷갈리거나
    반대로 존재하지 않는 항목을 찾아 헤맬 수 있다.

- **[WARNING]** `complete/` 이동 시 spec 인입 링크 갱신 항목이 체크리스트에 없음
  - target 위치: `## 체크리스트` (§4 완료 후 `complete/` 이동을 전제로 하나 이동 단계 자체가
    명시적 항목으로 없음)
  - 관련 plan/spec: `spec/data-flow/12-workspace.md:442`(`### 명칭 통일 범위` 절)가
    `plan/in-progress/spec-data-flow-structural-followups.md` 를 상대경로로 직접 링크
  - 상세: `.claude/docs/plan-lifecycle.md §3` "인입 참조: … `spec/` 등 살아있는 문서의 plan
    링크는 이동과 동시에 갱신" 규약이 있고, 이 저장소는 최근에도 같은 패턴을 실제로 놓친 적이
    있다(`auth-guard-reflection-hardening.md` §부수 — `spec-draft-workspace-header-membership-invariant.md`
    이동 시 `auth-workspace-membership-guard.md` 의 깨진 링크를 부수로 고친 사례). 지금 이
    plan 의 체크리스트에는 §4 를 닫고 `complete/` 로 옮기는 단계 자체가 없고, 옮길 때
    `12-workspace.md:442` 의 링크를 `../../plan/complete/spec-data-flow-structural-followups.md`
    로 갱신하는 항목도 없다.
  - 제안: §4 완료 + `complete/` 이동 PR 에 `12-workspace.md:442` 링크 경로 갱신을 동반
    처리하도록 체크리스트에 1줄 추가.

- **[WARNING]** frontmatter `spec_impact` 가 §4 가 실제로 건드릴 4개 spec 파일을 누락
  - target 위치: frontmatter `spec_impact:` (문서 최상단)
  - 상세: 현재 `spec_impact` 는 `data-flow/12-workspace.md`·`data-flow/3-execution.md`·
    `data-flow/0-overview.md` 3개만 나열한다. §4 착수 시 실제로 편집할 파일
    (`3-workflow-editor/4-ai-assistant.md`·`3-workflow-editor/_product-overview.md`·
    `4-nodes/3-ai/_product-overview.md`·`5-system/_product-overview.md`)과 전혀 겹치지 않는다.
    Gate C(`spec-plan-completion.test.ts`)는 "리스트가 비어있지 않은가"만 검사하므로 지금
    이동해도 빌드는 통과하지만, `spec_impact` 필드의 취지("본 작업이 건드린 spec 파일들")를
    훼손해 나중에 이 plan 이 실제로 무엇을 건드렸는지 frontmatter 만으로 파악할 수 없게 된다.
  - 제안: §4 작업 완료 + `complete/` 이동 커밋에서 `spec_impact` 목록에 4개 파일 추가.

- **[INFO]** "산문으로 숨은 다른 미해결 follow-up" 없음을 확인
  - 문서 전체를 `TODO|추가로|잔여|미완료|남음|보류|나중에|추후` 키워드로 재스캔한 결과
    "잔여"가 걸리는 곳은 §4 자신(체크리스트 문구 + 본문 소제목)뿐이었다. §2(SIGTERM 상호참조)는
    **결정 자체를 다른 plan(`spec-update-node-cancellation-shutdown-classification.md`)에
    남겨두는 것이 의도**이고 이미 그렇게 중립적으로 처리·완료됐다 — 그 다른 plan 이 여전히
    미결이어도 이 plan 의 완료 판정을 막지 않는다(이 plan 의 책무는 "상호참조를 다는 것"까지고
    실제로 달았다). §4 를 닫으면 이 plan 은 5/5 체크박스가 `[x]` 가 되어 `complete/` 이동
    판단은 **맞다** — 단 위 세 WARNING(수치 정정·인입 링크·spec_impact)을 같은 PR 에서
    함께 처리할 것을 권한다.

### B. `spec-fix-swagger-forbidden-response.md`

- **[INFO]** 실제 열린 체크박스 0건 확인 — grep 이 잡은 2건은 코드펜스 안의 Before/After 예시
  - target 위치: line 73-75, 78-86(각각 ` ```markdown ` 코드펜스), 그 안의 `- [ ]` 2줄
    (line 74, 79)
  - 상세: 두 줄 모두 `spec/conventions/swagger.md §5-4` 에 실릴 문구의 Before/After 예시를
    그대로 인용한 것이며, 이 plan 자체의 진행을 추적하는 실 체크박스가 아니다. 이 문서에는
    애초에 `## 체크리스트` 섹션이 없고 진행 상황은 `## 반영 완료 (2026-08-08, planner 턴)`
    산문 서술로 기록돼 있다(전형적인 "spec draft" 문서 형태). 문서 전체에 `- [x]` 도 0건이다.
  - 부수 관측(harness 함정, 비차단): `.claude/hooks/_lib/plan_guard.py::_all_checkboxes_done()`
    은 코드펜스를 구분하지 않는 순수 라인 정규식이라 이 두 예시 줄도 "열린 체크박스"로
    집계한다(`open_count=2`). 다만 그 함수는 `done_count>0 and open_count==0` 을 요구하는데
    이 문서엔 `[x]` 가 0건이라(`done_count=0`) 어차피 `False` 를 반환한다 — Stop 훅의
    "complete 이동 nudge" 는 이 plan 에 대해 애초에 발화하지 않는다. 현재 worktree
    (`spec-small-followups`)와도 frontmatter `worktree:`(`auth-workspace-membership-guard-2b94db`)
    가 달라 어차피 이 plan 은 지금 세션의 push/stop 게이트에 연결되지 않는다. 판정에는
    영향 없음(참고용 기록).

- **[WARNING]** 후속 항목 (a) "나머지 ~61개 라우트" 는 이미 별 plan 으로 분리·승격됨 — 상호참조만 없음
  - target 위치: `## 후속 (이 draft 반영 후)` 두 번째 불릿
  - 관련 plan: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` §2
    "잔여 ~61개 라우트의 `@ApiForbiddenResponse` (INFO 4)"
  - 상세: 사용자 지적대로 이 문서는 스스로 "별도 plan 항목으로 분리 권장"이라 적었는데, 실측
    결과 **이미 분리·승격돼 있다**. `spec-sync-stop-editor-and-forbidden-routes.md` §2 가
    정확히 같은 작업(전수 스캔 + 코드모드 일괄 부착 + 설명 문자열 통일)을 실 체크박스
    (`- [ ]` 3건)로 갖고 있고, 그 문서 스스로 "종전엔 이 항목이 **두 plan 의 산문 권고**로만
    있었다 — checker 가 'review/ 에만 있다가 유실되는 패턴' 을 지적해 여기 체크리스트로
    승격한다"고 명시한다. 즉 이 follow-up 은 이미 유효하게 추적 중이라 **완료 이동을 막을
    이유가 아니다** — 다만 target B 문서에는 그 승격 사실이 반영돼 있지 않아, `complete/`
    로 넘어간 뒤 이 문서만 단독으로 읽는 사람은 "권고했는데 아무도 안 받았나" 로 오인할 수
    있다.
  - 제안: `complete/` 이동 커밋에서 이 불릿에 "→ `spec-sync-stop-editor-and-forbidden-routes.md`
    §2 로 승격·추적됨" 한 줄 포인터 추가(선택, 비차단 — historical record 이므로 안 해도
    무방하나 향후 혼동 방지 차원에서 권장).

- **[INFO]** 후속 항목 (b) "resolution-applier 재호출" 은 실측 결과 이미 무의미(moot)
  - target 위치: `## 후속 (이 draft 반영 후)` 첫 번째 불릿
  - 상세: `resolution-applier` 재호출 idempotency 경로는 `code-review-agents/SKILL.md §6`
    (`ESCALATE=spec` → `/consistency-check --spec` BLOCK:NO → **동일 session_dir** 로
    resolution-applier 재호출)이 정의하는, **아직 병합되지 않은 진행 중 PR** 안에서 SUMMARY
    처리를 마무리하는 절차다. 그런데 이 plan 이 위임받은 원 PR
    (`auth-workspace-membership-guard`, worktree `auth-workspace-membership-guard-2b94db`)은
    이미 `#1103`(squash-merge `8d84f6e9f`, 2026-08-08)으로 병합됐고 그 plan 자체도
    `plan/complete/auth-workspace-membership-guard.md` 로 이동 완료됐다(TEST
    WORKFLOW·e2e 전부 통과 확정 상태 — `b2b22f35d`). 병합된 PR 에 resolution-applier 를
    다시 부르는 것은 그 워크플로가 전제하는 "아직 열려 있는 세션"이 없어 성립하지 않는다.
    `RESOLUTION.md`(`review/code/2026/08/08/20_53_48/RESOLUTION.md`) #10 행이 "(b) …
    planner 턴 + `/consistency-check --spec` 필요"라고 남아 있는 것도 그 PR 병합 시점의
    스냅샷일 뿐이라 갱신 대상이 아니다(`review/**` 는 시점 기록이지 SoT 가 아니라는 이
    저장소의 기존 원칙과 일치). 사용자 추정대로 이 항목은 **실행 불가/무의미**하며 완료
    이동을 막는 실질 장애물이 아니다.
  - 제안: `complete/` 이동 시 이 불릿을 삭제하거나 "(PR #1103 병합으로 moot — RESOLUTION.md
    는 시점 기록으로 그대로 둠)" 으로 정정. 비차단, plan 위생 차원의 권장.

- **[INFO]** Gate C(`spec_impact`) 확인 — 통과
  - frontmatter `spec_impact:` 가 `- spec/conventions/swagger.md` 리스트 형태(bare string
    아님, 빈 배열 아님)로 선언돼 있고 경로도 실존한다(§5-4 확장 문구·§Rationale 신설 서브섹션
    확인). `started: 2026-08-08` 로 grandfather 경계(2026-06-04) 이후라 Gate C 적용
    대상이지만 이미 요건을 만족한다. 추가 조치 불요.

## 요약

**A. `spec-data-flow-structural-followups.md`**: §4 를 닫으면 이 plan 의 체크박스가 전부
`[x]` 가 된다는 판단은 **맞다** — 산문으로 숨은 다른 미해결 항목은 없음을 재확인했다. 다만
"17건/4파일"은 자기 문장 안에서 이미 모순이고(실측 15건/4파일, 원인은 §4 착수 시점의 계수
오기이지 다른 PR 개입이 아님), §4 이후 `complete/` 이동 시 필요한 두 가지 위생 작업(spec 인입
링크 갱신·`spec_impact` frontmatter 4파일 추가)이 체크리스트에 빠져 있다. 셋 다 §4 착수와
같은 PR 에서 함께 처리 가능한 경미한 정정이라 CRITICAL 은 아니다.

**B. `spec-fix-swagger-forbidden-response.md`**: 실제 열린 체크박스는 **0건**이 맞다(grep
2건은 코드펜스 예시). 남은 "후속" 2건 중 (a) ~61개 라우트 부착 권고는 이미
`spec-sync-stop-editor-and-forbidden-routes.md` §2 로 승격·추적되고 있어 유실되지 않았고,
(b) resolution-applier 재호출은 원 PR 병합으로 이미 무의미하다. Gate C 도 만족한다. 이
plan 은 **지금 바로 `complete/` 이동 대상**이며, 이동 전 두 후속 불릿을 정리(선택)하면 더
깔끔하다.

## 위험도

LOW
