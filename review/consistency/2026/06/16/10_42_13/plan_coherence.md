## 발견사항

분석 범위: `spec/2-navigation/6-config.md` (worktree `spec-fix-models-errorcode-71cc8a`)에서 이번 커밋이 가한 변경을 `plan/in-progress/**` 전체와 대조.

이번 커밋의 실제 변경 목록:
1. frontmatter: `status: partial` → `status: implemented`, `pending_plans: [spec-sync-config-gaps.md]` 제거
2. `plan/complete/spec-sync-config-gaps.md` 이동 완료
3. §B.6.2 Base URL 셀 및 R-4: 에러코드 `RERANK_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 수정
4. R-1 Rationale: `LLM_MODEL_NOT_FOUND` 하드코딩 제거, LLM Client §6 SoT 위임으로 교체
5. §A.4 권한 섹션: Reveal 만 Admin+ 가드 → 전체 변경 버튼 Admin+ 가드 확대
6. §3 API 표: Admin+ 권한 주석 추가
7. R-2 Rationale: "변경 액션 버튼 전체를 Admin+ UI 가드로 통일" bullet 추가

---

### 발견사항 없음 (적극 확인)

**[INFO] spec-sync-config-gaps.md 이동 — 모든 항목 완료 확인**
- target 위치: frontmatter `pending_plans` 제거 + `status: implemented` 승격
- 관련 plan: `plan/in-progress/spec-sync-config-gaps.md` (worktree의 `plan/complete/`로 이동)
- 상세: `spec-sync-config-gaps.md` 의 모든 항목(`[x]`)이 완료 처리되어 있고, Part A 미구현 gap(§A.2 폼·§A.3 이력·§A.4 Reveal·§편집폼·C-2·God-split·RBAC 가드) 전부 구현 완료 확인. `status: implemented` 승격은 정합.
- 제안: 추적 불요.

**[INFO] spec-draft-unified-model-management.md 와의 경계 확인 — 비충돌**
- target 위치: Part B(Models) 전 영역, §3 Model Config API 표
- 관련 plan: `plan/in-progress/spec-draft-unified-model-management.md` — `spec/2-navigation/6-config.md`를 대상 spec으로 열거(변경 2·6-D·7 참조)
- 상세: `spec-draft-unified-model-management.md`가 `6-config.md` Part B/C 통합을 예고했으나, 해당 변경은 이미 `plan/complete/unified-model-management.md` PR0(commit 88eec577)에서 main에 적용 완료된 상태다. `spec-draft`는 draft 기록 문서로 in-progress에 잔존하지만, 실제 spec 수정은 완료됐으므로 이번 worktree의 Part B 내용 변경(없음 — 이번 커밋은 Part A 및 에러코드 수정만)과 충돌 없음.
- 제안: 추적 불요. `spec-draft-unified-model-management.md`의 in-progress 잔존은 별도 정리 대상이나 본 target 변경과는 무관.

**[INFO] auth-config-webhook-followups.md 잔여 항목과의 경계 확인 — 비충돌**
- target 위치: §3 Authentication API 표(Admin+ 주석), §A.4 권한 섹션
- 관련 plan: `plan/in-progress/auth-config-webhook-followups.md` §3(spec 보완) · §4(reveal rate limiting)
- 상세: `auth-config-webhook-followups.md §3`은 `spec/5-system/1-auth.md §5 API` 표에 reveal 엔드포인트 추가, `12-webhook.md` IP 추출 정책 명시 등을 남기고 있으나 모두 `6-config.md` 이외 파일이 대상이다. `6-config.md`의 권한 섹션·API 표 Admin+ 정비는 `spec-sync-config-gaps.md`에서 RBAC 가드(§A.4·R-2) 완료로 정합하게 문서화됐다. 충돌 없음.
- 제안: 추적 불요.

**[INFO] 에러코드 `MODEL_CONFIG_INVALID` 정정 — LLM Client SoT 확인 권장**
- target 위치: §B.6.2 Base URL 셀, R-4 Rationale
- 관련 plan: `plan/in-progress/spec-draft-unified-model-management.md` 변경 0(마이그레이션 보강)·변경 3(`spec/5-system/7-llm-client.md §5.5` 갱신 예고)
- 상세: 이번 수정으로 `RERANK_CONFIG_INVALID` → `MODEL_CONFIG_INVALID` 로 정정됐고, LLM Client §5.5 가 실제 에러코드 SoT다. `plan/complete/unified-model-management.md` PR4a에서 `MODEL_CONFIG_*` 에러코드 통일이 완료됐다고 기록되어 있어 정합. 별도 plan 충돌 없음.
- 제안: 추적 불요.

---

### 요약

`spec/2-navigation/6-config.md`의 이번 변경(에러코드 정정·권한 섹션 확대·status 승격·pending_plans 제거)은 `plan/in-progress/**` 의 미해결 결정과 충돌하지 않는다. `spec-sync-config-gaps.md`의 모든 항목은 이미 `[x]` 완료 처리된 상태에서 `plan/complete/`로 이동됐으며, `spec-draft-unified-model-management.md`가 `6-config.md` Part B/C를 대상으로 열거하지만 실제 해당 변경은 `plan/complete/unified-model-management.md` PR0에서 이미 적용 완료되어 draft 경계 내에서 비충돌이다. `auth-config-webhook-followups.md`의 미완 §2~4 항목은 `6-config.md` 이외 파일이 대상이라 영향 없다. 전체적으로 plan 정합성 이슈 없음.

### 위험도

NONE
