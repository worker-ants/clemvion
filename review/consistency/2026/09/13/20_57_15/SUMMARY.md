# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec, rationale_continuity, convention_compliance,
plan_coherence, naming_collision) 전원 전문 확보(모두 `status=success`, 인라인 전문 authoritative
사용). Critical 0건. 5개 checker 개별 산출물 파일은 이미 디스크에 모두 존재함을 확인했다
(누락 없음, 영속화 조치 불요).

## 전체 위험도
**LOW** — `spec/**` 델타 0(코드·가이드·harness 전용 PR), 새 CRITICAL 없음. 남은 항목은 전부
직전 라운드부터 이어지는 known-open WARNING/INFO 이며 이번 라운드가 새로 만든 위반은 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 이 없으므로 인계 대상 없음. 아래 WARNING 중 `§1.4` 관련 항목은 근본 처분이
planner 권한(spec 본문 편집)이지만 등급이 WARNING(비차단)이고 이미
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 소유 항목(3427·3448)
으로 등재돼 택일을 기다리는 상태라 별도 인계 절차가 불필요하다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` — 가이드는 이번 PR 로 "코드 아님(메시지 접두)"으로 정정됐는데 spec 6파일은 여전히 인라인 코드로 표기해 구조화 에러 코드처럼 서술 | `codebase/frontend/src/content/docs/02-nodes/logic.mdx:114`, `logic.en.mdx:103` + `guide-identifier-scan.ts` `GUIDE_NON_EMITTED_VOCABULARY` 등록 2건 | `spec/5-system/4-execution-engine.md:332-333`, `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/9-foreach.md:209-210` (6파일) | `plan/in-progress/spec-draft-nullable-notation-followups.md` (~3448) 에 이미 planner 항목 등재(택일: (a) 6파일을 `3-loop.md:189-191` 형태로 통일해 전문 메시지 인용, (b) `3-error-handling.md §1.4` 에 "메시지 접두 전용" 표기 추가). 재등록 불요, 이 PR 비차단 |
| 2 | cross_spec, rationale_continuity | `3-error-handling.md §1.4` "앵커 없는 맨 문자열" 서술이 "메시지 접두로만 발행"(§1.4 표의 7종·`CONTAINER_*`)과 "정상 카탈로그 등재"를 구조적으로 구분하지 않음 | `guide-identifier-scan.ts` `collectQuotedLiterals`/`collectMessagePrefixes`/`isMessagePrefixOnly` (§1.4 서술에 의존해 새 축 도입) | `spec/5-system/3-error-handling.md §1.4` 머리말 + 표(`RECURSION_DEPTH_EXCEEDED` 등 7종) | 위 항목과 동일 트래커 항목(3448)이 함께 다룸 — 택일 (b)가 이 갈림까지 해소. 별도 재등록 불요 |
| 3 | plan_coherence | 배치 존재 이유인 트래커 항목("가이드 에러 코드 가드가 «존재»만 보고 «방출»을 안 본다")을 "닫는다"고 PR 머리말에 선언했는데 트래커 원본 체크박스는 아직 `[ ]` 미해소 | `plan/in-progress/error-code-emission-axis.md` 머리말 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3394` (여전히 `[ ]`) | `error-code-emission-axis.md` 완료(라운드 5 GREEN) 직후 같은 커밋에서 3394번을 `[x]` + 해소 각주로 갱신(3412번 항목 갱신 패턴 그대로 적용). developer 가 `plan/**` 쓰기 권한을 이미 보유하므로 이 PR 범위 내에서 직접 처리 가능 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 이번 라운드 순증분(JSDoc 위치 정정, `staleEntries`→`staleGuideEntries` 개명 전수 반영)은 규약 위반 없음 — 오히려 기존 export 함수와의 명명 충돌을 없애는 방향 | `guide-identifier-existence.test.ts` | 조치 불요 |
| 2 | convention_compliance | `PROJECT.md:300` 의 SoT 인용(`spec/conventions/user-guide-evidence.md §2`)이 실제로 `guide-identifier-existence.test.ts` 를 서술하지 않음(그 §2 는 3개 다른 가드만 열거) — pre-existing, `origin/main` 시점부터 이미 어긋나 있었음 | `PROJECT.md:300` | 후속: (a) SoT 를 실제 대상 절로 정정, 또는 (b) 2축 하네스 정책을 `spec/conventions/` 문서로 승격해 SoT 이전 |
| 3 | convention_compliance | 존재/발행 2축 하네스(`guide-identifier-scan.ts`)가 성숙한 설계(상한·예외 레지스트리·탈출구 근거)를 갖췄음에도 `spec/conventions/**` 대응 문서가 없음 — pre-existing 공백을 이번 PR 이 두 번째 축으로 확장 | `guide-identifier-scan.ts` 전체 | §1.4 backfill 여부(WARNING #1/#2) 처분과 함께 승격 여부 결정 권고 |
| 4 | plan_coherence | `MAKESHOP_UNRESOLVED_PATH_PARAM` 신규 등록에는 미해소 카탈로그 항목(3208, MakeShop 코드 계열 누락)과의 상호작용 forward-note 가 없음 — `CONTAINER_*` 항목(3448)엔 있는데 이 항목만 없어 절반짜리 | `plan/in-progress/error-code-emission-axis.md` §D-2 등록 표 | §D-2 표 또는 `spec-draft-nullable-notation-followups.md:3208` 에 "3208 해소 시 이 등록도 재검토 대상" 한 줄 추가 |
| 5 | naming_collision | `staleEntries`→`staleGuideEntries` 개명(라운드 4)이 실제로 충돌을 해소했음을 재검증 확인 — 액션 불필요, 참고용 | `guide-identifier-existence.test.ts:73` vs `internal-package-registration-guard.ts:129` | 조치 불요 |
| 6 | naming_collision | `MESSAGE_PREFIX`(module-private) 와 `WC_MESSAGE_PREFIX`(web-chat-sdk) 이름 근접하나 실질 충돌 아님 | `guide-identifier-scan.ts` vs `packages/web-chat-sdk/src/types.ts:52` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | spec 델타 0, 새 CRITICAL 없음. `CONTAINER_*` vs spec 6파일 서술 불일치 + `§1.4` 축 미구분, 둘 다 known-open·planner 트래커 등재분 |
| rationale_continuity | LOW | spec/conventions 델타 0, "기각된 대안 재도입" 표면 없음. `§1.4` 불일치 4라운드 연속 상태 불변. `#1330` 두 번째 번복 관련 INFO 는 라운드 4에서 이미 해소 확인 |
| convention_compliance | LOW | 이번 순증분은 규약 준수 방향. 남은 INFO 2건(`PROJECT.md:300` SoT 오지시, 2축 하네스 spec/conventions 문서 부재)은 pre-existing 이며 이 PR 비발생 |
| plan_coherence | LOW | plan 델타는 diff 로 직접 확인. 트래커 체크박스 동기화 갭(3394 미갱신) 1건 WARNING, forward-note 누락 1건 INFO |
| naming_collision | NONE | 신규 식별자 12종 전수 grep 0건 충돌. 유일 실재 충돌(`staleEntries`)은 이미 해소·재검증 완료 |

## 권장 조치사항
1. (BLOCK 아님, 후속 권고) `error-code-emission-axis.md` 완료 커밋에서
   `spec-draft-nullable-notation-followups.md:3394` 를 `[x]` + 해소 각주로 갱신 —
   PR 머리말의 "닫는다" 선언과 트래커 실제 상태를 일치시킬 것.
2. (후속, developer 비차단) `MAKESHOP_UNRESOLVED_PATH_PARAM` 등록에 3208 항목과의
   상호작용 forward-note 한 줄 추가.
3. (planner 턴, 이미 트래커 등재됨) `spec/5-system/3-error-handling.md §1.4` 처분 택일
   ((a) `CONTAINER_*` backfill vs (b) "메시지 접두 전용" 표기 추가) — 3427·3448 항목이
   이미 이 결정을 기다리고 있으며 이 PR 을 막지 않는다.
4. (선택, 문서 정비) `PROJECT.md:300` SoT 인용을 실제 대상 절로 정정하거나, 2축 하네스를
   `spec/conventions/` 정식 문서로 승격.