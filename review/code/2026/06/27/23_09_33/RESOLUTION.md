# RESOLUTION — seq const/never cleanup 리뷰 조치

원본 SUMMARY: [`SUMMARY.md`](./SUMMARY.md) — LOW, Critical 0 / WARNING 3 / SPEC-DRIFT 1.
본 PR 의 핵심 변경(seq cleanup: 상수화·`as never` 정리)이 도입한 결함은 없음. WARNING 은 (a) 내 의도적 unblock 동봉, (b) 기존 구조, (c) #738 의 별개 후속 누락으로 분류.

## 조치 항목

| # | 등급 | 항목 | 조치 |
|---|---|---|---|
| W2 | WARNING(SCOPE) | `system-status.e2e-spec.ts` W7 큐 추가가 다른 도메인 혼입 | **현행 유지** — #738 의 신규 큐로 e2e `EXPECTED_QUEUE_NAMES` 가 stale 해 본 워크트리 e2e 가 차단됐고, unblock 위해 동봉(별도 커밋 `fix(plan,test)` 로 분리). #738 이 이미 `plan/complete/` 처리됨 → 리뷰어도 "현행 유지 허용". |
| W3 | WARNING(MAINTAINABILITY, 선택적) | `seqKeyTtlSeconds` describe 의 allocator 생성 3회 반복 | **현행 유지** — 본 PR 은 cast 표기만 교체(`as never`→`as unknown as`)했고 반복 구조는 기존부터 존재. LOW·선택적(권장조치 #3 "선택적")이라 별도 cleanup 후보로 남김([follow-up](#보류후속-항목)). |
| W1 | WARNING(USER_GUIDE_SYNC) | `endpointPath` UUID 강제(#738 W1)에 따른 MDX 예시 stale | **분리** — 본 PR(seq cleanup) changeset 에 MDX 없음. #738 W1 의 후속 누락이라 본 seq PR 에 넣으면 W2 가 지적한 scope 혼입 악화. 별도 #738 후속으로 분리(spawn_task). |
| SD1 | SPEC-DRIFT | `spec/5-system/16-system-status-api.md` §1 큐 표에 `workspace-invitations-pruner` 누락 | **분리(planner)** — spec 변경은 developer 범위 밖(`spec/` read-only). #738 W7 후속 spec 누락. 위 #738 후속에 포함(project-planner 위임). |

## 보류·후속 항목

**#738 후속 정리** (별도 작업으로 분리 — 본 seq cleanup PR scope 외):
- W1: `triggers.mdx` / `triggers.en.mdx` 의 `endpointPath` 예시값을 v4 UUID 로 교체 (developer + user-guide-writer).
- SD1: `spec/5-system/16-system-status-api.md` §1 모니터링 큐 표에 `workspace-invitations-pruner` 추가 (project-planner, consistency-check).
- W3: `service.spec.ts` TTL 블록 헬퍼 추출(선택적).

## TEST 결과

본 라운드는 **코드 변경 없음**(WARNING 을 fix 가 아닌 현행유지/분리로 처리). 직전 통과 결과 유효:
- **lint**: 통과
- **unit**: 통과 (Gate C 회귀 수정 포함, 48 suites)
- **build**: 통과 (128s)
- **e2e**: 통과 (218 — load spec ≈76k events/s, latency median 0.070ms; system-status 큐 목록 수정 포함)
