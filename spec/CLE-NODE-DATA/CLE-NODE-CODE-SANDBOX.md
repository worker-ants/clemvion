---
id: "CLE-NODE-CODE-SANDBOX"
title: "Code 노드 — 샌드박스"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-NODE-CODE"
ancestors: ["CLE-VISION", "CLE-NODE", "CLE-NODE-DATA", "CLE-NODE-CODE"]
area: "CLE-NODE-DATA"
content_hash: "38fc24e33bba38966c1f982c604d32aa765dc487aa32ad3262b915cf1f1e6ec3"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "01d38542f51e2badaad30a4ccf40ed0a0acf003482596defa25d16976fae04f3"
etag: "sha256-d29529028f6f4b4ec5935bd8cadfddfaddcec2dd627905bdd5ddebd0fbb28c9d"
---
## 개요

이 문서는 [Code 노드](CLE-NODE-CODE.md) 의 하위 문서로 사용자 코드를 실행하는 샌드박스의 격리 방식, 리소스 제한, 허용·차단 API 를 정한다. 노드 샌드박스 정책([노드 시스템 구조와 카탈로그](../CLE-NODE/CLE-NODE-ARCH.md))을 이 노드에 적용한 세부 규칙이다. 래퍼 · `$vars` 쓰기 · 출력 · 에러 형식은 부모 문서가 정한다.

## 격리 방식

| 방식 | 설명 |
|------|------|
| **현재 구현: `isolated-vm`(V8 Isolate)** | `new ivm.Isolate({ memoryLimit: ISOLATE_MEMORY_LIMIT_MB })`(`resolveMemoryLimitMb()`, 기본 128MB, `CODE_NODE_MEMORY_LIMIT_MB` 로 조정·상한 512)로 호스트와 분리한 별도 V8 Isolate 에서 코드를 실행한다. 호스트 객체와 전역(`process`·`require`·`global`·`Buffer`·`fetch`)이 isolate 안에 **없으므로** prototype chain 탈출(`this.constructor.constructor('return process')()` 류)이 구조적으로 막힌다. 데이터(`$input`·`$vars`·`$execution`·`$node`)는 `ExternalCopy` 로 복사해 넣고, 내장 유틸(`$helpers`)과 `console` 은 호스트 클로저를 `Reference`·`ivm.Callback` 으로 잇는다(호스트 realm 에서 실행). 표준 내장(JSON·Math·Array 등)은 isolate 가 기본 제공한다. `eval`·`new Function` 은 부트스트랩에서 막고, 동적 `import`·모듈 로더를 제공하지 않아 모듈을 로드할 수 없다 |
| 로드맵(선택): 컨테이너·gVisor | 다중 테넌트로 넓혀 V8 자체 버그에 의한 isolate 탈출까지 막아야 하면 Docker·gVisor 프로세스·커널 수준 격리로 더 강화한다 |

**dayjs 스냅샷 최적화**: `$helpers.date` 가 쓰는 dayjs 런타임은 매 실행마다 다시 컴파일하지 않는다. 모듈 로드 때 `ivm.Isolate.createSnapshot()` 으로 **한 번 힙 스냅샷**을 만들고, 실행마다 그 스냅샷에서 isolate 를 만든다. 스냅샷에는 **순수 JS(dayjs)만** 들어간다. 호스트 콜백(`$helpers` crypto·base64, `console`) 연결과 아래 전역 차단은 실행마다 부트스트랩에서 그대로 한다(스냅샷은 호스트 바인딩을 담지 않는다). **실행마다 isolate 를 만들고, 메모리 하드 리밋을 걸고, 끝나면 버리고, 실행 사이에 상태를 공유하지 않는다는 불변식은 같다.** `createSnapshot` 을 지원하지 않거나 실패하는 플랫폼에서는 실행마다 dayjs 를 컴파일하는 경로로 투명하게 돌아간다.

## 리소스 제한

| 항목 | 제한 | 설명 |
|------|------|------|
| 타임아웃 | 기본 30초(1~120초) | isolate `script.run(..., { timeout })`(CPU 동기 무한 루프 보호)과 바깥 `Promise.race`(비동기 무한 대기 보호)를 **둘 다** 건다 |
| 메모리 | **기본 128MB 하드 리밋(환경 변수로 조정)** | isolate `memoryLimit`. 운영자는 `CODE_NODE_MEMORY_LIMIT_MB` 로 조정한다(기본 `128`, **안전 상한 `512`**, 넘으면 512 로 자른다). 넘으면 isolate 가 실행을 멈추고 `CODE_MEMORY_LIMIT` 로 `error` 포트에 보낸다 |
| 네트워크 | 완전 차단 | `fetch`·`XMLHttpRequest`·`WebSocket` 을 넣지 않는다 |
| 파일시스템 | 접근 불가 | `fs`·`path`·`child_process` 등을 넣지 않는다 |
| 모듈 | require·import 불가 | 모듈 로더를 제공하지 않는다. 내장 유틸리티만 전역에 넣는다 |
| 전역 객체 | 제한된 전역만 허용 | 아래 "허용·차단 API" |

