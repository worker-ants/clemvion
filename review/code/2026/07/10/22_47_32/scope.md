# 코드 리뷰 — 변경 범위(Scope) — getStatus() 2단계 컬럼 projection

- diff base: `origin/main`
- worktree: `optimize-getstatus-projection-78853c`
- 대상 커밋: `0e80bd4a1` (구현) + `629f628e6` (plan TEST WORKFLOW 기록)

## 발견사항

없음 (Critical/Warning 없음). 변경 범위가 지시된 작업과 정확히 일치한다.

### [INFO] JSDoc/인라인 주석 밀도가 높지만 기존 파일 컨벤션과 합치 — 범위 이탈 아님
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:238-240`(JSDoc 3줄 추가), `:245-250`, `:277-280`(1단계/2단계 인라인 comment 블록)
- 상세: `getStatus()` 의 기존 JSDoc·인라인 주석 자체가 이미 spec 절 번호(§5.3/§R17)를 인용하며 설계 근거를 상세히 서술하는 파일 고유 스타일이다(예: 기존 226-236행 "보안 제약"/"conversationThread" 단락). 신규 추가된 3개 comment 블록은 새로 도입된 "2단계 조회"라는 동작 변화를 그 스타일과 동일한 밀도로 설명한다 — 순수 신규 텍스트 추가일 뿐 기존 주석의 표현을 바꾸거나 무관한 곳을 손댄 흔적은 없음(diff 상 `-` 라인은 오직 코드 이동/치환 3곳뿐, 주석 텍스트 삭제·재작성 없음).
- 판단: 과도하지 않음. "필요한 최소"보다는 다소 풍부하지만, 결정 근거(TOCTOU 무해성, race graceful 처리, 병렬화 이유)를 명시해 후속 유지보수자의 재조사 비용을 줄이는 목적이 뚜렷하고 파일 기존 관례와 일치한다.

### [INFO] `outputData` 를 base(1단계) projection 에 남긴 것 — 범위 내 의도된 설계
- 위치: `interaction.service.ts:245-260` (BASE_COLUMNS), plan `eia-getstatus-column-projection.md:34-36` "결정 메모"
- 상세: 사용자 지시는 "conversation_thread 만 조건부 재조회"이고 `outputData` 는 대상이 아니었다. 구현은 `outputData` 를 1단계에 유지했는데, plan 문서에 명시적 근거가 기록돼 있다 — completed/failed 상태에서 `result`/`error` 조립에 항상 필요해 2단계로 미루면 왕복만 늘고 절감이 없고, 절감 대상(상한 ~2MB)은 `conversation_thread` 하나로 좁힌다는 결정. 미완이 아니라 의도된 스코프 확정이며 consistency-check(`SUMMARY.md` 항목1)도 이 7개 필드 커버리지를 line 단위로 확인했다.
- 판단: 범위 이탈 아님 — 사용자가 던진 문제("conversation_thread 조건부 fetch")의 근본 원인(2MB jsonb)에 정확히 대응하는 최소 개입.

### [INFO] `getStatus()` 외 메서드는 손대지 않음 — 확인됨
- 위치: `interaction.service.ts` 전체 diff — hunk 2개, 모두 `getStatus()` 본문 내부(L235-305 범위)로 국한. `refreshToken`(L207 근방, 기존에 이미 `select:['id','status']` 적용)·`interact`·`loadAndAssertAlive` 등 동일 파일 내 다른 메서드는 diff 에 전혀 등장하지 않음.
- 판단: "같은 파일 내 다른 3개 호출부는 이미 얇게 조회 중"이라는 plan 배경 서술과 부합 — `getStatus()` 만의 갭을 좁히는 국소 변경.

### [INFO] `interaction.service.spec.ts` 테스트 추가는 파일 끝에 순수 append — 기존 테스트 미변경
- 위치: `interaction.service.spec.ts:741` 이후 (`describe('InteractionService.getStatus — 컬럼 projection (2단계 조회)')` 블록)
- 상세: diff 전체가 `+` 만으로 구성(기존 `describe`/`it` 블록에 대한 수정·삭제 없음). 신규 5개 `it` 이 모두 `getStatus()` 의 projection/2단계/마스킹/updatedAt fallback 검증에 국한.
- 판단: 범위 내.

### [INFO] `spec-sync-external-interaction-api-gaps.md` line-range 정정 — 본 PR 포함이 정당
- 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:17`
- 상세: 1줄 diff. 기존 "완료/정합 확인" 항목이 `getStatus()` 로직 위치를 `interaction.service.ts:247-296` 으로 인용했는데, 본 변경으로 코드 블록이 재배치되며 실제 위치가 `:276-351` 로 이동했다. consistency-check 가 W3 로 이 stale 화를 사전 지적했고(`SUMMARY.md` §W3, plan §impl-prep Warning W3), 결정 번복이 아니라 순수 인용 좌표 갱신임을 명시. 이 정정을 누락하면 본 PR 이 만든 stale 참조가 그대로 남는다 — 포함하지 않는 것이 오히려 범위 위반(작업이 유발한 부작용 방치)에 해당.
- 판단: 정당한 동반 수정.

