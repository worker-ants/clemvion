# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토 대상: `plan/in-progress/spec-draft-web-chat-console.md`
검토 일시: 2026-06-23

---

## 전체 위험도

**LOW** — Warning 1건(Plan Coherence), INFO 다수. Critical 없음.

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | "선행 B — EIA 배선(partial)" 서술이 현행 plan 완료 상태와 불일치. `channel-web-chat-impl.md`는 EIA 클라이언트(webhook→SSE→submit) 완료[x] 기록. `channel-web-chat-followups.md` 보류 항목은 M2 headless sdk 통합이며 M1 hosted iframe 대화형 미리보기와 무관. "활성 TODO 0건" 종결됨. 이 불일치 미수정 시 Phase 2가 불필요한 blocking prerequisite로 작동해 일정 지연 가능 | `spec-draft-web-chat-console.md §1.4`, §3 Phase 2 | `plan/in-progress/channel-web-chat-impl.md` (EIA 완료[x]), `plan/in-progress/channel-web-chat-followups.md` (M2 sdk 보류, 전체 종결) | §1.4 "선행 B" 정의를 channel-web-chat-impl.md 완료 사실 반영해 재서술. 대화형 미리보기가 선행 A만으로 가능하면 Phase 2 prerequisite 제거 또는 옵션 격하 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `_product-overview §2 비목표` 문구 명확화 — 스니펫 빌더 콘솔이 기존 비목표("서버사이드 관리 콘솔") 설정 당시 고려됐는지 여부 미기술 | `spec-draft §1.2`, §2.2 `_product-overview` 갱신 예고 | `_product-overview` Rationale 갱신 시 "비목표 설정 당시 스니펫 빌더 미검토였음" 또는 "검토 후 현 경계로 한정" 중 하나를 명시해 연속성 확보 |
| 2 | Rationale Continuity | `localStorage` 외형 보존 선택 근거 미기술 — 쿠키·sessionStorage·indexedDB 대안 기각 이유 없음 | `spec-draft §1.2` | `5-admin-console.md §Rationale` 또는 target Rationale에 "localStorage 선택 근거(vs sessionStorage: 탭 닫아도 유지, vs backend: 비목표 준수)" 한 항 추가 |
| 3 | Rationale Continuity | 신규 env `NEXT_PUBLIC_WIDGET_CDN_BASE` — 키 이름 결정 Rationale 미기술. 기존 `NEXT_PUBLIC_WEBHOOK_BASE_URL`/`NEXT_PUBLIC_API_URL`과 분리 이유 미서술 | `spec-draft §1.3` | `spec/7-channel-web-chat/5-admin-console.md §Rationale`에 env 신설 결정 항 추가 |
| 4 | Plan Coherence | `plan/in-progress/web-chat-console.md` 미존재 — spec write 후 `5-admin-console.md`의 `pending_plans:` 등재 시 plan-lifecycle `spec-pending-plan-existence` 가드 차단 위험 | `spec-draft §3`, §2.1 frontmatter `pending_plans:` | spec write(`5-admin-console.md`) 전에 `plan/in-progress/web-chat-console.md` 생성하거나, target §3 Phase 0에 체크박스로 명시 |
| 5 | Plan Coherence | `NEXT_PUBLIC_WIDGET_CDN_BASE` — admin 프론트엔드용 신규 env임을 명시, `0-architecture §4` 플레이스홀더 표에 admin-frontend env 행 추가 여부 미검토 | `spec-draft §1.3` | `5-admin-console.md §5`에 admin 앱 전용 env임 명시, §2.4(변경 없음) 확인 범위에 `0-architecture §4` 행 추가 여부 포함 |
| 6 | Naming Collision | 요구사항 ID prefix 미확정 — draft에 ID 체계 미포함. `NAV-WC-*` 후보이나 기존 prefix 표 일관성 미확인 | spec 반영 단계 | spec 반영 단계에서 prefix 확정 및 `spec/2-navigation/_product-overview.md`에 명시 |
| 7 | Naming Collision | `NEXT_PUBLIC_WIDGET_CDN_BASE`(프론트엔드)와 `WEB_CHAT_WIDGET_ORIGINS`(백엔드)가 동일 CDN origin을 별도 env로 관리하는 상보 구조 — 두 값이 일치해야 함에 대한 spec 명시 없음 | `spec-draft §1.3`, `0-architecture §4` | `0-architecture §4` 플레이스홀더 표에 두 변수를 나란히 등재하고 동일 CDN origin을 각 앱에서 별도 주입하는 관계 명시 |

---

> **주의**: `cross_spec` 및 `convention_compliance` checker 결과 파일이 디스크에 존재하지 않아 내용을 읽을 수 없었습니다(부분 보고). main 이 실재 여부 재확인 — 미존재 시 재실행.

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | N/A (output 파일 확인 필요) | — |
| Rationale Continuity | LOW | 신규 결정(localStorage, NEXT_PUBLIC_WIDGET_CDN_BASE, 비목표 명확화) Rationale 미기술 3건(모두 INFO) |
| Convention Compliance | N/A (output 파일 확인 필요) | — |
| Plan Coherence | LOW | "선행 B EIA 배선 partial" 서술이 impl plan 완료 기록과 불일치(WARNING 1건) + INFO 2건 |
| Naming Collision | NONE | Critical/Warning 충돌 없음. INFO 2건 |

---

## 권장 조치사항

1. **(WARNING 해소 — 일정 영향)** `spec-draft §1.4` "선행 B — EIA 배선" 서술을 `channel-web-chat-impl.md` 완료 상태 반영하여 재서술. M1 hosted iframe 대화형 미리보기가 선행 A(위젯 호스팅)만으로 가능한지 확인 후 Phase 2 prerequisite 제거 또는 옵션 격하.
2. **(spec write 게이트 예방)** `5-admin-console.md` 실제 write 전 `plan/in-progress/web-chat-console.md` 생성, 또는 target §3 Phase 0 체크박스 추가.
3. **(Rationale 보완)** `5-admin-console.md §Rationale`에 localStorage 선택 근거 및 `NEXT_PUBLIC_WIDGET_CDN_BASE` 신설 근거 한 항씩 추가.
4. **(spec 명시)** `spec/7-channel-web-chat/0-architecture.md §4` 플레이스홀더 표에 `NEXT_PUBLIC_WIDGET_CDN_BASE`(admin 프론트엔드)와 `WEB_CHAT_WIDGET_ORIGINS`(백엔드)를 나란히 등재하고 상보 관계 명시.
5. **(spec 반영 단계)** 웹채팅 요구사항 ID prefix(`NAV-WC-*` 또는 별도) 확정 및 `spec/2-navigation/_product-overview.md` 등재.
6. **(재시도)** `cross_spec`, `convention_compliance` checker output 파일 실재 여부 재확인 후 필요 시 재실행.