## 허용·차단 API

허용(전역 주입):

| API | 설명 |
|-----|------|
| `$input`, `$vars`, `$execution`, `$node` | 실행 컨텍스트 객체 |
| `$helpers` | 내장 유틸리티 |
| `console.log/warn/error` | 디버그 로그(최대 100줄 캡처) |
| `JSON.parse`, `JSON.stringify` | JSON 처리 |
| `Array`, `Object`, `String`, `Number`, `Boolean`, `Date`, `RegExp`, `Map`, `Set` | 기본 내장 객체 |
| `Math`, `parseInt`, `parseFloat`, `isNaN`, `isFinite` | 수학·파싱 |
| `encodeURIComponent`, `decodeURIComponent` | URI 인코딩 |
| `Promise`, `async/await` | 비동기 처리 |
| `Error`, `TypeError`, `RangeError`, `SyntaxError` | 예외 클래스 |

차단은 두 방식이다(`code.handler.ts` 부트스트랩).

1. **부재**(호스트 realm 에 있어 참조하면 `ReferenceError`): `require`·`import`·`fetch`·`fs`·`process`·`Buffer`·`global` 같은 Node 호스트 전역과 모듈은 isolate 안에 **처음부터 없다**. isolate 에 넣지 않는 한 닿을 수 없다(탈출 차단의 핵심).
2. **부트스트랩 삭제**(`delete`): V8 Isolate 가 기본 제공하는 ECMAScript 내장 중 비결정성·메타프로그래밍·동적 실행 위험이 있는 것(`eval`·`Function`·`Reflect`·`Proxy`·`Symbol`·`WeakMap`·`WeakSet`·`WeakRef`·`FinalizationRegistry`·`Atomics`·`SharedArrayBuffer`·`Intl`·`setTimeout`·`setInterval`·`setImmediate`·`queueMicrotask`·`globalThis`)은 코드 실행 전에 부트스트랩 스크립트가 전역에서 지운다.

| API | 차단 방식 | 차단 이유 |
|-----|-----------|-----------|
| `require`, `import` | 부재(호스트 realm) | 외부 모듈 로드 방지 |
| `fetch`, `XMLHttpRequest`, `WebSocket` | 부재(호스트 realm) | 네트워크 접근 차단 |
| `fs`, `path`, `os`, `child_process` 등 Node.js 모듈 | 부재(호스트 realm) | 시스템 접근 차단 |
| `process`, `global`, `Buffer` | 부재(호스트 realm) | 런타임 환경 접근 차단(isolate 밖이라 prototype chain 으로도 닿지 않음) |
| `eval`, `Function` 생성자 | 부트스트랩 삭제 | 동적 코드 실행 방지 |
| `globalThis`, `Symbol` | 부트스트랩 삭제 | 런타임 환경 접근·메타프로그래밍 방지 |
| `Reflect`, `Proxy` | 부트스트랩 삭제 | 메타프로그래밍 방지 |
| `WeakMap`, `WeakSet`, `WeakRef`, `FinalizationRegistry`, `Atomics`, `SharedArrayBuffer`, `Intl` | 부트스트랩 삭제 | 비결정성·realm 사이 누출 방지 |
| `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask` | 부트스트랩 삭제 | 비결정적 스케줄링 차단(`Promise.race` 타임아웃 흐름 단순화) |

## 구현 위치

- `codebase/backend/src/nodes/data/code/code.handler.ts` (isolate 생성 · dayjs 스냅샷 · 부트스트랩 전역 차단 · `resolveMemoryLimitMb()`)

## Rationale

### 격리 방식을 `isolated-vm` 으로 전환 (2026-06-11)

**위협 모델**: Code 노드를 만들 권한은 편집자 이상이다. 플랫폼은 Code 노드의 사용자 코드를 **신뢰할 수 없는 코드**로 다룬다(여러 워크스페이스에서 안전해야 하며 셀프 호스팅 단일 테넌트 가정에 기대지 않는다). 그래서 사용자 코드가 호스트(백엔드 프로세스)를 장악하는 경로를 구조적으로 막아야 한다. 호스트 프로세스 메모리에는 DB 자격 증명, `ENCRYPTION_KEY`, 배포 환경의 서비스 토큰, 내부망 접근권이 있으므로 호스트 realm 에 닿으면 곧 인증 우회·시크릿 탈취·SSRF 로 이어진다.

**기존 `node:vm` 의 한계**: `node:vm` 은 전역을 넣지 않아(`process`·`require`·`Buffer` 등) 모듈 로드·네트워크·파일시스템을 막았다. 하지만 샌드박스와 호스트가 **같은 V8 realm** 을 공유해 `this.constructor.constructor('return process')()` 같은 prototype chain 으로 호스트의 `Function` 생성자에 닿고, 호스트 realm 객체(`process` 등)를 얻는 탈출이 가능했다. 이전 스펙이 "완벽한 탈출 방어는 불가하며 나중에 `isolated-vm` 등으로 재검토" 라고 이미 적어 둔 트레이드오프다.

