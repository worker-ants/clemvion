# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 CRITICAL 없음. WARNING 4건은 전부 이미 인지되었거나 착수 예정인 `plan/in-progress/eia-internal-rest-error-masking.md` 가 해소 대상으로 겨냥 중.

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 4건 모두 "구현+spec 갱신을 짝지어 완료 조건에 포함" 또는 "명명 변경/체크박스 분리" 수준의 실행 가능한 조치로 닫힘.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec + Rationale Continuity | `Execution.error` 가 EIA 종결 이벤트(`execution.failed`)에서는 마스킹되지만 내부 REST(`GET /executions/:id` 등 4표면)·WS `execution.snapshot` 에서는 원문 노출 — `2-api-convention.md §5.3`/`3-error-handling.md` 의 CWE-209 비echo 원칙과 이미 충돌 중이며 spec 자신이 "미결"로 표시 | `spec/5-system/14-external-interaction-api.md` §R17 마지막 불릿(`:1462-1487`) | `spec/2-navigation/14-execution-history.md` R-5(대상은 Config 탭 한정, `Execution.error` 미포함이므로 R-5 를 이 필드에 그대로 적용하면 오독) · `2-api-convention.md §5.3` · `3-error-handling.md` Rationale | `plan/in-progress/eia-internal-rest-error-masking.md`(I1)이 이미 "내부 경로에도 마스킹"으로 택일해 집행 중. **완료 조건에 코드 변경과 짝지어** (a) R17 "미결이다" 캐비엇 flip, (b) `14-execution-history.md` 에 `Execution.error` 마스킹 정책 별도 명시(R-5 오독 방지), (c) `3-workflow-editor/3-execution.md` §10.6.1 Run Results 드로어도 동일 필드 노출 시 동반 갱신 — 코드 변경과 spec 갱신이 분리된 턴/PR 로 쪼개지면 "코드=닫힘, spec=미결" 반대 방향 drift 발생 |
| 2 | Rationale Continuity + Convention Compliance | `Trigger.config.interaction.triggerToken` 이 평문 JSONB 저장 — `secret-store.md` "모든 도메인 모듈은 `SecretResolver` 경유" 원칙(예외 없는 절대 진술) 위반. 같은 JSONB 안 형제 필드 `notification.signing.secretRef` 는 이미 `SecretResolver` 경유 | `spec/5-system/14-external-interaction-api.md:910`("향후 secret store 통합 검토") | `spec/conventions/secret-store.md` Overview + §1 "비대상"(현재 `AuthConfig.config` 1건만 등재, 그 예외는 "동등한 암호화"라는 근거로 성립 — `triggerToken` 은 암호화 자체가 없어 근거의 질이 다름) | plan §D 가 이미 "이관 아님, 명시 예외 등재"로 사용자 택일 완료. planner 턴에서 (a) `secret-store.md §1` 에 `interaction.triggerToken` 등재 시 `AuthConfig.config` 문구를 재사용하지 말고 "발급-1회-노출·즉시 rotation 무효화" 등 **독립된 근거**를 적을 것(같은 문구 재사용 시 "두 예외가 동급"이라는 오독으로 세 번째 평문 예외가 같은 패턴으로 또 늘 위험), (b) `14-external-interaction-api.md:910` "향후 검토" 문구를 "의식적 예외로 결정됨(근거: …)"으로 정정 |
| 3 | Plan Coherence | 신규 발견 잔여 갭 2건(`NodeExecution.error`, `inputData`/`outputData` — "같은 클래스의 유출 가능성"으로 실측 기록됨)이 정본 트래커에 미등재. 그 등재 자체가 "I1·D 닫기"와 한 체크박스로 결합돼 있어, I1·D 만 닫고 체크하는 순간 신규 등재가 조용히 "완료"로 읽힐 위험 | `plan/in-progress/eia-internal-rest-error-masking.md` "조치" 체크리스트 마지막 항목(:171) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` I1(:180-184)·D(:186-190), 둘 다 미결 `[ ]`. 같은 트래커 파일이 이미 5회 "미래형 등재 약속 후 미이행" 자백 + 1회 직접 교정(결합 항목 분리) 전례 있음 — 동일 패턴 3번째 재발 소지 | (a) "조치" 마지막 항목을 "I1·D 닫기"와 "신규 잔여 2건 등재" 두 체크박스로 분리, (b) 가능하면 지금 바로 `spec-sync-external-interaction-api-gaps.md` 에 `NodeExecution.error`·`inputData`/`outputData` 를 새 미결 항목으로 등재 |
| 4 | Naming Collision | 신규 함수명 `redactExecutionErrorValue` 가 기존 typed 예외 계층 클래스명 `ExecutionError`(`workflow-errors.ts:33`, `instanceof ExecutionError` 로 다수 지점이 소비하는 보안 계약 클래스)를 온전한 부분 문자열로 포함 — 데이터(값 마스킹)와 제어흐름(예외 클래스)이라는 다른 층위인데 이름이 겹쳐 검색·로그·리뷰에서 혼동 위험. 저장소가 이미 2회 겪은 "같은 이름, 다른 의미" 패턴의 3번째 재발 소지 | `plan/in-progress/eia-internal-rest-error-masking.md:80` (`shared/utils/terminal-error-payload.ts` 형제로 신설 예정) | `codebase/backend/src/modules/execution-engine/workflow-errors.ts:33` `export abstract class ExecutionError extends Error` | 함수명을 `redactExecutionErrorField`/`maskExecutionErrorRecord`/`redactExecutionErrorColumn` 등 "DB 컬럼 값"임이 드러나는 이름으로 변경. 현재 이름 유지 시 docblock 에 "`ExecutionError` 예외 클래스와 무관 — DB `Execution.error` 컬럼 값 마스킹" 캐비엇 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec + Rationale Continuity | `interaction.triggerToken` "향후 secret store 통합 검토" 문구가 함의하는 궤적(언젠가 이관)과 실제 결정(영구 예외 등재) 사이의 번복 — 결정 자체는 문제 아니나 문구 방치 시 "검토 중"이라는 거짓 상태가 spec 에 남음 | `spec/5-system/14-external-interaction-api.md:910` | 위 WARNING #2 제안 (b) 와 같은 자리에서 함께 정리 |
| 2 | Cross-Spec + Convention Compliance | `6-websocket-protocol.md` 에 `### 4.4` 절 번호가 두 번 등장(`:392` 사용자 입력 대기, `:761` 알림 이벤트), `§4.3`(`:738`)이 `§4.4`(`:392`) 뒤에 위치 | `spec/5-system/6-websocket-protocol.md:392,738,761` | 이번 EIA 마스킹 작업 스코프 밖, `plan/complete/spec-draft-ws-types-canonical-location.md` 가 이미 "diff 무관 기존 상태"로 스코프 밖 명시. 급하지 않은 별도 문서-위생 후속 권장 |
| 3 | Plan Coherence | 정본 트래커 I1·D 항목 원문이 아직 "2026-08-16 택일 완료" 사실을 반영하지 않음(체크박스 `[ ]`, 각주 없음) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:180-190` | 필수 아님. I1·D 옆에 "결정(2026-08-16), 집행 중: `eia-internal-rest-error-masking.md`" 한 줄 추가 시 다음 세션의 재검토 방지 |
| 4 | Naming Collision | `secret-store.md §1` 신규 "비대상 — `interaction.triggerToken`" 등재는 기존 `AuthConfig.config` 패턴과 명명·구조 일치 확인, 필드 경로도 spec 전역에서 일관 사용 — 충돌 없음 | `spec/conventions/secret-store.md:40` | 없음(그대로 진행 가능). 단 근거 문구는 WARNING #2 제안대로 독립적으로 작성 |
| 5 | Naming Collision | 신규 함수가 놓일 파일 위치가 plan 에 "형제"로만 서술돼 신규 파일 vs 기존 파일(`terminal-error-payload.ts`) 내 추가 여부 불명 | `plan/in-progress/eia-internal-rest-error-masking.md:80` | 구현 착수 시 명시적으로 확정 |
| 6 | Convention Compliance | `redactExecutionErrorValue` 설계(DB egress-only 원문 보존, `toTerminalErrorPayload` 미재사용, `deepRedactSecrets` 재사용)가 기존 §R17 masking 계층 원칙과 동형 — 위반 없음 확인 | `plan/in-progress/eia-internal-rest-error-masking.md` §설계 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `Execution.error` 노출 비대칭(WARNING, spec 자체가 "미결"로 정직 표시) + secret-store 비대상 불일치(INFO) + WS §4.4 중복(INFO, 장기 기존 결함) |
| Rationale Continuity | MEDIUM | 동일 `Execution.error` 비대칭이 CWE-209 원칙과 이미 충돌 중(WARNING) + `secret-store.md` "모든 도메인 모듈" 원칙과 `triggerToken` 예외의 근거 질 차이(WARNING) |
| Convention Compliance | LOW | `interaction.triggerToken` 평문 저장이 secret-store.md 문언과 정면 충돌(WARNING, 신규 채택 아닌 기존 gap) + WS §4.4 중복(INFO) |
| Plan Coherence | LOW | 신규 잔여 갭 2건 미등재 + 체크박스 결합(WARNING, 저장소 기존 패턴 재발 소지) |
| Naming Collision | LOW | `redactExecutionErrorValue` 가 `ExecutionError` 클래스명 부분 포함(WARNING) |

## 권장 조치사항

1. `plan/in-progress/eia-internal-rest-error-masking.md` 구현 완료 조건에 다음을 명시적으로 포함(코드와 spec 갱신을 같은 턴/PR 로 짝짓기): (a) `14-external-interaction-api.md` §R17 "미결이다" 캐비엇 flip, (b) `2-navigation/14-execution-history.md` 에 `Execution.error` 마스킹 정책 별도 명시, (c) `3-workflow-editor/3-execution.md` §10.6.1 동반 확인.
2. `secret-store.md §1` 에 `interaction.triggerToken` 비대상 등재 시 `AuthConfig.config` 문구를 그대로 재사용하지 말고 독립 근거(발급-1회-노출·즉시 rotation 무효화 등) 작성 + `14-external-interaction-api.md:910` "향후 검토" 문구를 "의식적 예외로 결정됨"으로 정정.
3. `eia-internal-rest-error-masking.md` "조치" 체크리스트 마지막 항목을 "I1·D 닫기"와 "신규 잔여 2건(`NodeExecution.error`, `inputData`/`outputData`) 등재"로 분리, 가능하면 지금 `spec-sync-external-interaction-api-gaps.md` 에 선등재.
4. 신규 함수명 `redactExecutionErrorValue` 를 `ExecutionError` 클래스명과 겹치지 않는 이름(`redactExecutionErrorField` 등)으로 변경하거나 docblock 캐비엇 명시.
5. (선택, 급하지 않음) `6-websocket-protocol.md` §4.3/§4.4 이하 절 번호 순차 재정렬 — 별도 문서-위생 후속.
