# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — postcss 보안 bump 복원(`^8.5.14`→`^8.5.18`)이 부분적입니다. `@tailwindcss/postcss@4.3.1`이 caret 없이 고정한 `postcss@8.5.15`가 여전히 GHSA-r28c-9q8g-f849(HIGH, CVSS 7.5)에 취약해 CI `pnpm audit` 게이트를 재유발할 가능성이 높습니다. (forced reviewer `dependency`가 이 발견을 보고했으며 결과는 정상 확보·반영되었습니다 — 아래 "라우터 결정" 참고.)

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency/Security | postcss 보안 bump 복원(`^8.5.14`→`^8.5.18`)이 부분적 — `@tailwindcss/postcss@4.3.1`이 caret 없이 `postcss@8.5.15`를 고정해 동일 CVE(GHSA-r28c-9q8g-f849, HIGH/CVSS 7.5, PostCSS sourceMappingURL 경로순회 → 임의 `.map` 파일 노출)에 여전히 취약함. OSV.dev 조회, npm registry 조회, 로컬 `pnpm audit --audit-level=moderate` 실행 3가지 독립 방법으로 재현 확인. `pnpm-workspace.yaml`의 `auditConfig.ignoreCves`에도 미등재 상태이며, `deps-security-checks.yml`이 `codebase/**/package.json` 변경 시 트리거되므로 이 PR이 정확히 그 audit 게이트를 재유발함. diff 자체가 만든 신규 회귀는 아니나(`@tailwindcss/postcss` 버전은 diff 전후 불변, origin/main에도 동일 존재), 이 diff가 명시적으로 표방하는 "postcss 보안 bump 복원" 목표가 부분 달성에 그침 | `codebase/frontend/package.json:34`(`@tailwindcss/postcss`, 미변경 인접 의존성) — diff 실제 변경 라인은 `:52`(`postcss`) | (1) `@tailwindcss/postcss`를 caret 복원된 `^4.3.2` 이상으로 상향 후 `pnpm install`로 lockfile 갱신하여 `postcss@8.5.15` 스냅샷 제거, 또는 (2) `pnpm-workspace.yaml` overrides에 `@tailwindcss/postcss>postcss: ^8.5.18`(또는 전역 `postcss: ^8.5.18`) 추가 + `scripts/check-pnpm-security-config.py`의 `EXPECTED_OVERRIDES` **동시** 갱신(2-place, 미동기화 시 config-guard 오탐), (3) 조치 후 `pnpm audit --audit-level=moderate` 재실행해 GHSA-r28c-9q8g-f849 미보고 확인, (4) 부수: `next>postcss` 오버라이드(`pnpm-workspace.yaml` + `check-pnpm-security-config.py`)도 `^8.5.18`로 동반 상향해 표현 하한 정합, (5) 범위 밖으로 판단되면 최소한 `ignoreCves`에 사유·영향경로("빌드타임 전용, 신뢰 CSS 입력만 처리")·해소조건과 함께 명시 등재 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | 현재 워크트리의 선언된 작업 범위(`plan/in-progress/workflow-duplicate-nodes-edges.md` — 워크플로우 복제 빈 워크플로우 결함 수정)와 무관한 postcss 버전 bump 커밋이 이 브랜치에 포함됨. 다만 (a) 별도 커밋으로 격리, (b) 커밋 메시지에 스코프 이탈 사유·경위·필요성 명시, (c) 사용자 확인 완료 기재, (d) `pnpm-lock.yaml` 대조로 기존 드리프트 해소 목적임을 검증 — 4가지 완화 요인을 모두 충족한 "고지된 예외"로 판단됨 | `codebase/frontend/package.json:52` (커밋 `66e574209`) | 코드 조치 불요. `plan/in-progress/workflow-duplicate-nodes-edges.md`에 "main CI 차단 해소를 위해 postcss lockfile 드리프트 수정 1커밋 포함" 한 줄 각주를 추가하면 추적성 향상(현재 plan 문서에는 이 커밋 언급 없음 — 커밋 메시지에만 근거 존재) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency | 이번 diff(`^8.5.14`→`^8.5.18`) 자체는 caret 범위를 유지한 하한 상향으로 버전 핀 정책 위반 없음. 신규 의존성 추가·라이선스 리스크·peer semver 비호환(`postcss-unique-selectors@7.0.7`의 `peerDependencies: postcss ^8.5.13` 등) 없음 | `codebase/frontend/package.json:52` | 없음(정상) |
| 2 | Scope | diff 내부에 포맷팅·주석·임포트 변경·불필요한 리팩토링·기능 확장 등 부수 잡음 전혀 없음. `//pin` 비-caret 핀 정책 대상(line 5) 아닌 `postcss`는 그대로 caret 유지 — 정책과 일치 | `codebase/frontend/package.json` (전체) | 없음(정상) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| dependency | CRITICAL | postcss 보안 bump 부분적 복원 — `@tailwindcss/postcss` 경유 동일 CVE(GHSA-r28c-9q8g-f849) 취약 인스턴스 잔존, CI `pnpm audit` 게이트 재유발 가능성 |
| scope | LOW | 작업 범위 밖 postcss 커밋이나 4가지 완화 요인을 충족한 고지된 예외, diff 자체는 깔끔 |

## 발견 없는 에이전트

(없음 — 실행된 2개 에이전트 모두 발견사항을 보고함)

## 권장 조치사항
1. (Critical, 병합 전 필수) `@tailwindcss/postcss`를 caret 복원 버전(`^4.3.2` 이상)으로 상향하거나, `pnpm-workspace.yaml` overrides + `scripts/check-pnpm-security-config.py` 2-place 동기화로 오버라이드를 추가해 `postcss@8.5.15` 잔존 취약 인스턴스(GHSA-r28c-9q8g-f849)를 해소하고, `pnpm audit --audit-level=moderate` 재실행으로 미보고 확인. 즉시 조치가 어려우면 최소한 `pnpm-workspace.yaml`의 `ignoreCves`에 사유·영향경로·해소조건과 함께 명시 등재.
2. (Warning, 선택) `plan/in-progress/workflow-duplicate-nodes-edges.md`에 postcss 커밋 포함 사유 한 줄 각주 추가 — 추적성 향상 목적, 코드 변경 아님.

## 라우터 결정

- 라우터 미사용 (`routing_status=skipped`) — 전체 reviewer 실행: `dependency`, `scope` (2명). 제외된 reviewer 없음.
- 강제 포함(router_safety): `dependency` — 강제 목록 전원 결과 확보됨(전문 인라인 확보, 위 CRITICAL 발견에 정상 반영됨. "clean" 오판 아님).