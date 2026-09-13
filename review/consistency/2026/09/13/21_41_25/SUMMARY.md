# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 0건. 모든 checker 가 전문(인라인)으로 정상 수신됨 (재시도 필요 없음). 각 checker 개별 산출 파일(`cross_spec.md` 등)은 이미 디스크에 존재함(확인 완료, 추가 Write 불요).

## 전체 위험도
**LOW** — spec/conventions 델타 0(코드/harness 전용 배치)이라 정면 충돌은 없으나, 이전부터 열려 있던 "가이드 정정 vs spec 6파일의 서술 오류" 간극 및 SoT 인용 착지 실패가 WARNING 으로 재확인됨.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance(교차확인) | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 를 이번 PR 이 "메시지 접두, 코드 아님"으로 정정했는데 spec 6개 파일이 여전히 "…에러로 실행 실패/거부" 또는 표의 "코드" 열 값으로 서술 | `spec/5-system/4-execution-engine.md:332-333` §3.0, `spec/3-workflow-editor/2-edge.md:202` §6.1, `spec/3-workflow-editor/0-canvas.md:636` §11.2.2, `spec/4-nodes/1-logic/0-common.md:83`, `7-map.md:179-180` §6, `9-foreach.md:209-210` §6 | `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`/`logic.en.mdx:103` 의 새 정정 문구 + `guide-identifier-scan.ts` 의 `GUIDE_NON_EMITTED_VOCABULARY` 등록 | known-open, 이 PR 비차단. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유 항목으로 6개 파일 전부 정확히 등재돼 미체크 상태 — `3-loop.md §6` 패턴(열 헤더 "메시지"+발행 문자열 전문)으로 통일 권장. 재등록 불요, spec 쓰기는 planner 턴에서 |
| 2 | cross_spec | `3-error-handling.md §1.4` "앵커 없는 코드" 축이 "메시지 접두 전용"과 "정상 앵커 없음"을 구분하지 않음 — `CONTAINER_*` 와 `MAX_ITERATIONS_EXCEEDED` 는 발행 형태가 구조적으로 동일한데 후자만 카탈로그 등재 | `spec/5-system/3-error-handling.md §1.4` 머리말·표 | `guide-identifier-scan.ts` 의 `collectQuotedLiterals`/`collectMessagePrefixes`/`isMessagePrefixOnly` (카탈로그를 "탈출구"로 사용하는 설계) | known-open, 이 PR 비차단. 같은 트래커 항목(미체크)이 이미 택일 (a) `CONTAINER_*` 를 §1.4 에 backfill (b) §1.4 앵커-없는 행에 "메시지 접두" 표기 추가 를 제시 — 재등록 불요 |
| 3 | convention_compliance | `guide-identifier-existence.test.ts` 의 SoT 인용이 실제로 착지하지 않음 | `PROJECT.md` §"developer workflow 자가 점검" 목록의 해당 항목 끝 `SoT: spec/conventions/user-guide-evidence.md §2`, 및 `guide-identifier-scan.ts` 파일 머리말 동일 인용 | `spec/conventions/user-guide-evidence.md §2` "Build-time 가드 (3건)" 표 — `impl-anchor-existence.test.ts`/`integrations-coverage.test.ts`/`triggers-coverage.test.ts` 3건만 등재, 해당 가드 미포함(grep 0건) | `PROJECT.md` 해당 줄과 `guide-identifier-scan.ts` 헤더의 SoT 표기를 `error-codes.md`(명명·발행 개념)+`3-error-handling.md §1`(카탈로그)로 정정하거나 `user-guide-evidence.md §2` 표에 4번째 가드로 등재. spec 쪽 수정이 필요하면 developer 가 직접 고치지 말고 트래커에 적어 planner 턴으로 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `PROJECT.md:300` SoT 꼬리표가 `user-guide-evidence.md §2` 를 가리키지만 그 절에 없음 (이 PR 이전부터 존재, 이 PR 무관 — WARNING#3 과 사실상 동일 지점, 이 PR 이전부터 있던 상태임을 확인) | `PROJECT.md:300` | 다음에 해당 문서를 편집하는 세션에서 처리 |
| 2 | rationale_continuity | `GUIDE_NON_EMITTED_VOCABULARY`(메시지 접두 판별)와 `chat-channel-adapter.md §R-CCA-9`(런타임 message-parsing 금지)가 어휘는 겹치나 층이 다름(정적 문서검증 vs 런타임 분기) — 정신적으로는 정합 | `guide-identifier-scan.ts` `isMessagePrefixOnly`/`collectMessagePrefixes` | 헤더 JSDoc 에 "런타임 제어흐름 아닌 문서-검증 정적 분석" 한 줄 추가 권장(필수 아님) |
| 3 | rationale_continuity | §1.4 "카탈로그를 탈출구로" 설계는 기존 §1.4 결정의 재사용이며 발생한 비일관성은 이미 별도 backlog 로 분리됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md` §1.4 항목 | 조치 불요 |
| 4 | rationale_continuity | 가이드 문구 정정은 `#1330`(`ce454e046`)이 세운 "(A) 문장 정정" 선례의 두 번째 적용, 무근거 번복 아님 | `logic.mdx`/`logic.en.mdx` | 조치 불요 |
| 5 | convention_compliance | "허용목록 없음" 설계 원칙이 두 번째로 번복(`GUIDE_EXTERNAL_VOCABULARY` → `GUIDE_NON_EMITTED_VOCABULARY`)됐는데 그 원칙 자체가 spec/conventions 어디에도 정식 등재돼 있지 않음(코드 주석+plan 에만 존재) | `guide-identifier-scan.ts` `GUIDE_NON_EMITTED_VOCABULARY` | 이 축 안정화 후 `error-codes.md` 또는 신규 convention 문서에 "예외 등록부는 있되 사유를 강제한다" Rationale 로 승격 권장(`audit-actions.md` 선례와 일관) |
| 6 | convention_compliance | `CONTAINER_*` 를 코드로 서술하는 6개 spec 파일 불일치는 이 diff 가 만든 게 아니라 이미 트래커에 올바르게 등재됨(WARNING#1 과 동일 사안) | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 중복 재등재 방지용 확인 기록 |
| 7 | plan_coherence | "카탈로그 탈출구 조건부 폐기" forward-note 가 developer plan(`error-code-emission-axis.md:171-176`)에만 있고, 결정이 내려질 tracker 항목(§1.4 backfill 택일, 3208 항목) 쪽에는 역참조가 없어 `plan/complete/` 이동 후 유실 위험 | `plan/in-progress/error-code-emission-axis.md:171-176` | `spec-draft-nullable-notation-followups.md` 의 3208 항목·§1.4 택일 항목에 "해소 시 `error-code-emission-axis` 가드 등록 재검토" 역참조 한 줄 추가 (급하지 않음, 다음 planner 턴) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec/conventions 델타 0, round 6 대비 cross-spec 상태 불변. `CONTAINER_*` 코드-서술 6파일 + §1.4 앵커 축 미구분 WARNING 2건, 둘 다 known-open·트래커 등재 완료 |
| rationale_continuity | NONE | 신규 spec 결정 없음. 메시지-접두 판별 설계가 R-CCA-9 와 층은 다르나 정신적으로 정합, 가이드 정정은 `#1330` 선례 재적용. 기각 대안 재도입·무근거 번복 없음 |
| convention_compliance | LOW | spec/conventions 델타 0. `guide-identifier-existence.test.ts` SoT 인용 착지 실패 WARNING 1건(신규 발견), 허용목록 원칙 미등재·CONTAINER_* 서술 오류는 INFO(이미 트래커 등재) |
| plan_coherence | NONE | 직전 라운드(21_19_52) WARNING 2건(spec_impact 5파일 누락, §1 카탈로그 합의 미인용) 모두 `eb53aba1c` 에서 실측 해소 확인. sibling plan 상태 대조 정합. forward-note 역참조 누락 INFO 1건만 |
| naming_collision | NONE | round 6 diff 가 새로 더한 최상위 선언 `sourceLinesCache`/`resolveSourceLines` 2개, 저장소 전체 grep 충돌 0건. 누적 13개 식별자 재검증도 충돌 0건 |

## 권장 조치사항
1. (BLOCK 사유 없음 — 즉시 조치 불요) 다음 spec 편집 세션(planner 턴)에서 WARNING 3건을 함께 처리: (a) `CONTAINER_MISSING_EMIT`/`MULTIPLE_EMIT` 6개 spec 파일을 `3-loop.md §6` 패턴으로 통일, (b) `3-error-handling.md §1.4` 에 "메시지 접두 전용" 축 명시 또는 backfill, (c) `guide-identifier-existence.test.ts` 의 SoT 인용을 `error-codes.md`+`3-error-handling.md §1` 로 정정하거나 `user-guide-evidence.md §2` 표에 등재.
2. INFO#7(forward-note 역참조)은 급하지 않으나 위 (b) 처리 시 함께 추가하면 비용이 낮다.
3. INFO#5(허용목록 없음 원칙의 conventions 미등재)는 이 축(`GUIDE_*_VOCABULARY`)이 세 번째로 반복되면 Rationale 승격을 검토.