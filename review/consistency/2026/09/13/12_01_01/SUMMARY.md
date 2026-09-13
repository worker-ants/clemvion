# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 0건 (5개 checker 전원 CRITICAL 없음, 최고 등급 LOW)

## 전체 위험도
**LOW** — spec/5-system/ 델타는 0(코드+가이드 전용 PR)이며 신규 충돌·회귀 없음. 다만 plan 처분 표의 "등재" 문구 1건이 실제로는 트래커에 반영되지 않은 상태로 확인되어 조치가 필요하다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## planner 인계 (권한 밖 Critical)

> 해당 없음 — Critical 발견이 없어 인계할 항목이 없다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence (cross_spec 의 "이미 등재" 가정을 반증) | `guide-error-code-truth.md` §J 처분 표가 "도메인 카탈로그 §6 누락 — **등재**"라고 적었으나, 실제로 `spec-draft-nullable-notation-followups.md`(커밋 `42680d5f9` diff·전체 grep)에는 `MAKESHOP_UNRESOLVED_PATH_PARAM`/`CAFE24_UNRESOLVED_PATH_PARAM` §6 갱신 항목이 존재하지 않는다. cross_spec 은 이 항목이 "이미 tracker 에 등재"됐다고 서술했으나 plan_coherence 의 git show/grep 실측으로 반증됨 — 두 checker 결론이 충돌하며, 실측한 쪽(plan_coherence)을 채택한다 | `plan/in-progress/guide-error-code-truth.md` §J 처분 표 및 `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 항목 부재) | `spec/4-nodes/4-integration/5-makeshop.md §6`, `spec/4-nodes/4-integration/4-cafe24.md §6` (에러 코드 카탈로그가 `*_UNRESOLVED_PATH_PARAM` 계열 미기재) | `guide-error-code-truth.md` 를 `plan/complete/` 로 이동하기 전에, `spec-draft-nullable-notation-followups.md` 의 "§1 카탈로그 누락" 항목(3204~3223행) 범위를 두 §6 표 갱신까지 명시적으로 확장하거나 별도 체크박스로 신규 등재할 것 — planner 턴 필요 |
| 2 | convention_compliance | `LlmService.testConnection` 실패 응답 필드 `message` 가 present-when-available(키 생략) 패턴인데 문서화 절 어디에도 그 필드·사유가 없음 — API 규약 §5.4 미충족 | `spec/5-system/7-llm-client.md` §8.3 probe 전략 표(성공 케이스만 기재, 실패 행 없음), `spec/2-navigation/6-config.md` 동일 엔드포인트 요약행 | `spec/5-system/2-api-convention.md §5.4` (키 생략 필드는 문서화 절에 사유 명시 의무) | planner 턴에서 §8.3 표에 실패 행(`{success:false, message}`, message 는 `sanitizeLlmErrorMessage` 8갈래 고정 문장) 추가 + 키 생략 사유 명시. 이미 `guide-error-code-truth.md` §E 에 등재되어 유실 위험은 낮음 |
| 3 | convention_compliance | `PROJECT.md` 가 신규 가드 2건(`guide-error-code-existence.test.ts`, `guide-sanitized-message-parity.test.ts`)의 SoT 로 `user-guide-evidence.md §2` 를 지목했으나, 그 절의 가드 표·frontmatter `code:` 목록에는 신규 가드 3종(스캐너 포함)이 아직 없음 — dangling SoT 참조 | `PROJECT.md:300-301` (가드 카탈로그 신규 2행) | `spec/conventions/user-guide-evidence.md §2` (가드 표 3건 그대로, frontmatter `code:` 갱신 안 됨) | planner 턴에서 §2 표에 3개 신규 가드(테스트 2종 + 스캐너 헬퍼) 추가, §2.1 관계표에 직교 관계 서술, frontmatter `code:` 갱신. 이미 `guide-error-code-truth.md` §D/§E 에 등재되어 유실 위험은 낮음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | "결과 객체 필드명은 에러 봉투와 겹치면 안 된다" 원칙이 `llm.service.ts` JSDoc 에만 있고 spec Rationale 에는 아직 없음 — 4라운드 연속 승계된 INFO, 유실 없이 planner 백로그(`spec-draft-nullable-notation-followups.md`)에 정확히 편입 확인 | `spec/5-system/7-llm-client.md §8.3` 또는 `2-api-convention.md` Rationale | 위 WARNING #2 처리 시 함께 이 원칙과 형제 엔드포인트와의 차이("이쪽은 코드가 없다")를 명문화 |
| 2 | naming_collision | `testConnection` 결과 객체의 `code`/`message` 가 전역 에러 봉투(`{error:{code,message}}`)와 필드명은 같고 스코프(wire 중첩 위치)가 다름 — 형제 엔드포인트(`/integrations/:id/test`) 선례 재사용이라 신규 충돌 아님, DTO 타입 분리로 컴파일 타임에 걸려 WARNING 미승격 | `codebase/backend/.../llm.service.ts` testConnection, `2-api-convention.md §5.3`/`2-navigation/4-integration.md §9.1` | 다음에 이 shape 확장 시 이름 중복·스코프 차이를 인지하도록 위 WARNING #2 정정에 함께 각주 |
| 3 | cross_spec | (§6 카탈로그 누락 자체는 위 WARNING #1 로 통합) — cross_spec 은 이를 "이미 등재됨" 전제로 INFO 처리했으나 plan_coherence 실측으로 그 전제가 반증되어 WARNING #1 로 상향 통합함 | — | (WARNING #1 참고) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec/5-system 델타 0, 데이터모델·API계약·상태전이·RBAC 재확인 결과 신규 CRITICAL/WARNING 없음. 도메인 카탈로그 §6 누락을 "이미 등재됨"으로 판단했으나 이는 plan_coherence 로 반증됨(WARNING #1 참고) |
| rationale_continuity | NONE | 은퇴 코드 재도입 없음, 합의된 원칙(§9.1 결과객체 패턴·CWE-209 비노출·nodeLabel 정정)이 모두 지켜짐. 1건 INFO(승계 확인) |
| convention_compliance | LOW | spec 전문 확인 2건 신규 위반 없음. testConnection 실패 shape 미문서(§5.4) + PROJECT.md dangling SoT 참조 2건 WARNING, 둘 다 이미 developer 가 planner 백로그에 등재 |
| plan_coherence | LOW | "등재했다"는 §J 처분 문구가 실제로는 트래커에 반영 안 됨을 grep/git show 로 실측 확인(같은 PR 내 세 번째 유사 인스턴스) — 유일한 실질 WARNING |
| naming_collision | NONE | spec 델타 0, 코드 diff 21파일의 신규 식별자(테스트 3종 파일명, DTO 필드 rename/추가, 가이드 인용 코드) 전수 대조 결과 충돌 없음. 직전 라운드 CRITICAL(오귀속)은 정정 확인 |

## 권장 조치사항
1. (BLOCK 해소 우선) 해당 없음 — Critical 없음, push/turn 종료 차단 사유 없음.
2. `guide-error-code-truth.md` 를 `plan/complete/` 로 이동하기 전에, `spec-draft-nullable-notation-followups.md` 에 `5-makeshop.md §6`/`4-cafe24.md §6` 카탈로그 갱신 항목을 **실제로** 추가할 것 — 현재 §J 의 "등재" 문구는 거짓 상태다 (WARNING #1).
3. 다음 planner 턴에서 `spec/5-system/7-llm-client.md §8.3` 에 `testConnection` 실패 응답 행 추가 (WARNING #2).
4. 다음 planner 턴에서 `spec/conventions/user-guide-evidence.md §2` 표·frontmatter 에 신규 가드 3종 등재 (WARNING #3).
5. 여유가 되면 "결과 객체 필드명은 에러 봉투와 겹치면 안 된다" 원칙을 spec Rationale 에 명문화 (INFO #1, WARNING #2 와 동시 처리 권장).