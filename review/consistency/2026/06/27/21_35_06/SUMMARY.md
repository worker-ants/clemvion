# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불요.

검토 대상: `spec/7-channel-web-chat/4-security.md`
검토 모드: `--spec`
일시: 2026-06-27 21:35:06

---

## 전체 위험도

**LOW** — 단일 WARNING(plan 체크박스 stale) 존재, target 자체 변경 불요. 5개 checker 모두 Critical 0건.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | `web-chat-quality-backlog.md §D` 의 6개 항목(R5 신설·I1·I2·I3·I4·I5/I6)이 target에 이미 구현돼 있으나 체크박스가 모두 `[ ]` stale 상태 | `4-security.md` §4·§R2·§R3·§R4·§R5·frontmatter | `plan/in-progress/web-chat-quality-backlog.md §D` | plan 측 6개 `[ ]` → `[x]` 업데이트 필요 (target 변경 불요) |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `interactionAllowedOrigins` 빈 배열 vs null 표현 단위 차이 — EIA §8.5 "미설정 시 차단" 기준이 null인지 `[]`인지 명시 불일치 | `4-security.md §3` blockquote vs `EIA §8.5` | 현행 유지. 필요 시 EIA §8.5 에 "빈 배열과 null 모두 추가 origin 0으로 취급" 1문장 추가 가능 |
| 2 | Cross-Spec | `0-architecture §R1` "완전 분리"와 `4-security §R5` `allow-same-origin` 허용 간 긴장 — target 이 §R5 carve-out으로 명문화해 해소 | `4-security.md §R5` vs `0-architecture.md §R1` | 현행 유지. 충돌 없음 |
| 3 | Cross-Spec | rate-limit 수치(10/분, 20/시간)가 target("예:" 표현)과 webhook.md("기본값" 표현)에서 표현 단위 미세 차이, webhook.md가 이미 SoT 방향 명시 | `4-security.md §4` vs `12-webhook.md §6·WH-SC-05` | 현행 유지. 충돌 없음 |
| 4 | Cross-Spec | sanitize 정책 책임 분담 — `NF-SC-05`(시스템 전체) vs `§1.1`(렌더러별 구현 세부) 자연스러운 계층 분담 | `4-security.md §1.1` vs `spec/5-system/_product-overview.md NF-SC-05` | 현행 유지 |
| 5 | Convention Compliance | `id: web-chat-security` 가 basename `4-security` 와 다르나, 충돌 방지 prefix 패턴(`spec-impl-evidence §2.1`)을 따른 의도적 선택이며 frontmatter 주석으로 명문화됨 | `4-security.md` frontmatter | 현행 유지. basename 기반 `id: 4-security` 로 단순화도 가능(규약 위반 아님) |
| 6 | Plan Coherence | EIA §8.4 interact 분당 60 미구현 — target이 "Planned(미구현)"으로 정직 기재, `spec-sync-external-interaction-api-gaps.md` 가 동일 항목을 open 추적 중. 정합 유지 | `4-security.md §4` | 변경 불요 |
| 7 | Plan Coherence | WH-NF-02 1MB 임계 미결 — target이 32KB(공개 webhook) 범위로 한정, 결정 후 옵션 A 채택 시 동기화 필요 가능 | `4-security.md §4` vs `spec-sync-webhook-gaps.md WH-NF-02` | WH-NF-02 결정 후 `4-security.md §4` 검토 backlog 메모 권장. 현 시점 변경 불요 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 모든 교차 참조(EIA §8.5, webhook §6, 0-architecture §R1·R5, 3-auth-session §R3)가 정합. INFO 4건(어감·표현 단위 차이) |
| Rationale Continuity | NONE | 검토 8 포인트 전부 이상 없음. 기각된 대안 재도입·invariant 직접 위반 없음 |
| Convention Compliance | NONE | 3섹션 구조·frontmatter 스키마·명명·API endpoint·DTO 참조 모두 규약 준수. INFO 1건(id basename 이탈, 의도적 carve-out) |
| Plan Coherence | LOW | WARNING 1건 — `web-chat-quality-backlog.md §D` 6개 체크박스 stale. target 자체는 정확함 |
| Naming Collision | NONE | 서비스명·환경변수·endpoint·spec ID 전부 기존 corpus와 동일 의미로 일관 사용. 신규 충돌 없음 |

---

## 권장 조치사항

1. **(WARNING 해소)** `plan/in-progress/web-chat-quality-backlog.md §D` 의 6개 `[ ]` 항목을 `[x]` 로 업데이트한다. 해당 항목들은 target `4-security.md` 에 이미 완전 반영돼 있어 target 수정은 불요하다.
   - `[ ] R5 신설` → `[x]`
   - `[ ] §4 EIA §8.4 인용 — SSE 동시 3 vs interact 분당 60 구분 기재(I1)` → `[x]`
   - `[ ] R2 — 인증 webhook embed-config enforce:false 결정 Rationale(I3)` → `[x]`
   - `[ ] Rationale — CORS(empty→CDN-only) vs 임베드(empty→allow-all) 비대칭 의도된 설계(I4)` → `[x]`
   - `[ ] id↔basename 불일치 주석 · ## Overview 섹션 추가(I5/I6)` → `[x]`
   - `[ ] spec/5-system/12-webhook.md POST 전용 SoT에 /embed-config 서브경로 스코프 한정 문구(I2)` → `[x]`

2. **(선택적 후속)** WH-NF-02(1MB 임계) 결정이 내려지면 `4-security.md §4` 본문(32KB 공개 webhook 기술)의 동기화 여부를 확인한다.

3. **(선택적 후속)** EIA §8.5 에 "빈 배열과 null 모두 추가 origin 0으로 취급" 1문장 추가 — 현행 유지도 무방.
