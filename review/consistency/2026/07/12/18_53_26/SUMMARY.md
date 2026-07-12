# Consistency Check 통합 보고서

**BLOCK: NO** — 확인 가능한 4개 checker 중 Critical 발견 없음. 단, `plan_coherence` 결과는 디스크 누락으로 미확인(아래 데이터 갭 참고)

## 전체 위험도
**LOW** — WARNING 1건(HTTP 상태 표기 불일치)과 INFO 6건. 단 `plan_coherence` checker 결과가 disk-write gap 으로 소실되어 5개 관점 중 4개만 반영된 부분 결과.

## 데이터 갭 (반드시 확인)

`plan_coherence` 는 매니페스트상 `status=success` 로 보고됐으나, 세션 디렉터리 실측 결과(`ls`) 해당 `plan_coherence.md` 파일이 **디스크에 존재하지 않는다**(`_prompts/plan_coherence.md` 프롬프트만 존재, 산출물 없음). 이는 알려진 "Workflow disk-write 갭" 패턴 — sub-agent 의 Write 가 성공 보고와 달리 실제로는 반영되지 않은 경우다. `journal.jsonl` 등 복구 가능한 부가 기록도 세션 디렉터리·worktree 어디에도 없어, 본 요약 에이전트 레벨에서는 내용을 재구성할 수 없다. **plan_coherence 관점(plan 정합성: 이 spec 변경이 관련 `plan/in-progress/*.md` 항목과 맞물리는지)은 이번 통합 보고서에 반영되지 못했다.**

> main 판정(2026-07-12): 이 변경은 `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 를 직접 이행하며, 선행 sibling plan `manual-trigger-default-param.md` 는 이미 `plan/complete/` 로 이동 완료. 상충하는 in-progress plan 없음 → plan 정합성 관점에서도 실질 BLOCK 사유 없음으로 판정.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 (4개 확인된 checker 전원 Critical 미검출) | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 | 처리 |
|---|---------|------|-------------|-----------|------|------|
| 1 | convention_compliance | HTTP 상태 표기 `` `BadRequest` ``(공백 없음)가 규약 `` `Bad Request` ``(공백 포함)와 불일치, 같은 표 안에서도 3개 행 표기 제각각 | §6 "실행 시점 어댑터별 누락" 표 (Manual/Webhook/Manual re-run 행) | `spec/5-system/2-api-convention.md §6` 등 | 3개 행 전부 `` `400 Bad Request` code `<CODE>` `` 포맷으로 통일 | ✅ 반영 (3개 행 `Bad Request` 통일) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 | 처리 |
|---|---------|------|------|------|------|
| 1 | cross_spec | `0-common.md` §1 공통 계약 표가 신규 "저장 시점 구조 게이트" 미반영 (완전성 갭) | target §6 ↔ `0-common.md` §1 | 공통 계약 표에 1줄 추가 | 범위 밖 — 별도 트래킹 |
| 2 | cross_spec | `0-canvas.md` §8 저장 API 실패 모드 미문서화 | target Rationale ↔ `0-canvas.md` §8 | 1줄 추가 | 범위 밖 — 별도 트래킹 |
| 3 | cross_spec | `1-data-model.md` §2.6 Node.type 목록에 `manual_trigger` 행 부재 (기존 갭) | `1-data-model.md` §2.6 | 별도 spec 정리 | 범위 밖 — 기존 갭 |
| 4 | rationale_continuity | `skipLegacyDataGates` 비대칭 근거의 역방향 상호참조 부재 | target `## Rationale` ↔ `execution-context.md` §1 | 상호 링크 추가 | ✅ 반영 (Rationale 에 상호링크 추가) |
| 5 | convention_compliance | `meta.source` 인용 부제 "실행 컨텍스트" 표기 (target 미편집 부분) | target §4 point 6 ↔ `node-output.md` Principle 2 | 부제 정정 | 범위 밖 — 이번 편집 대상 아님 |
| 6 | convention_compliance | `node-output.md` Principle 2 표에 Trigger 행 부재 (상위 규약 문서 갭) | `node-output.md` Principle 2 | Trigger 행 추가 | 범위 밖 — 상위 규약 문서 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 저장 시점 게이트 신설이 동반 수정 4개 spec·에러 봉투·기존 `skipLegacyDataGates` 선례와 정확히 정렬. INFO 3건만 비차단 |
| rationale_continuity | NONE | 신설 Rationale 은 선행 WARNING 이행 결과. 과거 기각 대안 재도입 없음. `variables.__*` L0 게이트와 동형 패턴 확장 |
| convention_compliance | LOW | 5필드 invariant·에러 코드 명명·봉투 대부분 준수. WARNING 1건(표기 불일치, 반영), INFO 2건 |
| plan_coherence | 미확인 (disk-write gap) | status=success 보고와 달리 산출물 부재. main 판정으로 plan 정합성 실질 문제 없음 확인(위 데이터 갭 절) |
| naming_collision | NONE | 순수 문서 갱신, 모든 식별자가 기존 코드·spec 재사용. 신규 식별자 없음 |

## 권장 조치사항
1. WARNING 해소 ✅ — §6 표 `BadRequest` 3개 행 `Bad Request` 통일 (반영됨).
2. INFO #4 ✅ — target Rationale 에 `execution-context.md §1` 상호 링크 추가 (반영됨).
3. INFO #1/#2/#3/#5/#6 — target 범위 밖 상위 문서(`0-common.md`/`0-canvas.md`/`data-model.md`/`node-output.md`) 갱신 건으로 별도 트래킹.
