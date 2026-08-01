# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 대상

- `.github/dependabot.yml`
- `codebase/backend/eslint.config.mjs`
- `codebase/backend/package.json`
- `plan/in-progress/eslint-unicorn-peer-restore.md` (신규)
- `pnpm-lock.yaml` (자동 생성)

전체적으로 `eslint-plugin-unicorn` 을 `^72.0.0`(dependabot major bump, unmet peer 유발) 에서
`^56.0.1`(의도된 pin) 로 되돌리고, 그 근거를 두 config 파일(`dependabot.yml`, `eslint.config.mjs`)
의 주석과 plan 문서에 상세히 남긴 변경이다. 실질 코드 로직 변경은 없다(버전 문자열 + 주석 + lockfile).

### 발견사항

- **[WARNING]** 동일한 registry 실측 표(unicorn 버전별 eslint peer floor)가 세 곳에 중복 기재되어 있고, 그중 한 곳은 이미 다른 두 곳과 세분화 수준이 다르다.
  - 위치: `.github/dependabot.yml:86` (표: `56.x / 57 / 62~65 / 66+` — 4구간), `codebase/backend/eslint.config.mjs:20-21` (표: `56.x / 57 / 58~59 / 60~61 / 62~65 / 66+` — 6구간), `plan/in-progress/eslint-unicorn-peer-restore.md:40-47` (동일 6구간 표)
  - 상세: `dependabot.yml` 의 표는 `58~59`, `60~61` 구간을 생략한 축약판이고, `eslint.config.mjs`·plan 문서의 표는 6구간 전체를 담고 있다. 두 표가 사실관계에서 모순되진 않지만(축약이 오류는 아님), 동일 데이터가 세 파일에 흩어져 있고 이미 세분화 수준이 갈린 상태로 머지된다. 이 PR 자체가 "dependabot 이 코드 주석을 못 보고 값만 바꿔 코드-문서가 어긋났다" 는 사고를 고치는 작업인데, 그 해법으로 같은 정보를 3곳에 손으로 복제해 두면 향후 registry 값이 갱신되거나(예: unicorn 73+ 릴리즈로 다른 peer 범위 발견) 한 곳만 갱신되고 나머지가 stale 하게 남을 구조적 위험이 동일하게 존재한다.
  - 제안: 세 곳 모두 상세 표를 반복하지 말고 한 곳(`eslint.config.mjs`, 코드에 가장 가까운 곳)만 SoT 로 두고 나머지(`dependabot.yml`, plan 문서)는 "표는 `codebase/backend/eslint.config.mjs` 참고" 로 축약 참조하는 편이 drift 위험을 줄인다. 이미 병합된 변경이라 즉시 리팩터링이 필수는 아니지만, 다음에 이 pin 을 갱신할 때는 반드시 3곳을 동시에 grep 해 동기화해야 한다는 점을 어딘가(예: `eslint.config.mjs` 주석 말미)에 명시해 두면 좋다.

- **[INFO]** `eslint.config.mjs` 의 새 주석 블록(10줄)이 실제 코드 1줄(`plugins: { unicorn: eslintPluginUnicorn },`)에 비해 상당히 길고, 문단 구분에 빈 `//` 줄을 쓰는 스타일이 같은 파일의 다른 주석 블록(예: `no-floating-promises` 주석 `codebase/backend/eslint.config.mjs:45-47`, `no-unnecessary-type-assertion` 주석 `codebase/backend/eslint.config.mjs:54-59`, `catch-error-name` 주석 `codebase/backend/eslint.config.mjs:79-83`)과 다르다 — 기존 블록들은 빈 `//` 줄 없이 연속 문단으로 작성돼 있다.
  - 위치: `codebase/backend/eslint.config.mjs:17-26`
  - 상세: 이번 pin 이 실제로 사고를 유발했던 이력(#1049)을 감안하면 상세한 배경 기록 자체는 정당한 트레이드오프이므로 크게 문제 삼을 사안은 아니다. 다만 문단 구분 스타일이 파일 내에서 일관되지 않아 스캔성이 약간 떨어진다.
  - 제안: 굳이 지금 고칠 필요는 없으나, 다음에 이 파일의 주석을 손댈 기회가 있으면 기존 스타일(빈 `//` 줄 없는 연속 문단)에 맞추는 것을 고려.

- **[INFO]** `plan/in-progress/eslint-unicorn-peer-restore.md` 는 프로젝트 plan 컨벤션(frontmatter, Overview/조치/체크리스트/미수행 단계/후속 검토 섹션)을 잘 따르고 있고, 근거·의사결정 과정(왜 65.0.1 이 아니라 56.0.1 인지)을 명확히 남겨 가독성이 좋다. 특별한 유지보수성 결함 없음.

### 요약

이번 변경은 실질적으로 의존성 버전 문자열 되돌리기 + 그 근거를 남기는 주석/문서 작업으로, 함수 길이·중첩·순환 복잡도 등 코드 구조 관점의 리스크는 존재하지 않는다. 유일하게 주목할 점은 동일한 "unicorn 버전별 eslint peer floor" 표가 `dependabot.yml`·`eslint.config.mjs`·plan 문서 세 곳에 중복 기재되어 있고 그중 한 곳이 이미 세분화 수준에서 어긋나 있다는 것인데, 이는 이 PR 이 고치려는 "코드-문서 drift" 사고와 같은 성격의 구조적 위험을 문서 레벨에서 재도입한 것이다. 사실관계 오류는 아니므로 차단 사유는 아니지만, SoT 를 한 곳으로 모으고 나머지는 참조만 하는 편이 장기적으로 더 안전하다. 그 외에는 주석 스타일의 사소한 불일치 정도이며 전반적으로 가독성·네이밍·일관성 모두 양호하다.

### 위험도
LOW
