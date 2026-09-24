# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원이 CRITICAL 없음으로 판정. WARNING 3건은 모두 impl-prep 을 막을 사안이 아님.

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 3건(문서 구조 표기 분기, 후속 plan 미등재, ENV 키 의미 변경 자체 고지)은 전부 사전 인지·유예 가능한 수준.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `## Overview` 표준 섹션 헤딩이 같은 폴더 내 4개 파일에서 `## 1. 개요`/헤딩 부재로 갈림 (저장소 전체에 이미 퍼진 기존 분기, 이번 변경이 만든 새 이탈 아님) | `spec/5-system/5-expression-language.md`, `7-llm-client.md`, `11-mcp-client.md`, `16-system-status-api.md` | `.claude/skills/project-planner/SKILL.md` "Spec 문서 구조 (3섹션 권장)" — `## Overview` 표준 헤더 명시 | (a) 이번 스코프 4개 파일만 `## Overview` 로 통일, 또는 (b) SKILL.md 에 "`## N. 개요` 도 동등 허용" 명시해 규약을 실태에 맞출 것 |
| 2 | Plan Coherence | `@nestjs/common` 동반 업그레이드 후속 plan 이 아직 `plan/in-progress/` 에 실체로 등재되지 않았고, 등재 시 담아야 할 구체 검증 항목(부트 캐너리 소비 라우트 수 회귀·가드 unit 스위트)도 명시되지 않음 | `spec/5-system/1-auth.md` `## Rationale` "부트 캐너리 — `@WorkspaceId()` reflection 자가검증" | `plan/in-progress/jest-esm-native-load.md` §E "하지 않는 것", `plan/in-progress/auth-guard-reflection-hardening.md` §1 W1 | 후속 plan 스텁(가칭 `plan/in-progress/nestjs-common-v12-upgrade.md`)을 지금 등재하고 "부팅 로그 `@WorkspaceId()` 소비 라우트 수 유지 + `workspace.decorator.spec.ts`/`roles.guard.spec.ts` 통과"를 완료 조건으로 명시, 또는 최소한 `jest-esm-native-load.md` 체크리스트 "후속 등재" 항목 옆에 이 조건을 못박을 것 |
| 3 | Naming Collision | `SYSTEM_STATUS_FAILED_THRESHOLD` ENV 키 이름은 그대로인데 비교 기준이 "누적 `failed`" → "최근 윈도우 `recentFailed`" 로 의미가 바뀜 (문서가 R-5 로 이미 자체 고지) | `spec/5-system/16-system-status-api.md` §3 (`getFailedDegradedThreshold()`) | 기존 운영 배포판의 동일 키 튜닝값 재사용 | impl-prep 단계에서 (a) 부팅 로그/헬스 응답에 "threshold semantics changed at vX" 1회성 경고 남기거나, (b) 키를 `SYSTEM_STATUS_RECENT_FAILED_THRESHOLD` 로 개명하고 구키를 deprecated alias 로 유지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | 연속된 구분선(`---`) 중복 편집 잔재 | `spec/5-system/3-error-handling.md:296-298` | `---` 한 줄로 정리 (사소, 다음 편집 시 함께 정리해도 무방) |
| 2 | Cross-Spec | 컨텍스트 예산상 `4-execution-engine.md`·`14-external-interaction-api.md`·`15-chat-channel.md` 등 초대형 파일은 앵커·표본만 대조, 전문 대조는 아님 | `spec/5-system/*` (14개 대형 파일) | 해당 파일을 직접 건드리는 후속 작업에서는 별도 집중 cross-spec 대조 필요 |
| 3 | Rationale Continuity | 동일 사유로 15개 파일 본문의 Rationale 연속성 이번 회차 미검증(컨텍스트 절단) | `spec/5-system/4-execution-engine.md`, `6-websocket-protocol.md`, `14-external-interaction-api.md`, `15-chat-channel.md` 등 | 해당 파일을 직접 건드리는 후속 작업이 있다면 좁은 범위 재검토 권고 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | target 3파일(`1-auth`·`2-api-convention`·`3-error-handling`)과 `1-data-model`/`data-flow`/`conventions`/`2-navigation`/`6-websocket-protocol` 등 교차 지점 모두 정합. CRITICAL 없음. 대형 미대조 파일 존재로 NONE 아닌 LOW |
| Rationale Continuity | NONE | 기각된 대안 재도입·합의 위반·무근거 번복·invariant 우회 0건. 최근 병합(`fc56873be`·`33caa750c`)도 §3.2 각주와 정합, spec 변경 불요 확인됨 |
| Convention Compliance | LOW | 에러코드·감사액션·Redis키·DTO명명·URL 케밥케이스·페이지네이션 안티패턴 전수 grep 대조 위반 0건. `## Overview` 헤딩 분기(WARNING)·구분선 중복(INFO)만 발견 |
| Plan Coherence | LOW | 이번 PR(`jest-esm-native-load.md`) 스코프는 `spec/5-system` Rationale 우려 지점(reflection 기반 워크스페이스 가드)에 닿지 않고 `spec_impact: none` 과 일치. 후속 plan 미등재만 WARNING |
| Naming Collision | LOW | Planned 식별자 전수 대조 결과 유의미한 이름 충돌 없음. ENV 키 의미 재정의 1건만 WARNING(문서 자체 고지 있음) |

## 권장 조치사항
1. (BLOCK 해소 우선 — 해당 없음, BLOCK: NO)
2. `## Overview` 헤딩 표기 분기: 이번 스코프 4개 파일 통일 또는 SKILL.md 규약 문구 보완 (WARNING #1)
3. `@nestjs/common` 동반 업그레이드 후속 plan 스텁 등재 + 구체 검증 조건(부트 캐너리 라우트 수·가드 unit 스위트) 명시 (WARNING #2)
4. `SYSTEM_STATUS_FAILED_THRESHOLD` 의미 변경에 대한 배포 시 경고 또는 키 개명 검토 (WARNING #3)
5. `3-error-handling.md` 중복 구분선 정리 (INFO #1, 사소)
