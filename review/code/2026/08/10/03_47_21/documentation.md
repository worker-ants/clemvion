# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `spec-plan-completion.test.ts` 신설 주석의 "캐시 충돌" 근거가 실측과 다르다 — cross-file 공유는 일어나지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:93-97` (`describe("Gate C — plan-completion spec-consistency")` 내부 `enforced` 필터의 `matter(fs.readFileSync(abs, "utf8"), {})` 위 주석)
  - 상세: 새로 붙은 주석은 "이 가드와 `plan-scan.ts` 는 같은 `plan/complete/**` 를 각각 파싱하므로 실제로 서로의 캐시를 밟는다" 라고 주장한다. 이 프로젝트의 실제 `vitest.config.ts`(격리 옵션 미지정 → Vitest 4 기본값 `isolate: true`)에서는 테스트 **파일**마다 모듈 레지스트리가 새로 생성되므로 `gray-matter` 의 module-level `matter.cache` 는 파일 간에 공유되지 않는다. 직접 재현 프로브로 확인했다: 서로 다른 두 test 파일에서 같은 깨진 YAML 을 옵션 없이 `matter()` 로 각각 처음 호출했을 때 **둘 다 독립적으로 throw** 했다(캐시가 공유됐다면 두 번째 파일의 호출은 throw 하지 않고 조용히 `{}` 를 돌려줬어야 한다). 즉 `spec-plan-completion.test.ts` 와 `plan-scan.ts`(→ `plan-frontmatter.test.ts`/`plan-scan.test.ts`)가 서로 다른 test 파일에서 각각 이 캐시를 밟는 일은 이 러너 설정상 일어나지 않는다.
    `{}` 옵션 자체(버그 픽스)는 여전히 필요하고 옳다 — 진짜 이유는 **같은 파일 안에서** 같은 plan 내용을 두 번 파싱하기 때문이다(97번째 줄 근방의 `enforced` 필터 1회 + 아래 `describe(rel, …)` 블록에서 1회, 총 2회, 같은 모듈 인스턴스 안). 다만 새 주석이 실제로 일어나지 않는 cross-file 상호작용을 근거로 대고 있어, 나중에 이 파일들의 실행 모델(같은 워커에서 상태를 공유한다)을 오해하게 만들 소지가 있다.
  - 제안: "서로의 캐시를 밟는다" 부분을 삭제하거나, "이 **파일 안에서** 같은 plan 을 두 번(필터 단계 + per-plan 단계) 파싱하므로" 로 정정한다. `plan-scan.ts` 의 같은 주석(`checkPlanFrontmatter` 자리, 같은 파일 내 캐시 오염만 언급)과 톤을 맞추면 자연스럽다.

