이제 필요한 정보를 모두 확인했습니다. Plan Coherence Check 결과를 작성합니다.

---

## Plan Coherence Check 결과

**대상**: `plan/in-progress/spec-draft-cafe24-pending-polish.md`  
**모드**: spec draft 검토 (`--spec`)  
**기준 최신 consistency check**: `review/consistency/2026-05-14_17-49-11/` (BLOCK: **NO**)

---

### 발견사항

---

**[WARNING]** Legacy path 폐기 후속 항목 — spec draft 약속 vs `cafe24-pending-polish.md` 누락

- target 위치: DRAFT 2I Rationale "install_token 을 App URL path 식별 키로 승격" 단락 끝
- 관련 plan: `plan/in-progress/cafe24-pending-polish.md` 전체 체크리스트
- 상세: DRAFT 2I는 "영구 폐기 시점은 `plan/in-progress/cafe24-pending-polish.md` 의 후속 항목으로 추가"라고 명시하나, 해당 plan에는 이 항목이 존재하지 않는다. spec이 약속한 후속 추적이 구현 plan에 반영되지 않으면, spec 적용 후 legacy path (`/oauth/install/cafe24` → 410 Gone) 영구 폐기 시점 관리가 소실된다.
- 제안: spec draft 적용 직후 `cafe24-pending-polish.md`에 다음 항목 추가: `[ ] legacy path CAFE24_INSTALL_LEGACY_PATH(410) 영구 폐기 시점 확인 — 운영 데이터·외부 등록 URL 잔존 여부 확인 후 별도 plan 또는 본 plan 후속 항목으로 처리`

---

**[WARNING]** `integration_oauth_state` V041 마이그레이션 의존성 미추적 (17-49-11 W6)

- target 위치: DRAFT 3D §2.1 `integration_oauth_state` 행 — `provider_meta (encrypted JSONB), V041 추가`
- 관련 plan: `plan/in-progress/cafe24-pending-polish.md` 변경 2/3 구현 단계
- 상세: DRAFT 3D는 data-flow §2.1 schema 매핑에 `provider_meta` 컬럼(V041 migration)을 명시한다. 최신 consistency check(17-49-11 W6)도 이 V041 의존성을 지적했다. 구현 plan의 변경 2/3 체크리스트에는 V041이 선행 조건으로 명시되지 않아, 구현 착수 시 migration 순서가 역전될 위험이 있다.
- 제안: `cafe24-pending-polish.md` 변경 2 첫 항목 앞에 `[ ] 선행 확인: `integration_oauth_state.provider_meta` (V041 migration) 적용 여부 — V041 미적용 시 DRAFT 3D spec이 실제 schema와 불일치` 항목 추가.

---

**[INFO]** `resource_not_found`의 spec 내 이중 처리 — 구현 범위 잠재적 혼란 (17-49-11 W1 기록)

- target 위치: DRAFT 3B `spec/data-flow/integration.md` §3.2 pending_install 행
- 관련 plan: `cafe24-pending-polish.md` 변경 0 (`markIntegrationCallbackError`), 변경 5 테스트 (`RESOURCE_NOT_FOUND` 경로)
- 상세: DRAFT 3B는 `resource_not_found`를 `pending_install` status_reason 후보값으로 열거한다. 그러나 DRAFT 1C는 "row 자체가 사라진 케이스라 status_reason 갱신이 불가능 — §10.4 표에서 '변경 불가'로만 다룬다"고 명시하며, DRAFT 2G §10.4도 "변경 불가"로 처리한다. 최신 check(17-49-11 W1)도 동일하게 지적했다. 구현 plan 변경 5 테스트 항목이 "`RESOURCE_NOT_FOUND` 경로에서 `markIntegrationCallbackError` 호출하는지"를 검증하도록 되어있어, 개발자가 DRAFT 3B를 보고 status_reason 갱신을 시도하는 오구현 위험이 있다. (단, `markIntegrationCallbackError` 설명에 "row가 없으면 무시"가 이미 포함되어 있어 실제 구현 충돌은 낮음)
- 제안: 변경 5 테스트 항목을 "`RESOURCE_NOT_FOUND` 경로에서 `markIntegrationCallbackError`가 호출되고 **row 부재 시 no-op 처리**되는지"로 명시적으로 보강.

---

**[INFO]** `spec-update-cafe24-pending-polish.md` 위임 항목 커버리지 — 확인 완료

- 해당 파일 존재 확인 (committed). 위임 항목 A/B/C/D가 spec draft에 모두 반영됨:
  - A (data-model §2.10 status/install_token/status_reason/인덱스): DRAFT 1A–1D ✓
  - B (4-integration.md §6/§3.2/§9.2/§9.4/§10.4): DRAFT 2D/2C/2E/2K/2G ✓
  - C (data-flow §3.2 status_reason 매핑): DRAFT 3B ✓
  - D (Rationale 섹션 신설): DRAFT 2I ✓

---

**[INFO]** `node-output-redesign` plan — worktree 미명시, 경합 없음

- target 위치: DRAFT 2J (spec/4-nodes/4-integration/4-cafe24.md 수정)
- 관련 plan: `plan/in-progress/node-output-redesign/README.md` (frontmatter 없음, worktree 불명)
- 상세: node-output-redesign은 `spec/4-nodes/`를 전체 검토하지만 cafe24.md를 명시적 대상 노드로 열거하지 않는다 (HTTP Request·Database Query·Send Email 3종만). spec draft가 수정하는 §9.4/§9.8/§10 CHANGELOG/§14.2는 cafe24 전용 설치 흐름으로 output 재설계 대상과 내용 상 겹치지 않음. 경합 위험 낮음.

---

**[INFO]** 최신 consistency check (17-49-11) BLOCK: NO 확인

- 6개의 새 세션(17-00-12 ~ 17-49-11) 중 마지막이 BLOCK: NO. Critical 0건.
- 남은 9건 WARNING 중 W8(§10.2 step 4), W2(Rationale cross-ref)는 현재 spec draft(DRAFT 2H, 2J-bis)에서 이미 해소됨 — 해당 DRAFT들이 체크 이후 추가된 결과.
- §11.1 만료 스캐너 본문 갱신(W7)은 spec draft가 forward-ref(DRAFT 2J-ter)만 추가하고 §11.1 본문을 직접 갱신하지 않은 채로 남아 있으나, 구현 plan 변경 4 의 스캐너 확장 범위가 §11 spec 갱신을 포괄할 예정이므로 구현 착수 전 project-planner 위임으로 처리 가능.

---

### 요약

spec draft는 `spec-update-cafe24-pending-polish.md`의 위임 항목 A–D를 완전히 포괄하며, 최신 consistency check(17-49-11) 결과 BLOCK: NO가 확인되어 spec 파일 적용 진행이 가능하다. 구현 착수를 차단할 CRITICAL 위험은 없다. 두 건의 WARNING — (1) spec draft가 약속한 legacy path 폐기 후속 항목이 `cafe24-pending-polish.md`에 미등재, (2) V041 migration 의존성이 구현 plan에 미명시 — 은 spec 적용 직후 구현 plan 보강으로 해소할 수 있다.

### 위험도

**LOW**