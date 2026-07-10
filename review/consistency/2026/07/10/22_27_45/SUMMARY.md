# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — Critical/WARNING 급 모순은 없으나, 이번에 확정된 "standalone presentation 노드 표시물은 새로고침 복원 대상 아님" 경계를 SoT 컨벤션 문서(`conversation-thread.md`)가 아닌 소비 문서(`1-widget-app.md`)에만 반영하려는 계획이 향후 재발견 위험을 남김(WARNING 1건).

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 신규 확정 제약("standalone presentation 노드 표시물은 새로고침 복원 대상이 아니다")이 SoT 컨벤션 문서에 미등록 — 소비 문서(`1-widget-app.md`)에만 기술 예정 | plan §4-1, §2, Rationale R2 | `spec/conventions/conversation-thread.md` §2.1(Presentation 노드 자동 누적 컨트랙트), §7(v2 로드맵) | `1-widget-app.md` §2 정정과 같은 커밋에서 `conversation-thread.md` §2.1 또는 §7 에 1~2문장 cross-ref 추가: "표시-전용 presentation 노드({config,output})는 turn 의 top-level `presentations[]` 로 영속되지 않는다(그 필드는 `source='ai_assistant'` 전용, §1.2). 확장은 5-source enum 영향이 커 v2 검토 사안 — [Widget §2] 참조." |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `_product-overview.md` §2 "비목표(v1→백로그)" 목록에 동일 제약(standalone presentation 복원)이 나열돼 있지 않음 | `spec/7-channel-web-chat/_product-overview.md` §2 | 선택 사항 — `1-widget-app.md` §2 갱신과 함께 한 줄 추가 고려 |
| 2 | cross_spec | 동일 shape 비대칭 서술(`{config,output}` vs `PresentationPayload`)이 이미 3곳(`ai-agent.md` §7.10, `EIA` §5.2, `conversation-thread.md` §1.2)에 흩어져 있어, `1-widget-app.md` §2 가 4번째 서술 지점이 됨 | plan §4-1 | 편집 시 기존 필드명·용어를 그대로 재사용하고 세 문서 cross-ref 유지(현재 §2 원문도 이미 AI Agent §7.10 참조 중 — 패턴 유지) |
| 3 | rationale_continuity | 저장소 선례("v1 범위 밖 기지(既知) 갭은 `0-overview.md §6.3` 로드맵에 미러 등재" — `execution-history.md` R-6, EH-DETAIL-12)와 대비해, R2 가 로드맵 미러 등재 여부를 명시하지 않음(현재 암묵적 "등재 안 함") | plan `## Rationale` R2 | R2 에 "본 갭은 §6.3 로드맵 등재 대상이 아님(이유: 사용 빈도·요청 부재 등)" 한 줄 추가 또는 `0-overview.md §6.3` 에 실제 등재 — 둘 중 하나를 planner 가 명시적으로 선택 |
| 4 | rationale_continuity | `1-widget-app.md` §3.1 "전체 히스토리 복원" 표현이 §2 신규 caveat 과 병치될 때 "모든 콘텐츠 타입 포함 완전 복원"으로 오독될 소지 | `spec/7-channel-web-chat/1-widget-app.md` §3.1 (기존 텍스트, target 미수정 대상) | §3.1 행 말미에 "(standalone presentation 노드 표시물의 예외는 §2 참조)" 상호 참조 추가 |
| 5 | convention_compliance | plan 파일명이 `spec-draft-<name>.md` 관례(SKILL.md·project-planner SKILL §3)를 따르지 않음(bare `widget-presentation-restore.md`) — 단, 저장소에 하이브리드 plan 의 bare-naming 선례 다수 존재해 하드 위반은 아님 | `plan/in-progress/widget-presentation-restore.md` (파일 경로) | 스타일 통일을 원하면 `spec-draft-widget-presentation-restore.md` 로 리네임 가능, 필수 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 사실 주장(§1~§3)은 `conversation-thread.md`·`ai-agent.md §7.10`·`0-common.md §10.4/§10.6/§10.7`·EIA §5.2/§5.3·`data-hydration-surfaces.md` 등과 라인 단위 대조 결과 전부 정합. 유일한 이슈는 신규 확정 제약의 SoT 미등록(WARNING 1) + INFO 2건 |
| rationale_continuity | LOW | R1/R2/R3 모두 기존 spec 문언·git 이력과 대조해 정합 확인("알려진 제약(Planned)" 문구는 #874 시점 inline 서술로 정식 Rationale 아니었음을 확인). 기각 대안 재도입·합의 위반 없음. INFO 2건(로드맵 미러 등재 여부, §3.1 표현 병치) |
| convention_compliance | NONE | 명명·출력 포맷·문서 구조·금지 항목 규약 전부 준수. INFO 1건(파일명 prefix 스타일) |
| plan_coherence | NONE *(디스크 산출 파일 부재 — workflow journal.jsonl 에서 원문 복구, 아래 참고)* | 다른 in-progress plan(`ai-agent-tool-connection-rewrite.md`, `node-output-redesign/*`, `spec-sync-external-interaction-api-gaps.md`)과 실질 충돌·중복·선행조건 훼손 없음. R2 의 "5-source enum 확장 defer" 결정은 `ai-agent-tool-connection-rewrite.md` 의 동일 축 미결정과 정합적으로 병존 |
| naming_collision | NONE | 신규 기능 아닌 spec 정정 + 기존 필드 배선 plan — 요구사항 ID·엔티티/타입·API endpoint·이벤트명·ENV키·파일 경로 6개 관점 모두 신규 도입 없음. plan 파일 경로도 기존 명명 컨벤션과 일치, 동명 충돌 없음 |

**운영 노트**: `plan_coherence` checker 는 workflow manifest 상 `status=success` 로 보고됐으나 지정된 `output_file`(`plan_coherence.md`)이 디스크에 실제로 쓰이지 않은 상태였다. 위양성 BLOCK/재시도 오판을 피하기 위해 워크플로 journal 에서 해당 sub-agent 의 원문 응답을 직접 복구해 검토·반영했다 — 내용은 "발견사항 없음, 위험도 NONE"으로 위 표에 이미 통합됨. (동일 증상이 `SUMMARY.md` 자체에도 발생 — `summary_status=write_blocked`. main Claude 가 멱등 persist 수행.)

## 권장 조치사항
1. (BLOCK 해소 우선) 해당 없음 — Critical 발견 없음, 차단 불필요.
2. WARNING 해소: `1-widget-app.md` §2 정정과 **같은 커밋**에서 `spec/conventions/conversation-thread.md` §2.1(또는 §7 v2 로드맵)에 "standalone presentation 노드 표시물은 durable thread 에 영속되지 않는다" 1~2문장 cross-ref 를 추가해 SoT 를 갱신한다.
3. INFO 선택 반영: (a) `_product-overview.md` §2 비목표 목록에 한 줄 추가, (b) `1-widget-app.md` §3.1 에 §2 예외 상호참조 추가, (c) R2 에 §6.3 로드맵 미러 등재 여부(등재 안 함 사유 또는 실제 등재) 명시, (d) 필요 시 plan 파일명 `spec-draft-` prefix 리네임.
4. 편집 시 `PresentationPayload`/`{config,output}`/`presentations[]` 등 기존 용어를 그대로 재사용해 4번째 서술 지점(`1-widget-app.md` §2)에서 drift 를 만들지 않는다.