- **[INFO]** 같은 fix 의 두 번째 호출부에 설명 주석이 없다 — 첫 호출부 주석과 20줄 이상 떨어져 있어 단독 열람 시 이유가 안 보인다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:118` (`describe(rel, () => { const data = matter(fs.readFileSync(abs, "utf8"), {}).data ?? {}; …`)
  - 상세: `{}` 옵션이 여기서도 동일하게 필요하지만(같은 캐시 오염 hazard), 설명은 93-97번째 줄에만 있다. `plan-scan.ts` 는 같은 패턴에서 "이유는 `checkPlanFrontmatter` 의 같은 자리 주석 참조" 식으로 짧게 포인터를 남겨 두는 관례를 쓰는데, 이 파일의 두 번째 호출부는 그 포인터조차 없다.
  - 제안: `// 이유는 위 enforced 필터의 같은 자리 주석 참조.` 한 줄만 추가.

- **[INFO]** `plan-scan.ts` 의 module docstring 이 스스로 경계 지은 "네 벌 중 둘만 합쳤다" 프레이밍과, 같은 PR 이 신설한 후속 plan 문서의 요약 문장이 톤이 갈린다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:15-22` (교차 참조: `plan/in-progress/docs-guard-walker-dedup.md`, 이번 리뷰 대상 파일 목록에는 없음)
  - 상세: `plan-scan.ts` 는 "**이 파일이 합친 것은 그중 둘이다**"라고 정확히 스코프를 좁히고 "'네 벌을 하나로 합쳤다'로 읽히지 않도록 범위를 명시한다" 라고 스스로 경고까지 붙여 놨다. 그런데 같은 PR 이 신설한 `plan/in-progress/docs-guard-walker-dedup.md` 의 첫 요약 문장은 정확히 그 경고가 막으려던 표현 그대로다: "`plan-lifecycle-gates` 가 **plan walker 를 네 벌 → 한 벌**로 줄였다." 몇 줄 뒤 "## 함께 볼 것 — Gate C 의 4번째 walker" 절에서 `collectCompletePlans` 가 "여전히 독립 구현" 이라고 스스로 정정하지만, 요약 줄만 훑는 독자는 완전 통합으로 오독할 수 있다. (실측: `spec-plan-completion.test.ts` 의 `collectCompletePlans` 는 이번 diff에서 손대지 않았고 지금도 별도 구현이다 — `plan-scan.ts` 의 claim 이 맞고 후속 문서 요약 줄이 자기모순적이다.)
  - 제안: 이번 PR 범위는 아니지만, `docs-guard-walker-dedup.md` 를 다음에 손댈 때 요약 문장을 "plan walker 3벌 중 2벌(live/complete 수집기)을 한 벌로 줄였다. Gate C 의 4번째는 별도(§ 아래)" 식으로 `plan-scan.ts` 의 정확한 표현에 맞춰 정정할 것.

## 확인했지만 문제 없음 (참고)

- `plan-lifecycle.md`/`PROJECT.md` 의 가드 설명(§4 `status` 종료값 규칙, live-plan 링크 무결성, Gate C)은 이번 diff 의 실제 구현과 정확히 일치 — README/API 문서 갱신 누락 없음.
- `plan-lifecycle.md` 가 인용한 실패 이력 `#1108`·`#1117` 은 실제 커밋 로그로 검증됨 — `#1117`(`69f4307dd`) 커밋 메시지가 `#1108` 3차 ai-review 에서 같은 실패형을 지적당했음을 직접 교차 언급한다.
- `plan-scan.ts` 가 가리키는 후속 plan `plan/in-progress/docs-guard-walker-dedup.md` 는 실재하며, Gate C의 `collectCompletePlans` 가 `walkPlanMarkdown` 과 필터 값이 "현재 일치(실측)" 라는 claim 도 두 구현을 직접 대조해 확인됨(exclude `archive/`, `.md`+`0-`/`_` 제외, 동일).
- CHANGELOG.md 는 product-facing 변경만 기록하는 기존 관례이고 이번 PR 은 harness/CI 성격의 내부 test-guard 라 항목 불필요 — 갱신 누락 아님.
- 신규 export(`checkPlanFrontmatter`, `findNonTerminalCompletedPlans`, `findBrokenPlanLinks` 등)는 모두 JSDoc-스타일 블록 주석과 근거(fixture 참조, 실측 여부)를 갖추고 있어 문서화 수준이 이 리포지토리 평균보다 높음.

## 요약

`plan-scan.ts`/`plan-scan.test.ts`/`spec-links.ts`/`plan-lifecycle.md` 전반의 문서화 품질은 높다 — 모든 비자명 분기에 근거·fixture 참조·실측 여부가 달려 있고, SoT 문서(`plan-lifecycle.md`, `PROJECT.md`)도 이번 구현과 정확히 동기화되어 있다. 유일하게 구체적으로 반증된 문제는 `spec-plan-completion.test.ts` 에 새로 붙은 주석 하나로, `{}` 캐시 우회 fix 자체는 옳지만 그 근거로 든 "다른 test 파일과 캐시를 공유한다" 는 서술이 이 프로젝트의 Vitest 기본 격리 설정 하에서 실측상 거짓이다(직접 프로브로 반증) — 코드 동작에는 영향 없는 주석 정확성 문제다. 나머지는 INFO 수준의 사소한 포인터 누락·문구 톤 불일치.

## 위험도

LOW
