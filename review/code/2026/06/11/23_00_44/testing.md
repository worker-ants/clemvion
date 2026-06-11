# 테스트(Testing) 리뷰 결과

**대상 변경**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**핵심 코드 변경**: `http-request.handler.ts` (SSRF 가드 ungate), `error-codes.ts` (`HTTP_BLOCKED` enum 등재)
**핵심 테스트 변경**: `http-request.handler.spec.ts` (+4 테스트: none/custom 차단·opt-out·Principle 7 D1)

---

## 발견사항

### [INFO] `authentication=none` 은 IMDS 차단, `authentication=custom` 은 RFC1918 차단 테스트됨 — 두 케이스의 교차 커버리지 갭
- 위치: `http-request.handler.spec.ts` lines 961–999
- 상세: `none` 테스트는 `169.254.169.254`(cloud IMDS, link-local), `custom` 테스트는 `10.0.0.5`(RFC1918) 를 사용한다. 반대 조합(`none + RFC1918`, `custom + IMDS`)은 테스트되지 않는다. 핵심 속성(가드가 authentication 값에 무관하게 동일 함수를 호출한다)은 구현상 명확하므로 CRITICAL 이 아니다. 다만 `none` 이 IMDS 만 막히고 RFC1918 는 허용되는 회귀가 있을 경우 현재 테스트로는 감지되지 않는다.
- 제안: 기존 `blocks authentication=none requests to cloud IMDS` 테스트에 `10.0.0.5` 케이스를, 또는 `custom` 테스트에 `169.254.169.254` 케이스를 한 줄씩 추가해 교차 커버리지 보완. 테스트 두 개를 data-driven(`test.each`)으로 통합하면 유지보수 부담 없이 커버리지가 넓어진다.

### [INFO] `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 테스트가 `none` 인증만 커버 — `custom` 인증 opt-out 미검증
- 위치: `http-request.handler.spec.ts` lines 1001–1029
- 상세: opt-out 테스트 제목은 `allows none-auth private targets when ALLOW_PRIVATE_HOST_TARGETS=true` 이고 `authentication: 'none'` 만 사용한다. `authentication: 'custom'` 도 동일 코드 경로를 거치지만 opt-out 케이스가 따로 검증되지 않는다. 구현상 동일 분기이므로 기능 버그 위험은 낮지만, `custom` 이 독자적으로 opt-out 됨을 spec 이 명시(전 인증 방식)하므로 테스트 문서화 관점의 갭이 있다.
- 제안: `allows custom-auth private targets when ALLOW_PRIVATE_HOST_TARGETS=true` 케이스를 추가하거나, 기존 테스트를 `authentication: 'none'` / `'custom'` 두 값으로 파라미터화. `integration` 인증의 opt-out 테스트가 이미 없지만, `integration` 은 redirect SSRF 검증도 포함하므로 별도 처리가 맞다.

### [INFO] `localhost` 차단 테스트가 `authentication=integration` 전용 — `none`/`custom` 으로 localhost 차단 미검증
- 위치: `http-request.handler.spec.ts` lines 937–956
- 상세: `blocks localhost by name (D4)` 테스트는 `authentication: 'integration'` + `integrationId: 'int-1'` 를 사용한다. 기존에는 integration 전용 SSRF 가드이므로 이것이 유일한 케이스였다. 이번 변경으로 `none`/`custom` 도 localhost 를 차단해야 하지만, 새로 추가된 `none`/`custom` 테스트는 IMDS(`169.254.169.254`)와 RFC1918(`10.0.0.5`)만 사용하고 loopback(`localhost` / `127.0.0.1`)은 검증하지 않는다.
- 제안: 추가 테스트가 부담되면 기존 `blocks localhost by name` 테스트를 `test.each([none, custom, integration])` 으로 확장하거나, `none` 테스트에 `url: 'http://localhost:8080/secret'` 케이스를 한 줄 추가.

