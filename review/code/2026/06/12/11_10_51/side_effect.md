# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] 모듈 임포트 시점 동기 중(blocking) 실행 — createSnapshot IIFE

- **위치**: `code.handler.ts` L95–107 (`DAYJS_SNAPSHOT` IIFE)
- **상세**: `ivm.Isolate.createSnapshot([{ code: DAYJS_LOAD_SCRIPT }])` 는 모듈이 `require()`/`import`되는 순간 동기적으로 실행된다. isolated-vm 의 `createSnapshot` 은 V8 컨텍스트를 생성하고 JS를 컴파일·실행한 뒤 힙을 직렬화하는 무거운 작업이다. 이는 최초 모듈 로드 경로(서버 콜드 스타트, Jest 테스트 suite 등)에 측정 가능한 레이턴시를 더한다. 의도된 설계(1회성 비용 감수로 per-exec 비용 제거)이긴 하나, 모듈을 import 하는 모든 소비자 코드가 이 비용을 예측하지 못하면 모듈 초기화 지연으로 인한 의도치 않은 부작용(타임아웃, cold-start 지연 등)이 발생할 수 있다.
- **제안**: 주석에 "모듈 로드 시 동기 N ms 소요" 수준의 실측값을 명시하거나, 나중에 성능 문제가 되면 lazy initialization (첫 `execute()` 호출 시 1회) 패턴으로 전환을 고려한다. 현재 코드는 주석(`// built once at module load`)으로 의도를 충분히 명시하고 있으므로 즉각적인 수정은 불필요하다.

---

### [INFO] 프로세스 수명 동안 ArrayBuffer 메모리 점유 (전역 상태)

- **위치**: `code.handler.ts` L95 `DAYJS_SNAPSHOT` 모듈 스코프 상수
- **상세**: `ivm.ExternalCopy<ArrayBuffer>` 인스턴스가 Node.js 프로세스 수명 동안 GC 대상이 되지 않는다. 주석에 "~few hundred KB" 규모로 명시되어 있다. 이는 의도된 trade-off이고 크기도 수백 KB 수준이므로 실질적 위험은 낮다. 다만 이 ArrayBuffer는 외부에 노출되지 않으며 모듈 스코프에만 존재하므로, 의도치 않은 공유 상태 변경의 가능성은 없다 — 읽기 전용 참조로만 사용된다.
- **제안**: 현재 주석 수준으로 충분. 필요 시 프로파일링으로 실제 크기를 측정·문서화.

---

### [INFO] console.warn 추가로 인한 로그 스트림 부작용

- **위치**: `code.handler.ts` L101–104 (`catch (err)` 블록)
- **상세**: `DAYJS_SNAPSHOT` IIFE의 catch 블록에 `console.warn(...)` 이 추가되었다. 이는 createSnapshot 실패 시 Node.js 프로세스의 stderr에 출력되는 새로운 부작용이다. 기존에는 실패가 완전히 silent 했으므로, 로그 파이프라인/모니터링 시스템에서 이 warn 메시지를 받게 된다. 이는 관찰가능성(observability) 향상을 위한 의도된 변경(W-B)이므로 의도된 부작용이다. 그러나 Jest 테스트 환경에서 `jest.isolateModules` + mock으로 인위적으로 실패를 주입할 때 이 warn이 테스트 출력에 노출된다.
- **제안**: 테스트의 `jest.isolateModules` 블록에서 `jest.spyOn(console, 'warn').mockImplementation(() => {})` 로 경고 억제를 고려할 수 있으나, 현재 테스트가 warn 동작을 검증하는 목적도 있으므로 반드시 필요하지는 않다.

---

### [INFO] isolateOptions 객체의 조건부 속성 추가 패턴

- **위치**: `code.handler.ts` L380–384
- **상세**: `const isolateOptions = { memoryLimit: ... }` 후 `if (DAYJS_SNAPSHOT) isolateOptions.snapshot = DAYJS_SNAPSHOT` 로 속성을 조건부 추가한다. 이 패턴은 `isolateOptions` 가 지역 변수이므로 외부 공유 상태에 영향을 주지 않는다. `execute()` 는 async 함수이지만 `isolateOptions` 는 각 호출마다 새로 생성되므로 동시성 문제도 없다. 구조적으로 안전하다.
- **제안**: 문제 없음.

---

### [INFO] syntaxIsolate 모듈 스코프 가변 상태 — 기존 코드, 변경 없음

- **위치**: `code.handler.ts` L256 `let syntaxIsolate: ivm.Isolate | undefined`
- **상세**: 이번 변경에서 수정되지 않은 기존 전역 가변 상태. 부작용 관점에서 새로 도입된 위험 없음. 참고 목적으로 명시.
- **제안**: 해당 없음 (기존 설계 유지).

---

### [NONE] 시그니처/인터페이스 변경 없음

- **위치**: 전체 파일
- **상세**: `CodeHandler.validate()`, `CodeHandler.execute()`, `classifyCodeNodeError()` 의 공개 시그니처가 변경되지 않았다. `NodeHandler` 인터페이스 구현도 동일. 기존 호출자에 대한 브레이킹 체인지 없음.
- **제안**: 해당 없음.

---

### [NONE] 파일시스템/네트워크/환경 변수 부작용 없음

- **위치**: 전체 변경 델타
- **상세**: 추가된 코드는 파일시스템 읽기(`readFileSync`) 를 새로 도입하지 않았다 (기존 DAYJS_SOURCE의 `readFileSync`는 변경 전부터 존재). 네트워크 호출, 환경 변수 읽기/쓰기, 이벤트 발생 변경 없음.
- **제안**: 해당 없음.

---

### [NONE] 이벤트/콜백 변경 없음

- **위치**: 전체 변경 델타
- **상세**: `ivm.Callback` 주입 패턴(`__host_*`)은 변경 없음. per-exec 콜백 scope 격리(logs 배열 캡처) 동일. 스냅샷은 순수 JS 힙 상태만 포함하고 host-realm 콜백을 포함하지 않으므로 콜백 라이프사이클에 영향 없음.
- **제안**: 해당 없음.

---

## 요약

이번 변경의 핵심 부작용은 두 가지로 정리된다. 첫째, `DAYJS_SNAPSHOT` IIFE가 모듈 임포트 시점에 `ivm.Isolate.createSnapshot()`을 동기 실행하여 프로세스 콜드 스타트 비용을 증가시키는 점이다 — 이는 설계상 의도된 trade-off이며 주석으로 명시되어 있으나, 모듈 소비자 관점에서는 예측하기 어려운 blocking 부작용이다. 둘째, catch 블록의 `console.warn` 추가로 snapshot 실패 시 stderr 출력이 발생한다 — 이 역시 의도된 관찰가능성 향상이다. 공개 API 시그니처 변경, 파일시스템/네트워크/환경 변수 부작용, 이벤트·콜백 계약 변경은 없다. 모듈 스코프 `DAYJS_SNAPSHOT` ArrayBuffer는 읽기 전용 공유 상태로, 각 `execute()` 호출이 fresh isolate를 생성하므로 교차 실행 상태 누출 위험이 없다.

## 위험도

LOW
