# Rationale 연속성 검토 — spec/2-navigation/1-workflow-list.md (태그 필터 멀티→단일 하향)

대상 diff: `spec/2-navigation/1-workflow-list.md` (§1 목업 안내문, §2.3 태그/폴더 필터 행, §3.1 폴더 API 안내문, `## Rationale` §4 신설)

## 발견사항

- **[INFO]** "태그 멀티 선택"은 합의된 설계 결정이 아니라 미착수 상태의 잔존 문구였음
  - target 위치: §2.3 태그 필터 행 (구 문구: `태그 | 태그 멀티 선택 | 미구현 (Planned): ...`)
  - 과거 결정 출처: 없음 — `git log -p` 로 이 문서의 전체 히스토리를 추적한 결과, "태그 멀티 선택"이라는 문구는 최초 초안(#397 이전, 2026년 6월 이전 커밋)에서부터 존재했으나 그 방식(멀티 vs 단일)을 **의도적으로 논의·채택했다는 별도 Rationale 항목은 어느 시점에도 없었다**. PRD `spec/2-navigation/_product-overview.md` NAV-WF-06 도 "폴더/태그 기반 워크플로우 정리(권장)"라고만 되어 있어 멀티/단일 선택 방식을 규정하지 않는다. 즉 "멀티 선택"은 서버 계약(`query-workflow.dto.ts`, `tag?: string` 단일)과 애초에 어긋나 있던 미구현 placeholder 문구였을 개연성이 크며, 채택된 후 번복되는 결정이 아니라 "구현되지 않은 스펙 초안 문구를 실제 구현 가능한 형태로 처음 확정"하는 성격에 가깝다.
  - 상세: `plan/in-progress/spec-sync-workflow-list-gaps.md` 에도 "태그 필터 UI 부재 (§2.3): 서버 `?tag=` 지원, frontend 잔여(태그 멀티 선택 UI)... spec 멀티선택 vs 서버 단일 `?tag=` **결정 필요**" 라고 명시되어 있어, 이 하향 자체가 이미 계획 단계에서 식별되어 있던 미결 사항의 해소임을 뒷받침한다.
  - 제안: 없음 (참고용 기록). 다만 Rationale §4 서두에 "이 문구는 과거 명시적 채택 결정이 아니라 미구현 상태의 초안 placeholder였다"는 한 줄을 추가하면 향후 재검토자가 "번복"으로 오인하는 것을 막을 수 있다 (선택 사항).

- **[INFO]** 신설 Rationale §4 의 근거 기록 충실도 — 서버 계약·엔드포인트 부재·비용 판단·재확장 여지 4가지 모두 명시됨
  - target 위치: `## Rationale` §4 (`### 4. 태그 필터는 단일 free-text 로 하향 (2026-07-06)`)
  - 상세: (1) 서버 `query-workflow.dto.ts` 의 `tag?: string` 단일 계약을 코드 근거로 인용, (2) 태그 목록 조회 엔드포인트 부재를 실제 코드 확인(`workflows.controller.ts`에 tags 관련 엔드포인트 없음, 본 검토에서도 grep 으로 재확인됨)과 일치시켜 기록, (3) "full-stack 확장은 비용 대비 가치가 낮다"는 사용자 결정 명시, (4) "영구 기각이 아니라 현 시점 범위 결정"이라는 재확장 여지를 별도 항목으로 명문화. 4가지 관점 모두 충분히 기록되어 있다.
  - 제안: 없음.

- **[INFO]** §2.3 폴더 필터 행·§3.1 안내문 현행화도 Rationale 신설 없이 이루어졌으나 이는 "결정 번복"이 아니라 "완료된 구현을 문서에 반영"하는 순수 drift 해소이므로 Rationale 대상 아님
  - target 위치: §2.3 폴더 행, §3.1 안내문
  - 상세: `plan/in-progress/spec-sync-workflow-list-gaps.md` 에 폴더 필터는 이미 `[x]` 로 구현 완료 표시되어 있고, 이번 변경은 그 구현 사실을 spec 문구에 반영한 것뿐이다 (기존 "미구현(Planned)" → "폴더 존재 시 노출되는 드롭다운"). 새로운 설계 결정이 아니므로 Rationale 신설 의무 없음.
  - 제안: 없음.

## 검증한 사실관계

- 서버 DTO 재확인: `codebase/backend/src/modules/workflows/dto/query-workflow.dto.ts` 의 `tag?: string` — 배열이 아닌 단일 문자열, Rationale §4 의 주장과 일치.
- 태그 목록 엔드포인트 부재 재확인: `workflows.controller.ts` 에 태그 관련 GET 엔드포인트 없음 — Rationale §4 의 주장과 일치.
- PRD NAV-WF-06 ("폴더/태그 기반 워크플로우 정리", 권장·비필수)는 멀티/단일 선택 방식을 규정하지 않아 이번 하향과 충돌하지 않음.
- 다른 spec/conventions 문서 전수 검색 결과 "태그 멀티 선택"을 원칙으로 명문화한 별도 spec 없음 (`spec/4-nodes/3-ai/3-information-extractor.md`, `spec/5-system/4-execution-engine.md` 의 "멀티" 관련 언급은 multi-turn 대화 재개 로직으로 본 건과 무관).
- plan 문서(`plan/in-progress/spec-sync-workflow-list-gaps.md`)가 이 하향 결정 자체를 "planner 트랙 결정 필요" 항목으로 이미 예고하고 있었음 — 이번 target 변경은 그 예고된 결정의 실행.

## 요약

Rationale 연속성 관점에서 이번 변경은 문제가 없다. "태그 멀티 선택"이라는 구 문구는 과거에 근거를 갖춘 합의된 설계 원칙이 아니라, 서버 단일 계약과 애초에 어긋나 있던 미구현 초안 placeholder였으며, 이는 관련 plan 문서에서도 "결정 필요" 항목으로 이미 식별되어 있었다. 신설된 Rationale §4는 하향 근거(서버 단일 계약, 태그 목록 엔드포인트 부재, full-stack 비용 판단)와 대안 채택 사유(free-text vs select)를 코드 사실과 일치하게 기록했고, 향후 재확장 경로(서버 계약 확장 + 태그 목록 API 동반 도입)까지 명시해 "영구 기각이 아닌 현재 범위 결정"임을 분명히 했다. 기각된 대안의 근거 없는 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 중 어느 것도 해당하지 않는다.

## 위험도

NONE — 결함 없음.
