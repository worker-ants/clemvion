# Code Review 통합 보고서

## 전체 위험도
**LOW** — 이번 diff(35개 파일)는 `codebase/**` 변경이 전혀 없는 spec 문서 정정 + consistency-check 산출물 커밋이며, 확보된 3개 reviewer(scope/side_effect/maintainability) 결과 모두 LOW·CRITICAL 0건. 단 `requirement`/`testing`/`documentation` 3개 reviewer 는 "success" 로 보고되었으나 output_file 이 실제로 생성되지 않아(known FS-write flakiness) 내용 미확인 — 재검증 전까지는 잠정 판정.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SCOPE | 커밋 `9adb5c241` 의 제목은 "⑦ Cafe24 D-2 + ⑧ Merge ADR" 두 주제만 표방하지만, 실제로는 본문에 "⑨ 일부(plan-only)"로 disclose 된 세 번째 무관 묶음(`workflow-list.md` pending_plans 재배선 등)이 정식 `--spec` 검토 트레일 없이 같은 커밋에 섞여 있음 | `spec/2-navigation/1-workflow-list.md`, 커밋 `9adb5c241` | 필수는 아니나 향후 "김에 처리" 항목은 별도 커밋으로 분리하거나 커밋 제목에 명시해 리뷰 트레일과 1:1 대응 유지 |
| 2 | MAINTAINABILITY | 매직넘버성 수치 리터럴(485 / 128 / 161)이 SoT 링크 없이 6곳 이상에 중복 하드코딩됨 — 이번 diff 가 정정한 "~180 화석 drift" 와 동일한 재발 패턴 | `spec/0-overview.md:79`, `spec/2-navigation/4-integration.md:1116`, `spec/4-nodes/3-ai/0-common.md:63`, `spec/4-nodes/3-ai/1-ai-agent.md:49·333`, `spec/4-nodes/4-integration/4-cafe24.md:29·446`(원 SoT, 각주 있음), `spec/5-system/11-mcp-client.md:339` | 단일 SoT(`4-cafe24.md §지원 범위` 또는 카탈로그 `_overview.md §5`)만 정확 수치·날짜 유지, 나머지 인용처는 링크 서술로 낮추거나 모든 리터럴에 동일 SoT 각주 일괄 부여 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SCOPE | 8~9개 plan-closure 주제가 5개 커밋에 번호(①~⑨)로 명시적 분리·근거·consistency-check 세션 인용까지 갖춰 담김 — 통상 의미의 "숨겨진" 스코프 확장은 아니나 원자적 개별 롤백은 어려움 | `git log origin/main..HEAD` (5 커밋) | 특별 조치 불요. 향후 spec-drift 성격이 다른 항목은 별도 PR 로 분리 권장 |
| 2 | SIDE_EFFECT | `codebase/**` 변경 0건. `review/consistency/**` 21개 신규 파일 커밋은 CLAUDE.md 저장 규약과 일치하는 의도된 동작. 단 `_retry_state.json`/`meta.json` 에 로컬 워크트리 절대경로·scratchpad tmp 경로가 하드코딩됨(기존 관례와 동일, 신규 리스크 아님) | `review/consistency/2026/07/17/{00_17_40,00_35_59,00_55_57}/**` | 조치 불요. 향후 재사용 도구가 이 절대경로 파싱에 의존하지 않도록 주의 |
| 3 | SIDE_EFFECT | `spec/5-system/11-mcp-client.md` `status: partial→implemented` + `pending_plans` 제거는 `spec-status-lifecycle.test.ts` 빌드가드 회피를 위한 필수·검증된 변경(대상 plan 이 실제로 `plan/complete/` 로 이동 완료됨을 실측 확인) | `spec/5-system/11-mcp-client.md` frontmatter | 없음(정상 동작 확인됨) |
| 4 | SIDE_EFFECT | `pending_plans` 경로 교체 2건(`workflow-list.md`, `9-rag-search.md`) 및 `parallel-p2-followups.md` 링크 경로 정정 3건은 `spec-pending-plan-existence.test.ts`/`spec-link-integrity.test.ts` 빌드가드 방어용으로 실측 검증됨 | `spec/2-navigation/1-workflow-list.md`, `spec/5-system/9-rag-search.md`, `spec/conventions/{cross-node-warning-rules,execution-context,node-cancellation}.md` | 없음. 단 `plan/complete/` 내부 dead backlink 5곳은 이번 diff 자신의 리뷰 산출물(`plan_coherence.md`)에서 이미 WARNING 으로 별도 추적 중이라 중복 등재하지 않음 |
| 5 | MAINTAINABILITY | Rationale 앵커 명명 규약 부재 — `R-N` / `R-<도메인>-N` / `R-wontdo-<slug>` 세 계열이 규율 문서 없이 공존(이번에 신설된 `R-wontdo-async-fanin` 자체는 기존 `R-wontdo-*` 선례를 정확히 따름) | `spec/4-nodes/1-logic/11-merge.md:226` | `spec/conventions/` 에 Rationale 앵커 명명 규약 명문화(비차단) |
| 6 | MAINTAINABILITY | `spec/0-overview.md` 요약 테이블 셀에 긴 인라인 경고 문구가 삽입되어 표의 "한 화면 스캔" 가독성 저하 | `spec/0-overview.md:79`(Cafe24), `:80`(MakeShop) | 경고 상세는 링크된 절로 위임하고 셀에는 짧은 플래그만 유지(비차단) |
| 7 | MAINTAINABILITY | 리뷰 산출물(`review/consistency/**`)의 "상세" 항목이 단일 초장문 문단(400~800자)으로 작성되어 재검토 시 스캔 비용이 큼 | `review/consistency/2026/07/17/00_35_59/plan_coherence.md` 등 | 향후 checker 산출물 템플릿에 하위 bullet(사실/근거/영향 구분) 관례 권장(비차단) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| scope | LOW | 8~9개 plan-closure 주제가 5개 커밋에 명시적 분리 담김(정상). 단 마지막 커밋에 표방 주제 외 무관 묶음 섞임(WARNING) |
| side_effect | LOW | `codebase/**` 변경 0건, 모든 spec frontmatter/링크 변경이 실제 빌드가드 방어용으로 검증됨 |
| maintainability | LOW | 매직넘버 485/128/161 SoT 없이 6곳 이상 중복 하드코딩(WARNING). 그 외 Rationale 명명 규약 부재 등 비차단 INFO |
| requirement | 재시도 필요 | `ran` 블록엔 success 로 기록되었으나 `requirement.md` 실제 미생성(FS-write flakiness) — 내용 미확인 |
| testing | 재시도 필요 | 동일 사유로 `testing.md` 미생성 — 내용 미확인 |
| documentation | 재시도 필요 | 동일 사유로 `documentation.md` 미생성 — 내용 미확인 |

