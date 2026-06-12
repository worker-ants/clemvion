# 성능(Performance) 리뷰

## 발견사항

### 긍정 사항 (이번 변경의 핵심 성능 개선)

- **[INFO] 모듈 로드 시점 dayjs 스냅샷 빌드 — 올바른 캐싱 패턴**
  - 위치: `code.handler.ts` — `DAYJS_SNAPSHOT` 모듈 상수 (IIFE)
  - 상세: `ivm.Isolate.createSnapshot()` 으로 dayjs UMD 를 한 번만 컴파일·직렬화해 `ExternalCopy<ArrayBuffer>` 로 보관한다. 이후 `execute()` 호출마다 `new ivm.Isolate({ snapshot })` 로 snapshot 을 역직렬화해 힙을 복원하므로, 매 실행 시 dayjs 재파싱/재컴파일 비용(dominant fixed cost)이 제거된다. 벤치(N=200): 0.898ms → 0.662ms/exec (1.36×). 설계 정합성도 좋다 — snapshot 에는 순수 JS만 들어가고, per-exec 의존 host 콜백·§7.3 hardening 은 `BOOTSTRAP_SOURCE` 에 남아 per-exec 에 실행된다.

---

### 잠재적 성능 이슈

- **[WARNING] `BOOTSTRAP_SOURCE` 는 매 exec 마다 `compileScript` + `run` — 추가 스냅샷 대상 여부 검토 필요**
  - 위치: `code.handler.ts` L1501 `await (await isolate.compileScript(BOOTSTRAP_SOURCE)).run(ctx);`
  - 상세: dayjs 재컴파일은 제거됐지만 `BOOTSTRAP_SOURCE` (약 70 LoC의 IIFE)는 여전히 매 exec 마다 `compileScript()` + `run()` 으로 재컴파일·재실행된다. 이 스크립트의 로직 상당수(fmt 함수, $helpers/console 조립 등)는 정적이나, `__host_*` 콜백 바인딩 및 `delete globalThis[key]` 하드닝은 per-exec context 에 의존하므로 순수 snapshot 화가 불가하다는 점은 맞다. 다만 BOOTSTRAP_SOURCE 의 컴파일 결과(`ivm.Script`)를 모듈 레벨에서 한 번만 컴파일해 재사용(`compileScriptSync` + 모듈 상수 보관)하면 `.compileScript()` 파싱 비용은 제거하면서 per-exec `run(ctx)` 는 그대로 유지할 수 있다. `compileScript` 자체가 parse + bytecode 생성을 포함하므로 재사용 여지가 있다.
  - 제안: `BOOTSTRAP_SOURCE` 를 모듈 로드 시 `syntaxIsolate` 와 유사하게 별도 isolate 에서 `compileScriptSync` 로 미리 컴파일하거나, isolated-vm 이 `ivm.Script` 를 cross-isolate 로 재실행하는 것을 지원하는지 확인 후 적용. 지원하지 않는다면 현 구조 유지가 합리적이나 주석에 이유를 명시하는 것이 좋다.

- **[WARNING] 매 exec 마다 사용자 코드 `compileScript()` — 캐싱 불가 구조이나 캐시 설계 검토 필요**
  - 위치: `code.handler.ts` L1506 `script = await isolate.compileScript(wrapUserCode(code));`
  - 상세: 동일한 코드 블록이 반복 실행되는 경우(예: 워크플로 루프, 동시 다중 실행) 매번 `wrapUserCode(code)` → `compileScript()` 가 실행된다. isolated-vm 은 isolate 당 컴파일 결과를 공유할 수 없으므로 현재 구조에서는 불가피하다. 그러나 사용자 코드가 변경되지 않는 경우가 많다면 (workflow run 내에서 동일 node config), code hash → `ivm.Script` 바이트코드 캐시(isolated-vm 의 `cachedData` 옵션)를 활용해 파싱·바이트코드 생성 비용은 제거할 수 있다.
  - 제안: 단기적으로는 현 구조 수용. 중기적으로 isolated-vm `compileScript({ produceCachedData: true })` 로 바이트코드를 추출해 코드 해시 keyed LRU 캐시에 보관하고 재컴파일 시 `cachedData` 로 재사용하는 방안 검토. 메모리 캐시 크기는 제한 필요.

