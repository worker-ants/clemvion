# 변경 범위(Scope) 검토 — masked-marker-contract-7d2e14 (라운드4, 12_50_37)

## 검토 방법

target 은 "`MASKED_MARKERS`/`isMaskedMarker`/깊이 상한(`MAX_REDACT_DEPTH`/`MAX_MARKER_SCAN_DEPTH`)의
backend↔frontend 중복 정의를 `@workflow/masked-markers` 공유 패키지로 추출한다"는 단일 목표를 가진
PR 이다(근거: `plan/in-progress/masked-marker-shared-package.md`). `git diff origin/main...HEAD`(82개
파일, +5462/-140)를 직접 실측해 프롬프트 목록과 대조했고, 이전 3라운드(`11_27_29`·`11_53_49`·
`12_25_15`)의 scope 리뷰 결과와 그 사이 fix 커밋(`bf0618a7d`·`1f63bbbef`·`811a40f48`)이 새로 스코프
일탈을 만들지 않았는지를 중심으로 재확인했다.

## 발견사항

- **[INFO]** `pnpm-lock.yaml` 에 목표와 무관한 `eslint-config-next` peer-dependency 재해석이 여전히 섞여 있다 (3라운드 연속 동일 항목, 재확인)
  - 위치: `pnpm-lock.yaml` — `codebase/frontend` importer 블록의 `eslint-config-next` 버전 문자열에서 `(@typescript-eslint/parser@8.67.0(...))` peer 축이 사라지는 hunk, 및 `snapshots:` 섹션의 `eslint-config-next@16.3.0(...)`/`eslint-import-resolver-typescript@...`/`eslint-module-utils@...`/`eslint-plugin-import@...` 재구성(`git diff origin/main...HEAD -- pnpm-lock.yaml` 직접 실측: `@@ -16220,33 +16253,13 @@` 부근, 소스 게이트 없는 삭제/재구성 구간).
  - 상세: `codebase/packages/masked-markers:` 신규 workspace 섹션(정확히 필요한 변경)과는 별개로, `pnpm install` 이 새 패키지 추가로 전체 peer-dependency 트리를 재계산하며 버전은 그대로인 채 표기 구조만 dedup 됐다. 3라운드 전부(`11_27_29`·`11_53_49`·`12_25_15`) 이 항목을 INFO 로 동일하게 판정했고, 이번 최종 diff 에도 동일 형태로 남아 있다.
  - 제안: 조치 불요(불가피한 `pnpm install` 부산물, 버전 변경 없음). PR 설명에 "masked-markers 와 무관한 lockfile 재해석 포함" 한 줄을 남기면 리뷰 노이즈를 줄일 수 있다.

- **[INFO]** 리뷰 산출물 `rationale_continuity.md`(10_58_25 세션) 최상단에 sub-agent 의 중간 추론 문장이 그대로 남아 있다 (3라운드 연속 미조치, 재확인)
  - 위치: `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1-3` (`Read` 로 현재 커밋 상태 직접 확인)
  - 상세: `"Confirmed accurate — this matches the target's table exactly..."`, `"Based on this extensive verification, I have sufficient grounds for my findings."` 두 문장이 `## 발견사항` 헤더 앞에 그대로 남아 있다. target 코드 변경과 무관하고 리뷰 산출물(생성 아티팩트) 자체의 흠이며, 라운드1 scope 리뷰가 이미 지적했으나 이후 라운드에서도 정정되지 않았다(불요 판정 유지로 보임).
  - 제안: 이 PR 의 스코프 판단에는 영향 없음. 다음 consistency-check 산출물 생성 시 정리되면 충분하다.

## 스코프 내로 확인한 항목 (참고 — 문제 없음)

