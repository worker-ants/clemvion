# RESOLUTION — ai-review 2026-07-17 00_03_00

> 대상: `ceaaf2d69` (plan in-progress grooming ①~⑤), range `origin/main..HEAD`
> 결과: **RISK LOW / Critical 0 / Warning 2 / INFO 5** → Warning 2건 전부 fix. Critical 없음.
> router: 7명 선별(전원 `router_safety` 강제 포함) / 7명 제외(성능·아키텍처·의존성·DB·동시성·API계약·유저가이드 — 해당 변경 없음).

## 처리 결과

| # | 카테고리 | 발견 | 처분 | 근거 |
|---|---|---|---|---|
| W1 | requirement / documentation | `9-rag-search.md` 가 `status: partial` 유지 결정(D1)의 근거를 자기 `## Rationale` 에 미기록. 동형 결정 2건(`10-parallel.md`·`11-mcp-client.md`)은 남겼는데 이 1건만 누락된 불균형 | **fix** | 타당한 지적. `## Rationale` 에 "왜 `rag-dynamic-cut` 종결 후에도 `status: partial` 을 유지했나 (2026-07-16)" 항목 추가 — 잔여 미구현 표면 4건(멀티-KB 리랭크·재임베딩 트리거·D2 정량 임계·ef_search 튜닝) 열거 + `rag-quality-improvement.md` 재배선 근거 + "status 는 가드 통과용 형식이 아니라 구현 현실의 진술" 원칙 명시 |
| W2 | side_effect | 커밋된 `review/consistency/.../_retry_state.json` 이 `agents_pending`=5·`agents_success`=0 으로 "아무 checker 도 완료 안 됨" 을 영구 기록하는데, 같은 커밋에 실제 결과 파일들이 존재해 모순. 재시도 오케스트레이터가 SoT 로 재사용하면 완료 항목을 pending 으로 오판 | **fix** | 두 세션(`consistency/23_36_57`, `code/00_03_00`) 의 `_retry_state.json` 을 실제 최종 상태로 갱신 + `_final_state_note` 로 경위(FS-write flakiness → journal 복구) 기록. **ai-review 세션 것도 동일 결함이라 함께 정정** — reviewer 가 지적한 것은 consistency 쪽이지만 같은 원인·같은 오판 위험 |

## INFO (조치 불요 — 판단 기록)

| # | 카테고리 | 발견 | 판단 |
|---|---|---|---|
| I1 | maintainability | plan 이동 시 이를 참조하는 spec 5곳을 수작업 동기화해야 하는 N:M 결합 | **부분 반영**: build 가드(`spec-link-integrity`)가 누락을 이미 차단하므로 기능적 문제는 없음. 다만 본 PR 이 정정한 `spec-impl-evidence §4.2`(plan 링크도 스캔 대상임을 명시)가 바로 이 반복 유지비의 인지 비용을 낮추는 조치다. anchor 기반 안정 참조는 별건 |
| I2 | maintainability | 완료 plan 문서 내 정책 상수 3개 절 근접 중복 | 이미 `complete/` 로 고정된 **이력 문서**라 수정 불요(reviewer 도 동의). 이력 문서를 사후 편집하면 "그 시점의 기록" 성질이 훼손됨 |
| I3 | maintainability | 리서치/plan 문서에 날짜별 정정 오버레이 누적 | 편집 권장 사항이며 본 PR 범위 밖. `rag-dynamic-cut §10` 이 이미 권장 패턴을 따름 |
| I4 | documentation | `consistency/SUMMARY.md` 가 재시도로 확보된 2개 checker 결과를 표에 재통합 안 함 | **시점 기록 문서 컨벤션 범위 내**(reviewer 도 "조치 불필요" 판정). SUMMARY 는 생성 시점의 판정을 보존하며, 복구된 2건은 같은 디렉토리에 원문으로 존재하고 `_final_state_note` 가 경위를 안내 |
| I5 | side_effect | `11-mcp-client.md` `partial → implemented` 승격이 가드 판정을 바꾸는 실질 side-effect | reviewer 가 **실측으로 정합 확인 완료**(근거 plan 이 같은 커밋에서 종결 + 잔존 미구현 표면 0) |
| I6 | scope | 상호 무관한 5개 도메인 plan 종결이 한 커밋에 번들 | **의도된 것**. 사용자가 "1~5는 하나의 PR로" 라고 명시 지시한 grooming 작업이며, plan-lifecycle §3 이 "plan 이동만 담은 별 PR 분리 금지" 로 오히려 이 형태를 요구한다. 각 종결 근거는 개별 plan 문서에 상세 기록됨 |

## 검증

- **TEST WORKFLOW (리뷰 前 수행 — review gate 재무장 회피)**: lint **PASS** / unit **PASS** (backend·frontend·web-chat-sdk·channel-web-chat·sdk·expression-engine 5스택, frontend 277 파일 포함) / build **PASS** / e2e **PASS (256 tests)**.
  - e2e 면제 검토: 변경 set 에 `*.test.ts` 1건 포함 → PROJECT.md §e2e 면제 화이트리스트 의 부분집합 아님("회색 지대: `*.test.ts` 만 변경 도 화이트리스트가 아니므로 e2e 수행") → **면제 불가로 판정해 전량 수행**.
- **docs 가드 재확인** (W1 fix 후): `codebase/frontend/src/lib/docs/__tests__/` 18 파일 **2590 passed**.
- **consistency-check `--spec`** (`review/consistency/2026/07/16/23_36_57/`): **BLOCK: NO**, Critical 0, WARNING 4 → 전부 반영(9-rag-search 본문 stale plan 참조 2곳 정정 · rag-quality-improvement §7.C-2 체크박스 명문화 · won't-do 표기 관례 준수 · waitAll §2-E 유실 처분 Rationale 기록).

## 비고 — harness 이슈 2건 (본 PR 결함 아님)

1. **Workflow FS-write flakiness 재현** (기지 이슈): consistency 5개 중 2개(cross_spec·convention_compliance), ai-review 7개 중 3개(security·scope·testing)가 `status=success` 를 반환하고도 `output_file` 미기록. **재실행 대신 workflow journal(`journal.jsonl`) 에서 원문 복구**해 디스크에 기록 — 재실행은 토큰을 이중 소모하면서 결과가 달라질 수 있어 원본 보존이 우선. 복구 후 양쪽 세션 모두 전수 확보 상태로 BLOCK/RISK 판정 확정.
2. **main 이 이미 red 였음** (본 PR 이 수정): `plan/complete/ai-agent-tool-payload-budget-followups.md`(`started: 2026-07-14` ≥ Gate C cutoff)에 `spec_impact` 미선언 → `spec-plan-completion.test.ts` 실패가 `origin/main` 에 존재. PR #955/#956 이 spec/plan-only 라 unit 을 안 돌려 샌 회귀(= `plan-lifecycle §5` 가 경고한 바로 그 패턴). 인접 건이라 본 PR 에서 함께 fix.
