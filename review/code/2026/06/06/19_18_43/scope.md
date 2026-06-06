# 변경 범위(Scope) 리뷰

## 변경 의도 파악

본 변경은 exec-park-polish 작업(plan/complete/exec-park-polish.md C1) 및 ai-review exec-park B-1 권고에 따라 다음 두 가지를 수행한다:
1. `PARK_RELEASED` / `ParkSignal` / `ProcessTurnResult` 타입을 `shared/execution-resume/process-turn-result.ts` 로 이관 (기존 `execution-engine.service.ts` 인라인 선언 → 공유 모듈)
2. `driveResumeAwaited`(top-level)·`driveResumeFrame`(중첩) 양쪽에 중복 하드코딩돼 있던 form/buttons/ai 분기를 `dispatchResumeTurn` + `resumeTurnRegistry` 패턴으로 추출 + 타입 계약 파일 `resume-turn-dispatch.ts` 신설

---

## 발견사항

### 파일 1: execution-engine.service.spec.ts

- **[INFO]** `PARK_RELEASED` import 1줄 추가 (line 35)
  - 위치: diff line +35
  - 상세: `process-turn-result` 에서 `PARK_RELEASED` 를 import — 신설된 공유 모듈 의존성. 변경 의도(타입 이관 + 레지스트리 테스트)와 직접 연관. 범위 이탈 없음.

- **[INFO]** 신규 테스트 suite `dispatchResumeTurn — resume dispatch registry (exec-park B-1)` 추가 (8개 케이스)
  - 위치: diff line +43 ~ +221
  - 상세: ai-review B-1 권고로 요구된 테스트. form 라우팅·buttons 라우팅·ai 라우팅·PARK_RELEASED 전파·우선순위(form > buttons)·RESUME_CHECKPOINT_MISSING throw·checkpoint 부재 throw 를 커버. 모두 `dispatchResumeTurn` 의 직접 동작 검증으로 변경 의도 범위 내. 기존 테스트 수정 없음 — 순수 추가.

- **[INFO]** `DispatchSubject` 로컬 타입 + `makeCtx` 헬퍼 정의
  - 위치: diff line +50 ~ +73
  - 상세: 신규 suite 전용 타입/헬퍼로, describe 블록 안에 스코프가 한정돼 외부 테스트에 영향 없음. 범위 적합.

### 파일 2: execution-engine.service.ts

- **[INFO]** import 2건 추가: `PARK_RELEASED` / `ProcessTurnResult` / `ResumeTurnContext` / `ResumeTurnDispatch` / `ResumeTurnSelector`
  - 위치: diff line +955~+963
  - 상세: 신설 공유 모듈(`process-turn-result`, `resume-turn-dispatch`) 의 타입·값 import. 모두 변경 의도 내 사용. 범위 적합.

- **[INFO]** 인라인 선언 3개 제거: `PARK_RELEASED` const · `ParkSignal` type · `ProcessTurnResult` type (총 22줄)
  - 위치: diff line -971~-992
  - 상세: 공유 모듈 이관에 따른 정리. 대체 주석 3줄 남김. 의미 변경 없이 1:1 이관. 범위 적합.

- **[INFO]** `_resumeTurnRegistry` 프라이빗 필드 + `resumeTurnRegistry` lazy getter 신설 (39줄)
  - 위치: diff line +1011~+1050
  - 상세: form/buttons/ai 3개 dispatch 항목을 배열 레지스트리로 등록. 기존 `driveResumeAwaited` / `driveResumeFrame` 의 if/else 분기를 추출한 것이므로 동작 보존. 범위 적합.

- **[INFO]** `dispatchResumeTurn` private 메서드 신설 (23줄)
  - 위치: diff line +1061~+1083
  - 상세: 레지스트리 first-match 조회 + 미매칭 시 `RESUME_CHECKPOINT_MISSING` throw. 양쪽 drive 메서드가 공유하는 단일 진입점. 범위 적합.

