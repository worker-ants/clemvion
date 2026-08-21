# 변경 범위(Scope) 검토 — masked-marker-contract-7d2e14 (라운드 5, 13_14_29 · 최종 확인)

## 검토 방법

target 은 "`MASKED_MARKERS`/`isMaskedMarker`/깊이 상한(`MAX_REDACT_DEPTH`/`MAX_MARKER_SCAN_DEPTH`)의
backend↔frontend 중복 정의를 `@workflow/masked-markers` 공유 패키지로 추출한다"는 단일 목표를 가진
PR 이다(근거: `plan/in-progress/masked-marker-shared-package.md`). `git diff origin/main...HEAD`
(95개 파일, +6619/-140)를 직접 실측했고, `review/**` 를 제외한 실질 코드/설정/spec/plan 변경만
따로 뽑으면 정확히 **24개 파일**이다(`git diff origin/main...HEAD --stat -- . ':!review/**'`).
이전 4라운드(`11_27_29`·`11_53_49`·`12_25_15`·`12_50_37`)의 scope 리뷰가 이미 "등록 8곳·재export
전환·미러 소멸 가드·plan/spec 동반 갱신"을 목표 대비 정합하다고 반복 확인해 뒀으므로, 이번
라운드는 (a) 그 결론이 최종 diff에서도 유지되는지, (b) 이전 라운드들이 **scope 관점에서는**
놓쳤던 각도가 있는지를 중심으로 재확인했다.

## 발견사항

- **[WARNING]** `spec/` 편집이 `developer`/code-review RESOLUTION 세션에서 직접 실행됐다 — CLAUDE.md 가 규정한 쓰기 권한 경계(`developer`: `spec/` read-only, spec 변경은 `project-planner` 위임) 밖의 편집이 최종 diff 에 그대로 남아 있다
  - 위치: `spec/5-system/14-external-interaction-api.md:1625`("마커 집합과 깊이 상한의 SoT 는 **공유 패키지 `@workflow/masked-markers`** 다") 및 frontmatter `code:` 목록 `:16`(`codebase/packages/masked-markers/src/index.ts` 추가) — 커밋 `bf0618a7d`("fix(guard): ... + spec R17 정정 — 라운드1 처분").
  - 상세: CLAUDE.md Skill 체계 표는 `developer` 쓰기 권한을 `codebase/**, plan/**, review/**/RESOLUTION.md` 로 한정하고 `spec/` 는 명시적으로 read-only 라고 규정하며, "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 이라는 별도 조항을 둔다. `code-review-agents`(리뷰어)의 쓰기 권한도 `review/code/**` 뿐이다. 그런데 R17 SoT 문장 정정은 별도 planner 턴 없이 code-review RESOLUTION 처분(`11_27_29` W3)으로 같은 커밋에 직접 실행됐다 — `plan/in-progress/masked-marker-shared-package.md:127-134` 가 이 선택을 스스로 명시("별도 planner 턴 대신 ... RESOLUTION 의 W3 처분으로 같은 턴에 집행")하므로 은폐된 위반은 아니다. 이 항목은 이미 라운드4(`12_50_37`) `requirement.md` WARNING 2 로 지적됐고, `RESOLUTION.md`("W2 — 기록만")는 "내용은 구현과 정확히 일치하고 SPEC-DRIFT 가 아니므로 되돌릴 필요가 없다. CLAUDE.md 에 예외 조항을 추가하자는 제안은 이 PR 에서 하지 않는다"고 **의도적으로 미해결 상태로 남겼다.** 즉 이번 최종 diff 에도 그 권한 경계 이탈은 여전히 존재한다 — scope 관점에서 새로 발견한 것은 아니지만(선행 라운드는 이를 "요구사항" 관점에서만 잡았고, scope 라운드들은 "spec 파일 변경 크기가 작다"는 점만 확인하고 **누가 수정할 권한이 있었는가**는 짚지 않았다), 최종 게이트 시점에도 남아 있다는 사실은 기록해 둘 가치가 있다.
  - 제안: 내용 자체는 정확하므로 되돌릴 필요는 없다(팀이 이미 그렇게 결정했고 재확인한다). 다만 "code-review RESOLUTION 이 사소한 spec 텍스트 오류를 직접 정정할 수 있는 예외 조건"을 CLAUDE.md 에 명시하는 것을 이 PR 과 무관한 별도 project-planner 턴으로 처리할 것을 권장한다 — 이 PR 은 이미 "규약을 내 편의에 맞춰 넓히는 방향이라 별도 판단이 필요하다"며 그 작업을 명시적으로 범위 밖에 뒀으므로, 이 제안은 이 PR 에 대한 추가 조치를 요구하지 않는다.

