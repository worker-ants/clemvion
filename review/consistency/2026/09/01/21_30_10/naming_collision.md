# 신규 식별자 충돌 검토 — `spec-draft-error-code-two-surfaces.md`

## 검토 대상 요약

target 은 `spec/conventions/error-codes.md` §Overview "적용 범위" 문단에 기존 코드베이스에
**이미 존재하는** 두 const `ErrorCode`(`codebase/backend/src/nodes/core/error-codes.ts:8`)와
`EngineErrorCode`(같은 파일 `:147`)를 대표 surface 로 병기하는 문서 수정 draft다. 새 파일을
만들지 않고, 새 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var 를 도입하지 않는다 — 실측
결과 이 draft 가 spec 코퍼스에 **처음으로 명시 등재**하는 것은 `EngineErrorCode` 라는 이름
하나뿐이며, 이는 이미 코드에 존재하는 식별자를 문서에 반영하는 것이지 새로 만드는 것이 아니다.

## 발견사항

### 확인했으나 충돌 없음 (근거 기록)

1. **`EngineErrorCode` 명칭** — spec 코퍼스 전체(`grep -rn "EngineErrorCode" spec/`)에 target
   적용 전 등장 0건. `plan/` 에는 이 작업과 직접 연계된 두 파일(`plan/complete/exec-intake-followups.md`,
   `plan/in-progress/spec-conventions-engine-error-code-surface.md`)에만 등장 — 전부 동일 의미
   (엔진이 `Execution.error`/`NodeExecution.error` 에 싣는 코드). 다른 의미로 쓰인 사례 없음.
2. **`ErrorCode` 명칭** — target 이 처음 쓰는 것이 아니라 `spec/conventions/error-codes.md:25`
   에 **기존에 이미 등재**돼 있다(`code:` 의 `ErrorCode` enum). target 은 그 기존 언급 옆에
   `EngineErrorCode` 를 나란히 적을 뿐, `ErrorCode` 자체를 새로 도입하지 않는다.
3. **요구사항 ID / 파일 경로** — target 은 `spec/conventions/error-codes.md` (기존 파일)를
   수정할 뿐 신규 파일을 만들지 않는다. plan 파일명 `spec-draft-error-code-two-surfaces.md`
   는 `find plan -iname "*error-code*"` 로 확인한 기존 9개 파일(`spec-draft-error-codes.md` 등)과
   글자 그대로 겹치지 않으며, 이 저장소의 `spec-draft-*` 명명 컨벤션과 일치한다.
4. **API endpoint / 이벤트명 / ENV var·config key** — target 본문에 신규 정의 없음(문서 수정
   범위가 §Overview 한 문단으로 국한).

### INFO — `ErrorCode` 라는 이름 자체가 코드베이스에 이미 중의적(target 이 만든 문제는 아님)

- **target 신규 식별자**: 없음 (target 은 `ErrorCode`/`EngineErrorCode` 를 새로 짓지 않고
  기존 명칭을 그대로 인용)
- **기존 사용처**: `codebase/packages/expression-engine/src/errors.ts:5` — `export enum ErrorCode { EXPR_SYNTAX_ERROR, ... }`
  (expression-engine 패키지 전용, `EXPR_*` 값). `spec/conventions/error-codes.md:25` 가 가리키는
  `ErrorCode`(`codebase/backend/src/nodes/core/error-codes.ts:8`, 노드 핸들러 `output.error.code`)와는
  **다른 타입·다른 패키지·다른 의미**다.
- **상세**: 이 중의성은 target 이전부터 코드베이스에 존재했고(§Overview 문단이 `ErrorCode` 를
  단수로 지목한 것도 이미 그랬다), target 은 이 문단을 건드리되 `ErrorCode` 명칭 자체는
  재선언하지 않는다 — 그대로 둔다. expression-engine 의 `ErrorCode` 는 spec 어디에서도
  참조되지 않아(grep 0건) 규약 문서 독자가 실제로 혼동할 경로가 현재는 없다. 다만 병기로
  "두 surface" 라는 프레이밍이 강화되면, 향후 세 번째(expression-engine) 후보가 논의될 때
  "대표 surface 는 정확히 둘" 이라는 전제가 이 새 프레이밍과 충돌할 잠재 여지는 남는다.
- **제안**: target 범위에서 즉시 조치는 불필요(대상 문단이 이미 `ErrorCode` = 노드 핸들러
  const 로 한정해 서술하고 있어 병기 후에도 모호성이 늘지 않음). 다만 향후 expression-engine
  의 `ErrorCode` 를 규약 문서에 등재할 일이 생기면, 병기 대상은 "정확히 둘" 이 아니라
  "대표 surface 목록" 으로 재프레이밍이 필요하다는 점만 기록해 둔다 — target 자체를 막을
  사유는 아니다.

## 요약

target 은 새 식별자를 도입하지 않고, 코드베이스에 이미 존재하는 `EngineErrorCode`(신규
spec 등재, 충돌 없음 확인)와 기존에 이미 spec 에 등재된 `ErrorCode` 를 나란히 서술하는
문서 수정에 그친다. 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV var·파일 경로
6개 관점 모두에서 target 이 새로 만드는 이름과 기존 사용처 간의 실질 충돌은 발견되지 않았다.
유일한 관찰(expression-engine 의 `ErrorCode` 중의성)은 target 이전부터 있었고 target 이
악화시키지 않으므로 참고용 INFO 로만 남긴다.

## 위험도

NONE
