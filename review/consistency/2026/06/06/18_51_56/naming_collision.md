# 신규 식별자 충돌 검토 결과

**검토 모드**: 구현 착수 전 (`--impl-prep`, scope=`spec/5-system/`)
**대상 Plan**: `plan/in-progress/exec-park-resume-dispatch-registry.md`
**신규 파일**: `shared/execution-resume/park-signal.ts`, `modules/execution-engine/resume-turn-dispatch.ts`

---

## 발견사항

### [WARNING] `ParkSignal` / `PARK_RELEASED` / `ProcessTurnResult` — 이미 존재하는 private 심볼과 이름 중복

- **target 신규 식별자**: `PARK_RELEASED` (const Symbol), `ParkSignal` (type alias), `ProcessTurnResult` (type alias) — `shared/execution-resume/park-signal.ts` 에 export 예정 (S1)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/exec-park-followup-272c4f/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L275–285, module-private(unexported) 선언. `ProcessTurnResult` 는 동일 파일 내 L3211, L3915, L5238, L5313, L6464 등 33+ 곳에서 사용 중.
- **상세**: 세 식별자가 현재 service 파일 내에서만 사용하는 **module-private** 심볼이므로 외부 namespace 충돌은 없다. 그러나 S1 이 이 이름들을 shared 파일로 그대로 "이동"(extraction)하는 작업이므로, 이관 후 service 파일이 기존 로컬 선언을 그대로 두면 이름이 둘 곳에 존재(로컬 + export)하는 혼선이 생긴다. 이관 완료 후 service 의 L275–285 로컬 선언 3줄은 반드시 제거하고 import 로 교체해야 한다.
- **제안**: S1 구현 시 service 파일의 기존 로컬 선언(`const PARK_RELEASED`, `type ParkSignal`, `type ProcessTurnResult`)을 삭제하고 새 파일 import 로 교체하는 것을 동일 커밋에 포함 — 스텝 S4(두 드라이브 함수 본문 교체)와 동시에 처리하면 중복 선언 구간이 생기지 않는다.

---

### [WARNING] `park-signal.ts` vs `park-release-signal.ts` — 파일명 혼동 가능성

- **target 신규 식별자**: `shared/execution-resume/park-signal.ts` (신규 파일)
- **기존 사용처**: `shared/execution-resume/park-release-signal.ts` (기존 파일) — `ParkReleaseSignal` 클래스 + `isParkReleaseSignal` 타입 가드 포함. 현재 `execution-engine.service.ts`, `workflow.handler.ts`, 관련 spec 파일에서 광범위하게 import.
- **상세**: 두 파일이 같은 디렉터리(`shared/execution-resume/`)에 공존하며, 이름이 `park-signal.ts` / `park-release-signal.ts` 로 유사해 IDE 자동완성 혼동 및 import 경로 오기입 위험이 있다. 의미도 혼동 가능 — `park-release-signal.ts` 는 "중첩 park 시 deep call stack unwind 용 Error 서브클래스", `park-signal.ts` 는 "top-level park 의 Symbol 리턴값 + 관련 타입". 사용처가 섞이면 디버깅 비용 증가.
- **제안**: 파일명을 `park-return-signal.ts` 또는 `park-symbol.ts` 처럼 역할을 더 명시적으로 구분하거나, `park-release-signal.ts` 와 합쳐서 `park-signals.ts` 단일 파일로 통합(두 개념이 모두 "park 신호" 범주). 단, 현재 spec frontmatter glob `shared/execution-resume/**` 에 포함되어 충돌은 아니다.

---

### [INFO] `ResumeTurnDispatch` / `ResumeTurnSelector` / `ResumeTurnContext` / `resumeTurnRegistry` / `dispatchResumeTurn` — 충돌 없음

- **target 신규 식별자**: 위 5종 — `modules/execution-engine/resume-turn-dispatch.ts` 신설(S2) 및 service 내 필드/메서드(S3)
- **기존 사용처**: 코드베이스 전체(`codebase/`) 및 spec(`spec/`), plan(`plan/`) 내 해당 이름 사용처 없음 — grep 무출력 확인.
- **상세**: 완전 신규 식별자. 기존 유사 패턴(`driveResumeAwaited`, `driveResumeFrame`, `buildRetryReentryState`, `processAiResumeTurn` 등)과 명명 일관성 있음(`Resume` prefix, camelCase).
- **제안**: 없음. 도입 진행 가능.

---

### [INFO] spec frontmatter 글롭 커버리지 — 신규 파일 2종 자동 포함

- **target 신규 파일**: `shared/execution-resume/park-signal.ts`, `modules/execution-engine/resume-turn-dispatch.ts`
- **기존 사용처**: `spec/5-system/4-execution-engine.md` frontmatter `code:` 에 등록된 글롭:
  - `codebase/backend/src/modules/execution-engine/**/*.ts` — `resume-turn-dispatch.ts` 포함
  - `codebase/backend/src/shared/execution-resume/**` — `park-signal.ts` 포함
- **상세**: 두 신규 파일 모두 기존 frontmatter 글롭에 자동 포함. spec 을 별도로 갱신하지 않아도 coverage 유지됨. (plan 도 "spec 변경 불요" 로 명시.)
- **제안**: 없음.

---

## 요약

`exec-park-resume-dispatch-registry` plan 이 도입하는 신규 식별자는 실질적 의미 충돌이 없다. `PARK_RELEASED`/`ParkSignal`/`ProcessTurnResult` 세 심볼은 service 파일의 module-private 선언과 이름이 같지만, 이 plan 의 목적 자체가 그 private 심볼을 shared 파일로 추출(이관)하는 것이므로 충돌이 아닌 **이관 작업**이다 — 단, 이관 후 service 파일의 로컬 선언 제거가 동일 커밋에 포함되지 않으면 일시적 이중 정의 상태가 발생할 수 있다. `ResumeTurnDispatch` 등 새 타입/레지스트리 이름은 기존 어디에도 없어 충돌 없음. 유일한 실질 위험은 `park-signal.ts` 와 `park-release-signal.ts` 의 유사 파일명 혼동 가능성이며, 파일명 재검토를 권장한다.

## 위험도

LOW