- **[INFO] `deepClone` 이 `JSON.parse(JSON.stringify(v))` — 대규모 `context.variables` 시 O(n) 직렬화 비용**
  - 위치: `code.handler.ts` L1431 `const varsClone = deepClone(context.variables) ?? {};`
  - 상세: `JSON.parse(JSON.stringify(...))` 는 간단하고 올바르지만, `context.variables` 가 수 MB 크기일 경우 매 exec 마다 전체 직렬화·역직렬화가 발생한다. 현재 $vars 는 워크플로 단위 공유 상태이므로 실제 사용 패턴에서 수 MB를 넘는 경우는 드물 수 있으나, 구조적 상한이 없다.
  - 제안: 즉각 변경 불필요. 다만 `context.variables` 에 크기 상한(예: 1MB serialize 상한)을 두는 방어 코드를 추후 고려. structuredClone 이 런타임에서 사용 가능하다면 성능은 유사하지만 더 명시적 의미론을 제공한다.

- **[INFO] 테스트의 25회 반복 execute() — 실 실행 비용에 주의**
  - 위치: `code.handler.spec.ts` L813 `for (let i = 0; i < 25; i++) { ... handler.execute(...) ... }`
  - 상세: 각 `execute()` 가 격리된 ivm.Isolate 생성·실행·dispose 전 사이클을 포함한다. 25회는 스냅샷 재사용 일관성을 검증하는 데는 충분하나, 이 루프가 CI 환경에서 느린 isolate 초기화와 맞물릴 경우 테스트 전체 시간이 증가할 수 있다. 해당 테스트에 jest timeout 이 명시되어 있지 않다(기본 5000ms). 실제로는 snapshot 경로이므로 각 exec 이 빠르지만(~0.66ms), CI 에서 콜드 스타트가 길거나 격리된 환경에서 느려질 수 있다.
  - 제안: 반복 횟수를 5~10회로 줄이거나, 테스트에 jest timeout을 명시(`}, 10_000`)해 플레이크를 방지. 목적이 "스냅샷 재사용 일관성"이라면 5회로도 충분히 검증 가능하다.

- **[INFO] 모듈 로드 시 `readFileSync` — 블로킹 I/O**
  - 위치: `code.handler.ts` L1128-L1131 `const DAYJS_SOURCE = readFileSync(...)`
  - 상세: 기존부터 존재한 패턴으로 이번 변경에서 새로 도입된 것은 아니다. 모듈 로드 시 동기 파일 읽기는 Node.js 서버 cold start 를 지연시킨다. dayjs.min.js 는 수십 KB 수준이므로 실 영향은 미미하나, 이어서 `createSnapshot()` IIFE 실행(synchronous ivm 스냅샷 생성)까지 모듈 로드를 블로킹한다.
  - 제안: 현 규모에서는 허용 가능. cold start 최적화가 필요한 경우 lazy init 패턴(첫 execute() 호출 시 초기화 + promise memoize)으로 전환 가능하나, 이는 별도 트레이드오프(첫 exec 지연 vs cold start 분산) 가 있어 현 선택이 합리적이다.

- **[INFO] `DAYJS_SNAPSHOT` 생성 실패 시 undefined 반환 — 성능 저하 무음 처리**
  - 위치: `code.handler.ts` L1041-L1049 snapshot IIFE의 catch 블록
  - 상세: `createSnapshot` 실패 시 `undefined` 로 폴백하며 per-exec 재컴파일 경로로 진행한다. 이 경우 성능 개선이 적용되지 않으나 로그나 메트릭이 없어 운영 환경에서 자동 감지가 어렵다.
  - 제안: catch 블록에 `console.warn('[CodeHandler] dayjs snapshot creation failed — falling back to per-exec compile:', err)` 를 추가해 배포 환경에서 폴백 여부를 가시화한다.

---

## 요약

이번 변경의 핵심인 `DAYJS_SNAPSHOT` 모듈 상수 패턴은 성능 설계 측면에서 적절하다. dayjs UMD 재컴파일이라는 per-exec 고정 비용을 모듈 로드 시 1회 스냅샷으로 제거하고, per-exec 의존 상태(host 콜백, §7.3 hardening)는 `BOOTSTRAP_SOURCE` 에서 분리 유지해 보안·격리 불변을 지킨다. 실측 1.36× 개선은 dayjs 재컴파일 제거분이며, 이론상 최대 개선은 `BOOTSTRAP_SOURCE` compile 재사용(경고 항목)으로 추가 달성 가능하다. 전반적으로 신중하고 안전한 성능 최적화이며, 잠재 이슈는 모두 INFO 또는 WARNING 수준이다.

## 위험도

LOW
