# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건(`retry_last_turn` 원자성 불변식 위반, rationale_continuity) 발견

> **BLOCK 해석 주의 (중요)**: 이 Critical 은 신규 결함이 아니며, 이미 직전 라운드(`17_21_27`)가 발견해
> `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` **#10** 으로 위임·추적
> 중이고, 그 항목 자신이 "P1 원자 claim 구현 PR 과 **같은 커밋**으로 반영, 별도 planner PR 금지"를
> 명시한다. 즉 이 BLOCK 은 "구현 착수를 멈추고 spec 부터 별도로 고쳐라"가 아니라 **"이번에 착수하는
> `applyRetryLastTurn` 원자 claim 구현 커밋에 아래 4개 spec 갱신이 반드시 동반돼야 하며, 코드만 고치고
> 끝내면 안 된다"는 확인/재강조**로 읽어야 한다. 자세한 처리 방법은 `Critical 위배` 표와
> `권장 조치사항 #1` 참고.

> **커버리지 경고**: `target_path=spec/5-system/` 전체가 대상이었으나, 컨텍스트 예산으로 5개 checker
> 프롬프트 전원이 사전식/숫자순으로 앞선 3개 파일(`1-auth.md`/`10-graph-rag.md`/`11-mcp-client.md`)만
> 전문을 받았고 나머지 18개(이번 worktree 의 실질 작업 대상인 `4-execution-engine.md` 포함)는
> 생략됐다. **`rationale_continuity` 만 프롬프트 지시("생략을 근거로 삼지 말 것")에 따라 자체적으로
> `4-execution-engine.md` 를 직접 Read/grep 해 위 Critical 을 발견**했고, `plan_coherence` 도 연관 plan
> 파일을 통해 이 영역을 검토했다. 나머지 3개 checker(`cross_spec`/`convention_compliance`/
> `naming_collision`) 는 이 영역을 전혀 검토하지 못했다 — 이번 라운드는 결과적으로 커버됐지만, 이
> 생략 패턴이 직전 라운드에 이어 재차 반복된 구조적 갭이므로 향후 false negative 위험이 있다(참고:
> INFO #3).

## 전체 위험도
**HIGH** — 실행 중인 코드에 살아있는 이중실행 방지 불변식 위반이 있으나, 이미 식별·추적·이연(defer)
계획이 확정된 상태이고 절차적 정합성 갭(plan frontmatter·hand-off 절차) 2건이 추가로 발견됨.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | `retry_last_turn` 재진입 경로에 원자 claim 이 없어, spec 이 6개 지점(§4.2 각주/§7.3/§7.4 두 행/§8/Rationale)에서 반복 단언하는 "동일 turn 이중 실행 0" 불변식을 실제로는 충족 못함. §7.4 는 L906("WAITING_FOR_INPUT 사전검증 미거침, carve-out 인정")과 L914("전체 continuation 타입에 무차별 재단언")가 문서 내부적으로도 서로 모순. 코드 확인: `continuation-execution.processor.ts` L83-86 이 `retry_last_turn` 을 `claimResumeEntry`(조건부 UPDATE) 대상에서 명시 제외하고 "자체 멱등 가드는 `applyRetryLastTurn` 내부"라 위임하지만, `retry-turn.service.ts` L281-287 의 실제 가드는 조건부 UPDATE(CAS) 가 아니라 평범한 `findOneBy` → `if status !== RUNNING return` read-then-branch 라 중복 배달(재시도·동시성 상향·멀티 인스턴스) 시 두 delivery 가 모두 통과 가능 | `spec/5-system/4-execution-engine.md` §4.2 L425 각주, §7.3 L876-881, §7.4 L906/L914, §8 L1120, Rationale L1537/L1607 (target_path=`spec/5-system/` 안이지만 이번 프롬프트 전문에는 예산 초과로 미포함 — checker 가 직접 Read 로 확인) | 코드: `codebase/backend/.../continuation-execution.processor.ts` L44-49/L83-86, `retry-turn.service.ts` L281-287 (`applyRetryLastTurn`) | **차단이 아니라 조건부 확인**: 새 백로그로 재등재 금지 — `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` **#10** 이 유일한 SoT(4개 세부 항목 (a)~(d) + "같은 커밋, 별도 PR 금지" 이미 명시). `applyRetryLastTurn` 원자 claim(P1) 구현과 **같은 커밋**에 (a) §4.2 L425 각주를 crash re-drive 아닌 `retry_last_turn` 전용 Rationale 로 재연결 (b) §7.4 L906/L914 갱신(신규 claim 반영, 내부모순 해소) (c) §8/Rationale L1607 각주 추가 (d) §7.5 에 "spawn 단계 원자성만으론 불충분한 이유" 대칭 Rationale 신설 — 이 4가지가 **같은 커밋에 포함됐는지 `--impl-done` 단계에서 반드시 재확인**. "같은 커밋"의 정확한 의미(리터럴 단일 vs 같은 PR 내 후속 커밋 허용)는 WARNING #2 참고 — 실행 전에 명확히 하는 편이 안전. |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `retry-turn-terminal-guard.md` frontmatter `worktree:` 가 이미 정리·머지된 최초 worktree(`retry-turn-cancel-guard-ba75a2`)를 그대로 가리켜 현재 worktree(`retry-atomic-claim-4d9e77`)와 연결되지 않음 — 그 사이 후속 worktree 3개(커밋 `1493b5ae9`/`548eb3c07`/`71ce6c12b` 포함) 어디서도 갱신되지 않음. `plan_guard.py` 의 push 하드블록은 "diff 가 codebase/** 를 바꿨는데 **frontmatter 로 현재 worktree 에 연결되는** in-progress plan 이 함께 갱신 안 됨"만 잡으므로, 지금 상태로 P1 코드를 push 하면 가드가 "연결된 plan 없음(ad-hoc)"으로 오판해 무장 해제됨 | `plan/in-progress/retry-turn-terminal-guard.md:3` (frontmatter `worktree:`) | `.claude/hooks/_lib/plan_guard.py` worktree-match 로직(L32-38, `_linked_in_progress_plans` L218-244) | 착수 커밋에서 frontmatter `worktree:` 를 `retry-atomic-claim-4d9e77` 로 갱신(가장 간단) — 또는 P1 항목을 `plan/in-progress/retry-atomic-claim.md` 로 분리해 신규 `worktree:` 등록하고 원 plan 은 포인터만 유지 |
| 2 | plan_coherence | `spec-update-node-cancellation-shutdown-classification.md` **#10** 의 "같은 커밋으로 반영" 지시가, 동일 문서의 구조적으로 동일한 선행 8개 항목(#1/#2/#4/#5/#6/#7/#8 등)이 전부 따른 "코드 PR 머지 후 별도 project-planner 커밋" 관행과 어긋남. `.claude/hooks/` 전수 확인 결과 `spec/` 쓰기를 role 별로 기술적으로 막는 훅은 없음(read-only 는 순수 관행) — "같은 커밋"을 문자 그대로 지키려면 developer 세션이 관행을 깨고 `spec/` 을 직접 쓰거나 브랜치 내 project-planner 턴 전환이 필요한데, 그 전환 시점·주체가 plan 어디에도 명시 안 됨 | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:534-550`(#10), 특히 :542 | 동일 문서 #1/#2/#4/#5/#6/#7/#8 선례(전부 별도 후속 커밋으로 처리, 예: #8 → `548eb3c07`) | #10 에 "같은 커밋"의 의미(리터럴 단일 commit vs 같은 PR/브랜치 내 developer 커밋 + 후속 project-planner 커밋 허용)와 hand-off 시점(예: "코드 커밋 직후, push 전에 project-planner 턴으로 전환")을 한 줄 명시. 최소 의도("별도 후속 **PR** 로 미루지 않는다")만 지키면 되므로, 병합 전 같은 브랜치에 spec 커밋을 추가하는 방식으로 처리 가능 |
| 3 | naming_collision | Graph RAG 시각화(KB-GR-UI-07, `GET /api/knowledge-bases/:id/graph/visualization`)의 "노드/엣지" 개념이 워크플로우 캔버스의 실제 타입 식별자(`@xyflow/react` bare `Node`/`Edge`, 백엔드 `NodeDto`/`EdgeDto`)와 이름이 겹침. 코드는 이미 두 곳(`GraphVizNodeDto`/`GraphVizEdgeDto`, `Graph3DNode`/`Graph3DLink`)에서 **개별적으로, 문서화 없이** 접두어로 회피했으나 spec 은 이 회피 규칙을 명문화하지 않음 — 이제 막 CRITICAL 로 수정된 `Entity`/`Relation` vs TypeORM `@Entity` 와 동일 유형의 재발. 현재 활성 충돌은 없어 CRITICAL 아님 | `spec/5-system/10-graph-rag.md` KB-GR-UI-07, §5.2; `spec/0-overview.md §7` 용어정의 | `codebase/frontend` 내 `@xyflow/react` Node/Edge import 6개 파일(`editor-loader.tsx`/`custom-node.tsx`/`custom-edge.tsx`/`use-edge-execution-state.ts` 등), 백엔드 `NodeDto`/`EdgeDto` | `10-graph-rag.md` §2.3~2.5 Rationale("구현 식별자 주의") 각주 옆 또는 KB-GR-UI-07 인근에 "시각화 노드/엣지는 워크플로우 캔버스 Node/Edge 와 별개, 구현은 `GraphViz*`/`Graph3D*` 접두" 한 줄 병기. 재발 방지 차원에서 "프레임워크/도메인 예약어와 겹치는 bare 타입명은 접두어로 구분" 명명 규약 신설 시 이 사례도 두 번째 실례로 등재 권장 |
| 4 | convention_compliance | `convention_compliance` checker 프롬프트의 "정식 규약 모음" 번들이 `spec/conventions/cafe24-api-catalog/**` 하위 자동생성 필드별 참조 문서(약 230개, `spec-impl-evidence.md` 자신이 "정식 spec 아님"으로 명시하는 문서군)로 먼저 채워져, target 3개 문서가 실제로 반복 인용하는 `error-codes.md`/`node-output.md`/`swagger.md`/`secret-store.md`/`migrations.md`/`execution-context.md`/`cross-node-warning-rules.md`/`cafe24-api-metadata.md` 등 상위 규약 문서 전량이 예산 밖으로 밀려남 — harness/프롬프트 조립 이슈이며 target 문서 위반 아님. 이번 라운드는 checker 가 "Read 로 직접 열어라" 지시를 따라 직접 재조회해 영향받지 않았으나, 그 지시를 따르지 않는 실행에서는 false negative 위험 | N/A — target 문서가 아니라 리뷰 harness 의 프롬프트 조립 로직 (`_prompts/convention_compliance.md` "정식 규약 모음" 섹션) | `spec/conventions/cafe24-api-catalog/**`(카탈로그성) vs 실제 인용 규약 문서 | orchestrator 의 프롬프트 조립 로직이 카탈로그성 대량 참조 문서(`*-api-catalog/<resource>/**`)를 후순위로 미루거나 별도 예산으로 분리하고, target 문서가 실제로 인용하는 규약 파일을 우선 포함하도록 조정 검토 (harness 백로그, target 수정 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | MCP Client 에러 코드(`MCP_*` 9종)가 중앙 에러 카탈로그의 "도메인 spec 참조" 완결성 패턴에 미등재 — 자매 도메인 6개(2FA/WebAuthn, WS, EIA REST, Webhook, KB/Graph RAG, 워크스페이스 멤버)는 이미 등재 완료 | `spec/5-system/11-mcp-client.md §8.2` ↔ `3-error-handling.md §1` | `3-error-handling.md` 에 `§1.10 MCP Client 도메인 에러 코드(도메인 spec 참조)` 절을 §1.9 와 동일 포맷으로 신설. target(`11-mcp-client.md`) 자체 수정 불요 |
| 2 | rationale_continuity | 직전 게이트(17_21_27) CRITICAL #1(auth RBAC "멤버 관리" Admin 열 CRU→삭제불가)·#3(graph-rag 엔티티 명명) 은 커밋 `71ce6c12b` 로 정정 확인, 각각 새 Rationale 동반(실측 근거·기각 대안·발견경로 명시) — 회귀 없음 | `1-auth.md §3.2`, `10-graph-rag.md Rationale "도메인 용어"` | 조치 불요. graph-rag 쪽 정정은 auth.md 와 달리 날짜/발견경로 인용이 없어 provenance 추적성이 약간 약함 — 향후 유사 정정에 "발견경로+날짜" 관행을 템플릿으로 권장(사소, 비차단) |
| 3 | rationale_continuity | 커버리지 캐벗 — `4-execution-engine.md` 가 직전 라운드에 이어 이번에도 컨텍스트 예산으로 프롬프트에서 생략, 사전식/숫자순 우선 채움 방식이 그대로 재사용됨. 생략 목록에 `_selectedPort`/`$trigger`/`$env` 같은 비-파일 항목 혼입도 재발 | 세션 프롬프트 "예산 초과로 생략된 파일" 목록(18개) | harness 파일 선택 로직에 "브랜치명·열린 plan 의 `spec_impact` 파일 우선 포함" 규칙 추가를 harness 백로그로 고려(기존 유사 백로그 문서에 이미 흡수됐는지 먼저 확인) |
| 4 | convention_compliance | Overview 섹션 표기 방식(`## Overview (제품 정의)` vs 표기 없이 `## 1. 개요` 로 바로 시작)이 3개 target 문서 간 상이하나, 양쪽 변형 모두 스펙 코퍼스 전역에 광범위 선례 있음(SKILL.md 도 "3섹션 권장" — 강제 아님) | `1-auth.md L24`, `10-graph-rag.md L30`, `11-mcp-client.md L19` | 조치 불요 |
| 5 | convention_compliance | Graph RAG "도메인 용어 vs 구현 식별자" 병기 패턴(`Graph` 접두)은 `spec/` 전체에서 이번이 최초 사례 — 정확성은 실측 확인됨, 아직 공용 `spec/conventions/*.md` 로 일반화되어 있지 않음 | `10-graph-rag.md §2.3~2.5 Rationale "구현 식별자 주의"` | 조치 불요(n=1, 과설계 방지). 동일 유형이 다른 영역(예: WARNING #3 의 Node/Edge)에서 반복되면 공용 convention 문서 승격을 고려 |
| 6 | plan_coherence | 인접 미해결 택일 결정((a)/(b), SIGTERM/timeout 유발 abort 의 `cancelled` vs `failed` 분류)은 `ShutdownStateService` bulk UPDATE 경로로, 이번 worktree 의 `applyRetryLastTurn` 조건부 UPDATE 경로와 무충돌 재확인 | `spec-update-node-cancellation-shutdown-classification.md` 최상단, `worktree: (unstarted)` | 없음(참고용, 별도 백로그로 계속 추적) |
| 7 | naming_collision | 직전 라운드 CRITICAL(`Entity`/`Relation`/`ChunkEntity` vs TypeORM `@Entity` 심볼 충돌) 은 `71ce6c12b` 로 `10-graph-rag.md`·`1-data-model.md` 양쪽에 `Graph` 접두 매핑이 명문화되어 해소 재확인 | `10-graph-rag.md §2.3~2.5`, `1-data-model.md §2.12.2~2.12.4` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 직전 라운드 CRITICAL 2건 해소 재확인. 잔여는 MCP 에러코드 카탈로그 등재 누락(INFO) 1건뿐 |
| rationale_continuity | HIGH | `retry_last_turn` 원자성 불변식 위반 CRITICAL 1건 — target 프롬프트 밖 `4-execution-engine.md` 를 자체 조사로 발견, 이미 plan #10 으로 추적/이연 중임을 확인 |
| convention_compliance | LOW | target 문서 자체엔 규약 위반 없음. WARNING 1건은 harness 프롬프트 조립 이슈(target 수정 아님) |
| plan_coherence | MEDIUM | plan frontmatter `worktree:` 불일치(push 가드 무장해제) + #10 "같은 커밋" 지시 모호성, 절차적 WARNING 2건 |
| naming_collision | LOW | 직전 CRITICAL 해소 재확인. Graph RAG 시각화 Node/Edge 명명 미문서화 WARNING 1건(현재 비활성 충돌) |

## 권장 조치사항

1. **(BLOCK 해소 — 최우선, 착수 시 직접 실행)** `applyRetryLastTurn` 원자 claim(P1) 구현을 `retry-turn.service.ts`/`continuation-execution.processor.ts` 에 반영하는 **바로 그 커밋**에 `spec/5-system/4-execution-engine.md` 4개 갱신을 동반: (a) §4.2 L425 각주를 `retry_last_turn` 전용 Rationale 로 재연결 (b) §7.4 L906/L914 갱신 (c) §8/Rationale L1607 각주 추가 (d) §7.5 대칭 Rationale 신설. `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #10 의 4개 체크박스를 그대로 따를 것 — 새 백로그 등재 금지.
2. `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #10 에 "같은 커밋"의 의미(리터럴 단일 vs 같은 PR/브랜치 내 후속 project-planner 커밋 허용)와 hand-off 시점을 한 줄 명시 — #1의 실행 방식이 여기 달려 있으므로 실행 전 확인 권장.
3. 착수 커밋에서 `plan/in-progress/retry-turn-terminal-guard.md` frontmatter `worktree:` 를 `retry-atomic-claim-4d9e77` 로 갱신(또는 별도 plan 파일로 분리) — push 가드가 이번 작업의 plan 동기화를 실제로 감시하도록.
4. `10-graph-rag.md` KB-GR-UI-07 인근에 시각화 Node/Edge 가 워크플로우 캔버스 Node/Edge(`@xyflow/react`/`NodeDto`/`EdgeDto`)와 별개이며 구현은 `GraphViz*`/`Graph3D*` 접두를 쓴다는 한 줄 병기.
5. (경미, 비차단) `3-error-handling.md` 에 `§1.10 MCP Client 도메인 에러 코드` 절 신설.
6. (harness 백로그, target 비수정) 프롬프트 조립 시 `spec/conventions/cafe24-api-catalog/**` 류 카탈로그성 문서를 후순위/별도 예산으로 분리하고, 브랜치명·열린 plan 의 `spec_impact` 파일을 우선 포함하는 규칙 검토 — 이번 라운드에 `target_path=spec/5-system/` 21개 파일 중 3개만 매 checker 프롬프트에 전문 포함된 근본 원인.
7. `--impl-done` 단계 재검토 시 항목 #1의 4개 spec 갱신이 실제로 같은 커밋에 포함됐는지 명시적으로 확인할 것 (rationale_continuity 제안).