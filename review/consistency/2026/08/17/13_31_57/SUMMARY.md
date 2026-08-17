# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 성공, Critical 발견 없음 (WARNING/INFO만 존재)

## 전체 위험도
**MEDIUM** — Critical 은 없으나, plan 이 스스로 계획한 저비용 문서 3건(hmacAlgorithm 출처·§11 execution.stop 각주·§2.2 `/api/external/*`)이 실측으로 재확인됐고, 추가로 plan 의 "자매 전수" 조사가 놓친 새로운 갭(`mcp-error-codes.ts` 의 `MCP_EXTRA_SECRET_PATTERNS` 가 이번 변경으로 중복/구식화됨)이 cross_spec 에서 발견됐다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — Critical 자체가 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 공용 `SECRET_LEAK_PATTERNS` 의 bare `token=` 흡수(`[A-Za-z0-9_-]*token`)가 `11-mcp-client.md` §8.3/Rationale 의 "MCP 전용으로 남는 것은 bare `token=` 뿐" 서술을 거짓으로 만들고, `mcp-error-codes.ts` 의 `MCP_EXTRA_SECRET_PATTERNS` 를 기능적으로 완전 중복시킴. plan 의 "자매 전수" 표(마스킹 목록 4곳)가 놓친 다른 축(공용 패턴을 소비/보충하는 다운스트림) | `codebase/backend/src/shared/utils/sanitize-error-message.ts` `SECRET_LEAK_PATTERNS`; `spec/5-system/14-external-interaction-api.md` §R17 | `spec/5-system/11-mcp-client.md` §8.3(line 485)·Rationale(603–606) + `codebase/backend/src/modules/mcp/mcp-error-codes.ts` `MCP_EXTRA_SECRET_PATTERNS` | 이번 PR 범위에 포함: (a) `mcp-error-codes.ts` 의 bare-token 대안 제거(2026-07-10 URL-userinfo 흡수 때와 동일 절차), (b) `11-mcp-client.md` §8.3/Rationale 을 "공용에 흡수됨"으로 갱신, (c) `mcp-error-codes.spec.ts` bare-token 케이스가 공용 패턴만으로 여전히 GREEN 인지 회귀 확인 |
| 2 | cross_spec + rationale_continuity | EIA-NX-03(§3.1)·R12(§9.3)의 "`hmacAlgorithm` 을 trigger config 에 보관" 서술이 12-webhook.md 및 자기 문서 §7.1 과 상충(V066 cleanup migration 으로 이미 제거, 현행 소유자는 `AuthConfig.config.algorithm`) | `spec/5-system/14-external-interaction-api.md` §3.1(line 64)·§9.3 R12(line 1318, 1322) | `spec/5-system/12-webhook.md`(line 167) + 자기 문서 §7.1(line ~896) | plan 항목 1 그대로 진행 — EIA-NX-03·R12 표현을 `AuthConfig.config.algorithm` 소유로 정정. **추가**: R12 의 "채택" 문장 자체도 동일한 stale 출처를 인용하므로 함께 정정(한쪽만 고치면 재발) |
| 3 | cross_spec | EIA §11 `execution.stop` 매핑 행이 권위 표(WS §4.6, line 820)의 `(WS 명령 §4.2 won't-do)` 각주를 누락. EIA §5.1(line 300)엔 있음 — 3개 표 중 1개만 어긋남 | `spec/5-system/14-external-interaction-api.md` §11(line 1124) | `spec/5-system/6-websocket-protocol.md` §4.6(line 807–823, 자기 선언 권위 표) | plan 항목 2 그대로 — §11 행에 `(WS 명령 §4.2 won't-do)` 주석 추가, §5.1·§11·WS§4.6 세 표 동시 확인 |
| 4 | convention_compliance + cross_spec(INFO에서 상향) | `2-api-convention.md` §2.2 "명명 규칙" 표가 `/api/external/*` 인증-family prefix 패턴을 다루지 않음 — §2.2 만 읽는 독자는 이 family 가 규약 준수인지 판단 불가 | `spec/5-system/2-api-convention.md` §2.1/§2.2(line 63–81) | 같은 문서 §6 rate-limit 표(228–229)·§5.4(440), `14-external-interaction-api.md` §8/R11 | plan 항목 3 그대로 — §2.2 에 `/api/external/{resource}` 를 "별도 인증 family(interaction-token) 전용 네임스페이스"로 명시. (rationale_continuity 제안: §2.3 워크스페이스 스코핑/시스템 전역 API 예외 섹션과 상호참조 고려) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `token` 계열 값/키 패턴 병합은 이미 승인된 트래커 항목(`spec-sync-external-interaction-api-gaps.md`)의 정상 집행 — Rationale 위반 없음 | `sanitize-error-message.ts`/`websocket.service.ts` `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` | 마무리 시 plan 체크리스트의 "트래커: `token=` 항목 종결" 스텝 누락 방지 |
| 2 | rationale_continuity | `websocket.service.ts` 신규 주석 "함께 갱신한다"의 범위가 `x-api-key` 비대칭(REST 전용, 의도된 것)까지 포함하는 것으로 오독될 여지 | `codebase/backend/src/modules/websocket/websocket.service.ts:67-73` | (선택) "x-api-key 등 REST 전용 확장은 미러 대상 아님" 한 줄 추가 |
| 3 | plan_coherence | 트래커가 권고한 "연결-문자열 항목과 함께 처리(같은 회귀 검증으로 둘 다 닫기)"가 이번 plan 범위에 없음 — 트래커 자체가 별건 처리도 허용해 차단 사유는 아님 | `spec-sync-external-interaction-api-gaps.md:164-183` vs `eia-secret-pattern-token-family.md` | plan 에 "왜 이번엔 안 묶었는지" 한 줄 남기면 향후 오인 방지 |
| 4 | plan_coherence | 체크리스트가 저비용 문서 3건(트래커 :134,136,138)의 명시적 트래커 체크박스 종결을 적지 않음 | `eia-secret-pattern-token-family.md` 작업 체크리스트 | 구현 완료 시 트래커 :134,136,138 체크박스도 함께 플립 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | plan 의 3건 doc-fix 재확인 + 새 갭(`mcp-error-codes.ts` MCP_EXTRA_SECRET_PATTERNS 중복/구식화) 추가 발견 |
| rationale_continuity | LOW | Rationale 번복 없음. 코드 변경은 기존 승인 트래커 항목의 정상 집행 |
| convention_compliance | LOW | `2-api-convention.md §2.2` 갭 1건(WARNING) 외 핵심 규약(Swagger/Secret Store/Redis 키/에러코드) 전부 준수 |
| plan_coherence | LOW | plan 전제 전부 실측 확인, 트래커 결정 항목 우회 없음, 선행조건(#1181) 충족 |
| naming_collision | NONE | 신규 식별자·엔티티·endpoint·이벤트·ENV var·spec 파일 도입 없음, 충돌 없음 |

## 권장 조치사항

1. **(신규 발견, 우선)** `mcp-error-codes.ts` 의 `MCP_EXTRA_SECRET_PATTERNS`(bare-token 대안)를 이번 PR 범위에 포함해 제거하고, `spec/5-system/11-mcp-client.md` §8.3/Rationale 을 "공용에 흡수됨"으로 갱신(2026-07-10 URL-userinfo 흡수 선례 형식 준수). 회귀 테스트로 bare-token 케이스가 공용 패턴만으로 GREEN 인지 확인.
2. plan 이 이미 계획한 저비용 문서 3건 진행: (a) EIA-NX-03·R12 hmacAlgorithm 출처 정정(R12 "채택" 문장도 함께), (b) §11 `execution.stop` 행에 `(WS 명령 §4.2 won't-do)` 주석 추가, (c) `2-api-convention.md §2.2` 에 `/api/external/*` 인증 family 명시(§2.3 상호참조 고려).
3. 구현 완료 시 `spec-sync-external-interaction-api-gaps.md` 트래커의 관련 체크박스(:134, :136, :138, `token=` 항목) 함께 종결.
4. (선택) `websocket.service.ts:67-73` 신규 주석에 `x-api-key` 비대칭 관련 한 줄 추가해 향후 오독 방지.