- **[INFO]** `pnpm-lock.yaml` 에 목표와 무관한 `eslint-config-next` peer-dependency 재해석이 최종 diff 에도 그대로 남아 있다 (4라운드 연속 동일 항목, 최종 재확인)
  - 위치: `pnpm-lock.yaml` — `codebase/frontend` importer 블록의 `eslint-config-next` 버전 문자열에서 `(@typescript-eslint/parser@8.67.0(...))` peer 축이 사라지는 hunk 및 `snapshots:` 섹션의 `eslint-config-next@16.3.0(...)`/`eslint-import-resolver-typescript@...`/`eslint-module-utils@...`/`eslint-plugin-import@...` 재구성 부근(소스 게이트 없는 삭제/재구성 구간이라 라인번호 대신 hunk 로 기재).
  - 상세: `codebase/packages/masked-markers:` 신규 workspace 섹션(정확히 필요한 변경)과는 별개로, `pnpm install` 이 새 패키지 추가로 전체 peer-dependency 트리를 재계산하며 버전은 그대로인 채 표기 구조만 dedup 됐다. 4라운드 전부(`11_27_29`·`11_53_49`·`12_25_15`·`12_50_37`) 동일하게 INFO 로 판정했고 버전 변경이 없어 실질 위험은 없다.
  - 제안: 조치 불요(불가피한 `pnpm install` 부산물). 이미 4라운드에 걸쳐 반복 확인된 항목이라 추가 조치를 요구하지 않는다.

## 스코프 내로 확인한 항목 (참고 — 문제 없음, 최종 재확인)

- **실질 변경 24개 파일**(`review/**` 제외)이 전부 목표(공유 패키지 추출) 또는 그 목표가 요구하는 CI/Docker/package.json 등록·spec/plan 동반 갱신에 직접 대응한다. 목표와 무관한 노드·모듈·컴포넌트 변경은 없다.
- **등록 표면 8곳** (`test-stages.sh` INTERNAL_PACKAGES · `packages-checks.yml` pathspec/matrix/주석(5→6) · backend/frontend `package.json` workspace 의존 · 두 Dockerfile + `Dockerfile.playwright-e2e` COPY) 전부 plan 이 사전에 표로 열거한 항목과 정확히 대응한다.
- **`frontend-checks.yml` pathspec 에 `codebase/channel-web-chat/**` 추가**(라운드2, `1f63bbbef`)는 새 기능이 아니라 "미러 소멸 가드가 서술한 커버리지(3개 스택 스캔)를 실제 CI 트리거와 맞춘다"는 이 PR 자신의 결함 자체 교정이며, 커밋 코멘트가 근거(W1, `11_53_49`)를 명시한다.
- **미러 소멸 가드 4파일(backend/frontend × guard/spec)** 은 이 PR 이 대체하는 정본 트래커 항목("마커 미러 계약 테스트")의 집행이자, 라운드별로 스스로 발견한 사각지대(경로 게이팅 미커버 → 세 번째 스택 무방비 → 감시 목록 자체가 미러 → 1단계 스캔 누락 → 접두 경계 비대칭)를 순차 교정한 결과다 — 새 기능 확장이 아니라 이 PR 이 만든 안전망의 자체 보정.
- **`plan/in-progress/spec-sync-external-interaction-api-gaps.md`** diff 는 트래커 두 항목만 `[x]` + 대체 근거로 정정하며 다른 무관 항목은 건드리지 않는다.
- **신규 패키지 보일러플레이트**(`package.json`/`tsconfig.json`/`eslint.config.mjs`/`README.md`)는 `@workflow/ai-end-reason` 형제 패키지와 동일 틀이며 과잉 설정·불필요 의존성 추가가 없다.
- **`review/**` 산출물 8세션**(consistency 2 + code-review 5 + 이번 라운드)은 CLAUDE.md 가 강제하는 `/consistency-check`·`/ai-review` 표준 절차의 산출물이며 코드 변경과 무관한 별도 작업이 아니다.

## 요약

24개 실질 변경 파일 기준으로 이 PR 은 "마스킹 마커 계약을 공유 패키지로 추출한다"는 단일 목표에 5라운드 내내 타이트하게 수렴했다 — 등록 8곳, 재export 유지, 미러 소멸 가드의 순차 보정 전부가 plan 이 사전에 실측·명시한 항목이거나 이 PR 이 스스로 발견한 사각지대의 자체 교정이며, 목표와 무관한 새 기능·리팩터는 없다. `pnpm-lock.yaml` 의 무관한 `eslint-config-next` peer 재해석은 4라운드 연속 동일하게 INFO 로 확인된 불가피한 부산물이다. 이번 라운드에서 scope 관점으로 새로 짚어 둘 것은 하나다 — spec R17 정정이 `developer`/code-review RESOLUTION 세션에 의해 `spec/` read-only 권한 경계 밖에서 직접 실행됐고, 이는 이미 라운드4 `requirement` 리뷰가 지적해 "기록만" 으로 처분(의도적 미해결)됐으며 최종 diff 에도 그대로 남아 있다. 내용 자체는 정확하고 팀이 이미 명시적으로 되돌리지 않기로 결정했으므로 이 PR 을 막을 사유는 아니지만, 프로젝트 거버넌스(CLAUDE.md) 관점에서 권한 경계가 한 번 침식된 선례로 남는다는 점은 최종 게이트 시점에도 재확인해 기록한다.

## 위험도
LOW
