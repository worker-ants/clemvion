# RESOLUTION — review/code/2026/07/31/11_23_04 (경로 지정 라운드)

대상: `codebase/frontend/package.json` (postcss 보안 bump 복원 커밋). `--branch` 기반 라운드
(`11_12_29`)가 이 파일을 changeset 에서 통째로 누락해, 경로를 명시(`--prepare <path>`)해 다시 돌린
라운드다.

결과: **Critical 1 · Warning 1 · INFO 2**. Critical 을 조치 완료했다.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| CRITICAL #1 | 코드(의존성/보안) | `df860ce58` | `@tailwindcss/postcss` `^4.2.2` → `^4.3.3` + lockfile 갱신. **실측 확인**: `pnpm audit --audit-level=moderate` 의 postcss 항목 **1건 → 0건**(`codebase__frontend>@tailwindcss/postcss>postcss` 경로 소멸), 총 21 → 20건 |
| WARNING #1 | 문서(추적성) | `df860ce58` 계열 + plan | 스코프 이탈 커밋의 사유를 plan 에 각주로 남기라는 지적. plan §3 및 각 커밋 메시지에 경위·사용자 확인을 명시했다 |
| INFO #1·#2 | 검증 완료 | 조치 불요 | caret 유지·핀 정책 준수·부수 잡음 0건 확인 |

### CRITICAL #1 — 검증과 정정

리뷰어 주장을 **액면 그대로 받지 않고 직접 실측**했다.

**사실로 확인된 부분**: `pnpm audit --audit-level=moderate` 가 GHSA-r28c-9q8g-f849(HIGH,
PostCSS sourceMappingURL 경로순회 → 임의 `.map` 파일 노출)를
`codebase__frontend>@tailwindcss/postcss>postcss` 경로로 실제 보고했다. `@tailwindcss/postcss@4.3.1`
은 하위 postcss 를 caret 없이 고정하고, 4.3.2 부터 `^8.5.16` 으로 바뀌어 해소가 가능하다
(`npm view @tailwindcss/postcss@latest dependencies.postcss` → `^8.5.16`).

**과대평가된 부분 — 정정**: 리뷰어는 이를 CRITICAL 로 올리며 근거를 "CI `pnpm audit` 게이트를
재유발할 가능성이 높다" 로 들었다. 이 인과는 성립하지 않는다. audit 은 **총 21건**을 보고하며
postcss 는 그중 **1건**이다. 나머지 20건은 backend·channel-web-chat 계열의 선재 취약점
(`brace-expansion`·`js-yaml`·`sharp`·`liquidjs`·`hono`·`typeorm` 등)이라, postcss 를 고쳐도
`pnpm audit` 은 **여전히 exit 1** 이다 — 게이트는 이 PR 과 무관하게 이미 실패 상태이고, 이 PR 이
"재유발" 하는 것이 아니다.

따라서 이 커밋의 목적은 **게이트 통과가 아니라 "postcss 보안 bump 복원" 목표의 완결**이다. 사용자
확인 후 포함했다. 남은 20건은 본 PR 범위 밖(별도 후속).

**부수 리스크 검증**: tailwind 마이너 업그레이드(4.2.x → 4.3.3)가 들어가므로 TEST WORKFLOW 를
전 단계 재수행했다(아래 §TEST 결과). 회귀 0건.

## TEST 결과

- lint  : 통과 — 55s (`_test_logs/lint-20260731-121532.log`)
- unit  : 통과 — backend 412 suites + frontend/web-chat/channel-web-chat/internal packages 전부.
  74s (`_test_logs/unit-20260731-121628.log`)
- build : 통과 — 232s, docker 이미지 빌드 + 프로덕션 이미지 위생 스모크 포함
  (`_test_logs/build-20260731-121748.log`)
- e2e   : 통과 — backend Jest e2e **260/260**, 356s, 재시도 없이 1회 통과
  (`_test_logs/e2e-20260731-122152.log`)

## 보류·후속 항목

- **audit 잔여 20건** — backend·channel-web-chat 계열 선재 취약점. `pnpm audit --audit-level=moderate`
  게이트가 이 때문에 실패 상태다. 본 PR 범위 밖이며 저장소 차원의 별도 대응이 필요하다. plan §3 등재.
- **`--branch` changeset 누락** — 이 라운드가 필요했던 이유 자체가 harness 결함이다. `11_12_29`
  라운드는 `meta.json.files` 23건 중 `codebase/` 0건으로 **검토 대상이 없는 채 `risk=NONE` 을 반환**
  했다(같은 시점 `git diff --no-renames --name-only 'origin/main...'` 은 73건 중 codebase 7건).
  경로 지정 우회는 정상 동작. plan §3 에 P1 로 등재.

민감 변경: 의존성 상향 1건(사용자 확인 완료). spec 변경·SPEC-DRIFT 0건.
