# Consistency Check 통합 보고서

**BLOCK: YES** — Plan Coherence checker 가 보고한 CRITICAL 1건(착수 예정 구현 메커니즘이 동일
트래커 문서 내 기존 미해결 관례와 충돌) 때문에 착수 전 정리가 필요합니다.

## 전체 위험도
**HIGH** — spec/5-system 본문 자체의 내용 위험은 NONE~LOW 수준으로 낮지만, 착수하려는 plan
(`race-helper-guard-tests.md`)이 채택한 구현 메커니즘(jest `roots` 확장)이 같은 트래커 문서 안에
이미 등재된 미해결 관례("self-spec 동반 헬퍼는 `src/shared/testing/`")와 정면 충돌해 착수 전
반드시 결정을 명시해야 하는 CRITICAL 이 1건 있습니다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Plan Coherence | 착수 예정인 jest `roots` 확장(`test/helpers/concurrency.spec.ts` 를 unit 러너가 집도록)이 같은 트래커 문서 안에 이미 등재된 미해결 관례와 다른 메커니즘을 언급·반증 없이 채택 | `plan/in-progress/race-helper-guard-tests.md` §B·§D | `plan/in-progress/spec-draft-nullable-notation-followups.md` (~1895행, 미해결 `- [ ]`, owner=developer): "self-spec 동반 헬퍼는 `src/shared/testing/`" — 이미 코드베이스에 5쌍 선례 존재(`trigger-workflow-ref.ts`/`.spec.ts` 등, `#1308` 유래) | 착수 전 둘 중 하나를 plan 본문에 결정으로 명시: (a) 순수 함수(`assertGuardBelowKnownTimeoutsMs` 류)만 `src/shared/testing/lock-timeout-guard.ts` 로 추출해 기존 선례를 따르고 DB 의존 `concurrency.ts` 는 `test/helpers/` 에 남긴다, 또는 (b) `roots` 확장을 택할 경우 왜 이 케이스가 선례 적용 대상이 아닌지 근거를 plan 에 남기고 `spec-draft-nullable-notation-followups.md` 해당 항목에도 "검토했으나 다른 처방을 택함"을 교차 기록 |

## planner 인계 (권한 밖 Critical)

(없음) — 위 CRITICAL 의 근본 원인은 `spec/` drift 가 아니라 developer 자신이 쓰고 있는 두 개의
`plan/in-progress/*.md` 문서(둘 다 developer 쓰기 권한 범위) 사이의 메커니즘 선택 충돌입니다.
developer 자신이 착수 전에 결정을 명시하는 것으로 해소 가능하며, planner 턴이 필요한 사안이
아닙니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `CANNOT_REMOVE_OWNER` 에러 코드가 중앙 에러 카탈로그에 미등재 | `spec/5-system/1-auth.md` §3.2 각주 | `spec/5-system/2-api-convention.md` §5.3 ("등재되지 않은 코드는 소비자가 존재를 알 방법이 없다") + `3-error-handling.md` §1 (grep 0건) | `3-error-handling.md` §1.2/§1.9 계열에 포인터 행 추가, 또는 기존 Rationale 의 "별도 pass"(`SOLE_OWNER_CANNOT_LEAVE` 등) 목록에 이 코드도 명시 포함 |
| 2 | Cross-Spec / Convention Compliance / Rationale Continuity / Naming Collision (공통) | 조립 프롬프트가 컨텍스트 예산 초과로 `spec/5-system` 18개 파일 중 15개(예: `4-execution-engine.md` 227,815자, `14-external-interaction-api.md`, `6-websocket-protocol.md` 등)와 `spec/conventions/` 292개 중 대다수를 생략 | 조립 프롬프트 전체 | (도구/오케스트레이션 한계 — 기존에 알려진 `--spec` 기본 예산 이슈와 동일 계열) | 이번 작업(test-harness only, spec 변경 없음)에 대한 즉시 조치는 불요. 다만 "생략됐다는 사실을 해당 내용이 클린하다는 근거로 쓰지 말 것" — 향후 이 대형 문서군 대상 `--spec` 호출은 파일 단위 청크 분리 재실행 권고 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Plan Coherence | "동시 삭제 → 두 번째 404" 계약 문서화가 아직 비어 있음 (auth-configs·model-config·webauthn 세 자리, #1374~#1376 로 코드는 이미 수정 완료) | `spec/5-system/1-auth.md` §5 / `2-api-convention.md` §3 멱등성 각주 / 관련 항목: `plan/in-progress/spec-draft-nullable-notation-followups.md` (~5109~5151행, planner 소유) | 이번 plan 과 무관, 조치 불요 — 기존 tracker 항목 유지, 다음 planner 턴에서 세 자리 일괄 정리 |
| 2 | Naming Collision | `EXECUTION_QUEUE_WAIT_TIMEOUT`(에러 코드) vs `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`(env var) — 접두어 동일, 접미사만 다름 | `spec/5-system/3-error-handling.md:149`, `execution-limits.ts:82,92` | 조치 불요 — `CODE_MEMORY_LIMIT`/`_MB` 와 동일한 기존 컨벤션 |
| 3 | Naming Collision | `INVALID_STATE`/`INVALID_EXECUTION_STATE`/`STATE_MISMATCH` 3종 표면별 이형 | `spec/5-system/3-error-handling.md:1669,1681,1750,1760` | 조치 불요 — 문서 스스로 의도적 분리로 근거 명시 |
| 4 | Naming Collision | `REAUTH_NOT_AVAILABLE`/`emailChangeToken`/`verifyReauth` 계층 간 일관성 확인 | 코드·spec 다수 위치 (보고서 본문 참조) | 조치 불요 — 전 계층 정합 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | CRITICAL/WARNING 급 cross-spec 모순 없음. context 예산 절단(INFO)만 기록 |
| Rationale Continuity | NONE | 실 diff(plan 등재뿐)가 spec 규정 원칙을 우회·재도입하지 않음. Rationale 연속성 양호 |
| Convention Compliance | LOW | `CANNOT_REMOVE_OWNER` 미등재(WARNING, 기존 부채 계열) + context 예산 생략(WARNING) |
| Plan Coherence | MEDIUM (CRITICAL 1건 포함) | jest `roots` 확장이 같은 트래커 문서 내 미해결 self-spec 배치 관례와 충돌(CRITICAL). 동시삭제 404 문서화 지연(INFO, 무관) |
| Naming Collision | NONE | 이번 작업은 `spec/` 을 전혀 변경하지 않아 신규 식별자 자체가 없음. 표본 교차검증 전부 기존 의도적 설계 |

## 권장 조치사항

1. **(BLOCK 해소 우선)** `race-helper-guard-tests.md` 착수 전, jest `roots` 확장 vs
   `src/shared/testing/` 관례 중 하나를 선택해 plan 본문에 명시하고,
   `spec-draft-nullable-notation-followups.md` 의 해당 미해결 항목에도 교차 기록한다
   (본 보고서 Critical #1 제안 (a)/(b) 중 택1).
2. `CANNOT_REMOVE_OWNER` 에러 코드를 `3-error-handling.md` 카탈로그에 등재하거나 기존
   "별도 pass" 부채 목록에 명시 포함 — 이번 작업 차단 사유는 아니므로 별도 planner 턴에서
   처리 가능.
3. 이번 검토는 컨텍스트 예산으로 `spec/5-system` 15개 파일과 `spec/conventions` 대다수를
   보지 못했다는 한계가 있음 — "생략 = 클린" 으로 오독하지 말고, 이 영역을 대상으로 한
   차기 `--spec` 호출은 청크 분리 재실행을 권고.