### [INFO] plan/consistency 산출물 — 워크플로 의무 이행 증거, 범위 내
- 위치: `plan/in-progress/eia-getstatus-column-projection.md`(신규), `review/consistency/2026/07/10/22_25_21/**`(신규 5파일)
- 상세: `developer` SKILL 이 요구하는 `impl-prep` 단계 consistency-check 산출물과 작업 추적 plan 문서. CLAUDE.md 저장 위치 규약(`plan/in-progress/*`, `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)과 일치.
- 판단: 범위 내 — 코드 변경이 아닌 프로세스 산출물이며 지시된 작업의 필수 절차.

## 사용자 요청 항목 5 확인 — e2e 상태전이 영향 검증 이행 여부

이행됨. `plan/in-progress/eia-getstatus-column-projection.md` 체크리스트 항목 8(커밋 `629f628e6`)에 다음이 기록:
> `lint PASS(54s) / unit PASS(75s) / build PASS(140s) / e2e PASS(170s, 43 suite · 249 test, 0 fail). execution-park-resume.e2e-spec.ts · external-interaction.e2e-spec.ts 둘 다 PASS 확인 (상태전이 회귀 없음).`

사용자가 명시적으로 지목한 `execution-park-resume` e2e 를 포함해 전체 e2e suite 통과가 plan 문서에 근거(소요 시간·suite/test 카운트)와 함께 기록됐다. 다만 이 기록은 plan 체크박스 텍스트로만 존재하고 별도 로그 파일이 첨부되지는 않았다(레포 관례상 plan 체크박스 = 실제 상태로 취급되는 방식과 일치, CLAUDE.md 메모리 `feedback_plan_checkbox_actual_state` 참고) — 이는 감점 요소가 아니라 이 프로젝트의 표준 기록 방식이다.

## 변경 파일 전수 대조 (9개, `git diff origin/main...HEAD --name-only`)

| 파일 | 지시 범위 해당 여부 |
| --- | --- |
| `codebase/backend/.../interaction.service.ts` | O — `getStatus()` 만 |
| `codebase/backend/.../interaction.service.spec.ts` | O — 신규 append |
| `plan/in-progress/eia-getstatus-column-projection.md` | O — 신규 plan |
| `plan/in-progress/spec-sync-external-interaction-api-gaps.md` | O — 1줄 인용 정정 |
| `review/consistency/2026/07/10/22_25_21/SUMMARY.md` | O — impl-prep 산출물 |
| `review/consistency/2026/07/10/22_25_21/convention_compliance.md` | O |
| `review/consistency/2026/07/10/22_25_21/cross_spec.md` | O |
| `review/consistency/2026/07/10/22_25_21/naming_collision.md` | O |
| `review/consistency/2026/07/10/22_25_21/plan_coherence.md` | O |

파일 목록 외 추가 변경 없음(컨트롤러·엔티티·DTO·타 모듈 등 무변경 확인, grep/diff --stat 로 교차검증).

## 요약

지시된 작업 범위(`getStatus()` 의 2단계 컬럼 projection 전환)와 실제 diff 가 정확히 일치한다. 구현은 `getStatus()` 메서드 본문에만 국한되고 동일 파일의 다른 메서드는 손대지 않았으며, 테스트 변경은 기존 테스트를 건드리지 않는 순수 append 다. `outputData` 를 1단계에 남긴 결정은 plan 문서에 근거(왕복 절감 0, 절감 대상은 conversation_thread 로 한정)가 명시된 의도된 스코프 확정이지 미완이 아니다. `spec-sync-external-interaction-api-gaps.md` 의 line-range 정정은 본 변경이 직접 유발한 stale 화를 바로잡는 것으로, 오히려 포함하지 않으면 부작용 방치가 된다. plan·consistency 산출물은 코드가 아닌 프로젝트 표준 워크플로 산출물이다. 사용자가 명시 요청한 "execution-park-resume 등 상태전이 e2e 영향 없음" 확인도 plan 체크리스트에 결과(43 suite/249 test PASS, 대상 e2e 2건 명시)로 기록돼 이행이 확인된다. 포맷팅 노이즈, 무관 임포트/설정 변경, over-engineering 소지는 발견되지 않았다.

## 위험도

NONE