**결정**: 사용자 결정(2026-06-11)으로 스펙 로드맵이 지목한 `isolated-vm`(V8 Isolate)으로 바꿔 그 로드맵 항목을 끝냈다. Isolate 는 호스트와 **별도의 V8 힙·realm** 을 가지므로 호스트 객체가 isolate 안에 없고, prototype chain 탈출이 성립하지 않는다. 덤으로 isolate 단위 메모리 하드 리밋(128MB, `CODE_MEMORY_LIMIT`)과 CPU 타임아웃을 강제할 수 있다. vm 샌드박스에 `Promise` 생성자가 노출돼 있던 별도 위험도 함께 흡수했다. `Promise`(async/await)는 기능 약속이라 **유지**하고, 격리 층이 그로 인한 탈출 경로를 무력화한다.

기각한 대안:

- **`worker_threads` 권한 박탈**: worker 는 호스트와 같은 프로세스 주소 공간을 공유하는 보안 경계가 아니라서 격리 강도를 본질적으로 높이지 못한다.
- **컨테이너·gVisor 즉시 전환**: 격리는 가장 강하지만 노드를 실행할 때마다 컨테이너를 띄워야 하고 런타임 의존(셀프 호스팅 부담)이 커서 운영 복잡도에 비해 과하다. V8 자체 버그에 의한 isolate 탈출까지 막아야 하는 다중 테넌트 확장 때의 후속 강화로 로드맵에 남긴다.
- **현상 유지 + frozen prototype 임시 완화**: 우회 경로가 많아 근본 차단이 아니고 여러 워크스페이스 환경에서 받아들일 수 없다.

**트레이드오프**: 네이티브 빌드(node-gyp) 의존성이 생긴다. CI 이미지 빌드 때 한 번 컴파일하면 되므로 배포 시점 복잡도는 없지만, 빌드 환경(alpine·musl 포함)에 C++ 툴체인이 필요하다. `$helpers`·`console` 은 호스트 클로저를 `Reference`·`ivm.Callback` 으로 이어 호스트 realm 에서 실행하므로 기존 사용자 코드(dayjs·crypto·base64)와의 호환이 유지된다. isolated-vm 은 `7.x` 를 쓴다. `7.x` 의 engines 는 `node>=24` 이고 Node 24 · 26 용 prebuild(ABI 137 · 147, glibc · musl)를 함께 배포한다. 여기서 `node>=24` 는 라이브러리 지원 범위일 뿐이며, 프로젝트 런타임 하한은 `PROJECT.md` 버전·도구 정책(내부 앱 `>=26`)을 따른다. Node 메이저를 올릴 때는 그 메이저의 ABI 용 prebuild 가 있는지 먼저 확인한다(2026-10-16).

### dayjs 매 실행 재컴파일을 힙 스냅샷으로 교체 (2026-06-12)

동시 실행이 많을 때 실행마다 dayjs UMD 를 isolate 안에서 다시 컴파일하는 것이 고정 비용이었다. `ivm.Isolate.createSnapshot()` 으로 **정적 dayjs 만** 모듈 로드 때 한 번 힙 스냅샷하고 실행마다 그 스냅샷에서 isolate 를 만들어 재컴파일을 없앴다(모듈 로드 한 번에 약 4ms, 평상시 요청 지연에는 영향 없음). 스냅샷에 호스트 참조나 실행별 상태를 넣지 않으므로 격리·보안·출력 계약은 그대로다. 위 전환 결정이 세운 **실행마다 isolate 를 버리는(메모리 격리) 불변식**도 그대로다. 스냅샷은 dayjs 준비 비용만 줄이고 isolate 수명 모델을 바꾸지 않는다.

기각한 대안:

- **isolate 풀 재사용**: 실행마다 버리는(실행 사이 메모리·상태 격리) 불변식을 깬다. 스냅샷은 새 isolate 를 유지하면서 준비 비용만 줄이므로 격리 강도를 잃지 않는다.
- **부트스트랩(`$helpers`·`console` 연결 + 전역 삭제)까지 스냅샷**: 호스트 콜백은 실행별 상태(예: `console` 의 로그 버퍼)와 호스트 realm 함수에 묶여 있다. 전역 삭제는 실행별 부트스트랩 시점에 해야 "캡처한 뒤 삭제" 순서가 성립한다. `createSnapshot` 은 호스트 바인딩이 없는 빈 isolate 에서 돌아서 이 둘을 담을 수 없다.

### 메모리 한도를 환경 변수로 조정 (2026-06-12)

배포 환경마다 메모리 여유가 달라 운영 조정 여지가 필요했다. 기본 128MB 는 그대로 두고 `CODE_NODE_MEMORY_LIMIT_MB` 로 조정한다. 128MB 결정의 **의도는 실행 하나의 메모리 상한을 두는 것**이었으므로, 512MB 상한을 둔 환경 변수 조정은 그 결정의 번복이 아니라 운영 확장이다. 안전 상한 512MB 로 실행 하나가 호스트 메모리를 독차지하지 못하게 한다. 기각: 상한 없는 환경 변수는 노드 하나가 호스트 OOM 을 일으킬 수 있다.
