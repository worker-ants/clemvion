# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

> 모드: `--impl-prep spec/4-nodes/4-integration` (M-2 IntegrationOAuthService provider 별 strategy 분리 착수 전 검토).
> 판정: 발견된 WARNING/INFO 는 전부 **대상 spec 영역 자체의 기존 정합성 사안**(planner 도메인)이며 M-2 strategy 분리(facade 명 유지, 내부 구조 = spec 명시 구현 재량)와 무관하다. cross_spec checker 가 "M-2 는 spec 이 '구현 세부 사항' 으로 위임한 범위, facade 명 유지 시 data-flow 다이어그램 무변 → spec 갱신 불요" 로 명시 확인.

## 전체 위험도
**MEDIUM** — `meta.rowCount` 존재 여부 문서 간 상충(naming_collision), `INTEGRATION_AUTH_UNSUPPORTED` 공통 표 미등재(cross_spec + naming_collision 중복), `send_email` 성공 포트 비대칭(convention_compliance) 등 WARNING 6건이 정리 권장 사안이나, CRITICAL 충돌은 없음. **이들은 M-2 비차단 — 별건 planner 정합 작업 대상.**

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec / Naming Collision | `INTEGRATION_AUTH_UNSUPPORTED` 가 `0-common.md §4.2` 공통 에러 코드 표 및 `5-system/3-error-handling.md §1.4` 에 미등재 | `4-nodes/4-integration/1-http-request.md §4.1,§5.8,§6` | `0-common.md §4.2`; `3-error-handling.md §1.4` | `0-common.md §4.2` 에 행 추가(HTTP 한정 주석) 또는 공통 묶음 밖 분리 |
| 2 | Naming Collision | `meta.rowCount` 가 `0-common.md §6`·`node-output.md` 에서 존재 선언하지만 `2-database-query.md §5.1` 은 미배치 명시 | `0-common.md §6`; `node-output.md line 92` | `2-database-query.md §5.1` | `meta.rowCount` 언급 제거 또는 "DB 의도적 생략, `output.rowCount` SoT" |
| 3 | Naming Collision | `CAFE24_*`/`MAKESHOP_*` 에러 코드 카테고리가 `3-error-handling.md §1.4`·`chat-channel-adapter.md §3.1` 미등재 | `4-cafe24.md §6`; `5-makeshop.md §6` | `3-error-handling.md §1.4`; `chat-channel-adapter.md §3.1` | 카테고리 행 추가 / 분류 명기 |
| 4 | Convention Compliance | `send_email` 성공 포트 id `out` 이 `success` 와 비대칭, Principle 5 미정의 | `3-send-email.md §3.2,§5.1,§6`; `0-common.md §3` | `node-output.md` Principle 5 | Principle 5 에 명시 또는 통일 |
| 5 | Convention Compliance | `send-email §5.5` dry-run 출력 표에 `port` 행 부재 | `3-send-email.md §5.5` | `node-output.md` Principle 0,11 | `port` 행 추가 |
| 6 | Cross-Spec | `autoRefresh=true` 대상 목록 — `§9.1` 3개 vs Rationale 2개 내부 모순 | `2-navigation/4-integration.md Rationale` | `2-navigation/4-integration.md §9.1` | Rationale 을 본문과 정렬 |

## 참고 (INFO)

17건 — D4 라우팅/durationMs/SSRF 가드 Rationale 완비(보완 불필요) 다수 + 형식 통일 권장 + 미해결 plan 항목 4건(모두 비차단). 전체 목록은 5개 checker 개별 리포트(`cross_spec.md`/`rationale_continuity.md`/`convention_compliance.md`/`plan_coherence.md`/`naming_collision.md`) 참조.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `INTEGRATION_AUTH_UNSUPPORTED` 미등재(W), `autoRefresh` 목록 불일치(W), `send_email` port(INFO) |
| Rationale Continuity | NONE | 전 결정 Rationale 완비. CRITICAL/WARNING 없음 |
| Convention Compliance | LOW | `send_email` 성공 포트 비대칭(W 2건), 형식 INFO 4건 |
| Plan Coherence | LOW | 미해결 plan 항목 4건 모두 INFO — 착수 직접 차단 없음 |
| Naming Collision | MEDIUM | `meta.rowCount` 상충(W), `INTEGRATION_AUTH_UNSUPPORTED`(W), Cafe24/MakeShop 카탈로그(W), INFO 2건 |

## 권장 조치사항 (전부 별건 planner 정합 — M-2 비차단)

1. `meta.rowCount` 존재 여부 통일(`0-common.md §6`·`node-output.md line 92`).
2. `INTEGRATION_AUTH_UNSUPPORTED` 처리 방향 결정 후 `0-common.md §4.2`·`3-error-handling.md §1.4` 반영.
3. `Cafe24`/`MakeShop` 에러 코드를 `3-error-handling.md §1.4`·`chat-channel-adapter.md §3.1` 등재.
4. `send_email` 성공 포트(`out`) 규약 명문화 또는 통일.
5. `autoRefresh` Rationale 본문 정렬.
6. (INFO) 형식 통일·미해결 plan 항목 추적.

> ⚠️ summary_written=false (workflow terminal write 차단) — 본 파일은 main 이 `summary_markdown` 으로 멱등 persist.
