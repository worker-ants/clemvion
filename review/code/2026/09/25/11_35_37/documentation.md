# 문서화(Documentation) 리뷰 — lockfile-libc-oscillation

## 발견사항

- **[INFO]** pnpm 버전 동기화가 주석(사람 규율)에만 의존하고 자동 가드가 없음
  - 위치: `codebase/frontend/Dockerfile.playwright-e2e:20` (새로 추가된 주석 `# 이 버전은 root package.json 의 `packageManager` 사본이다 — 핀을 올릴 때 함께 올린다.`)
  - 상세: 같은 파일 상단(1~16행)의 `@playwright/test` 버전 정합은 `scripts/check-e2e-playwright-config.py` 가 CI 에서 강제하는데(주석에도 그렇게 명시돼 있음), 이번에 추가된 pnpm 버전 동기화 주석은 대응하는 자동 가드가 없다. `codebase/backend/Dockerfile:6` 도 같은 패턴(`# pnpm 버전은 root package.json 의 packageManager 필드를 corepack 이 따른다`)이지만 그쪽은 `corepack enable` 만 쓰고 버전을 하드코딩하지 않아 애초에 drift 가 구조적으로 불가능하다. 반면 `Dockerfile.playwright-e2e` 는 `corepack enable || npm i -g pnpm@X` fallback 이라 버전 문자열을 손으로 복제해야 하고, 이번 PR 이 고치는 결함(사람이 한쪽만 올리고 잊는 진동)과 정확히 같은 형태의 drift 가 이 두 파일 사이에서도 일어날 수 있다. 이번 CHANGELOG/plan 이 "corepack(Dockerfile 셋)이 모두 packageManager 를 읽는다" 고 서술하지만, 실제로 `Dockerfile.playwright-e2e` 의 fallback 경로는 `packageManager` 를 읽는 게 아니라 손으로 미러링한 상수라는 점이 문서 표현과 미묘하게 어긋난다(corepack 이 성공하는 정상 경로에서는 맞는 말이지만, fallback 문자열 자체는 아니다).
  - 제안: 즉시 조치가 필요한 결함은 아니다(주석이 정확하고, 이번 PR 은 두 값을 실제로 함께 올렸다). 다만 재발 방지 관점에서 `scripts/check-e2e-playwright-config.py` 류 가드에 "Dockerfile.playwright-e2e 의 fallback pnpm 버전 == package.json 의 packageManager 버전" 단언을 추가하는 것을 백로그로 남길 만하다 — 이번 PR 이 고친 결함(lockfile `libc:` 진동)과 같은 "사람이 한쪽만 갱신" 계열이기 때문. 이 PR 의 스코프를 넓히라는 뜻은 아니다.

## 요약

CHANGELOG.md 신규 항목은 근본 원인(버전이 아니라 메타데이터 모드), 재현 방법, 경계값 탐색, 수정 후 검증(사람·dependabot 양 경로 0줄 차이)까지 기존 항목들과 동일한 수준의 밀도로 기록되어 있고, `plan/in-progress/lockfile-libc-pin.md` 의 §A~§C 서술과 수치가 정확히 대응한다. `Dockerfile.playwright-e2e` 에 추가된 한 줄 주석은 두 파일 간 버전 동기화 의무를 명시해 향후 동일한 진동 재발을 막으려는 의도가 분명하며, `package.json` 변경은 단순 값 갱신이라 별도 문서가 필요 없다. `PROJECT.md`/`README.md` 에는 이번 패치 버전을 하드코딩한 곳이 없어(패키지 매니저 버전은 `packageManager` 필드를 가리키는 방식으로만 서술) 추가 갱신이 불필요함을 확인했고, `review/consistency/2026/09/25/11_14_19/` 의 INFO 4건은 이미 plan 본문(§C 체크리스트 세 갈래 분리·원문 취소선 보존 지시)에 반영되어 있다. 유일하게 남는 관찰은 pnpm 버전 동기화가 여전히 사람이 읽는 주석에만 의존하고 자동 가드가 없다는 점인데, 이는 이번 PR 의 결함과 같은 계열이라 백로그 가치는 있지만 이번 diff 를 막을 사유는 아니다.

## 위험도
NONE
