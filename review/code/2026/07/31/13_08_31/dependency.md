# 의존성(Dependency) Review

## 리뷰 대상

- `codebase/frontend/package.json` — `@tailwindcss/postcss` (`^4.2.2` → `^4.3.3`), `postcss` (`^8.5.14` → `^8.5.18`) 2줄 버전 상향 (실측 `git diff --numstat origin/main...HEAD`: 2 insertions / 2 deletions)
- `pnpm-lock.yaml` — 위 2건에 대응하는 lockfile 갱신 (191 insertions / 217 deletions)
- 배경 조사: 커밋 이력(`8b2d378e3`, `2713834e1`), `plan/in-progress/postcss-lockfile-drift-fix.md`, 그리고 이 diff와 동일한 내용을 먼저 검토했던 별도 브랜치의 선행 리뷰(`git show 0cf2de889:review/code/2026/07/31/11_23_04/{dependency,SUMMARY,RESOLUTION}.md`)를 대조해, 이번 diff가 그 선행 CRITICAL 발견에 대한 조치 결과물임을 확인 후 독립적으로 재검증했다.

## 발견사항

- **[INFO]** 선행 CRITICAL 취약점(GHSA-r28c-9q8g-f849, PostCSS sourceMappingURL 경로순회 → 임의 `.map` 파일 노출, HIGH)이 이번 diff로 완전히 해소됨을 직접 실측 확인
  - 위치: `codebase/frontend/package.json:34`(`@tailwindcss/postcss`), `:52`(`postcss`) / `pnpm-lock.yaml:442-444`(`@tailwindcss/postcss` specifier/version), `:496-498`(`postcss` specifier/version), `:13233-13239`(`@tailwindcss/postcss@4.3.3` 스냅샷의 `postcss: 8.5.25` 의존)
  - 상세: 별도 브랜치의 선행 리뷰(`11_23_04`)가 "`@tailwindcss/postcss@4.3.1`이 하위 `postcss`를 caret 없이 `8.5.15`(취약 범위 `<=8.5.17`)로 고정해 `codebase__frontend>@tailwindcss/postcss>postcss` 경로가 여전히 취약"이라고 CRITICAL로 지적했다. 이번 diff는 `@tailwindcss/postcss`를 `^4.3.3`으로 올려(4.3.2부터 상류가 `postcss`를 `^8.5.16` caret으로 회귀 수정) 그 경로를 해소한다. `grep -oE 'postcss@[0-9]+\.[0-9]+\.[0-9]+' pnpm-lock.yaml`로 전수 조회한 결과 `postcss@8.5.15` 스냅샷은 diff에서 완전히 제거되고 `postcss@8.5.25`(패치됨, `>=8.5.18` 요건 충족) 단일 인스턴스만 워크스페이스 전체에 남는다. `scripts/check-pnpm-security-config.py`도 로컬 실행 결과 baseline과 일치(overrides 19건·onlyBuiltDependencies 5건·ignoreCves 1건, 회귀 없음).
  - 제안: 없음(정상 확인). 신규 의존성 도입·라이선스 리스크 없음(둘 다 기존 MIT 라이선스 패키지의 patch/minor 상향).

