---
worktree: code-followups-spec-4f035f
started: 2026-06-12
owner: project-planner
---

# Spec draft — code 노드 followups (snapshot 문서화 + base64 일관성 + 메모리 env)

> 출처: `plan/in-progress/code-node-isolated-vm-followups.md` 잔여 후속 중 **spec 변경 동반** 3건.
> 대상 spec: `spec/4-nodes/5-data/2-code.md`. code 구현은 **후속 code PR** 위임(developer).

## 변경 1 — dayjs 스냅샷 경로 문서화 (그룹4 ai-review SPEC-DRIFT INFO #1·#2)

구현(#559)에서 dayjs UMD 를 `ivm.Isolate.createSnapshot()` 으로 모듈 로드 시 1회 베이크하고
per-exec isolate 를 스냅샷에서 생성하도록 최적화했으나, spec §4·§7.1 은 bare isolate + per-exec
dayjs 컴파일 경로만 기술 → spec-impl drift. spec 을 구현에 맞춰 보강한다 (코드 변경 없음).

### 1-a. §4 실행 로직 step 3 보강

- **AS-IS** (step 3): `isolated-vm` isolate(`memoryLimit: 128`) + context 를 만들어 `script.run(..., { promise: true, timeout })` 로 실행. 이중 타임아웃을 적용한다 (§7.2).
- **TO-BE** (step 3): `isolated-vm` isolate(`memoryLimit: 128`) + context 를 만든다. **dayjs(`$helpers.date`)는 모듈 로드 시 1회 생성한 힙 스냅샷(`createSnapshot`)에서 복원되며, 스냅샷이 없는 플랫폼에서는 per-exec 로 dayjs 소스를 컴파일하는 fallback 으로 동작한다 (§7.1).** 이후 `script.run(..., { promise: true, timeout })` 로 실행하며 이중 타임아웃을 적용한다 (§7.2).

### 1-b. §7.1 격리 방식 — NOTE 1줄 추가 (표 아래 "선택 근거" 인용 다음)

> **dayjs 스냅샷 최적화**: `$helpers.date` 가 의존하는 dayjs 런타임은 매 실행 재컴파일하지 않고, 모듈
> 로드 시 `ivm.Isolate.createSnapshot()` 으로 **1회 힙 스냅샷**해 per-exec isolate 를 그 스냅샷에서
> 생성한다. 스냅샷에는 **순수 JS(dayjs)만** 포함되며 host 콜백(`$helpers` crypto/base64·`console`)·§7.3
> 전역 하드닝은 per-exec 부트스트랩에서 그대로 수행된다(스냅샷은 host 바인딩을 캡처하지 않는다).
> **per-exec isolate 생성·메모리 하드 리밋·dispose·실행 간 상태 비공유 불변은 동일하다.** `createSnapshot`
> 미지원/실패 플랫폼에서는 per-exec dayjs 컴파일로 투명하게 fallback 한다.

### 1-c. Rationale — 신규 절

`### dayjs per-exec 재컴파일 → 힙 스냅샷 (2026-06-12)` 추가:
동시 실행 다수 시 매 실행 dayjs UMD 재컴파일이 고정 비용이었다. `createSnapshot` 으로 정적 dayjs 만
1회 베이크해 제거했다(모듈 로드 1회 ~4ms, steady-state 무영향). 스냅샷에 host ref·per-exec 상태를
넣지 않아 격리·보안 계약은 불변. 기각: (a) isolate 풀 재사용 — per-exec dispose(메모리 격리) 불변
위반; (b) BOOTSTRAP 까지 스냅샷 — host 콜백/§7.3 삭제가 per-exec 상태·바인딩 의존이라 불가.

## 변경 2 — `$helpers.base64` 비문자열 입력 일관성 (TypeError)

현재 `$helpers.base64.encode/decode` 는 비문자열 인자를 `String(data)` 로 **묵시적 강제변환**하나,
`$helpers.crypto.hash` 는 비문자열 `data` 에 `TypeError` 를 던진다 → 동일 `$helpers` 표면에서 입력
계약 불일치. base64 도 비문자열 입력에 `TypeError` 를 던지도록 정렬한다.

### 2-a. §2.2 표 — base64 행 보강 + NOTE

- `$helpers.base64.encode(data)` | Base64 인코딩. **`data` 는 문자열이어야 하며, 비문자열 입력은 `TypeError` (런타임 에러 → `error` 포트)**
- `$helpers.base64.decode(data)` | Base64 디코딩. **`data` 는 문자열이어야 하며, 비문자열 입력은 `TypeError`**. 단 *유효하지 않은 base64 문자열* 은 best-effort 디코딩 결과를 반환한다(throw 없음 — Buffer 관대 디코딩).

표 아래 NOTE:
> **입력 타입 계약**: `$helpers.crypto.hash` · `$helpers.base64.*` 는 비문자열 인자에 `TypeError` 를
> 던진다(`error` 포트, `CODE_EXECUTION_FAILED`). 이는 silent 강제변환이 숨기는 타입 버그를 사용자에게
> 드러내기 위함이다. `base64.decode` 의 *유효하지 않은 base64 문자열*(타입은 문자열) 은 예외가 아니라
> best-effort 결과를 반환한다(타입 오류와 구분).

### 2-b. Rationale — 신규 절

`### $helpers 입력 타입 계약 — base64 비문자열 TypeError 정렬 (2026-06-12)`:
`$helpers` 표면 일관성. hash 는 이미 TypeError(allowlist+타입가드), base64 만 silent `String()`
강제변환이라 `base64.encode(42)` 가 조용히 `"42"` 를 인코딩 → 타입 버그 은폐. TypeError 로 정렬해
명시적 계약화. **하위호환 영향**: 비문자열을 넘기던 기존 코드는 이제 `error` 포트로 분기(이전엔 silent
처리). 영향 범위는 작고(대부분 문자열 입력), 버그 조기 노출 이득이 크다고 판단. 기각: 현행 silent
유지 — hash 와의 비대칭을 영구화하고 타입 버그를 숨김.

## 변경 3 — 메모리 한도 환경변수화

`128MB` 하드코딩을 운영자가 `CODE_NODE_MEMORY_LIMIT_MB` env 로 조정 가능하게 한다(기본 128, 안전
상한 512). 기본 동작·기본값은 불변.

### 3-a. §7.2 리소스 제한 표 — 메모리 행

- **AS-IS**: 메모리 | **128MB 하드 리밋** | `isolated-vm` isolate `memoryLimit: 128`. 초과 시 …
- **TO-BE**: 메모리 | **기본 128MB 하드 리밋 (env 조정 가능)** | `isolated-vm` isolate `memoryLimit`. 운영자는 `CODE_NODE_MEMORY_LIMIT_MB` 환경변수로 조정 가능(기본 `128`, **안전 상한 `512`** — 초과 설정은 512 로 clamp). 초과 시 isolate 가 실행을 중단하고 `CODE_MEMORY_LIMIT` 로 `error` 포트 분기

### 3-b. §5.3.3 / §7.1 표기

- §5.3.3 제목·NOTE 의 "128MB" 는 "기본 128MB" 로 (env 조정 가능 1회 각주). 예시·동작 불변.
- §7.1 표 `new ivm.Isolate({ memoryLimit: 128 })` 는 "기본 128" 주석 유지(예시값).

### 3-c. Rationale — 신규 절

`### 메모리 한도 환경변수화 (2026-06-12)`:
배포 환경별 메모리 여력이 달라 운영 튜닝 여지 필요(코드 W15 주석이 예고). 기본 128MB 불변,
`CODE_NODE_MEMORY_LIMIT_MB` 로 조정. 안전 상한 512MB clamp 로 단일 실행이 호스트 메모리를 과점하지
못하게 한다. backend-labels 의 `128MB` 메시지와 동기화 필요(code PR). 기각: 무제한 env — 단일 노드가
호스트 OOM 유발 가능.

## 후속 code PR (developer) — 본 spec PR 머지 후

- 변경 2: `__host_b64encode/decode` 에 `typeof data !== 'string'` → `TypeError` 가드(hostHash 와 동형). 단위 테스트(비문자열 encode/decode → error 포트, 유효하지 않은 base64 문자열 → silent 유지).
- 변경 3: `ISOLATE_MEMORY_LIMIT_MB` → `CODE_NODE_MEMORY_LIMIT_MB` env 파싱(기본 128, clamp ≤512) + backend-labels `128MB` 메시지 sync.
- (변경 1 은 코드 이미 구현 — spec 만 따라잡음. code 무변경.)
- 독립 항목: **W4** `execute()` 헬퍼 분리(`_buildIsolateContext`/`_runWithTimeout`), **메모리 초과 통합 테스트 CI flakiness 완화**(`jest.retryTimes`/`@slow`).

## Rationale (draft 전체)

spec 변경(snapshot 문서화·base64 계약·메모리 env)을 한 spec PR 로 묶고 code 를 후속 PR 로 분리 — SDD
정석(spec 먼저). snapshot 은 구현 완료분 문서화라 즉시 정합, base64/메모리 env 는 spec 선행 후 code 가
따라잡는 표준 패턴(그 사이 갭은 본 draft 후속 섹션으로 추적).
