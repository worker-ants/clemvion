### 발견사항

- **[INFO]** `resolveMemoryLimitMb` — 소수점 입력의 `parseInt` 절사 동작 미테스트
  - 위치: `code.handler.ts:57-74` / `code.handler.spec.ts:883-921`
  - 상세: 함수 주석에 "decimal inputs are truncated (e.g. `"256.9"` → 256)" 라고 명시됐지만, 해당 케이스를 검증하는 테스트가 없다. 현재 `it.each(['abc', '0', '-5', '', '   '])` 는 fallback 케이스만 다루고, 유효 범위 내 소수점 입력 (`"256.9"` → 256) 이나 상한 직전 소수점 (`"512.5"` → 512) 은 포함하지 않는다.
  - 제안: `it('truncates decimal input (e.g. "256.9" → 256)', ...)` 케이스 추가.

- **[INFO]** `_runWithTimeout` — 벽시계 타임아웃 1초 버퍼(`timeoutMs + 1000`) 의 독립 단위 테스트 없음
  - 위치: `code.handler.ts:636-640`
  - 상세: `_runWithTimeout` 은 private 메서드라 직접 테스트가 불가하지만, 벽시계 타임아웃이 실제로 `timeoutMs + 1000` 후에 발화해야 한다는 계약이 통합 테스트에서도 간접적으로만 커버된다. 특히 async 무한 대기 테스트(`await new Promise(() => {})`)가 타임아웃 코드 경로를 검증하긴 하지만, 벽시계 타이머 정리(`clearTimeout`)가 항상 실행되는지(성공 경로에서도) 는 별도로 검증되지 않는다.
  - 제안: `finally` 블록의 `clearTimeout` 은 성공 경로에서도 반드시 실행돼야 타이머 누수가 없다. 성공 실행 후 타이머가 정리됐는지는 Jest fake timer를 써서 확인 가능하나, 현재 테스트 누락. 중요도가 낮은 내부 구현 세부사항이므로 INFO로 분류.

- **[INFO]** `deepClone` 함수 — 독립 단위 테스트 없음
  - 위치: `code.handler.ts:151-154`
  - 상세: `deepClone` 은 non-exported 내부 함수로 `JSON.parse(JSON.stringify(...))` 패턴을 쓴다. `undefined` / `null` 값 처리, 순환 참조(현재 처리 안 함 — JSON.stringify가 던짐), `Date` 객체 직렬화 손실 등의 엣지 케이스가 테스트되지 않는다. 현재는 `$vars atomic replace` 테스트에서 간접 커버되지만, 비직렬화 가능 값(`() => {}`) 케이스는 `$vars copy-out fails` 테스트로 커버한다고 주석에 명시돼 있다.
  - 제안: 현재 동작이 동작 테스트로 충분히 커버됐으므로 추가 불필요하지만, 순환 참조 입력 시의 동작(throw)이 문서화·명시적 기대값 없이 남아 있다. 최소한 주석 수준의 명세가 있으면 좋다.

- **[INFO]** `hostHash` / `hostB64Encode` / `hostB64Decode` — 직접 단위 테스트 없음 (통합 경로만 커버)
  - 위치: `code.handler.ts:163-208`
  - 상세: 세 host-realm 함수는 모두 non-exported이며, 테스트는 격리된 vm 내부의 `$helpers.*` 호출을 통한 통합 경로로만 검증한다. `hostHash`의 알려진 SHA-256 다이제스트, `hostB64Encode`/`hostB64Decode` 라운드트립 등은 통합 테스트에 존재한다. 허용된 해시 알고리즘 전체(`sha384`, `sha512`, `sha1`, `md5`)에 대한 테스트가 없고, `sha256` 케이스만 검증한다.
  - 제안: 최소한 `sha1`, `md5` 등 다른 허용 알고리즘의 기본 동작을 테스트하는 케이스 추가. `ALLOWED_HASH_ALGORITHMS` Set의 각 멤버가 오류 없이 실행되는지 확인.

