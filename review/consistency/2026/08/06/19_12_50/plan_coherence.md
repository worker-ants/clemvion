# Plan 정합성 검토 — plan_coherence

## 검토 전제 확인 (중요)

프롬프트가 지정한 `target 문서` 는 `spec/7-channel-web-chat` (scope=spec/7-channel-web-chat,
diff-base=origin/main) 이다. 그러나 이 worktree 의 **실제 현재 diff**(`git diff
origin/main...HEAD --stat`, 로컬 2 커밋: `1ac458d07` `fix(packages): prepare 가 디렉터리
존재만 보고 있었다`, `6384514b2` `fix(harness): 리뷰 W1 반영`)는 다음으로 구성된다:

```
.claude/tests/README.md
.claude/tests/test_packages_prepare_contract.py       (신규)
.github/workflows/harness-checks.yml                   (+5)
codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,
  graph-warning-rules,node-summary,sdk,web-chat-sdk}/package.json  (prepare 스크립트 수정)
review/code/2026/08/06/18_55_02/**                      (리뷰 산출물)
```

이는 **7개 내부 패키지의 `prepare` 빌드 스크립트 계약 수정**(stale dist 미재빌드 결함) +
회귀 테스트 신설이며, `spec/7-channel-web-chat` 본문이 서술하는 위젯 동작·SDK 계약·인증
세션 등과는 무관하다. 프롬프트가 그 spec 영역 전체(7개 파일, 약 1,500줄)를 번들에 실은
것은 diff 에 포함된 `codebase/packages/web-chat-sdk/package.json` 1줄이 그 spec 의 `2-sdk.md`
`code:` frontmatter (`codebase/packages/web-chat-sdk/**`) 와 매칭됐기 때문으로 보인다 —
기계적으로는 맞지만 실질적으로는 빌드 스크립트 변경이라 spec 행위 계약과 무관하다.

**더 심각한 결과**: 이 예산 배정 때문에 이 branch 를 실제로 지배하는 plan —
`plan/in-progress/harness-review-gate-ci-backstop.md` (frontmatter
`worktree: harness-review-ci-backstop-91f379`, 이 세션 worktree 이름과 정확히 일치) — 가
"컨텍스트 예산 초과로 생략된 파일 55개" 목록(프롬프트 3077~3134행, 해당 항목 3122행)에
들어가 **번들에서 통째로 빠졌다**. 대신 무관한 `spec/7-channel-web-chat` 전체와, 그 안의
diff 섹션(1569~1660행, package.json 6개 diff)만 실렸다.

## 발견사항

- **[WARNING] target 번들 스코프 산정이 diff 와 무관한 spec 을 통째로 싣고, 실제 governing plan 은 생략됨**
  - target 위치: 프롬프트 `## 검토 모드`(15행, `scope=spec/7-channel-web-chat`) · `## Target 문서`(17~1660행 전체 스펙 번들)
  - 관련 plan: `plan/in-progress/harness-consistency-summary-downgrade-rule.md` §"관련 관측 — `--impl-done` scope 가 실제 diff 와 무관한 번들을 싣는다" 의 미해결 체크리스트 2건 —
    - `[ ] orchestrator 의 --impl-done/--impl-prep scope 산정이 그 경로에 실제 diff 가 있는지 사전 확인하도록 보강`
    - `[ ] target 번들 조립 시 plan frontmatter 의 spec_impact 목록을 folder dump 보다 우선 포함`
  - 상세: 이 plan 문서는 이미 "재발 관측" 6~8번째까지 정확히 이 결함 클래스(사전순/예산 초과로 실제 대상 파일·plan 누락)를 기록해 뒀고, 자매 plan `harness-review-gate-ci-backstop.md` 자신도 "8번째" 재발 관측을 갖고 있다. 이번 세션은 그 두 항목이 여전히 미착수임을 보여주는 최신 재현이며, 새로운 축이 하나 추가된다 — **이 세션의 governing plan(`worktree:` frontmatter 가 현재 worktree 와 일치)을 최우선 계층으로 승격하는 규칙이 없다.** 이미 구현된 4계층 우선순위(0=브랜치가 변경한 파일, 1=in-progress plan 이 이름으로 언급한 파일, 2=나머지, 3=카탈로그)에는 "이 branch 를 통째로 지배하는 plan 자체"를 위한 계층이 없어서, `harness-review-gate-ci-backstop.md` 는 자기 이름이 diff 파일 목록에 없다는 이유로 계층 2(알파벳순 나머지)로 밀려 예산 밖으로 잘렸다. 결과적으로 이번 plan_coherence 판정이 "문제 없음"으로 나오더라도, 실제로 검증된 것은 무관한 spec 뿐이고 진짜 대상은 프롬프트에 없었다는 뜻이다 — `harness-review-gate-ci-backstop.md` 자신이 "8번째 재발 관측"에서 정확히 이 위험("BLOCK: NO 가 검증 대상 부재를 의미할 수 있다")을 경고했다.
  - 제안: `harness-consistency-summary-downgrade-rule.md` 의 두 미해결 체크박스에, "governing-plan(worktree frontmatter 일치) 을 최상위 계층으로 승격" 항목을 추가하거나 별도 항목으로 등재. 코드 변경 없이 이 관측을 문서에만 남겨도 다음 세션이 같은 함정에 빠지지 않는다.

