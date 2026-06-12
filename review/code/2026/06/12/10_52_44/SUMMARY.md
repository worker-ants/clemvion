# Code Review 통합 보고서

## 전체 위험도
**LOW** — dayjs 힙 스냅샷 성능 최적화(per-exec 재컴파일 제거)로 기능·보안 계약은 유지됨. Critical 발견 없음. Warning 3건(fallback 미테스트, isolate 옵션 중복, BOOTSTRAP_SOURCE 재컴파일)은 모두 수정 가능한 코드 품질 이슈이며 운영 차단 수준 아님.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `DAYJS_SNAPSHOT === undefined` fallback 분기 직접 단위 테스트 부재 — 모듈 상수 구조상 테스트 환경에서 snapshot path만 실행되어 `if (!DAYJS_SNAPSHOT)` 분기는 사실상 미검증 dead code | `code.handler.ts` L1498 `if (!DAYJS_SNAPSHOT)` 분기 | `jest.resetModules()` + module mock으로 `DAYJS_SNAPSHOT`을 `undefined`로 설정한 describe 블록 추가; 최소한 "fallback path not exercised in unit tests" 주석 명시 |
| 2 | Maintainability | isolate 생성 분기에서 옵션 객체 중복 — 스냅샷/비스냅샷 양 분기 모두 `new ivm.Isolate({ memoryLimit: ISOLATE_MEMORY_LIMIT_MB })`를 개별 기술; `memoryLimit`이나 공통 옵션 변경 시 두 곳 동시 수정 필요 | `code.handler.ts` `execute()` 내 isolate 생성 분기 | 공통 옵션 객체를 먼저 구성하고 조건부로 `snapshot` 추가: `const opts: ivm.IsolateOptions = { memoryLimit: ISOLATE_MEMORY_LIMIT_MB }; if (DAYJS_SNAPSHOT) opts.snapshot = DAYJS_SNAPSHOT; new ivm.Isolate(opts);` |
| 3 | Performance | `BOOTSTRAP_SOURCE` 매 exec마다 `compileScript()` + `run()` — dayjs 재컴파일은 제거됐으나 약 70 LoC의 BOOTSTRAP_SOURCE IIFE는 여전히 per-exec 재컴파일됨; `ivm.Script`를 모듈 레벨에서 1회 컴파일해 재사용하면 추가 파싱 비용 제거 가능 | `code.handler.ts` L1501 `await (await isolate.compileScript(BOOTSTRAP_SOURCE)).run(ctx)` | 모듈 로드 시 `compileScriptSync`로 미리 컴파일하거나 cross-isolate 재실행 지원 여부 확인 후 적용; 미지원 시 현 구조 유지 + 주석에 이유 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec §4 step 3에 snapshot 최적화 경로 미기술 — 코드는 `DAYJS_SNAPSHOT` 유무에 따른 두 경로로 동작하나 spec은 bare isolate 경로만 기술 | `spec/4-nodes/5-data/2-code.md` §4 step 3 | 코드 유지; spec §4 step 3을 snapshot/fallback 두 경로를 모두 기술하도록 project-planner 위임으로 갱신 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] spec §7.1 격리 방식 설명에 `createSnapshot` 메커니즘 미언급 — per-exec isolate 불변은 동일하나 구현 서술 간격 | `spec/4-nodes/5-data/2-code.md` §7.1 | spec §7.1에 스냅샷 사용 시 dayjs 재컴파일 없이 per-exec isolate 생성하나 메모리 격리·dispose 불변 동일함을 1줄 참고 노트 추가 (project-planner 위임) |
| 3 | Performance / Observability | `DAYJS_SNAPSHOT` 생성 실패 시 silent fallback — `catch { return undefined }` 로 조용히 폴백, 운영 환경에서 성능 저하 자동 감지 불가 | `code.handler.ts` DAYJS_SNAPSHOT IIFE `catch` 블록 | `console.warn('[CodeHandler] dayjs snapshot creation failed — falling back to per-exec compile:', err)` 추가 |
| 4 | Testing | `stays consistent across many sequential executions` 루프 내 중간값 검증 생략 — 25회 루프 중 각 반복에서 `meta.success`만 확인; 마지막 실행(i=24)만 `output` 값 검증 | `code.handler.spec.ts` snapshot 일관성 테스트 루프 | 루프 내 `expect(result.output).toBe(dayjs('2020-01-01').add(i,'day').format('YYYY-MM-DD'))` 추가; 또는 대표 구간(i=0,12,24)만 선택 검증 |
| 5 | Architecture | `execute()` 메서드 과도한 책임 집중(8+ 책임, 150줄) — 이번 변경으로 isolate 생성 분기·dayjs 로드 조건 추가되어 복잡도 증가; plan W4 (`_buildIsolateContext()` 분리) 미완료 | `code.handler.ts` `CodeHandler.execute()` 전체 | plan W4(`_buildIsolateContext()` / `_runWithTimeout()` 추출) 조기 진행; snapshot 분기를 `_buildIsolateContext()` 내부로 캡슐화하면 `execute()` 분기 복잡성 감소 |
| 6 | Architecture | 모듈 수준 전역 가변 상태(`syntaxIsolate`, `DAYJS_SNAPSHOT`) — `CodeHandler` 클래스 외부에 존재해 SRP 경계 흐림; 다중 인스턴스 생성 시 암묵적 공유 | `code.handler.ts` 모듈 최상단 | 장기적으로 `syntaxIsolate`를 private static 멤버로, `DAYJS_SNAPSHOT`을 `CodeIsolateFactory` 책임으로 분리; W4와 함께 수행 권장 |
| 7 | Documentation | `DAYJS_LOAD_SCRIPT` 상수 dual-use 관계 주석 미기술 — snapshot bootstrap 입력 + fallback per-exec 컴파일 두 곳에서 사용됨을 현재 주석이 설명하지 않음 | `code.handler.ts` `DAYJS_LOAD_SCRIPT` 상수 | 주석에 `// Used both as the snapshot bootstrap script (DAYJS_SNAPSHOT) and as the per-exec legacy compile fallback when createSnapshot is unavailable.` 추가 |
| 8 | Documentation | 테스트 `describe` 블록 상단 7줄 블록 주석이 `spec.ts`에 중복 존재 가능 — diff와 전체 파일 컨텍스트 양쪽에 동일 내용이 보임 | `code.handler.spec.ts` lines 786-793 | 파일 전체 확인 후 중복 블록 주석 하나로 제거 |
| 9 | Documentation | `DAYJS_SNAPSHOT` 블록 주석에 스냅샷 ArrayBuffer 메모리 상주 비용 미언급 | `code.handler.ts` DAYJS_SNAPSHOT 블록 주석 | `// The snapshot ArrayBuffer lives for the lifetime of the Node.js process (~N KB); it is not GC'd between requests.` 1줄 추가 |
| 10 | Performance | 사용자 코드 `compileScript()` 매 exec 재실행 — 동일 코드 반복 실행 시 캐싱 불가; isolated-vm `cachedData` 옵션으로 바이트코드 LRU 캐시 중기 검토 | `code.handler.ts` L1506 | 단기 현 구조 수용; 중기적으로 `produceCachedData: true` + 코드 해시 keyed LRU 캐시 방안 검토 |
| 11 | Side Effect | 모듈 임포트 시점에 `ivm.Isolate.createSnapshot()` 동기 실행 — V8 isolate 생성이 모듈 로드의 숨겨진 비용으로 추가됨; `try/catch` fallback 있어 안전하나 side-effect 명시 필요 | `code.handler.ts` DAYJS_SNAPSHOT IIFE | 모듈 수준 side-effect임을 주석으로 명시; 이미 파일 내 주석 있어 허용 가능 |
| 12 | Testing | 메모리 한도 테스트 CI flakiness — snapshot 활성화 후 초기 힙 크기 변경으로 `CODE_MEMORY_LIMIT` 테스트 통과율 영향 가능성 | `plan/in-progress/code-node-isolated-vm-followups.md` 테스트 섹션 | snapshot 활성화 후 `CODE_MEMORY_LIMIT` 테스트 CI 통과율 모니터링 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | N/A (output_file 없음 — 재시도 필요) | — |
| performance | LOW | BOOTSTRAP_SOURCE 매 exec 재컴파일(WARNING), 사용자 코드 캐시 부재(INFO), fallback silent(INFO) |
| architecture | LOW | execute() 복잡도 증가(INFO), 모듈 전역 상태(INFO), silent fallback 관측 불가(INFO) |
| requirement | NONE | SPEC-DRIFT 2건(INFO), 테스트 루프 중간값 미검증(INFO) — Critical/Warning 없음 |
| scope | NONE | 변경 범위 의도와 정확히 일치 — 발견사항 없음 |
| side_effect | LOW | 모듈 임포트 시 IIFE 동기 실행(WARNING), 공유 상수 수명 정책(INFO) |
| maintainability | LOW | isolate 옵션 객체 중복(WARNING), silent fallback 로깅 부재(INFO), execute() W4 미완료(INFO) |
| testing | LOW | fallback 분기 미테스트(WARNING), 루프 내 중간값 미검증(INFO), 테스트 용이성(INFO) |
| documentation | NONE | 모두 INFO 수준 — DAYJS_LOAD_SCRIPT dual-use 미기술, 중복 주석, JSDoc 누락 |
| concurrency | NONE | DAYJS_SNAPSHOT ExternalCopy 동시성 안전(INFO), syntaxIsolate 단일 스레드 전제 명시 권장(INFO) |

