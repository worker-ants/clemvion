# 테스트(Testing) 리뷰 결과

**대상 변경**: HTTP Request 노드 SSRF 가드 전 인증 방식 적용 (refactor 04 C-3)
**핵심 코드 변경**:
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` — SSRF 가드 `authentication='integration'` 게이트 제거
- `codebase/frontend/src/lib/i18n/backend-labels.ts` — `HTTP_BLOCKED` 한국어 메시지 추가
**핵심 테스트 변경**: `http-request.handler.spec.ts` (+4 테스트: none/custom 차단·opt-out·Principle 7 D1)

---

## 발견사항

### [INFO] `authentication=none` x IMDS, `authentication=custom` x RFC1918 교차 조합 테스트 갭
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` lines 961–999
- 상세: `none` 테스트는 `169.254.169.254`(link-local IMDS), `custom` 테스트는 `10.0.0.5`(RFC1918)만 사용한다. 반대 조합(`none + RFC1918`, `custom + IMDS`)은 미검증이다. 구현상 두 경로 모두 동일 가드 함수를 호출하므로 기능 버그 위험은 낮다. 다만 `none`이 특정 대역만 선택적으로 차단하는 회귀가 생겨도 현재 테스트로는 감지되지 않는다.
- 제안: `test.each([['none', '169.254.169.254'], ['none', '10.0.0.5'], ['custom', '169.254.169.254'], ['custom', '10.0.0.5']])` 형태로 두 테스트를 data-driven 통합하면 4개 조합을 커버하면서 코드량은 줄어든다.

### [INFO] `authentication=custom` + `ALLOW_PRIVATE_HOST_TARGETS=true` opt-out 테스트 누락
- 위치: `http-request.handler.spec.ts` lines 1001–1029
- 상세: opt-out 테스트(`allows none-auth private targets when ALLOW_PRIVATE_HOST_TARGETS=true`)는 `authentication: 'none'`만 검증한다. spec이 opt-out을 "전 인증 방식"에 공통 적용한다고 명시하므로 `custom` 경로도 별도 검증해야 한다. 구현은 동일 분기이지만 문서화 갭이다.
- 제안: 기존 opt-out 테스트를 `test.each(['none', 'custom'])`으로 파라미터화하거나 `custom` 케이스를 1개 추가.

### [INFO] `none`/`custom` 인증으로 loopback(`localhost`) 차단 테스트 누락
- 위치: `http-request.handler.spec.ts` line 937 (`blocks localhost by name`)
- 상세: 기존 loopback 차단 테스트는 `authentication: 'integration'` + `integrationId: 'int-1'`만 사용한다. 이번 변경이 `none`/`custom`에도 가드를 적용했으므로 IMDS/RFC1918 테스트처럼 loopback 차단도 `none`/`custom` 경로에서 검증해야 한다. 신규 테스트 2개(`none`/`custom` SSRF)가 IMDS·RFC1918만 다루고 loopback은 다루지 않는다.
- 제안: `blocks localhost by name` 테스트를 `test.each(['none', 'custom', 'integration'])` 으로 확장하거나 `none`/`custom` 케이스를 각각 1줄 추가.

### [INFO] SSRF 차단(error 경로)에서 configEcho Principle 7 D1 명시 검증 누락
- 위치: `http-request.handler.spec.ts` lines 961–999 (none/custom SSRF 차단 테스트)
- 상세: Principle 7 D1 credential-leak 테스트(line 135)는 성공 경로에서 `config` echo에 `apiKey`/`authToken`이 없음을 검증한다. 그러나 SSRF 차단(error 경로)의 `buildPreflightErrorOutput`도 동일 `configEcho` 객체를 사용하는데, error 경로에서 credential 미포함 여부를 명시적으로 검증하는 단언이 없다. 성공 경로 테스트로 간접 보증되지만 명시적 단언 부재.
- 제안: `blocks authentication=none requests to cloud IMDS` 테스트에 `expect((result.output as {config: unknown}).config).not.toHaveProperty('apiKey')` 단언 1줄 추가로 error 경로 Principle 7 D1도 명시 커버.

### [INFO] dry-run + `none`/`custom` 인증의 SSRF 가드 skip 동작 테스트 누락
- 위치: `http-request.handler.spec.ts` line 569 (`skips SSRF host checks in dry-run`)
- 상세: dry-run SSRF skip 테스트는 `authentication: 'integration'`만 사용한다. 변경 전에는 `none`/`custom`에 SSRF 가드가 없어 dry-run과 무관했으나, 변경 후에는 `none`/`custom`도 가드를 거쳐야 한다. dry-run 분기가 SSRF 가드보다 앞에 있어 skip되어야 하지만(코드 주석에 의도 명시), `none`/`custom` dry-run 경로에서 차단 대상 URL을 주면 `port: 'success'`가 반환되는지 검증하는 테스트가 없다.
- 제안: 기존 dry-run SSRF 테스트에 `authentication: 'none'` + `url: 'http://169.254.169.254/...'` + `__dryRun: true` → `result.port === 'success'` 단언을 추가. `integration` 케이스와 동일 ctx 구조를 재사용하면 추가 코드량이 적다.