### [INFO] SSRF 차단 시 `configEcho` 내 필드 완결성 미검증
- 위치: `http-request.handler.spec.ts` lines 961–999 (새 SSRF 테스트 3개)
- 상세: Principle 7 D1 credential-leak 테스트(lines 135–160)는 성공 경로에서 config echo 가 credential-shape 필드를 누출하지 않음을 검증한다. 그러나 SSRF 차단(error 경로)에서 `buildPreflightErrorOutput` 이 동일 `configEcho` 를 사용할 때 credential 누출 여부는 검증되지 않는다. SSRF 차단 시에도 `output.config` 가 반환되며 같은 `configEcho` 객체를 사용하므로, 성공 경로 테스트로 간접 보증되지만 명시적 테스트가 없다.
- 제안: `blocks authentication=none requests to cloud IMDS` 테스트에 `expect(result.output?.config).not.toHaveProperty('apiKey')` 형태의 단언을 한 줄 추가하면 error 경로 config echo 의 Principle 7 D1 준수를 명시적으로 검증할 수 있다.

### [INFO] dry-run 시 SSRF 차단 skip 테스트가 `integration` 전용 — `none`/`custom` dry-run 동작 미검증
- 위치: `http-request.handler.spec.ts` lines 569–616
- 상세: `skips SSRF host checks in dry-run` 테스트는 `authentication: 'integration'` 을 사용한다. 이번 변경 이전에는 `none`/`custom` 은 SSRF 가드가 없어 dry-run 과 무관했다. 변경 후 `none`/`custom` 도 SSRF 가드를 통과하므로, dry-run 모드에서 `none`/`custom` 인증이 SSRF 차단 호스트에 대해 어떻게 동작하는지(skip 하는지, 아니면 차단하는지) 테스트가 없다. 구현상 dry-run 분기는 SSRF 가드보다 앞에 있으므로 skip 되어야 하지만, 검증 없다.
- 제안: 기존 dry-run 테스트 또는 새 테스트에 `authentication: 'none'` + 차단 주소로 dry-run 실행 → `result.port === 'success'` + `_dryRun === true` 확인을 추가.

### [INFO] Principle 7 D1 credential-leak 테스트의 mock 구조 — `makeContext` 의 `rawConfig` 주입 vs `execute` 의 실제 config 인자 분리
- 위치: `http-request.handler.spec.ts` lines 135–160
- 상세: 테스트는 `makeContext({ method: 'GET', url: '...', apiKey: 'SUPER_SECRET_KEY', authToken: 'LEAKED_TOKEN' })` 로 `rawConfig` 에 credential-shape 필드를 주입하고, `handler.execute(null, { method: 'GET', url: '...' }, ctx)` 로 두 번째 인자에는 clean config 를 전달한다. 이 설계는 handler 가 `rawConfig` 를 spread 해 `configEcho` 를 만들지 않는다면 credential 이 echo 되지 않음을 검증하는 구조다. 의도는 명확하나, 테스트 코드만 보면 왜 `execute` 의 두 번째 인자와 `makeContext` 의 `rawConfig` 가 다른지 설명이 없어 처음 읽는 리뷰어에게 혼란을 줄 수 있다.
- 제안: 테스트 바로 위 주석에 "rawConfig is what handler sees via context.rawConfig (simulating the engine injecting the full unfiltered config); the second arg is the nodeConfig that drives execution" 한 줄을 추가해 의도를 명시. 현재 기능상 문제 없음.

---

## 요약

이번 변경의 핵심 보안 경로(`none`/`custom` 인증 SSRF 차단, `ALLOW_PRIVATE_HOST_TARGETS` opt-out, Principle 7 D1 credential-leak)에 대한 테스트가 모두 추가되어 있고, 기존 integration 인증 SSRF 테스트도 그대로 유효하다. 테스트 격리(환경변수 `finally` 복원)와 mock 설계(jest.fn + mockResolvedValue) 모두 적절하다. 식별된 갭은 모두 INFO 수준으로, 교차 인증 방식 조합(none + RFC1918, custom + IMDS, none + localhost), custom 인증 opt-out, dry-run + none/custom SSRF, error 경로 config echo Principle 7 D1 명시 검증이 누락되어 있다. 이 갭들은 현재 구현이 단일 분기를 거치기 때문에 기능 버그를 숨기는 위험은 낮지만, 회귀 감지망의 완결성을 높이기 위해 보완을 권장한다.

## 위험도

LOW

---

STATUS: OK
