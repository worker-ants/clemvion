# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 CRITICAL 0건. WARNING 1건(WS 문서 frontmatter `code:` 누락)만 존재하며 나머지는 INFO 또는 NONE.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/5-system/6-websocket-protocol.md` frontmatter `code:` 가 이번 PR 이 §4.1 `execution.snapshot` 행에 명문화한 마스킹 관문 구현 파일(`executions.service.ts`, `redact-stored-error.ts`)을 누락 — **같은 PR 의 자매 문서 3곳(EIA·execution-history·background)은 모두 반영** | `spec/5-system/6-websocket-protocol.md` frontmatter `code:` | `spec/conventions/spec-impl-evidence.md §2` | `code:` 에 두 항목 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 제안 |
|---|---------|------|------|
| 1 | Convention Compliance | 값-패턴 egress 마스킹 정책이 전용 `conventions/*.md` 없이 5개 spec 에 분산 서술 | 즉시 조치 불요. 소비처가 더 늘면 `conventions/error-redaction.md` 신설 검토 |
| 2 | Rationale Continuity | "미결 → 결정" 전환 2건이 날짜·근거·열거형 범위·잔여 갭을 모두 갖춘 **모범 사례** | 조치 불요 — 향후 유사 전환의 템플릿 |
| 3 | Naming Collision | `pending_plans` 이중 용법 — 이번 PR 이 처음 문서화 | 조치 불요. 장기적으로 plan 레벨 전용 키(`blocked_by`) 개명 고려 가능 |
| 4 | Naming Collision | `1-data-model.md` 의 "응답 마스킹" 라벨이 값-패턴/egress 와 키-이름/write-time 둘을 가리킴 | 실질 조치 불필요 — 각 항목이 SoT 링크·⚠️ 캐비엇으로 구분됨 |
| 5 | Cross-Spec | `EIA §8.1` 의 URL 축약 인용 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | **NONE** | 6개 변경 spec 과 실코드(`redact-stored-error.ts`, `ExecutionsService` 4경로, `BackgroundRunsService`, WS gateway) **완전 일치**. 직전 두 라운드 WARNING 2건(무조건문·"같은 두 컬럼" 모호성) 수정 확인 |
| Rationale Continuity | **NONE** | "미결 → 결정" 전환 2건 모두 근거·범위·잔여갭 명시, 기각 대안 재도입 없음 |
| Convention Compliance | LOW | WARNING 1건 외 명명·출력포맷·레이어분리·문서구조 모두 준수 |
| Plan Coherence | **NONE** | 트래커 I1·D 가 이번 diff 로 `[x]` 반영, plan rename 5건의 상대경로도 동반 갱신되어 **dangling 없음** |
| Naming Collision | LOW | 신규 함수/타입 전역 유일성 확인. impl-prep 지적(`redactExecutionErrorValue`)은 개명으로 해소 |

## 권장 조치사항
1. `6-websocket-protocol.md` frontmatter `code:` 에 두 항목 추가
2. (선택, 장기) 전용 convention 문서 신설 검토
3. 그 외 INFO 는 문서가 self-disambiguation 을 갖춰 조치 불요

---

> **조치 (main)**: WARNING 1 **반영**. `code:` 에 `redact-stored-error.ts` ·
> `executions.service.ts` 추가.
>
> **또 자매 비대칭이다** — 자매 문서 **4곳 중 3곳만** 갱신했다. 하필 이 PR 이 다루는 결함이
> *"자매 표면 중 하나만 고친다"* 인데, spec frontmatter 에서 같은 실수를 했다.
> spec 편집이라 게이트(codebase 스코프)를 재발화시키지 않아 이 턴에서 닫았다.
