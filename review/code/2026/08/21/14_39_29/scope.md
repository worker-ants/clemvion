# 변경 범위(Scope) 검토 — masked-marker-contract-7d2e14 (라운드 9, 14_39_29 · 최종 확인)

## 검토 방법

target 은 "`MASKED_MARKERS`/`isMaskedMarker`/깊이 상한(`MAX_REDACT_DEPTH`/`MAX_MARKER_SCAN_DEPTH`)의
backend↔frontend 중복 정의를 `@workflow/masked-markers` 공유 패키지로 추출한다"는 단일 목표를 가진
PR 이다(근거: `plan/in-progress/masked-marker-shared-package.md`). `git diff origin/main...HEAD`
(151개 파일)를 직접 실측했고, `review/**` 를 제외하면 실질 코드/설정/spec/plan 변경은 정확히
**25개 파일**(`git diff origin/main...HEAD --stat -- . ':!review/**'`)이다. 이전 8라운드
(`11_27_29`~`14_19_12`)의 scope 리뷰가 이미 "등록 8곳·재export 전환·미러 소멸 가드·plan/spec
동반 갱신"을 목표 대비 정합하다고 반복 확인해 뒀으므로, 이번 라운드는 (a) 직전 라운드(`14_19_12`)의
수정 커밋(`85197720e`)이 새 스코프 일탈을 만들지 않았는지, (b) 8라운드 내내 반복 확인된 두 INFO 항목이
최종 diff 에도 그대로인지, (c) `spec/` 권한 경계 이탈이 최종 게이트 시점에도 남아 있는지를 직접
`git show`/`git diff`/`Read` 로 재검증했다.

## 발견사항

- **[INFO]** `pnpm-lock.yaml` 에 목표(`masked-markers` 추출)와 무관한 `eslint-config-next`
  peer-dependency 재해석이 최종 diff 에도 그대로 남아 있다 (9라운드 연속 동일 항목, 직접 재확인)
  - 위치: `pnpm-lock.yaml` — `codebase/frontend` importer 블록의 `eslint-config-next` 버전 문자열에서
    `(@typescript-eslint/parser@8.67.0(...))` peer 축이 사라지는 hunk(`git diff` 상단 `@@ -390,7 +393,7 @@`
    부근) 및 `snapshots:` 섹션의 `eslint-config-next@16.3.0(...)`/`eslint-import-resolver-typescript@...`
    재구성 부근(`@@ -16220,33 +16253,13 @@`, 소스 게이트 없는 삭제/재구성 구간이라 라인번호 대신 hunk 로
    기재).
  - 상세: `codebase/packages/masked-markers:` 신규 workspace 섹션(정확히 필요한 변경, `importers` 블록에
    `'@workflow/masked-markers': specifier: workspace:*` 2곳 + `devDependencies` 섹션 신설)과는 별개로,
    `pnpm install` 이 새 workspace 패키지 추가로 전체 peer-dependency 트리를 재계산하며 버전은 그대로인 채
    표기 구조만 dedup 됐다(`eslint-config-next@16.3.0` 버전 자체는 불변). 9라운드 전부 동일하게 INFO 로
    판정했고 실질 위험은 없다.
  - 제안: 조치 불요(불가피한 `pnpm install` 부산물, 버전 변경 없음). 9라운드 연속 반복 확인된 항목이라
    추가 조치를 요구하지 않는다.

- **[INFO]** 리뷰 산출물 `rationale_continuity.md`(`10_58_25` consistency 세션)에 sub-agent 의 중간
  추론 문장이 여전히 파일 최상단에 남아 있다 (9라운드 연속 미조치, 직접 재확인)
  - 위치: `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1`-`3` (현재 HEAD 상태를 직접
    `Read` 로 확인)
  - 상세: `"Confirmed accurate — this matches the target's table exactly..."`,
    `"Based on this extensive verification, I have sufficient grounds for my findings."` 두 문장이
    `## 발견사항` 헤더 앞에 그대로 남아 있다. target 코드 변경과 무관하고 리뷰 산출물(생성 아티팩트) 자체의
    흠이며, 라운드1 scope 리뷰가 처음 지적한 이래 매 라운드 "불요 판정 유지"로 처분돼 왔다.
  - 제안: 이 PR 의 스코프 판단에는 영향 없음(생성 로그의 후처리 이슈, 소스 코드 아님). 조치 불요.

- **[WARNING]** (기존 처분 재확인 — 새 발견 아님) `spec/` 편집이 `developer`/code-review RESOLUTION
  세션에서 직접 실행된 상태가 최종 diff 에도 그대로 남아 있다
  - 위치: `spec/5-system/14-external-interaction-api.md:1625`("마커 집합과 깊이 상한의 SoT 는 **공유
    패키지 `@workflow/masked-markers`** 다") 및 frontmatter `code:` 목록 `:16`
    (`codebase/packages/masked-markers/src/index.ts` 추가) — 커밋 `bf0618a7d`(라운드1 처분).
  - 상세: CLAUDE.md Skill 체계 표는 `developer` 쓰기 권한을 `codebase/**`·`plan/**`·
    `review/**/RESOLUTION.md` 로 한정하고 `spec/` 는 명시적으로 read-only 라고 규정하며, "구현 중 spec
    변경 필요 시 developer 는 멈추고 project-planner 위임" 이라는 별도 조항을 둔다. R17 SoT 문장 정정은
    별도 planner 턴 없이 code-review RESOLUTION 처분으로 같은 커밋에 직접 실행됐다. 이 항목은 이미
    라운드4(`12_50_37` `requirement.md` WARNING 2)와 라운드5(`13_14_29` `scope.md`)가 지적했고, 두 번 다
    "내용은 구현과 정확히 일치하고 SPEC-DRIFT 가 아니므로 되돌릴 필요 없음, CLAUDE.md 예외 조항 추가는
    이 PR 과 무관한 별도 project-planner 턴" 으로 **의도적으로 미해결 상태 유지**가 처분됐다(라운드6·7
    RESOLUTION 도 동일 처분 재확인). 최종 게이트 시점(`Read` 로 현재 HEAD 상태 직접 확인)에도 그 경계
    이탈은 여전히 diff 에 존재한다 — 새로 발견한 사실은 아니며, 세 라운드에 걸쳐 반복 재확인된 팀의
    명시적 결정이다.
  - 제안: 내용 자체는 정확하므로 되돌릴 필요는 없다(팀이 이미 반복 결정). "code-review RESOLUTION 이
    사소한 spec 텍스트 오류를 직접 정정할 수 있는 예외 조건"을 CLAUDE.md 에 명시하는 것은 이 PR 과 무관한
    별도 project-planner 턴으로 남긴다 — 이 PR 에 대한 추가 조치를 요구하지 않는다.

