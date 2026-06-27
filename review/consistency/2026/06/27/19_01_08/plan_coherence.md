# Plan 정합성 검토 결과

검토 대상: `plan/in-progress/nav-spec-doc-fix.md`
검토 모드: spec draft (--spec)

---

## 발견사항

### [WARNING] swagger double-wrap 버그 발견이 계획에 미등록
- **target 위치**: `nav-spec-doc-fix.md` § "별도 발견 (본 PR 아님 — 안내 대상)"
- **관련 plan**: 없음 (in-progress 에 swagger double-wrap 을 추적하는 plan 부재)
- **상세**: target 이 `common/swagger/api-wrapped.ts` 의 `wrapPaginatedSchema`/`ApiOkPaginatedResponse` 가 실제 런타임(single-wrap `{data, pagination}`)과 달리 `{data:{data:[],pagination}}` double-wrap 으로 스키마를 생성한다는 버그를 발견했다. "코드(api-wrapped.ts)+convention(swagger.md) 동반 수정 필요 → 별 트랙" 이라고 표기했으나, 해당 버그를 추적할 `plan/in-progress/` 문서가 존재하지 않는다. `pnpm-migration-followups.md` 가 `api-wrapped.ts` 를 참조하지만 deep-import 핀 제거 이슈로 본 버그와 무관하다. `mc-modellistdto-swagger-fix.md` 는 complete 상태로 별개 이슈다.
- **제안**: `plan/in-progress/` 에 swagger double-wrap fix 전용 plan 을 신설하거나, 관련 기존 plan(예: `pnpm-migration-followups.md`)에 별도 항목으로 등재해 추적 가능하게 만들어야 한다. "별도 발견" 섹션만으로는 project 규약상 공식 추적으로 간주되지 않는다.

### [INFO] security-backlog-invitation-token-hash 계획 staleness 미해소
- **target 위치**: `nav-spec-doc-fix.md` § "미포함 (별 트랙)" — "security-backlog-invitation-token-hash plan staleness(§1.5.D 'raw 유지' 확정 미반영). 본 PR 후 안내."
- **관련 plan**: `plan/in-progress/security-backlog-invitation-token-hash.md` — 작업 범위 1항: "§1.5.D Rationale 검토 — 해시 저장 전환 결정 여부 명시", 주의사항: "사용자 결정 필요"
- **상세**: target 이 `spec/5-system/1-auth.md §1.5.D` 에서 invitation 토큰을 raw 유지로 확정됐다는 사실을 파악했다. 그러나 security-backlog 계획은 여전히 TBD("사용자 결정 필요") 상태로 stale 하게 남아있다. target 은 이 staleness 를 인지하고 "본 PR 후 안내"로 적절히 이연했다. 본 PR 의 변경과 직접 충돌하지는 않으나, "본 PR 후 안내" 가 실제로 이행되지 않으면 security-backlog 계획이 영구적으로 stale 상태로 방치될 수 있다.
- **제안**: target 의 접근(본 PR 후 안내)은 허용 가능하다. 다만 이 PR 완료 즉시 `security-backlog-invitation-token-hash.md` 에 "§1.5.D 결정: raw 유지 확정" 을 기록하고 해당 항목을 해소 처리해야 한다. 현재 plan 상태는 변경 불요이나 후속 조치 누락을 방지하는 메모를 남길 것을 권장한다.

### [INFO] 10-graph-rag.md 결함 untracked
- **target 위치**: `nav-spec-doc-fix.md` § "미포함 (별 트랙)" — "#720 impl-done 노출: 10-graph-rag.md self-link/dual-overview. 본 PR 후 안내."
- **관련 plan**: in-progress 에 graph-rag 관련 doc 결함을 추적하는 plan 없음 (`rag-dynamic-cut.md`, `rag-quality-improvement.md`, `rag-rerank-followup.md` 는 구현 관련이며 doc 결함과 무관)
- **상세**: #720 impl-done 이 노출한 `10-graph-rag.md` self-link·dual-overview 결함이 "본 PR 후 안내"로 이연됐으나 추적 계획 없음. swagger 이슈보다 경미(doc 링크 결함)하여 별도 plan 신설 우선순위가 낮다.
- **제안**: 안내 후 별도 spec-doc 정합 플래너 트랙에서 처리. 현재 target 의 범위 제한은 적절하다.

---

## 요약

target 문서(`nav-spec-doc-fix.md`) 는 기존 다른 plan 의 미해결 결정과 직접 충돌하는 항목이 없으며, §2.5/§2.6 swap·§5 false-positive·§2.1 주석 처리 모두 어떤 in-progress plan 에도 열린 결정 없이 독립적으로 진행 가능하다. 다만 "별도 발견"으로 기록된 swagger double-wrap 버그가 in-progress plan 으로 등록되지 않아 추적이 누락될 위험이 있고, security-backlog-invitation-token-hash 계획의 staleness 도 "본 PR 후 안내"로 이연됐으나 실제 후속 조치까지 열린 상태다. 실제 spec 편집 작업(auth-flow 섹션 순서 정정, execution-history 주석 추가)은 어떤 계획의 후속 항목도 무효화하지 않는다.

## 위험도

LOW
