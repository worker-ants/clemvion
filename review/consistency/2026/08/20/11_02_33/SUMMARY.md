# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 완료(success, 전문 확보), Critical 발견 0건.

## 전체 위험도
**LOW** — 코드/spec 정합성 관점(Cross-Spec, Rationale, Convention, Naming)은 전부 NONE. Plan Coherence 에서 WARNING 1건(다른 worktree 소유 plan 파일의 라이프사이클 미정리) 발견.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | 선행 precondition plan(`eia-masked-prefill-roundtrip-guard.md`)이 이미 `origin/main`(`c9cc2a923`, #1181)에 병합됐음에도 `plan/in-progress/`에 미해결 상태(`worktree: eia-masking-round2-53afc8`, 체크리스트 `- [ ] push → PR` 미체크)로 남아 있음 | `spec/5-system/14-external-interaction-api.md` §R17 `token` 계열 확장 불릿(이 target 이 순서 근거로 그 plan 을 인용) | `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` | 해당 plan 을 소유한 worktree/세션에서 체크박스를 완료로 갱신하고 `plan/complete/`로 이동. 이 target worktree 의 책임 범위 밖(다른 worktree 소유)이라 여기서 직접 고치지 않음 — 방치 시 이후 다른 세션의 plan_coherence 재검토가 "가드가 아직 안 섰다"는 stale 정보를 SoT 로 오인할 위험 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | `token` 계열 egress 마스킹 확장이 `12-webhook.md` §Rationale 의 ingestion-시점 채택(display-시점 마스킹 기각)과 표면적으로 겹쳐 보이나, R17 자신이 "구조화된 알려진 헤더 key(ingestion) vs 자유 텍스트·진단 필드(egress)" 대상 구분과 소수 공유 관문 수렴 근거를 이미 명시해 번복이 아님을 확인 | `spec/5-system/14-external-interaction-api.md` §R17 | 조치 불필요. 향후 유사 검토에서 "egress 확장=ingestion 원칙 위반" 오판 방지용으로 R17 해당 문단을 체크리스트에 남겨두면 재조사 비용 절감 |
| 2 | Rationale Continuity | MCP 전용 패턴을 공용으로 흡수(`MCP_EXTRA_SECRET_PATTERNS` 비움)하는 방향은 2026-07-10 URL-userinfo 흡수 선례와 동일한 "SoT 파편화 방지" 원칙의 재적용 | `spec/5-system/11-mcp-client.md` §Rationale | 조치 불필요 |
| 3 | Rationale Continuity | 잔여 범위(workflow-assistant `maskSensitiveFields` 비대상)를 "잔여 ③"으로 명시 기록해 향후 오판 예방 | `spec/5-system/14-external-interaction-api.md` §R17 | 조치 불필요 |
| 4 | Convention Compliance | `14-external-interaction-api.md` §R17 이 계속 불릿을 누적해 스펙 파일 중 가장 긴 단일 Rationale 항목이 됨(과거 consistency `--spec` 예산 소모 사례 있음) | `spec/5-system/14-external-interaction-api.md` §R17 | 지금은 conventions 위반 아님. 다음 불릿 추가 시 별도 convention 문서(`spec/conventions/egress-masking.md` 류) 분리 검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 트리거 시크릿/토큰 1회 평문 반환 API·webhook 초기 interaction token 발급·workflow-assistant 별도 카탈로그·자체 페이지네이션 커서 명명·secret-store 저장 추상화 등 5개 후보 지점 전부 마스킹 유틸 소비처 밖이거나 이미 문서화된 의도적 예외 — 충돌 없음 |
| Rationale Continuity | NONE | 기각 대안 재도입·원칙 위반·무근거 번복·암묵 invariant 충돌 4관점 모두 CRITICAL/WARNING 없음. ingestion-vs-egress 표면적 긴장은 R17 이 대상 구분으로 이미 해소 |
| Convention Compliance | NONE | 명명·출력 포맷·문서 구조·API 문서·금지 패턴 5관점 위반 없음. `/api/external/*` 예외 표 등재·`AuthConfig.config.algorithm` 출처 정정·MCP redaction 서술이 실 코드와 정확히 일치 |
| Plan Coherence | LOW | 선행 plan(`#1181` 프리필 가드)과의 순서·범위 정합은 git 이력으로 실측 확인됨(정상). 다만 그 선행 plan 파일 자체가 병합 후에도 `plan/in-progress/`에 미정리 상태로 잔존(WARNING) |
| Naming Collision | NONE | 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV var·파일 경로 6관점 전부 신규 식별자 없음(전 파일 `M`odify, `A`/`R` 0건). 기존 식별자 재사용·재인용만 있음 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical 없음) `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 를 소유한 worktree/세션 쪽에서 체크박스 완료 처리 후 `plan/complete/` 로 이동 (WARNING #1 해소, 이 target worktree 의 책임 범위 밖).
2. 향후 R17 확장 시 별도 convention 문서 분리 검토(INFO #4, 즉시 조치 불요).
