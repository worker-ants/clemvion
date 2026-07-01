# Refactor 백로그 — 코드베이스 전수 다관점 감사 (2026-06-10)

> 7개 관점(성능·아키텍처/확장성·유지보수성/가독성·보안·데이터베이스·동시성·의존성) sub-agent 가
> `codebase/**` 프로덕션 코드 전수를 분석한 리팩토링 백로그. diff 리뷰가 아닌 **현재 상태 전수 감사**다.
> **2026-06-10 spec 전수 대조 완료**: 전 항목을 `spec/**`(Rationale 포함)·관련 plan·코드 사실관계와 대조해
> 의도된 설계 여부를 판정하고, 항목별 개선 방안(단계·검증·회귀 위험·spec 갱신 필요)을 보강했다.
> **2026-06-10 옵션 비교·권장안 보강**: 유효 91건 전부에 옵션별 장단점·트레이드오프 표 + 권장안·사유를 추가.
> 본문 권장이 본 README 의 초기 권고와 달라진 항목은 **본문이 우선** (아래 표는 동기화됨).

## 산출 경위

- 분석: 2026-06-10, 기준 브랜치 `claude/plan-complete-turn-timing-aa533b` (main 동등). 관점별 reviewer 7개 병렬 fan-out.
- spec 대조: 같은 날 2차 fan-out — 항목별 판정 **A**(의도된 설계)/**B**(spec 무언급)/**C**(spec 괴리·드리프트)/**D**(부분 언급 — 본 쟁점 미결정)/**E**(철회 — 사실관계 오류).
- 대상: `codebase/backend`(1,022 파일)·`frontend`(572)·`channel-web-chat`·`packages` — 테스트 제외.

## 관점별 문서 + 집계 (spec 대조 + 처리상태 반영, 2026-06-24 동기화)

| 문서 | 원 건수 | 완료 | 철회·종결 | 잔여(미완) | ⚠️ A-잔존 | 핵심 주제 |
| --- | --- | --- | --- | --- | --- | --- |
| [01-performance.md](./01-performance.md) | 15 | 10 | 5 (1철회 #9 + 4종결 #11·#12·#13·#15) | **0** | 0 | ✅ 2026-06-10 완료: 구현 10건(perf-backlog-01) + 종결 4건. spec 동기화 = `plan/complete/spec-update-perf-backlog-01.md` |
| [02-architecture.md](./02-architecture.md) | 15 | 14 | 0 | 1 | 0 | C-1(엔진분할 PR #622–627)·C-2(5클러스터 전부 #714/#716/#718~#721/#676)·C-3·M-1·M-2·M-3·M-4(#688)·M-6(#660)·M-7·M-8·M-9·m-1(+#767)·m-2·m-3 완료. 잔여: M-5 레이어2/3(per-workspace entitlement·marketplace 커스텀 노드) → [marketplace-and-plugin-sdk.md](../marketplace-and-plugin-sdk.md) §Phase D 위임(레이어1 핫스팟 해소 완료) |
| [03-maintainability.md](./03-maintainability.md) | 15 | 11 (M-6·m-2 PR #522 + M-2 API_BASE_URL + C-2 ai-turn-executor 분해 #697·2차 + C-4 WS gateway helper + m-3 integrations/new 분할 + m-1 console→Logger + m-4 catch 변수명 통일 + M-1 install 보일러플레이트 helper + **C-1·M-5 포인터 닫힘**[02 C-1·M-3 완료]) | 3 (M-3 철회 + **C-3·M-4 2026-07-01 사용자 철회**) | 1 | 0 | dead-code 제거 2건 + M-2(API_BASE_URL 3001→3011) + C-2(ai-agent god-method 분해) + C-4(WS gateway helper) + m-3(integrations/new 1444→448줄 분할) + m-1(console.*→Logger + no-console 가드) + m-4(catch 변수명 통일) + M-1(install 보일러플레이트 helper) 완료. **C-1·M-5 는 02(C-1 엔진분할·M-3 streamMessage) 포인터로 닫힘**. **C-3·M-4(cafe24/makeshop 미러)는 2026-07-01 사용자 철회 — 조기 일반화 회피, spec 의도 미러 수용**. 잔여 1: M-7(inline 타입단언 50+ 미착수) |
| [04-security.md](./04-security.md) | 14 | **14** | 0 | **0** | 0 | ✅ 2026-06-16 전 항목 종결: 코드+spec 머지(PR #570·prod-fail-closed-guards 등). isolated-vm 전환·SSRF 가드·WS authorizer |
| [05-database.md](./05-database.md) | 15 | 11 | 2 (철회 M-6·m-2) | 2 (m-4·m-5 보류) | 1 (m-5) | ✅ 핵심 11건 완료(2026-06-14 batch): rotation 원자화·partial 인덱스·CTE. m-4·m-5 보류 |
| [06-concurrency.md](./06-concurrency.md) | 15 | 5 (M-1·M-5·C-1·M-7·M-2) | 3 (철회 m-1·m-2·m-4) | 7 | 1 (C-2) | M-1·M-5·C-1·M-7·M-2(shutdown 추적 드리프트) 완료 외 7건 미착수. rehydrate 가드 |
| [07-dependency.md](./07-dependency.md) | 15 | 10 | 5 (3철회 M-1·M-3·m-3 + 2종결 m-5·m-7) | **0** | 0 | ✅ 2026-06-17 완료: C-1·C-2(deps-security-hygiene) + 잔여 8건 → [07-dependency-residual.md](./07-dependency-residual.md) |
| **합계** | **104** | **75** | **18** (12철회 + 6종결) | **11** | **2** | |

> **완료** = 구현·머지 또는 결정 종결(코드/spec 변경 동반). **철회·종결** = 코드 변경 없이 닫음 (철회=E 사실관계 반증 **또는 사용자 결정[조기 일반화 회피 등]** / 종결=no-action·현상유지). **잔여(미완)** = 미착수·진행중·보류 (`[ ]` 또는 `[~]`). **⚠️ A-잔존** = 잔여 중 spec/plan 이 의도된 설계로 문서화했으나 여전히 문제로 남은 항목 (착수·번복은 **사용자 결정 대상**; 결정 상태는 각기 다름 — 상세는 아래 「⚠️ 의도된 설계지만 문제」 절).
> 완료(75) + 철회·종결(18) + 잔여(11) = 104. 처리 종료(완료+철회·종결) = 93/104.
> 철회 항목은 삭제하지 않고 `[x]` + 철회 사유(반증 근거 또는 결정 근거)로 보존.

## spec 대조가 바꾼 주요 사실 (요약)

- **진단 정정**: 03 M-2 — 포트 불일치의 잘못된 쪽은 login/register(3011, 정답)가 아니라 **`lib/api/client.ts` 의 3001 fallback** (메인 API 클라이언트 전체가 영향 — 원안보다 심각). 07 C-1 — `@nestjs/jwt` 전이 의존 덕에 현재 프로덕션 오류 미발현(Critical→Major).
- **spec 내부 모순 발견 2건**: 04 C-3 (http-request §4 step8 "integration 만 가드" ↔ §104 "기본 차단" — 코드 주석의 정당화는 spec 근거 0건), 06 M-1 (WS `resumed` ack 의미 ↔ §7.5.1).
- **spec 자체가 갭인 케이스**: 04 M-6 — spec 이 "3채널만 소유 검증" 으로 명시해 코드는 정합하나 spec 이 IDOR 갭 보유 (`workflow:`/`notifications:` 무검증).
- **spec 드리프트(구현이 따라가야 함)**: 06 M-2 (shutdown §11.4 마킹 약속 위반), 06 M-7 (seq idempotency 계약 위반 random fallback), 06 C-3 부속 (§6.2 Redis context 행 vs in-memory 구현).

## 종합 우선순위 (P0 → P2, spec 대조 반영)

> **진행 현황 (2026-06-28)**: P0 5건 전부 ✅ 완료. P1 은 6·7·9·10·11·12 완료, 8 잔여. P2 는 13(엔진분할)·16(ai-agent 분해)·14(forwardRef — 클러스터4 #714/#716 머지로 전 클러스터 종결)·17(park-진입 dispatch M-4) 완료, 18 잔여 (15=cafe24/makeshop Base 는 2026-07-01 사용자 철회).

### P0 — 보안·데이터 정합 즉시 대응 (단독 PR) — ✅ 전건 완료

1. ~~**`authentication=none` SSRF 가드 미적용**~~ ✅ 완료 — spec §4 step8↔§104 모순 해소 동반 → [04](./04-security.md) C-3
2. ~~**code 노드 vm 탈출**~~ ✅ 완료 (isolated-vm 전환, worktree `code-node-isolated-vm`) → [04](./04-security.md) C-2
3. ~~**JWT secret fallback**~~ ✅ 완료 (M-4 ENCRYPTION_KEY·M-7 MCP insecure flag 와 단일 "production fail-closed 가드" 블록, worktree `prod-fail-closed-guards`) → [04](./04-security.md) C-1/M-4/M-7
4. ~~**refresh 토큰 rotation 원자화**~~ ✅ 완료 (worktree `auth-refresh-rotation-atomic`) → [05](./05-database.md) C-1
5. ~~**hono CVE override 상향** + **jsonwebtoken deps 이동**~~ ✅ 완료 (`plan/complete/deps-security-hygiene.md`) → [07](./07-dependency.md) C-1·C-2

### P1 — 핵심 경로 성능·신뢰성

6. ~~**resume rehydration N+1**~~ ✅ 완료(2026-06-10, 01 #1·05 M-4). ~~`(execution_id,status)` partial 인덱스(05 C-3)~~ ✅ 완료(2026-06-14, V095) → [05](./05-database.md) C-3
7. ~~**cancel fire-and-forget + nextSeq random fallback**~~ ✅ 완료(2026-06-24, branch `refactor-06-c1-m7-publish-failfast`) — publish 실패 fail-fast 통일(`queued:false`): cancel async+503 surface, nextSeq random fallback 제거. spec §7.4/§7.5.2·에러코드 카탈로그는 sibling planner spec-sync → [06](./06-concurrency.md) C-1·M-7 *(spec-sync 후속)*
8. **rehydrate optimistic claim** — spec 불변식("이중 실행 0")의 보장 수단 보강 + §7.5 문구 갱신 → [06](./06-concurrency.md) C-2 ⚠️ *(결정대기)*
9. ~~**shutdown 중 시작 노드 추적 포기** — §11.4 약속 위반 드리프트~~ ✅ 완료(2026-06-24, branch `refactor-06-m2-shutdown-tracking`) — Option A(early-return 제거): shutdown 중 시작 노드도 추적·drain·SERVER_INTERRUPTED 마킹. B(worker pause)는 framework 충족·queue.pause 전역이라 미채택 → [06](./06-concurrency.md) M-2
10. ~~**프론트 execution-store O(N² log N) + 선형 탐색**~~ ✅ 완료(2026-06-10, 01 #3·#8 단일 커밋)
11. ~~**WS `workflow:`/`notifications:` authorizer**~~ ✅ 완료 (PR #570 — spec §3.3 갱신 동반) → [04](./04-security.md) M-6
12. ~~**frontend API_BASE_URL 3001 fallback 수정** (정답 3011)~~ ✅ 완료(2026-06-24, branch `refactor-03-m2-api-base-url`) — `lib/api/constants.ts` 단일화 + client/assistant 3001→3011, grep 3001 0건 → [03](./03-maintainability.md) M-2

### P2 — 구조 개선 (대형, strangler-fig)

13. ~~**엔진 분할**~~ ✅ 완료 (C-1 5단계 PR #622–627, m-3 NodeBootstrapService = step1) → [02](./02-architecture.md) C-1·m-3
14. ~~**forwardRef — 클러스터별 개별 처리**~~ ✅ 완료 — ~~M-7 authorizer 역전(클러스터2·3)~~ ✅(2026-06-21 `m7-channel-authorizer-inversion`), ~~클러스터4 llm↔model-config~~ ✅(#714 + authz #716), ~~클러스터5 chat-channel↔triggers~~ ✅(#676), 클러스터1 엔진↔WS 는 spec 의도라 **유지**(✅ 무조치 확정) → [02](./02-architecture.md) C-2·M-7
15. ~~**cafe24/makeshop Base 클라이언트 통합**~~ ✅ 철회 (2026-07-01 사용자 결정 — 3번째 provider 발산 예측 불가 → 조기 일반화 회피, spec 의도 미러 수용) → [03](./03-maintainability.md) C-3·M-4
16. ~~**ai-agent 파이프라인 분리** — spec §6.1/§6.2 단계 번호와 정렬~~ ✅ 완료 (1차 #697 setup 분해, 2차 god-method 6 helper + TurnOutputAccumulators 번들) → [03](./03-maintainability.md) C-2
17. ~~**park-진입 dispatch 추출**~~ ✅ 완료 — PR #507 resume registry 와 대칭(`ParkEntryDispatch`, 커밋 `ecd70dd1` + spec-sync #688) → [02](./02-architecture.md) M-4
18. **ExecutionContext 스케일아웃** — 독립 작업화 금지, exec-intake PR3 연동 → [06](./06-concurrency.md) C-3 *(잔여)*

## ⚠️ 의도된 설계지만 문제 — 사용자 결정 현황 (15행 중 ✅ 완료 12 / 🔧 진행중 0 / ⏳ 결정대기 2 / ✅ 철회 1)

> **2026-06-28 현황**: ✅ 완료 12행 (04 5건·03 M-6/m-2·05 C-2·06 M-5·06 M-1·07 m-9·**02 C-2·02 M-5**). 🔧 진행중 0행 — 02 C-2 전 클러스터 종결(클러스터1 엔진↔WS 는 spec 의도로 유지, 잔존 고충은 수용 비용), 02 M-5 레이어1 핫스팟 해소 + 레이어2/3 marketplace Phase D 위임. ⏳ 결정대기 2행: 05 m-5, 06 C-2 — **착수 금지 유지**. (03 C-3/M-4 는 2026-07-01 사용자 철회.)
> **2026-06-10 사용자 결정**: 04 m-4, 03 M-6, 03 m-2, 06 M-5, 06 M-1 — **권고안대로 진행 확정** → 모두 ✅ 완료.
> **2026-07-01 사용자 결정**: 03 C-3·M-4 (cafe24/makeshop 미러 중복) — **철회** (deferral 앞당김·보류 모두 아님). 3번째 provider 발산을 예측할 수 없어 2-샘플 추상화는 조기 일반화이고, spec 대조로 비대칭이 전부 의도임이 확인됨(§6.1·§4·§9.5·§2) → 중복을 의도된 미러로 수용, 트리거 예약도 해제. 재기는 동일 버그 2회 수정 누적 시 새 티켓.
> **2026-06-20 사용자 결정**: 02 M-5 — **Option B(DI multi-provider 3-레이어) 방향 확정 + 레이어1 구현 착수** (n8n·flowise 리서치 기반, 격리=flowise·샌드박스=n8n). 02 C-2 #1(엔진↔WS)은 트레이드오프 부록만 추가하고 **유지 결론 불변(✅ 확정)**.

| 항목 | spec 근거 | 잔존 문제 | 권고 |
| --- | --- | --- | --- |
| 04 C-2 vm 탈출 | `2-code.md §7.1` "escape 방어 불가 … isolated-vm 재검토" | Editor 권한 = 호스트 장악, 위협 모델 경계 미명시 | **✅ 완료(2026-06-11)** — isolated-vm 전환 (worktree `code-node-isolated-vm`) |
| 04 M-2 Promise 노출 | §4.1 async 지원 명시 약속 | C-2 의 탈출 보조 경로 | **✅ 완료** — C-2 isolated-vm 전환에 흡수 |
| 04 M-3 ReDoS 길이 제한 | 4개 spec "길이 200 = ReDoS 방지" | 길이 제한은 지수 패턴 못 막음 — spec 주장 부정확 | **✅ 완료(PR #570)** — safe-regex 사전 검출 + spec 정정 (re2 는 필요 입증 시 승급) |
| 04 m-4 DB Pool 캐시 | `2-database-query.md:77` evict 명시 | 멀티 인스턴스 무효화 미조율(MTTR) | **✅ 완료** — pub/sub 전파 (`plan/complete/db-pool-creds-pubsub.md`) |
| 04 m-2/m-3 | stack 노출·trust proxy — spec/주석 명시 | 낮음 | **✅ 완료** — m-2 spec/가이드(PR #570), m-3 재제안 구현(기본 off) |
| 02 C-2 forwardRef 순환 (5클러스터) | §4.4 "추상화 도입 금지, 안티패턴 아님" (엔진↔WS=클러스터1) | 테스트 격리·초기화 순서 고충 (클러스터1 잔존 = 의도된 설계의 수용 비용) | **✅ 완료** — 클러스터1(엔진↔WS) ✅유지 확정(2026-06-20)·2·3(M-7 #663)·4(llm↔model-config #714 + authz #716)·5(chat-channel↔triggers #676) 전부 처리 |
| 02 M-5 정적 노드 배열 | `4-nodes/0-overview.md §1.0` 명시 | merge-conflict hotspot | **✅ 완료(refactor 범위)** — Option B 레이어1(DI multi-provider, 모듈 격리+핫스팟 제거) 완료(#652, [refactor-m5-node-di-layer1.md](../refactor-m5-node-di-layer1.md)). 레이어2/3(per-workspace entitlement·marketplace 커스텀 노드)는 [marketplace-and-plugin-sdk.md](../marketplace-and-plugin-sdk.md) §Phase D 위임 |
| 03 C-3/M-4 cafe24·makeshop 미러 | "cafe24 미러" + DRY-deferral("3번째 provider 시") 문서화 | 1,600줄은 deferral 명시 목록의 사각, 3중 복제 예약 | **✅ 철회(2026-07-01 사용자 결정)** — 조기 일반화 회피: 3번째 provider 발산 예측 불가, 비대칭 전부 spec 의도 확인 → 의도된 미러로 수용, 트리거 예약 해제. 재기=동일 버그 2회 수정 누적 시 새 티켓 |
| 03 M-6/m-2 dead code | 제거가 예약된 잔류물 | 잔존 중 | **✅ 완료** — 단일 cleanup PR #522 |
| 05 C-2 re_run_of walk | `13-replay-rerun.md §9.1` 함수명까지 명시 | 직렬 SELECT ≤64회 | **✅ 완료(2026-06-14)** — 재귀 CTE 교체 + spec §9.1 1줄 동행 |
| 05 m-5 schedule 부팅 전수 등록 | `data-flow/10-triggers.md §1.3` 명시 | 무페이징 적재만 잔존 문제 | **⏳ 보류(권장 B)** — 배치 페이징(1안 repeatable jobs 는 기구현 — 철회) |
| 06 C-2 rehydrate 가드 | §7.5 "race 를 닫는다" 선언 | 보장 수단이 비원자 check-then-act | **⏳ 결정대기** — optimistic claim + spec 문구 갱신 |
| 06 M-5 shallow clone | `10-parallel.md:14` 명시 | invariant 기계 강제 부재 | **✅ 완료(2026-06-10)** — dev/test deep freeze (structuredClone 은 spec 개정 선행) |
| 06 M-1 resumed ack | §4.2 정의 존재 | spec 내부 문구 모순 | **✅ 완료(2026-06-10)** — spec 문구 정리(`plan/complete/spec-update-ws-resumed-ack.md`) + 프론트 가드 확인 |
| 07 m-9 otplib | `1-data-model.md:66` "otplib base32" 지정 | 사용 버전 4년 stale (라이브러리는 활발) | **✅ 완료(2026-06-17)** — otplib ^13 (secret 호환성 게이트 11/11) |

## 기존 plan 과의 관계 (중복 방지)

| 본 백로그 항목 | 기존 plan | 처리 |
| --- | --- | --- |
| 04 C-1 (JWT secret) | [`../security-jwt-secret-fallback.md`](../security-jwt-secret-fallback.md) | 본문 미등재, 기존 plan 참조 + fail-closed 가드 블록 합류 |
| 05 C-3 (node_execution 인덱스) | [`../integration-index-unify.md`](../integration-index-unify.md) 는 integration 테이블 — **별개** | 본 백로그 등재 (신규 제안으로 정정) |
| 06 C-3 (context in-memory) | [`../exec-intake-queue-impl.md`](../exec-intake-queue-impl.md) PR3 이 정확히 커버 | cross-link, 독립 작업화 금지 |
| 02 C-1 (엔진 분할) | [`../execution-engine-residual-gaps.md`](../execution-engine-residual-gaps.md) 는 spec 갭 추적 — **별개 축** | 본 백로그 등재. `spec-sync-resume-dispatch-registry.md` 와 M-4 연계 |
| 03 C-3/M-4 (미러 중복) | [`../makeshop-integration.md`](../makeshop-integration.md) §후속 DRY-deferral | 2026-07-01 사용자 철회 — 미러 중복은 의도 수용, deferral 트리거 예약 해제 |
| 06 m-4 (abortSignal) | [`../node-cancellation-infrastructure.md`](../node-cancellation-infrastructure.md) | 철회 — 잔여 갭은 해당 plan 이 추적 |

## spec 갱신 필요 항목 (project-planner 위임 대기)

구현과 동행해야 하는 spec 변경 — developer 는 spec 쓰기 금지이므로 착수 시 planner 위임:

- ~~`1-http-request.md` §4 step8 ↔ §104 모순 해소 (04 C-3)~~ ✅ 완료 (worktree `http-ssrf-all-auth` — §4 step8 "전 인증 방식 적용" + §104 정합화 + §8.2 Rationale)
- ~~`6-websocket-protocol.md` §3.3 검증 채널 목록 (04 M-6)~~ ✅ 완료 (PR #570 — `workflow:`·`notifications:` 2채널 추가) + ~~`resumed` ack 의미 (06 M-1)~~ ✅ 완료 (`plan/complete/spec-update-ws-resumed-ack.md`)
- `4-execution-engine.md` §7.5 claim 문구·§6.2/§9.2 Redis context 드리프트 banner (06 C-2·C-3)
- ~~`13-replay-rerun.md` §9.1 walk→CTE 1줄 (05 C-2)~~ ✅ 완료 (2026-06-14 동행), ~~`data-flow/2-auth.md` §1.4 트랜잭션 박스 (05 C-1)~~ ✅ 완료 (developer 동행, worktree `auth-refresh-rotation-atomic`)
- `1-data-model.md` §3 인덱스 표 stale 일괄 동기화 (05 C-3 부수 발견)
- ~~transform/filter/if-else/switch 의 "길이 200 = ReDoS 방지" 정정 (04 M-3)~~ ✅ 완료 (PR #570 — 4개 노드 spec 가 `compileUserRegex`: 길이 ≤200 + safe-regex 위험패턴 거부로 통일 서술)
- ~~`data-flow/4-file-storage.md` "for 루프" 문구 (01 #2)~~ — ✅ 반영 완료 (`plan/complete/spec-update-perf-backlog-01.md`, 2026-06-10). `interaction-type-registry.md` §1.2 park-entry 레이어 (02 M-4)
- ~~`1-auth.md` §2.1 SameSite/CSRF 정책 공백 (04 M-5)~~ ✅ 완료 (PR #570 — §2.1/§2.3 `COOKIE_SAMESITE`·`/auth/refresh` Origin CSRF·Rationale §2.3.B) + ~~secret-store.md placeholder 정책 (04 M-4)~~ ✅ + ~~`1-auth.md §2.1` JWT_SECRET fail-closed (04 C-1)~~ ✅ + ~~`11-mcp-client.md` MCP insecure flag (04 M-7)~~ ✅ — worktree `prod-fail-closed-guards`

## 운영 규칙

- 항목 착수 시: 체크박스에 worktree/PR 링크 메모, 대형 항목(P2)은 별도 plan 승격 후 본 인덱스에서 링크.
- ⚠️ 항목은 **사용자 결정 없이 착수하지 않는다** (spec 명시 결정의 번복 또는 deferral 앞당김이 수반되므로).
- 철회 항목(`[x]` + 사유)은 재오픈 시 반증 근거를 먼저 재검증.
- 모든 항목 완료 시 본 폴더 전체를 `plan/complete/` 로 `git mv` (plan-lifecycle §3).
- 구현 PR 은 developer SKILL 의 TEST/REVIEW WORKFLOW 준수. 보안 P0 는 단독 PR + 별도 리뷰.
