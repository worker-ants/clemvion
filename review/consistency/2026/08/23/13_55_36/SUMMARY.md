# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전문을 모두 확보했고, 그중 CRITICAL 판정은 없다.

> 참고: `plan_coherence` 는 manifest status 가 `no_status` 였고 output_file 이 디스크에 없었으나, 프롬프트 인라인 전문이 authoritative 로 제공되어 있어 그 전문을 그대로 `plan_coherence.md` 에 영속화한 뒤 반영했다. 재시도 필요 checker는 없다.

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(둘 다 이번 `masking-gate-consolidation` 작업 자체의 정합성이 아니라 부수적 위생/문서 간극)과 INFO 다수.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `egress-masking.md §3` 정정 시 tracker 항목의 "§1 표 동반 갱신" 지시를 "표는 무변경" 으로 반증했는데, 그 반증 근거가 tracker 문서 자체에는 기록되지 않음(plan 의 task 목록에 명시 안 됨) | `plan/in-progress/masking-gate-consolidation.md` (spec_impact 는 `spec/conventions/egress-masking.md §3`, target 번들 밖이나 직접 확인) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 미체크 항목("착수 시 §1 표 동반 갱신" 예고) | `masking-gate-consolidation.md` 의 "트래커 항목 종결" task 를 "§1 표는 무변경이며 그 근거(측정)를 tracker 블록쿼트에 남긴다"로 구체화하거나, 트래커를 닫는 커밋에서 `spec-sync-external-interaction-api-gaps.md` 해당 블록쿼트에 반증 근거 1~2문장 추가 |
| 2 | convention_compliance | API URL 중첩 2단계 규칙(`2-api-convention.md §2.2`)과 `/api/auth/2fa/webauthn/...` 계열(5단계 세그먼트, `{id}` 없음)이 문서화된 예외 패턴과도 형태가 다름 — 규칙-실제 간극 | `spec/5-system/1-auth.md §5 API 엔드포인트` | `spec/5-system/2-api-convention.md §2.2` | 코드 변경 불요(엔드포인트 정상 동작). `2-api-convention.md §2.2`에 "인증 흐름 등 리소스가 아닌 액션 네임스페이스는 중첩 제한 예외" 문구 추가 — 이번 작업 범위 밖, `project-planner` 소관 후속 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | impl-prep 번들 예산이 이번 작업과 무관한 `1-auth.md` 등에 소진되어 실제 SoT(`14-external-interaction-api.md` §R17, `4-execution-engine.md`)와 "관련 spec" 축 대부분(`spec/1-data-model.md` 포함)이 절단됨 | `_prompts/cross_spec.md` 상단 생략 파일 목록 | 번들링 정책을 plan 실제 diff 대상/`code:` frontmatter 우선순위로 개선 검토(이번 판정은 직접 Read 로 갭을 메워 영향 없음) |
| 2 | cross_spec | `masking-gate-consolidation` 이 겨냥한 §R17(표면 6개·컬럼 2개)과 코드(`redactStoredFieldsForResponse`/`redactNodeExecutionRow`) 좌표계가 정확히 일치 — 충돌 없음 확인 | `spec/5-system/14-external-interaction-api.md` §R17 | 없음(교정 불요, 참고 기록) |
| 3 | rationale_continuity | `plan/in-progress/masking-gate-consolidation.md` 체크리스트가 전항 미체크 상태인데 워킹트리(`git diff HEAD`)에는 헬퍼 2개 신설 + 4개 호출부 교체가 이미 반영돼 있음 | `plan/in-progress/masking-gate-consolidation.md` §작업 체크리스트 | developer 턴에서 체크박스를 실제 상태로 동기화(다음 턴 중복 작업 방지) |
| 4 | convention_compliance | `spec/5-system/2-api-convention.md` 에 `## Overview` 절 표제가 없음(다른 문서들과 구조 불일치, "권장" 규정) | `spec/5-system/2-api-convention.md` 최상단 | `## 1. 기본 원칙` 앞에 짧은 `## Overview` 절 신설 — 이번 작업 범위 밖, 후속 spec 정리 시 반영 |
| 5 | plan_coherence | consolidation 이후에도 `toResponseExecution` JSDoc("정본" 주석)이 옛 개별 함수 심볼(`redactStoredErrorForResponse`/`redactStoredDataForResponse`)만 인용, 새 헬퍼 계층 미반영 | `codebase/backend/src/modules/executions/executions.service.ts` `toResponseExecution` JSDoc | `/ai-review` 라운드에서 JSDoc 참조 갱신 여부 확인(계획 차단 사안 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 번들 절단을 직접 Read 로 메워 §R17(6표면/2컬럼)과 코드 좌표계 일치 확인, 충돌 없음. 번들링 프로세스 갭만 INFO |
| rationale_continuity | LOW | 기각된 대안("세 상한 병합") 재도입 없음, "§3 표 낡음" 예고는 근거 있는 정정으로 뒤집힘, §R17 "4곳 vs 6표면" 은 카운트 단위 차이일 뿐 모순 아님. plan 체크박스 stale 만 INFO |
| convention_compliance | LOW | 에러 코드·감사 액션 명명은 conventions 레지스트리와 완전 대조 가능, CRITICAL 없음. WARNING 1(auth URL 중첩 간극, 기존 상태)·INFO 1(Overview 절 부재) |
| plan_coherence | LOW | tracker 미체크 항목을 정확히 집행하고 "§1 표 동반 갱신" 전제를 코드로 반증(타당함 재검증). 그 반증 근거의 tracker 기록 누락이 WARNING, JSDoc stale 참조가 INFO |
| naming_collision | NONE | 신규 식별자(`redactStoredFieldsForResponse`/`redactNodeExecutionRow`/이동된 `maskIfPresent`) 전부 단일 파일 내, 기존 코드베이스·spec 어디에도 충돌 사용처 없음 |

## 권장 조치사항
1. (WARNING 해소) `masking-gate-consolidation.md` 의 "트래커 항목 종결" task 를 구체화 — `spec-sync-external-interaction-api-gaps.md` 블록쿼트에 "§1 표는 무변경, 근거는 코드 실측" 1~2문장 추가.
2. (WARNING, 범위 밖 후속) `2-api-convention.md §2.2` 에 인증 액션 네임스페이스 중첩 예외 문구 추가 — `project-planner` 소관.
3. developer 턴에서 `masking-gate-consolidation.md` 체크박스를 실제 워킹트리 상태로 동기화.
4. `/ai-review` 라운드에서 `toResponseExecution` JSDoc 이 신규 헬퍼(`redactStoredFieldsForResponse`/`redactNodeExecutionRow`) 계층을 반영하도록 갱신 여부 확인.
5. (후속, 이번 작업 범위 밖) `2-api-convention.md` 에 `## Overview` 절 신설, impl-prep 번들링 정책을 plan diff 대상 우선순위로 개선 검토.