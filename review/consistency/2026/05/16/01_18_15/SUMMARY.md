# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음.

검토 모드: `--spec` (spec 반영 직전 검토)
대상: `plan/in-progress/spec-draft-cafe24-private-followup.md`

---

## 전체 위험도

**LOW** — 5개 checker 모두 Critical 없음. WARNING 2건 본 draft 의 v2 갱신에서 해소, INFO 9건 중 5건 흡수 (변경 4 신설 포함), 4건은 후속 plan 권고.

---

## Critical

없음

---

## 경고 (WARNING) — 모두 v2 에서 해소

| # | Checker | 발견 | 해소 방안 |
|---|---------|------|-----------|
| W-1 | Cross-Spec | "N ≤ 2 상한의 구조적 보장" 표현이 V046 partial UNIQUE 의 workspace-scoped 보증과 어긋남 | v2 변경 2 — "같은 workspace 안에서 1개 보장 / 회복 분기는 workspace 횡단으로 N=1~2 가 실무적 값" 으로 완화 표현 |
| W-2 | Naming Collision | 분기 ① 응답 `{ authUrl, state }` 가 §9.2 의 응답 정의와 일치성 불명 | v2 분기 ① 표기를 `authUrl` 포함 수준으로 단순화 + "기타 필드는 §9.2 참조" 명시 — frontend 가 state 를 직접 사용하지 않음을 grep 으로 확인 |

---

## 참고 (INFO) — 흡수 / 후속 분류

| # | Checker | 발견 | 처리 |
|---|---------|------|------|
| I-1 | Cross-Spec | inline alert 패턴이 `spec/0-overview.md §3.4` 에 미정의 | 후속 plan 권고 (본 PR 범위 밖) |
| I-2 | Cross-Spec | flat 경로 grep 잔존분 일괄 교정 권장 | 본 PR 에서 grep 확인 후 잔존 시 함께 교정 |
| I-3 | Rationale Continuity | `onChanged()` 미호출 근거 Rationale 누락 | v2 변경 4 신설로 흡수 |
| I-4 | Rationale Continuity | alert 생존 주기 (`onMutate` reset) Rationale 누락 | v2 변경 4 신설로 흡수 |
| I-5 | Rationale Continuity | TOCTOU 부재 명시가 begin backstop 과의 보증 원리 차이 미구분 | v2 변경 2 보강 — "begin 핸들러 V045 backstop 과 보완 관계, 본 분기는 read-only 라 race 자체 부재" 명시 |
| I-6 | Convention Compliance | 변경 3 flat 경로 노출 맥락 부재 | v2 변경 3 — before/after 명시적 표기 |
| I-7 | Plan Coherence | `spec-update-cafe24-install-recovery` plan 의 Rationale 추가 완료 여부 | 확인 결과 PR #42 로 main 에 merge 완료 — 충돌 없음 |
| I-8 | Plan Coherence | `spec-update-cafe24-app-url-reuse` plan 의 §4.4 갱신 merge 여부 | 확인 결과 PR #39 로 main 에 merge 완료 — 충돌 없음 |
| I-9 | Naming Collision | toast 함수 호출 형태 spec 직접 기재 회피 | v2 — "성공 토스트" / "info 레벨 토스트" 수준으로 추상화 |

---

## Checker별 위험도

| Checker | 위험도 | 비고 |
|---------|--------|------|
| Cross-Spec | LOW | v2 에서 W-1 해소 |
| Rationale Continuity | LOW | v2 변경 4 신설로 I-3·I-4 흡수, 변경 2 보강으로 I-5 흡수 |
| Convention Compliance | LOW | v2 변경 3 명시화로 I-6 해소 |
| Plan Coherence | LOW | 관련 plan 이 main 에 이미 merge — 동시 편집 위험 없음 |
| Naming Collision | LOW | v2 에서 W-2 / I-9 해소 |

---

## 결론

draft v2 에서 모든 WARNING 해소, INFO 5건 흡수, 4건은 후속 plan 권고로 분류. spec 본문 반영 가능.
