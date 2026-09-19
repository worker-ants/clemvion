# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건(`convention_compliance`: spec i18n 키 표의 금지어 "엣지")이 있어 차단.

## 전체 위험도
**CRITICAL** — spec 문서(`4-ai-assistant.md` §13 i18n 키 표)가 글로서리 금지어를 담은 채 실제 구현과도 어긋나 있고, 이 정정은 이번 세션(developer, `entity-schema-declaration-drift` plan) 권한 밖이라 planner 턴 인계가 필요하다. 그 외에는 WARNING 5건(대부분 기존에 이미 등재됐으나 미해소인 spec drift)과 INFO 6건뿐이며, 실제 진행 중인 작업(엔티티 인덱스/제약 선언 정정, `spec_impact: none`) 자체는 cross-spec·rationale 관점에서 위험이 낮다(NONE/LOW).

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | i18n 키 표에 금지어 "엣지" 사용 + 실제 구현과 불일치 (`assistant.edgeAdded`→"엣지 추가", `assistant.edgeRemoved`→"엣지 삭제") | `spec/3-workflow-editor/4-ai-assistant.md` §13 "i18n 키" 표, 768~769행 | `spec/conventions/i18n-userguide.md` Principle 6(금지어 "엣지"→"연결선") + 글로서리 SoT(`codebase/frontend/src/content/docs/_glossary.md`) + 실제 구현 `dict/ko/assistant.ts:43-44`(이미 "연결선 추가"/"연결선 삭제") | 표의 두 행을 "연결선 추가"/"연결선 삭제"로 정정해 코드·글로서리와 일치 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 근본 원인이 호출자(developer, `entity-schema-declaration-drift` plan) 권한 밖이라 여기 싣는다. **등급은 CRITICAL, `BLOCK: YES` 그대로다** — 이 표는 차단을 푸는 장치가 아니라 다음 행동(planner 턴)을 지정하는 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/**` 문서 내용(글로서리 용어) 수정은 CLAUDE.md 상 project-planner 소관이고, developer 의 "자기-반증형 소정정" 예외(조건 2: 예고·트리거 문장 한정, 제품 정의/API 계약 제외)에도 해당 안 됨 — i18n 키 값은 UI 카피의 "제품 정의"에 해당 | project-planner | `spec/3-workflow-editor/4-ai-assistant.md` §13 i18n 키 표 768~769행: `assistant.edgeAdded` "엣지 추가"→"연결선 추가", `assistant.edgeRemoved` "엣지 삭제"→"연결선 삭제". 겸사겸사 같은 표 765~772행 보간 문법(`{ }`→`{{ }}`)과 `executionNotInScope`의 "워크플로"→"워크플로우" 오탈자도 같은 턴에 정리 권장 | `review/consistency/2026/09/19/08_07_50/convention_compliance.md` (CRITICAL·WARNING 항목) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 같은 i18n 키 표 안에서 보간 문법 혼재(`{ }` vs `{{ }}`) + `executionNotInScope` "워크플로" 오탈자 | `spec/3-workflow-editor/4-ai-assistant.md` §13, 765~772행 | `spec/conventions/i18n-userguide.md` Principle 3-C(이중 중괄호 컨벤션 고정), 글로서리 "Workflow→워크플로우" | 6개 행 중괄호를 이중 중괄호로, "워크플로"→"워크플로우"로 정정(위 CRITICAL 정정과 같은 turn에 처리 권장) |
| 2 | convention_compliance | `change_summary` 예시 문자열에 금지어 "엣지" | `spec/3-workflow-editor/0-canvas.md` §8.1, 526행 | `spec/conventions/i18n-userguide.md` Principle 6 | 예시를 "노드 3개 추가, 연결선 2개 수정"으로 정정 |
| 3 | convention_compliance | `5-version-history.md` 에 `## Rationale` 섹션 부재 | `spec/3-workflow-editor/5-version-history.md` 전체 | project-planner SKILL "3섹션(Overview/본문/Rationale)" 권장 | 목록 응답 필드 제외 이유·복원 후 페이지 리로드 이유 등을 `## Rationale` 로 분리, 의도적 생략이면 명시 |
| 4 | plan_coherence | `CONTAINER_*` 를 "에러 코드"로 서술 — 이미 등재된 정정 항목이 target 에 반영 안 됨 | `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:633,635,636` | `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-13 등재, 미해소) — 실측(`execution-engine.service.ts:8017`)상 CONTAINER_* 는 메시지 접두일 뿐 `.code` 아님 | 두 파일 frontmatter `pending_plans` 에 해당 plan 추가. 실제 표현 정정 실행은 그 plan 담당 몫 |
| 5 | plan_coherence | "강제 중단(Force)=즉시 중단" 서술이 이미 확정된 cancel 아키텍처 제약("turn 경계에서만 관측")과 정면 충돌 — 미해소 | `spec/3-workflow-editor/3-execution.md:177` §4 | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` §"추가 위임(2026-07-28 #9)"(미해소) | 미구현/Planned 마커 부착 또는 실제 중단 경로 실측 등재. `3-execution.md` 에 `pending_plans` 필드 자체가 없어 최소한 이를 추가할 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `12-workspace.md` Rationale 이 "이미 해소됨"(과거형)으로 서술하나 코드엔 형제 `@Index`(비유일) 잔존 — spec 서사 vs code 잔재 어긋남(spec 간 모순 아님) | `spec/data-flow/12-workspace.md` "personal 워크스페이스 유일성" 절 / `workspace.entity.ts` | 진행 중인 plan 정정(V109 부분 유니크 인덱스 교체)으로 서사가 그대로 사실이 됨 — 별도 조치 불요 |
| 2 | cross_spec | `node.entity.ts` 를 동시에 건드리는 별도 plan 존재(enum 추가 vs 인덱스/제약 정정, 관심사 비중첩) | `codebase/backend/src/modules/nodes/entities/node.entity.ts` | `plan/in-progress/marketplace-and-plugin-sdk.md` L90 | 조치 불요 — 두 plan 이 동시에 진행 단계로 오르면 diff 겹침만 확인 |
| 3 | rationale_continuity | Workspace→User FK `onDelete` 정정이 "user 참조 FK 13개는 유저 삭제 앱 경로가 없어 인덱스를 안 둔다 — 유저 삭제 추가 시 13개 재처분" 게이트의 대상 중 하나. 이번 정정은 선언-실재 정합화일 뿐 "유저 삭제 기능 추가"가 아니므로 게이트를 발동시키지 않음 | `plan/in-progress/entity-schema-declaration-drift.md` 표 #8 / `spec/1-data-model.md` Rationale "FK 서른하나의 처분" | 커밋 메시지/PR 본문에 "이 정정은 §Rationale '13개 재처분' 게이트를 발동시키지 않는다"는 한 줄 남길 것(강제 아님) |
| 4 | convention_compliance | `5-version-history.md` frontmatter `id` 가 형제 문서 basename 패턴과 다름(`id: workflow-version-history` vs 기대값 `version-history`) | `spec/3-workflow-editor/5-version-history.md` 2행 | 의도된 명명이면 사유를 명시, 아니면 `version-history`로 정정(grep 결과 충돌 없음, 강제 위반 아님) |
| 5 | plan_coherence | 현재 plan(`entity-schema-declaration-drift`)의 `workflow-assistant-session.entity.ts` 수정이 `4-ai-assistant.md` 의 `code:` glob 에 걸려 `--impl-done` 스코프가 자동 확장됨 — 이미 예고된 결과, 문제 아님 | `spec/3-workflow-editor/4-ai-assistant.md` frontmatter `code:` | 조치 불요 — `--impl-done` 시 이 spec 파일이 diff-scope 에 걸려도 "관련 없음"으로 정상 통과 예상 |
| 6 | naming_collision | 이번 `--impl-prep` 호출의 scope(`spec/3-workflow-editor/`)가 실제 작업 도메인(backend entity 인덱스/제약 정정)과 무관 — 다른 plan 템플릿에서 복사된 체크리스트 항목으로 보임 | `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트 `--impl-prep spec/3-workflow-editor/` 항목 | 체크리스트 스코프 문자열을 실제 대상에 맞게 정정하면 이후 impl-prep 게이트가 관련 코퍼스를 검토하게 됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 대상 plan 의 엔티티 정정 8건 전부 기존 spec 사실과 일치. INFO 3건(서사-코드잔재 어긋남·동시편집 노트·스코프 무관) |
| rationale_continuity | LOW | 관련 Rationale 전부 정합, 기각된 대안 재도입 없음. FK 13개 재처분 게이트 관련 INFO 1건만 |
| convention_compliance | MEDIUM(CRITICAL 포함) | i18n 글로서리 금지어 "엣지" CRITICAL 1건 + 보간 문법 혼재·예시 문자열·Rationale 부재 WARNING 3건 |
| plan_coherence | MEDIUM | 기존에 이미 등재됐으나 두 달 가까이 미해소인 spec drift 2건(`CONTAINER_*` 코드 서술, Force 즉시중단 서술) 재확인. 둘 다 대상 파일 `pending_plans` 누락 공통 결함 |
| naming_collision | NONE | 신규 식별자 충돌 없음(전수 grep). scope 불일치 INFO 1건만 |

## 권장 조치사항
1. (BLOCK 해소 최우선, planner 턴) `spec/3-workflow-editor/4-ai-assistant.md` §13 i18n 키 표의 "엣지 추가"/"엣지 삭제"를 "연결선 추가"/"연결선 삭제"로 정정 — 이 세션(developer)은 spec 쓰기 권한이 없으므로 project-planner 턴으로 인계.
2. 같은 planner 턴에 §13 표 보간 문법(`{ }`→`{{ }}`) 통일과 `executionNotInScope` "워크플로"→"워크플로우" 오탈자, `0-canvas.md` §8.1 예시 문자열의 "엣지"→"연결선"도 함께 정리(WARNING 1·2).
3. `2-edge.md`·`0-canvas.md`·`3-execution.md` 의 `pending_plans` frontmatter 에 각각 `spec-draft-nullable-notation-followups.md`·`spec-update-node-cancellation-shutdown-classification.md` 를 추가해 기존 미해소 drift 를 추적 가능하게 할 것(WARNING 4·5) — 실제 표현 정정 자체는 해당 plan 의 담당 몫.
4. `5-version-history.md` 에 Rationale 섹션 추가 여부 검토(WARNING 3), `id` frontmatter 명명 정정 여부 검토(INFO 4).
5. 위 1~4 는 모두 spec 문서 정정이라 이번 developer 세션(`entity-schema-declaration-drift`, `spec_impact: none`)의 실제 작업(엔티티 인덱스/제약 선언 8곳 정정)과는 분리해 진행 가능 — 그 작업 자체는 cross_spec/rationale_continuity 상 위험 NONE/LOW 로 별도 차단 사유 없음. 다만 이번 세션의 plan 체크리스트 `--impl-prep spec/3-workflow-editor/` 스코프 표기가 실제 도메인과 무관하다는 점(INFO 6)은 plan 정리 시 함께 바로잡을 것.
