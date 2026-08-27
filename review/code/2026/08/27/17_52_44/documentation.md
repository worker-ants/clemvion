# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** 새 가드 scope 3(거버넌스 문서)가 SoT 로 지목된 spec 절에 반영되지 않았다
  - 위치: `spec/conventions/spec-impl-evidence.md:132` (§4.2 표의 `spec-link-integrity.test.ts` 행)
  - 상세: 이번 diff 는 `spec-link-integrity.test.ts`/`spec-links.ts`(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts:281-328`)에 **Scope 3(거버넌스 문서: 루트 `*.md` + `.claude/**.md`)** 를 신설했고, `PROJECT.md`("검사 스코프 3가지 (SoT: `spec/conventions/spec-impl-evidence.md` §4.2)")·`spec-link-integrity.test.ts` 상단 주석("SoT: spec/conventions/spec-impl-evidence.md §4.2")·`spec-links.ts` 상단 주석("SoT for spec evidence conventions: spec/conventions/spec-impl-evidence.md") **세 곳 모두**가 `spec-impl-evidence.md §4.2` 를 이 가드의 스코프에 대한 단일 진실로 인용한다. 그런데 실제로 `spec-impl-evidence.md:132` 의 표 행은 여전히 "**(1)** `spec/**.md` 본문, **및 (2)** codebase `.ts`/`.tsx` 소스" 두 스코프만 서술하고, 신설된 Scope 3 는 언급이 없다. 이 문서가 "본 절이 규약 SoT" 라고 스스로 선언한 절(§4.2 헤더)인 만큼, 코드가 가리키는 SoT 와 실제 SoT 본문이 어긋난 상태로 머지되면 다음에 §4.2 를 읽는 사람은 가드가 두 스코프만 본다고 오인한다.
  - 제안: §4.2 표의 해당 행에 "**및 (3)** 루트 `*.md`(비재귀) + `.claude/**.md` (`.claude/worktrees/` 제외)" 를 추가하고, 비고 칸에도 필요하면 제외 규칙(`worktrees`)을 짧게 기재한다. `developer` 는 spec 직접 수정 권한이 없으므로(CLAUDE.md §Skill 체계) `project-planner` 턴으로 반영하거나, 정책상 예외 요건(자기반증형 소정정)에 해당하지 않으면 `plan/in-progress/spec-update-*.md` 로 위임한다.

- **[INFO]** `spec-link-checks.yml` pathspecs 커버리지 회귀는 주석으로만 방어되고 테스트로 고정되지 않았다
  - 위치: `.github/workflows/spec-link-checks.yml` (`changes` job `pathspecs:` 블록, 게이트 47~68)
  - 상세: 이 워크플로 헤더 자신이 "이 저장소가 여섯 번 겪은 paths 커버리지 갭" 이라 적으며 scope 3 추가 시 같은 갭이 재현될 뻔했음을 인정한다. `harness-checks.yml` 은 정확히 이 클래스의 반복 회귀를 `.claude/tests/test_harness_checks_paths_coverage.py`(load-bearing filter 를 하나씩 제거해 RED 확인하는 회귀 캐너리)로 codify 했지만, `spec-link-checks.yml` 의 `pathspecs:` 커버리지는 이번에도 prose 주석(및 이번 fix 자체)에만 의존한다 — 향후 `spec-link-integrity.test.ts` 가 새 스코프를 추가할 때 `pathspecs` 동반 갱신을 잊으면 같은 형태로 다시 조용히 샌다.
  - 제안: 필수는 아니나, `test_harness_checks_paths_coverage.py` 와 유사한 소규모 회귀 테스트(예: `spec-link-checks.yml` 의 `pathspecs` 가 `spec-links.ts`/`spec-link-integrity.test.ts` 가 참조하는 루트를 실제로 커버하는지)를 후속 백로그로 남기는 것을 고려.

## 요약

리뷰 대상 diff 자체(코드·주석·PROJECT.md·plan 문서)는 문서화 품질이 높다 — 새 함수(`collectGovernanceMarkdown`/`findBrokenGovernanceLinks`)에 "왜 필요한가"·실측 수치(17,202개 vs 6개, BROKEN 4건 표)·날짜가 딸린 JSDoc/주석이 붙어 있고, 링크 수정 3건(`test-wrapper.md`·`spec-coverage/SKILL.md`·`PROJECT.md`)은 전부 실측(`test -f`)으로 정확함을 확인했다. `scripts/check-doc-links.py` 삭제도 전수 grep 결과 CI·hook·Makefile 어디에도 배선된 곳이 없어 "아무것도 안 지켰다" 는 삭제 근거가 사실과 일치하며, 남은 참조는 전부 `plan/complete/**`·`review/**` 의 시점 기록(수정 불필요)이다. 유일한 실질 갭은 새 Scope 3 가 자신을 SoT 로 지목하는 `spec/conventions/spec-impl-evidence.md §4.2` 표에는 반영되지 않은 점이며, 이는 이 저장소가 강하게 요구하는 "SoT 정합" 원칙에 정면으로 걸리는 완성도 문제라 WARNING 으로 분류했다. CHANGELOG.md 는 사용자 가시 동작·보안 변경 전용으로 운영되는 것으로 보여(내부 CI/하네스 툴링인 본 변경과 무관) 갱신 불요로 판단, README.md 는 이 변경과 무관해 갱신 대상 없음.

## 위험도

LOW
