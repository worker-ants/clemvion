# 아키텍처(Architecture) 리뷰

## 리뷰 대상 요약

이번 변경은 코드 구조 변경이 아니라 **의존성 버전 상향 + 그에 수반한 보안 설정 거버넌스 파일 동기화**다.

- `codebase/backend/package.json` — `undici` `^6.21.3` → `^6.28.0`
- `pnpm-lock.yaml` — 위 변경 및 여러 전이 의존성(`fast-uri`, `hono`, `socket.io-parser`, `js-yaml`, `nanoid`, `postcss`) 재해소 반영
- `pnpm-workspace.yaml` — `overrides` 핀 값 상향(`fast-uri`, `hono`, `undici` 범위, `js-yaml` 범위) + `socket.io-parser: ~4.2.7` 신규 오버라이드 추가(주석으로 `~` vs `^` 선택 근거 명시, GHSA-2m8v-j782-fhvr 참조)
- `scripts/check-pnpm-security-config.py` — 위 오버라이드 변경을 `EXPECTED_OVERRIDES` baseline 에 동반 반영

애플리케이션 레이어(프레젠테이션/비즈니스/데이터), 모듈 경계, 클래스/함수 설계에는 어떤 변경도 없다. 따라서 SOLID·결합도/응집도·디자인 패턴·순환 의존성·모듈 경계 등 대부분의 점검 관점은 이 diff 범위에서 해당 사항이 없다(N/A). 아래는 이 diff 에서 실제로 유의미한 아키텍처적 관찰(설정 거버넌스 구조)에 한정한다.

## 발견사항

- **[INFO]** 보안 오버라이드 baseline 이 `pnpm-workspace.yaml` 과 `scripts/check-pnpm-security-config.py` 두 곳에 이중 소스로 존재한다(단일 진실 원천 원칙과 표면적으로 배치).
  - 위치: `scripts/check-pnpm-security-config.py` (`EXPECTED_OVERRIDES` 딕셔너리, 함수 `main`) / `pnpm-workspace.yaml` (`overrides` 블록)
  - 상세: 일반적으로 설정 값의 이중 유지는 drift 위험이 있는 안티패턴이지만, 이 경우는 `check-pnpm-security-config.py` 상단 docstring 이 명시하듯 **의도적 설계**다 — pnpm 10.23 이 `package.json#pnpm` 필드를 더 이상 읽지 않게 되면서, `--frozen-lockfile` CI 가 `pnpm-workspace.yaml` 의 오버라이드 삭제/약화조차 lockfile 정합성만 맞으면 통과시켜 버리는 문제(과거 `#1038` 사고)를 막기 위해 **독립된 baseline 스냅샷과의 대조**로 drift 를 탐지하는 거버넌스 가드다. 이번 diff 는 이 패턴이 요구하는 "2-place 동시 편집" 을 실제로 정확히 수행했다(`pnpm-workspace.yaml` 의 `fast-uri`/`hono`/`undici`/`js-yaml`/`socket.io-parser` 값과 `EXPECTED_OVERRIDES` 값이 diff 상 1:1 로 일치).
  - 제안: 현재 구조는 유지 부담(매 오버라이드 변경마다 2곳 편집)이 있으나 이는 가드의 존재 이유 자체이므로 구조 변경을 제안하지 않는다. 다만 향후 오버라이드 항목 수가 크게 늘어난다면 `pnpm-workspace.yaml` 을 파싱해 baseline 파일(JSON/YAML)과 대조하는 방식으로 Python 코드에서 데이터를 분리하는 것도 고려할 수 있다(현재는 항목 수가 적어 필요성 낮음).

- **[INFO]** `pnpm-workspace.yaml` 의 `socket.io-parser: ~4.2.7` 오버라이드는 다른 대부분의 항목이 `^`(caret) 를 쓰는 것과 달리 `~`(tilde) 범위 연산자를 사용한다.
  - 위치: `pnpm-workspace.yaml:37` (`"socket.io-parser": ~4.2.7`)
  - 상세: 이는 실수가 아니라 동일 줄 위 주석에서 `socket.io@4.8.3` 의 peer 계약(`~4.2.4`)을 넘어서는 강제 해소(override 가 상위 패키지의 semver 계약을 깨는 것)를 피하기 위한 의도적 선택으로 문서화되어 있다. 오버라이드가 하위 패키지의 명시 버전 계약과 충돌하지 않도록 범위 연산자를 세밀하게 고른 것은 좋은 설계 판단이다.
  - 제안: 없음(현행 유지 권장).

## 요약

이번 변경은 순수 의존성 버전 상향과 그에 수반하는 보안 설정 baseline 동기화로, 애플리케이션 코드의 레이어·모듈·클래스 구조에는 영향이 없다. SOLID, 결합도/응집도, 디자인 패턴, 순환 의존성, 추상화 수준, 모듈 경계, 확장성 등 코드 아키텍처 관점의 점검 항목은 모두 해당 사항 없음(N/A)이다. 유일하게 아키텍처적으로 의미 있는 구조는 `pnpm-workspace.yaml` overrides 와 `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES` 사이의 의도적 이중 baseline(drift-detection 가드)이며, 이번 diff 는 그 2-place 갱신 규약을 정확히 준수했다. 구조적 결함이나 안티패턴은 발견되지 않았다.

## 위험도

NONE
