# 신규 식별자 충돌 검토 결과

## 검토 대상

plan/in-progress/spec-update-execution-engine-pre-park-window.md

target 이 `spec/5-system/4-execution-engine.md §1.1` 에 삽입하려는 신규 blockquote:
- 섹션 헬더 레이블: **"Pre-park read-window 정규화 (intra-row inconsistency)"**
- 코드 레벨 참조 식별자: `reconcilePreParkWaitingStatus`, `isNodeWaitingForInput`
- 컨셉 레이블: `intra-row inconsistent`, `pre-park window`, `Backend read-side normalization`, `Frontend defense-in-depth`
- 파일 경로 참조: `executions.service.ts:findById`, `apply-execution-snapshot.ts:isNodeWaitingForInput`

---

## 발견사항

### [INFO] 섹션 레이블 "Pre-park read-window 정규화" — 기존 사용 없음, 신규 도입 안전

- target 신규 식별자: blockquote bold 레이블 `Pre-park read-window 정규화 (intra-row inconsistency)`
- 기존 사용처: `spec/5-system/4-execution-engine.md` 전체를 검색한 결과 이 레이블은 현재 존재하지 않음. 기존 §1.1 원자성 보장 blockquote와 별도 단락으로 추가되는 구조.
- 상세: 기존 §1.1 문서에는 "원자성 보장" 레이블 blockquote만 존재하고 "pre-park" 또는 "read-window 정규화" 개념은 전혀 언급이 없어 충돌 없음.
- 제안: 없음. 도입 안전.

### [INFO] `reconcilePreParkWaitingStatus` — 코드에 존재, spec 에 신규 등재 (충돌 없음)

- target 신규 식별자: spec 본문에 처음 등장하는 함수명 참조 `reconcilePreParkWaitingStatus`
- 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/backend/src/modules/executions/executions.service.ts` 라인 120(정의), 라인 564(호출). 코드 내 JSDoc(`line 81-113`)이 이 함수와 `isNodeWaitingForInput`의 연계를 이미 기록하고 있음.
- 상세: spec 에는 아직 등재되지 않았으므로 "spec 내 동일 명이 다른 의미로 사용 중" 인 충돌 상황이 아님. 코드 구현과 spec 기재명이 일치 — 충돌 아님, 정상 SPEC-DRIFT 반영.
- 제안: 없음.

### [INFO] `isNodeWaitingForInput` — 코드에 존재, 파일 경로 참조가 실제 경로와 다름 (경미)

- target 신규 식별자: spec 본문 참조 `apply-execution-snapshot.ts:isNodeWaitingForInput`
- 기존 사용처: 실제 파일 경로는 `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` (라인 372에 export 정의). target 이 제안한 참조 경로는 `apply-execution-snapshot.ts` 파일명만 명시했고 실제 디렉토리는 `src/lib/websocket/`이지만 target 계획안은 백엔드 대응 참조(`executions.service.ts:findById`)와 비교할 때 파일명만 기재하여 모호성 있음. 기존 backend JSDoc(`executions.service.ts:112`)도 동일 파일 파일명으로 기재하고 있어 프로젝트 내 관행과 일치함.
- 상세: 코드 식별자 자체의 의미 충돌은 없음. 다른 의미로 동일 이름이 사용된 선례 없음. 참조 모호성은 경미.
- 제안: spec 삽입 시 파일 경로를 `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts:isNodeWaitingForInput`로 완전 경로 기재하면 더 명확하나 필수 아님.

### [INFO] `NodeHandlerOutput.status='waiting_for_input'` 봉투 개념 — 기존 spec §1.3에 이미 존재

- target 신규 식별자: `NodeHandlerOutput.status='waiting_for_input'` 봉투를 `outputData.status` 로 표현
- 기존 사용처: `spec/5-system/4-execution-engine.md §1.3` "블로킹/재개 컨트랙트 (NodeHandlerOutput `status`)" 섹션이 `NodeHandlerOutput.status` 개념을 정의함. target 에서 "핸들러 봉투"라 부르는 것이 기존 §1.3 용어와 충돌 없이 일관됨. 단, target 본문이 `NodeHandlerOutput.status`와 `outputData.status`를 혼용하는 표현을 쓰는데, 실제 DB 컬럼 `NodeExecution.outputData`에 직렬화된 형태를 가리키는 것이므로 의미는 연속적.
- 상세: 충돌 없음. 기존 §1.3의 `NodeHandlerOutput.status` 개념과 target이 언급하는 `outputData.status` 봉투는 동일 개념의 런타임 표현(핸들러 반환값 → DB 직렬화)이므로 의미 연속적.
- 제안: 없음.

### [INFO] 파일 경로 — `plan/in-progress/spec-update-execution-engine-pre-park-window.md` 신규

- target 신규 식별자: 계획 파일 자체 경로
- 기존 사용처: `plan/in-progress/` 내 유사 prefix 파일 확인 결과 `spec-update-...` 형태의 draft spec update plan 은 기존에 없음. `exec-park-durable-resume.md` 등 실행 엔진 관련 plan 파일은 존재하나 이름 충돌 없음.
- 상세: 파일명·경로 충돌 없음.
- 제안: 없음.

---

## 요약

target 문서(`plan/in-progress/spec-update-execution-engine-pre-park-window.md`)가 도입하는 신규 식별자는 `reconcilePreParkWaitingStatus`, `isNodeWaitingForInput`, "Pre-park read-window 정규화" 레이블, `intra-row inconsistency` 개념이며, 이들은 모두 기존 spec 또는 다른 plan 파일에서 동일 이름으로 다른 의미로 사용된 사례가 없다. 코드 레벨 함수명(`reconcilePreParkWaitingStatus`, `isNodeWaitingForInput`)은 실제 codebase 구현과 정확히 일치한다. 기존 §1.3 `NodeHandlerOutput.status` 개념과도 의미상 충돌 없이 연속적이다. 경미한 INFO 항목으로 `isNodeWaitingForInput` 파일 경로 참조의 완전 경로 명시 여부가 있으나 충돌이 아닌 명확성 보완 제안 수준이다.

## 위험도

NONE
