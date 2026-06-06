# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/5-system/4-execution-engine.md` (구현 완료 후 검토, diff-base=origin/main)
**검토 범위**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`,
`execution-engine.service.spec.ts`, `resume-turn-dispatch.ts` (신규),
`shared/execution-resume/process-turn-result.ts` (신규)

---

## 발견사항

### 발견사항 1

- **[INFO]** spec §7.5 rehydration 절차 기술이 `dispatchResumeTurn` 레이어를 명시하지 않음
  - target 위치: `resume-turn-dispatch.ts` 인터페이스 + `execution-engine.service.ts` `resumeTurnRegistry` / `dispatchResumeTurn` / `handleAiResumeTurn`
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §7.5 rehydration 절차 다이어그램 (line 903~906)
  - 상세: spec §7.5 는 재개 핸들러 선택을 `"form → processFormResumeTurn, button → processButtonResumeTurn, AI → processAiResumeTurn"` 로 직접 나열한다. 구현은 이 분기를 `resumeTurnRegistry`(ordered first-match-wins) + `dispatchResumeTurn` 단일 진입점으로 추상화했고, AI 재개는 `handleAiResumeTurn` 중간 레이어를 경유한다. 의미는 동일하지만 spec 의 기술과 구현의 계층 구조가 다르다. 기능상 모순은 없다.
  - 제안: spec §7.5 다이어그램 주석에 `dispatchResumeTurn`(registry 기반 라우팅) 언급을 추가 동기화 권장. AI 경로는 `handleAiResumeTurn` 경유를 명시하면 좋음. plan-planner 위임 수준의 선택 사항.

### 발견사항 2

- **[INFO]** `PARK_RELEASED` / `ProcessTurnResult` 타입 이관 — spec 참조 경로 미반영
  - target 위치: `codebase/backend/src/shared/execution-resume/process-turn-result.ts` (신규 파일)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §4.x "park = 세그먼트 종료" 메모 (line 416)
  - 상세: spec §4.x 메모는 `PARK_RELEASED` sentinel 의 설명을 `execution-engine.service.ts` 내부 상수로 암묵적으로 기술한다. 구현은 이를 `shared/execution-resume/process-turn-result.ts` 로 분리·공유화했다. spec 에는 모듈 경로를 언급하지 않으므로 직접 모순은 없으나, `spec/5-system/4-execution-engine.md` 의 `code:` frontmatter 에 이미 `codebase/backend/src/shared/execution-resume/**` 가 등록돼 있어 범위 내 변경이다. 별도 spec 갱신은 불필요.
  - 제안: 이미 frontmatter `code:` 범위에 포함. 추가 조치 없음.

### 발견사항 3

- **[INFO]** `resume-turn-dispatch.ts` spec 참조가 §6.2 를 가리키나 spec 에는 §6.2 레이블이 중첩 재개 절에 해당
  - target 위치: `resume-turn-dispatch.ts` JSDoc `"spec: 5-system/4-execution-engine.md §7.5(rehydration) · §6.2(중첩 재개)"`
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §6.2 (park 시 영속 항목 표)
  - 상세: JSDoc 의 `§6.2(중첩 재개)` 참조는 spec 의 §6.2 (park 시 영속 commit 표 — "중첩 재개" 가 아니라 "영속화 정책") 를 가리킨다. 중첩 재개 절차는 §7.5 의 `driveCallStackResume` 부분이다. 레이블이 약간 부정확하나 파일 내 탐색에는 문제 없음.
  - 제안: 해당 JSDoc 을 `§7.5(rehydration) · §7.5 중첩 sub-workflow 재개` 로 교정 권장 (낮은 우선순위).

---

## 요약

이번 변경(exec-park B-1)은 `driveResumeAwaited`/`driveResumeFrame` 양쪽에 하드코딩돼 있던 form/buttons/AI 분기를 `resumeTurnRegistry` + `dispatchResumeTurn` 단일 진입점으로 추출하고, AI 재개 로직을 `handleAiResumeTurn` 으로 캡슐화하며, `PARK_RELEASED`/`ProcessTurnResult` 를 공유 모듈(`process-turn-result.ts`)로 이관한 리팩터링이다. 동작 보존(선택 우선순위·에러 코드·sentinel 의미)이 명시적으로 유지됐으며, spec §7.5 가 기술하는 재개 의미론·상태 전이·에러 분류(`RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE`)와 충돌하는 부분이 없다. 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC 관점에서도 다른 spec 영역과의 직접 충돌은 발견되지 않았다. 발견된 세 항목은 모두 spec 문서 기술과 구현 계층 명명의 동기화 권장 수준(INFO)이며, 그대로 채택해도 운영 불가 또는 잠재 충돌이 발생하지 않는다.

## 위험도

NONE

STATUS: OK
