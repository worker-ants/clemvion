# 의존성(Dependency) 리뷰 결과

## 발견사항

- **[WARNING]** `plan-scan.ts` 모듈 docstring 이 서술하는 내부 의존 관계가 같은 diff 안의 실제 코드와 어긋난다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:18-22` (docstring) / `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59-64` (실제 위임 코드)
  - 상세: `plan-scan.ts` 상단 주석은 "Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 는 **아직 독립 구현으로 남아 있고**... 그 통합은 `plan/in-progress/docs-guard-walker-dedup.md` 에 등재했다"라고 적는다. 그러나 실제로 `spec-plan-completion.test.ts:62-64` 의 `collectCompletePlans` 는 이미 `collectCompletePlanMarkdown(root).map((f) => f.absPath)` 로 `plan-scan.ts` 를 직접 호출·위임하고 있다 — 손으로 짠 독립 DFS 가 아니다. 게다가 연결된 후속 plan 문서(`plan/in-progress/docs-guard-walker-dedup.md`) 의 "2026-08-10 추가" 절이 스스로 "Gate C 동등성 갭도... `collectCompletePlans` 를 공유 구현 위임으로 축소(해소)했다"고 정정해 두었는데, `plan-scan.ts` 의 모듈 docstring 자체는 갱신되지 않았다. 미래 독자가 이 주석만 보고 "아직 안 합쳐졌다"고 오판하면 (a) 이미 존재하는 내부 의존(spec-plan-completion.test.ts → plan-scan.ts)을 놓치거나 (b) 이미 끝난 위임을 다시 하려고 시도할 위험이 있다.
  - 제안: `plan-scan.ts` 상단 주석을 "Gate C 의 `collectCompletePlans` 는 이번 PR 에서 `collectCompletePlanMarkdown` 위임으로 정리했다"로 갱신하고, 아직 남은 통합 대상(스펙/코드베이스 walker, `spec-links.ts` 의 `collectSpecMarkdown`/`collectCodebaseSources`)만 후속 plan 참조로 남긴다.

- **[INFO]** 새 외부 의존성 없음 — `gray-matter` 는 기존 `dependencies` 에 이미 존재
  - 위치: `codebase/frontend/package.json:49` (`"gray-matter": "^4.0.3"`, 이번 diff 로 변경되지 않음)
  - 상세: `plan-scan.ts:29` 의 `import matter from "gray-matter"` 는 신규 패키지 도입이 아니라 이미 프로젝트 `dependencies` 에 존재하는 패키지의 재사용이다. `package.json`/lockfile 모두 이 diff 범위에서 변경 없음(`git diff origin/main...HEAD -- codebase/frontend/package.json` 무출력, 실측). 버전 고정·라이선스·취약점 재평가가 새로 필요하지 않다.
  - 제안: 없음(참고용).

- **[INFO]** 내부 의존성 구조는 순환 없이 단방향으로 정리됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` (import 블록), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:17`, `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:5`
  - 상세: `plan-scan.ts` 는 `fs`/`path`/`gray-matter` 만 import 하고 `spec-links.ts` 를 참조하지 않는다(실측: import 블록에 해당 없음). 반면 `spec-links.ts` 는 `collectLivePlanMarkdown` 을, `spec-plan-completion.test.ts` 는 `collectCompletePlanMarkdown`/`parseFrontmatterSafe` 를 `plan-scan.ts` 로부터 import한다 — fan-in 구조로 순환 의존 위험이 없다. 이는 "네 벌의 walker 중 plan 계열 둘을 `walkPlanMarkdown` 으로 합쳤다"는 파일 docstring 의 취지와 실제로 부합한다(단, 위 WARNING 항목의 서술 정확도 문제는 별개).
  - 제안: 없음(참고용, 구조 자체는 양호).

- **[INFO]** `gray-matter` 캐시-회피 관용구(`matter(raw, {})`)가 아직 퍼지지 않은 잔여 호출부는 이번 diff 밖이며 이미 후속 plan 에 등재됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts:113` (`matter(raw)`, 옵션 없음 — 이번 diff 대상 아님, 변경 0줄 실측)
  - 상세: `plan-scan.ts` 의 `parseFrontmatterSafe` docstring 이 경고하는 것과 같은 클래스의 문제(옵션 없는 `matter()` 호출)가 `spec-frontmatter-parse.ts` 에 남아 있으나, 이 파일은 이번 diff 에서 손대지 않았고(`git log`/`git diff` 로 무변경 확인) `plan/in-progress/docs-guard-walker-dedup.md` "2026-08-10 추가" 절에 이미 후속 항목으로 등재돼 있다. 중복 지적 불필요.
  - 제안: 없음(이미 추적됨).

## 요약

이번 diff(`plan-scan.ts` 신설 + `spec-plan-completion.test.ts` 리팩터)는 새 외부 패키지를 도입하지 않았고, 유일하게 쓰이는 `gray-matter` 는 이미 프로젝트 `dependencies` 에 고정 버전 범위(`^4.0.3`)로 존재하는 기존 의존성이라 버전/라이선스/취약점 관점에서 재평가할 것이 없다. 내부 모듈 의존 구조(plan-scan.ts ← spec-links.ts, spec-plan-completion.test.ts)도 순환 없이 fan-in 형태로 정리되어 있어 설계상 건전하다. 다만 `plan-scan.ts` 모듈 docstring 이 "Gate C 의 `collectCompletePlans` 는 아직 독립 구현"이라고 적어 놓았는데, 실제 코드(같은 diff)는 이미 `collectCompletePlanMarkdown` 에 위임하도록 바뀌어 있고 연결된 후속 plan 문서조차 이를 스스로 정정해 두었다 — 이 docstring 만 갱신을 놓쳐 내부 의존 관계를 실제보다 좁게(또는 없게) 서술하는 상태다. 기능적 결함은 아니지만, 향후 독자가 이 주석을 근거로 이미 끝난 통합을 다시 시도하거나 실제 의존 관계를 놓칠 수 있어 WARNING 으로 분류한다.

## 위험도

LOW
