# 테스트(Testing) 리뷰

## 대상 요약

이번 diff 는 순수 의존성/설정 변경이다 — 애플리케이션 로직 변경 없음:
- `codebase/backend/package.json`: `undici` `^6.21.3` → `^6.28.0` (직접 의존성 버전 상향)
- `pnpm-lock.yaml`: lockfile 재계산 (undici/hono/fast-uri/js-yaml/socket.io-parser/nanoid/postcss 등)
- `pnpm-workspace.yaml`: `overrides` 보안 핀 상향 + `socket.io-parser: ~4.2.7` 신규 override 추가(근거 주석 포함)
- `scripts/check-pnpm-security-config.py`: `EXPECTED_OVERRIDES` 딕셔너리 값만 갱신 (로직 변경 없음)

## 발견사항

- **[INFO]** `check-pnpm-security-config.py` 자체의 비교 로직(`_check_set`, `main()` 의 override 값-불일치 분기)에는 전용 unit test 가 없다 — sibling 가드인 `scripts/check-override-floors.py` 는 `.claude/tests/test_override_floors.py`(39건)로, `scripts/check-e2e-playwright-config.py` 는 `test_check_e2e_playwright_config.py` 로 각각 커버되는데 이 스크립트만 빠져 있다. 유일한 검증은 CI(`deps-security-checks.yml` config-guard job)가 실제 저장소 상태로 실행하는 것뿐이라, 항상 "일치(happy path)" 분기만 타고 "누락/약화/무단추가" 실패 분기는 자동화 테스트로 한 번도 검증된 적이 없다.
  - 위치: `scripts/check-pnpm-security-config.py` (전체 파일, 특히 `main()` 함수 — 게이트 96~125 라인) / `.github/workflows/deps-security-checks.yml` config-guard job
  - 상세: `plan/in-progress/deps-guard-hardening.md` 를 확인한 결과, 이는 우연한 누락이 아니라 2026-08-01 10차 리뷰에서 뮤턴트로 검증한 **의도적 설계 결정**이다 (`ignoreCves` 거버넌스는 baseline 2-place 편집 자체가 담당, "무단 부활 시 config-guard RED" 로 확인됨). 이번 diff 는 그 스크립트의 데이터(`EXPECTED_OVERRIDES` 값)만 갱신했고 로직은 손대지 않았으므로, 이 diff 자체가 새 테스트를 요구하지는 않는다. 다만 스크립트 로직이 앞으로 바뀔 때는(예: 값 비교를 `==` 대신 다른 방식으로 바꾸는 등) 회귀를 잡을 자동 테스트가 여전히 없다는 사실은 유효한 잔존 갭이다.
  - 제안: 이번 diff 는 blocking 아님. 실측: `python3 scripts/check-pnpm-security-config.py` 를 로컬에서 실행해 이번 4-place(`package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml`/`check-pnpm-security-config.py`) 동기 편집이 self-consistent 함을 확인함(`OK: overrides 30건(값 포함) · onlyBuiltDependencies 5건 · ignoreCves 0건 baseline 일치`, exit 0). 향후 스크립트 로직 자체를 건드리는 PR 에서는 `test_override_floors.py` 패턴(값 불일치·키 누락·무단 추가 3분기를 각각 exit code 로 고정)을 이식할 것을 권고.

- **[INFO]** `socket.io-parser` 는 이 워크스페이스의 실시간 통신 계층(`@nestjs/websockets`, `WebSocketGateway`)에 실제로 쓰이는 런타임 의존성이며, 이번에 `~4.2.7`(tilde, patch-only) 로 새로 override 됐다(GHSA-2m8v-j782-fhvr 대응). 이 diff 자체에는 신규 회귀 테스트가 없지만, `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts`·`ws-rate-limit.guard.spec.ts` 및 `test/background-monitoring.e2e-spec.ts`·`test/execution-park-resume.e2e-spec.ts` 등 기존 socket.io 기반 unit/e2e 테스트가 이미 존재해, 이 의존성 상향의 행동 회귀는 간접적으로 커버된다.
  - 위치: `pnpm-workspace.yaml:37`(게이트 기준, override 추가), `pnpm-lock.yaml` 게이트 `9187|9190`·`20637|20661` 부근 (socket.io-parser 4.2.6→4.2.7 해소)
  - 상세: 기존 WS 테스트들이 socket.io-parser 의 실제 프로토콜 파싱/인코딩 코드 경로까지 얼마나 깊이 exercise 하는지는(예: binary/msgpack 패킷, 에러 처리 경로) 이번 리뷰에서 직접 확인하지 않았다. 다만 CVE 패치가 patch-level(4.2.6→4.2.7) 이라 API 표면 변경 위험은 낮다.
  - 제안: blocking 아님. CI 의 backend jest + e2e(특히 websocket 관련 스펙)가 이번 lockfile 로 green 인지 확인하는 것을 권고(이는 이 리뷰의 diff 범위 밖 — CI/빌드 검증 소관).

## 커버리지/엣지케이스/Mock/격리/가독성/테스트 용이성

해당 없음 — 이번 diff 는 테스트 대상이 될 애플리케이션 로직(함수/클래스/분기)을 포함하지 않는다. `pnpm-lock.yaml` 은 자동 생성 파일이라 리뷰 대상에서 제외했고, `package.json`/`pnpm-workspace.yaml` 은 선언적 설정이라 "테스트 케이스" 개념이 적용되지 않는다.

## 회귀 테스트

- `check-pnpm-security-config.py` 를 로컬에서 실행해 이번 diff 가 4개 파일(package.json, pnpm-lock.yaml, pnpm-workspace.yaml, check-pnpm-security-config.py) 간 baseline 동기화를 깨지 않았음을 실측 확인함(exit 0).
- `.claude/tests/test_override_floors.py` 의 `override_target()` 파서 픽스처(예: `"undici@>=7.0.0 <7.28.0"`)는 실제 `pnpm-workspace.yaml` 값을 참조하지 않는 순수 파싱 유닛 픽스처이므로, 이번 override 값 변경(`<7.28.0`→`<7.29.0`)으로 인해 stale 해지지 않음을 확인했다.

## 요약

이번 PR 은 순수 의존성/lockfile 상향 + 보안 override 3-place(사실상 4-place) baseline 동기화로, 새로 테스트해야 할 애플리케이션 로직이 없다. `check-pnpm-security-config.py` 자체의 비교 로직에 전용 unit test 가 없다는 점은 사실이나, 이는 `plan/in-progress/deps-guard-hardening.md` 에서 10차 리뷰·뮤턴트 검증을 거쳐 이미 의도적으로 내린 설계 결정(2-place 편집 자체가 게이트 역할)이며 이번 diff 가 그 로직을 건드리지도 않았으므로 재지적할 blocking 사유는 아니다. 신규 override(`socket.io-parser: ~4.2.7`)가 건드리는 실시간 통신 경로는 기존 WS unit/e2e 테스트로 간접 커버된다. 전반적으로 테스트 관점에서 이 diff 는 안전하다.

## 위험도

NONE
