# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 신규 e2e 스캐폴드가 형제 두 파일(`workflow-delete-concurrency.e2e-spec.ts`, `workspace-delete-concurrency.e2e-spec.ts`)과 구조적으로 거의 동일하다 (locker 커넥션 분리, `fireDelete` 클로저, 공허성 가드용 `Promise.race` + 1.5초 타임아웃, `finally` 블록의 `ROLLBACK`/`pending.catch` 정리, 마지막 `audit_log` COUNT 단언 패턴이 세 파일에 반복).
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` 전체 (특히 게이트 30~118행) vs `codebase/backend/test/workflow-delete-concurrency.e2e-spec.ts`
  - 상세: 세 번째로 반복되는 사례라 공용 하네스(예: "두 요청을 advisory/row lock 으로 줄 세우고 감사 1건·404 를 단언" 헬퍼) 추출을 고려할 시점이지만, `plan/in-progress/trigger-dup-delete.md` (게이트 92행 "네 자리 공용 헬퍼 추출은 하지 않는다")가 이를 별도 설계 항목으로 명시적으로 유예했고, 직전 리뷰 라운드(`review/code/2026/09/20/22_07_23/SUMMARY.md` INFO#7)도 같은 사실을 "누락이 아닌 의도된 지연"으로 이미 판정했다. 이번 라운드에서 새로 생긴 문제가 아니라 기존 판정을 재확인하는 수준이다.
  - 제안: 조치 불요(이미 트래커에 유예 근거 명시). 네 번째 유사 사례가 생기면 공용 헬퍼 추출 우선순위를 재검토할 것.

- **[INFO]** `jest.spyOn(Logger.prototype, 'error').mockImplementation(...)` + `try { ... } finally { error.mockRestore(); }` 보일러플레이트가 이번 diff 로 같은 파일 안에 두 번(게이트 4032, 4127) 새로 추가됐다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:4032`, `:4127`
  - 상세: 형제 `workflows.service.spec.ts`·`workspaces.service.spec.ts` 에도 동일 패턴이 각각 두 번씩 이미 존재해(공용 헬퍼 없이) 이번 추가가 코드베이스 컨벤션과 일치한다 — 새로 도입된 스타일 이탈이 아니라 기존 관행을 그대로 따른 것이다.
  - 제안: 조치 불요. 저장소 전반에서 이 패턴이 더 늘어나면 `withLoggerErrorSpy(fn)` 류의 공용 헬퍼 추출을 별도로 검토.

- **[INFO]** 이번 diff 에 포함된 `review/code/2026/09/20/22_07_23/**`(12개 파일) · `review/consistency/2026/09/20/21_43_47/**`(8개 파일)는 도구가 생성한 리뷰/컨시스턴시 산출물(JSON 상태 파일 + 보고서 마크다운)이며 수기 로직이 아니다. 가독성·네이밍·함수 길이 등 유지보수성 기준을 적용할 대상이 아니라고 판단해 별도 코드 리뷰를 하지 않았다.
  - 위치: `review/code/2026/09/20/22_07_23/*.md`, `*.json`; `review/consistency/2026/09/20/21_43_47/*.md`, `*.json`
  - 상세: CLAUDE.md 의 저장 위치 규약대로 `review/**` 아래 세션 산출물이 커밋된 정상적인 형태다.
  - 제안: 조치 불요.

핵심 코드 변경(`triggers.service.ts` `remove()`)을 직접 확인한 결과도 덧붙인다: 락 안 재조회(`fresh`) 변수명은 같은 파일 `update()`(652행)의 기존 관례를 그대로 재사용했고, `throwTriggerNotFound()` 헬퍼도 파일 내 기존 4곳과 같은 방식으로 호출된다. 매직 넘버 없음(`TRIGGER_DELETE_LOCK_TIMEOUT_MS` 는 이미 존재하는 named export 재사용). 중첩 깊이는 `transaction(async (m) => { ... if (!fresh) ... })` 2단으로 얕고, `.catch` 분기(`NotFoundException` 조기 재던짐)도 단일 if 문이라 복잡도가 낮다. 추가된 주석은 길지만 같은 파일·형제 파일(`trigger-config-lock.ts` 등)의 "근거를 인라인 주석에 남기는" 기존 컨벤션과 일치한다.

## 요약

이번 PR 은 `TriggersService.remove()` 에 락 안 재조회 한 줄과 `.catch` 분기 한 줄만 추가하는 최소 diff이며, 변수 네이밍·헬퍼 재사용·주석 스타일 모두 같은 파일과 형제 삭제 경로(workflows/workspaces)의 기존 컨벤션을 정확히 따른다. 신규 e2e·단위 테스트의 보일러플레이트 반복은 세 번째(e2e)·세 번째(logger spy) 재발이지만 둘 다 트래커에서 의도적으로 유예되었거나 기존 코드베이스 관행과 일치해 새로운 유지보수성 결함으로 보기 어렵다. `review/**` 하위 산출물은 도구 생성 문서로 별도 코드 품질 평가 대상이 아니다.

## 위험도

NONE
