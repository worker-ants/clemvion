# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision)이 전문을 반환했고, CRITICAL 등급 발견은 하나도 없음.

## 전체 위험도
**LOW** — 새로 발견된 cross-spec/rationale 모순은 없으나, 문서 drift 성격의 WARNING 3건(API prefix 표기 누락, Overview 헤딩 불일치, 이 plan 자신의 실행으로 낡을 캐럿 버전 숫자)이 있어 조치 권장.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `17-agent-memory.md`가 전 구간에서 `/api` prefix 없이 엔드포인트 표기(`GET /agent-memories` 등) — 실제 wire 경로는 `/api/agent-memories` | `spec/5-system/17-agent-memory.md` §6 표·bullet(120~132·210·212행), `_product-overview.md` §8 AGM-12/AGM-13 | `2-api-convention.md` §2.1 "기본 패턴"(`{base_url}/api/{resource}`), 같은 폴더 나머지 16개 문서 전부 `/api/...` 표기 | `17-agent-memory.md` §6 표와 `_product-overview.md` 해당 행에 `/api` 세그먼트 추가(문서만 수정, 구현 변경 불필요) |
| 2 | convention_compliance | `5-expression-language.md`·`7-llm-client.md`·`11-mcp-client.md`·`16-system-status-api.md` 4개 파일이 `## Overview` 헤딩 없이 바로 본문 소절(`## 1. 개요` 등)로 시작 | 위 4개 파일 도입부 | `project-planner/SKILL.md` "Spec 문서 3섹션 구성" 관례, 같은 폴더 13개 파일이 준수하는 `## Overview` 패턴 | 4개 파일 도입부를 `## Overview (제품 정의)`로 통일하거나, 순수 기술 명세라 예외라면 그 사실을 SKILL.md 혹은 각 파일 상단에 명시 |
| 3 | plan_coherence | `1-auth.md` 부트 캐너리 Rationale의 `^11.0.1` 캐럿 버전 인용이, 이 plan(`nestjs-v12-coordinated-upgrade`) 자신의 실행 완료 시 실제 값(`^12.x.x`)과 어긋나게 됨. 같은 Rationale 절 인접 문단이 "캐너리 수치를 spec에 미러링하지 말 것 — stale해진다"고 이미 경고했는데 버전 숫자에는 같은 원칙이 적용 안 됨 | `spec/5-system/1-auth.md` §Rationale "부트 캐너리" (806~807행) | `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §E 종결 조건(정정 항목 없음), `CHANGELOG.md` 동형 문장(캐럿 숫자 이미 뺀 선례) | `nestjs-v12-coordinated-upgrade.md` §E 또는 "후속" 에 "업그레이드 완료 후 `1-auth.md` 806~807행 `^11.0.1`을 갱신하거나 숫자를 빼고 `caret 범위라`로 일반화 — planner 턴 필요" 항목 추가. 업그레이드 실행 전에는 문장이 아직 참이므로 즉시 조치 불요 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | RBAC 매트릭스(§3.2 Admin 멤버 삭제 제약)는 `1-auth.md`·`data-flow/12-workspace.md`·`2-navigation/9-user-profile.md`·`6-config.md` 4곳 모두 정합 확인(최근 #1384/#1385 구현 순서 변경도 동일 결과 유지) | `1-auth.md` §3.2 | 조치 불요 |
| 2 | cross_spec | 에러 코드/감사 액션 카탈로그의 domain-SoT 위임 구조가 `conventions/error-codes.md`·`audit-actions.md`와 문자 그대로 일치 | `3-error-handling.md` §1.x, §4.1 | 조치 불요 |
| 3 | cross_spec | 부트 캐너리 서술이 `1-auth.md`↔`data-flow/12-workspace.md` 간 상호 anchor로 self-consistent | `1-auth.md` §Rationale | 조치 불요 |
| 4 | cross_spec | `spec-draft-nullable-notation-followups.md` ②항이 이미 `2-api-convention.md` §2.2에 문자 그대로 반영된 것으로 보임(plan-coherence 소관에 더 가까워 INFO로만 표기) | `2-api-convention.md` §2.2 | plan_coherence 결과와 교차 확인 후 해당 plan 문서를 "적용 완료"로 갱신 또는 `plan/complete/` 이관 검토 |
| 5 | rationale_continuity | 부트 캐너리가 지닌 유일한 load-bearing invariant(전체 파손만 잡고 부분 파손은 못 잡는 caveat)를 plan §C가 정확히 인지하고 실행 계획에 반영 | `1-auth.md` §Rationale | 조치 불요. 캐너리 수치(142건)가 업그레이드 후 달라지면 원인 규명 결과는 spec이 아닌 plan 문서에 기록할 것 |
| 6 | rationale_continuity | 검토 범위가 `spec/5-system` 18개 중 3개 파일 전문에 한정(컨텍스트 예산) — 나머지 15개, 특히 `4-execution-engine.md`는 미검토 | `spec/5-system/4-execution-engine.md` 등 | 이번 업그레이드가 실행 엔진/WS/EIA 가드 경로에 실제로 손댈 경우 해당 파일들의 자체 Rationale을 별도 대조 필요 |
| 7 | convention_compliance | `4-execution-engine.md` §9.2 Redis 키 표에 `exec:run:seq:<executionId>`가 "미사용"으로 명시된 채 잔존 — 표 자신의 "실제 사용 중인 키만" 선언과 경미하게 불일치 | `4-execution-engine.md` §9.2 표 | 해당 행을 "예약된 미래 키" 각주로 이동하거나 표 선언문을 "사용 중 + 명시적 예약" 으로 확장 |
| 8 | naming_collision | 이번 plan(`spec_impact: none`, 순수 `@nestjs/*` 버전 범프)은 신규 식별자를 도입하지 않음. 실측: `git diff origin/main --stat -- spec/` 출력 없음(diff 0) | `spec/5-system` 전체 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 신규 모순 없음. RBAC·에러코드·부트캐너리 모두 영역 간 정합 확인 |
| rationale_continuity | LOW | 기각 대안 재도입·무근거 번복 없음. 검토 범위가 18개 중 3개 파일로 제한된 점만 유의 |
| convention_compliance | LOW | WARNING 2건(API prefix 누락, Overview 헤딩 불일치) + INFO 1건(Redis 키 표 자기모순), 모두 문서 표기 수준 |
| plan_coherence | LOW | WARNING 1건(캐럿 버전 숫자가 이 plan 실행으로 stale해질 예정, 종결조건 미반영) |
| naming_collision | NONE | 이번 plan은 spec 변경 없음(diff 0) — 신규 식별자 검토 대상 자체가 없음 |

## 권장 조치사항
1. `nestjs-v12-coordinated-upgrade.md` §E(또는 후속 항목)에 "업그레이드 완료 후 `1-auth.md` 806~807행 `^11.0.1` 캐럿 버전 문구 정정" 항목 추가 — planner 턴으로 반영(WARNING #3).
2. `17-agent-memory.md` §6과 `_product-overview.md` AGM-12/AGM-13 행에 `/api` prefix 보완(WARNING #1) — 별도 소규모 spec 정정으로 planner 턴에서 처리 가능.
3. 4개 파일(`5-expression-language.md`·`7-llm-client.md`·`11-mcp-client.md`·`16-system-status-api.md`)의 `## Overview` 헤딩 통일 여부를 planner가 판단(WARNING #2).
4. `spec-draft-nullable-notation-followups.md` ②항이 이미 반영됐는지 확인 후 plan 문서 정리(INFO #4).