- **[INFO]** `handleAiResumeTurn` private 메서드 신설 (40줄)
  - 위치: diff line +1093~+1132
  - 상세: 기존 `driveResumeAwaited` AI 분기에 있던 `buildRetryReentryState` + `setNodeOutput` + `processAiResumeTurn` 호출 로직 추출. 내용이 이전과 동일하고 중복 제거 목적. 범위 적합.

- **[INFO]** `driveResumeAwaited` 내부 form/buttons/ai if-else 91줄 → `dispatchResumeTurn` 호출 12줄로 교체
  - 위치: diff line -1144~-1226 / +1229~+1243
  - 상세: 동작 보존. `PARK_RELEASED` 조기반환 로직 유지. 범위 적합.

- **[INFO]** `driveResumeFrame` 내부 form/buttons/ai if-else 77줄 → `dispatchResumeTurn` 호출 14줄로 교체
  - 위치: diff line -1255~-1324 / +1324~+1338
  - 상세: 동작 보존. 중첩 `{ parked: true }` 반환 포함. 범위 적합.

### 파일 3: resume-turn-dispatch.ts (신규)

- **[INFO]** 신규 타입 정의 파일: `ResumeTurnDispatch` / `ResumeTurnSelector` / `ResumeTurnContext` 인터페이스 3개 (80줄)
  - 위치: 전체 파일
  - 상세: execution-engine 모듈 전용 타입 계약 파일. 변경 의도(extension seam + 타입 분리) 범위 내. 구현 코드 없음 — 인터페이스만. 범위 적합.

### 파일 4: process-turn-result.ts (신규)

- **[INFO]** 신규 공유 타입 파일: `PARK_RELEASED` const + `ParkSignal` type + `ProcessTurnResult` type (34줄)
  - 위치: 전체 파일
  - 상세: `execution-engine.service.ts` 인라인 선언을 1:1 이관. 문서 주석이 기존보다 상세해졌으나 내용은 동일 의미 확장. 범위 적합.

### 파일 5~6: plan/complete/ 신규 파일 (exec-park-b2a-followup.md, exec-park-polish.md)

- **[INFO]** plan/complete 에 완료된 작업 추적 문서 2건 추가
  - 위치: 두 파일 전체
  - 상세: 프로젝트 규약(CLAUDE.md §정보 저장 위치)에 따라 완료 plan 을 plan/complete/ 에 이동/생성. 코드 영향 없음. 범위 적합.

### 파일 7: plan/complete/spec-draft-exec-park-b2-durable.md (신규)

- **[INFO]** spec draft 문서를 plan/complete 에 보관
  - 위치: 전체 파일
  - 상세: 역사 참조 문서. 코드 영향 없음. 범위 적합.

### 파일 8: plan/in-progress/exec-park-durable-resume.md (수정)

- **[INFO]** 완료 항목 4개를 `[ ]` → `[x]` 로 갱신 + umbrella 잔여 항목 범위 재정의 (10줄 내외)
  - 위치: diff line +2011~+2014
  - 상세: 완료된 work item 상태 반영. 코드 영향 없음. 규약에 따른 정상 plan 갱신. 범위 적합.

---

## 요약

7개 파일 변경 전체가 exec-park ai-review 권고(B-1 dispatchResumeTurn 레지스트리 추출 + C1 ProcessTurnResult 타입 이관)에 직접 대응한다. 코드 변경은 순수 리팩토링(동작 보존 추출)으로 새로운 기능을 추가하지 않으며, 기존 if-else 분기 2개소 → 공유 레지스트리 1개소 일원화다. 신규 테스트 8개는 추출된 메서드의 라우팅 계약을 검증하며 범위 내다. plan 파일 갱신은 프로젝트 규약에 따른 정상 상태 기록이다. 의도 이상의 변경, 불필요한 리팩토링, 범위 외 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅 변경, 미사용 임포트 추가, 의도하지 않은 설정 변경은 발견되지 않았다.

## 위험도

NONE
