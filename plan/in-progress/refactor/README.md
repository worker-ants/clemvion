# Refactor 백로그 — 코드베이스 전수 다관점 감사 (2026-06-10)

> 7개 관점(성능·아키텍처/확장성·유지보수성/가독성·보안·데이터베이스·동시성·의존성) sub-agent 가
> `codebase/**` 프로덕션 코드 전수를 분석한 리팩토링 백로그. diff 리뷰가 아닌 **현재 상태 전수 감사**다.
> 각 항목은 관점별 파일에 체크박스로 등재되며, 착수 시 항목 단위로 별도 plan 으로 승격하거나
> 해당 파일에서 직접 체크 처리한다.

## 산출 경위

- 분석 시점: 2026-06-10, 기준 브랜치 `claude/plan-complete-turn-timing-aa533b` (main 동등)
- 대상: `codebase/backend/src/**` (NestJS, 1,022 파일), `codebase/frontend/src/**` (Next.js, 572 파일),
  `codebase/channel-web-chat/src/**`, `codebase/packages/**` — 테스트 파일 제외
- 방식: 관점별 reviewer sub-agent 7개 병렬 fan-out (Agent tool), main 이 종합·기존 plan 중복 검증

## 관점별 문서 + 심각도 집계

| 문서 | Critical | Major | Minor | 핵심 주제 |
| --- | --- | --- | --- | --- |
| [01-performance.md](./01-performance.md) | 3 | 8 | 4 | N+1 쿼리, 직렬 I/O, 프론트 O(N²) 이벤트 처리 |
| [02-architecture.md](./02-architecture.md) | 3 | 9 | 3 | 9,210줄 god-class, forwardRef 순환 6곳, 레이어 침범 |
| [03-maintainability.md](./03-maintainability.md) | 4 | 7 | 4 | 거대 메서드, cafe24/makeshop ~1,600줄 중복, 보일러플레이트 |
| [04-security.md](./04-security.md) | 3 | 7 | 4 | vm sandbox 탈출, SSRF 가드 갭, JWT secret fallback |
| [05-database.md](./05-database.md) | 3 | 7 | 5 | 토큰 rotation 비원자성, 인덱스 누락, unbounded SELECT |
| [06-concurrency.md](./06-concurrency.md) | 3 | 7 | 5 | fire-and-forget 에러 유실, check-then-act, in-memory 상태 |
| [07-dependency.md](./07-dependency.md) | 2 | 4 | 9 | devDeps 분류 오류, hono CVE, jest/ts-jest 메이저 불일치 |
| **합계** | **21** | **49** | **34** | |

> 관점 간 동일 근원 항목은 한 파일에만 본문 등재하고 다른 파일에서 참조한다 (각 파일 상단 "중복 참조" 절).

## 종합 우선순위 (P0 → P2)

### P0 — 보안·데이터 정합 즉시 대응 (단독 PR 권장)

1. **vm.Script 는 sandbox 가 아님** — code 노드 탈출로 host 장악 가능 → [04-security.md](./04-security.md) C-2
2. **`authentication=none` HTTP Request 노드 SSRF 가드 미적용** → [04-security.md](./04-security.md) C-3
3. **JWT secret 기본값 fallback** → 기존 plan [`../security-jwt-secret-fallback.md`](../security-jwt-secret-fallback.md) (2026-06-02 등재, 미착수) 착수
4. **refresh 토큰 rotation 비원자성** (세션 소실 가능) → [05-database.md](./05-database.md) C-1
5. **`jsonwebtoken` devDependencies 분류 오류** (프로덕션 빌드 런타임 실패 가능) + **hono CVE 4건** → [07-dependency.md](./07-dependency.md) C-1·C-2

### P1 — 핵심 경로 성능·신뢰성

6. **execution-engine resume 경로 N+1 + `(execution_id, status)` 인덱스 누락** → [01-performance.md](./01-performance.md) #1, [05-database.md](./05-database.md) C-3
7. **`cancelWaitingExecution` fire-and-forget 에러 유실** → [06-concurrency.md](./06-concurrency.md) C-1
8. **continuation worker check-then-act 경쟁 (context OVERWRITE)** → [06-concurrency.md](./06-concurrency.md) C-2
9. **프론트 execution-store O(N² log N) 이벤트 처리** → [01-performance.md](./01-performance.md) #3·#8

### P2 — 구조 개선 (대형, 단계적 strangler-fig)

10. **`ExecutionEngineService` 9,210줄 분할** (AiTurnOrchestrator / Form·ButtonInteraction / RetryTurn / NodeBootstrap) → [02-architecture.md](./02-architecture.md) C-1
11. **forwardRef 양방향 순환 6곳 해소** (이벤트 포트 추상화) → [02-architecture.md](./02-architecture.md) C-2
12. **cafe24/makeshop API 클라이언트 `BaseIntegrationApiClient` 통합** (~1,600줄 중복, `insufficient_scope` 비대칭 이미 발생) → [03-maintainability.md](./03-maintainability.md) C-3
13. **`ai-agent.handler.ts` 971줄 단일 메서드 파이프라인 분리** → [03-maintainability.md](./03-maintainability.md) C-2
14. **`ExecutionContextService` in-memory Map — 수평 스케일아웃 전제 조건** → [06-concurrency.md](./06-concurrency.md) C-3

## 기존 plan 과의 관계 (중복 방지)

| 본 백로그 항목 | 기존 plan | 처리 |
| --- | --- | --- |
| 04-security C-1 (JWT secret fallback) | [`../security-jwt-secret-fallback.md`](../security-jwt-secret-fallback.md) | 본문 미등재, 기존 plan 참조 |
| 05-database C-3 (node_execution 인덱스) | [`../integration-index-unify.md`](../integration-index-unify.md) 는 integration 테이블 대상 — **별개** | 본 백로그에 등재 |
| 06-concurrency C-3 (context in-memory) | [`../exec-park-durable-resume.md`](../exec-park-durable-resume.md)·[`../exec-intake-queue-impl.md`](../exec-intake-queue-impl.md) 가 인프라 토대 제공 | 등재하되 해당 plan 진행과 연동 |
| 02-architecture C-1 (엔진 분할) | [`../execution-engine-residual-gaps.md`](../execution-engine-residual-gaps.md) 는 spec 미구현 surface 추적 — **별개 축** | 본 백로그에 등재 |

## 운영 규칙

- 항목 착수 시: 해당 파일 체크박스에 worktree/PR 링크 메모를 남기고, 규모가 큰 항목(P2 류)은 별도 plan 으로 승격해 본 인덱스에서 링크.
- 모든 항목 완료 시 본 폴더 전체를 `plan/complete/` 로 `git mv` (plan-lifecycle §3).
- 구현 PR 은 developer SKILL 의 TEST/REVIEW WORKFLOW 를 그대로 따른다. 보안 P0 항목은 단독 PR + 별도 리뷰.
