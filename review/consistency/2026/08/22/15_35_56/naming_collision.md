STATUS=success naming_collision review complete (target 문서 없음 → 코퍼스 선제 스캔으로 대체)
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — `codebase/backend/src/shared/utils/`

## 전제 조건 문제

target 문서 본문이 `(없음)` 으로 전달됐다 — 이번 impl-prep 검토가 근거로 삼을 신규 spec/plan
문서가 프롬프트에 실려 있지 않다. 즉 "target 이 새로 도입하는 식별자" 자체가 명시되지 않아,
본래 의미의 신규 ID/엔티티/endpoint/이벤트/ENV/경로 충돌 대조표를 만들 수 없다. 이는 그
자체로 절차상 결함이다 (아래 발견사항 1).

브랜치명(`backend-redact-depth-boundary`)과 검토 scope(`codebase/backend/src/shared/utils/`)로
미루어 이 작업의 주제가 **redact 유틸의 깊이(depth) 경계**로 추정되어, 해당 주제로 코퍼스를
선제 스캔했다. 결과: 이 정확한 개념 공간에 이미 **3개의 독립된, 의도적으로 분리된** depth-cap
식별자 계열이 존재한다. target 이 새 이름으로 "깊이 상한" 개념을 재도입하면 이 기존 계열과
충돌(동일명 재정의) 하거나 4번째로 갈라진 유사 개념을 만들 위험이 크다.

## 발견사항

- **[WARNING]** target 문서가 비어 있어 신규 식별자 대조 불가
  - target 신규 식별자: (문서에 명시 없음 — `### 구현 대상 영역: codebase/backend/src/shared/utils/` 아래 `(없음)`)
  - 기존 사용처: 해당 없음 (비교 대상 부재)
  - 상세: naming_collision 체크는 target 이 "새로 도입"한다고 선언한 식별자 목록을 기존
    코퍼스와 대조하는 절차다. target 본문이 없으므로 이 절차를 원 설계대로 수행할 수 없고,
    아래 발견사항은 브랜치명·scope 로부터 추정한 선제 스캔 결과다. 실제 target 문서(plan 또는
    spec diff)가 붙으면 재검토가 필요하다.
  - 제안: orchestrator 가 실제 target 문서(plan/in-progress 의 관련 파일 또는 diff)를 프롬프트에
    포함해 재실행하거나, 이번 작업이 아직 spec/plan 단계 없이 직접 구현으로 넘어가는 것이라면
    그 사실을 impl-prep 게이트 판단에 반영해야 한다.

