# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** 워크스페이스 전역 override 신규 도입 — `socket.io-parser`
  - 위치: `pnpm-workspace.yaml:34-37`(신규 override + 근거 주석), `scripts/check-pnpm-security-config.py:46`(EXPECTED_OVERRIDES 동기 반영), `pnpm-lock.yaml:17`(overrides 블록)
  - 상세: 기존에 없던 `socket.io-parser: ~4.2.7` pnpm override 가 새로 추가되었다. pnpm override 는 workspace 전역(backend 의 `socket.io`, frontend 의 `socket.io-client` 등 socket.io-parser 를 transitive 로 끌어오는 모든 위치)에 적용되는 강제 버전 고정이라, 이번 변경으로 실제 소켓 와이어 프로토콜 파싱 동작이 전체 저장소에서 한 번에 바뀐다. 다만 diff 에 동봉된 주석이 `^` 대신 `~` 를 쓴 이유(부모 `socket.io@4.8.3` 의 `~4.2.4` 계약을 깨지 않기 위함, GHSA-2m8v-j782-fhvr 패치 근거)를 명시하고 있고, guard 스크립트(`check-pnpm-security-config.py`)의 `EXPECTED_OVERRIDES` 에도 동일 항목이 2-place 규약대로 함께 반영되어 있어 drift 위험은 낮다.
  - 제안: 별도 조치 불요 — 의도된 보안 패치이며 2-place 동기화가 이미 지켜졌다. socket.io 관련 e2e(웹소켓 연결·재연결)가 CI 스위트에 포함돼 있는지만 확인 권장.

- **[INFO]** `undici` 6.x/7.x 동시 버전 상향 — 네트워크 클라이언트 동작 변화 가능성
  - 위치: `codebase/backend/package.json:89`(direct dep `^6.21.3`→`^6.28.0`), `pnpm-lock.yaml:227-228`(backend importer specifier/version), `pnpm-workspace.yaml:46`(7.x transitive override `<7.28.0`→`<7.29.0`)
  - 상세: `undici` 는 Node 의 fetch/HTTP 클라이언트 저수준 구현으로, backend 가 direct dependency 로 사용하고(6.x) jsdom 등 devDependency 경로에서 7.x 가 transitive 로 쓰인다. 이번 변경은 두 트랙 모두 patch/minor 상향이라 API 파괴적 변경 가능성은 낮지만, HTTP 클라이언트 라이브러리 특성상 커넥션 재사용·타임아웃·헤더 처리 등 미세한 런타임 동작 차이가 발생할 수 있다. 코드 시그니처·호출부 변경은 없다.
  - 제안: 외부 API 호출(예: `@anthropic-ai/sdk`, `openai`, webhook 발신 등 undici 를 경유하는 경로)에 대한 기존 통합/e2e 테스트가 이번 lockfile 갱신 이후에도 통과하는지 확인 권장. 별도 코드 수정은 불필요.

- **[INFO]** 삭제된 lockfile 엔트리(다운그레이드 아님, pruning) — `js-yaml@3.15.0`/`4.3.0`, `fast-uri@3.1.4`, `hono@4.12.32`, `socket.io-parser@4.2.6`, `undici@6.27.0`/`7.28.0`
  - 위치: `pnpm-lock.yaml` snapshots/packages 섹션 (예: 게이트 `7160-7169`, `6247-6251`, `8597-8603`, `9187-9192`, `9827-9836`)
  - 상세: override 상향에 따라 이전 버전 엔트리가 lockfile 에서 제거된 정상적인 pruning 이다. `package.json`/`pnpm-workspace.yaml`/`check-pnpm-security-config.py` 3개 소스와 lockfile 이 서로 모순 없이 일치하며, `pnpm install --frozen-lockfile` 재현성에 영향을 줄 drift 는 관측되지 않았다.
  - 제안: 조치 불요.

## 요약
이번 변경은 순수 의존성 버전 상향(보안 패치) + 그 baseline 을 검증하는 guard 스크립트(`scripts/check-pnpm-security-config.py`)의 동반 동기화로, 함수 시그니처·전역 변수·파일시스템 쓰기·환경변수 읽기/쓰기·이벤트/콜백 등 코드 레벨 부작용은 전혀 없다. 유일하게 주목할 부작용은 `socket.io-parser` 에 대한 신규 workspace 전역 override 도입인데, 이는 diff 에 동봉된 근거 주석과 `EXPECTED_OVERRIDES` 2-place 동기화로 이미 문서화·검증되어 있어 실질 위험은 낮다. `undici`/`hono`/`fast-uri`/`js-yaml` 버전 상향은 하위 라이브러리의 런타임 동작을 미세하게 바꿀 수 있으나 이는 모든 의존성 버전 갱신에 내재한 통상적 리스크이며, 이번 diff 자체가 그 리스크를 신설하거나 악화시키지는 않는다.

## 위험도
LOW