- **[INFO]** `pnpm-workspace.yaml:40`의 `next>postcss: ^8.5.14` 오버라이드 하한이 이번에 상향된 직접 의존성 하한(`^8.5.18`)보다 낮은 채 표현이 어긋나 있음 — 이번 diff의 범위 밖
  - 위치: `pnpm-workspace.yaml:40` (이번 diff는 이 파일을 건드리지 않음 — 직접 Read로 확인한 현재 상태), 대응 baseline `scripts/check-pnpm-security-config.py:52`
  - 상세: 실질 위험은 없다 — 위 항목에서 확인했듯 워크스페이스 전체에서 `postcss`는 이미 `8.5.25`로 단일 해소돼 있어, 이 오버라이드가 실제로 취약 구간(`8.5.14~8.5.17`)의 버전을 강제하지 않는다. 다만 이 오버라이드는 원래 동일 계열 postcss CVE 대응 목적으로 도입된 것으로 보이며(주석: "각 CVE 사유는 audit 커밋(b2bbb49e) 참조"), 직접 의존성 하한만 올리고 오버라이드 하한을 그대로 둔 것은 표현상 정합성 debt다. `plan/in-progress/postcss-lockfile-drift-fix.md` §3(b)에 "상향 시 `EXPECTED_OVERRIDES` 2-place 동시 갱신 필수"로 이미 후속 등재돼 있다(의도적 이번 PR 범위 제외 — `check-pnpm-security-config.py`는 override 값까지 정확 대조하는 가드라, 오버라이드만 단독으로 올리면 이번 diff가 baseline과 불일치해 그 자체로 CI를 깰 수 있어 별도 2-place PR로 미루는 판단은 합리적).
  - 제안: 이번 PR 병합을 막을 사유 아님. 후속 PR에서 `pnpm-workspace.yaml:40`을 `^8.5.18`(또는 그 이상)로 올릴 때 `scripts/check-pnpm-security-config.py:52`의 `EXPECTED_OVERRIDES["next>postcss"]`를 동시 갱신할 것.

- **[INFO]** `tailwindcss` 직접 의존성과 `@tailwindcss/postcss` 내장 엔진 간 lockstep skew — 빌드 경로 미사용 확인, 병합 차단 아님
  - 위치: `codebase/frontend/package.json:66`(`"tailwindcss": "^4.2.2"`, 이번 diff로 미변경) / `pnpm-lock.yaml:538-540`(해소 `4.3.1`) vs `pnpm-lock.yaml:13233-13239`(`@tailwindcss/postcss@4.3.3` 스냅샷이 내부적으로 요구하는 `tailwindcss: 4.3.3`)
  - 상세: 두 버전(`4.3.1`, `4.3.3`)이 lockfile에 병존한다. 직접 실측한 결과 실 빌드 경로에는 영향이 없다 — `codebase/frontend/postcss.config.mjs`는 `@tailwindcss/postcss` 플러그인만 등록하고, `codebase/frontend` 소스 전체에서 bare `tailwindcss` 패키지의 직접 `import`/`require` 는 0건(grep 확인). 즉 실제 CSS 컴파일은 전적으로 `@tailwindcss/postcss@4.3.3` 내장 엔진이 수행하며, 별도로 해소된 `tailwindcss@4.3.1`은 (예: Tailwind CSS IntelliSense 같은) 에디터 툴링 참조용으로만 잠재적으로 소비된다. `plan` §3(a)에 동일 관찰이 이미 후속 등재돼 있다.
  - 제안: 이번 PR 병합 차단 사유 아님. 후속으로 `tailwindcss` 직접 의존성도 `^4.3.3`(또는 그 이상)로 함께 올려 lockstep을 회복하면 IDE 툴링 버전 스큐까지 제거 가능.

