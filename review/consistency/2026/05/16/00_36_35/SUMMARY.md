# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

검토 모드: `--impl-prep` (구현 착수 전 검토)
대상: `spec/2-navigation/4-integration.md`
구현 범위: Cafe24 Private `request-scopes` UI 안내 누락 수정 (frontend-only)

---

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건(모두 문서 보완 사항, 구현 차단 불필요). INFO 8건.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Rationale Continuity | 폐기된 "mall_id 스캔 + trial HMAC" 패턴을 재도입하는 회복 분기가 기존 폐기 Rationale 과의 명시적 cross-reference 없이 추가됨 | `spec/2-navigation/4-integration.md` § Rationale "Cafe24 install_token mismatch 회복 흐름" | 동 문서 § Rationale "install_token 을 App URL path 식별 키로 승격 (2026-05-14)" | 신규 Rationale 에 "(폐기된 '100건 스캔 + trial HMAC' 와의 차이 — 'install_token 을 App URL path 식별 키로 승격' Rationale 참조)" 문장 추가. N ≤ 2 상한의 구조적 강제(V046 부분 UNIQUE)를 명시해 의도적 허용임을 단언 |
| W-2 | Convention Compliance | Rationale 내 리뷰 경로 참조가 구 flat 형식(`review/consistency/2026-05-14_18-23-55`) 사용 — 현행 nested ISO 경로 규약 불일치 | `spec/2-navigation/4-integration.md` § Rationale "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나" 말미 | `CLAUDE.md` 명명 컨벤션 — `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` | 경로를 `review/consistency/2026/05/14/18_23_55/` 로 교정하거나 일자만 기재(`2026-05-14 consistency 검토 결과`)로 대체. 해당 세션 파일 이동 완료 후 갱신 권장 |
| W-3 | Naming Collision | i18n 키 계열 `requestScopesCafe24PrivatePending*` 가 기존 `cafe24PrivatePending*` 계열과 prefix 패턴이 혼용돼 유지보수 혼동 위험 | `frontend/src/lib/i18n/dict/ko.ts`, `en.ts` (신규 추가 예정 키 3개) | 기존 `cafe24PrivatePendingTitle`, `cafe24PrivatePendingDesc` (신규 통합 등록 흐름, `ko.ts:1623-1624`) | `cafe24PrivateScopeRequestTitle` / `cafe24PrivateScopeRequestDesc` / `cafe24PrivateScopeRequestAdded` 로 rename 검토. 또는 현행 패턴 유지 시 기존 `cafe24PrivatePending*` 계열에 그룹 주석 추가해 의도적 분리 명시 |

→ **본 구현에서 반영**: W-3 권고에 따라 `cafe24PrivateScopeRequest*` prefix 채택. W-1·W-2 는 spec write 권한 밖 (project-planner 위임).

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | i18n 키 `requestScopesCafe24PrivatePendingDesc` 의 영문 안내 문구 기준이 spec §4.4 에 미정의 — 번역자 임의 번역 위험 | `spec/2-navigation/4-integration.md §4.4` | 구현 완료 후 ko/en 번역본을 spec §4.4 에 역반영 |
| I-2 | Cross-Spec | `scopesAdded` 필드의 UI 표현 방식(목록 나열 여부, 축약 표현 여부)이 spec §4.4 에 미정의 | `spec/2-navigation/4-integration.md §4.4` | 구현 후 실제 UI 형태를 spec §4.4 에 한 줄 추가해 역반영 권장 |
| I-3 | Cross-Spec | Cafe24 Public vs Private 분기 처리가 spec §9.2 와 §4.4 에서 일관됨 — 이상 없음 | `spec/2-navigation/4-integration.md §9.2`, `§4.4` | 없음 |
| I-4 | Cross-Spec | inline alert 결정이 spec §4.4 에 미흡수 — spec 은 표시 방식을 열어둔 채 구현이 결정됨 | `plan/in-progress/cafe24-request-scopes-ui.md §결정` | 구현 완료 후 spec §4.4 에 "inline alert(고정 안내문) + toast.info 병행" 방식 한 줄 추가 |
| I-5 | Rationale Continuity | 회복 분기의 read-only 특성상 TOCTOU 위험 없음을 Rationale 이 명시하지 않음 | `spec/2-navigation/4-integration.md` § Rationale "회복 흐름" | "이 분기는 INSERT 없이 read-only 조회이므로 TOCTOU 위험 없음" 한 문장 추가 권장 |
| I-6 | Rationale Continuity | "Cafe24 Public app 가용성 — env 기반 노출" Rationale 은 기존 결정과 충돌 없는 순수 신규 결정 | `spec/2-navigation/4-integration.md` § Rationale | 없음 |
| I-7 | Convention Compliance | §10.4 표에서 API error code(UPPER_SNAKE_CASE) 와 DB status_reason(snake_case) 의 맥락 구분이 컬럼 헤더만으로 불명확 | `spec/2-navigation/4-integration.md §10.4` | 컬럼명 "DB status / status_reason" 으로 구체화하거나 표 하단 주석 추가 |
| I-8 | Plan Coherence | `spec-update-cafe24-app-url-reuse` plan(worktree: `cafe24-app-url-reuse-f9a2e3`)이 동일 spec §4.4 를 갱신 예정 — 파일 경합 없으나 i18n 재검토 필요 | `plan/in-progress/spec-update-cafe24-app-url-reuse.md` | spec 갱신 완료 후 `requestScopesCafe24PrivatePendingDesc` 안내 문구 일치 여부 재확인 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | spec 과 직접 모순 없음. 4건 모두 INFO(구현 후 역반영 권장) |
| Rationale Continuity | LOW | WARNING 1건 — 폐기 결정 cross-reference 누락. INFO 2건 |
| Convention Compliance | LOW | WARNING 1건 — Rationale 내 구 flat 경로 참조. INFO 4건 모두 규약 준수 확인 |
| Plan Coherence | NONE | 병렬 worktree 경합 없음. INFO 1건(i18n 재검토 권장) |
| Naming Collision | LOW | WARNING 1건 — i18n 키 prefix 패턴 혼용. 식별자 직접 충돌 없음 |
