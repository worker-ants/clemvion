# 변경 범위(Scope) 리뷰

대상: `eia-error-code-unify-a87cea` (origin/main..HEAD, 3 커밋: `3f7f72c3b`·`b54657007`·`c9a78d04f`)

## 방법론

`git log origin/main..HEAD`/`git diff --stat`로 21개 변경 파일 전수를 확인했다. 핵심 코드
변경(`executions.service.ts`/`.controller.ts`/`*.spec.ts`)과 spec 6파일 rename 반영은 plan 이
선언한 "두 Manual 엔드포인트 `error.code` 통일" 범위와 정확히 일치한다. 아래 발견사항은 그
경계를 벗어나거나 다른 관심사가 섞여 들어간 지점만 다룬다.

## 발견사항

- **[WARNING]** 동일 tracker 절의 "이월 항목" 3건이 error-code rename PR 에 함께 집행됐다 —
  실질적으로는 다른 기능(마커 재제출 거부, PR #1188/#1189 계열)의 문서 부채다
  - 위치: `plan/in-progress/eia-error-code-unify.md:18-21`("정본 트래커…항목 집행 + 같은 절의
    **spec 편집 3건**"), `plan/in-progress/eia-error-code-unify.md:127-146`("같은 절의 spec
    편집 3건" 목록)
  - 상세: 이 PR 의 제목·핵심 코드 diff 는 "re-run 최상위 `error.code` 를 `INVALID_INPUT` →
    `INVALID_TRIGGER_PARAMETERS` 로 통일"이다. 그런데 같은 PR 이 다음 3개 항목도 함께
    실행한다 — (1) `resolveTriggerParametersRejectingMasked` wrapper 함수명을 spec 본문에
    명시(`spec/4-nodes/7-trigger/1-manual-trigger.md:190-201`, `spec/5-system/14-external-interaction-api.md:1578-1584`),
    (2) EIA §R17 "닫는 조건" 표 4번째 행의 볼드를 제거해 평문으로 통일
    (`spec/5-system/14-external-interaction-api.md:1576`), (3)
    `spec/conventions/error-codes.md` §4 표를 §4.1/§4.2 로 분리
    (`spec/conventions/error-codes.md:84-135`). 세 항목 모두 "마커 재제출 거부"
    기능(egress 마스킹)의 문서화 갭이며, 이번 rename 이 없어도 독립적으로 닫을 수 있는
    항목이다. 분량으로 보면 이 3건이 만든 spec diff(약 60줄 이상)가 실제 rename 이 만든
    diff(코드 3파일 + spec 5파일의 값 치환, 약 15줄)보다 크다.
  - 참고: 이 번들링은 숨겨진 것이 아니라 plan 제목·체크리스트에 명시돼 있고
    `/consistency-check --plan` 5개 checker 전원 BLOCK:NO 로 리뷰됐다(`review/consistency/2026/08/22/16_34_50/SUMMARY.md`).
    다만 이 프로젝트 자신의 관행 권고(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`의
    `04_46_40`·`05_08_35` scope W1 — "기능 PR 에서 부산물 정책/문서 갭이 파생되면 별도 PR 로
    분리하는 편이 낫다")가 이미 지적한 것과 같은 형태의 번들링이다.
  - 제안: 지금 시점에는 이미 하나의 PR 로 커밋됐으므로 리베이스보다는, 리뷰어가 "이 PR 은
    rename 외에 3개의 무관한 spec 문서 갭도 함께 닫는다"는 사실을 PR 설명에 명시하도록
    권고. 다음에 유사 상황이 오면 tracker 이월 항목은 별도 PR 로 분리할 것.

- **[WARNING]** 브랜치에 error-code-unify 와 무관한 "정본 트래커 미체크 37건 재판정" chore
  커밋이 선행 포함돼 있고, 그 섹션 제목이 이 브랜치/worktree 이름과 다른 세션명
  (`backend-redact-depth-boundary`)을 달고 있다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:864-895`
    ("### 미체크 항목 재판정 (2026-08-22, `backend-redact-depth-boundary`)") — 커밋
    `3f7f72c3b`(`chore(plan): 정본 트래커 미체크 37건 재판정`)
  - 상세: `origin/main..HEAD` 는 3커밋이다 — `3f7f72c3b`(37개 백로그 항목 재판정) →
    `b54657007`(plan 초안) → `c9a78d04f`(구현). 첫 커밋은 분산 SSE fan-out·§8.2 HMAC·
    `EIA-AU-09`·`TERMINAL_DURATION_MS_SQL`·`rerun-modal.tsx` 순수 함수 추출 등 **이번
    rename 작업과 전혀 무관한 8개 항목**을 재확인하는 내용이다. `git status`로 확인한 현재
    worktree 경로는 `.claude/worktrees/eia-error-code-unify-a87cea/`(브랜치
    `claude/eia-error-code-unify-a87cea`)인데, 정작 이 재판정 섹션은 스스로를
    `backend-redact-depth-boundary` 라는 다른 이름의 세션/작업 산출물이라 표기한다 — 어느
    쪽이 실제 출처인지 문서 자체가 자기모순을 담고 있다.
  - 참고: 내용 자체는 순수 조사(체크박스·주석 갱신뿐, 코드/spec 본문 변경 없음)이고, 이
    저장소는 "착수 전 병렬 세션 머지 확인" 관행(공유 tracker 파일을 작업 착수 전 재판정하는
    것)을 이미 정착시켜 왔으므로 완전히 이례적인 행위는 아니다. 다만 (a) 이 재판정이
    error-code rename 작업의 필수 선행 조건은 아니고(37건 중 이 작업과 겹치는 것은
    "error.code 통일 결정 기록" 1건뿐), (b) 세션명 불일치는 다음에 이 tracker 항목을 추적할
    때 "어느 PR/세션이 실제로 이 재판정을 했는가"를 헷갈리게 할 수 있다.
  - 제안: PR 설명에 "선행 커밋 `3f7f72c3b`는 착수 전 tracker 위생 점검이며 이번 rename 과
    직접 관련은 37건 중 1건뿐"임을 명시. 세션명 불일치(`backend-redact-depth-boundary` vs
    실제 브랜치 `eia-error-code-unify-a87cea`)는 오탈자인지 실제로 다른 워크트리에서 시작된
    작업인지 확인 후 정정.

- **[INFO]** 유저 가이드 2파일(`triggers.mdx`/`triggers.en.mdx`)의 1줄 수정은 rename 의
  "선존 drift 동반 정정"으로 plan 에 명시돼 있고 diff 도 각 1줄뿐이라 범위 내로 판단
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:33`,
    `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx:22`
  - 상세: 두 문서는 이미 주 실행 경로 기준으로 `INVALID_TRIGGER_PARAMETERS` 를 언급했어야
    했는데 `INVALID_INPUT` 으로 잘못 적혀 있던 기존 오류였고, rename 이 그 문장을 "우연히
    맞게" 만든다는 사실을 plan 이 스스로 인지·서술했다(`plan/in-progress/eia-error-code-unify.md:122-125`).
    조치 불요.

## 범위 내로 확인된 항목 (문제 없음)

- 핵심 코드 변경(`executions.service.ts:506` 값 치환 + 근거 주석 4줄, `executions.controller.ts:274`
  Swagger description 1줄, `executions-rerun.service.spec.ts:330,422` 단언/제목 갱신)은
  정확히 rename 의 최소 표면만 건드리며 무관한 리팩토링·포맷팅·import 변경 없음.
  `resolveTriggerParametersRejectingMasked` 로직 자체나 `MAX_REDACT_DEPTH` 등 이웃 코드에는
  손대지 않았다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:503-511`
- spec 5파일의 rename 반영 부분(`1-manual-trigger.md:181`·`12-webhook.md:313`·
  `13-replay-rerun.md:246,384`·`3-error-handling.md:80,194`)은 값 치환 + 짧은 근거
  각주/blockquote 뿐이며 diff 는 각 파일 1~2 hunk 로 작다.
- `review/consistency/2026/08/22/16_34_50/**` 8개 파일(SUMMARY·5개 checker 리포트·meta.json·
  `_retry_state.json`)은 `/consistency-check --plan` 의무 단계의 자동 산출물이며, 이 저장소의
  기존 관행(`review/**` 는 gitignore 대상이 아니고 커밋되는 것이 정상)과 일치 — scope 문제
  아님.
- `plan/in-progress/eia-error-code-unify.md` 신규 작성(202줄)은 plan-lifecycle 규약이 요구하는
  frontmatter·결정 기록·Rationale 구조를 그대로 따르는 계획 문서 자체이며, 코드/spec 변경과
  별개로 존재해야 하는 필수 산출물.
- 포맷팅·주석·import 변경만 단독으로 발생한 hunk 는 발견되지 않음(모든 hunk 가 실질 값 변경
  또는 그 값을 설명하는 신규 서술을 동반).

## 요약

핵심 rename 자체(코드 3파일 + spec 5파일의 직접 값 치환)는 매우 타이트하게 스코프돼 있어
문제가 없다. 다만 이 PR 은 두 겹으로 스코프가 확장돼 있다 — (1) 같은 tracker 절의 무관한 spec
문서 갭 3건(wrapper 함수명 노출·§R17 볼드 통일·error-codes §4 표 분리, 마커-재제출-거부
기능의 문서 부채)을 함께 집행했고, (2) 브랜치 맨 앞에 이번 작업과 거의 무관한 "미체크 37건
재판정" chore 커밋이 붙어 있으며 그 섹션이 이 브랜치와 다른 세션명을 자칭한다. 두 확장 모두
plan 문서에 투명하게 기록되고 consistency-check 를 통과했으므로 은폐된 스코프 크립은 아니지만,
"하나의 PR = 하나의 의도"원칙에서는 벗어나 있고 이 저장소 자신의 과거 리뷰가 이미 같은 유형의
번들링에 분리 권고를 남긴 바 있다. 기능적 위험(회귀·오류)은 낮다 — 추가된 내용은 문서/체크박스
뿐이고 코드 로직 변경은 rename 하나뿐이다.

## 위험도

MEDIUM
