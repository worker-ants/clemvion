# 부작용(Side Effect) 리뷰

## 범위 요약

이번 변경(`trigger-canary-hardening` 배치, `efb0e4b36`)은 **프로덕션 코드(`codebase/backend/src/modules/**` 등)를 전혀 건드리지 않는다.** 변경분 16개 파일 전부가 (a) 신규 repo-guard + 그 spec(순수 읽기 로직), (b) 기존 self-spec/e2e 파일의 주석·신규 단언 추가, (c) `plan/**`·`review/consistency/**` 문서다. `git diff HEAD~1 HEAD --stat` 로 확인.

## 발견사항

- **[INFO]** 신규 guard `readStringArrayConst`/`readAllTriggerSecretColumnLists` 는 `fs.readFileSync` 만 사용하는 순수 읽기 함수 — 파일시스템 쓰기·전역 상태 변경 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:97` (`readStringArrayConst`), `:95`(`readAllTriggerSecretColumnLists`)
  - 상세: `repoRoot`/`relPath`/`constName` 을 인자로만 받아 AST 파싱 결과를 리턴하고 어떤 외부 상태도 갱신하지 않는다. 존재하지 않는 경로를 주면 `fs.readFileSync` 가 예외를 던지며 종료하는데, 이는 가드의 의도된 fail-loud 동작이라 부작용으로 분류하지 않는다.
  - 제안: 없음(문제 없음, 확인 목적 기록).

- **[INFO]** 신규 spec 의 임시 파일 I/O 는 `os.tmpdir()` 격리 + `afterAll` 정리로 저장소 트리를 벗어난다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts:90-95` (`beforeAll`/`afterAll`)
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-secret-columns-'))` 로 격리된 디렉터리를 만들고, `afterAll` 에서 `fs.rmSync(tmp, { recursive: true, force: true })` 로 확실히 제거한다. 저장소 트리 안에 잔여물을 남기지 않으며, 병렬 실행 중인 다른 테스트/리뷰어와 충돌할 파일 경로도 아니다.
  - 제안: 없음.

- **[INFO]** 신규 e2e 단언(`expectTriggerWorkflowRef` 호출 3곳)은 기존에 export 되어 있던 헬퍼를 그대로 재사용 — 시그니처 변경도, 새 네트워크/DB 호출도 없음.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — C-2 목록 케이스, PATCH cron 케이스(`D`), PATCH `isActive` 재활성 케이스(각 diff 게이트 라인 271-278, 389-393, 425-430)
  - 상세: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` 자체는 이번 diff에 포함되지 않았고(`git diff --stat` 로 확인), `expectTriggerWorkflowRef(dto, { present, expectedWorkflowId })` 시그니처도 기존 그대로다. 새로 추가된 것은 이미 응답으로 받아온 `row`/`patch.body.data` 에 대한 순수 `expect` 단언뿐이라 추가 HTTP/DB 호출이 없다.
  - 제안: 없음.

- **[INFO]** `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 관련 변경은 **주석(rationale)만 갱신**되었고 실제 정리 로직(raw `DELETE FROM trigger`, `secret_store` 고아 row 방치)은 이번 diff에서 동일하다 — 새로운 부작용이 도입된 것이 아니라 기존에 이미 존재하던 부작용(문서화된 "고아 row")의 근거를 실측치로 교체한 것.
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:148-168` (JSDoc), `afterAll` 본문(:169~)은 unchanged
  - 상세: `git diff HEAD~1 HEAD` 로 `afterAll` 구현부에 diff 라인이 없음을 확인했다. 자매 파일 `chat-channel-trigger-create.e2e-spec.ts` 에도 정본을 가리키는 주석 4줄만 추가됐고 `afterAll` 로직 자체는 그대로다. 즉 "e2e 테스트가 `secret_store` 에 고아 row 를 남긴다"는 부작용은 이번 PR 이전부터 있었고 이번 PR 은 그 부작용의 무해성 근거(세션 간 볼륨 삭제, 세션 내 접두 스코프)를 표로 정리해 실었을 뿐이다. 회귀나 신규 위험이 아니다.
  - 제안: 없음.

- **[INFO]** `review/consistency/2026/09/14/10_44_37/**` 8개 파일과 `plan/in-progress/*.md` 2개 파일은 harness 관례상 정상적인 신규 산출물(컨벤션 체크 리포트, 작업 트래커)이며 런타임 부작용과 무관하다.
  - 위치: `review/consistency/2026/09/14/10_44_37/*`, `plan/in-progress/trigger-canary-hardening.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
  - 상세: 전부 `new file mode 100644` 로 생성되거나(리뷰 산출물) 체크박스/각주만 갱신된(트래커) 마크다운/JSON 이며, 코드 실행 경로에 영향을 주지 않는다.
  - 제안: 없음.

## 요약

이번 변경분은 프로덕션 서비스 코드를 전혀 수정하지 않고 (1) 순수 읽기 전용 신규 repo-guard, (2) 기존 헬퍼를 재사용하는 e2e 단언 추가, (3) 주석/문서/plan 갱신으로만 구성된다. 새 전역 상태·환경 변수 읽기쓰기·네트워크 호출·시그니처 변경·이벤트 콜백 변경이 전혀 없고, 유일한 파일시스템 쓰기(guard spec 의 임시 디렉터리)는 `os.tmpdir()` 격리 + `afterAll` 정리로 완전히 봉쇄되어 있다. `secret_store` 고아 row 관련 부작용은 이번 PR 이 새로 만든 것이 아니라 기존에 문서화되어 있던 것의 근거를 실측으로 보강한 것뿐이다.

## 위험도
NONE
