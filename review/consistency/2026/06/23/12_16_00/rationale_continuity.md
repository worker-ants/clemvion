# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/2-navigation)
검토 일시: 2026-06-23

---

## 발견사항

### 발견사항 없음 — NONE

`spec/2-navigation` 내 모든 검토 대상 문서(`0-dashboard.md`, `1-workflow-list.md`, `10-auth-flow.md`, `11-error-empty-states.md`, `13-user-guide.md`, `14-execution-history.md`, `15-system-status.md`, `16-agent-memory.md`, `2-trigger-list.md`)에서 다음 4개 관점의 위반이 발견되지 않았다.

**관점별 검토 결과:**

1. **기각된 대안의 재도입**
   - `1-workflow-list.md Rationale §1`: "공유 워크플로우 = 팀 워크스페이스 전체(a)" 채택, "(b) `createdBy ≠ 현재 사용자`" 폐기 — 본문 §2.1·§2.3 모두 이를 준수한다.
   - `1-workflow-list.md Rationale §2`: Import permissive config 정책(parse 실패 시 raw 보존) — 본문 §3.2 와 일치한다. config soft-fail vs 구조 hard-fail 분리 원칙이 일관되게 유지된다.
   - `0-dashboard.md Rationale`: Success Rate 분모를 `completed/(completed+failed)` 로 되돌리는 변경 없음. Avg Time 카드 재노출 없음.
   - `14-execution-history.md Rationale R-3`: 단일 `LLM Information` 탭 하위 구조(기각됨)로 되돌아간 내용 없음 — 최상위 평탄화 구조 유지.
   - `11-error-empty-states.md Rationale`: 403 CTA 목적지를 워크스페이스 선택 화면(미구현 surface)으로 복귀시키는 내용 없음 — 대시보드 CTA 유지.
   - `10-auth-flow.md Rationale §R-2`: `[Logo]` 변종을 Full logo 가 아닌 것으로 정의하는 내용 없음.

2. **합의된 원칙 위반**
   - `14-execution-history.md §5`: 목록 API가 `nodeExecutions`를 응답에 포함하지 않는 원칙(R-1 — N+1 회피) 준수. `executionPath: []` 고정 동작도 일관.
   - `14-execution-history.md §2.4 Trigger 출처 분류`: 5종 enum + 판정 우선순위 고정(R-2) — 본문 테이블이 이를 그대로 반영.
   - `0-overview.md Rationale` "forward-only 채택": 별도 DOWN 스크립트 금지 원칙을 우회하는 내용 없음.
   - `0-overview.md Rationale` "execution-level intake 큐": per-node task queue로 되돌아간 설계 없음.
   - `13-user-guide.md R-1`: /docs 내부 사이드바 breakpoint(lg=1024px)가 글로벌(1280px)과 다른 것은 의도된 설계로 문서화됨 — 변경 없음.

3. **결정의 무근거 번복**
   - `3-workflow-editor Rationale`에서 확정된 항목(R-7 인-에디터 실행 히스토리 기존 API 재사용, R-1.3 단일 노드 전용 엔드포인트, R-2.2 유저 귀속 기본 `visibility=private`)을 번복하는 내용이 `spec/2-navigation` 어디에도 없다.
   - `1-data-model.md Rationale` "Execution.execution_path → ExecutionNodeLog" 결정을 무시하고 `execution_path` UUID[] 배열로 되돌아가는 설계 없음.

4. **암묵적 가정 충돌**
   - `14-execution-history.md §5`: `sort` 기본값이 `created_at`이 아닌 `started_at`인 것이 명시적으로 "도메인 오버라이드"로 기록되어 있어 API 규약 §4.1과의 충돌이 Rationale로 해소됨.
   - `15-system-status.md Rationale R-2`: drill-down을 두지 않는 결정(보안 노출면 0 유지)이 명시되어 있고, 본문이 이를 일관되게 따른다.
   - `16-agent-memory.md Rationale`: "별도 화면 vs 노드 에디터 인라인" 결정이 문서화되어 있고, §1 화면 구조가 이를 따른다.
   - `10-auth-flow.md §5.3`: "access token은 URL에 싣지 않는다 (decision A, 2026-05-31)" — `/callback?success=true` 후 `POST /api/auth/refresh`로 발급하는 패턴이 일관되게 기술됨.

---

## 요약

`spec/2-navigation` 영역의 모든 검토 대상 문서는 각 문서 및 관련 spec(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/3-workflow-editor/`)의 `## Rationale`에 기록된 합의 결정과 충돌하는 내용을 포함하지 않는다. 기각된 대안(Import hard-fail 정책, `completed/(completed+failed)` 성공률 분모, 단일 `LLM Information` 하위 탭 구조, 워크스페이스 선택 화면 403 CTA, per-node 큐 등)이 재도입된 사례가 없고, 과거 결정을 번복하면서 새 Rationale 없이 진행하는 항목도 발견되지 않았다. `spec/2-navigation`은 현재 상태 그대로 구현 착수에 적합한 Rationale 연속성을 갖추고 있다.

---

## 위험도

NONE
