# 보안(Security) 코드 리뷰

## 발견사항

- **[INFO]** `@aws-sdk/core@3.977.4` 가 deprecated 로 표기됨 ("Document number parsing bug in JSON")
  - 위치: `pnpm-lock.yaml:907` (deprecated 주석 블록)
  - 상세: 이번 diff 로 신규 도입된 항목은 아니고(전이 의존성 메타데이터가 lockfile 재생성 시 노출된 것), `@aws-sdk/client-s3` 의 전이 의존성에서 JSON 내 큰/정밀도 손실 숫자 파싱 버그가 있다는 upstream 경고다. 직접적인 인젝션·인가 취약점은 아니지만 S3 관련 응답에서 숫자 필드(예: 사이즈·타임스탬프 등)를 다루는 코드 경로가 있다면 데이터 무결성 문제로 이어질 수 있다.
  - 제안: 이번 PR 범위는 아니므로 차단 사유는 아님. 추후 `@aws-sdk/client-s3` 상향 시 함께 해소 검토.

- **[INFO]** `undici` 6.x/7.x, `fast-uri`, `hono`, `js-yaml`(3.x/4.x), `socket.io-parser`, `postcss`/`nanoid` 버전 상향 — 전부 알려진 취약점 패치 방향 일치
  - 위치: `codebase/backend/package.json:89`, `pnpm-lock.yaml` 다수, `pnpm-workspace.yaml:32-37,46,54-55`, `scripts/check-pnpm-security-config.py:44-46,55,63-64`
  - 상세: `pnpm-workspace.yaml` 신규 override `"socket.io-parser": ~4.2.7` 는 주석에 `GHSA-2m8v-j782-fhvr(high)` 를 명시적으로 인용하며 socket.io@4.8.3 의 peer 계약(`~4.2.4`)을 존중해 `^` 대신 `~` 를 사용 — 부모 semver 범위를 조용히 깨지 않도록 하는 신중한 선택이다. `undici` override 범위도 `<7.28.0`→`<7.29.0` 로 정확히 갱신됐고, `js-yaml` 두 range override(`3.x`/`4.x`) 도 각각 패치 버전(`3.15.1`/`4.3.1`)까지 올라갔다. 모든 override 변경이 `scripts/check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES` 와 1:1로 동기화되어 있어(2-place 가드 통과), 드리프트 위험이 없다.
  - 제안: 없음 — 이 변경 자체가 보안 강화 목적의 정상적인 dependency 패치.

- **[INFO]** `codebase/backend/package.json` 의 직접 의존성 specifier(`undici: ^6.21.3 → ^6.28.0`)가 lockfile 실제 해소 버전(`6.28.0`)과 일치
  - 위치: `codebase/backend/package.json:89`, `pnpm-lock.yaml:227-228`
  - 상세: manifest specifier 와 lockfile resolved version, 그리고 override 값(해당 없음 — backend direct dep 는 override 범위 밖) 간 불일치가 없음을 확인. `check-pnpm-security-config.py` 가 `pnpm-workspace.yaml` 만 대조하므로 이 package.json 변경 자체는 그 가드 범위 밖이지만, lockfile 재생성이 일관되게 반영되어 실제 설치 버전과 어긋나지 않는다.
  - 제안: 없음.

인젝션·하드코딩 시크릿·인증/인가·입력 검증·암호화·에러 처리 관점에서 신규 취약점을 도입하는 코드 변경은 없음(전부 의존성 버전/락파일/보안 설정 가드 파일). `scripts/check-pnpm-security-config.py` 는 파일 시스템의 고정 경로(`pnpm-workspace.yaml`)만 읽고 사용자 입력을 처리하지 않아 인젝션 표면이 없다.

## 요약

이번 변경은 `undici`, `fast-uri`, `hono`, `js-yaml`, `socket.io-parser`, `postcss`/`nanoid` 등 다수 패키지의 알려진 취약점(특히 `socket.io-parser` 의 `GHSA-2m8v-j782-fhvr` high 심각도 advisory)을 override 상향으로 해소하는, 그 자체로 보안 강화 목적의 dependency/lockfile 업데이트다. `pnpm-workspace.yaml` 의 override 변경이 `scripts/check-pnpm-security-config.py` 의 baseline(`EXPECTED_OVERRIDES`)과 정확히 2-place 동기화되어 드리프트 가드가 유지되고 있으며, semver 범위 선택(예: `socket.io-parser` 에 `~` 사용)도 상위 패키지의 peer 계약을 존중하도록 신중하게 문서화되어 있다. 신규 인젝션·인증/인가·시크릿 노출·에러 정보 유출 등 코드 레벨 취약점은 발견되지 않았다.

## 위험도

NONE
