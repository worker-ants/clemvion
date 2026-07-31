### 발견사항

- **[WARNING]** pnpm-lock.yaml 의 부수 drift(blast radius)가 plan 문서에 설명되지 않음 — 특히 `codebase/frontend` 의 `postcss` specifier
  - 위치: `pnpm-lock.yaml:506`(`specifier: ^8.5.18`, 이전 `^8.5.14`) / `plan/in-progress/audit-residual-triage.md` §2("머지 순서 주의")
  - 상세: 이 커밋은 `codebase/frontend/package.json` 을 건드리지 않았고, 그 파일은 merge-base(`a41a0456e`) 시점부터 이미 `"postcss": "^8.5.18"` 이었다. 그런데 그 시점 `pnpm-lock.yaml` 의 `codebase/frontend` importer 섹션은 `specifier: ^8.5.14` 로 남아 manifest 와 어긋나 있었다(직전 PR #1034 는 "lockfile 은 이미 ^8.5.18 이라 무변경" 이라 적었으나 실측과 다르다 — `git show a41a0456e:pnpm-lock.yaml` 로 확인). 이번 override 작업에 필요했던 `pnpm install` 이 이 잔존 drift 를 부수적으로 흡수해 `^8.5.18` 로 맞췄다(값 자체는 8.5.25 로 이전과 동일하게 해소되고 frozen-lockfile 도 통과해 기능적 위험은 낮다). 문제는 plan §2 가 별개 필드인 오버라이드 `next>postcss`(의도적으로 `^8.5.14` 유지, `#1036` 으로 이관)를 다루면서 "그 줄이 아직 `^8.5.14` 다" 라고만 적어, 같은 diff 안에 실제로 값이 바뀐 또 다른 "postcss" 관련 줄이 있다는 사실을 언급하지 않는다 — 두 필드(override vs frontend 직접 devDependency)가 이름이 겹쳐 리뷰어·후속 작업자가 혼동하기 쉽다. 바로 이 클래스(설명되지 않은 lockfile 부수 diff)는 같은 날 병합된 직전 PR(`a41a0456e`, review `2026/07/31/13_08_31`)에서 이미 WARNING 으로 지적되어 plan 에 "blast radius 표" 를 추가하는 방식으로 조치된 전례가 있다 — 이번 plan 은 그 관례를 따르지 않았다. (동일 원인으로 lockfile 전역에 `jest-cli`/`jest-config`/`jest` 스냅샷의 peer-suffix 재배열, `@opentelemetry/core@2.10.0` 신규 병존 엔트리, `eslint-import-resolver-typescript` peer 조합 변경 등도 함께 발생했으나 이들은 순수 "version" 재계산 부산물이라 상대적으로 덜 우려된다.)
  - 제안: plan `§1.4` 또는 `§2` 에 한 문단 추가 — "`codebase/frontend/package.json` 은 미변경. 기존 lockfile-manifest drift(specifier `^8.5.14`→`^8.5.18`) 를 이번 `pnpm install` 이 부수적으로 해소함. `next>postcss` 오버라이드(§2, 의도적 보류)와는 별개 필드." 를 명시해 향후 diff 리뷰 시 혼동을 방지한다.

- **[WARNING]** `check-pnpm-security-config.py` 의 신규 CVE 인라인 주석이 다른 CVE 의 설명을 그대로 옮겨 붙여 내용이 틀림
  - 위치: `scripts/check-pnpm-security-config.py:77`
  - 상세: 신규 추가된 `"CVE-2026-14257"` 줄의 인라인 주석이 `# js-yaml <3.15.0 DoS, frontend>gray-matter 경로, moderate.` 인데, 이는 바로 위 `"CVE-2026-53550"`(js-yaml 건)의 설명이다. `CVE-2026-14257` 은 실제로는 brace-expansion 무한 확장 DoS/OOM, **high**(CVSS 7.5) 이며, `pnpm-workspace.yaml:77-88` 에 신설된 상세 주석(및 plan 본문 §1.3)과도 불일치한다. 편집 중 기존 주석을 새 줄로 옮기면서 `CVE-2026-53550` 자체는 주석 없이 남고, `CVE-2026-14257` 에 엉뚱한 CVE 의 설명이 붙은 것으로 보인다. 스크립트 동작에는 영향이 없으나(Python `set` 은 문자열 값만 비교, 주석은 무시), plan Rationale 이 명시한 "수용 판단의 근거를 주석으로 남겨 다음 사람이 재조사하지 않게 했다" 는 목적을 정작 이 파일에서는 이루지 못한다.
  - 제안: 76~77번째 줄을 각 CVE 에 맞는 요약으로 정정 — 예) `"CVE-2026-53550",  # js-yaml <3.15.0 DoS, frontend>gray-matter 경로, moderate.` / `"CVE-2026-14257",  # brace-expansion 무한 확장 DoS/OOM, dev-only(eslintrc/jest) 경로, high.`

### 요약

이번 변경은 `pnpm audit` 잔여 취약점 정리를 위한 순수 의존성/설정 변경으로, 애플리케이션 코드나 무관한 파일을 전혀 건드리지 않았고 손댄 4개 파일(plan 문서·`pnpm-lock.yaml`·`pnpm-workspace.yaml`·`check-pnpm-security-config.py`) 모두 명시된 의도(기존 오버라이드 하한 상향 4건·신규 오버라이드 9건·수용 1건·baseline 3-place 동기화)와 정확히 대응해 전체적으로 스코프가 잘 통제되어 있다. 다만 (1) `pnpm install` 재계산의 부수효과로 `codebase/frontend` 의 `postcss` 직접 의존성 specifier 드리프트가 조용히 함께 정정됐는데 이는 plan 에 설명이 없고, 같은 문서가 논의하는 (의도적으로 보류된) `next>postcss` 오버라이드와 이름이 겹쳐 혼동 소지가 있으며 이 저장소의 직전 동일 사례에서 같은 클래스가 WARNING 으로 지적되어 문서화로 조치된 전례가 있다. (2) `check-pnpm-security-config.py` 에 신규 추가한 CVE 인라인 주석이 편집 실수로 다른 CVE 의 설명을 그대로 옮겨 붙여 내용이 틀렸다. 둘 다 기능적 위험은 낮지만(값 변경 없음/CI 로직 무영향, frozen-lockfile 통과 실측됨) 문서·주석의 정확성을 해쳐 향후 재조사 비용을 유발할 수 있어 조치를 권한다.

### 위험도
LOW
