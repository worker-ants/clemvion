---
worktree: (unstarted)
started: 2026-06-11
owner: developer
---

# Follow-ups — code 노드 isolated-vm 전환 후속

> 출처: `code-node-isolated-vm` PR 의 ai-review(`review/code/2026/06/11/21_33_46`, `22_03_15`) +
> `--impl-done`(`review/consistency/2026/06/11/22_04_01`) 의 Warning/INFO 중 본 P0 범위 밖으로
> 분리한 항목. 본 PR 은 0 Critical · BLOCK:NO 로 종결했고, 아래는 noise-log·문서정확화·테스트보강·
> 선택적 리팩터 수준(기능·보안 영향 없음).

## 코드

- [x] **W1 — `CODE_MEMORY_LIMIT` classifier 등재**: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` `INTERNAL_CODES` Set 에 `'CODE_MEMORY_LIMIT'` 추가 (`spec/conventions/chat-channel-adapter.md §3.2` executionFailedInternal 과 일치). 현재도 unknown-fallback 이 동일하게 `executionFailedInternal` 반환하므로 UX 정상 — 차이는 CCH-ERR-04 warn 로그 제거뿐. `§3.1` 분류 표에도 명시. **(완료, PR errcode-wiring)**: `HTTP_BLOCKED` 도 함께 등재(전 인증 SSRF 차단). spec §3.1 표는 이미 두 코드를 internal 로 열거 중 → 코드가 spec 을 따라잡은 것이라 spec 변경 불요. classifier spec 에 no-warn 회귀 테스트 추가.
- [x] **W2 — `classifyError` 명명/마커**: `code.handler.ts` export `classifyError` → `classifyCodeNodeError` rename(또는 `@internal` JSDoc). cafe24/makeshop provider 의 동명 private 메서드와 전역검색 혼동 완화. **(완료, PR errcode-wiring)**: rename + `@internal` JSDoc 둘 다 적용. spec 호출처 10곳 갱신.
- [x] **INFO — `LEGACY_TO_NORMALIZED` fallthrough**: `?? errorCode` → `?? 'CODE_EXECUTION_FAILED'` 기본값(미상 내부코드 공개API 노출 방지). `Object.freeze`/`as const satisfies` 적용. 모듈 상수 선언을 파일 상단으로 이동. `RE_*` regex 모듈 상수화(이미 일부 적용). **(완료, PR errcode-wiring)**: `?? ErrorCode.CODE_EXECUTION_FAILED` 기본값 + `Object.freeze` + `Readonly<Record<string, ErrorCodeValue>>` 타입(값을 실제 ErrorCode 멤버로 고정). `RE_*` 는 이미 모듈 상수. ai-review Warning(상수 선언이 사용처보다 아래) 반영 → `RE_*`·`LEGACY_TO_NORMALIZED`·`classifyCodeNodeError` 블록을 `CodeHandler` 클래스 선언 이전으로 이동(논리적 응집).
- [x] **W4 — `execute()` 헬퍼 분리**: `_buildIsolateContext()` / `_runWithTimeout()` 추출 (오케스트레이션만 남김). 기능 무관 가독성. **(완료, PR code-followups-impl)**: `_buildIsolateContext`(ctx 생성+데이터/host 콜백 주입+dayjs 복원/컴파일+BOOTSTRAP, W13 순서 유지), `_runWithTimeout`(이중 타임아웃 race + timer cleanup 내부화) 추출. execute() 는 오케스트레이션만. 순수 추출 — 기존 execute 테스트 green 으로 동작 보존 확인.
- [x] **INFO — `$helpers.base64` 비문자열 일관성**: `__host_b64encode/decode` 에 `typeof !== 'string'` TypeError(hostHash 와 일관). **(spec 완료 spec PR code-followups-spec, code 완료 PR code-followups-impl)**: spec PR 에서 §2.2 에 "base64 비문자열 → TypeError, *유효하지 않은 base64 문자열* 은 best-effort 유지" 입력 타입 계약 신규 등재(consistency I7 정정 — 기존 plan 의 "spec §2.2 NOTE 의도" 는 사실 아니었음). code PR 에서 `hostB64Encode/Decode` 함수 추출 + `typeof data !== 'string'` TypeError 가드(hostHash 동형) + 단위 테스트(비문자열 encode/decode→error 포트 4건, 유효하지 않은 base64 문자열→silent 유지).
- [x] **INFO — 메모리 한도 env**: `CODE_NODE_MEMORY_LIMIT_MB` env(기본 128, clamp ≤512MB). **(spec 완료 spec PR code-followups-spec, code 완료 PR code-followups-impl)**: spec PR 에서 §7.2/§5.3.3 + 외부 3문서 동기화 + Rationale. code PR 에서 `resolveMemoryLimitMb()`(env 파싱·기본 128·clamp ≤512·invalid/clamp 시 console.warn) 로 `ISOLATE_MEMORY_LIMIT_MB` 교체 + error-codes/classifier 주석 + `.env.example` 등재 + frontend(backend-labels·data.mdx/en) 동기화 + 단위 테스트 9건.
- [x] **성능 — per-exec dayjs 재컴파일 제거**: `ivm.Isolate.createSnapshot()` 로 dayjs 정적부 1회 스냅샷 → 동시 실행 다수 시 컴파일 오버헤드 제거. **(완료, PR code-snapshot-perf 그룹4)**: 스냅샷에는 **dayjs UMD 만** 베이크(`DAYJS_SNAPSHOT` 모듈 상수, `createSnapshot([{code: DAYJS_LOAD_SCRIPT}])`). per-exec 는 여전히 `new ivm.Isolate({ snapshot })` 로 fresh isolate 생성(메모리 격리·dispose 불변) + `BOOTSTRAP_SOURCE` 를 그대로 실행 — host 콜백(`__host_*`, per-exec `logs` 캡처)·§7.3 위험 global 삭제는 스냅샷에 넣을 수 없어 **per-exec 유지**, W13 capture-then-delete 순서 불변. 스냅샷 미지원/실패 시 `DAYJS_LOAD_SCRIPT` per-exec 컴파일 fallback. 신규 단위 테스트 5건(dayjs parity·25회 연속 일관성·교차실행 dayjs 프로토타입 오염 비캡처·logs/$input per-exec 비누적·§7.3 하드닝 스냅샷 경로 유지). 간이 벤치(N=200 isolate 생성+dayjs 셋업): legacy 0.898ms/exec → snapshot 0.662ms/exec (**1.36x, per-exec ~0.24ms 절감**, 순수 dayjs 재컴파일 제거분).

## 테스트
- [x] `classifyCodeNodeError` null/undefined 케이스, `console.warn`/`console.error` 캡처(`[warn]`/`[error]` prefix), `syntaxIsolate` disposed 재생성 경로, `$vars` copy-out 실패 fallback 직접 검증. **(완료, PR test-code-http-hardening 그룹3)**: null/undefined·explicit, console.warn/error+ordering, `$vars` 비직렬화 값 copy-out 실패→snapshot 복원, validate 공유 isolate reuse 내성(disposed 분기는 module-private 라 결정적 트리거 불가 — 방어 코드로 명시) 추가.
- [x] 메모리 초과 통합 테스트 CI flakiness 완화(`jest.retryTimes` 또는 `@slow` 분리). **(완료, PR code-followups-impl)**: `execute — memory limit` describe 에 `beforeAll(() => jest.retryTimes(2))` + `afterAll(() => jest.retryTimes(0))` — 메모리 한도 도달이 CPU 타임아웃과 race 하는 간헐 실패를 describe 한정 retry 로 흡수(다른 suite 비영향).

## Spec (planner)
- [x] **§4 step2/step6 정확화**: step2 래핑을 실제 2-단(outer async IIFE + inner `__user`, isolate 경계 JSON 직렬화) 으로, step6 `$vars` 동기화를 "격리 환경 최종 `$vars` 읽어 전체 교체, copy-out 실패 시 varsClone fallback" 으로. **(완료, PR spec-errcode-catalog 그룹2a)**
- [x] **런타임 에러 라인 오프셋**: §4 또는 §2 에 "런타임 에러 라인 = 래퍼 헤더 3줄 오프셋" 명시. **(완료, 그룹2a — +3 명시)**. ⚠ **code 후속(별도 code PR)**: `code.handler.ts` `wrapUserCode` 의 W14 주석이 "4-line header / offset +4 / subtract 4" 로 적혀 있으나 실제 헤더는 3줄 → 오프셋 **+3** 이 맞음. 주석 off-by-one 버그 — 그룹3(code/test) 또는 별도 code PR 에서 +3 으로 수정. **(완료, 그룹3)**: W14 주석을 "3-line header / offset +3 / subtract 3" 로 수정 + spec §4 step2 참조. 오프셋은 문서용(코드에 라인 보정 로직 없음).
- [x] **§5.3.1/§5.3.2/§5.3.3 예시 정합**: §5.3.1 stack 예시에 "비프로덕션 한정" 보조노트, §5.3.3 `meta.durationMs` 추가. **(완료, 그룹2a)**. (§5.3.2 stack 플레이스홀더 `"..."` 는 cosmetic 으로 보류.)
- [x] **md5/sha1 비암호학 명시**: §2.2 에 "md5/sha1 은 체크섬·레거시 호환 전용, 암호학적 용도 금지" 1줄. **(완료, 그룹2a — 허용 알고리즘 목록 + ⚠ 경고)**
- [x] **§4 step3 / §7.1 snapshot 경로 기술 (그룹4 ai-review SPEC-DRIFT INFO #1·#2)**: **(완료, spec PR code-followups-spec)**: §4 step3 에 "dayjs 는 모듈 로드 시 `createSnapshot` 1회 베이크 후 per-exec isolate 가 스냅샷에서 복원(미지원 시 per-exec 컴파일 fallback)" 보강, §7.1 표 아래 "dayjs 스냅샷 최적화" NOTE(순수 JS 만 베이크·host wiring/§7.3 per-exec 유지·per-exec isolate dispose 불변 동일·fallback) 추가, Rationale 에 "dayjs per-exec 재컴파일 → 힙 스냅샷" 절(기각: isolate 풀 재사용·부트스트랩 스냅샷). 코드 무변경(구현은 #559 완료, spec 이 따라잡음).
- [ ] **§3-error-handling §1.4 EXECUTION_TIMEOUT 계층**: 엔진 수준 표의 `EXECUTION_TIMEOUT` 을 "내부 legacyCode — public `CODE_TIMEOUT`(node-level `error` 포트)" 로 보강. `14-external-interaction-api §547` 동반. **(보류 — 엔진레벨 EXECUTION_TIMEOUT/EXECUTION_TIME_LIMIT_EXCEEDED 계층화는 별개 영역. 그룹2a 는 internal-legacy 매핑을 error-codes.md §3.1 에 등재하는 것으로 부분 충족.)**
- [ ] **memoryLimit:128 예시값 잔재 정합화 (code-followups-impl ai-review I1 / impl-done I1 SPEC-DRIFT)**: 메모리 env 화(#561·code PR) 후 `2-code.md §4 step3`·`§7.1 표`·`4-nodes/0-overview.md §5 라인 298(실행 격리 행)` 의 `memoryLimit: 128` 예시값이 "기본 128, env 조정 가능" 정책 서술(§7.2·§5.3.3·overview 메모리 제한 행)과 표기 불일치(고정값처럼 읽힘). 모순/기능 영향 없는 cosmetic — 예시값을 `memoryLimit: ISOLATE_MEMORY_LIMIT_MB(기본 128)` 또는 `memoryLimit: <기본 128, env 조정>` 으로 정합화. **planner 위임 — spec-only 후속, 비차단 INFO** (code 무변경, code PR 범위 밖).

## 타 plan/worktree 정리 (머지 후)
- [x] `plan/in-progress/node-output-redesign/code.md` 의 `CODE_MEMORY_LIMIT` "로드맵 미구현" 서술 → "구현 완료(isolated-vm PR)". **(완료, PR plan-cleanup 그룹5)**: L82/L132/L163 모두 #546 구현 완료로 갱신(node:vm 기준 서술은 #546 이전 스냅샷임을 명시). http-request.md 도 SSRF=throw → #549 port:error 갱신 노트 추가.
- [x] `plan/in-progress/marketplace-and-plugin-sdk.md` 샌드박싱 항목 → "code 노드 isolated-vm 기도입, 재사용 검토". **(완료, 그룹5)**.
- [ ] user-docs 충돌 주의: 타 worktree(`fix-model-configs-kind-400-*` 등)에 구버전 `data.mdx` 에러코드 잔존 — 머지 시 신규 코드로 동기화. **(보류 — 타 worktree 소유 작업, 본 작업 범위 밖.)**
