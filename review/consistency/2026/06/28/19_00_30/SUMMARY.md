# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 동작 보존 순수 리팩터링. 발견된 모든 항목은 INFO 수준의 spec 문서 명명·참조 비일관성이며, 기능적 위반·계약 충돌·RBAC 오류는 없음.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `12-webhook.md §7` 흐름 기술이 제거된 래퍼 함수명 `extractClientIp` 를 직접 인용 (실제 코드는 `extractClientIpFromHeaders`) | `spec/5-system/12-webhook.md` L358·L365 | `extractClientIpFromHeaders` 로 동기화하거나 동작 기술로 추상화. `webhook-hardening-cleanup.md §C` 범위로 처리 |
| 2 | Cross-Spec | `1-auth.md §2.3` 표의 IP 추출 순서(`XFF → req.ip → socket.remoteAddress`)가 Rationale 2.3.B 의 `req.ip` 기각 결정을 webhook/rate-limit/ip_whitelist 경로에서 반영하지 않음 | `spec/5-system/1-auth.md §2.3` | `§2.3` 표의 "클라이언트 IP" 행을 세션·감사 경로 vs webhook/rate-limit/ip_whitelist 경로로 분리 기술. `webhook-hardening-cleanup.md §C` 범위로 처리 |
| 3 | Convention Compliance | `1-auth.md §1.5.4` 주석의 historical-artifact 범위 기술이 `error-codes.md §3` 레지스트리에 등재된 초대 모듈 7종 코드를 포함하지 않아 "위 코드에 한함"으로 오해 소지 | `spec/5-system/1-auth.md §1.5.4` | 주석 말미에 초대 발급·재발송·취소 흐름의 7종 코드도 동일 레지스트리에서 관리됨을 참조 링크로 명시 |
| 4 | Convention Compliance | `10-graph-rag.md`·`12-webhook.md` 의 `## Overview (제품 정의)` 헤딩이 CLAUDE.md 표준 `## Overview` 와 미세하게 다름 | `spec/5-system/10-graph-rag.md`, `spec/5-system/12-webhook.md` | 규약에 "(제품 정의) 부제 허용" 을 추가하거나 점진적으로 `## Overview` 로 단순화 |
| 5 | Convention Compliance | `12-webhook.md §WH-SC-09` 에 `1-auth.md §2.3` / Rationale 2.3.B 교차참조 포인터 누락 | `spec/5-system/12-webhook.md §WH-SC-09` | `WH-SC-09` 끝에 IP 추출 우선순위 정책 SoT 참조 링크 추가 (optional) |
| 6 | Rationale Continuity | `webhook-public-ip-failopen-hardening.md` 미결 결정 3항(인프라 vs 앱 레벨 / `req.socket.remoteAddress` 폴백 / fail-closed 전환) 결정 확정 후 `12-webhook.md §6·WH-SC-05·Rationale` 갱신 필요 | `plan/in-progress/webhook-public-ip-failopen-hardening.md` | 결정 확정 시점에 spec 갱신 PR 별도 생성. 현재 조치 불필요 |
| 7 | Plan Coherence | `hooks.service.ts` 주석의 "req.ip 폴백 — 별도 후속" 언급이 Rationale 2.3.B 의 기각 결정과 병렬 존재 | `hooks.service.ts` L152·L260 주석 | `webhook-public-ip-failopen-hardening.md` 가 공식 추적 중이므로 별도 조치 없음 |
| 8 | Naming Collision | `PublicWebhookReqShape` 신규 named interface — 충돌 없음, 기존 `ReqShape export` 삭제로 혼선 해소 | `public-webhook-throttle.guard.ts:160` | 조치 불필요 |
| 9 | Naming Collision | `UNKNOWN_ERROR_MESSAGE`·`UNHANDLED_ERROR_MESSAGE` private static 상수 — 충돌 없음 | `http-exception.filter.ts:33,39` | 조치 불필요 |
| 10 | Naming Collision | `webhook-hardening-cleanup.md`·`webhook-public-ip-failopen-hardening.md` plan 파일 — 기존 complete/in-progress 와 명명 충돌 없음 | `plan/in-progress/` | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `12-webhook.md §7` 의 제거된 함수명 잔존 + `1-auth.md §2.3` 표 기술과 Rationale 2.3.B 의 미세 tension (INFO 2건, 비차단) |
| Rationale Continuity | NONE | 모든 변경이 Rationale 2.3.B(헤더 기반 IP 추출, `req.ip` 기각) 와 일치. 번복·무근거 변경 없음 |
| Convention Compliance | NONE | `error-codes.md §3`·`audit-actions.md §3` 레지스트리와 일치. INFO 3건(범위 표현 모호성·헤딩 비표준성·참조 누락) |
| Plan Coherence | NONE | codebase 한정 리팩터. 미결 결정을 선반영하지 않고 plan 이 정상 추적 중 |
| Naming Collision | NONE | 신규 식별자 3종 모두 충돌 없음. `extractClientIp` 로컬 래퍼 삭제로 기존 혼선 오히려 해소 |

## 권장 조치사항

1. **(비차단·권장)** `spec/5-system/12-webhook.md §7` 의 `extractClientIp` 참조를 `extractClientIpFromHeaders` 로 수정하거나 동작 기술로 추상화 — `webhook-hardening-cleanup.md §C` 범위로 묶어 처리.
2. **(비차단·권장)** `spec/5-system/1-auth.md §2.3` 표의 "클라이언트 IP" 행을 세션·감사 경로 vs webhook/rate-limit/ip_whitelist 경로로 분리 기술 — Cross-Spec INFO 2 + Convention Compliance INFO 5 를 함께 해소 가능.
3. **(비차단·낮은 우선순위)** `1-auth.md §1.5.4` 주석에 초대 모듈 7종 historical-artifact 코드 참조 링크 추가.
4. **(비차단·낮은 우선순위)** `webhook-public-ip-failopen-hardening.md` 미결 결정 3항 확정 시 spec(`12-webhook.md §6·WH-SC-05·Rationale 2.3.B`) 갱신 PR 별도 생성.
