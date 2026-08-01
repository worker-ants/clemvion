# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `PROJECT.md` 의 "빌드 툴체인 major 자동 bump 차단" 정책 문단이 "현재 `typescript` 1건" 이라고 명시하는데, 이번 변경으로 `.github/dependabot.yml` 의 major-ignore 항목이 `typescript` + `eslint-plugin-unicorn` **2건**이 됐다. 해당 SoT 문단이 갱신되지 않아 코드-문서 불일치가 재발했다.
  - 위치: `PROJECT.md:49` (섹션 "## 버전·도구 정책", 항목 "**빌드 툴체인 major 자동 bump 차단**"). 이 파일은 이번 diff 대상에 포함되지 않았다 — `git diff --stat 7c10c9f02..HEAD` 로 확인한 결과 `.github/dependabot.yml` · `codebase/backend/eslint.config.mjs` · `codebase/backend/package.json` · `plan/in-progress/eslint-unicorn-peer-restore.md` · `pnpm-lock.yaml` 5개 파일만 변경됐고 `PROJECT.md` 는 손대지 않았다.
  - 상세: 이 정확히 같은 문단이 `git log -S"빌드 툴체인 major 자동 bump 차단" -- PROJECT.md` 로 추적하면 직전 typescript 롤백 PR(`#1058`, 커밋 `7c10c9f02`)에서 신설됐고, 그때 "현재 typescript 1건" 이라는 카운트를 명시적으로 박아 뒀다. 이번 PR 은 정확히 같은 클래스의 governance 조치(major bump 를 dependabot ignore 로 차단 + 근거 주석)를 `eslint-plugin-unicorn` 에도 반복하면서, 그 상위 SoT 문서(`CLAUDE.md` 가 "실제 명령·인프라·면제 화이트리스트" 로 직접 지목하는 문서)는 갱신하지 않았다. `plan/in-progress/eslint-unicorn-peer-restore.md` 의 "조치"/"체크리스트"/"후속 검토" 어느 절에도 `PROJECT.md` 갱신이 언급되지 않아, 이번 PR 범위에서 완전히 누락된 것으로 보인다. 아이러니하게도 이 PR 자체가 "dependabot 이 볼 수 없는 주석 때문에 코드-문서가 어긋났다" 는 문제를 고치는 PR인데, 그 과정에서 다른 문서(`PROJECT.md`)에 동일한 종류의 drift 를 하나 새로 남겼다.
  - 제안: `PROJECT.md:49` 를 "현재 `typescript`·`eslint-plugin-unicorn` 2건" 으로 갱신하고, `eslint-plugin-unicorn` 사례의 근거(peer floor 충돌 — `eslint.config.mjs` 인라인 주석 참조)를 한 줄 추가한다. 이후 이 항목에 세 번째 패키지가 추가될 걸 대비해, "여기 등재된 개수는 `.github/dependabot.yml` 의 typescript/eslint-plugin-unicorn 두 `ignore` 블록과 함께 갱신" 같은 2-place 결속 문구를 남겨 두면 재발을 줄일 수 있다(이 파일이 이미 다른 항목에서 쓰는 "2-place 편집 = 리뷰 게이트" 패턴과 동형).

- **[INFO]** `CHANGELOG.md` 에는 이번 변경(의존성 롤백 + dependabot governance)에 대한 엔트리가 없다. 다만 이는 확립된 선례와 일치한다 — `CHANGELOG.md` 는 spec/제품 대상 변경(모든 기존 항목이 `spec/` 파일 SoT 를 인용)에 한정되며, 직전 동일 클래스 작업인 typescript 롤백(`#1058`)도 CHANGELOG 엔트리를 남기지 않았다(`grep -ni "typescript 롤백\|dependabot" CHANGELOG.md` 0건). 조치 불필요.

- **[INFO]** `codebase/backend/eslint.config.mjs` 와 `.github/dependabot.yml` 의 두 주석 블록이 서로를 명시적으로 참조하며 결속을 남긴 점(예: eslint.config.mjs "이 pin 을 풀려면 그 항목[dependabot ignore]도 함께 지워야 한다" ↔ dependabot.yml "버전은 `eslint.config.mjs` 가 근거 주석과 함께 `^56` 으로 고정")은 이번 diff 중 가장 잘된 문서화 사례다. registry 실측 표·날짜(`2026-08-01`)까지 남겨 향후 재검토 시점의 근거가 명확하다. 별도 조치 불필요, 참고로 기록.

- **[INFO]** `plan/in-progress/eslint-unicorn-peer-restore.md` 는 frontmatter(`worktree`/`started`/`owner`/`status`/`priority`/`spec_impact`) · Overview · 근거(registry 표) · 조치 · 체크리스트 · 미수행 근거 · 후속 검토를 모두 갖춘 완결된 plan 문서다. `spec_impact: none` 판단(의존성/CI 설정 변경으로 `spec/` 비대상)도 타당하며, in-progress 단계라 Gate C 강제 대상도 아니다(`.claude/docs/plan-lifecycle.md` §Gate C 는 `complete/` 이동 시점에만 적용). 문제 없음.

- **[INFO]** `pnpm-lock.yaml` 변경분은 `pnpm install` 자동 재계산 산출물(패키지 다운그레이드에 따른 전이 의존성 정리 — `@eslint/css-tree`·`change-case`·`convert-hrtime` 등 제거, `builtin-modules@5.3.0→3.3.0`, `clean-regexp` 재등장 등)이라 별도 문서화 대상이 아니다. 근거는 `eslint.config.mjs`/`package.json`/`dependabot.yml` 주석에 이미 있다.

## 요약

핵심 코드·설정 변경(`.github/dependabot.yml`, `codebase/backend/eslint.config.mjs`, `codebase/backend/package.json`)은 registry 실측 근거, 상호 참조("이 pin 을 풀려면 저 항목도 지워야 한다"), 날짜 명시까지 갖춘 모범적인 인라인 문서화를 보여준다. `plan/in-progress/eslint-unicorn-peer-restore.md` 도 완결된 형태다. 유일한 실질 갭은 `PROJECT.md` 의 "빌드 툴체인 major 자동 bump 차단" 정책 문단이 여전히 "typescript 1건" 으로 남아 이번에 2건이 된 실제 상태를 반영하지 못하는 것 — 정확히 이 PR 이 고치려는 문제(dependabot 이 볼 수 없는 주석 때문에 생긴 코드-문서 drift)와 같은 클래스가 상위 SoT 문서에 새로 생겼다. CHANGELOG 는 확립된 선례(spec/제품 대상 변경만 기재)에 따라 엔트리 불요로 판단된다.

## 위험도

LOW
