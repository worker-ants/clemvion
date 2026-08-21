# 변경 범위(Scope) 검토 — masked-marker-contract-7d2e14

## 검토 방법

target 은 "`MASKED_MARKERS`/`isMaskedMarker`/깊이 상한(`MAX_REDACT_DEPTH`/`MAX_MARKER_SCAN_DEPTH`)의
backend↔frontend 중복 정의를 `@workflow/masked-markers` 공유 패키지로 추출한다"는 단일 목표를 가진
PR 이다(근거: `plan/in-progress/masked-marker-shared-package.md`). 36개 변경 파일 전부를 이 목표 대비
"필요한 변경인가/부수적 확장인가"로 분류했다.

## 발견사항

- **[INFO]** `pnpm-lock.yaml` 에 목표와 무관한 의존성 해석 그래프 변경이 섞여 있다
  - 위치: `pnpm-lock.yaml:396`, `pnpm-lock.yaml:16256`-`16324` (게이트 숫자 기준)
  - 상세: 신규 패키지 등록에 필요한 추가분(`codebase/packages/masked-markers:` 섹션, `@workflow/masked-markers` workspace 링크 2곳)과는 별개로, `eslint-config-next@16.3.0(...)` 의 peer-dependency 서명이 `(@typescript-eslint/parser@8.67.0(...))` 괄호를 통째로 잃는 방향으로 바뀌고, 그 여파로 `eslint-import-resolver-typescript`·`eslint-module-utils`·`eslint-plugin-import` 스냅샷 키가 연쇄적으로 재작성된다. 이 변경들은 `masked-markers` 패키지와 직접 관련이 없고, `pnpm install` 이 새 workspace 패키지를 추가하면서 전체 의존성 그래프를 재해석한 부수 효과로 보인다.
  - 제안: 통상 `pnpm install` 산출물이라 되돌리기 어렵고 대부분 이런 lockfile 재해석은 불가피한 노이즈다 — 다만 리뷰어가 diff 크기를 볼 때 "이 부분은 masked-markers 와 무관한 pnpm 재해석"이라는 점을 인지하도록 PR 설명에 한 줄 남기면 좋다. 블로킹 사유는 아니다.

- **[INFO]** 리뷰 산출물 `rationale_continuity.md`(10_58_25 세션) 앞부분에 무관한 텍스트가 섞여 있다
  - 위치: `review/consistency/2026/08/21/10_58_25/rationale_continuity.md:1`-`3`
  - 상세: 본문 `## 발견사항` 앞에 `"Confirmed accurate — this matches the target's table exactly..."`, `"Based on this extensive verification, I have sufficient grounds for my findings."` 두 문장이 그대로 파일 최상단에 남아 있다. sub-agent 응답의 중간 추론이 마크다운 산출물에 섞여 들어간 것으로 보이며, target 코드 변경과는 무관하고 이 PR 의 리뷰 산출물(생성 아티팩트)에 국한된 흠이다.
  - 제안: 이 PR 의 스코프 판단에는 영향 없음(생성 로그의 후처리 이슈). 다음 consistency-check 실행 시 정리되면 충분하다.

## 스코프 내로 확인한 항목 (참고 — 문제 없음)

- **등록 표면 8곳** (`test-stages.sh` INTERNAL_PACKAGES · `packages-checks.yml` pathspec/matrix/주석 카운트(5→6) · backend/frontend `package.json` workspace 의존 · backend/frontend/`Dockerfile.playwright-e2e` 의 COPY 3곳) 전부 새 패키지 등록에 필요한 기계적 배선이며, plan 문서가 8곳을 표로 미리 열거하고 실측한 대로 정확히 대응한다. 무관한 기존 패키지 항목은 건드리지 않았다.
- **backend `sanitize-error-message.ts` / frontend `masked-markers.ts`** 는 상수·함수를 삭제하고 패키지에서 import 후 재export 하는 최소 변경이다. 소비처 import 경로를 바꾸지 않기 위해 재export 를 유지한다고 plan 이 명시하고, 실제 diff 도 그 형태를 그대로 따른다 — 소비처 리팩터링은 없음.
- **`masked-marker-mirror-guard.ts`/`masked-marker-mirror.test.ts`(신규)** 는 이 PR 이 대체하는 정본 트래커 항목("마커 미러 계약 테스트")이 원래 요구하던 "미러가 되살아나지 않는지 기계로 확인"을 리터럴이 아닌 심볼 재선언 기준으로 구현한 것으로, plan 의 "미러 소멸 캐너리" 작업 항목과 정확히 대응한다. 새 기능 확장이 아니라 대체된 백로그 항목의 집행이다.
- **`plan/in-progress/spec-sync-external-interaction-api-gaps.md`** diff 는 `:373`·`:757` 두 트래커 항목만 `[x]` + 대체 근거로 정정하며, 다른 무관 항목은 건드리지 않는다(직전 consistency-check 라운드가 "둘 중 하나만 닫힐 위험"을 WARNING 으로 지적했으나, 최종 diff 에는 두 항목 모두 닫혀 있음을 확인).
- **spec 파일(`spec/**`)은 diff 에 전혀 포함되어 있지 않다** — plan 이 "R17 SoT 정정은 developer 권한 밖이라 planner 턴으로 분리한다"고 명시한 대로, 이번 PR 은 그 정정을 시도하지 않고 체크리스트에 미결(`[ ]`)로 남겨 뒀다. 권한 경계를 넘지 않은 올바른 스코프 절제.
- **신규 패키지 보일러플레이트**(`package.json`/`tsconfig.json`/`eslint.config.mjs`/`README.md`)는 기존 `@workflow/ai-end-reason` 등 형제 패키지와 동일한 틀을 재사용하며, 과잉 설정이나 불필요한 의존성 추가가 없다.
- **`review/consistency/**` 산출물 2세션**(`10_45_52`, `10_58_25`)은 CLAUDE.md 가 강제하는 "spec/plan 쓰기 직전 `/consistency-check` 의무" 절차의 표준 산출물이며, 코드 변경과 무관한 별도 작업이 아니다.

## 요약

이 PR 은 "마스킹 마커 계약을 공유 패키지로 추출한다"는 단일 목표에 매우 타이트하게 수렴한다. 8곳 등록 표면·재export 유지 전략·미러 소멸 캐너리·트래커 정정 전부가 plan 문서가 사전에 실측·명시한 항목과 diff 가 1:1 대응하며, spec 편집처럼 권한 밖인 항목은 의도적으로 손대지 않고 미결로 남겨 뒀다. 발견된 두 건은 모두 INFO 수준으로, PR 목표와 무관한 `pnpm-lock.yaml` 의 부수적 의존성 재해석(불가피한 `pnpm install` 부산물)과 리뷰 산출물 하나에 남은 sub-agent 잔여 텍스트뿐이며 둘 다 target 코드의 실질 변경이 아니다.

## 위험도
LOW
