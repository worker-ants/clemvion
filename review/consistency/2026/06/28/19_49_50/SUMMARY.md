# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 작업 계속 진행 가능.

## 전체 위험도
**LOW** — 정식 규약 직접 위반 없음. WARNING 2건(anchor 정확성 수동 확인 권장, plan 간 연동 추적 메모 권장)이 있으나 차단 불필요.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | P-2 링크 anchor `#6-구현-파일-구조` 가 `12-webhook.md` 실제 섹션 heading slug 와 불일치 가능성 | `plan/in-progress/webhook-spec-pointer-cleanup.md` P-2 라인 | `spec/5-system/12-webhook.md` 섹션 heading | `12-webhook.md` 를 직접 확인해 `## 6 구현 파일 구조` 또는 동등 한국어 heading 의 anchor slug 를 검증 후 수정 |
| 2 | Plan Coherence | P-2 가 추가하는 "Guard trigger DB 조회 실패 시 fail-open + error 로깅" 포인터는 현행 SoT(`12-webhook.md §6`) 반영이라 현재 충돌 없으나, `webhook-public-ip-failopen-hardening.md` 결정 확정 시 `4-security.md §4+R3` 재검토 필요 | `plan/in-progress/webhook-spec-pointer-cleanup.md §필수 P-2` | `plan/in-progress/webhook-public-ip-failopen-hardening.md §결정 필요` | P-2 수행 후 `webhook-spec-pointer-cleanup.md` 에 "failopen-hardening 결정 확정 시 P-2 결과물 재검토 필요" note 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | P-1: `api-convention §5.3` 에 CWE-209 포인터 추가 — `error-handling §1.3` SoT 역참조, 충돌 없음 | `spec/5-system/2-api-convention.md §5.3` | 해당 없음 |
| 2 | Cross-Spec | P-2: `4-security §4` 의 fail-open 기술이 Guard DB 조회 실패 경로를 누락한 부분 보완 — `12-webhook §6` SoT 범위 내 | `spec/7-channel-web-chat/4-security.md §4 + R3` | P-2 추가 문구가 `12-webhook §6` 범위를 넘지 않는지 작성 시 확인 |
| 3 | Cross-Spec | P-3: `extractClientIpFromHeaders` 명시 + `12-webhook §7e·§8b` 역참조 — 기존 여러 spec 에 분산 서술된 사실 명문화 | `spec/5-system/1-auth.md Rationale 2.3.B m-3` / `spec/5-system/12-webhook.md §7e·§8b` | 해당 없음 |
| 4 | Cross-Spec | P-4: `3-error-handling.md` 에 `## Overview` 절 추가 — 컨벤션 미준수 결손 교정 | `spec/5-system/3-error-handling.md` | 해당 없음 |
| 5 | Rationale Continuity | P-1~P-4 모두 기존 Rationale 에서 기각된 대안을 재도입하지 않음. CWE-209 금지·fail-open+error 로깅·헤더 기반 IP 추출·3섹션 구성 원칙과 완전 정합 | P-1~P-4 전체 | 해당 없음 |
| 6 | Convention Compliance | frontmatter 에 비표준 `branch` 필드 포함 — 허용 추가 필드 범주에 해당하므로 위반 아님 | `plan/in-progress/webhook-spec-pointer-cleanup.md` frontmatter | 유지 시 `plan-lifecycle §4` 예시 목록에 `branch` 추가 가능(선택) |
| 7 | Convention Compliance | plan 문서에 3섹션 구성(Overview/본문/Rationale) 미적용 — plan 문서는 해당 규약 적용 대상 아님 | `plan/in-progress/webhook-spec-pointer-cleanup.md` | 해당 없음 |
| 8 | Plan Coherence | P-3(`1-auth Rationale 2.3.B m-3` 함수명 추가)과 `webhook-public-ip-failopen-hardening §후속`(`1-auth §2.3` 세션 정책 행 갱신)이 중첩 가능 — 같은 행 덮어쓰기 아니라 merge-time 충돌 위험 낮음 | `plan/in-progress/webhook-spec-pointer-cleanup.md §선택 P-3` | `webhook-public-ip-failopen-hardening` plan §후속에 "P-3 으로 Rationale m-3 함수명 추가됨" 추적 메모 추가 |
| 9 | Plan Coherence | 상위 plan `webhook-hardening-cleanup.md` 의 `push + PR` 단계 미완료 상태에서 본 plan 파생 — 논리적 의존성 없음 | `plan/in-progress/webhook-hardening-cleanup.md §워크플로` | 의존성 없으므로 대기 불필요 |
| 10 | Naming Collision | P-1~P-4 전체에서 신규 식별자(요구사항 ID·엔티티명·endpoint·이벤트명·ENV key·파일경로) 신설 없음 | 전체 | 해당 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | P-1~P-4 모두 기존 spec 정의와 충돌 없음. 단방향 포인터·역참조·절 보강에 그침 |
| Rationale Continuity | NONE | 기각된 대안 재도입 없음. 합의된 설계 원칙과 완전 정합 |
| Convention Compliance | LOW | `branch` 비표준 frontmatter 필드(허용 범주), P-2 anchor slug 불일치 가능성(WARNING) |
| Plan Coherence | LOW | P-2 결과물이 `webhook-public-ip-failopen-hardening` 결정 확정 시 재검토 필요(WARNING). P-3 와의 중첩은 추적 메모 수준 |
| Naming Collision | NONE | 진정한 신규 식별자 신설 없음 |

## 권장 조치사항

1. **[WARNING 1 해소]** P-2 작업 전 `spec/5-system/12-webhook.md` 를 열어 `## 6` 으로 시작하는 섹션의 실제 heading 텍스트를 확인하고, plan 내 anchor `#6-구현-파일-구조` slug 가 일치하는지 검증한 뒤 불일치 시 plan 또는 최종 spec 링크를 수정한다.
2. **[WARNING 2 해소]** P-2 수행 완료 후 `plan/in-progress/webhook-spec-pointer-cleanup.md` 에 "향후 `webhook-public-ip-failopen-hardening.md` 결정 확정 시 P-2 결과물(`4-security.md §4+R3`) 연동 재검토 필요"라는 note 를 추가한다.
3. **[INFO 8 선택]** `plan/in-progress/webhook-public-ip-failopen-hardening.md §후속` 에 "P-3(`webhook-spec-pointer-cleanup`) 으로 `1-auth Rationale 2.3.B m-3` 에 함수명 추가됨 — 결정 확정 시 §2.3 세션 정책 행 갱신과 분리 적용 가능"을 추적 메모로 기록한다(선택).
