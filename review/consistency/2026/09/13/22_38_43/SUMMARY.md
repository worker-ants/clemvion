# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 0건. 전문 확보 못 한 checker 없음(5/5 success + 인라인 전문 확보).

## 전체 위험도
**LOW** — Critical 없음. 발견된 WARNING 3건은 모두 (a) 이전 라운드에 이미 등재된 기존 항목의 재확인이거나 (b) 이번 diff 자신의 인용/주석 정확도에 관한 자기참조 drift이며, 코드 동작이나 spec 계약을 실제로 깨는 결함은 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> 해당 없음 — 이번 라운드에 새로 발생한 Critical이 없다. 다만 아래 WARNING #1(6개 spec 파일의
> `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` "코드"식 서술)은 근본 해결이 `spec/**` 쓰기이므로
> developer 권한 밖이며, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner
> 소유 오픈 항목으로 등재되어 있다(신규 인계 불요, 기존 경로 유지).

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| (없음) | — | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`를 정정된 유저 가이드(`logic.mdx`)는 "코드 아님·메시지 접두"라 하는데, 6개 spec 파일은 여전히 "코드"처럼 서술 | `codebase/frontend/src/content/docs/02-nodes/logic.mdx`·`logic.en.mdx`(이번 diff, 정정 완료) | `spec/5-system/4-execution-engine.md:332-333`, `spec/3-workflow-editor/2-edge.md:202`, `spec/3-workflow-editor/0-canvas.md:636`, `spec/4-nodes/1-logic/0-common.md:83`, `spec/4-nodes/1-logic/7-map.md:179-180`, `spec/4-nodes/1-logic/9-foreach.md:209-210` (대조 선례: `spec/4-nodes/1-logic/3-loop.md:189-191`는 이미 올바른 형태) | **신규 조치 불요** — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3473-3492`에 planner 소유 오픈 항목으로 등재됨(이전 라운드 `2026/09/13/19_23_31` cross_spec에서 최초 발견). planner 턴에서 6개 파일을 `3-loop.md` 패턴(발행 문자열 전문을 "메시지"로 인용, "코드"라 부르지 않음)으로 통일 권고. 이번 developer PR은 조치 불요 |
| 2 | rationale_continuity | "허용목록 없음"(`#1330`) 설계 원칙의 2차 번복(`GUIDE_NON_EMITTED_VOCABULARY` 신설)이 spec `## Rationale`에 착지한 적 없음 — 근거는 코드 주석+in-progress plan에만 존재 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`의 `GUIDE_NON_EMITTED_VOCABULARY` 선언부 주석 | `spec/conventions/user-guide-evidence.md`의 `## Rationale`(1차 번복 `GUIDE_EXTERNAL_VOCABULARY`도 동일하게 미착지) | `guide-identifier-existence.test.ts` 가드를 `user-guide-evidence.md §2` 표에 등재하는 트래커 항목(이미 오픈) 처리 시, "허용목록 없음 원칙의 2차례 예외와 사유"도 함께 Rationale에 backfill하도록 그 항목 설명에 명시. 이번 PR 즉시 처리 불요 |
| 3 | plan_coherence | 라운드 8이 CRITICAL을 닫으며 새로 단 트래커 줄 번호 인용이, 같은 커밋의 다른 편집(같은 트래커 파일 상단에 새 항목 삽입)으로 이미 어긋남 | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:94` (`spec-draft-nullable-notation-followups.md:3407` 인용) | 실제 위치는 `spec-draft-nullable-notation-followups.md:3494`(3407행은 무관한 다른 항목의 표제줄) | `guide-identifier-scan.ts:94`의 인용을 `:3494`로 정정(코드 파일 수정, 다음 라운드에 함께 반영 — plan §K·§H가 이미 이름 붙인 "구조를 바꿨으면 증거를 다시 만들어라" 실패 형태의 재발이므로 반복 방지 차원에서 처리 권고) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 정정 주석이 자기 라운드 번호를 틀리게 표기("라운드 9 정정"이나 실제는 라운드 8, plan 체크리스트 확인) | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:12` | "(라운드 9 정정)" → "(라운드 8 정정)" 한 단어 교체 |
| 2 | cross_spec | 같은 트래커에 인접한 별도 오픈 항목(§1.4 "앵커 없는 코드" 7종 표기 이슈)의 처분이 WARNING#1의 6파일 수정 방향과 얽혀 있음 | `plan/in-progress/spec-draft-nullable-notation-followups.md:3494-3528` | 새 조치 불요 — 트래커가 이미 "함께 볼 것"이라 명시. 참고용 기록만 |
| 3 | rationale_continuity | `collectCatalogCodes`의 "카탈로그는 요구조건이 아니라 탈출구"라는 설계가 `3-error-handling.md §1.4` 기존 note와 정합함을 확인 | `guide-identifier-scan.ts`의 `collectCatalogCodes` 주석 | 확인 완료, 조치 불요(긍정 소견) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 6개 spec 파일이 정정된 유저 가이드와 다른 "코드"식 서술 유지(기존 등재 항목, 신규 회귀 아님) |
| rationale_continuity | LOW | "허용목록 없음" 원칙 2차 번복의 근거가 spec Rationale에 미착지(근거 자체는 충실) |
| convention_compliance | NONE | 이전 라운드 WARNING(SoT 인용 범위) 실제 해소 확인. 신규는 라운드 번호 오타(INFO)뿐 |
| plan_coherence | LOW | 라운드 8 자신이 새로 단 트래커 줄 인용이 같은 커밋 편집으로 어긋남(자기참조 drift, 결정 충돌 아님) |
| naming_collision | NONE | 라운드 8 신규 식별자 2개(`SOURCE_ROOTS`·`skipBuildDirs`) 포함 누적 15개 전수 재검증, 충돌 0건 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 없음) 별도 긴급 조치 없음.
2. [WARNING #3] `guide-identifier-scan.ts:94`의 트래커 줄 번호 인용을 `:3407` → `:3494`로 정정 (다음 라운드에 코드 수정 포함).
3. [INFO #1] `guide-identifier-scan.ts:12`의 "(라운드 9 정정)" → "(라운드 8 정정)" 오타 정정.
4. [WARNING #1, planner 트랙] `spec/5-system/4-execution-engine.md` 외 5개 spec 파일의 `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` "코드"식 서술을 `3-loop.md` 패턴으로 통일 — 기존 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md:3473-3492`) 경로로 처리, 이번 PR 범위 아님.
5. [WARNING #2, planner 트랙] `user-guide-evidence.md §2` 가드 등재 시 "허용목록 없음" 원칙의 2차례 예외 이력을 Rationale에 함께 backfill.