## 스코프 내로 확인한 항목 (참고 — 문제 없음, 최종 재확인)

- **실질 변경 25개 파일**(`review/**` 제외)이 전부 목표(공유 패키지 추출) 또는 그 목표가 요구하는
  CI/Docker/package.json 등록·spec/plan 동반 갱신·재발 방지 가드에 직접 대응한다. 목표와 무관한 노드·
  모듈·컴포넌트 변경은 없다.
- **등록 표면 8곳**(`test-stages.sh` INTERNAL_PACKAGES · `packages-checks.yml` pathspec/matrix/주석
  (5→6) · backend/frontend `package.json` workspace 의존 · 두 Dockerfile + `Dockerfile.playwright-e2e`
  COPY · `frontend-checks.yml` pathspec)는 plan 이 사전에 표로 열거한 항목과 정확히 대응하는 기계적 배선이다.
- **`sanitize-error-message.ts`/`masked-markers.ts`(frontend)** 는 `git diff` 로 직접 대조한 결과 상수·
  함수를 삭제하고 패키지에서 import 후 재export 하는 최소 변경이다 — 마스킹 정규식·판정 로직·소비처
  import 경로는 문자 그대로 동일, 소비처 리팩터링 없음.
- **미러 소멸 가드 4파일(backend/frontend × guard/spec, 721줄)** 은 이 PR 이 대체하는 정본 트래커 항목
  ("마커 미러 계약 테스트")의 집행이자, 8라운드에 걸쳐 이 PR 스스로 발견한 사각지대(경로 게이팅 미커버 →
  세 번째 스택 무방비 → 감시 목록 자체가 미러 → 1단계 스캔 누락 → 접두 경계 비대칭 → 문서 비대칭)를
  순차 교정한 결과다 — 코드량이 커졌지만 전부 이 PR 이 만든 안전망 자신의 자체 보정이며, 목표 밖 새
  기능 확장이 아니다.
- **직전 라운드(`14_19_12`) 수정 커밋(`85197720e`)** 은 `masked-markers.test.ts` JSDoc/테스트명 정정과
  `review/**` 산출물 커밋만 포함한다(`git show --stat` 로 직접 확인) — 새 스코프 일탈 없음.
- **`plan/in-progress/spec-sync-external-interaction-api-gaps.md`** diff 는 트래커 두 항목만 `[x]` +
  대체 근거로 정정하며 다른 무관 항목은 건드리지 않는다.
- **신규 패키지 보일러플레이트**(`package.json`/`tsconfig.json`/`eslint.config.mjs`/`README.md`)는
  `@workflow/ai-end-reason` 형제 패키지와 동일 틀이며 과잉 설정·불필요 의존성 추가가 없다.
- **`review/**` 산출물 다수(126개 파일)**는 CLAUDE.md 가 강제하는 `/consistency-check`(plan draft
  2세션)·`/ai-review` + fix 루프(code-review 9라운드) 표준 절차의 산출물이며, 코드 변경과 무관한 별도
  작업이 아니다 — "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 조항이 이 커밋 패턴을 명시적으로
  허용한다.

## 요약

25개 실질 변경 파일 기준으로 이 PR 은 "마스킹 마커 계약을 공유 패키지로 추출한다"는 단일 목표에 9라운드
내내 타이트하게 수렴했다. 직전 라운드의 fix 커밋은 문서 정정 하나에 그쳐 새 스코프 일탈이 없음을
확인했고, 등록 8곳·재export 유지·미러 소멸 가드의 순차 보정 전부가 plan 이 사전에 실측·명시한 항목이거나
이 PR 이 스스로 발견한 사각지대의 자체 교정이다. 최종 게이트 시점에도 남아 있는 유일한 WARNING 은 spec/
직접 편집(권한 경계 이탈)이며, 이는 새로 발견한 문제가 아니라 3라운드에 걸쳐 팀이 "내용은 정확하니 되돌리지
않고, 예외 조항 추가는 별도 PR" 이라고 반복 명시적으로 결정한 사안이 최종 diff 에도 그대로 존재한다는
사실의 재확인이다. INFO 두 건(`pnpm-lock.yaml` 의 무관한 `eslint-config-next` peer 재해석, 리뷰 산출물의
sub-agent 잔여 텍스트)도 9라운드 내내 동일하게 확인된 불가피한 부산물이며 target 코드의 실질 변경이
아니다. 새로 발견한 스코프 일탈은 없다.

## 위험도
LOW
