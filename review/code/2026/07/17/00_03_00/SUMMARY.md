# Code Review 통합 보고서

## 전체 위험도
**LOW** — plan/spec 문서 정리(grooming) 전용 커밋으로 실행 코드 변경은 사실상 없음(유일한 codebase 변경은 테스트 파일 주석 정정). 완료된 4개 reviewer 모두 LOW 로 판정했고 CRITICAL 발견은 없음. 다만 `security`/`scope`/`testing` 3개 reviewer 는 매니페스트상 `success` 로 보고됐으나 산출 파일이 디스크에 존재하지 않아(known FS-write flakiness) 내용 통합에서 제외됐다 — 재시도 필요.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement / documentation | `spec/5-system/9-rag-search.md` 가 `status: partial` 을 유지하기로 한 이번 결정(D1)의 근거를 문서 자체의 `## Rationale` 에 남기지 않음. 같은 PR 이 스스로 생성한 consistency-check(`review/consistency/2026/07/16/23_36_57/convention_compliance.md` WARNING#2)가 이미 지적했음에도 최종 diff 에 미반영. 같은 커밋에서 처리된 동형 결정 2건(`10-parallel.md`, `11-mcp-client.md`)은 정확히 Rationale 절에 근거를 남겼는데 이 1건만 누락된 불균형 | `spec/5-system/9-rag-search.md` `## Rationale` (L387-406), frontmatter `pending_plans` | `## Rationale` 에 "왜 `rag-dynamic-cut` 종결 후에도 `status: partial` 을 유지했나 (2026-07-16)" bullet 1개 추가 — 멀티-KB 리랭크·재임베딩 트리거 등 잔여 미구현 표면과 `rag-quality-improvement.md` 재배선 근거 명시. 후속 커밋으로도 무방 |
| 2 | side_effect | 신규 커밋된 `review/consistency/2026/07/16/23_36_57/_retry_state.json` 이 `agents_pending`(5개 전부)·`agents_success`(0개) 로 "아무 checker 도 완료 안 됨"을 영구 기록하는데, 같은 커밋에 `cross_spec.md`·`convention_compliance.md` 가 실제 내용과 함께 신규 생성돼 있어 내용상 모순. 향후 재시도 오케스트레이터가 이 상태 파일을 SoT 로 재사용하면 이미 완료·커밋된 항목을 pending 으로 오판해 불필요한 재실행을 유발할 수 있음(다만 timestamp 고정 아카이브라 재열람 가능성은 낮음) | `review/consistency/2026/07/16/23_36_57/_retry_state.json` | `agents_pending`/`agents_success` 를 최종 상태(5개 전부 success)로 갱신 후 재커밋하거나, 최소한 `SUMMARY.md` 에 "`_retry_state.json` 은 최초 재시도 시점 스냅샷이며 이후 수기 보강분 미반영" 주석 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | plan lifecycle 이동(3건 rename) 시마다 이를 참조하는 여러 spec 문서(5곳)를 수작업으로 개별 동기화해야 하는 N:M 결합 구조 — build 가드(`spec-link-integrity.test.ts`)가 누락은 방지하나 반복 유지비 존재 | `spec/4-nodes/1-logic/10-parallel.md`, `spec/conventions/{execution-context,cross-node-warning-rules,node-cancellation}.md` | plan-lifecycle 문서에 "이동 시 `grep -rln '<old-path>' spec/` 로 참조자 전수 갱신" 체크리스트 명시 또는 장기적으로 anchor 기반 안정 참조 도입 검토. 차단 사유 아님 |
| 2 | maintainability | 완료된 plan 문서(`ai-agent-tool-payload-budget-guardrail.md`) 내부에서 동일 정책 상수·근거가 3개 절(정책 요약/spec 초안/Rationale)에 근접 중복 서술 — 전형적 SSOT 산발 패턴 | `plan/complete/ai-agent-tool-payload-budget-guardrail.md` L212-226, L273-291, L312-320 | 이미 `status: complete` 로 고정된 이력 문서라 즉각 수정 불요. 향후 유사 plan 작성 시 "결정 값 SoT 는 §확정 정책 한 곳" 원칙을 명시하고 나머지 절은 인용(cross-ref)으로 대체 |
| 3 | maintainability | 장기 누적형 리서치/plan 문서(`competitive-analysis-n8n-flowise.md` 등)에 날짜별 정정 오버레이가 여러 겹 쌓여 항목 하나를 이해하려면 2~3단 시간순 서술을 순서대로 읽어야 함 | `plan/research/competitive-analysis-n8n-flowise.md`, `plan/complete/{ai-agent-tool-payload-budget-guardrail,rag-dynamic-cut}.md` | 항목 종결 시점에 "최종 결론"을 문단 맨 위로 승격하고 과거 이력은 접이식/하위 인용으로 내리는 편집 권장(`rag-dynamic-cut.md` §10 이 이미 이 패턴을 따름). 차단 사유 아님 |
| 4 | documentation | `review/consistency/2026/07/16/23_36_57/SUMMARY.md` 가 같은 커밋에 이미 존재하는 재시도 결과(`convention_compliance.md`/`cross_spec.md`)를 통합 표에 재반영하지 않아, SUMMARY 만 읽는 향후 감사자가 WARNING 2건(특히 9-rag-search Rationale 누락, 위 경고#1)을 놓칠 수 있음 | `review/consistency/2026/07/16/23_36_57/SUMMARY.md` | 조치 불필요(시점 기록 문서 컨벤션 범위 내). 향후 유사 패턴에서는 재시도 결과 확보 즉시 SUMMARY 표 재생성 권장 |
| 5 | side_effect | `spec/5-system/11-mcp-client.md` 의 `status: partial → implemented` 승격이 `spec-status-lifecycle.test.ts` 가드의 판정 조건을 바꾸는 실질적 side-effect 표면이나, 근거 plan(`spec-sync-mcp-client-gaps.md`) 이 같은 커밋에서 종결되고 잔존 미구현 표면이 없음을 실측 확인 — 정합함 | `spec/5-system/11-mcp-client.md` frontmatter | 조치 불필요(확인 완료) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | LOW | 9-rag-search.md Rationale 미반영 WARNING 1건 외 나머지 자체 consistency-check 액션아이템 3/4건은 정확히 반영됨을 확인 |
| side_effect | LOW | 실행 코드/전역상태/네트워크 부작용 없음 확인. `_retry_state.json` 모순 WARNING 1건, `11-mcp-client.md` status 승격 정합성 확인 |
| maintainability | LOW | 코드 변경 없어 복잡도 지표 평가 대상 아님. plan 참조 동기화 비용·정책값 근접중복·정정 오버레이 누적 등 INFO 3건(저위험 반복 패턴) |
| documentation | LOW | 매우 높은 문서화 품질(다수 Rationale 신설·오래된 주석 정정 실측 검증). rag-search Rationale 누락 WARNING 1건, SUMMARY.md 재통합 누락 INFO 1건 |
| security | 재시도 필요 | 매니페스트상 success 이나 `security.md` 산출 파일이 디스크에 부재 — 내용 미확보 |
| scope | 재시도 필요 | 매니페스트상 success 이나 `scope.md` 산출 파일이 디스크에 부재 — 내용 미확보 |
| testing | 재시도 필요 | 매니페스트상 success 이나 `testing.md` 산출 파일이 디스크에 부재 — 내용 미확보 |

## 발견 없는 에이전트

없음 (완료된 4개 에이전트 모두 최소 1건 이상의 발견 또는 명시적 확인 사항을 보고).

## 권장 조치사항
1. `spec/5-system/9-rag-search.md` `## Rationale` 에 D1(`status: partial` 유지) 결정 근거 bullet 추가 (WARNING#1, 저비용·명확).
2. `review/consistency/2026/07/16/23_36_57/_retry_state.json` 의 `agents_pending`/`agents_success` 를 실제 최종 상태로 갱신하거나 SUMMARY.md 에 스냅샷 주석 추가 (WARNING#2).
3. `security`/`scope`/`testing` reviewer 를 직접 Agent 로 재실행해 누락된 산출물을 확보하고 본 요약에 재통합할 것 — 현재 4개 완료 reviewer 기준으로는 CRITICAL/HIGH 소견이 없으나, 3개 미확보 상태로는 전체 커버리지가 완결되지 않음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명, 전원 router_safety 강제 포함)
  - **제외**: 표 참조 (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 문서 파일 변경(`.claude/docs/plan-lifecycle.md`, `CLAUDE.md`, `plan/**`) 및 소스 코드 변경(`spec-link-integrity.test.ts`)이 각 reviewer 의 강제 포함 트리거 조건에 해당해 router 최초 선별과 무관하게 전원 강제 실행됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 실행 성능에 영향을 주는 코드 변경 없음(문서·plan 전용, 유일 코드 변경은 테스트 주석) |
  | architecture | 아키텍처/모듈 구조 변경 없음 |
  | dependency | 의존성 추가/변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성/비동기 로직 변경 없음 |
  | api_contract | API 계약(공개 인터페이스) 변경 없음 |
  | user_guide_sync | 사용자 가이드 동기화 대상 UI/기능 변경 없음 |