- **[CRITICAL]** "redact depth boundary" 개념이 scope 안에 이미 3계열로 존재 — 신규 명명 시 충돌·중복 고위험
  - target 신규 식별자: (추정) 이번 작업이 도입하려는 "redact 깊이 상한" 관련 신규 상수/함수명
  - 기존 사용처:
    - `MAX_REDACT_DEPTH` (`MAX_MASK_DEPTH` 의 지역 별칭) — `codebase/backend/src/shared/utils/sanitize-error-message.ts:128`, 비교식 `depth >= MAX_REDACT_DEPTH` (`deepRedactCore`, 동 파일 :270)
    - `DEPTH_MASK_MARKER` (`'[REDACTED_DEPTH]'`) — SoT `codebase/packages/masked-markers/src/index.ts:33`, backend 재-export `sanitize-error-message.ts:136`, frontend 소비 `codebase/frontend/src/lib/utils/masked-markers.ts`
    - `MAX_MASK_DEPTH = 10` (SoT, "중립 이름") — `codebase/packages/masked-markers/src/index.ts:81`. 문서 주석이 이미 "마스커 쪽 `MAX_REDACT_DEPTH`, 스캐너 쪽 `MAX_MARKER_SCAN_DEPTH`" 두 지역 별칭이 있었다고 명시(:73)
    - `MAX_SANITIZE_DEPTH = 10` — `codebase/backend/src/modules/websocket/websocket.service.ts:80`. **의도적으로 별개 불변식**: 비교식이 `depth > MAX_SANITIZE_DEPTH`(:119, `>` vs `>=`)라 마커가 한 칸 더 깊은 자리에 놓이고, 프런트 마커 스캐너가 WS 페이로드는 스캔하지 않는다 — `sanitize-error-message.ts:124-126` 주석이 "합치지 않는다" 를 명시적으로 못박아 둔 상태
    - `stripExternalOnlyFields<T>(value, maxDepth)` — `codebase/backend/src/shared/utils/strip-external-only-fields.ts:96-101`. 호출부가 값을 주입하는 **제3의 독립적** 깊이 상한 (경계 비교식 `depth > maxDepth`)
  - 상세: 검토 scope 인 `codebase/backend/src/shared/utils/` 자체가 이미 `MAX_REDACT_DEPTH`/`DEPTH_MASK_MARKER`(sanitize-error-message.ts)와 `maxDepth` 파라미터(strip-external-only-fields.ts) 두 계열을 갖고 있고, 인접 모듈(`websocket.service.ts`)에 `MAX_SANITIZE_DEPTH` 라는 세 번째 계열이 있다. 세 계열 모두 "레코드가 특정 깊이를 넘으면 서브트리를 마스킹/보존한다" 는 같은 상위 개념이지만 경계 비교 연산자(`>=` vs `>`)와 대상 페이로드가 서로 달라 **의도적으로 병합되지 않은 상태**다 (`sanitize-error-message.ts:124-126`, `masked-markers/src/index.ts:77-79` 주석이 각각 근거를 명시). 이런 배경에서 target 이 "depth boundary" 라는 새 기능/상수를 신설하며 `MAX_REDACT_DEPTH`/`MAX_SANITIZE_DEPTH`/`MAX_MASK_DEPTH` 와 다시 헷갈리는 4번째 이름(`MAX_DEPTH`, `REDACT_DEPTH_LIMIT`, `DEPTH_BOUNDARY` 류)을 도입하면, (a) 기존 세 계열 중 하나와 개념이 겹쳐 사실상 재구현이 되거나 (b) 이름이 비슷해 리뷰어·차후 유지보수자가 세 계열 중 무엇을 가리키는지 혼동할 위험이 매우 크다.
  - 제안: 구현 착수 전 `sanitize-error-message.ts`(특히 `MAX_REDACT_DEPTH`/`DEPTH_MASK_MARKER` 문서 주석)와 `codebase/packages/masked-markers/src/index.ts`, `websocket.service.ts` 의 `MAX_SANITIZE_DEPTH` 주석을 반드시 먼저 읽고, 이번 작업이 이 기존 3계열 중 하나의 확장/버그수정인지, 아니면 정말 새로운 4번째 불변식인지 판정해야 한다. 후자라면 이름에 기존 세 상수와 구분되는 명시적 한정어(예: 대상 페이로드명)를 넣어 혼동을 피할 것. 전자(기존 계열의 연장)라면 새 식별자를 만들지 말고 기존 `MAX_REDACT_DEPTH`/`DEPTH_MASK_MARKER` 를 그대로 재사용해야 한다 — 이 저장소는 "마커/깊이 상수 미러 발산" 으로 이미 여러 차례(PR #1188~#1191) 비용을 치른 이력이 있다(`sanitize-error-message.ts` 파일 상단 주석, `masked-markers/src/index.ts` 주석 참조).

- **[INFO]** 동일 주제의 최근 완료 PR 이력 — 델타 0 가능성 점검 권장
  - target 신규 식별자: 해당 없음 (정보성)
  - 기존 사용처: 최근 커밋 `3f8543eae`("마커 계약을 공유 패키지로 추출 — 계약 테스트가 CI 경로 게이팅에 막혔다"), `4287cdd5b`("마커 재제출을 서버가 거부한다 — 가드를 UI 밖으로"), `b677564e0`("`Execution.inputData` 카브아웃을 닫았다 — 재제출 소비처 3곳에 마커 가드"), `7b0e65aa8`("미러 가드 사본을 1개로")
  - 상세: 이 4개 커밋이 정확히 "redact 마스킹의 깊이 상한 + 마커 공유 계약" 주제를 다루며 최근
    main 에 이미 병합되어 있다. 현재 worktree 는 `origin/main` 대비 diff 가 0(`git status` 확인,
    untracked 는 review 산출물뿐)이라 아직 아무 구현도 시작되지 않았다. naming_collision 범위는
    아니지만, 착수 전 이번 작업이 위 PR 들이 이미 커버한 범위와 델타가 있는지(예: 다른 표면·다른
    깊이 정책) 먼저 확인할 것을 권고한다 — 델타가 없다면 신규 식별자 자체가 불필요하다.
  - 제안: naming_collision 판정과 별개로, impl-prep 단계에서 "이 depth-boundary 작업이 이미
    병합된 마커 계약(#1188~#1191)과 어떤 차이가 있는가"를 1차로 확인.

## 요약

target 문서 본문이 비어 있어 정규 절차의 신규 식별자 대조표를 만들 수 없었다. 대신 검토
scope(`codebase/backend/src/shared/utils/`)와 브랜치명을 근거로 "redact 깊이 경계" 주제를
코퍼스에서 선제 스캔한 결과, 정확히 같은 개념 공간에 이미 `MAX_REDACT_DEPTH`/`DEPTH_MASK_MARKER`
(`sanitize-error-message.ts` + `@workflow/masked-markers`), `MAX_SANITIZE_DEPTH`
(`websocket.service.ts`), `stripExternalOnlyFields` 의 `maxDepth` 파라미터라는 3개의 독립되고
의도적으로 병합되지 않은 depth-cap 계열이 존재한다. target 이 이 개념을 새 이름으로 재도입하면
기존 계열과 개념적으로 충돌하거나 리뷰어에게 혼동을 주는 4번째 유사 이름을 만들 위험이 높다 —
착수 전 기존 세 계열의 문서 주석을 읽고 확장/재사용 여부를 먼저 판정해야 한다. 또한 최근 4개
PR(#1188~#1191)이 같은 주제를 이미 다뤘으므로 델타 존재 여부도 함께 확인이 필요하다.

## 위험도
MEDIUM