- **등록 표면 8곳** (`test-stages.sh` INTERNAL_PACKAGES · `packages-checks.yml` pathspec/matrix/주석 카운트(5→6) · backend/frontend `package.json` workspace 의존 · backend/frontend/`Dockerfile.playwright-e2e` COPY 3곳) 전부 새 패키지 등록에 필요한 기계적 배선이고 plan 이 사전에 실측·표로 열거한 항목과 정확히 대응한다.
- **`sanitize-error-message.ts`/`masked-markers.ts`(frontend)** 는 상수·함수를 삭제하고 패키지에서 import 후 재export 하는 최소 변경 — 소비처 리팩터링 없음.
- **미러 소멸 가드 4파일(backend/frontend × guard/spec)** 은 이 PR 자체가 만든 재발 방지 요구를 집행한 것이고, 라운드1~3에서 발견된 사각지대(경로 게이팅 미커버·손 목록 자체가 미러·2단계 스캔 누락)를 라운드별로 닫으며 커진 것이라 스코프 일탈이 아니라 이 PR 이 스스로 발견한 결함의 자체 교정이다. `811a40f48` 의 코드 diff(guard 4파일 +21/+17/+19/+18줄)는 지적된 결함 하나(`resolveScanDirs` 1단계→2단계, 캐너리 하한→직접 단언)에 정확히 비례한다.
- **`plan/in-progress/masked-marker-shared-package.md` "후속 (이 PR 밖)" 섹션** — `811a40f48` 에서 신설된 backend `deepRedactSecrets` 깊이 경계 테스트 미비 항목은 **구현하지 않고 트래커에만 등재**한다(체크박스 `[ ]`). PR 스코프를 넓히지 않고 후속 작업으로 명시적으로 분리한 올바른 절제다.
- **`plan/in-progress/spec-sync-external-interaction-api-gaps.md`** diff 는 `:373`·`:757` 두 트래커 항목만 `[x]` + 대체 근거로 정정하며 다른 항목은 건드리지 않는다.
- **`spec/5-system/14-external-interaction-api.md`** 는 R17 SoT 서술과 frontmatter `code:` 목록(1줄 추가) 만 변경 — 다른 spec 영역은 무변경.
- **신규 패키지 보일러플레이트**(`package.json`/`tsconfig.json`/`eslint.config.mjs`/`README.md`)는 `@workflow/ai-end-reason` 형제 패키지와 동일 틀이며 과잉 설정·불필요 의존성 없음.
- **`review/**` 산출물 5세션**(`10_45_52`, `10_58_25`, `11_27_29`, `11_53_49`, `12_25_15`)은 CLAUDE.md 가 강제하는 `/consistency-check`·`/ai-review` 표준 절차의 산출물이며, 코드 변경과 무관한 별도 작업이 아니다.
- **`git diff --stat` 전체 재확인**: `review/**` 를 제외한 실질 코드/설정 변경 파일은 정확히 22개이고, 전부 masked-markers 이관 목표 또는 그 목표가 요구하는 CI/spec/plan 동반 갱신에 직접 대응한다. 목표와 무관한 파일(예: 다른 노드·모듈·무관 컴포넌트) 변경은 없다.

## 요약

이 PR 은 "마스킹 마커 계약을 공유 패키지로 추출한다"는 단일 목표에 4라운드 내내 타이트하게 수렴했다. 라운드2·3의 fix 커밋(`1f63bbbef`, `811a40f48`)이 추가한 코드는 모두 이 PR 자신이 발견한 가드 사각지대(세 번째 스택 무방비, 손 목록 자체가 미러, 1단계 스캔 누락)를 정확히 겨냥한 최소 교정이었고, 목표와 무관한 새 기능이나 리팩터를 끼워 넣지 않았다. `deepRedactSecrets` 깊이 경계 테스트처럼 스코프 밖으로 판단된 항목은 구현하지 않고 plan 트래커에만 등재해 범위를 지켰다. 발견된 두 건은 모두 INFO 수준으로 3라운드 내내 반복 확인된 것과 동일하다 — PR 목표와 무관한 `pnpm-lock.yaml` 의 부수적 의존성 재해석(불가피한 `pnpm install` 부산물)과 리뷰 산출물 하나에 남은 sub-agent 잔여 텍스트이며, 둘 다 target 코드의 실질 변경이 아니다.

## 위험도
LOW
