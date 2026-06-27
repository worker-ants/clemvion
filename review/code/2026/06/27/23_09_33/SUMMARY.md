# Code Review 통합 보고서

## 전체 위험도
**LOW** — 테스트 타입 안전성 개선(`as never` → `as unknown as RedisConnectionProvider`), 매직 넘버 상수화, 신규 큐 e2e 목록 동기화, plan frontmatter 보강. Critical 0, WARNING 3 + SPEC-DRIFT 1.

## Critical
해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | USER_GUIDE_SYNC | `endpointPath` 가 `@IsUUID('4')`(#738 W1) 로 강제되며 user-guide MDX 예시 `"endpointPath": "uuid-or-slug"` 가 stale → 따라하면 400 | `triggers.mdx` L201, `triggers.en.mdx` L190 |
| 2 | SCOPE | `system-status.e2e-spec.ts` 의 W7 큐 추가가 seq 워크트리 의도와 다른 도메인 혼입 | `system-status.e2e-spec.ts` |
| 3 | MAINTAINABILITY | `seqKeyTtlSeconds` describe 의 allocator 생성 코드 3회 반복 | `execution-seq-allocator.service.spec.ts` |

## SPEC-DRIFT

| # | 발견사항 | 위치 |
|---|----------|------|
| 1 | `workspace-invitations-pruner` 가 코드(MONITORED_QUEUES·e2e)엔 있으나 `spec/5-system/16-system-status-api.md` §1 큐 표에 누락 (data-flow/0-overview §4 엔 등재 — 코드가 옳고 spec/16 stale) | `spec/5-system/16-system-status-api.md` §1 |

## 에이전트별 위험도
security NONE · performance NONE · requirement NONE(SPEC-DRIFT 1) · scope LOW · side_effect NONE · maintainability LOW · testing NONE · documentation LOW(INFO) · dependency NONE · database NONE · concurrency NONE · api_contract NONE · user_guide_sync WARNING

## 라우터
routing=all (13 reviewer 전원 실행, 한도 리셋 후 재시도로 완주).

> 처리: [`RESOLUTION.md`](./RESOLUTION.md)
