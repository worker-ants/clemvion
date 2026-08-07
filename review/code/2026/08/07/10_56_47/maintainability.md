# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `pnpm-workspace.yaml` 의 `socket.io-parser` override 키가 따옴표로 감싸져 있으나 다른 단순 식별자 키(`fast-uri`, `hono`, `uuid`, `ws` 등)는 따옴표 없이 기재된다.
  - 위치: `pnpm-workspace.yaml:37` (전체 파일 컨텍스트 게이트 기준)
  - 상세: `socket.io-parser` 는 YAML 상 특수문자(`@`, `>`, `<`, 공백)를 포함하지 않아 따옴표가 필수는 아니다. 반면 같은 파일의 `@grpc/grpc-js`, `js-yaml@>=4.0.0 <4.3.1` 등은 YAML 파싱상 실제로 따옴표가 필요해서 감싼 것이다. 이번 diff 가 새 항목에 불필요한 따옴표를 도입해, "따옴표=특수문자 필요" 라는 기존의 암묵적 패턴과 약간 어긋난다.
  - 제안: 사소한 스타일 문제이며 파싱·동작에는 영향이 없다. 굳이 통일하려면 따옴표를 제거해도 되지만, 우선순위 높은 수정 대상은 아니다.

- **[INFO]** `pnpm-workspace.yaml` 의 신규 인라인 주석(`socket.io-parser` 를 `~` 로 고정한 이유)이 좋은 관행이다.
  - 위치: `pnpm-workspace.yaml:34-36`
  - 상세: `^` 대신 `~` 를 쓴 이유(부모 패키지가 요구하는 semver 범위 계약을 override 가 깨지 않도록)와 근거 CVE(GHSA-2m8v-j782-fhvr)를 명시해, 향후 이 override 를 다시 만질 사람이 "왜 다른 항목과 다르게 `~` 인가"를 재추론할 필요가 없다. 이 파일의 기존 관행(각 override 블록 상단에 배경 설명 주석)과 일관된다.
  - 제안: 없음 — 참고용 긍정 발견.

- **[INFO]** `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES` 딕셔너리와 `pnpm-workspace.yaml` 의 `overrides` 는 값까지 완전히 중복된 데이터 소스다(2곳 동기 편집 필요).
  - 위치: `scripts/check-pnpm-security-config.py:37-68` (`EXPECTED_OVERRIDES`)
  - 상세: 이번 diff 는 기존에 이미 확립된 "2-place 편집 = 리뷰 게이트" 설계(파일 docstring §20-22 에 명시)를 그대로 따랐을 뿐이며, 새로 추가된 데이터 중복이 아니다. 실제로 diff 3개 파일(`pnpm-workspace.yaml`, `check-pnpm-security-config.py`, 그리고 lockfile)이 모두 함께 갱신되어 있어 설계 의도대로 동기화가 지켜졌다.
  - 제안: 없음 — 설계된 중복(가드 목적)이므로 통합(DRY) 대상이 아니다. 후속 변경자를 위해 계속 "함께 고친다"는 docstring 안내를 유지할 것.

## 요약

이번 변경은 실질적으로 의존성 버전 상향(package.json, pnpm-lock.yaml)과 그에 따른 보안 override baseline 동기화(pnpm-workspace.yaml, check-pnpm-security-config.py)로, 새로운 비즈니스 로직이나 제어 흐름이 도입되지 않았다. `check-pnpm-security-config.py` 는 함수 분리(`_check_set`)·명확한 상수 네이밍(`EXPECTED_*`)·낮은 중첩·풍부한 docstring 을 유지한 채 데이터 항목만 늘었고, `pnpm-workspace.yaml` 은 신규 override 도입 시 근거를 주석으로 남기는 기존 관행을 그대로 따랐다. 발견된 사항은 전부 INFO 수준의 사소한 스타일 관찰이며 가독성·복잡도·중복도 측면에서 문제 될 것이 없다.

## 위험도

NONE
