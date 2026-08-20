# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 위험도 NONE. `Execution.inputData`/`NodeExecution.inputData` egress 마스킹 카브아웃 폐지(프런트 마커 가드 도입)가 spec 7파일·코드·plan 전반에서 일관되게 반영됐다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `Execution.inputData` 마스킹이 여전히 두 독립 메커니즘(REST/WS egress 값-패턴 vs AI Assistant 키-이름 기반 `maskSensitiveFields`)으로 병존 | `spec/5-system/14-external-interaction-api.md` §R17 "잔여 ③" vs `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 | 조치 불요 — 이미 상호 링크·경계·근거가 문서화됨. 후속 세션이 `Execution.inputData` 마스킹을 다시 건드릴 때 AI Assistant 마스킹도 같은 turn 재검토 대상인지 판단 근거로만 남김 |
| 2 | Naming Collision | `MASKED_MARKERS`/`isMaskedMarker`(frontend 신규) 가 backend `sanitize-error-message.ts` 동명 식별자와 이름이 같음 | `codebase/frontend/src/lib/utils/masked-markers.ts` vs `codebase/backend/src/shared/utils/sanitize-error-message.ts` | 등급 없음(정보 공유). backend 가 SoT, frontend 는 의도적 동일-명명 미러 — plan 문서에도 명문화된 설계 선택이라 제안 없음 |
| 3 | Naming Collision | `isStructuredType`/`isStructuredField`(신설, `rerun-modal.tsx`) 가 기존 여러 파일의 함수-로컬 `isStructured`(출력 envelope 구조화 여부, 다른 의미)와 "구조화됨" 이라는 동일 형용사를 공유 | `codebase/frontend/src/components/editor/rerun-modal.tsx` vs `output-shape.ts`/`presentation-renderers.tsx`/`result-timeline.tsx` 등 | 즉각 조치 불요(스코프 겹치지 않아 컴파일 충돌 없음). 향후 두 개념을 한 파일에서 함께 다룰 경우 `isTriggerParamStructured` 등 더 구체적 접두 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6관점 전부 무모순. 구 카브아웃 문구 잔존 0건(grep 전수). AI Assistant 별도 마스킹 경로와의 의도적 병존만 INFO |
| Rationale Continuity | NONE | §R17 잔여 ②가 스스로 명시한 "닫는 조건"(프런트 마커 가드 3소비처)이 충족되어 예정대로 집행. 취소선으로 이력 보존, 6개 미러 문서 동기화. 인접 결정(webhook ingestion-time 마스킹, node-level 카브아웃 확대 기각)과 비충돌 |
| Convention Compliance | NONE | 명명(backend SoT 미러)·레이어 경계(`frontend-layering.md` §3 준수)·i18n(ko/en parity, 해요체)·spec-impl-evidence(frontmatter `code:` 갱신+실파일 확인)·swagger DTO 문서 전부 준수 |
| Plan Coherence | NONE | `eia-inputdata-marker-guard.md`(구현)·`spec-draft-inputdata-egress-masking.md`(설계)·`spec-sync-external-interaction-api-gaps.md`(트래커) 3개 plan과 완전 정합. 미해결 결정(workflow-assistant 마스킹 우선순위) 우회 없이 카브아웃 캐비엇으로 보존. 후속 항목 전부 트래커 등재 |
| Naming Collision | NONE | 신규 requirement ID·엔티티·API endpoint·이벤트명·ENV/config 키 도입 없음. 유일 신규 코드 표면(`masked-markers.ts`)은 의도적 backend 미러. `MASKED_INPUT_DATA_REASON` 삭제 후 dangling 참조 0건 |

## 권장 조치사항

1. (BLOCK 해소 불요 — Critical 없음)
2. push 진행 가능. 후속 세션에서 `Execution.inputData` 마스킹 로직을 재차 건드리게 되면, `spec/3-workflow-editor/4-ai-assistant.md` §4.1.1 의 `maskSensitiveFields`(키-이름 기반) 도 같은 turn 에서 재검토 대상인지 판단할 것 — 이번 검토에서 병존이 의도적임을 확인했으므로 지금 당장 조치는 불요.
