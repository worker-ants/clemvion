# 유지보수성(Maintainability) 리뷰 — trigger 동시 DELETE 감사 중복 수정 (fresh review, 23_04_17)

## 검토 범위

`origin/main` 대비 누적 diff 45개 파일 중 실제 소스/테스트/plan 변경 6개(파일 1~6:
`CHANGELOG.md`, `triggers.service.spec.ts`, `triggers.service.ts`, 신규 e2e
`trigger-delete-concurrency.e2e-spec.ts`, 트래커 `spec-draft-nullable-notation-followups.md`,
신규 plan `trigger-dup-delete.md`)를 코드 유지보수성 관점에서 검토했다. 나머지 39개
(파일 7~45)는 `review/code/2026/09/20/{22_07_23,22_39_21}/**`·`review/consistency/2026/09/20/21_43_47/**` —
직전 두 라운드의 `/ai-review`·`consistency-check` 산출물(보고서·상태 JSON)이며, 손으로
짠 로직이 아니라 유지보수성 채점 대상이 아니다. 다만 그 산출물들이 이번 diff 의 이전
라운드에서 이 코드에 대해 이미 남긴 WARNING(락 key 리터럴 복제, `workspaceId` 스코프
미단언)이 이번 라운드의 diff 에 실제로 반영됐는지는 소스를 직접 열어 교차 확인했다.

## 발견사항

