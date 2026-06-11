---
worktree: code-node-isolated-vm
started: 2026-06-11
owner: developer
---

# P0 — code 노드 `isolated-vm` 전환 (refactor 04 C-2, M-2 흡수)

> 출처: `plan/in-progress/refactor/04-security.md` C-2 (P0 #2). 사용자 결정(2026-06-11): **옵션 A (isolated-vm) 진행**.
> `node:vm` 은 sandbox 가 아니라 `this.constructor.constructor('return process')()` 류 prototype-chain
> 탈출로 호스트(백엔드 프로세스) 장악이 가능 — DB 자격증명·`ENCRYPTION_KEY`·k8s SA 토큰·내부망 접근권 노출.
> M-2 (Promise 생성자 노출)는 본 전환에 **흡수** — isolate 격리로 Promise 를 안전하게 유지(spec §4.1 기능 약속 보존).

## 위협 모델 (spec §7.1 Rationale 에 명문화 — 선행)
code 노드 작성 권한 = **Editor+**. 플랫폼은 code 실행을 **신뢰할 수 없는 코드(untrusted)** 로 취급한다
(다중 워크스페이스 안전 posture). 따라서 host-takeover 를 **구조적으로** 차단해야 하며, V8 Isolate
경계로 host 객체가 isolate 안에 존재하지 않게 한다. (self-host 단일 테넌트 한정 가정에 기대지 않는다.)

## Feasibility (2026-06-11 실측)
- `isolated-vm@6.1.2` engines `node>=22` — 현 Dockerfile `node:24-alpine` + 로컬 `node v22.14` 모두 커버.
  **Node 버전 변경 불요**. (7.0.0 은 `node>=26` 요구라 제외 — Node 26 승급 시 재검토.)
- 네이티브 빌드: `node-gyp-build || node-gyp rebuild`. Dockerfile `deps` 스테이지가 이미
  `apk add python3 make g++` (bcrypt 컴파일용) 보유 → 추가 도구 불요. **단 alpine/musl 소스
  컴파일은 prebuilt(glibc) 부재 시 from-source** — 빌드/e2e 게이트에서 실증 필요 (아래 검증).
- 로컬 darwin: python3/make/clang 확인 → 단위 테스트 실행 가능.

## 변경

### spec (project-planner 위임 — developer 는 spec 쓰기 금지)
- `spec/4-nodes/5-data/2-code.md`:
  - §7.1 "현재 구현" 행: `node:vm` → `isolated-vm` (V8 Isolate). 로드맵 행 정리(컨테이너/gVisor 는
    다중테넌트 V8 버그 잔존 대응 후속으로 잔류).
  - §7.2 메모리 행: "강제 불가" → **128MB 하드 리밋 강제** (`memoryLimit`), `CODE_MEMORY_LIMIT`.
  - §4.1 / §7.3: async/Promise **유지** (변경 없음 — isolate 안에서 안전 제공). M-2 흡수 명시.
  - `## Rationale`: 위협 모델(Editor+ = untrusted) + isolated-vm 선택 근거 + node-gyp/musl 트레이드오프.
  - `/consistency-check --spec` BLOCK 없음 확인.

### 구현 (developer)
- `package.json`: `isolated-vm@6.1.2` dependency 추가 (+ lockfile).
- `code.handler.ts` 전면 재작성:
  - `vm.createContext`/`runInContext` → `ivm.Isolate({ memoryLimit: 128 })` + `Context`.
  - 데이터 주입(`$input`/`$vars`/`$execution`/`$node`)은 `ExternalCopy` 로 복사 주입.
  - 함수 브리지(`$helpers.*`, `console.*`)는 host 클로저를 `Reference`/`ivm.Callback` 으로 주입 —
    host 실행이라 dayjs/crypto/Buffer 사용 유지(사용자 코드 호환성 불변).
  - 표준 내장(JSON/Math/Array/Object/String/Number/Boolean/Date/RegExp/Map/Set/Error 류/parse*/
    URI*)은 **isolate 가 기본 제공** — 별도 주입 불요. 차단 대상(Reflect/Proxy/globalThis/Symbol/
    Weak*/Atomics/SharedArrayBuffer/Intl/setTimeout 등)은 부트스트랩 스크립트에서 `delete`/미제공으로 차단.
  - async/Promise: `script.run(ctx, { promise: true, timeout })` 로 isolate 내 반환 Promise 해소.
    외부 `Promise.race` wall-clock 타임아웃(`await new Promise(()=>{})` 보호)은 **유지**(이중 타임아웃).
  - 결과 반환: isolate → host 는 `ExternalCopy`/`.copy()` 로 직렬화. 직렬화 불가 값(함수 등) 처리 정의.
  - `$vars` 쓰기 동기화(§4.5): isolate 안 clone 수정 후 정상 종료 시 copy-out 하여 전체 교체. throw 시 롤백.
  - validate() 구문 체크: `isolate.compileScriptSync` 또는 경량 컴파일로 syntax pre-flight throw 유지.
  - 에러 봉투(§5.3)·정규화 코드(CODE_TIMEOUT/CODE_EXECUTION_FAILED/**CODE_MEMORY_LIMIT**)·stack
    노출(NODE_ENV) 의미 보존.
- `Dockerfile`: 도구는 충족. (필요 시 musl prebuild 실패 대비 주석/베이스 검토 — 검증 결과에 따라.)

### 테스트
- **escape PoC 회귀 (red→green)**: 기존 `code.handler.spec.ts:526` `should not expose process/require
  through $helpers.date return value` — 현재 `'has-process'`(취약) 단언을 `'no-process'` 로 전환.
  `this.constructor.constructor('return process')()` 가 isolate 에서 차단됨을 확인.
- 신규: 메모리 128MB 초과 → `CODE_MEMORY_LIMIT`. 동기 무한루프/async 무한대기 타임아웃 양쪽.
- 회귀: $helpers(date/hash/uuid/base64)·console 캡처·$vars 동기화·정상 return shape·throw 봉투·
  syntax pre-flight — 기존 단위 전부 green 유지.
- $helpers 호환 audit: dayjs·crypto·base64 가 Reference 경유로도 기존 사용자 코드와 동일 동작.

## 체크리스트
- [x] `/consistency-check --spec` — 2회: `21_03_19`(Critical 2 → 해소: 0-overview §5·§8) → `21_19_55`(C-1 user-docs 해소, C-2/C-3 false-positive `vm.Script` diff 오독 — grep 반증). 잔여 WARNING(EXECUTION_TIMEOUT legacyCode 4-spec)은 **선재 drift, 별 PR**.
- [x] spec 반영 — `2-code.md §4/§5.3/§6/§7.1/§7.2/§7.3/Rationale`, `0-overview §5`, `3-error-handling §1.4/§3.2`, `chat-channel-adapter §3.2`, `error-codes.ts` CODE_MEMORY_LIMIT, user-docs `data.mdx`/`data.en.mdx`.
- [x] isolated-vm@6.1.2 의존성 + 핸들러 전면 재작성 + 테스트(+2 신규: escape flip·메모리). dayjs in-isolate, `$helpers`/console host Callback 브리지, ExternalCopy 데이터, JSON copy-out.
- [x] TEST WORKFLOW — lint ✅ · unit ✅ (backend 6610) · build ✅ · **e2e ✅ (alpine/musl isolated-vm 컴파일·부팅 실증 — `backend:latest` 빌드+Healthy)**
- [x] `/ai-review` + fix — 2세션: `21_33_46`(전체 branch, HIGH/C2 → C#1 i18n·C#2 user-docs(기반영) + W 9건 resolution-applier fix `74d312cf`) → `22_03_15`(증분, **MEDIUM/0 Critical/4 W** → RESOLUTION: W1 후속·W2/W3/W4 수용). 후속 분리 = `code-node-isolated-vm-followups.md`.
- [x] `/consistency-check --impl-done` **BLOCK: NO** (`review/consistency/2026/06/11/22_04_01/`). WARNING 은 classifier noise-log(W1, 후속)·spec 표현·plan stale·main-baseline FP(C-2 체크박스·0-overview §5 — git 반증). Critical 0.

> **운영 영향 (사용자 검토 포인트)**: (1) 네이티브 의존성 추가 — CI 이미지 빌드 시 1회 컴파일(배포시점
> 0). **alpine/musl 소스컴파일 실증 통과 — Dockerfile 베이스(`node:24-alpine`) 변경 불요**(기존
> `python3 make g++` deps 로 충분). (2) isolated-vm `6.x`(node≥22). `7.x`는 node≥26 요구라 Node 26
> 승급 시 재검토. (3) code 노드 실행 latency·메모리 프로파일 변화 가능(per-exec dayjs 컴파일 — 후속 snapshot 최적화 여지).

## Rationale
옵션 A — 위협의 핵심이 "Editor 권한 → 호스트 장악" 이라 D(문서화+frozen-prototype 단기완화)는 다중
테넌트에서 수용 불가, B(worker_threads)는 같은 주소공간이라 격리 강도 미개선. A 는 spec 로드맵이 이미
지정한 경로(`2-code.md §7.1`)라 spec 개정 부담이 최소이고 prototype-chain 탈출을 구조적으로 차단한다.
k8s 배포에서 네이티브 빌드 단점은 CI 이미지 1회 빌드로 흡수되어 배포시점 복잡도가 0 — 별 Deployment
분리(RPC·서비스 디스커버리)보다 운영 표면이 작다. C(gVisor) 는 V8 버그 잔존까지 막아야 할 다중테넌트
확장 시점의 후속 강화로 남긴다.
