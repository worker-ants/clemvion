# 변경 범위(Scope) 리뷰 — `deps-typeorm12`

## 발견사항

- **[INFO]** `pnpm-lock.yaml` diff 의 대다수(74줄 삭제 중 63줄)가 `@nestjs/typeorm` 범프와 무관한 `libc:` 메타데이터 필드 제거로 채워져 있다
  - 위치: `pnpm-lock.yaml` — 예) `@css-inline/css-inline-linux-arm64-musl@0.20.0`·`@img/sharp-linux-*@0.35.4`·`@napi-rs/canvas-linux-*@0.1.80`·`@next/swc-linux-*@16.3.5`·`@parcel/watcher-linux-*@2.6.0`·`@tailwindcss/oxide-linux-*@4.3.3`·`@unrs/resolver-binding-linux-*@1.12.2`·`lightningcss-linux-*@1.3x.0` 등 optional 플랫폼 바이너리 항목들. 삭제된 줄이라 new-file 게이트 번호가 없다(해당 hunk 는 `@@ -1241,28 +1241,24 @@` · `@@ -1798,105 +1794,89 @@` · `@@ -2348,35 +2328,30 @@` · `@@ -3362,42 +3334,36 @@` · `@@ -3997,42 +3963,36 @@` · `@@ -4173,28 +4133,24 @@` · `@@ -4813,61 +4769,51 @@` · `@@ -7692,56 +7638,48 @@` 부근)
  - 상세: 요청된 변경은 "`codebase/backend/package.json` 의 `@nestjs/typeorm`: `^11.0.3` → `^12.0.1`" 한 줄(plan `deps-typeorm12.md` §B 명시)뿐인데, 실제 `pnpm-lock.yaml` diff 는 74줄 삭제/11줄 추가로 훨씬 크고, 그중 `@nestjs/*` 와 무관한 수십 개 optional 패키지의 `libc: [glibc]`/`libc: [musl]` 필드가 통째로 사라졌다. 또한 frontend workspace 의 `eslint-plugin-import` peer 해석 문자열이 재포맷됐다(게이트 `16569`·`16626`·`16666` — `eslint-import-resolver-typescript@3.10.1` 뒤에 자기 자신을 되물고 도는 긴 버전 문자열로 확장). backend `@nestjs/typeorm` 변경과는 그래프상 접점이 없다.
  - `package.json` 의 `packageManager` 필드와 로컬 `pnpm --version` 이 둘 다 `10.23.0` 으로 일치해, memory 에 기록된 "워크스페이스 툴 버전 drift로 인한 drive-by 리포맷"(`feedback_workspace_tool_version_drift`) 케이스는 아닌 것으로 보인다 — 즉 버전 불일치가 원인은 아니고, 기존 lockfile 이 다른 시점/환경에서 만들어져 이번 `pnpm install` 이 정규화(normalize)하며 걷어낸 것으로 추정된다.
  - 제안: 기능적으로는 무해해 보이지만(런타임 미사용 optional 바이너리 메타데이터), 의도한 diff 가 "한 줄"이라는 plan 서술과 실제 lockfile diff 크기가 크게 어긋난다. PR 설명이나 plan 문서에 "lockfile 정규화로 무관 optional 패키지의 `libc` 필드가 함께 걷혔다"는 한 줄 근거를 남기거나, 가능하면 `pnpm install --lockfile-only` 재실행 결과가 재현 가능한지 확인해 두는 편이 다음 리뷰어의 혼란을 줄인다. 차단 사유는 아니다.

- **[INFO]** `review/consistency/2026/09/24/17_31_27/**` 8개 파일, `plan/in-progress/deps-typeorm12.md`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md` 갱신은 모두 이번 작업이 명시적으로 요구하는 절차 산출물(`--impl-prep` 의무 실행, plan 문서화)이며 코드 변경 범위 밖의 임의 추가가 아니다. `codebase/backend/package.json` 의 실질 변경도 요청된 한 줄(`@nestjs/typeorm` specifier)에 정확히 국한된다.

- **[INFO] (리뷰 대상 diff 밖의 관측 — 병렬 오염 가능성)** 워킹트리에 리뷰 대상 diff(파일 1~12)에 포함되지 않은 미커밋 수정이 하나 남아 있다: `codebase/backend/src/common/decorators/workspace.decorator.ts` 의 `handlerConsumesWorkspaceId` 본문이 원래 구현(`ROUTE_ARGS_METADATA` reflection) 대신 `return false; // MUTATION` 으로 바뀐 채다(`git diff` 로 직접 확인, 파일을 고치거나 되돌리지는 않았음).
  - 이 내용은 `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C·`deps-typeorm12.md` §C 가 서술한 "판별자(MB) — `handlerConsumesWorkspaceId` 를 항상 false 로" 검증용 뮤테이션과 정확히 일치한다. 즉 검증 목적의 임시 뮤테이션이 원복(`cp` + 절대경로)되지 않은 채 공유 워크트리에 남아 있는 것으로 보인다.
  - 이 파일은 이번 스코프 리뷰의 대상 diff(파일 1~12, `origin/main..HEAD`)에 포함되지 않으므로 이 PR 자체의 스코프 이탈은 아니다. 다만 병렬로 이 워크트리를 읽는 다른 reviewer 가 이 뮤테이션을 진짜 결함으로 오인할 위험이 있어 보고한다 — 본 세션은 이 파일을 건드리거나 복원하지 않았다.
  - 제안: (본 리뷰의 조치 사항 아님) 검증을 수행한 주체가 `cp` 로 원복 후 `git status --short` 로 확인할 것.

## 요약

`codebase/backend/package.json` 자체는 의도한 대로 `@nestjs/typeorm` 한 줄만 범프됐고, plan 문서·consistency-check 산출물도 절차상 요구되는 문서화 범위 안에 있어 리팩토링·기능 확장·주석/임포트 변경 같은 전형적 스코프 이탈은 없다. 눈에 띄는 것은 두 가지다 — (1) `pnpm-lock.yaml` diff 의 절대다수(74줄 중 63줄)가 `@nestjs/typeorm` 과 무관한 optional 네이티브 바이너리 패키지들의 `libc:` 메타데이터 제거로 채워져 있는데, pnpm 버전이 `packageManager` 필드와 일치해 툴 버전 drift 로 보긴 어렵고 lockfile 정규화의 부산물로 판단된다. (2) 리뷰 대상 diff 밖에서, 병렬 검증 작업으로 보이는 `workspace.decorator.ts` 뮤테이션이 미원복 상태로 워킹트리에 남아 있다 — 이 PR 스코프는 아니지만 다른 reviewer 오염 위험이 있어 관측 사실만 기록했다. 둘 다 기능적 위험은 낮다.

## 위험도
LOW
