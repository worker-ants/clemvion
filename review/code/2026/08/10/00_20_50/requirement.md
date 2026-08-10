# 요구사항(Requirement) Review

## 검증 방법

정적 리뷰 외에 다음을 실측으로 교차검증했다:
- `pnpm vitest run src/lib/docs/__tests__/plan-frontmatter.test.ts src/lib/docs/__tests__/spec-links.test.ts` → **2 test files / 158 tests 전부 PASS** (실저장소 대상 positive 케이스 + 신규 진입점 negative-path 픽스처 포함).
- `plan/complete/**` 를 직접 순회해 실제 `status:` 값 분포를 집계 → `{complete: 128, applied: 3, implemented: 3, superseded: 1}` — 코드의 `TERMINAL_STATUSES = new Set(["complete","implemented","applied","superseded"])` 와 **정확히 일치**(초과·누락 없음).
- `plan/in-progress/*.md` 최상위 개수 실측 → 36개 (테스트의 `toBeGreaterThan(5)` 여유 확인).
- SoT 문서 `.claude/docs/plan-lifecycle.md` §3·§4·§5 본문과 코드를 line-level 대조.

## 발견사항

- **[WARNING]** `plan/complete/**` 재귀 순회가 이 PR 안에서마저 두 개의 독립 구현으로 다시 갈라졌다 — 이 PR 이 스스로 반복 경고하는 "두 곳이 조용히 틀어진다" 패턴의 새 인스턴스.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:55` (`collectCompletedPlans`, 55~71줄)
  - 상세: `plan-frontmatter.test.ts` 는 `in-progress/` 스캔은 `collectLivePlanMarkdown` 단일 구현으로 통합했다(파일 상단 주석이 그 이유를 "종전 손 재구현 사본이 `0-`/`_` 접두 필터에서 조용히 어긋났다"고 명시적으로 설명). 그런데 이번에 새로 추가한 `collectCompletedPlans`(status 모순 검사용, `plan/complete/**` 재귀 스캔)는 기존에 이미 존재하던 `spec-plan-completion.test.ts` 의 `collectCompletePlans`(Gate C 용, 동일하게 `plan/complete/**` 재귀 스캔)와 **또 다른 손 재구현**이다. 두 함수를 대조하면:
    - `collectCompletedPlans`(신규, 이 파일): `.md` 파일이면 `0-`/`_` 접두 **필터 없이** 전부 포함.
    - `collectCompletePlans`(기존, `spec-plan-completion.test.ts:59-83`): `!e.name.startsWith("0-") && !e.name.startsWith("_")` 로 인덱스/스크래치 파일을 **명시적으로 제외**.
    현재는 `plan/complete/**` 아래 `0-`/`_` 접두 파일이 실존하지 않아 실측상 무해하지만(직접 확인함), 향후 그런 파일에 `status:` 필드가 붙으면 이 파일의 검사와 Gate C 스캔 결과가 서로 다른 파일 집합을 근거로 판단하게 된다. 이 PR 의 커밋 메시지·주석이 정확히 이 실패 클래스("두 곳이 조용히 틀어진다")를 두 번(#1108, #1117) 겪었다고 밝히면서 `in-progress/` 쪽만 통합하고 `complete/` 쪽 기존 중복은 손대지 않았다.
    다만 이 차이가 **의도적**일 여지도 있다 — (a) 검사는 "complete/ 에 있는 모든 문서가 종료 상태를 정직하게 선언하는가"라는 순수 텍스트 정합성이라 인덱스 문서도 포함하는 것이 합리적일 수 있고, Gate C 는 "실제 완료 작업 단위만 spec_impact 결정을 강제"하는 다른 목적이라 인덱스 파일 제외가 합리적일 수 있다. 그러나 코드 어디에도 이 비대칭이 **의도적**이라는 설명이 없다 — 같은 파일 상단이 "그 사본이 접두 필터에서 조용히 어긋나 있었다"고 직접 서술하는 바로 그 실패를 재현할 잠재 조건을 만들어 놓고도 언급이 없다.
  - 제안: 두 검사가 동일 스코프를 의도한다면 `spec-links.ts` 에 `collectCompletePlanMarkdown` 류의 공유 함수를 만들어 `plan-frontmatter.test.ts`/`spec-plan-completion.test.ts` 양쪽이 쓰게 하거나(§(b) 가 `collectLivePlanMarkdown` 으로 한 것과 동형), 스코프가 의도적으로 다르다면 그 이유를 두 파일 중 한 곳에 최소 1줄로 명시할 것.

- **[INFO]** `collectCompletedPlans` 의 파일 판정이 `e.isDirectory()` 의 부정(`else`)만으로 `.md` 로 간주 — 형제 구현(`collectCompletePlans`)은 `e.isFile()` 을 명시적으로 검사한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:64` (`} else if (e.name.endsWith(".md")) {`)
  - 상세: `fs.readdirSync(..., { withFileTypes: true })` 의 `Dirent` 는 심볼릭 링크에 대해 `isDirectory()`/`isFile()` 둘 다 `false` 를 반환할 수 있다. 현재 코드는 `isDirectory()` 가 아니면 즉시 `.md` 로 취급해, 이론상 `.md` 로 끝나는 심볼릭 링크가 있으면 (실 파일이 아니어도) 포함된다. 이 저장소에 그런 심볼릭 링크는 없어 현재는 무해하지만, 형제 함수와 정확도 기준이 다르다.
  - 제안: `e.isFile() && e.name.endsWith(".md")` 로 통일(사소하나 형제 구현과의 대칭성을 위해).

- **[INFO]** `.claude/docs/plan-lifecycle.md §4` 와 3개 리뷰 파일 사이 spec fidelity — line-level 대조 결과 **불일치 없음**. `TERMINAL_STATUSES` 값 집합(`complete`/`implemented`/`applied`/`superseded`)이 §4 본문 나열과 정확히 일치하고, 실제 `plan/complete/**` 데이터의 관측 분포와도 정확히 일치(초과 어휘·누락 어휘 없음). `worktree`/`started`/`owner` 필수 3필드, `(unstarted)` sentinel, placeholder 거부, `status` 선택 필드 처리, "top-level in-progress 만 링크 검사·complete/ 는 제외" 스코프 규칙까지 모두 §3·§4 본문과 부합한다. 이 기능 영역은 `spec/` 폴더가 아니라 `.claude/docs/plan-lifecycle.md` 가 SoT임을 CLAUDE.md 자체가 명시하므로 "spec/ 문서 부재"는 설계상 정상이며 갭이 아니다.

## 요약

`plan-frontmatter.test.ts`/`spec-links.ts`/`spec-links.test.ts` 세 파일은 plan 이동(`in-progress/` → `complete/`) 시 실제로 두 번(#1108, #1117) 놓쳤던 두 갭 — `status:` 모순과 형제 plan 상대링크 파손 — 을 정확히 SoT(`.claude/docs/plan-lifecycle.md` §3·§4)와 일치하는 규칙으로 게이트화했다. `TERMINAL_STATUSES` 어휘·필수 필드 스키마·스코프 경계 모두 실측 데이터와 spec 본문에 line-level 로 부합하며, negative-path 픽스처(코드펜스 무시, self-anchor 무시, 하위 스코프 제외, vacuity 가드)로 탐지 로직 자체의 작동을 뮤테이션 관점까지 고려해 검증했다(2 files/158 tests 전부 실행하여 PASS 확인). 유일하게 실질적인 지적은, 이 PR 이 스스로 "손 재구현 사본이 조용히 어긋난다"고 경계하는 바로 그 패턴이 `plan/complete/**` 스캔에 한해 통합되지 않고(`collectCompletedPlans` vs 기존 `spec-plan-completion.test.ts::collectCompletePlans`) 재발할 잠재 조건으로 남아있다는 점이다 — 현재는 실 데이터상 무해하지만 근본 원인(단일 구현 미통합)은 남아있다.

## 위험도

LOW
