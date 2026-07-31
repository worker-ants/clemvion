# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 1건(non-blocking, 문서화 갭). `postcss`/`@tailwindcss/postcss` 보안 패치가 정확히 의도대로 적용됐고, 선행 CRITICAL 취약점(GHSA-r28c-9q8g-f849)은 이번 diff로 완전히 해소됨을 두 reviewer 모두 실측 확인. forced reviewer(`dependency`)를 포함해 이번 세션에 편성된 2개 reviewer 전원이 결과를 정상 반환했으며 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 범위(Scope) | `pnpm-lock.yaml` diff가 커밋 메시지가 명시한 범위(`pnpm update @tailwindcss/postcss --filter frontend`)를 넘어, `codebase/backend` 전체와 `codebase/packages/*` 6~7개 워크스페이스(ai-end-reason·chat-channel-validation·expression-engine·graph-warning-rules·node-summary·sdk·web-chat-sdk)의 `jest`/`ts-jest` peer-key 표기를 재작성하고, tailwindcss와 무관한 다수 네이티브 바이너리 패키지(`@css-inline/*`, `@img/sharp-*`, `@napi-rs/canvas-*`, `@next/swc-*`, `@rolldown/binding-*`, `@unrs/resolver-binding-*`)의 `libc:` 필드까지 정리함. `specifier:` 값은 전 구간 불변이고 버전 다운그레이드·신규 취약점 없음(dependency reviewer 교차 확인), TEST WORKFLOW 전체(backend 412 suites·e2e 260/260) 통과로 기능적 위험은 낮으나, plan/커밋 메시지 어디에도 이 넓은 blast radius가 설명돼 있지 않아 후속 리뷰어가 "postcss 보안 수정이 왜 sharp/canvas/rolldown/next-swc 항목까지 건드렸는지" 의아해할 소지가 있음 | `pnpm-lock.yaml:320`(backend `ts-jest`), `:625,628`/`:652,655`/`:683,686`/`:710,713`/`:737,740`/`:767,770`/`:800,806`(packages/* 6~7곳 jest/ts-jest), `:15368` 등 4곳(`eslint-import-resolver-typescript` peer-key), 다수 네이티브 바이너리 패키지 블록(`libc:` 필드 삭제) | 코드/lockfile 수정은 불요(non-blocking). plan 또는 커밋 메시지에 "lockfile 전역 재계산으로 backend·packages/*의 jest/ts-jest peer-key 표기 및 무관 패키지 `libc:` 필드가 함께 정리됨 — `specifier:` 불변, TEST WORKFLOW 전체 통과로 기능 영향 없음" 한 줄 추가 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안(Security) | 선행 CRITICAL 취약점(GHSA-r28c-9q8g-f849, PostCSS `sourceMappingURL` 경로순회 → 임의 `.map` 파일 노출, HIGH)이 이번 diff로 완전히 해소됨을 실측 재검증. `postcss@8.5.15` 스냅샷이 lockfile에서 완전히 제거되고 `postcss@8.5.25`(패치됨, `>=8.5.18` 요건 충족) 단일 인스턴스만 워크스페이스 전체에 남음. `@tailwindcss/postcss`를 `^4.3.3`으로 올려(4.3.2부터 상류가 `postcss`를 `^8.5.16` caret으로 회귀 수정) 취약 경로 자체를 해소 | `codebase/frontend/package.json:34,52` / `pnpm-lock.yaml:442-444,496-498,13233-13239` | 없음(정상 확인) |
| 2 | 범위(Scope) | `package.json` 변경이 plan §1 의도(postcss·`@tailwindcss/postcss` 2건 CVE 대응)와 정확히 1:1 일치하는 순수 2-라인 diff. 키 삽입 위치·알파벳 순서·주석·다른 의존성·`scripts`/`engines` 블록 모두 무변경 | `codebase/frontend/package.json:34,52` | 없음 |
| 3 | 버전정합(Version-Skew) | `next>postcss` 오버라이드 하한(`^8.5.14`)이 이번에 상향된 직접 의존성 하한(`^8.5.18`)보다 낮아 표현상 어긋나 있으나, 워크스페이스 전체 postcss가 이미 `8.5.25`로 단일 해소돼 실질 위험 없음(dependency reviewer 실측). scope reviewer가 이 오버라이드 값이 이번 diff에서 전혀 변경되지 않았음(plan §2 "범위 밖" 명시와 일치)을 독립 확인 — 계획된 경계가 정확히 지켜짐. plan §3(b)에 "override 상향 시 2-place 동시 갱신" 후속 이미 등재됨 | `pnpm-workspace.yaml:40`, `pnpm-lock.yaml:23`(override 참조), `scripts/check-pnpm-security-config.py:52` | 후속 PR에서 override 하한을 `^8.5.18` 이상으로 올릴 때 `EXPECTED_OVERRIDES["next>postcss"]` 동시 갱신 |
| 4 | 버전정합(Version-Skew) | `tailwindcss` 직접 의존성(`^4.2.2`, 해석 `4.3.1`)과 `@tailwindcss/postcss` 내장 엔진(`4.3.3`) 간 lockstep skew가 존재하나, 소스 전체에 bare `tailwindcss` import/require 0건 확인(실 CSS 컴파일은 `@tailwindcss/postcss` 엔진이 전담, dependency reviewer 실측) — scope reviewer도 이 항목이 diff에서 건드려지지 않았음(plan §2 "범위 밖" 명시와 일치)을 독립 확인. 병합 차단 사유 아님, plan §3(a) 후속 이미 등재됨 | `codebase/frontend/package.json:66` / `pnpm-lock.yaml:538-540` vs `13233-13239` | 후속 PR에서 `tailwindcss`도 `^4.3.3` 이상으로 함께 상향해 lockstep 회복(IDE 툴링 버전 스큐 제거) 권장 |
| 5 | 의존성(Dependency) | 내부 workspace 패키지(`@workflow/*`) 그래프 변경 없음, 클라이언트 번들 크기 영향 없음(postcss/tailwindcss는 build-time CSS 툴체인 전용), peer-semver 비호환 없음(예: `postcss-unique-selectors@7.0.7`의 `peerDependencies: postcss ^8.5.13`는 8.5.18/8.5.25 모두 충족) | `pnpm-lock.yaml` 전체 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| dependency | LOW | 선행 CRITICAL(postcss 경로순회, GHSA-r28c-9q8g-f849) 완전 해소를 실측 재검증. 잔여 스큐 2건(override 하한, tailwindcss lockstep)은 실질 위험 없는 저위험 후속 항목(plan에 이미 등재) |
| scope | LOW | `package.json` diff는 plan 의도와 100% 일치, 순수 2-라인. `pnpm-lock.yaml` diff가 명시 범위(`--filter frontend`)를 넘어 backend+packages/*까지 재작성된 점 WARNING 1건(기능 영향 없음, 문서화 갭) |

## 발견 없는 에이전트

없음 — 실행된 2개 에이전트(dependency, scope) 모두 최소 INFO 이상의 발견을 보고함.

## 권장 조치사항

1. (WARNING, non-blocking) plan(`plan/in-progress/postcss-lockfile-drift-fix.md`) 또는 커밋 메시지에 "lockfile 전역 재계산으로 backend·packages/*의 jest/ts-jest peer-key 표기 및 무관 패키지 `libc:` 필드가 함께 정리됨 — `specifier:` 불변, TEST WORKFLOW 전체 통과로 기능 영향 없음" 한 줄을 추가해 blast radius를 투명하게 남길 것.
2. (후속, plan §3(b)에 이미 등재됨) `pnpm-workspace.yaml:40`의 `next>postcss` 오버라이드 하한을 `^8.5.18` 이상으로 올릴 때 `scripts/check-pnpm-security-config.py`의 `EXPECTED_OVERRIDES["next>postcss"]`를 동시 갱신할 것.
3. (후속, plan §3(a)에 이미 등재됨) `tailwindcss` 직접 의존성을 `^4.3.3` 이상으로 함께 상향해 `@tailwindcss/postcss` 엔진과의 lockstep을 회복할 것.
4. 이번 PR 자체는 CRITICAL 0건·WARNING 1건(non-blocking)으로 수렴하여 병합을 막을 사유가 없음.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. 이번 세션에 편성된 전체 reviewer(`dependency`, `scope`) 실행, 제외된 reviewer 없음.
- **강제 포함(router_safety)**: `dependency` — forced 전원 결과 확보됨(누락 없음).