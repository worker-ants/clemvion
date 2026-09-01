# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `completeRetryExecution` 의 JSDoc 블록이 헬퍼 추출 리팩터 과정에서 엉뚱한 함수 위로 떨어져 나갔다 — 실제 함수는 무주석, 그 문서는 이제 `markSpawnedRowFailed` 바로 위에 얹혀 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:711`~`777` (Read 로 직접 확인 — 게이트 번호는 diff 상 파일 4의 `@@ -727,13 +729,56 @@` 훅 이후 실제 파일 줄 번호와 일치)
  - 상세: diff 는 기존 `completeRetryExecution` 바로 위 JSDoc(`* retry 성공 종결 시 Execution 을 직접 COMPLETED 로 마감하는 fallback...` ~ `* @internal 이 메서드는 resumeGraphAfterRetry 의 defensive fallback 에서만 호출된다...`, 711~731줄)을 그 자리에 그대로 두고, 그 바로 다음에 새 헬퍼 `markSpawnedRowFailed`(자체 JSDoc 732~742줄 + 구현 743~755줄)와 `prepareSuccessTermination`(자체 JSDoc 757~769줄 + 구현 770~775줄)을 끼워 넣은 뒤, 원래 함수 `completeRetryExecution` 을 그 아래(777줄)로 밀어냈다. 결과적으로 실제 파일에서:
    - 711~731줄의 JSDoc("COMPLETED 마감 fallback", "`resumeGraphAfterRetry` 의 defensive fallback 에서만 호출" `@internal` 제약)은 지금 `markSpawnedRowFailed`(732줄 `/**`) 바로 앞에 위치 — 완전히 다른 의미(FAILED 로 zombie row 마감)의 함수 위에 무관한 문서가 얹혀 있다.
    - 정작 `completeRetryExecution`(777줄) 은 JSDoc 없이 시작한다 — 이 메서드가 `resumeGraphAfterRetry` 의 defensive fallback 에서만 호출돼야 한다는 `@internal` 제약, 호출 조건(`nodes.length === 0` 등), WARNING #7 참조 등 원래 문서가 담고 있던 모든 정보가 소실됐다.
    - IDE hover/TypeDoc 등 "선언 직전 블록 코멘트"를 그 선언에 귀속시키는 도구는 이 오귀속을 그대로 노출한다 — 다음 유지보수자가 `markSpawnedRowFailed` 를 "COMPLETED fallback, defensive 경로에서만 호출" 로, `completeRetryExecution` 을 "제약 없음" 으로 오독할 수 있다.
  - 제안: 711~731줄 JSDoc 블록을 777줄 `completeRetryExecution` 선언 바로 위로 이동한다. `markSpawnedRowFailed`(732~742줄)와 `prepareSuccessTermination`(757~769줄)의 JSDoc 은 이미 정확히 자기 함수 위에 있으므로 그대로 둔다.

- **[WARNING]** 이 커밋(`59dd12869`, `fix(engine): 성공한 retry 가 옛 실패 메시지를 남기고 있었다 + 무방비였던 가드 3개 고정`)이 CHANGELOG.md 를 갱신하지 않았다 — 동일 저장소의 최근 동종 커밋들과 관행이 어긋난다.
  - 위치: `CHANGELOG.md` (변경분 없음) / 대조: `git log --oneline -- CHANGELOG.md` 최상단이 `4e784a366`(직전 `fix` 커밋)
  - 상세: `git show --stat 59dd12869` 로 확인한 변경 파일 목록에 `CHANGELOG.md` 가 없다. 반면 같은 성격(`fix(engine)`, retry-turn 종결 경로 무가드 쓰기 차단)의 선행 커밋들(`92008b21f`, `7d1c8da9b`, `84cc53805`, `4e784a366`)은 전부 CHANGELOG.md 에 "## Unreleased — …" 섹션을 추가했고, CHANGELOG.md 안에는 이미 동일 파일(`retry-turn.service.ts`)의 과거 무가드 종결 결함(`#1022` 계열, 1118·1174줄 근방)이 상세히 기록돼 있다. 이번 커밋이 고친 3가지(성공 retry 가 옛 error 를 남기던 모순 레코드, atomic consume SQL 무방비, 취소가 FAILED 로 오분류되는 예외 경로)는 같은 성격의 사용자-관측 가능한 행동 변화(조회 화면에 잘못된 error 노출, 데이터 무결성)라 이 저장소의 기존 관행상 CHANGELOG 항목 대상으로 보인다.
  - 제안: `docs(harness)`/`docs(plan)` 류처럼 메타 작업에만 국한된 커밋이 아니므로, 후속 커밋으로 CHANGELOG.md "## Unreleased" 섹션에 이번 fix 요약(성공 retry 모순 레코드 · atomic guard 커버리지 · 취소 오분류 3건)을 추가할 것을 권장.

- **[INFO]** `markSpawnedRowFailed` JSDoc 에 `@param spawnedRow` 태그 누락(다른 두 파라미터는 있음).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:732`~`742` (JSDoc), 함수 선언 743줄
  - 상세: `@param logContext`, `@param errorMessage` 는 문서화됐지만 첫 인자 `spawnedRow: NodeExecution` 은 이름으로 자명하다고 보고 생략된 것으로 보인다. 이 파일의 다른 JSDoc(`finalizeGuarded`, `claimSpawnedRetryRow`)도 모든 파라미터를 `@param` 으로 나열하지 않는 느슨한 관례를 따르므로 이 저장소 컨벤션 위반은 아니나, 완전성 관점에서 사소한 개선 여지.
  - 제안: 선택적 — 굳이 고칠 필요는 없음.

## 요약

핵심 로직 변경(취소 오분류 방지 try/catch, atomic consume SQL 회귀 테스트, timeout 경로 반환값 소비, `markSpawnedRowFailed`/`prepareSuccessTermination` 헬퍼 추출)에 붙은 인라인 주석·JSDoc·테스트 설명은 전반적으로 매우 상세하고 정확했다 — `failFirstSegmentSetup` 이 실제로 warn 을 남긴다는 신규 주석의 사실 관계, `CoreEngineDriver` JSDoc 의 choke-point 예외 참조, plan 트래커(`ie-resume-turn-boundary-cancel.md`/`retry-turn-terminal-guard.md`)의 C-4 처분 기록까지 모두 코드·plan 상태와 일치함을 직접 확인했다. 다만 리팩터 과정에서 `completeRetryExecution` 의 JSDoc 블록이 이동 대상에서 누락돼 `markSpawnedRowFailed` 위에 잘못 얹혀 있는 실질적 오귀속 결함을 발견했고(WARNING), 이 저장소의 CHANGELOG 관행에 비추어 이번 fix 커밋에 대응 항목이 빠진 점도 지적한다(WARNING). 두 건 모두 런타임 동작에는 영향이 없는 순수 문서화 결함이다.

## 위험도

MEDIUM
