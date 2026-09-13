# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 결과 확보(전원 success + 전문 인라인 제공), Critical 발견 없음.

## 전체 위험도
**LOW** — Critical 없음. WARNING 3건 전부 "문서 서술 정합성 / plan 위생" 층위이며 런타임 계약(코드 동작)에는 영향 없음. 신규 식별자 충돌 0건.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 이번 diff 는 "구조화된 코드 아님, 메시지 접두일 뿐"로 정확히 정정했으나, 6개 다른 spec 파일이 같은 두 토큰을 여전히 "~에러로 실행 실패/거부" 또는 표의 "코드" 값으로 서술해 정면 충돌 | `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114` / `logic.en.mdx:103` (이번 diff 로 정정된 문장) | `spec/5-system/4-execution-engine.md:332-333` §3.0(가장 강함) · `spec/3-workflow-editor/2-edge.md:202` §6.1 · `spec/3-workflow-editor/0-canvas.md:636` §11.2.2(+형제 `CONTAINER_INVALID_CHILD`/`CONTAINER_CYCLE` 동일 결함) · `spec/4-nodes/1-logic/0-common.md:83` · `7-map.md:179-180` §6 · `9-foreach.md:209-210` §6 | 이번 PR 스코프 밖(plan §D-2 가 가이드 2파일로 명시적으로 좁힘) — 신규 backlog 항목으로 planner 등재. 대상 6파일, 대비 선례는 `3-loop.md §6`(열 헤더 "메시지" + 발행 문자열 전문 인용) 패턴으로 통일 |
| 2 | rationale_continuity | 가이드의 "전용 에러 코드는 없다" 서술이, 구조적으로 동일한 형태(앵커 없는 `Error` 메시지 접두)의 형제 6종을 정식 "코드"로 등재해 온 `3-error-handling.md §1.4` 관행과 여전히 불일치 — 직전 `--impl-prep`(`18_40_54`) WARNING #3(a) 가 요구한 서술 정정이 부분적으로만(절차적 카탈로그-탈출구 설계로) 이행됨, "왜 이 둘만 카탈로그 밖인가"에 대한 근거는 여전히 무기재 | `plan/in-progress/error-code-emission-axis.md` §D(line ~148-153) + `logic.{mdx,en.mdx}` 정정 문장 | `spec/5-system/3-error-handling.md §1.4` 카탈로그 표 머리말("나머지 7종은 앵커 없는 맨 문자열"도 정식 항목으로 취급) | (a) plan §D·가이드 문장을 "§1.4 의 앵커 없는 엔진 수준 코드이며 아직 카탈로그 미등재"로 좁히거나, (b) `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 을 §1.4 표에 backfill 등재. 선택 이유를 §D 또는 §1.4 Rationale 에 한 줄 기록 |
| 3 | plan_coherence | 이번 diff 가 완전히 해소한 트래커 항목의 체크박스·해소주석이 갱신 안 됨 — 같은 세션이 같은 파일을 다른 항목 때문에 이미 편집했음에도 이 항목만 누락 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3404` (`CONTAINER_MISSING_EMIT·CONTAINER_MULTIPLE_EMIT 도 방출 코드가 아니다`, 여전히 `[ ]`) | `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx` 문장 정정(diff 로 (A) 선택지 실행 완료) | 라인 3404 를 `[x]` 로 체크 + "(A) 채택 완료 — KO/EN 문장 정정, `GUIDE_NON_EMITTED_VOCABULARY` 등록으로 가드 고정" 해소주석 추가. 여의치 않으면 `error-code-emission-axis.md` 체크리스트에 "트래커 3404 를 닫는다" 명시 항목 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `PROJECT.md:300` 의 SoT 표기가 `user-guide-evidence.md §2` 를 가리키지만 그 절 표에 `guide-identifier-existence.test.ts` 가 없음 (이번 PR 이전부터 있던 상태, 새로 만든 결함 아님) | `PROJECT.md:300` vs `spec/conventions/user-guide-evidence.md §2` | 다음에 `user-guide-evidence.md §2` 편집 세션에서 4번째 행 추가 또는 SoT 꼬리표 제거 |
| 2 | rationale_continuity | 직전 라운드(`18_40_54`)가 권고한 §1.4 backfill/문서정정 follow-up 이 어느 plan 에도 신규 체크리스트 항목으로 추적되지 않음 | `plan/in-progress/error-code-emission-axis.md` 체크리스트(line 179-181, 자평 문구가 실제 이행 범위보다 넓게 들림) | 자평 문구를 "WARNING #3(a) 서술 정정은 미이행, §B-3 설계로 절차적 정합화만" 로 좁히고, §1.4 backfill 항목을 `spec-draft-nullable-notation-followups.md` 등에 명시 등재 |
| 3 | convention_compliance | "가이드 식별자 실재성" 가드 family(`GUIDE_NON_EMITTED_VOCABULARY` 등)가 어떤 정식 `spec/conventions/*.md` 문서에도 `code:` 로 소유되지 않음 — `#1330`/`#1331` 부터 있던 구조적 공백, 이번 배치가 표면만 확장 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (신규 export 4종) | 이번 배치 스코프 밖. 후속으로 `user-guide-evidence.md` 에 절 신설하거나 별도 convention 문서 생성해 `code:` 등재. 최소한 plan 에 "의도적으로 규약 문서 없이 코드 주석 SoT 로 유지" 결정을 명기 |
| 4 | naming_collision | 신규 식별자 7개(`GUIDE_NON_EMITTED_VOCABULARY`, `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes`, 내부 정규식 3종) 저장소 전수 grep 결과 충돌 0건. `--impl-prep` 이 지적한 `GUIDE_EXTERNAL_VOCABULARY`↔`GUIDE_NON_EMITTED_VOCABULARY` 명명 인접(제약 반대) 위험은 JSDoc 대조표로 실제 방어됨 | `guide-identifier-scan.ts:288-306` | 없음 — 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 가이드 정정 문장과 6개 spec 문서의 "구조화된 코드" 서술 충돌(WARNING) + PROJECT.md SoT 미러 drift(INFO, 기존) |
| rationale_continuity | LOW | §1.4 앵커없는 카탈로그 관행과의 불일치가 절차적으로만 부분 해소(WARNING) + 후속 backfill 항목 미추적(INFO) |
| convention_compliance | NONE | 정식 규약 위반 0건. 신규 가드 family 의 규약 문서 미소속만 INFO(기존 공백) |
| plan_coherence | LOW | 완전 해소된 트래커 항목(L3404) 체크박스 미갱신(WARNING). 그 외 미해결 planner 결정과의 충돌 없음 |
| naming_collision | NONE | 신규 식별자 7개 전수 충돌 0건, 명명 인접 위험은 JSDoc 대조표로 방어 확인 |

## 권장 조치사항
1. (BLOCK 해소 사유 없음 — 참고용 우선순위)
2. `plan/in-progress/spec-draft-nullable-notation-followups.md:3404` 체크박스를 `[x]` 로 갱신 + 해소주석 추가 (plan_coherence WARNING #3) — 가장 가볍고 즉시 처리 가능
3. `spec/5-system/3-error-handling.md §1.4` 의 "앵커 없는 카탈로그 코드" 관행과 이번 가이드 정정 문장 간 불일치에 대해 (a) plan §D 서술 좁히기 또는 (b) `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` §1.4 backfill 중 하나를 선택하고 근거를 기록 (rationale_continuity WARNING #1)
4. `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 "구조화된 코드"처럼 서술하는 6개 spec 파일(`4-execution-engine.md §3.0`·`2-edge.md §6.1`·`0-canvas.md §11.2.2`·`0-common.md`·`7-map.md §6`·`9-foreach.md §6`) 정정을 새 planner backlog 항목으로 등재, `3-loop.md §6` 패턴으로 통일 (cross_spec WARNING #1)
5. (선택) `user-guide-evidence.md` 에 "가이드 식별자 실재성" 가드 family 절 신설 또는 명시적 미등재 결정 기록 (convention_compliance INFO #1)