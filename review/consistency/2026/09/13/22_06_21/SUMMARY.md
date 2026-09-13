# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. `cross_spec`/`convention_compliance`/`plan_coherence` 는 WARNING 을 냈으나 전부 known-open 이거나 developer 권한 밖(§planner 트래커 기등재)이며 이 PR 자체를 막을 사유는 없다.

## 전체 위험도
**LOW** — CRITICAL 없음, WARNING 4건(사실상 3개 이슈로 중복 통합), 대부분 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유 항목으로 정확히 등재·역참조돼 있음.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음 — CRITICAL 자체가 없으므로 인계 대상 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 가 카탈로그 SoT(`3-error-handling.md §1.4`)에 미등재된 채, 유저 가이드는 "코드 아님"으로 정정됐는데 spec 6개 파일(`5-system/4-execution-engine.md §3.0`, `3-workflow-editor/2-edge.md §6.1`, `3-workflow-editor/0-canvas.md §11.2.2`, `4-nodes/1-logic/{0-common,7-map,9-foreach}.md`)은 여전히 "에러 코드"로 서술 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (`collectCatalogCodes`/`GUIDE_NON_EMITTED_VOCABULARY`) + 위 6개 spec 파일 | `spec/conventions/error-codes.md` Overview(카탈로그 SoT 지정), `spec/5-system/3-error-handling.md §1.4` | known-open, round 7 이전부터 불변. `spec/` 쓰기는 planner 권한 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 대상 파일 6개 전수 열거 + 양방향 역참조로 **이미 정확히 등재**(미체크). 새 등재 불요. planner 턴에서 `3-loop.md §6` 패턴(메시지 전문 인용) 통일 권장 |
| 2 | cross_spec | `3-error-handling.md §1.4` "앵커 없는 코드" 축이 "메시지 접두 전용 발행"과 "구조화 code 필드 존재하되 앵커만 없음"을 구분하지 않음 (`MAX_ITERATIONS_EXCEEDED` 는 카탈로그 등재, 구조가 동일한 `CONTAINER_*` 는 미등재) | `guide-identifier-scan.ts` 의 `isMessagePrefixOnly`/`collectCatalogCodes` 설계 전제 | `spec/5-system/3-error-handling.md §1.4` 머리말 | 위 #1 과 **동일 planner 트래커 항목**에 택일안(a) 카탈로그 backfill (b) §1.4 앵커-없는 행에 "메시지 접두" 표기 추가로 이미 등재됨. 재등록 불요 |
| 3 | plan_coherence | `error-code-emission-axis` plan 이 7라운드에 걸쳐 `guide-identifier-scan.ts` 를 245줄 순증시켰는데, 그 파일의 비대화(361줄=주석260·코드84)를 근거로 리팩터 조건을 건 형제 트래커 항목의 실측 수치를 한 번도 갱신하지 않음 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3332` | `guide-identifier-scan.ts` 현재 실측(601줄=주석418·코드156·빈줄27, 240줄/66% 차이) | 해당 항목에 갱신 실측치(601/418/156/27) 추가 또는 "이후 라운드가 더 키웠다" 한 줄 추가. 이번 커밋 범위에 함께 묶기 권장 |
| 4 | convention_compliance | SoT 인용 문구가 `error-codes.md` 자기 선언 범위(명명·안정성만 소유, "발행"은 §4 한정)보다 넓게 "(코드 명명·발행)" 으로 표기 | `guide-identifier-scan.ts` 파일 헤더 주석 | `spec/conventions/error-codes.md` Overview | 표현의 느슨함, 위반이라기보다 인용 정확도 문제. `(코드 명명)` 으로 좁히거나 `error-codes.md §4` 병기 권장. 시급성 없음 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | SoT 인용 정정(`user-guide-evidence.md §2` → `error-codes.md`+`3-error-handling.md §1`)은 사실 정정이지 결정 번복 아님 — 정정 전 인용이 애초 착지하지 않았음을 grep 0건으로 확인 | `guide-identifier-scan.ts` 헤더, `guide-identifier-existence.test.ts` JSDoc | 조치 불요 |
| 2 | rationale_continuity | `GUIDE_NON_EMITTED_VOCABULARY`/`GUIDE_EXTERNAL_VOCABULARY` 분리 유지는 `user-guide-evidence.md §Rationale R-2`("두 가드는 보완 관계, 통합 금지") 원칙의 새 축 적용 — 위반 아님 | `plan/in-progress/spec-draft-nullable-notation-followups.md §C` | 조치 불요(긍정 대조) |
| 3 | rationale_continuity | `isMessagePrefixOnly` 판별은 `chat-channel-adapter.md §R-CCA-9`(런타임 message-parsing 기각)와 어휘만 겹칠 뿐, 빌드타임 문서-검증 정적 스캔이라 층이 다름 | `guide-identifier-scan.ts` | 필수 아님 — 헤더에 "런타임 분기 아님, R-CCA-9 대상과 다름" 한 줄 추가 시 향후 과잉 일반화 예방 |
| 4 | cross_spec | round 7→8 diff(`eb53aba1c`→`53d29a6f4`)는 테스트 대조군 추가 + SoT 인용 정정뿐, `spec/**` 무변경 확인 | 전체 diff | 비이슈, 조치 불요 |
| 5 | naming_collision | 신규 top-level 식별자 0개(round 7), 누적 13개 식별자 저장소 전체 grep 재확인 — 대상 2파일 밖 충돌 0건 | `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` spec 6파일 미정합 + §1.4 앵커 축 모호 — 둘 다 known-open, planner 트래커 기등재 |
| rationale_continuity | NONE | 과거 결정 번복·기각 대안 재도입 없음. SoT 인용 정정은 사실 정정, 두 예외축 분리는 기존 R-2 원칙 재적용 |
| convention_compliance | LOW | 카탈로그 SoT 미배선(위 #1 과 동일 이슈, 다른 각도) + SoT 인용 범위 과대 표기 |
| plan_coherence | LOW | 형제 트래커 항목의 실측 라인수가 7라운드 누적 편집으로 stale(361→601) |
| naming_collision | NONE | 신규 식별자 0개(round 7), 누적 13개 충돌 없음 |

## 권장 조치사항
1. (선택, 비차단) `plan/in-progress/spec-draft-nullable-notation-followups.md:3332` 항목에 `guide-identifier-scan.ts` 갱신 실측치(601줄=주석418·코드156·빈줄27)를 추가 — 이번 커밋 범위에 묶기 권장.
2. (선택, 비차단) `guide-identifier-scan.ts` 헤더의 SoT 인용을 `(코드 명명)` 으로 좁히거나 `error-codes.md §4` 를 병기.
3. `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 관련 spec 6파일 정정 및 `3-error-handling.md §1.4` 표기 정리는 이미 planner 트래커에 정확히 등재돼 있으므로 **이 PR 에서는 조치 불요** — planner 턴에서 일괄 집행.
4. 위 모두 WARNING/INFO 수준이며 BLOCK 사유 없음 — 이 배치는 통과 가능.