- **[WARNING] 실제 diff(packages prepare stale-dist 결함)가 그 결함을 예견한 plan 문서에 등재되지 않음**
  - target 위치: 실제 diff — `.github/workflows/harness-checks.yml`, `codebase/packages/*/package.json`(7개), `.claude/tests/test_packages_prepare_contract.py`
  - 관련 plan: `plan/in-progress/harness-review-gate-ci-backstop.md` "2026-08-06 — 이 계획이 서 있던 전제가 거짓이었다" 섹션(약 249~274행) — "`harness-checks`(854 테스트)·`frontend-checks`·`spec-link-checks`·`packages-checks` 는 한 번도 실행된 적이 없다 ... Actions 활성화 뒤 실판정이 쌓인다" 는 서술
  - 상세: 이번 diff 가 고친 결함(`prepare` 가 디렉터리 존재만 보고 stale dist 를 재빌드하지 않음)은 정확히 이 plan 이 예견한 부류다 — "두 달간 하네스에 쌓은 가드가 CI 에서 실행된 적 없이 로컬 훅만을 유일 집행자로 뒀다" 는 서술이 실제로 검증되는 사례이며, `packages-checks` 트리거가 주려던 커버리지가 진짜로 깨져 있었다는 실측이다. 같은 날 자매 PR `#1091`(`2a4fc1797`, playwright-runner 마운트 결함)도 같은 계열의 발견이다. 그런데 `plan/in-progress/harness-review-gate-ci-backstop.md` 는 `#1090`(`60a433403`) 이후 커밋 이력에 등장하지 않는다(`git log -- <plan>` 확인) — `#1091`도 이번 두 커밋도 이 plan 을 갱신하지 않았다. 이 plan 은 바로 같은 섹션에서 "직전 RESOLUTION 에 'plan 등재' 라고 적었으나 실제로는 등재되지 않았다 — 기록이 틀렸다" 며 §15/§16 미등재를 스스로 정정한 바 있는데, 같은 날 두 건이 다시 미등재로 반복됐다.
  - 제안: CRITICAL 은 아니다 — 미해결 결정을 우회한 것이 아니라 관찰 기록 누락이며, "이 계획이 서 있던 전제가 거짓이었다" 섹션의 취지(CI 활성화 후 발견되는 실결함을 이 plan 에 축적)와 어긋난다. developer 가 다음 관련 커밋(또는 이 PR 자체)에서 `harness-review-gate-ci-backstop.md` 에 `#1091`(playwright-runner mount)과 이번 stale-dist 발견을 §17/§18 류 항목 1~2줄로 등재할 것을 권한다.

- **[INFO] 미해결 결정 항목 자체는 이번 diff 와 충돌 없음**
  - target 위치: `spec/7-channel-web-chat` 전체(번들 원문)
  - 관련 plan: 없음
  - 상세: 위 스코프 문제를 감안해 실제 diff 를 별도로 확인한 결과, `spec/7-channel-web-chat` 가 "결정 필요"로 남긴 어떤 항목(§R 시리즈, `## 잔여 항목` 등)도 이번 diff(빌드 스크립트 계약 수정)와 접점이 없다. `harness-review-gate-ci-backstop.md` 의 "결정이 필요한 지점"(`--enforce` 전환 선행조건, 이중 게이트 마찰)도 이번 diff 범위 밖이라 우회·충돌 없음.
  - 제안: 조치 불필요.

## 요약

프롬프트가 배정한 target(`spec/7-channel-web-chat`)은 실제 diff(패키지 `prepare` 빌드 스크립트
stale-dist 결함 수정 + 하네스 테스트 신설)와 실질적으로 무관하며, 이는 `code:` frontmatter
매칭이 기계적으로만 맞아 전체 spec 영역을 번들에 실은 결과다. 그 여파로 이 branch 를 직접
지배하는 `plan/in-progress/harness-review-gate-ci-backstop.md`(worktree frontmatter 가 이
세션과 일치)가 예산 초과로 번들에서 완전히 빠졌다 — `harness-consistency-summary-downgrade-rule.md`
가 이미 추적 중인 미해결 스코프 산정 결함의 최신 재현이며, "governing plan 승격" 이라는 아직
문서화되지 않은 새 축이 드러났다. 실제 diff 를 직접 대조한 결과 spec 의 미해결 결정과 충돌하는
바는 없었으나, 이 diff 가 고친 결함(packages prepare stale dist)이 정확히
`harness-review-gate-ci-backstop.md` 가 예견한 "CI 활성화 후 실결함 발견" 서술의 실례인데도 그
plan 문서에 등재되지 않아, 같은 plan 이 몇 시간 전 스스로 지적한 "미등재 후속" 패턴이 반복됐다.

## 위험도
MEDIUM