- **[INFO]** `wrapUserCode` 함수 — 라인 오프셋(+3) 동작 미검증
  - 위치: `code.handler.ts:311-320`
  - 상세: 주석 W14에 "런타임 에러 라인 오프셋 +3" 이 명시됐지만, 실제 에러 메시지에 포함된 라인 번호가 +3 오프셋을 반영하는지 테스트가 없다. spec §4 step2 계약이 UI/호출자에서 소비되는 중요 동작이다.
  - 제안: `throw new Error("test")` 가 포함된 코드를 실행하고 에러 스택의 라인 번호가 예상 오프셋과 일치하는지 검증하는 테스트 추가. 다만 isolated-vm 이 에러 라인 정보를 어떻게 노출하느냐에 따라 flaky할 수 있으므로, INFO 수준으로 분류.

- **[INFO]** `BOOTSTRAP_SOURCE` W13 순서 보장 — 테스트 간접 커버만 존재
  - 위치: `code.handler.ts:224-295`
  - 상세: W13 주석은 "capture BEFORE delete" 순서가 반드시 지켜져야 한다고 경고하지만, 이 순서가 깨질 경우 $helpers 가 undefined 를 참조하게 된다는 것을 명시적으로 검증하는 테스트가 없다. 현재 보안 제한 테스트들이 간접적으로 `delete`가 일어난 후에도 `$helpers` 가 동작함을 검증하지만, W13 순서 자체에 대한 설명이 없다.
  - 제안: 테스트 주석 수준에서라도 "이 테스트는 W13 캡처-후-삭제 순서가 유지됨을 검증한다"는 명시적 레이블을 추가하면 회귀 방어가 명확해진다.

- **[INFO]** `classifyCodeNodeError` — 사용자가 `err.code = 'EXECUTION_TIMEOUT'` 을 직접 설정한 경우의 스푸핑 방어 테스트 불완전
  - 위치: `code.handler.spec.ts:926-997`
  - 상세: W2 스푸핑 방어 주석이 Priority 2(`isDisposed`) 에 대해서는 잘 테스트됐다. 하지만 Priority 1(`err.code === 'EXECUTION_TIMEOUT'`)은 신뢰 출처(호스트 설정)로 문서화됐음에도, 사용자 코드가 `throw Object.assign(new Error(), { code: 'EXECUTION_TIMEOUT' })` 를 던질 경우에도 동일하게 분류된다는 것이 테스트나 주석에서 명시되지 않았다. isolated-vm 경계 안에서 던져진 에러의 `.code` 프로퍼티가 호스트에서 그대로 보이는지, 아니면 isolated-vm 이 에러 객체를 재구성하는지도 검증되지 않았다.
  - 제안: 사용자 코드에서 `{ code: 'EXECUTION_TIMEOUT' }` 를 가진 에러를 던지는 execute 통합 테스트를 추가해, 실제로 `CODE_TIMEOUT`으로 분류되는지 또는 isolated-vm 의 에러 복사 메커니즘이 `.code` 를 제거하는지 확인.

### 요약

`code.handler.spec.ts` 는 매우 높은 품질의 테스트 파일로, 기본 실행·보안 격리·$helpers·$vars atomic replace·dayjs 스냅샷 경로·fallback 경로·메모리 한계·타임아웃·classifyCodeNodeError 분류 등 핸들러의 모든 주요 동작 경로를 체계적으로 커버한다. 발견된 갭은 모두 INFO 수준으로, `resolveMemoryLimitMb` 의 소수점 절사 명세 검증 미흡, 허용 해시 알고리즘 일부 미검증, 라인 오프셋 +3 계약 미검증 등 주변 케이스에 국한된다. 전반적으로 테스트 격리·가독성·Mock 사용(jest.isolateModules 활용)·회귀 방어가 우수하며 테스트 용이성을 위한 내부 함수 export(`resolveMemoryLimitMb`, `classifyCodeNodeError`)도 적절하다.

### 위험도

LOW
