# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 NONE/LOW, CRITICAL 0건)

## 전체 위험도
**LOW** — 5개 checker 모두 CRITICAL·WARNING 0건, INFO만 존재. `plan_coherence` 가 실행 단계
오독 위험(트래커 경고 미승계) 하나를 LOW로 표시한 것이 최고 등급.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 항목①(`InteractionRequestContext` union stale→EIA §3.3.1 포인터) 처분은 chat-channel.md §5.1(319행) vs EIA §3.3.1(113-150행)의 실재 CRITICAL급 타입 shape 모순을 안전하게 해소 | `spec/5-system/15-chat-channel.md:319,507` vs `spec/5-system/14-external-interaction-api.md:113-150` | 그대로 진행. 다만 포인터 치환 시 chat-channel 고유 맥락("무엇을 보장하는지") 요약 1~2문장은 남길 것 |
| 2 | cross_spec | 항목②(legacy `statusCode/errors` 대비 문구) stale 확인, webhook §5.2/error-handling §1.7 과 이미 정합 | `spec/5-system/14-external-interaction-api.md:331` | 그대로 진행 |
| 3 | cross_spec | 항목③(`EIA-AU-09` 미정의 참조) 다른 위치 잔존 참조 없음 확인 | `spec/data-flow/15-external-interaction.md:119` | 그대로 진행 |
| 4 | cross_spec | `spec_impact` frontmatter 3파일이 실제 처분 3항목과 1:1 대응, 과소·과대 선언 없음 | frontmatter `spec_impact` | 없음 |
| 5 | rationale_continuity | 항목① 포인터 치환은 chat-channel.md 자신의 `## Rationale` R6("타입 계약은 EIA/convention 이 SoT") 원칙을 뒤늦게 준수하는 방향 — 번복 아님 | `spec/5-system/15-chat-channel.md` Rationale R6 | 실행 시 포인터 앵커를 EIA **§3.3.1 전체 절**로 잡을 것(§3.3 요구사항 행만 가리키면 "외부 HTTP guard 는 scope 를 절대 set 안 함" 불변식 문장을 놓칠 수 있음) |
| 6 | rationale_continuity | 항목② "legacy" 대비 문구는 작성 시점(#228)엔 사실이었고, webhook 이 별도 PR(#754/`7e181ed8e`)로 봉투를 통일하며 EIA 쪽만 미동기화된 것 — 무근거 소급 서술 아님 | `spec/5-system/14-external-interaction-api.md:331` | (선택) 취소선 주석에 `7e181ed8e`(#754) 커밋 해시를 근거로 함께 남기면 향후 재검토 시 재조사 불요 |
| 7 | rationale_continuity | 항목③ `EIA-AU-09` 제거는 무결하나, 동일 오기가 `codebase/backend/src/modules/external-interaction/interaction.guard.ts:27` JSDoc 에도 남아있음(target 범위 밖, spec만 수정) | `codebase/backend/.../interaction.guard.ts:27` | (선택) 후속 developer 작업 시 동일 코드 주석도 정정하도록 트래커에 한 줄 남길 것 — 이번 planner 턴 필수 의무 아님 |
| 8 | convention_compliance | SoT 포인터 phrasing에 강제 규약은 없음 — `audit-actions.md` 식 명시적 볼드 라벨 관행 참고 가능 | `spec/5-system/15-chat-channel.md §5.1` (적용 예정 위치) | (선택) "SoT: EIA §3.3.1" 라벨 형태 고려, 강제 아님 |
| 9 | convention_compliance | 취소선(strikethrough)+해소일자 정정 관행은 EIA 문서 자체에 이미 다수 선례(591·593·1547·1550·1655행) 존재 — target ② 처분 방식과 정확히 일치 | `spec/5-system/14-external-interaction-api.md` | 없음 |
| 10 | plan_coherence | target ③이 정본 트래커(`spec-sync-external-interaction-api-gaps.md:1322-1323`)가 이미 남긴 경고("실제 표기는 `EIA-AU-08/09` 결합형 — 단독 `grep 'EIA-AU-09'` 는 0건을 낸다")를 텍스트로 이어받지 않음 | `plan/in-progress/spec-text-fixes.md` §처분 방침 ③ | target ③ 처분 방침 또는 검증 절에 "실제 표기는 `EIA-AU-08/09` 결합형 — `/09` 부분만 제거" 한 줄 추가해 실행 단계 조기 종료(오독) 위험 제거 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 3항목 모두 실측 재확인, ①은 실재 타입 shape 모순을 안전하게 해소, 앵커·spec_impact 커버리지 문제없음 |
| rationale_continuity | NONE | 3항목 모두 Rationale 절 직접 수정 없음, 기각된 대안 재도입·무근거 번복 아님(모두 시점 드리프트) |
| convention_compliance | NONE | `spec/conventions/**` 명시 위반 없음, 제안 처분 방식이 대상 문서의 기존 관행과 정합 |
| plan_coherence | LOW | 정본 트래커 항목 1:1 승계 확인, 단 트래커의 `EIA-AU-08/09` 결합 표기 경고를 target이 이어받지 않아 실행 오독 위험 |
| naming_collision | NONE | 신규 식별자(요구사항 ID·타입·endpoint·이벤트·ENV·경로) 도입 전무, 검토 표면 자체 없음 |

## 권장 조치사항
1. target ③ 처분 방침/검증 절에 "실제 표기는 `EIA-AU-08/09` 결합형 — `/09` 부분만 제거" 한 줄 추가 (plan_coherence, 실행 오독 방지 — 유일한 LOW 항목 해소)
2. target ① 실행 시 포인터 앵커를 EIA §3.3.1 전체 절로 지정 (rationale_continuity)
3. (선택) target ② 취소선 주석에 `7e181ed8e`(#754) 커밋 해시 근거 병기 (rationale_continuity)
4. (선택) `interaction.guard.ts:27` JSDoc 의 동일 `EIA-AU-09` 오기를 후속 developer 트래커에 등재 (rationale_continuity, 이번 턴 범위 밖)
5. (선택) ① 포인터 문구에 "SoT: EIA §3.3.1" 라벨 스타일 고려 (convention_compliance)
