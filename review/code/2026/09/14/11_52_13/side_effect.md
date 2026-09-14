# 부작용(Side Effect) 리뷰

## 범위 요약

실질 코드 변경은 6개 파일뿐이다 — 신규 repo-guard(`trigger-secret-columns-guard.ts`)와 그 소비
spec(`trigger-secret-columns.spec.ts`), 기존 `trigger-workflow-ref.spec.ts` 의 표기(원문자→숫자)
정리, 그리고 `chat-channel-trigger-create.e2e-spec.ts`·`schedule-trigger.e2e-spec.ts`·
`trigger-workflow-ref.e2e-spec.ts` 세 e2e 파일의 주석 갱신 + 기존 export 헬퍼(`expectTriggerWorkflowRef`)
호출 3곳 추가다. 프로덕션 코드(`codebase/backend/src/modules/**`)는 전혀 건드리지 않는다. 나머지
파일(7~36번)은 `plan/**`·`review/code/2026/09/14/11_27_40/**`·`review/consistency/2026/09/14/**`
로, 직전 라운드(`review/code/2026/09/14/11_27_40`)의 리뷰 산출물과 그 fix(RESOLUTION.md 의
WARNING#2)가 이번 커밋에 반영된 것이라 코드 실행 경로와 무관하다.

## 발견사항

- **[INFO]** 신규 guard 함수는 순수 읽기(pure read) — 전역/공유 상태 변경 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` 의
    `readStringArrayConst`(46번째 줄부터 시작하는 함수 선언, 게이트 46~106)와
    `readAllTriggerSecretColumnLists`(게이트 108~123)
  - 상세: 인자(`repoRoot`/`relPath`/`constName`)만으로 동작하고 `fs.readFileSync` 로 읽기만 한다.
    쓰기·삭제·전역 변수 갱신이 없다. 대상 파일이 없으면 `fs.existsSync` 로 먼저 확인해 명시적
    `Error` 를 던지는 fail-loud 설계(게이트 54~59)이고, 이는 raw `ENOENT` 보다 진단이 낫게 하려는
    의도된 동작이라 부작용으로 분류하지 않는다.
  - 제안: 없음.

- **[INFO]** 신규 spec 의 파일시스템 쓰기는 `os.tmpdir()` 격리 + `afterAll` 정리로 저장소 트리 밖에 봉쇄됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` 의
    `beforeAll`(게이트 99~101)/`afterAll`(게이트 102~104)/`write` 헬퍼(게이트 106~109)
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-secret-columns-'))` 로 매 실행마다 고유한
    격리 디렉터리를 만들고, `afterAll` 에서 `fs.rmSync(tmp, { recursive: true, force: true })` 로
    확실히 제거한다. 저장소(`codebase/**`) 안에 파일을 쓰거나 남기지 않으며, 병렬로 도는 다른
    reviewer/테스트와 경로가 겹칠 위험도 없다(매 호출마다 랜덤 접미사).
  - 제안: 없음.

- **[INFO]** e2e 3곳에 추가된 `expectTriggerWorkflowRef(...)` 호출은 기존 export 헬퍼 재사용 — 시그니처 변경·신규 네트워크/DB 호출 없음
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` 게이트 277~280(C-2 목록 케이스),
    392~395(PATCH cron 케이스), 429~432(PATCH `isActive` 재활성 케이스). import 는 게이트 13.
  - 상세: `expectTriggerWorkflowRef` 자체(`codebase/backend/src/shared/testing/trigger-workflow-ref.ts`)는
    이번 diff 에 포함돼 있지 않다 — 시그니처(`(dto, { present, expectedWorkflowId })`)가 그대로다.
    추가된 것은 이미 HTTP 응답으로 받아온 `row`/`patch.body.data` 에 대한 순수 `expect` 단언뿐이라
    추가 HTTP/DB 호출을 일으키지 않는다.
  - 제안: 없음.

- **[INFO]** `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 변경은 JSDoc(주석)만 — 실제 정리 로직·부작용은 이번 diff 로 신규 도입된 것이 아님
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 게이트 148~168 (JSDoc), `afterAll`
    함수 본문(게이트 169 이하)은 diff 헝크 밖 — unchanged
  - 상세: diff 는 "고아 `secret_store` row 방치"에 대한 근거 서술을 "미검증"에서 "두 경계(세션
    간 볼륨 삭제·세션 내 접두 스코프)에서 실측"으로 승격했을 뿐, `afterAll` 이 실제로 지우는
    대상(`for (const id of createdTriggerIds) …`)에는 변경이 없다. `chat-channel-trigger-create.e2e-spec.ts`
    (게이트 76~79)도 같은 근거를 가리키는 주석 4줄만 추가됐고 자신의 `afterAll` 로직은 무편집이다.
    즉 "e2e 가 `secret_store` 에 고아 row 를 남긴다"는 부작용 자체는 이번 PR 이전부터 있던 것이고,
    회귀나 신규 위험이 아니다.
  - 제안: 없음.

- **[INFO]** `plan/**`·`review/code/2026/09/14/11_27_40/**`·`review/consistency/2026/09/14/**`(파일 7~36)는 harness 관례상의 산출물 커밋 — 런타임 부작용과 무관
  - 위치: `plan/in-progress/trigger-canary-hardening.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`,
    `review/code/2026/09/14/11_27_40/*`, `review/consistency/2026/09/14/{10_44_37,11_27_47}/*`
  - 상세: 전부 CLAUDE.md 가 지정한 저장 위치(`review/code/**`, `review/consistency/**`, `plan/in-progress/**`)
    그대로의 신규 파일 또는 체크박스 갱신이며, 코드 실행 경로에 영향을 주는 로직이 아니다. 직전
    라운드(`11_27_40`)의 WARNING#2(vacuous 삼항식)가 파일 2(`trigger-secret-columns.spec.ts` 게이트
    260~265)에서 `if (value === null) throw` 형태로 실제로 고쳐져 있음을 확인 — RESOLUTION.md 의
    서술과 코드가 일치한다.
  - 제안: 없음.

## 요약

이번 diff 는 프로덕션 서비스 코드를 전혀 수정하지 않는다. 실질 변경은 순수 읽기 전용 신규
repo-guard, 기존 export 헬퍼를 그대로 재사용하는 e2e 단언 3곳 추가, 그리고 주석/JSDoc 정리로만
구성된다. 새 전역 상태·환경 변수 읽기쓰기·네트워크 호출·함수 시그니처 변경·이벤트/콜백 변경이
전혀 없고, 유일한 파일시스템 쓰기(guard spec 의 임시 디렉터리)는 `os.tmpdir()` 격리와 `afterAll`
정리로 완전히 봉쇄돼 있다. `secret_store` 고아 row 관련 부작용은 이번 PR 이 새로 만든 것이 아니라
기존에 문서화돼 있던 것의 근거를 실측으로 보강한 것뿐이며, 직전 라운드에서 지적된 WARNING(vacuous
삼항식)도 코드상 실제로 수정돼 있음을 확인했다.

## 위험도

NONE
