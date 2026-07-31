# 의존성(Dependency) Review

## 리뷰 대상

- `codebase/frontend/package.json` — `git diff origin/main...HEAD` 로 실제 변경분을 직접 확인한 결과 2줄만 변경: `postcss` (`^8.5.14` → `^8.5.18`), `@tailwindcss/postcss` (`^4.2.2` → `^4.3.3`). 새 의존성 추가/제거 없음.
- `pnpm-lock.yaml` — 위 2개 버전 상향의 재해소 + peer-dependency 표현 문자열 확장(`jest@30.4.2` → `jest@30.4.2(...)` 류), `libc:` 플랫폼 메타데이터 필드 대량 제거, `enhanced-resolve` 등 무관 전이 패키지의 자연 재해소를 포함한 대량 diff(408줄). 패키지 이름 집합을 old/new 로 대조한 결과 신규·제거된 패키지는 없음 — 순수 lockfile 재생성 잡음.
- 두 파일 모두 이미 이 브랜치에 병합된 두 커밋(`66e574209`, `df860ce58`)의 최종 산출물이며, 직전 리뷰 라운드(`review/code/2026/07/31/11_23_04/dependency.md`)가 지적한 CRITICAL(postcss 보안 bump 부분 복원)이 `df860ce58` 로 해소된 이후 상태를 리뷰한다.

## 발견사항

- **[INFO]** postcss 취약 경로 완전 해소 — 직전 CRITICAL 조치를 독립 재검증
  - 위치: `codebase/frontend/package.json:34`(`"@tailwindcss/postcss": "^4.3.3"`), `codebase/frontend/package.json:52`(`"postcss": "^8.5.18"`); `pnpm-lock.yaml:442-444`, `pnpm-lock.yaml:496-498`
  - 상세: 직전 리뷰(`11_23_04/dependency.md`)는 `@tailwindcss/postcss@4.3.1` 이 caret 없이 고정한 내부 `postcss@8.5.15`(GHSA-r28c-9q8g-f849, HIGH — sourceMappingURL 경로순회로 임의 `.map` 파일 노출)가 CVE 상향 목표를 부분적으로만 달성시킨다고 CRITICAL 로 보고했다. 이후 커밋 `df860ce58` 가 `@tailwindcss/postcss` 를 `^4.3.3` 으로 상향해 내부 postcss 의존을 caret 부여된 범위로 바꿔 `8.5.25` 로 재해소시켰다(`pnpm-lock.yaml` 상 `'@tailwindcss/postcss@4.3.3':` 블록의 `dependencies.postcss: 8.5.25` 로 직접 확인). 이번 리뷰에서 **worktree 루트 기준으로** `pnpm audit --audit-level=moderate` 를 재실행해 독립 검증했다(주의: 최초 시도는 실수로 main 워크트리 경로에서 실행해 stale 상태인 `postcss@8.5.15`/`next@16.2.9` 를 감사했다 — 이는 이 코드베이스가 아니라 필자의 작업 경로 오류였고, 정정 후 올바른 worktree 에서 재실행함): 총 23건(1 low·7 moderate[1건 ignore]·15 high) 중 `postcss`·`@tailwindcss/postcss`·`next` 관련 advisory 는 **0건**. `grep -n "^  postcss@" pnpm-lock.yaml` 로도 `postcss@8.5.25` 단일 버전만 남아있고 취약 버전(`<=8.5.17`)은 파일 전체에서 완전히 제거됐음을 확인했다. `RESOLUTION.md` 가 self-report 한 "postcss 1건→0건, 총 21→20건"과 방향이 일치한다(정확한 총량 차이는 상시 갱신되는 audit DB 특성상 자연스러운 드리프트로 보이며, 핵심 주장인 "postcss 경로 소멸"은 재현됨).
  - 제안: 없음 — 조치 완료 확인.

