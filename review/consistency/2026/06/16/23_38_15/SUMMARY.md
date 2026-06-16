# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

검토 대상: `spec/7-channel-web-chat/4-security.md`
검토 일시: 2026-06-16 23:38:15
모드: spec draft (--spec)

---

## 전체 위험도

**NONE** — 모든 checker 에서 Critical/WARNING 발견 없음. (cross_spec / rationale_continuity 는 INFO 만, convention_compliance / plan_coherence / naming_collision 은 위배 없음.)

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

없음.

---

## 참고 (INFO)

> 아래 INFO 는 모두 본 변경(refactor 04 m-1: 입력 sanitize 행 deny-by-default 화이트리스트 권장 1줄 추가)과 **무관한 기존 문서의 선택적 명확화 제안**이다. 본 변경 자체에는 위배·INFO 0건.

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | EIA §8.5 CORS "미설정 시 차단" invariant 설명 방식 경미한 비대칭 — 외부 독자가 "빈 목록 = 모든 요청 차단" 오해 소지 약간 있음 | §2, §3 blockquote | (선택) EIA §8.5 footnote 에 "빌트인 CDN origin 은 항상 허용, 차단 대상은 그 외 추가 origin" 한 줄 추가 |
| 2 | Cross-Spec | rate-limit SoT 순환 — target §4 가 수치를 예시("예:")로 표기하면서 12-webhook §6 이 target 을 SoT 로 역참조 | §4 | target §4 수치 확정 또는 webhook spec §6 SoT 표기 정정 |
| 3 | Cross-Spec | EIA §8.4 인용 시 /interact rate-limit(Planned) 과 SSE(구현됨) 상태 구분 없이 "유지" 표기 | §4 | "interact 분당 60/execution(Planned), SSE 동시 3/execution(구현됨)" 으로 상태 병기 |
| 4 | Rationale-Continuity | §3 blockquote (a) 항 "빈 목록 → allow-all" 에 R2 출처 미명시 | §3 blockquote (a) | "(R2 기반: soft 컨트롤, 보안 경계 아님)" cross-ref 한 줄 추가 |
| 5 | Rationale-Continuity | §4 fail-open 설명이 본문 blockquote 와 Rationale R3 에 중복 기술 | §4 blockquote + Rationale R3 | blockquote 에서 "왜" 설명 제거 또는 "(→ R3)" cross-ref 로 대체 |
| 6 | Rationale-Continuity | §3-② API soft 필터의 "선택(opt-in)" 근거가 Rationale 어느 항에도 미기술 | §3-② | R2 항 확장 또는 R4 신설로 근거 명시 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | INFO 3건 — SoT 표기 비대칭·수치 예시 표현의 선택적 명확화, 실질 모순 없음 |
| Rationale-Continuity | NONE | INFO 3건 — 본문-Rationale cross-ref 생략·opt-in 근거 미기술, 연속성 위반 없음 |
| Convention-Compliance | NONE | 위배 없음 |
| Plan-Coherence | NONE | 위배 없음 |
| Naming-Collision | NONE | 위배 없음 |

---

## 판정

본 변경(refactor 04 m-1 — 입력 sanitize 행에 deny-by-default 화이트리스트 권장 추가)은 기각된 대안 재도입·convention 위반·naming 충돌·plan 충돌 없음. INFO 6건은 모두 기존 문서의 선택적 명확화이며 본 변경의 머지를 차단하지 않는다.

**BLOCK: NO**