---

## 발견 없는 에이전트

- **scope**: 변경 범위가 단일 목적(per-exec dayjs 재컴파일을 스냅샷으로 대체)에 완전히 부합. 불필요한 리팩토링·기능 확장·무관 변경 없음.

---

## 권장 조치사항

1. **(WARNING — Testing)** `DAYJS_SNAPSHOT` fallback 분기 테스트 커버리지 추가 또는 "fallback path not exercised in unit tests" 주석 명시 (`code.handler.spec.ts`)
2. **(WARNING — Maintainability)** isolate 옵션 객체 중복 제거 — 공통 `isolateOptions` 객체 구성 후 조건부 `snapshot` 추가 패턴으로 리팩터 (`code.handler.ts` `execute()`)
3. **(WARNING — Performance)** `BOOTSTRAP_SOURCE` `compileScript()` 재사용 가능성 검토 — 모듈 레벨 `compileScriptSync` 사전 컴파일 or cross-isolate 재실행 지원 여부 확인 (`code.handler.ts`)
4. **(INFO — Observability)** `DAYJS_SNAPSHOT` IIFE `catch` 블록에 `console.warn` 추가로 운영 환경 fallback 가시화 (다수 reviewer 공통 지적)
5. **(INFO — SPEC-DRIFT)** spec §4 step 3 및 §7.1에 snapshot 경로 기술 추가 — project-planner 위임
6. **(INFO — Testing)** `stays consistent` 루프 내 중간값 검증 보강 — 루프 전체 또는 대표 구간(i=0,12,24) `output` 값 검증
7. **(INFO — Maintainability/Architecture)** plan W4(`_buildIsolateContext()` / `_runWithTimeout()` 분리) 조기 진행 — snapshot 분기 추가로 `execute()` 복잡도가 임계점에 근접
8. **(INFO — Documentation)** `DAYJS_LOAD_SCRIPT` dual-use 주석 보강, 중복 describe 블록 주석 정리, `wrapUserCode` JSDoc 형식 정비
9. **(INFO — Security)** security reviewer output_file 없음 — 재실행 필요

---

## 라우터 결정

- `routing_status=done` (router가 선별):
  - **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency` (10명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
  - **제외**: 4명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 선별 제외 |
  | database | router 선별 제외 |
  | api_contract | router 선별 제외 |
  | user_guide_sync | router 선별 제외 |

> **비고**: `security` reviewer는 `status=success`로 기록됐으나 `output_file`(`security.md`)이 디스크에 존재하지 않아 내용을 읽을 수 없었습니다. 재시도 필요 1건.