- **[INFO]** `tailwindcss` 직접 의존성과 `@tailwindcss/postcss` 내부 엔진 버전 스큐 발생 (이번 diff 로 새로 생긴 부수 효과)
  - 위치: `codebase/frontend/package.json:66`(`"tailwindcss": "^4.2.2"`, 이번 diff 로 미변경) vs `codebase/frontend/package.json:34`(`"@tailwindcss/postcss": "^4.3.3"`, 이번 diff 로 상향); `pnpm-lock.yaml:538-540`(`tailwindcss: specifier ^4.2.2 / version 4.3.1`) vs `pnpm-lock.yaml:442-444`(`@tailwindcss/postcss: version 4.3.3`); `packages:` 해소 블록(`pnpm-lock.yaml` 內 `'@tailwindcss/postcss@4.3.3':` 항목, dependencies 에 `tailwindcss: 4.3.3` 명시 — 직접 파일 조회로 확인, 프롬프트 트렁케이션 밖 라인이라 게이트 인용 불가하여 블록명으로 기재)
  - 상세: `df860ce58` 가 `pnpm update @tailwindcss/postcss --filter frontend` 로 `@tailwindcss/postcss` 만 타겟 상향했고, 직접 의존 `tailwindcss`(caret `^4.2.2` 불변, lockfile 해소 `4.3.1`)는 손대지 않았다. 그 결과 `@tailwindcss/postcss@4.3.3` 이 내부적으로 요구하는 `tailwindcss@4.3.3` 과 워크스페이스가 직접 선언한 `tailwindcss@4.3.1` 이 서로 다른 버전으로 갈렸다(diff 전에는 `git show origin/main:pnpm-lock.yaml` 대조 결과 우연히 둘 다 `4.3.1` 로 일치했었음 — 이번 diff 가 스큐를 새로 만든 것). Tailwind 팀은 `tailwindcss`/`@tailwindcss/postcss`/`@tailwindcss/oxide`/`@tailwindcss/node` 를 lockstep 버전으로 배포하는 관례라 이 상태는 팀 관례에서 벗어난다. 다만 실사용 영향은 낮다 — `postcss.config.mjs` 가 `@tailwindcss/postcss` 플러그인만 등록하므로(`plugins: { "@tailwindcss/postcss": {} }`) 실제 CSS 컴파일은 항상 `4.3.3` 엔진을 타고, `codebase/frontend/src` 전체에서 bare `tailwindcss` 패키지를 직접 import/require 하는 코드가 없음을 grep 으로 확인했으며, bare `tailwindcss@4.3.1` 자체가 lockfile 상 의존성이 전혀 없는 빈 셸(`tailwindcss@4.3.1: {}`)이라 `@tailwindcss/oxide` 네이티브 바이너리 중복 설치 등 빌드시간/설치용량 실질 영향도 없다(오직 `@tailwindcss/oxide@4.3.3` 한 버전만 lockfile 에 존재).
  - 제안: `"tailwindcss": "^4.2.2"` 도 `"^4.3.3"` 이상으로 동반 상향해 `@tailwindcss/postcss` 와 lockstep 을 맞추는 것을 권장(급하지 않음 — 다음 정기 의존성 갱신에 포함해도 무방).

- **[INFO]** `pnpm-workspace.yaml` 의 `next>postcss` 오버라이드 하한이 새 직접 의존 하한보다 낮게 남음 (이번 diff 범위 밖, 직전 리뷰 제안 미조치 확인)
  - 위치: `pnpm-workspace.yaml:40`(`next>postcss: ^8.5.14`) — 이 파일은 이번 리뷰 대상 2개 파일(`package.json`, `pnpm-lock.yaml`)에 포함되지 않으며 이번 diff 로 변경되지 않았다.
  - 상세: 직전 리뷰(`11_23_04/dependency.md`)가 "제안 4"로 `next>postcss` 오버라이드도 `^8.5.18` 로 동반 상향해 표현 하한을 직접 의존성과 정합시키라고 권고했으나, `df860ce58` 는 `@tailwindcss/postcss` 상향에만 집중했고 `RESOLUTION.md` 에도 이 부분에 대한 언급이 없어 미조치로 남았다. 실질 위험은 낮다 — 두 경로(직접 `postcss` 의존, `next>postcss` 오버라이드) 모두 현재 `8.5.25` 로 동일하게 해소되고, `^8.5.14` 자체가 상한 없이 `<9.0.0` 전체를 허용하므로 향후 재해소에서도 즉시 회귀하지는 않는다. 다만 오버라이드가 표현하는 "보장 최소 안전선"이 직접 의존 하한(`^8.5.18`)보다 헐거운 상태로 남아 의도와 표현이 어긋난다.
  - 제안: 여유 있을 때 `pnpm-workspace.yaml:40` 과 `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES["next>postcss"]` 를 함께 `^8.5.18` 로 상향(PROJECT.md 규약상 2-place 동시 갱신 필요 — 미동기화 시 config-guard CI 가 오탐). 급하지 않은 후속 항목으로도 무방.

## 요약

이번 diff(`codebase/frontend/package.json` 2줄 + `pnpm-lock.yaml` 재해소)는 새 외부 의존성 추가·라이선스 리스크·버전 고정 정책(PROJECT.md §버전 핀 정책) 위반이 전혀 없는 순수 보안 버전 상향(`postcss` `^8.5.14→^8.5.18`, `@tailwindcss/postcss` `^4.2.2→^4.3.3`)이다. 직전 리뷰 라운드가 CRITICAL 로 지적한 "같은 CVE(GHSA-r28c-9q8g-f849)에 취약한 `@tailwindcss/postcss` 내부 postcss@8.5.15 잔존"은 이후 커밋 `df860ce58` 로 완전히 해소됐음을, 이번 리뷰에서 올바른 worktree 기준 `pnpm audit --audit-level=moderate` 독립 재실행(postcss·@tailwindcss/postcss·next 관련 advisory 0건, `pnpm-lock.yaml` 전체에서 취약 `postcss` 버전 완전 제거)으로 재확인했다. `pnpm-lock.yaml` 의 나머지 대량 diff 는 신규/제거 패키지 없이 peer-dependency 표현 확장·`libc:` 메타데이터 제거뿐인 순수 lockfile 재생성 잡음으로 확인했다. 유일한 잔여 관찰은 (1) `tailwindcss`(직접 의존, 4.3.1)와 `@tailwindcss/postcss` 내부 엔진(4.3.3) 사이에 이번 diff 로 새로 생긴 버전 스큐(실사용 영향 없음 — 직접 import 없고 bare tailwindcss 는 빈 셸), (2) `pnpm-workspace.yaml` 의 `next>postcss` 오버라이드 하한이 새 직접 의존 하한보다 낮게 남은 것(범위 밖, 실질 위험 없음) — 둘 다 병합을 막지 않는 위생(hygiene) 수준 INFO다.

## 위험도

LOW
