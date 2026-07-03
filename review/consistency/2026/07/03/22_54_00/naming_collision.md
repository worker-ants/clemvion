# 신규 식별자 충돌 검토 — target: `spec/5-system/4-execution-engine.md` (impl-done, M-4 06-concurrency)

## 검토 범위 요약

target 은 spec 본문 변경이 없는 순수 코드 리팩토링(M-4, `06-concurrency` Option B)이다. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 에 신규 private 메서드 `failFirstSegmentSetupBestEffort` 를 추가하고, `executeAsync` / `runExecutionFromQueue` catch 블록이 이를 공유하도록 리팩토링했다. diff 전체(`git diff origin/main...HEAD --stat`)에서 신규 spec 파일·API endpoint·이벤트명·환경변수는 도입되지 않았다. 아래 발견사항은 (1) 신규 코드 식별자의 명명 유사도, (2) plan 라벨(M-4) 재사용 관례에 한정된다.

## 발견사항

- **[WARNING]** `failFirstSegmentSetupBestEffort` 가 기존 `failFirstSegmentSetup` 의 완전 접두 문자열 — 시각적 구분 어려움
  - target 신규 식별자: `failFirstSegmentSetupBestEffort` (private method, `execution-engine.service.ts:541`)
  - 기존 사용처: `failFirstSegmentSetup` (private method, `execution-engine.service.ts:497`, 기존 — ai-review W2 로 이미 도입돼 있던 메서드)
  - 상세: 신규 메서드명이 기존 메서드명 전체를 접두어로 포함하고 뒤에 `BestEffort` 만 덧붙인 형태다. 그런데 기존 `failFirstSegmentSetup` 자체의 docstring 도 "best-effort 마킹"을 명시하고 있어(`line 493, 526`), 두 메서드 모두 "best-effort" 의미를 내포한다 — 이름만으로는 "어느 것이 상위 래퍼이고 어느 것이 내부 구현인지" 즉시 구분되지 않는다. 실제로는 `failFirstSegmentSetupBestEffort` 가 `failFirstSegmentSetup` 을 호출하고 2차 실패를 흡수하는 얇은 wrapper(`.catch` 래핑)이며, 두 메서드는 호출 관계이지 동의어 관계는 아니다. grep 결과 두 심볼 모두 코드베이스 내 유일한 정의이고 타 영역과 충돌하지는 않는다 — 다만 코드 리뷰/유지보수 시 IDE 자동완성이나 grep 검색에서 서로 혼동될 여지가 크다.
  - 제안: 실질 문제는 아니므로 코드 변경을 강제할 필요는 없다(이미 `git log` 상 ai-review WARNING 을 반영해 추출된 헬퍼로, DRY 목적이 명확하고 docstring 도 관계를 설명하고 있음). 후속 네이밍 정리 시 `failFirstSegmentSetup` → `markFirstSegmentSetupFailed`(내부 구현) / `failFirstSegmentSetupBestEffort` → 유지, 또는 반대로 wrapper 를 `failFirstSegmentSetup`(공개 계약) 로 승격하고 내부 raw 버전을 `*Unsafe`/`*Raw` 로 개명하는 대안을 고려할 수 있다. 현재는 정보성 관찰이며 CRITICAL 급 혼선은 아니다.

- **[INFO]** plan 라벨 `M-4` 가 여러 refactor dimension 에서 독립 재사용 중 (target 이 신규로 만든 문제는 아님, 기존 컨벤션 확인)
  - target 신규 식별자: `plan/in-progress/refactor/06-concurrency.md` §M-4 (`executeAsync` fire-and-forget setup 2차 실패 best-effort 마감) — target 브랜치명 `claude/refactor-06-m4-e97346` 도 동일 라벨을 사용
  - 기존 사용처:
    - `spec/5-system/4-execution-engine.md:1397` Rationale — "park-entry dispatch registry 추출 (**M-4**, 2026-06-24)" (다른 작업, 이미 완료·병합됨, `plan/complete/refactor/02-architecture.md` M-4 로 귀속)
    - `spec/5-system/1-auth.md:693`, `spec/conventions/secret-store.md:155,318` — "refactor **04 M-4**" (JWT_SECRET/ENCRYPTION_KEY production fail-closed 가드, 전혀 다른 작업)
    - `plan/in-progress/refactor/README.md` — "03 C-3/M-4"(cafe24/makeshop 미러, 철회), "05 m-4"(DB Pool 캐시, 완료), "06 m-4"(abortSignal, 철회) 등 dimension 별로 M-4/m-4 라벨이 총 6개 이상 독립 재사용
  - 상세: 이 프로젝트의 refactor 백로그는 `01-*.md` ~ `07-*.md` dimension 파일마다 자체 Critical/Major/minor 넘버링(C-N/M-N/m-N)을 독립적으로 부여하는 기존 컨벤션을 갖고 있다(`README.md` 자체가 "02 M-4", "06 M-4" 처럼 항상 dimension prefix 를 붙여 명시적으로 구분). target 의 M-4 는 이 컨벤션을 정확히 따르고 있고, spec 본문(`4-execution-engine.md`)의 "M-4(2026-06-24)" 언급과 target 의 "M-4(06 concurrency)" 주석은 코드 주석 수준에서는 dimension 이름을 부기해 구분하고 있어(`// M-4 (06 concurrency)`) 실질 혼동 위험은 낮다.
  - 제안: 조치 불요. dimension-scoped 라벨 재사용은 기존 프로젝트 관례이며 target 이 새로 초래한 충돌이 아니다. 향후 신규 M-N 라벨을 추가하는 코드 주석에는 target 이 이미 실천한 것처럼 `(06 concurrency)` 와 같은 dimension 태그를 계속 병기할 것을 권장(이미 준수 중).

## 요약

target 은 spec 본문에 변경이 없는 순수 코드 리팩토링으로, 새로 도입한 식별자는 private 메서드 `failFirstSegmentSetupBestEffort` 하나뿐이며 신규 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로는 전혀 도입되지 않았다. 유일한 관찰은 신규 메서드명이 기존 `failFirstSegmentSetup` 의 완전 접두 문자열이라 시각적 혼동 여지가 있다는 점(WARNING)과, plan 라벨 `M-4` 가 여러 refactor dimension 에서 독립 재사용되는 기존 프로젝트 컨벤션을 target 도 그대로 따르고 있다는 점(INFO, 문제 아님)이다. 두 발견 모두 차단 사유가 아니다.

## 위험도

LOW
