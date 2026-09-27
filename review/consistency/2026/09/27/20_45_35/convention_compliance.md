# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-cross-workspace-refs-2.md`

## 발견사항

- **[CRITICAL] `spec/1-data-model.md` 는 frontmatter-evidence 가드 대상이 아닌데 "가드가 승격을 강제한다" 고 서술**
  - target 위치: `plan/in-progress/spec-draft-cross-workspace-refs-2.md` `## 변경안` 3번 항목, 33~35행 —
    「`spec/1-data-model.md` frontmatter `status: implemented` → `partial`, `pending_plans:` 에 같은 경로 … 구현 plan 이
    `complete/` 로 옮겨지는 커밋에서 `implemented` 로 되돌린다 — `spec/conventions/spec-impl-evidence.md` §3 이 «마지막
    `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격» 을 가드로 강제한다.」
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §1 "**제외**" 목록 — "basename `1-data-model.md` … (단순 overview
    성격) — `EXCLUDE_BASENAMES` 에 등재" (§1) 및 §4 표(가드 4건 정의).
  - 상세: `spec/1-data-model.md` 는 실제로 **두 겹으로** frontmatter-evidence 가드 밖이다 — (a) `spec-frontmatter-parse.ts`
    의 `INCLUDE_PREFIXES` 자체가 `spec/2-navigation/`·`spec/3-workflow-editor/`·`spec/4-nodes/`·`spec/5-system/`·
    `spec/7-channel-web-chat/`·`spec/conventions/` 뿐이라 spec 루트 직속 파일(`spec/1-data-model.md`)은 애초에 매치되지
    않고, (b) 설령 매치되더라도 `EXCLUDE_BASENAMES = {"0-overview.md","1-data-model.md","6-brand.md"}` 에 basename 이
    올라 있어 다시 걸러진다. 그 결과 `isApplicable("spec/1-data-model.md")` 는 `false` 이고 — 이는 회귀 테스트
    `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.test.ts:28` 이 명시적으로 단언하는 사실이다 —
    `collectApplicableSpecs()` 가 이 파일을 아예 순회 목록에 넣지 않으므로 `spec-status-lifecycle.test.ts` (§3 라이프사이클
    가드, "partial → implemented 승격 강제" 를 실제로 구현하는 그 파일)도, `spec-pending-plan-existence.test.ts` 도 이
    파일의 `status`/`pending_plans` 를 **전혀 읽지 않는다**. 즉 target 문서가 인용한 "§3 이 가드로 강제한다" 는 이 파일에
    한해 사실이 아니다 — 검증 코드가 직접 반증한다.
  - 이 구분은 사소하지 않다. `spec-impl-evidence.md` 의 존재 이유 자체가 "spec 이 책임 plan 을 안 가리키면 어떤 plan 도
    책임지지 않는 빈 약속이 영구 누락으로 남는다"(§Rationale R-5, 텔레그램 chat-channel 사례)는 실패 모드를 build 가드로
    막는 것이다. `1-data-model.md` 는 그 안전망 **밖**에 있으므로, `status: partial` 로 내렸다가 구현 plan 이
    `plan/complete/` 로 옮겨진 뒤 사람이 `implemented` 로 되돌리는 것을 잊어도 CI 는 초록이다 — target 문서의 서술은
    정확히 이 위험이 "가드가 있으니 없다" 고 잘못 안심시킨다. 같은 컨벤션 문서의 R-11 은 이미 이런 미가드 승격 케이스에서
    "가드가 보던 자리를 사람이 본다 … 판정 근거를 승격 commit 에 남긴다" 고 **명시적으로 드러내는** 선례를 두고 있는데,
    이 draft 는 그 선례를 따르지 않고 반대로 "가드가 강제한다" 고 적어 존재하지 않는 안전망을 주장한다.
  - 제안: 33~35행의 근거 문장에서 "§3 이 … 가드로 강제한다" 를 삭제하고, R-11 패턴을 따라 "이 파일은
    `spec-frontmatter-parse.ts` 의 `EXCLUDE_BASENAMES` 라 frontmatter-evidence 가드 대상이 아니다 — 승격은 가드가 아니라
    구현 plan 을 `complete/` 로 옮기는 그 커밋에서 **수동으로** 되돌려야 하며, 판정 근거를 그 commit 에 남긴다" 로 정정할
    것. 대안으로, 진짜 가드 보호를 원한다면 `spec-impl-evidence.md` §1 의 `EXCLUDE_BASENAMES`/`INCLUDE_PREFIXES` 자체를
    갱신해 `1-data-model.md` 를 대상에 넣는 결정을 이 draft(또는 별도 convention 갱신 draft)에 명시해야 한다 — 그 경우
    convention 문서와 `spec-frontmatter-parse.test.ts` 의 negative-path 단언(28행)도 함께 갱신해야 하는 더 큰 변경이 된다.

- **[INFO] `1-data-model.md` 에 `pending_plans`/`status: partial` 을 다는 선택 자체가 컨벤션의 파일 분류와 어긋난다**
  - target 위치: 같은 3번 항목.
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §1 (EXCLUDE_BASENAMES 근거 = "단순 overview 성격"), 대비 §Rationale
    R-4/R-7 의 분류 원칙("추적할 구현 lifecycle 이 없는 문서엔 그 스키마를 강요하지 않는다").
  - 상세: 같은 draft 가 스스로 지적하듯 `spec/data-flow/11-workflow.md`·`12-workspace.md` 는 frontmatter `status` 자체가
    없는 문서라 "이 추적의 대상이 아니다" 로 분류했다(22~25행). `1-data-model.md` 도 컨벤션상 같은 "라이프사이클 비추적"
    범주(EXCLUDE_BASENAMES)인데, 이 파일만 `status`/`pending_plans` 스키마를 그대로 적용해 겉보기엔 가드가 있는 것처럼
    보이는 frontmatter 를 만든다. 두 "비추적" 파일군을 한 draft 안에서 다르게 취급하는 근거가 서술돼 있지 않다.
  - 제안: 위 CRITICAL 항목을 정정하는 김에, `1-data-model.md` 도 `data-flow/*` 두 파일과 같은 방식(§1.1 본문에 "구현
    plan 은 `plan/in-progress/cross-workspace-refs.md`" 같은 프로즈 각주만 남기고 frontmatter `status`/`pending_plans` 는
    건드리지 않는 방식)으로 처리할지, 혹은 위 CRITICAL 제안대로 가드 대상에 넣을지 이 draft 안에서 명시적으로 선택하는
    편이 컨벤션의 기존 분류 논리와 더 정합적이다.

## 요약

target 문서는 `spec/2-navigation/1-workflow-list.md` 와 `spec/3-workflow-editor/0-canvas.md` 에 대한 `pending_plans:` 추가
(항목 1·2)와 plan 경로를 마크다운 링크 대신 백틱으로 남기는 선택(Rationale W1)은 `spec/conventions/spec-impl-evidence.md`
§2.1·§4·§4.2(`spec-pending-plan-existence.test.ts`/`spec-link-integrity.test.ts`)의 실제 가드 동작과 정확히 일치하게
서술돼 있고, 이 부분은 규약 준수가 탄탄하다. 다만 `spec/1-data-model.md` (항목 3)에 대해서는 그 파일이
`spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 미매치 + `EXCLUDE_BASENAMES` 이중으로 frontmatter-evidence 가드 밖에
있다는 사실(`spec-frontmatter-parse.test.ts:28` 이 단언)을 놓치고 "§3 이 가드로 강제한다" 고 반증 가능한 허위 서술을
넣었다 — 이 문장이 그대로 반영되면, 이 파일의 `partial`→`implemented` 복귀가 실제로는 전적으로 수동 관리에 의존함에도
"가드가 지켜준다" 는 잘못된 안도감을 다음 사람(또는 다음 planner/developer 턴)에게 남긴다. 나머지 관점(명명 규약·출력
포맷·문서 구조 3섹션·API 문서 데코레이터)에는 이 draft 의 변경 범위 안에서 해당 사항이 없거나 위반이 관찰되지 않았다.

## 위험도

HIGH