- **[INFO]** 직전 두 라운드(`22_07_23`, `22_39_21`)의 maintainability WARNING 이 실제로 해소됨을 소스에서 재확인
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts:8` (`import { triggerConfigLockKey } from '../src/modules/triggers/trigger-config-lock';`)
  - 상세: `22_07_23` 라운드가 지적한 "advisory lock key 포맷(`trigger-config:<id>`)을 export 된 헬퍼 대신 로컬 문자열로 복제"가 이번 diff 에서 `triggerConfigLockKey` import 로 교체됐다(SUMMARY#3, 커밋 `931877519`). 파일을 직접 열어 리터럴 헬퍼(`const lockKey = ...`)가 더 이상 존재하지 않고 프로덕션 lock key 계산과 단일 진실원을 공유함을 확인했다. 재발 없음.
  - 제안: 조치 불요.

- **[INFO]** 테스트 관측력 개선(`freshFindOptions`)이 mock 구조를 과도하게 복잡화하지 않음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`freshFindOptions` 배열 추가, 게이트 3812·3814-3815·3874, 신규 테스트의 단언 게이트 4053-4055)
  - 상세: `22_39_21` 라운드가 지적한 "락 안 재조회의 `workspaceId` 스코프를 아무도 단언하지 않는다"(값만 보는 mock 이 인가 회귀를 못 잡는 문제)가, `freshFindOne` 콜백이 호출 인자(`findOptions`)를 배열에 push 하고 반환값 헬퍼(`makeService` 리턴 객체)에 그대로 노출하는 최소 변경으로 해소됐다. 새 상태(`freshFindOptions`)는 기존 `lockKeys`/`events` 배열과 같은 관측 패턴(호출 인자를 배열에 적립 → 테스트에서 `.at(-1)` 로 최신값 단언)을 재사용해 새 관용구를 발명하지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `TriggersService.remove()` 본문은 함수 길이·중첩·복잡도 모두 낮게 유지됨
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `remove()` (게이트 1082-1101, 전체 함수는 약 40줄)
  - 상세: 이번 diff 가 추가한 것은 `transaction()` 콜백 안의 재조회 3줄(`const fresh = ...; if (!fresh) this.throwTriggerNotFound();`)과 `.catch` 안의 조기 재던짐 1줄(`if (err instanceof NotFoundException) throw err;`)뿐이다. 중첩은 `manager.transaction(async (m) => { ... if (!fresh) ... })` 2단이 최대이고, 분기는 단일 `if` 두 개뿐이라 순환 복잡도 증가가 미미하다. 변수명 `fresh` 는 같은 파일 `update()`(약 652행)의 기존 관례를, `throwTriggerNotFound()` 호출은 파일 내 기존 4곳의 관례를 그대로 재사용해 새 이름을 발명하지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 매직 넘버 없음 — 상수·literal 모두 근거가 인접 주석에 있음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:1083`(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`, 기존 named export 재사용) / `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts:106`(`1_500`ms 대기)
  - 상세: e2e 의 `1_500`(1.5초) 리터럴은 헤더 독스트링과 인라인 주석 양쪽에서 "삭제 경로의 `lock_timeout` 이 5초이므로 그보다 짧게 쥐어야 공허성 가드가 «겹침»과 «둘 다 실패»를 가른다"는 근거를 명시한다 — 이름 없는 숫자지만 의미가 코드 밖 문서가 아니라 바로 옆 주석에 있어 유지보수 시 놓치기 어렵다.
  - 제안: 조치 불요(선택적으로 `RACE_WAIT_MS` 같은 명명 상수로 뽑을 수 있으나, 형제 두 e2e(`workflow-/workspace-delete-concurrency.e2e-spec.ts`)도 같은 인라인 리터럴 스타일이라 이 파일만 바꾸면 오히려 일관성이 깨진다).

- **[INFO]** (기존 라운드에서 이미 판정·유예됨 — 재확인만) 3번째 반복되는 동시성 e2e 스캐폴드 구조 중복
  - 위치: `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` 전체 vs `workflow-delete-concurrency.e2e-spec.ts`/`workspace-delete-concurrency.e2e-spec.ts`
  - 상세: `locker`/`db` 커넥션 분리, `fireDelete` 클로저, `Promise.race` 공허성 가드, `finally` 의 `ROLLBACK.catch`/`pending.catch` 정리, `audit_log` COUNT 단언까지 구조가 거의 동일하다. `plan/in-progress/trigger-dup-delete.md` "## 이 PR 이 하지 않는 것" 절이 "네 자리 공용 헬퍼 추출은 하지 않는다 — 트래커의 별도 설계 항목이 그 자리"라고 명시적으로 유예했고, 이 판단은 두 라운드 연속(`22_07_23`, `22_39_21`) 확인된 것으로 이번 라운드에서 새로 생긴 결함이 아니다.
  - 제안: 조치 불요(추적 중). 네 번째 유사 사례가 생기면 공용 하네스 추출 우선순위를 재검토할 근거가 될 것.

- **[INFO]** `Logger.prototype.error` spy + `try/finally { mockRestore() }` 보일러플레이트가 파일 안에 두 번(신규 테스트 두 건) 반복
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 게이트 4035-4064, 4135-4156
  - 상세: 형제 `workflows.service.spec.ts`/`workspaces.service.spec.ts` 에도 이미 같은 패턴이 공용 헬퍼 없이 반복돼 있어, 이번 추가는 새 스타일 이탈이 아니라 코드베이스 기존 관행을 그대로 따른 것이다.
  - 제안: 조치 불요.

- **[INFO]** plan/CHANGELOG 문서의 서술 밀도는 형제 커밋과 대칭 — 문서 자체를 코드 유지보수성 기준으로 채점하지 않음
  - 위치: `CHANGELOG.md`(신규 "## Unreleased" 항목), `plan/in-progress/trigger-dup-delete.md`(신규 파일)
  - 상세: 두 문서 모두 직전 형제 PR(워크플로·워크스페이스)이 세운 "문제/고친 것/판별력 실측/남는 것" 4단 구성을 그대로 따라 구조적 일관성이 있다. 문서 파일은 함수 길이·중첩·매직 넘버 같은 코드 유지보수성 축이 적용되지 않으므로 별도 결함으로 잡지 않는다.
  - 제안: 조치 불요.

WARNING/CRITICAL 없음.

## 뮤테이션/저장소 변경

가설 확인을 위한 코드 뮤테이션을 수행하지 않았다 — 저장소 파일은 `Read`/`grep` 로만
열람했고, 직전 두 라운드가 이미 유효 뮤턴트로 판별력을 실측한 결과(재조회 분기 삭제 시
RED, `NotFoundException` 가드 삭제 시 별도 RED, `logger.error` 호출 삭제 시 SUMMARY#4
신규 테스트만 RED)를 그대로 신뢰했다. `git status --short` 기준 이 세션이 저장소에
남긴 변경 없음.

## 요약

이번 fresh 라운드에서 검토한 핵심 diff(`triggers.service.ts` 14줄 + 신규/보강 단위
테스트 2건 + 신규 e2e 파일 + plan/CHANGELOG 문서)는 함수 길이·중첩 깊이·복잡도가 모두
낮고, 네이밍·헬퍼 재사용·주석 스타일이 같은 파일과 형제 삭제 경로(workflows/workspaces)의
기존 컨벤션을 그대로 따른다. 앞선 두 라운드가 지적했던 유지보수성 WARNING 두 건 —
(1) e2e 의 advisory lock key 리터럴 복제, (2) 락 안 재조회의 `workspaceId` 스코프를
아무도 단언하지 않던 테스트 공백 — 모두 소스에서 실제로 해소됐음을 직접 확인했다.
남아 있는 중복(3번째 e2e 스캐폴드 반복, logger-spy 보일러플레이트 반복)은 이 PR 이
새로 만든 것이 아니라 코드베이스 전반의 기존 패턴이거나 plan 문서가 명시적으로 유예한
것이라 감점 요소로 보지 않는다. 이번 diff 범위에서 새로 도입된 유지보수성 결함은
찾지 못했다.

## 위험도

NONE
