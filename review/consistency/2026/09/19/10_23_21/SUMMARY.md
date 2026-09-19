# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(재시도 필요 없음), CRITICAL 발견 없음.

## 전체 위험도
**LOW** — CRITICAL 없음. rationale_continuity 가 MEDIUM 을 매겼으나 근거는 두 건의 WARNING(원칙과의 거리감·Rationale 미기재)이며 사실관계 오류나 충돌은 아니다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | §8.1 정정문("에디터의 수동 저장·실행 직전 저장은 changeSummary 를 보내지 않아 비어 있다")이 겨냥하는 사실을, 사용자 가이드 mdx 가 정면으로 반박 — "저장 요청에 changeSummary 메모를 넣으면"·"의미 있는 changeSummary 를 남겨요" 라며 존재하지 않는 UI 입력 기능을 계속 약속 | plan §2 (`spec/3-workflow-editor/0-canvas.md` §8.1) | `codebase/frontend/src/content/docs/05-run-and-debug/version-history.mdx`(18·72행)·`.en.mdx`(9·72행), frontmatter `spec: ["spec/3-workflow-editor/5-version-history.md"]` | 이 draft 스코프는 유지하되, `plan/in-progress/spec-draft-nullable-notation-followups.md` 또는 신규 항목으로 "가이드 mdx changeSummary 입력 서술 정정" 을 후속 등재 |
| 2 | rationale_continuity | `spec/1-data-model.md` frontmatter `code:` 에 카탈로그-대조 e2e 3개를 **명시 나열**로 추가 — `spec/5-system/15-chat-channel.md` R-CC-22("증가가 예정된 집합은 열거가 아니라 술어로 잡는다")가 정립한 원칙과 거리가 있고, target 자신이 grep 으로 찾은 미등재 4개(`background-monitoring`·`notifications-dismiss`·`terminal-duration-sql`·`webhook-trigger`)가 바로 그 원칙이 경계하는 산발적 누락의 증거 | plan `## 1. spec/1-data-model.md frontmatter code:` (41~72행) | `spec/5-system/15-chat-channel.md` `## Rationale` R-CC-22 | (a) 이번 집합이 R-CC-22 의 "증가 예정" 조건에 해당하지 않는다는 판단을 target `## Rationale` 에 한 문장 추가, 또는 (b) 접두 패턴 기반 좁은 glob 채택 검토. 최소한 `/spec-coverage` 로 향후 누락 backstop 언급 권장 |
| 3 | rationale_continuity | §8.1 정정("버전에는 자동 생성된 change_summary 포함" → 실제엔 없음)이 `0-canvas.md` §8 영역에서 이미 같은 클래스 드리프트를 정리한 R-3("타이머 자동 저장·즉시 반영 미제공")의 연장인데, 본문 문장 교체만 있고 spec 자체의 `## Rationale` 에 R-3 참조 후속 항목을 남길지 draft 에 명시 안 됨 | plan `## 2. spec/3-workflow-editor/0-canvas.md §8.1` (74~90행) | `spec/3-workflow-editor/0-canvas.md` `## Rationale` R-3 | spec 반영 시 §8.1 본문 교체와 함께 `0-canvas.md` `## Rationale` 에 R-3 참조 후속 항목(또는 R-3 본문에 정정 추기)을 넣도록 plan 체크리스트에 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | frontmatter `code:` 신규 3개에서 선정 근거 주석 생략 — `2-trigger-list.md` 선례·`spec-impl-evidence.md §2.1`(2026-09-06 이후 인라인 주석 안전) 과 다름 | plan §1 | 최소 `entity-schema-declarations.e2e-spec.ts` 옆에 한 줄 주석 권장(강제 아님) |
| 2 | rationale_continuity | 위와 동일 사안(주석 생략)을 R-CC-22·`3-schedule.md`·`2-trigger-list.md` 관례와 대조 | plan 59행 | `trigger-endpoint-path-dedupe.e2e-spec.ts` 에 Rationale 참조 주석 권장 |
| 3 | convention_compliance | `1-data-model.md` 는 frontmatter-evidence build gate 의 inclusive list 밖 — 실제 작동 메커니즘은 `review_guard._spec_linked_changes` 전수 스캔(의도와 부합, 문서에 미명시) | plan §1 "효과" 문단 | "효과" 문장에 `review_guard._spec_linked_changes` 기준임을 한 구절 추가(선택) |
| 4 | convention_compliance | draft 코드블록 인라인 YAML 주석을 "draft 설명용" 으로 명시 분리 — 실제 frontmatter 에는 없어 규약 사고 예방 | plan §1 주석 | 조치 불요, spec 반영 시 주석 미복사만 확인 |
| 5 | naming_collision | 신규 `code:` 경로 3개는 이미 존재하는 파일이며 자기 docstring 이 이미 이 spec 을 SoT 로 선언 — 충돌 없음 | `spec/1-data-model.md` code: | 없음 |
| 6 | naming_collision | 이 결정은 `plan/complete/spec-draft-data-model-fk-actions.md` 가 명시적으로 미뤄둔 "게이트 범위 결정" 의 예정된 후속 조치 | target 문서 전체 | 선행 PR 번호/경로 교차 인용 권장(선택) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §8.1 정정과 사용자 가이드 mdx(changeSummary 입력 서술) 간 모순 미포착 — 후속 등재 권고 |
| rationale_continuity | MEDIUM | code: 명시 나열이 R-CC-22 원칙과 거리, §8.1 정정의 R-3 연장 여부 미기재 |
| convention_compliance | NONE | 전 규약 준수 확인, gate 메커니즘 설명 보강만 INFO |
| plan_coherence | NONE | 트래커 두 미결 항목(4673·4698행)을 정확히 겨냥해 정합적으로 종결 |
| naming_collision | NONE | 신규 식별자(`code:` 경로 3개) 전수 대조 충돌 없음 |

## 권장 조치사항
1. (선택, BLOCK 무관) `0-canvas.md` `## Rationale` 에 R-3 참조 후속 항목 추가해 §8.1 정정이 R-3 연장임을 기록.
2. (선택) `1-data-model.md` code: 3건 등재의 R-CC-22 대비 판단 근거를 target `## Rationale` 에 한 문장 추가, 또는 좁은 glob 검토.
3. (후속 트래커) `version-history.mdx`/`.en.mdx` 의 changeSummary 입력 서술을 실제(입력 UI 없음)에 맞게 정정하는 항목을 `plan/in-progress/spec-draft-nullable-notation-followups.md` 또는 신규 문서에 등재.
4. (선택) 신규 `code:` 3개 항목에 Rationale 참조 인라인 주석 추가로 인접 spec 관례와 정렬.
5. target 머지 시 `spec-draft-nullable-notation-followups.md` 4673행·4698행 체크박스 갱신(계획대로).
