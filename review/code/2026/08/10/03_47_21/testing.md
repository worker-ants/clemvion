# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `hasValidSpecImpact` 의 `NONE_VALUES` 대소문자·공백 trim·`n/a`/`na` 분기가 fixture 로 직접 검증되지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:25` (`NONE_VALUES = new Set(["none", "없음", "n/a", "na"])`), 판정 로직 `spec-plan-completion.test.ts:47-48` (`impact.trim().toLowerCase()`), 테스트 `spec-plan-completion.test.ts:171-179` (`"accepts \`none\`/\`없음\` and existing spec-path lists..."`)
  - 상세: 이번 diff 는 이 파일에서 `matter()` 캐시 우회 옵션(`{}`) 추가만 변경했고 `hasValidSpecImpact`/`NONE_VALUES` 자체는 그대로라 회귀는 아니다. 다만 기존 테스트는 `"none"`/`"없음"` 두 값만 단언하고, `NONE_VALUES` 에 등재된 `"n/a"`/`"na"`, 그리고 `.trim().toLowerCase()` 가 실제로 동작하는지(예: `"NONE"`, `" none "`, `"N/A"`)는 어떤 케이스로도 관측되지 않는다. `.trim()`/`.toLowerCase()` 호출을 지워도 스위트가 그대로 GREEN 인 죽은 코드 경로일 가능성이 있다 — 같은 파일이 바로 위(§Gate C 판정)에서 지적하던 "positive-only 라 검사가 작동한다는 증거가 못 됨" 패턴과 동형이다.
  - 제안: 기존 테스트에 `hasValidSpecImpact("NONE", exists)`, `hasValidSpecImpact(" none ", exists)`, `hasValidSpecImpact("n/a", exists)`, `hasValidSpecImpact("na", exists)` 케이스를 추가해 대소문자/trim/전체 어휘 4종을 실제로 겨눈다.

- **[INFO]** `spec-plan-completion.test.ts` 의 `collectCompletePlans` (private, still-duplicate walker) 는 `plan-scan.ts` 의 자매 함수(`collectCompletePlanMarkdown`)와 달리 negative-path fixture 커버리지가 없음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59-83` (`function collectCompletePlans`)
  - 상세: `plan-scan.ts` 상단 주석(`plan-scan.ts:18-22`)이 이미 이 상황을 인지하고 `plan/in-progress/docs-guard-walker-dedup.md` 에 통합 작업을 등재해 뒀다 — 새로 발견한 갭이 아니라 self-acknowledged debt. 다만 이 PR 이 정확히 "positive-only 실저장소 검사는 위반 분기가 검증되지 않는다" 는 교훈으로 `plan-scan.test.ts` 를 신설했는데, 같은 교훈이 이 sibling walker(`archive` 제외·`0-`/`_` 인덱스 제외·재귀)에는 아직 적용되지 않았다. 현재는 `plans.length > 10` 이라는 discovery 하한선만 있고, "정말로 `archive/` 를 제외하는가", "`0-`/`_` 파일을 제외하는가" 는 실저장소 데이터가 우연히 그 모양이라서 통과할 뿐 fixture 로 고정돼 있지 않다.
  - 제안: 통합 전까지는 `plan-scan.test.ts` 의 `collectCompletePlanMarkdown` fixture 를 재사용해 `collectCompletePlans` 에도 동일한 negative-path 최소 케이스(archive 제외, 재귀, 0-/_ 파일 제외)를 추가하거나, 통합 plan 을 앞당기는 것을 고려.

- **[INFO]** `walkPlanMarkdown` 의 `archive/` 제외가 최상위 깊이에서만 fixture 로 검증됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:74` (`if (e.name === "archive") continue;`) / 테스트 `plan-scan.test.ts:44` (`plan/complete/archive/old.md`)
  - 상세: `archive` 제외 검사는 순회 중 매 depth 에서 동일하게 적용되는 코드지만, fixture 는 `plan/complete/archive/old.md` (깊이 1)만 심어 뒀다. `plan/complete/nested/archive/deep.md` 같은 깊이 ≥2 케이스는 커버되지 않는다. 로직상 동작 차이가 날 이유는 없어 보이나(같은 `if` 가 스택 순회 매 단계에서 실행), 확인된 사실은 아니라 낮은 우선순위.
  - 제안: 필요 시 `nested/archive/` 케이스 한 줄 추가로 완전히 닫을 수 있음 (선택 사항).

## 요약

`plan-scan.ts`/`plan-scan.test.ts` 신설과 `spec-links.ts` 의 `findBrokenPlanLinks` 추출은 이례적으로 견고한 테스트 규율을 보여준다 — 실저장소 대상 positive-only 가드(`plan-frontmatter.test.ts`, `spec-plan-completion.test.ts`)가 "위반 분기가 한 번도 실행되지 않는다"는 문제를 뮤테이션 테스트로 실측한 뒤, 합성 fixture(`plan-scan.test.ts`, `spec-links.test.ts`)로 모든 위반 분기(status 모순 어휘, `archive`/`0-`/`_` 면제, YAML 비-문자열 `status` 4형태, 날짜 라운드트립 검증, whitespace-only 필드, 코드펜스 내부 링크 무시 등)를 실측 증명한다. 각 fixture 는 `mkdtempSync`+`afterAll` cleanup 으로 완전히 격리돼 있고 mock 없이 실제 파일시스템·실제 gray-matter/js-yaml 파서를 사용해 실동작과의 괴리가 없다. `plan-frontmatter.test.ts`/`spec-links.test.ts` 를 직접 열어 확인한 결과 새 `plan-scan.ts` export 를 정상적으로 소비하고 있어(구식 인라인 사본 잔존 없음) 통합 지점 회귀 위험도 낮다. 남은 갭은 모두 이번 diff 가 손대지 않은 인접 코드(Gate C 의 `NONE_VALUES` 일부 어휘/정규화 미검증, 아직 통합 전인 `collectCompletePlans` sibling walker 의 낮은 커버리지)이며 전부 낮은 우선순위의 INFO 다.

## 위험도

LOW
