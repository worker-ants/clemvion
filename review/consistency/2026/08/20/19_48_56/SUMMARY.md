# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 성공, CRITICAL 0건 · WARNING 4건(중복 제거 후) · INFO 6건)

## 전체 위험도
**MEDIUM** — 차단 사유는 없으나, 두 checker(cross_spec·rationale_continuity)가 독립적으로 동일한 실제 갭(`spec/4-nodes/7-trigger/1-manual-trigger.md §6` 이 `spec_impact` 및 "spec 변경 목록"에서 누락)을 지적해 spec 확정 전 반영이 필요하다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | `spec_impact`/"spec 변경 4곳" 목록에 `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 이 빠져 있다. 이 절의 (a) reason-코드 표(162~182행, `invalid_schema`/`missing_required`/`coerce_failed`만 등재 — 신규 `masked_marker` 미반영)와 (b) "응답 봉투" 문장(184행, "Manual·Webhook 경로"만 명시 — re-run 을 `details[]` 대상에 포함시키는 이번 변경으로 사실과 어긋나는 stale 열거가 됨) 두 곳 모두 target 의 다른 두 갱신(`3-error-handling.md §1.7`, `13-replay-rerun.md §8.1`)과 같은 성격인데 누락됨 | `front-matter spec_impact:` / `## 에러 계약` · `## spec 변경 4곳` 절 | `spec/4-nodes/7-trigger/1-manual-trigger.md §6` (162~184행) | `spec_impact` 에 해당 파일 추가. §6 reason 표에 `masked_marker` 행(Manual 실행경로·Manual re-run 두 어댑터 한정) 추가. 184행 "응답 봉투" 문장을 "Manual·Webhook·Manual re-run 경로" 로 갱신 |
| 2 | cross_spec | "닫는 조건"(마커 재입력 강제)의 방어 근거를 프런트 가드만으로 서술하는 문서 2곳이 갱신 대상 밖 — target 이 §R17 표에 서버측 400 거부(2차 방어층)를 추가해도 이 두 문서는 여전히 1층(프런트)만 언급하게 되어 R17 과 서술이 어긋남 | "spec 변경 4곳" 절 (④는 `13-replay-rerun.md §10.2` 만 다룸) | `spec/1-data-model.md §2.13`(471행, Execution `input_data` 행) · `spec/3-workflow-editor/3-execution.md §2.2`(91행, "히스토리 로드") | 두 문서에 "서버가 2차로도 거부한다" 한 줄 추가하거나 최소 §R17 로의 cross-ref 갱신. `spec_impact` 에 두 파일 추가 또는 draft "구현 스코프" 절에 문서 동기화 필요 명시 |
| 3 | plan_coherence | target 이 트래커 W5("`Execution.inputData` 응답 의미 반전의 외부 소비자 확인")를 "이 답변으로 닫는다"고 자기 서술하지만, 정작 W5 가 등재된 plan 체크박스는 여전히 미체크(`[ ]`) 상태로 남아 있어 서술과 트래커가 어긋남 | "왜 지금인가" 절 (W5 를 이 답변으로 닫는다는 문장) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:348` (W5, 현재 `[ ]`) | 같은 턴에 W5 체크박스를 `[x]` 로 갱신 + "2026-08-20, 사용자 직접 확인(저장소 밖 소비자 없음) — 근거는 `spec-draft-inputoverride-marker-reject.md` 참조" 한 줄 추가. (W6 은 서버측 구현 전이므로 미체크 유지가 맞음) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec, convention_compliance | 신규 `reason: 'masked_marker'` 의 명명축이 형제 세 항목(`missing_required`/`coerce_failed`/`invalid_schema`, 모두 "무엇이 실패했나" 서술형)과 달리 "값의 정체"를 서술하는 명사구라 형태가 다르다. 기능 문제는 없음(내부 전용 키) | `## 에러 계약` 표 (`masked_marker` → `MASKED_VALUE_RESUBMITTED`) | 대칭성을 원하면 `masked_value_resubmitted` 로 맞추는 안도 있음. 구현 단계 재량으로 남겨도 무방 |
| 2 | convention_compliance | re-run `INVALID_INPUT` 코드가 `13-replay-rerun.md §8.1` 표의 형제 코드들(`RERUN_*` prefix)과 달리 도메인 prefix 가 없음 — 이 draft 가 만든 문제가 아니라 기존 코드(pre-existing)이며, §2 rename-stability 상 이 draft 가 손댈 이유도 없음 | "spec 변경 4곳" 항목 4(선택 5), `§1.3` 등재 제안 | §1.3 등재 시 "`RERUN_` 미부여는 §2 rename-stability 상 유지" 각주 한 줄 추가해 반복 지적 예방 |
| 3 | convention_compliance | `details[].code` 카탈로그 확장 시 Swagger `ErrorResponseDto` 열거형/예시 갱신 여부가 draft 범위에 명시돼 있지 않음 | "구현 스코프에 포함" 문단 | "Swagger DTO 예시/enum 갱신 필요 시 함께" 한 줄 추가 권장 |
| 4 | plan_coherence | 트래커 W6 항목에 이 draft 로의 역참조가 없어, draft 착지 후에도 트래커만 봐서는 "서버측 구현 미완료 vs spec 명문화 완료"를 구분할 수 없음 | 문서 전체 (스코프 정합 자체는 문제 없음) | `spec-sync-external-interaction-api-gaps.md` W6 에 한 줄 역참조 추가 권장. 차단 사유 아님 |
| 5 | rationale_continuity | 병렬 워크트리(`eia-inputdata-marker-guard`)가 동일 트래커 항목을 갖고 있음(이미 이전 라운드에서 관측·diff 없음 확인됨). Rationale 축이 아니라 병렬 세션 머지 확인 절차 | frontmatter `worktree: eia-inputoverride-reject-a3f1c9` | push 직전 병렬 워크트리와의 diff 재확인(이미 트래킹된 절차 — 새 조치 아님) |
| 6 | naming_collision | 신규 공개 코드 `MASKED_VALUE_RESUBMITTED` 와 기존 내부 상수 `VALUE_MASK_MARKER`(`sanitize-error-message.ts:115`)가 어근("masked"/"mask")을 공유 — 계층이 달라(전자는 wire 에러 코드, 후자는 마스킹 리터럴 상수) 실제 충돌 아님 | `## 에러 계약` 표 | 조치 불요. spec 본문에 나란히 언급 시 한 줄 구분 문구 정도면 충분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `1-manual-trigger.md §6`(reason 표) 및 `1-data-model.md §2.13`/`3-execution.md §2.2`(프런트-only 서술)가 spec_impact/갱신 목록에서 누락 |
| rationale_continuity | LOW | 이전 라운드(`19_34_37`) CRITICAL 1건·WARNING 2건은 실제로 교정 확인됨(지어낸 이력 아님). 신규로 `1-manual-trigger.md:184` "응답 봉투" 문장 누락 발견 |
| convention_compliance | LOW | CRITICAL/WARNING 없음. 신규 에러 코드 명명·rename-안정성·`details[]` 출력 계약 모두 준수 확인. INFO 3건은 스타일/완결성 제안 |
| plan_coherence | LOW | 미해결 결정 우회·선행조건 누락 없음. 트래커 W5 체크박스가 target 의 "닫는다" 서술과 어긋난 채 미갱신 |
| naming_collision | NONE | 신규 식별자(`masked_marker`/`MASKED_VALUE_RESUBMITTED`) 코드베이스·spec 전역 충돌 없음. 나머지는 기존 식별자의 의도된 재사용 |

## 권장 조치사항
1. `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 을 `spec_impact`/"spec 변경" 목록에 추가하고 (a) reason 표에 `masked_marker` 행, (b) 184행 "응답 봉투" 문장을 "Manual·Webhook·Manual re-run 경로" 로 갱신 (WARNING #1, 최우선 — 구현 즉시 stale 문구가 되는 항목)
2. `plan/in-progress/spec-sync-external-interaction-api-gaps.md:348` W5 체크박스를 `[x]` 로 갱신 + 근거 한 줄 추가 (WARNING #3)
3. `spec/1-data-model.md §2.13`·`spec/3-workflow-editor/3-execution.md §2.2` 에 서버측 2차 방어 언급 또는 §R17 cross-ref 추가 (WARNING #2)
4. (선택) INFO 6건 중 필요한 것만 반영 — 특히 Swagger DTO 갱신 언급(INFO #3)과 masked_marker 명명 통일(INFO #1) 검토 권장