## 발견 없는 에이전트

해당 없음 — 실제로 결과를 확인할 수 있었던 3개 에이전트(scope/side_effect/maintainability) 모두 최소 1건 이상의 발견사항(WARNING 또는 INFO)을 보고함.

## 권장 조치사항

1. `requirement`/`testing`/`documentation` 3개 reviewer 를 재실행할 것 — `_retry_state.json` 은 이들을 `agents_success`/`agents_pending` 어느 쪽으로도 최종 반영하지 않은 초기 상태(`pending` 전체)를 담고 있고, 실제 디렉터리에는 `requirement.md`/`testing.md`/`documentation.md` 가 존재하지 않아 workflow 가 보고한 "success" 와 디스크 상태가 불일치한다. 알려진 비결정적 FS-write 누락 패턴(과거 세션에서도 반복 관측)이므로 `ls` 로 대조 후 누락분 직접 재실행해 전수 확보할 것.
2. 매직넘버(485/128/161) 6곳 이상 중복 하드코딩을 단일 SoT + 링크 참조 또는 통일 각주 방식으로 정리 — 이번 diff 가 해소한 "~180 화석 drift" 재발 방지.
3. 향후 grooming 커밋에 "김에 처리" 성격 항목이 섞일 경우 별도 커밋으로 분리하거나 커밋 제목에 명시해 리뷰 트레일 1:1 대응 유지(커밋 `9adb5c241` 사례).
4. (선택, 비차단) `spec/conventions/` 에 Rationale 앵커 명명 규약(`R-N`/`R-<도메인>-N`/`R-wontdo-<slug>`) 문서화.
5. (선택, 비차단) `spec/0-overview.md` 요약 테이블 셀의 긴 인라인 경고를 짧은 플래그+링크 형태로 축약.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement, scope, side_effect, maintainability, testing, documentation` (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, side_effect, testing` (문서 파일 변경 27건+ / spec 본문 변경 11건+ 사유로 전원 강제 포함)
  - **제외**: 8명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | security | 라우터가 이번 diff(spec 문서·리뷰 산출물만) 에 보안 관련 카테고리 해당 없음으로 판단, 상세 사유는 `_routing_decision.json` 참조 |
  | performance | 동일 — `codebase/**` 변경 없어 성능 관점 해당 없음으로 판단 |
  | architecture | 동일 — 코드 아키텍처 변경 없음으로 판단 |
  | dependency | 동일 — 의존성 변경 없음으로 판단 |
  | database | 동일 — DB 스키마/쿼리 변경 없음으로 판단 |
  | concurrency | 동일 — 동시성 관련 코드 변경 없음으로 판단 |
  | api_contract | 동일 — API 계약 변경 없음으로 판단 |
  | user_guide_sync | 동일 — 사용자 가이드 동기화 대상 코드 변경 없음으로 판단 |