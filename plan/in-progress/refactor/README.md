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

## 관점별 문서 + 집계 (spec 대조 반영)

| 문서 | 원 건수 | 유효 | 철회(E) | ⚠️ A-잔존문제 | 핵심 주제 |
| --- | --- | --- | --- | --- | --- |
| [01-performance.md](./01-performance.md) | 15 | 13 | 2 (#9 철회, #13 종결) | 0 | N+1, 직렬 I/O, 프론트 O(N²) — ✅ 결정(2026-06-10): 전반 권장안 진행, #2=B안 확정(실검증), #13=C 종결 |
| [02-architecture.md](./02-architecture.md) | 15 | 15 | 0 | 2 (C-2 일부, M-5) | god-class 분할, forwardRef(엔진↔WS 는 spec 의도), 레이어 침범 |
| [03-maintainability.md](./03-maintainability.md) | 15 | 14 | 1 (M-3) | 4 (C-3, M-4, M-6, m-2) | 거대 메서드, cafe24/makeshop 미러(DRY-deferral 문서화됨) |
| [04-security.md](./04-security.md) | 14 | 14 | 0 | 4 (C-2, M-2, M-3, m-4) | vm 탈출(spec 인지 트레이드오프), SSRF spec 내부 모순, WS 채널 spec 갭 |
| [05-database.md](./05-database.md) | 15 | 13 | 2 (M-6, m-2) | 2 (C-2, m-5) | 토큰 rotation 비원자, 인덱스 신규 제안, full-entity save lost-update |
| [06-concurrency.md](./06-concurrency.md) | 15 | 12 | 3 (m-1, m-2, m-4) | 2 (C-2, M-5) | check-then-act vs spec 불변식, fire-and-forget, spec 드리프트 2건 |
| [07-dependency.md](./07-dependency.md) | 15 | 9 | 5 (M-1, M-3, m-3, m-7 + m-5 기종결) | 1 (m-9) | jsonwebtoken(Critical→Major 정정), hono CVE, Node floor 결정 필요 |
| **합계** | **104** | **91** | **12** | **15** | |

> ⚠️ = spec/plan 에 **의도된 설계로 문서화됐으나 여전히 문제**인 항목 — 제거하지 않고 유지하며 사용자 결정 대상 (각 파일 본문에 근거 인용).
> 철회 항목은 삭제하지 않고 `[x]` + 철회 사유(반증 근거)로 보존.

## spec 대조가 바꾼 주요 사실 (요약)

- **진단 정정**: 03 M-2 — 포트 불일치의 잘못된 쪽은 login/register(3011, 정답)가 아니라 **`lib/api/client.ts` 의 3001 fallback** (메인 API 클라이언트 전체가 영향 — 원안보다 심각). 07 C-1 — `@nestjs/jwt` 전이 의존 덕에 현재 프로덕션 오류 미발현(Critical→Major).
- **spec 내부 모순 발견 2건**: 04 C-3 (http-request §4 step8 "integration 만 가드" ↔ §104 "기본 차단" — 코드 주석의 정당화는 spec 근거 0건), 06 M-1 (WS `resumed` ack 의미 ↔ §7.5.1).
- **spec 자체가 갭인 케이스**: 04 M-6 — spec 이 "3채널만 소유 검증" 으로 명시해 코드는 정합하나 spec 이 IDOR 갭 보유 (`workflow:`/`notifications:` 무검증).
- **spec 드리프트(구현이 따라가야 함)**: 06 M-2 (shutdown §11.4 마킹 약속 위반), 06 M-7 (seq idempotency 계약 위반 random fallback), 06 C-3 부속 (§6.2 Redis context 행 vs in-memory 구현).

## 종합 우선순위 (P0 → P2, spec 대조 반영)

### P0 — 보안·데이터 정합 즉시 대응 (단독 PR)

1. **`authentication=none` SSRF 가드 미적용** — spec 내부 모순 해소 동반(planner 선행) → [04](./04-security.md) C-3
2. **code 노드 vm 탈출** — spec 인지 트레이드오프지만 Editor 권한만으로 호스트 장악, isolated-vm 전환(spec 로드맵 기지정) → [04](./04-security.md) C-2 ⚠️
3. **JWT secret fallback** — 기존 plan [`../security-jwt-secret-fallback.md`](../security-jwt-secret-fallback.md) 착수 + M-4(ENCRYPTION_KEY)·M-7(MCP insecure flag)과 단일 "production fail-closed 가드" 블록으로 → [04](./04-security.md) C-1/M-4/M-7
4. **refresh 토큰 rotation 원자화** → [05](./05-database.md) C-1
5. **hono CVE override 상향**(실노출면 낮음 — 저비용) + **jsonwebtoken deps 이동** → [07](./07-dependency.md) C-1·C-2

### P1 — 핵심 경로 성능·신뢰성

6. **resume rehydration N+1** (+ `(execution_id,status)` partial 인덱스 — 신규 제안, data-model §3 표 동기화 동반) → [01](./01-performance.md) #1, [05](./05-database.md) C-3
7. **cancel fire-and-forget + nextSeq random fallback** — 함께 적용(동일 surface) → [06](./06-concurrency.md) C-1·M-7
8. **rehydrate optimistic claim** — spec 불변식("이중 실행 0")의 보장 수단 보강 + §7.5 문구 갱신 → [06](./06-concurrency.md) C-2 ⚠️
9. **shutdown 중 시작 노드 추적 포기** — §11.4 약속 위반 드리프트 → [06](./06-concurrency.md) M-2
10. **프론트 execution-store O(N² log N) + 선형 탐색** — 한 PR 권장 → [01](./01-performance.md) #3·#8
11. **WS `workflow:`/`notifications:` authorizer** — spec 갭 선제 차단(spec §3.3 갱신 동반) → [04](./04-security.md) M-6
12. **frontend API_BASE_URL 3001 fallback 수정** (정답 3011) → [03](./03-maintainability.md) M-2

### P2 — 구조 개선 (대형, strangler-fig)

13. **엔진 분할** — 순서: NodeBootstrapService(m-3, 최우선·독립) → AiTurnOrchestrator → Form/Button → RetryTurn. 통신은 내부 전용 인터페이스(WorkflowExecutor 재사용 금지), 이벤트 발행은 WebsocketService 직접 주입 유지(§4.4) → [02](./02-architecture.md) C-1·m-3
14. **forwardRef — 클러스터별 개별 처리** — 엔진↔WS 는 spec 의도라 유지, M-7 authorizer 역전 + llm/chat-channel 쌍만 단방향화 → [02](./02-architecture.md) C-2 ⚠️·M-7
15. **cafe24/makeshop Base 클라이언트 통합** — DRY-deferral 결정 정리 선행, spec 명시 비대칭 5종은 policy 주입으로 통합 금지 → [03](./03-maintainability.md) C-3 ⚠️·M-4 ⚠️
16. **ai-agent 파이프라인 분리** — spec §6.2 단계 번호와 1:1 정렬 → [03](./03-maintainability.md) C-2
17. **park-진입 dispatch 추출** — PR #507 resume registry 와 대칭(`ParkEntryDispatch`) → [02](./02-architecture.md) M-4
18. **ExecutionContext 스케일아웃** — 독립 작업화 금지, exec-intake PR3 연동 → [06](./06-concurrency.md) C-3

## ⚠️ 의도된 설계지만 문제 — 사용자 결정 현황 (15건 중 ✅ 승인 5건 / 결정 대기 10건)

> **2026-06-10 사용자 결정**: 04 m-4, 03 M-6, 03 m-2, 06 M-5, 06 M-1 — **권고안대로 진행 확정** (아래 표 ✅ 표시). 나머지는 결정 대기 — 착수 금지 유지.

| 항목 | spec 근거 | 잔존 문제 | 권고 |
| --- | --- | --- | --- |
| 04 C-2 vm 탈출 | `2-code.md §7.1` "escape 방어 불가 … isolated-vm 재검토" | Editor 권한 = 호스트 장악, 위협 모델 경계 미명시 | isolated-vm 전환 (로드맵 기지정) |
| 04 M-2 Promise 노출 | §4.1 async 지원 명시 약속 | C-2 의 탈출 보조 경로 | 단독 제거 불가 — C-2 에 흡수 |
| 04 M-3 ReDoS 길이 제한 | 4개 spec "길이 200 = ReDoS 방지" | 길이 제한은 지수 패턴 못 막음 — spec 주장 부정확 | safe-regex 사전 검출 + spec 정정 (re2 는 필요 입증 시 승급 — 네이티브 의존·기존 패턴 파손 회피) |
| 04 m-4 DB Pool 캐시 | `2-database-query.md:77` evict 명시 | 멀티 인스턴스 무효화 미조율(MTTR) | pub/sub 전파 — **✅ 승인(2026-06-10)** |
| 04 m-2/m-3 | stack 노출·trust proxy — spec/주석 명시 | 낮음 | 운영 가이드/인프라 절차로 충분 |
| 02 C-2 엔진↔WS forwardRef | §4.4 "추상화 도입 금지, 안티패턴 아님" | 테스트 격리·초기화 순서 고충 | 유지(spec 준수). 다중 sink 가시화 시 spec 개정 발의 |
| 02 M-5 정적 노드 배열 | `4-nodes/0-overview.md §1.0` 명시 | merge-conflict hotspot | 카테고리 spread 경량안(spec 무변), DI 전환은 마켓플레이스 plan 묶음 |
| 03 C-3/M-4 cafe24·makeshop 미러 | "cafe24 미러" + DRY-deferral("3번째 provider 시") 문서화 | 1,600줄은 deferral 명시 목록의 사각, 3중 복제 예약 | **본문 권장 = 보류**: 3번째 provider 까지 deferral 준수 + "결정의 사각" 을 plan 에 기록 (앞당김은 사용자 결정) |
| 03 M-6/m-2 dead code | 제거가 예약된 잔류물 | 잔존 중 | 즉시 제거 (단일 cleanup PR) — **✅ 승인(2026-06-10)** |
| 05 C-2 re_run_of walk | `13-replay-rerun.md §9.1` 함수명까지 명시 | 직렬 SELECT ≤64회 | 재귀 CTE 교체(앱-레벨 enforce 의도 내) + spec 1줄 |
| 05 m-5 schedule 부팅 전수 등록 | `data-flow/10-triggers.md §1.3` 명시 | 무페이징 적재만 잔존 문제 | 배치 페이징(1안 repeatable jobs 는 기구현 — 철회) |
| 06 C-2 rehydrate 가드 | §7.5 "race 를 닫는다" 선언 | 보장 수단이 비원자 check-then-act | optimistic claim + spec 문구 갱신 |
| 06 M-5 shallow clone | `10-parallel.md:14` 명시 | invariant 기계 강제 부재 | dev/test deep freeze (structuredClone 은 spec 개정 선행) — **✅ 승인(2026-06-10)** |
| 06 M-1 resumed ack | §4.2 정의 존재 | spec 내부 문구 모순 | planner 문구 정리 + 프론트 가드 확인 — **✅ 승인(2026-06-10)** |
| 07 m-9 otplib | `1-data-model.md:66` "otplib base32" 지정 | 사용 버전 4년 stale (라이브러리는 활발) | ^13 업그레이드 (secret 호환성 게이트) |

## 기존 plan 과의 관계 (중복 방지)

| 본 백로그 항목 | 기존 plan | 처리 |
| --- | --- | --- |
| 04 C-1 (JWT secret) | [`../security-jwt-secret-fallback.md`](../security-jwt-secret-fallback.md) | 본문 미등재, 기존 plan 참조 + fail-closed 가드 블록 합류 |
| 05 C-3 (node_execution 인덱스) | [`../integration-index-unify.md`](../integration-index-unify.md) 는 integration 테이블 — **별개** | 본 백로그 등재 (신규 제안으로 정정) |
| 06 C-3 (context in-memory) | [`../exec-intake-queue-impl.md`](../exec-intake-queue-impl.md) PR3 이 정확히 커버 | cross-link, 독립 작업화 금지 |
| 02 C-1 (엔진 분할) | [`../execution-engine-residual-gaps.md`](../execution-engine-residual-gaps.md) 는 spec 갭 추적 — **별개 축** | 본 백로그 등재. `spec-sync-resume-dispatch-registry.md` 와 M-4 연계 |
| 03 C-3/M-4 (미러 중복) | [`../makeshop-integration.md`](../makeshop-integration.md) §후속 DRY-deferral | deferral 결정 정리 선행 명기 |
| 06 m-4 (abortSignal) | [`../node-cancellation-infrastructure.md`](../node-cancellation-infrastructure.md) | 철회 — 잔여 갭은 해당 plan 이 추적 |

## spec 갱신 필요 항목 (project-planner 위임 대기)

구현과 동행해야 하는 spec 변경 — developer 는 spec 쓰기 금지이므로 착수 시 planner 위임:

- `1-http-request.md` §4 step8 ↔ §104 모순 해소 (04 C-3 — **구현 선행 조건**)
- `6-websocket-protocol.md` §3.3 검증 채널 목록 + `resumed` ack 의미 (04 M-6, 06 M-1)
- `4-execution-engine.md` §7.5 claim 문구·§6.2/§9.2 Redis context 드리프트 banner (06 C-2·C-3)
- `13-replay-rerun.md` §9.1 walk→CTE 1줄 (05 C-2), `data-flow/2-auth.md` §1.4 트랜잭션 박스 (05 C-1)
- `1-data-model.md` §3 인덱스 표 stale 일괄 동기화 (05 C-3 부수 발견)
- transform/filter/if-else/switch 의 "길이 200 = ReDoS 방지" 정정 (04 M-3)
- `data-flow/4-file-storage.md` "for 루프" 문구 (01 #2), `interaction-type-registry.md` §1.2 park-entry 레이어 (02 M-4)
- `1-auth.md` §2.1 SameSite/CSRF 정책 공백 (04 M-5), secret-store.md placeholder 정책 (04 M-4)

## 운영 규칙

- 항목 착수 시: 체크박스에 worktree/PR 링크 메모, 대형 항목(P2)은 별도 plan 승격 후 본 인덱스에서 링크.
- ⚠️ 항목은 **사용자 결정 없이 착수하지 않는다** (spec 명시 결정의 번복 또는 deferral 앞당김이 수반되므로).
- 철회 항목(`[x]` + 사유)은 재오픈 시 반증 근거를 먼저 재검증.
- 모든 항목 완료 시 본 폴더 전체를 `plan/complete/` 로 `git mv` (plan-lifecycle §3).
- 구현 PR 은 developer SKILL 의 TEST/REVIEW WORKFLOW 준수. 보안 P0 는 단독 PR + 별도 리뷰.
