# 변경 범위(Scope) Review — auth-guard-reflection-hardening (2차, 15_20_33)

## 검토 방법

`plan/in-progress/auth-guard-reflection-hardening.md` 를 기준선으로 `origin/main` 대비 42개
변경 경로(코드 8·plan 3(1건은 rename)·review 산출물 30)를 전수 대조했다. 이번 라운드는 1차
`ai-review`(`review/code/2026/08/09/14_36_39`)의 WARNING 6건(그중 W3 = scope 관련)을 반영한
이후 상태다. 프롬프트에서 diff 가 생략된 파일(`roles.guard.spec.ts`·
`workspace-context.util.spec.ts`·plan 3개)은 `git diff origin/main` 로 직접 열어 대조했다.

## 발견사항

- **[INFO]** 타 worktree 소유 plan 파일의 `complete/` 이동이 이번 PR 에 계속 포함되어 있음 — 단, 근거는 이번 라운드에서 명시적으로 보강됨
  - 위치: `plan/in-progress/auth-guard-reflection-hardening.md` (게이트 149-165, `## 부수 — plan 위생 1건` 절) / 실제 이동: `plan/complete/spec-draft-workspace-header-membership-invariant.md`(신규, rename R094) ← `plan/in-progress/spec-draft-workspace-header-membership-invariant.md`(삭제)
  - 상세: 1차 `ai-review`(`review/code/2026/08/09/14_36_39/scope.md`)가 이 이동을 WARNING("같은 PR 의 자체 consistency checker 가 '본 worktree 권한 밖'이라 판정했는데 오버라이드 사유 없이 실행됨")으로 지적했었다. 이번 라운드는 그 지적에 대응해 `auth-guard-reflection-hardening.md:158-165` 에 "checker 권고를 오버라이드했다 — 근거를 남긴다" 블록quote 를 신설하고, `git worktree list` 로 소유 worktree(`auth-workspace-membership-guard-2b94db`)가 디스크에는 있으나 해당 작업(`#1103`)이 이미 머지되어 더 이상 PR 을 내지 않는다는 사실을 근거로 오버라이드를 명문화했다(처음 쓴 근거가 틀렸었다는 점도 스스로 적어 뒀다). RESOLUTION.md(`review/code/2026/08/09/14_36_39/RESOLUTION.md:16`)도 이 처리를 W3 로 기록했다. 실질 위험은 낮다(문서 이동뿐, 런타임 영향 없음) — 다만 이 PR 의 명시 목적(W1/W3/W4 guard reflection 경화)과는 여전히 무관한 다른 task 의 plan lifecycle 정리이며, `plan/complete/spec-draft-workspace-header-membership-invariant.md:6` 의 frontmatter `status:` 가 `in-progress` 그대로 남아 있어(이동했으면 `complete`/`done` 류로 갱신하는 편이 관례에 맞음) 오버라이드가 다소 서둘러 처리된 흔적이 남는다. 근거가 이미 충분히 기록됐으므로 차단 사유는 아니다.
  - 제안: 조치 불요(근거 기록 완료). 다음에 이 문서를 만지는 사람을 위해 `status:` 필드만 실제 상태(`complete`)로 맞추는 정도가 사소한 개선.

- **[INFO]** 이번 라운드에 새로 추가된 파일은 전부 이전 라운드의 명시적 후속(fix)로 추적 가능 — 무관 변경 없음
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts`(신규 `describe('형식이 깨진 X-Workspace-Id 는 가드에서 400 으로 전파된다', ...)` 블록 + 전역 라우트 vacuous 보완 테스트), `codebase/backend/src/common/utils/workspace-context.util.spec.ts`(신규 `it.each` malformed 헤더 5종 + 토큰 클레임 비검증 + 중복 헤더 양방향 케이스)
  - 상세: 두 파일 모두 1차 `ai-review` W5("전역 `APP_GUARD` 레벨 테스트 부재")·W6("nil UUID 로 vacuous")를 정확히 겨냥한 추가이며, `roles.guard.spec.ts` 신규 테스트 docstring 이 "ai-review 2차 WARNING #5/#6" 을 직접 인용해 추적 가능하다. 두 파일 다 이미 이번 PR 에서 편집 중이던 파일이라 diff 확산(새 파일을 추가로 여는 것)도 없다. 범위 이탈 없음.
  - 제안: 없음(정보성).

- 그 외 항목은 범위 이탈로 볼 근거가 없었다(1차 스코프 리뷰의 결론이 이번 라운드에도 그대로 유지됨):
  - `app.module.ts`(`DiscoveryModule`)·`main.ts`(`assertWorkspaceIdReflectionWorks` 호출) — W1 배선, 변경 없이 유지.
  - `workspace-reflection-canary.ts`/`.spec.ts` — W1 산출물 그대로.
  - `uuid.ts`/`.spec.ts` 의 `isUuidShaped` — W4 산출물, 기존 `isValidUuid`/`UUID_PATTERN` 은 무변경.
  - `workspace-context.util.ts` 의 `BadRequestException` throw — W4 산출물.
  - `roles.guard.spec.ts`/`workspace.decorator.spec.ts`/`workspace-context.util.spec.ts` 의 UUID 픽스처 치환 — W4 파급, 이름 의미 보존.
  - `CHANGELOG.md` — 이번 PR 요약 + plan 추적 링크 정정(`plan/complete/…` 로 수정, 1차 리뷰 W1 documentation 지적 반영).
  - `review/code/2026/08/09/14_36_39/**`(11파일)·`review/consistency/2026/08/09/{14_01_15,15_09_04}/**`(19파일) — CLAUDE.md 가 요구하는 `--impl-prep`/`--impl-done`/`/ai-review` 의무 산출물이며 이 저장소 관행상 PR 에 포함되는 것이 정상(`review/` 는 gitignore 대상 아님). 신규 산출물이라 자기 자신에 대한 범위 판단 대상은 아님.

## 요약

이번 라운드(15_20_33)는 1차 `ai-review` 가 낸 WARNING 6건(문서 stale 링크·plan frontmatter·scope 오버라이드 근거·이중호출 assert·가드 레벨 테스트 부재·vacuous 테스트)을 정확히 그 지적 범위 안에서만 수정했다 — 새 파일 추가는 신규 테스트 케이스뿐이고 전부 W5/W6 로 직접 추적된다. 1차 스코프 리뷰가 지적했던 유일한 범위 이탈(타 worktree plan 이동)은 삭제되지 않고 유지되지만, 이번 라운드에서 오버라이드 근거가 실측(`git worktree list`, `#1103` 머지 확인)과 함께 명문화되어 프로세스 상 결함이 상당히 완화됐다 — 남은 흠은 `status:` frontmatter 미갱신 정도의 사소한 문서 정합성 문제뿐이다. 핵심 코드 변경(reflection 캐너리·UUID 형식 검증·가드 레벨 회귀 테스트)은 plan W1/W4/W5/W6 범위와 정확히 일치하고, 불필요한 리팩토링·기능 확장·무관한 임포트/설정 변경은 발견되지 않았다.

## 위험도

LOW
