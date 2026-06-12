# 성능(Performance) 리뷰 — code.handler.ts

## 발견사항

- **[INFO]** `deepClone` 이 `JSON.parse(JSON.stringify(value))` 로 구현됨
  - 위치: `deepClone` 함수 (line 151–154), `execute()` 내 `varsClone = deepClone(context.variables)` (line 444)
  - 상세: `JSON.parse(JSON.stringify(...))` 는 큰 `variables` 객체에 대해 두 번의 직렬화 패스를 수행한다. `structuredClone`(Node 17+) 이 더 빠르고 Date / Map / Set 등 JSON-safe 하지 않은 값도 처리한다. 현재 코드는 변수 객체가 작다고 가정하므로 실용적 위험은 낮지만, 고빈도 실행 시 GC 압박이 누적될 수 있다.
  - 제안: `structuredClone(value)` 로 교체. `undefined`/`null` guard 는 유지할 수 있다.

- **[INFO]** `BOOTSTRAP_SOURCE` 를 매 실행마다 재컴파일
  - 위치: `_buildIsolateContext` 내 `await (await isolate.compileScript(BOOTSTRAP_SOURCE)).run(ctx)` (line 608)
  - 상세: 코드 주석이 "ivm.Script 는 컴파일된 isolate 에 바인딩되며 교차-isolate 공유가 불가능하다"고 정확히 설명하고 있다. 따라서 이는 구조적 제약이며 버그가 아니다. 단 BOOTSTRAP_SOURCE (~70 LoC) 재컴파일 비용이 완전히 0 은 아니다. `ivm.Isolate.createSnapshot`에 BOOTSTRAP_SOURCE 를 포함시키는 것은 불가능하다(host callbacks `__host_*` 가 per-exec 상태를 캡처하므로). 현재 설계는 이미 최적이다. 추가 주석 수준.
  - 제안: 현 설계 유지. 관찰 사항으로만 기록.

- **[INFO]** `_buildIsolateContext` 에서 다수의 `await jail.set(...)` 을 순차 실행
  - 위치: `_buildIsolateContext` (lines 554–595), 총 8개의 순차 await
  - 상세: 각 `jail.set`은 개별 비동기 마이크로태스크를 발생시킨다. `isolated-vm` 내부에서는 사실상 동기 작업이므로 실질적 지연은 미미하다. 다만 API 문서상 `jail.set`은 동기 버전(`setSync`)을 제공하므로, 동기 버전으로 전환하면 이벤트 루프 틱 오버헤드를 완전히 제거할 수 있다.
  - 제안: `jail.set` → `jail.setSync`, `isolate.compileScript` + `.run` → `compileScriptSync` + `runSync` 로 전환을 검토. 단 `runSync`는 CPU 타임아웃만 지원하므로 async 사용자 코드에는 `run({ promise: true })`가 필요하여 전면 교체가 어렵다. 컨텍스트 주입 8개 set 만 `setSync` 전환은 실현 가능.

- **[INFO]** `DAYJS_SNAPSHOT` 이 process-scoped ArrayBuffer 로 상주
  - 위치: module-level `DAYJS_SNAPSHOT` 선언 (line 133)
  - 상세: 주석이 명시하듯이 이 ArrayBuffer 는 Node.js 프로세스 종료까지 GC 되지 않는다. 스냅샷 크기가 수백 KB 수준이므로 허용 범위이나, 다수의 유사한 패턴이 추가될 경우 module-level 메모리 고정 비용이 누적될 수 있다. 현재 단일 사용 기준으로는 문제 없음.
  - 제안: 현 설계 유지. 향후 유사 패턴 추가 시 총 비용을 측정할 것.

- **[INFO]** `_buildIsolateContext` 내 fallback 경로에서 `compileScript` 결과를 변수에 캐시하지 않고 즉시 버림
  - 위치: line 601: `await (await isolate.compileScript(DAYJS_LOAD_SCRIPT)).run(ctx);`
  - 상세: DAYJS_SNAPSHOT이 없는 fallback 경로에서는 `DAYJS_LOAD_SCRIPT`를 매 exec 마다 재컴파일한다. 이는 스냅샷 사용이 불가한 플랫폼에서 성능 저하를 유발하나, DAYJS_SNAPSHOT이 정상 동작하는 환경에서는 이 경로가 실행되지 않아 실용적 영향 없음.
  - 제안: 스냅샷 사용 불가 환경에서 중요한 성능이 필요하다면, fallback 시 compileScript 결과를 module-level 변수에 저장하는 방안 검토. 현재로서는 낮은 우선순위.

- **[INFO]** `hostHash` 에서 에러 메시지 생성 시 Set spread 사용
  - 위치: `hostHash` 함수 (line 167–169): `[...ALLOWED_HASH_ALGORITHMS].join(', ')`
  - 상세: 에러 경로(비정상 algorithm)에서만 실행되므로 hot path 가 아니다. 실용적 영향 없음.
  - 제안: 에러 메시지용 문자열 상수를 모듈 수준에서 미리 계산해 두면 완전히 제거 가능하나, 현재 수준의 영향은 무시 가능.

- **[INFO]** `syntaxIsolate` 장기 공유 isolate 의 메모리 상태 감시 부재
  - 위치: `syntaxCheck` 함수 (line 333–345), `syntaxIsolate` 모듈 변수 (line 325)
  - 상세: `isDisposed` 재생성 guard 는 있으나, 정상 상태의 syntax isolate 가 장시간 운용되며 컴파일된 Script 객체가 `script.release()` 로 해제되고 있다 (정상). 단 V8 isolate 내부 코드 캐시가 누적될 가능성이 미미하게 있다. `memoryLimit: 8`(MB) 로 제한되어 있어 실용적 위험은 낮음.
  - 제안: 현 설계 유지.

## 요약

`code.handler.ts`는 전반적으로 성능을 세심하게 고려하여 설계되어 있다. dayjs UMD 를 `createSnapshot`으로 한 번만 컴파일하여 per-exec 재컴파일 비용을 제거한 설계가 핵심 최적화이며, 모듈 레벨 상수·정규식 캐싱·에러 코드 테이블화도 적절하다. 실질적 개선 여지가 있는 부분은 `deepClone`의 `structuredClone` 전환과 `_buildIsolateContext` 내 8개 `jail.set` 호출의 `setSync` 전환이지만, 두 항목 모두 고빈도 실행 환경에서의 GC/tick 오버헤드 감소 수준이며 기능적 정확성에는 영향이 없다. N+1 쿼리·블로킹 I/O·캐시 무효화 문제는 발견되지 않았다.

## 위험도

LOW