### [INFO] `process.env` 직접 조작 패턴 — Jest 격리 수준 의존
- 위치: `http-request.handler.spec.ts` lines 1001–1029
- 상세: `ALLOW_PRIVATE_HOST_TARGETS` opt-out 테스트가 `process.env`에 직접 쓰고 `finally`로 복원하는 패턴을 사용한다. 파일 단위 Jest worker 격리(`--runInBand` 미사용 + 기본 worker 격리)라면 race condition 발생 가능성 없다. 그러나 같은 spec 파일 안에서 동일 패턴이 여러 테스트에 확산될 경우 환경변수 상태 오염이 발생할 수 있다. 현재는 1개 테스트에만 있어 위험 낮음.
- 제안: 현행 유지. 이후 동일 패턴이 3회 이상이면 `withEnv(key, value, fn)` 헬퍼로 추출을 검토.

### [INFO] Principle 7 D1 credential-leak 테스트의 `makeContext` vs `execute` 인자 불일치 의도 설명 부재
- 위치: `http-request.handler.spec.ts` lines 135–160
- 상세: `makeContext({ ..., apiKey: 'SUPER_SECRET_KEY' })`로 `rawConfig`에 credential을 주입하고 `handler.execute(null, { method: 'GET', url: '...' }, ctx)`의 두 번째 인자에는 clean config를 전달한다. 이 패턴이 왜 두 인자가 다른지 주석이 없어 처음 읽는 기여자가 의도를 오해하기 쉽다.
- 제안: 테스트 위 주석에 "rawConfig는 engine이 주입하는 전체 미필터 config(context 경유), execute 두 번째 인자는 nodeConfig — 둘을 다르게 설정해 rawConfig spread 시 credential 누출을 검증" 한 줄 추가.

### [INFO] `backend-labels.ts` `HTTP_BLOCKED` 추가에 대한 테스트 부재
- 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` — 신규 `HTTP_BLOCKED` 한국어 메시지 추가
- 상세: `ERROR_KO` 매핑 추가가 코드 변경(파일 2)으로 들어왔으나, 이 매핑이 실제로 사용되는지(`translateErrorCode` 함수가 `HTTP_BLOCKED`를 올바른 한국어로 반환하는지) 검증하는 테스트가 없다. i18n 매핑 자체에 오타나 누락이 생겨도 빌드/테스트 단계에서 감지되지 않는다.
- 제안: `backend-labels.ts` 또는 `translateErrorCode`에 대한 기존 테스트 파일이 있다면 `HTTP_BLOCKED` 케이스를 추가. 없다면 최소 단위로 `ERROR_KO['HTTP_BLOCKED']`가 정의되어 있고 falsy가 아님을 검증하는 테스트 추가 권장.

---

## 요약

이번 변경의 핵심 보안 경로(`none`/`custom` 인증 SSRF 차단, `ALLOW_PRIVATE_HOST_TARGETS` opt-out, Principle 7 D1 credential-leak)에 대한 테스트가 모두 추가되어 있고, 기존 `integration` 인증 SSRF 테스트도 그대로 유효하다. 테스트 격리(`finally` env 복원)와 mock 설계(jest.fn + mockResolvedValue)는 모두 적절하다. `http-safety.spec.ts`는 단위 수준에서 RFC1918·IMDS·loopback·IPv6 각 대역을 독립 검증하고 있어 가드 함수 자체의 커버리지는 충분하다. 식별된 갭은 모두 INFO 수준으로, (1) 교차 인증 방식×차단 대역 조합 미검증, (2) `custom` opt-out 미검증, (3) `none`/`custom` loopback 차단 미검증, (4) error 경로 Principle 7 D1 명시 단언 부재, (5) dry-run×`none`/`custom` SSRF skip 미검증, (6) `HTTP_BLOCKED` i18n 매핑 테스트 부재가 있다. 이 갭들은 구현이 단일 분기를 거치기 때문에 기능 버그를 은닉하는 위험은 낮으나, 회귀 감지망의 완결성과 변경 의도 문서화를 높이기 위해 보완을 권장한다.

---

## 위험도

LOW

---

STATUS: OK