- **[INFO]** `pnpm-lock.yaml` diff(총 408줄)의 상당 부분은 postcss/tailwind 변경과 직접 무관한 부수 재해소
  - 위치: `pnpm-lock.yaml` 전반 — 예: `enhanced-resolve@5.21.6→5.24.0/5.24.5` 승격, `jest`/`ts-jest`/`jest-config`/`ts-node`의 peer 해시 키 재구성(예: `jest@30.4.2` → `jest@30.4.2(@types/node@24.13.2)(ts-node@10.9.2(...))`), `eslint-import-resolver-typescript`의 peer 키 변경, 다수 네이티브 바이너리 패키지(`@css-inline/*`, `@img/sharp-libvips-*`, `@napi-rs/canvas-*`, `@next/swc-*`, `@rolldown/binding-*`, `@unrs/resolver-binding-*`)의 `libc:` 필드 제거
  - 상세: 이들 중 버전 다운그레이드나 신규 취약점을 유발하는 항목은 없다(모두 patch/minor 승격이거나 메타데이터 표현 변경). 단일 모노레포 lockfile에서 `pnpm update @tailwindcss/postcss --filter frontend`류 명령을 실행하면 pnpm이 공유 의존성 그래프 전체의 peer 해시를 재계산하며 나타나는 통상적 동작으로 보인다(`packageManager: pnpm@10.23.0`과 로컬 `pnpm -v` 일치 확인 — pnpm 버전 불일치로 인한 이례적 드리프트는 아님). `pnpm install --frozen-lockfile` 통과 + lint/unit/build(도커 이미지 빌드 포함)/e2e(260/260) 전 구간 그린이 plan 체크리스트에 기록돼 있어 실질 회귀 위험은 낮다.
  - 제안: 없음(참고용). 리뷰어는 이번 diff처럼 "타겟 패키지 1~2개 bump"를 의도해도 공유 lockfile 특성상 diff 크기가 커질 수 있음을 인지하고, 의미 있는 버전 변경(취약점 해소 대상)과 메타데이터성 부수 변경을 구분해 검토할 것.

- **[INFO]** 내부 의존성(`@workflow/*` workspace 패키지) 그래프 변경 없음, 번들 크기 영향 없음
  - 위치: `pnpm-lock.yaml` 전체(diff 범위 확인)
  - 상세: `@workflow/ai-end-reason`·`@workflow/chat-channel-validation`·`@workflow/expression-engine`·`@workflow/graph-warning-rules`·`@workflow/node-summary` 등 `workspace:*` 내부 패키지 링크는 diff에 등장하지 않는다. `postcss`/`@tailwindcss/postcss`는 build-time CSS 툴체인으로, 클라이언트로 전송되는 JS 번들 크기에는 영향이 없다(Next.js 빌드 파이프라인 소비 전용). peer-semver 비호환도 확인되지 않음(예: `postcss-unique-selectors@7.0.7`의 `peerDependencies: postcss ^8.5.13`는 8.5.18/8.5.25 모두 충족).
  - 제안: 없음(정상).

## 요약

이번 diff는 `origin/main`의 package.json↔lockfile 드리프트(`ERR_PNPM_OUTDATED_LOCKFILE`로 인한 빌드 차단)를 해소하는 동시에, 별도 브랜치에서 선행 진행된 리뷰가 CRITICAL로 지적했던 `@tailwindcss/postcss@4.3.1` 경유 postcss 잔존 취약점(GHSA-r28c-9q8g-f849, HIGH)을 완전히 제거한다 — `postcss@8.5.15` 스냅샷이 lockfile에서 소멸하고 `postcss@8.5.25`(패치됨) 단일 인스턴스만 남음을 `grep` 전수 조회로 독립 재검증했다. 신규 의존성 도입·라이선스 리스크·peer 비호환·버전 다운그레이드는 없으며, 두 패키지 모두 caret을 유지해 `PROJECT.md` §버전 핀 정책에 부합한다. 남은 관찰 사항 2건(① `next>postcss` 오버라이드 하한 스큐, ② `tailwindcss` 직접 의존성-엔진 lockstep 스큐)은 이번 diff가 새로 만든 문제가 아니라 사전에 `plan/in-progress/postcss-lockfile-drift-fix.md` §3에 후속으로 명시 등재된 저위험 항목이며, 둘 다 직접 확인 결과 현재 실질적 빌드/보안 영향이 없다(전자는 lockfile 전체가 이미 패치 버전으로 통일 해소, 후자는 소스에 bare `tailwindcss` import가 없어 실제로는 `@tailwindcss/postcss` 내장 엔진만 사용됨). `pnpm-lock.yaml` diff의 나머지 대부분은 postcss/tailwind 변경과 무관한 pnpm의 정상적 전체 그래프 재해소 부산물로, `frozen-lockfile` 통과와 lint/unit/build/e2e 전 구간 그린으로 이미 검증됐다. 병합을 막을 사유는 없다.

## 위험도

LOW
