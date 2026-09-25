# RESOLUTION — review/code/2026/09/25/20_20_00 (1라운드, 전수 `--route=all`)

SUMMARY: Critical 0 · Warning 3 · INFO 8. 14명 전원 결과 확보(forced 7명 누락 없음). 라운드 전 선언한 멈춤 규칙: «Critical 0 ·
Warning 0 · 그 라운드 `codebase/**` 수정 0건이면 종결». 1라운드라 «수렴 예외»(반복 라운드 전제)는 쓰지 않고 셋 다 고쳤다.

## 조치 항목

| # | 발견 | 처분 | 커밋 |
| --- | --- | --- | --- |
| W1 | 재검사 조건 `!requesterMembership \|\| role !== 'owner'` 중 «멤버십 소멸(null)» 가지가 여전히 미고정 | **고침.** 이 PR 의 목적(재검사 분기 고정)의 나머지 절반이다 — 테스트를 `it.each` 로 두 재검사 상태(admin · null). 뮤턴트 **예측/실측**: V1(재검사가 역할을 안 봄) → admin 케이스만 RED / **1 failed · 98 passed, admin 케이스**. V2(재검사가 부재를 안 봄 — `as WorkspaceMember` 캐스트로 컴파일을 유지해 거짓 RED 배제) → null 케이스만 RED / **1 failed · 98 passed, null 케이스**. 원복은 cp, `git status` clean 확인 | `47dfdb3c3` |
| W3 | README 캐너리 절 한 문장에 개념 다섯 | **고침.** 두 판별의 파손 결과를 원인→결과 불릿 둘로(`@WorkspaceId()` → 멤버십 검증 조용히 생략 · `@WorkspaceParam(...)` → 역할 요구가 헤더 · 토큰 워크스페이스로 판정). 문장 내용은 그대로 | `47dfdb3c3` |
| W2 | plan 이 `--impl-prep` W2 · W3 를 «트래커 등재» 라 적었지만 트래커에 없음 | **맞는 지적 — 고침.** 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 planner 항목 둘을 등재했다. codebase 밖 | (plan 커밋) |
| INFO 1 · 5 · 6 · 7 | 커버리지 유효 교차 확인 · `lock` 관용구 결합(기존 관용구) · diff 번들 plan 스냅샷 지연 · 이중 순회 | 기록만 — 조치 불요 판정에 동의 | — |
| INFO 2 · 3 · 4 | `setupOwnerLookup` 소규모 중복 · `findOne` 인자 타입 반복 · README 로그 불릿 압축 | 기록만. INFO 2 는 이번 `it.each` 로 모양이 더 달라졌다(재검사 상태 주입) — 헬퍼로 합치면 인자 두 개짜리 헬퍼가 한 곳에만 쓰인다 | — |
| INFO 8 | 리뷰 중 `workspaces.service.ts` 가 뮤턴트 V1 모양으로 잠시 바뀌었다가 복귀 | testing 리뷰어가 **호출자 고지(«이 워크트리를 수정하지 말 것»)를 어기고** 공유 트리에서 뮤테이션을 돌렸다. 리뷰 뒤 `git status --short` clean 확인 — 잔존 없음. 다음 라운드 고지에 같은 문장을 유지 | — |

## TEST 결과

마지막 codebase 편집(`47dfdb3c3`) 뒤 전 단계를 다시 돌렸다.

- lint: 통과 (`_test_logs/lint-20260925-203626.log`)
- unit: 통과 — backend 10060 passed(직전 10059 + `it.each` 로 늘어난 1건) (`_test_logs/unit-20260925-203732.log`)
- build: 통과 (타입체크 ratchet 포함, `_test_logs/build-20260925-203926.log`)
- e2e: 통과 — 71 스위트 · 391 passed (`_test_logs/e2e-20260925-204223.log`)

## 보류·후속 항목

- 없음(W2 의 planner 항목 둘은 원래 이 PR 범위 밖 spec 쓰기라 트래커로 보냈다 — 보류가 아니라 소유권 이관).
