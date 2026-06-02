# Testing Review

## 발견사항

### [INFO] 소스 코드 변경 없음 — 기존 테스트 스위트가 회귀 커버리지 제공
- 위치: 전체 변경 파일 (package.json / package-lock.json 5개)
- 상세: 이번 PR 은 npm audit 취약점 수정을 위한 순수 의존성 버전 업그레이드다. 실제 애플리케이션 소스 코드(.ts, .js)에는 아무 변경이 없다. 따라서 새로 작성해야 할 단위·통합 테스트는 없으며, 기존 테스트 스위트가 업그레이드 후 회귀를 탐지하는 역할을 담당한다.
- 제안: 기존 테스트(jest, vitest)를 업그레이드된 의존성 환경에서 전량 재실행해 회귀가 없음을 확인한다. CI 파이프라인이 이미 이 역할을 수행하고 있다면 별도 조치 불필요.

### [WARNING] vitest 메이저 버전 업그레이드 (^3 → ^4.1.8) — 테스트 API 하위 호환성 점검 필요
- 위치: `codebase/channel-web-chat/package-lock.json` — @vitest/expect, @vitest/spy, @vitest/utils, @vitest/mocker, @vitest/snapshot, @vitest/runner 전체 3.x → 4.x 교체
- 상세: vitest 4.x 는 메이저 버전 변경으로 breaking change 가 동반될 수 있다. 확인된 변경 사항은 다음과 같다.
  - @vitest/spy 4.x 에서 tinyspy 의존성이 제거됨 (내부 구현 변경).
  - @vitest/expect 4.x 에서 chai 의존 버전이 ^5.x → ^6.x 로 상향됨.
  - @vitest/runner 4.x 에서 strip-literal 의존성이 제거됨.
  - @vitest/mocker peer dependency 에서 vite ^5.x 지원이 제거되고 ^6 || ^7 || ^8 만 허용됨.
  - @standard-schema/spec 신규 의존성 추가.
  - tinyrainbow 가 ^2.x → ^3.x 로 상향됨.
  
  이 중 chai major 버전 업그레이드와 vite peer 범위 변경은 channel-web-chat 의 기존 테스트 코드에서 사용하는 assertion API(expect, should 등)나 mock factory 동작에 영향을 줄 수 있다. 특히 chai 6.x 는 chai 5.x 와 일부 assertion 동작이 다를 수 있다.
- 제안: `codebase/channel-web-chat` 에서 `vitest run` 을 실행하고 모든 기존 테스트가 통과하는지 확인한다. spy/mock 관련 테스트를 우선적으로 점검한다.

### [INFO] ws 8.18.x → 8.20.1 업그레이드 — WebSocket 통합 테스트 영향 없음 예상
- 위치: `codebase/backend/package-lock.json` (engine.io 6.6.8, socket.io-adapter 2.5.7), `codebase/frontend/package-lock.json` (engine.io-client 6.6.5)
- 상세: ws 패치/마이너 업그레이드로 CVE 수정이 주목적이다. 공개 API 변경이 없으므로 기존 WebSocket/Socket.IO 관련 테스트가 그대로 통과할 것으로 예상된다.
- 제안: Socket.IO 실시간 통신을 다루는 e2e 또는 통합 테스트가 있다면 해당 케이스를 한 번 실행해 확인한다.

### [INFO] uuid 버전 충돌 override 추가 (uuid: ^13.0.2) — uuid 사용 테스트 점검 필요
- 위치: `codebase/backend/package.json` overrides 섹션 (typeorm/node_modules/uuid 11.1.1 및 preview-email/node_modules/uuid 9.0.1 제거)
- 상세: typeorm 과 preview-email 하위에 있던 uuid 별도 설치본이 제거되고 최상위 uuid ^13.0.2 가 강제 적용된다. uuid 13.x 는 uuid 9.x/11.x 와 API 가 호환되지 않을 수 있다(예: ESM 전용 변경, 함수 시그니처 차이). 다만 이 패키지들은 optional/peer 의존성이므로 실제 런타임 영향은 제한적일 수 있다.
- 제안: typeorm 엔티티 ID 생성(uuid 기반 @PrimaryGeneratedColumn('uuid') 등)을 검증하는 단위·통합 테스트가 있다면 실행하여 uuid 생성 동작이 유지되는지 확인한다.

### [INFO] liquidjs ^10.25.7 → ^10.27.0 업그레이드 — 이메일 템플릿 테스트 영향 가능
- 위치: `codebase/backend/package-lock.json`, `codebase/backend/package.json` overrides
- 상세: liquidjs 는 optional 의존성으로 이메일 템플릿 렌더링에 사용된다. 마이너 업그레이드이므로 하위 호환성은 유지되지만, 템플릿 렌더링 결과가 미세하게 다를 경우 스냅샷 테스트가 실패할 수 있다.
- 제안: 이메일 템플릿 렌더링과 관련된 테스트(특히 스냅샷 테스트)가 있다면 실행 후 결과를 검토한다.

### [INFO] brace-expansion 다수 인스턴스 업그레이드 (1.x/2.x/5.x 각각 패치 버전 상향)
- 위치: `codebase/backend/package-lock.json` — @jest/reporters, jest-config, jest-runtime, mjml-cli, typeorm, glob 등 하위 의존성
- 상세: 순수 패치 업그레이드로 동작 변경 없음. jest 관련 패키지들의 brace-expansion 버전이 함께 올라간 것은 jest 30.x 내부 의존 트리 정합에 의한 것이다.
- 제안: 별도 조치 불필요. jest 실행 시 자동 검증된다.

---

## 요약

이번 변경은 npm audit 취약점 해소를 위한 순수 의존성 버전 업그레이드(package.json/package-lock.json 수정)이며, 애플리케이션 소스 코드에는 변경이 없다. 따라서 새 테스트를 추가해야 할 근거는 없다. 주요 테스트 리스크는 channel-web-chat 에서의 vitest 3.x → 4.x 메이저 업그레이드로, chai 6.x 로의 전환과 spy 내부 구현 변경이 기존 테스트를 깨뜨릴 가능성이 있다. 이 외에도 uuid override 강제 적용과 liquidjs 마이너 업그레이드가 특정 통합 테스트에 영향을 미칠 수 있으나, 패치·마이너 수준이므로 위험도는 낮다. 기존 CI 테스트 스위트(jest + vitest) 전량 실행으로 회귀 여부를 확인하는 것으로 충분하다.

## 위험도

LOW
