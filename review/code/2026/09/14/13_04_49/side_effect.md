# 부작용(Side Effect) 리뷰

## 범위 요약

`origin/main...HEAD` 기준 코드 diff는 6개 파일(+401/-23)이다 — 신규 repo-guard
(`trigger-secret-columns-guard.ts`) + 그 소비 spec(`trigger-secret-columns.spec.ts`), 기존
`trigger-workflow-ref.spec.ts`의 표기(원문자→아라비아 숫자) 정리, 그리고
`chat-channel-trigger-create.e2e-spec.ts`·`schedule-trigger.e2e-spec.ts`·
`trigger-workflow-ref.e2e-spec.ts` 세 e2e 파일의 주석 정정 + 기존 헬퍼(`expectTriggerWorkflowRef`)
호출 3곳 추가다. 이 branch(`origin/main..HEAD`)는 5개 커밋(`efb0e4b36` 캐너리 하드닝 +
`4c1a49b30`/`3f5e451b3`/`1a99f07a4`/`026fbb610` 라운드 1~4 fix)으로 구성되며, 이번(라운드 5)
리뷰 대상은 그 누적 diff다. 나머지 파일(`plan/**`, `review/code/2026/09/14/{11_27_40,11_52_13,
12_17_14,12_37_01}/**`, `review/consistency/2026/09/14/10_44_37/**`)은 이전 라운드의 리뷰/트래커
산출물이라 런타임 부작용과 무관하다. 프로덕션 코드(`codebase/backend/src/modules/**`)는 전혀
건드리지 않는다 — `git diff --stat` 로 확인.

실제 파일 내용을 직접 열어 diff와 대조 확인했다(`trigger-secret-columns-guard.ts`,
`trigger-secret-columns.spec.ts` 전문 + 세 e2e 파일 diff). `expectTriggerWorkflowRef` 자체
(`codebase/backend/src/shared/testing/trigger-workflow-ref.ts`)는 이번 diff에 포함되지 않았음을
`git diff origin/main...HEAD -- .../trigger-workflow-ref.ts` (빈 출력)으로 확인했다 — 시그니처
변경 없음.

## 발견사항

- **[INFO]** 신규 guard `readStringArrayConst`/`readAllTriggerSecretColumnLists`는 하드코딩된
  3개 상수 경로(`CANONICAL_SOURCE`, `MIRROR_SOURCES`)만 `fs.readFileSync`/`fs.existsSync`로
  읽는 순수 함수 — 전역 상태·파일시스템 쓰기 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` 함수
    `readStringArrayConst`(46~106행), `readAllTriggerSecretColumnLists`(109~123행)
  - 상세: `repoRoot`/`relPath`/`constName` 인자만으로 AST를 파싱해 값을 리턴하고, 모듈 스코프의
    `found` 변수도 함수 호출마다 새로 선언되는 지역 변수(`let found: string[] | null = null;`,
    67행)라 호출 간 상태 누수가 없다. 대상 파일이 없으면 가드 자체 메시지로 `throw`하는데
    (54~59행), 이는 devtime 가드의 의도된 fail-loud이지 부작용이 아니다.
  - 제안: 없음(문제 없음, 확인 목적 기록).

- **[INFO]** 신규 spec의 임시 파일 I/O는 `os.tmpdir()` 격리 디렉터리 안에서만 일어나고
  `afterAll`에서 제거된다 — 저장소 트리를 벗어나지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts`
    `beforeAll`(119~121행)/`afterAll`(122~124행), `write` 헬퍼(126~129행)
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-secret-columns-'))`로 매 실행마다
    고유 접미사를 가진 디렉터리를 만들고(경쟁·충돌 없음), 그 안의 fixture 파일(`commented.ts`,
    `satisfies.ts`, `parens.ts` 등)만 `fs.writeFileSync`로 생성한다. `afterAll`이
    `fs.rmSync(tmp, { recursive: true, force: true })`로 정리한다. 다만 `beforeAll`이
    `mkdtempSync` 단계에서 예외를 던지면(예: OS 임시 디렉터리 접근 불가) `tmp`가 미할당 상태로
    `afterAll`의 `fs.rmSync(tmp, ...)`이 `undefined`를 받아 별도 예외를 낼 수 있다 — 극히
    이례적인 환경 실패 경로이고 실질 부작용(잔여 파일)을 만들지는 않는다(할당 전이므로 애초에
    아무것도 안 만들어짐).
  - 제안: 조치 불필요(엣지 케이스가 실제 side effect로 이어지지 않음). 신경 쓰인다면
    `tmp: string | undefined`로 선언하고 `afterAll`에서 `if (tmp) fs.rmSync(...)` 가드만
    추가하면 완전해진다.

- **[INFO]** 신규 e2e 단언(`expectTriggerWorkflowRef` 호출 3곳)은 기존 export된 헬퍼를 시그니처
  변경 없이 재사용 — 새 HTTP/DB 호출을 추가하지 않는다.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — C-2 목록 케이스, `it('G. ...')`
    (PATCH cron), `it('H. ...')`(PATCH 재활성) 세 곳
  - 상세: 세 호출 모두 이미 응답으로 받아온 `row`/`patch.body.data`에 대한 순수 `expect`
    단언이다. `expectTriggerWorkflowRef` 정의 파일 자체(`trigger-workflow-ref.ts`)는 이번
    diff에 포함되지 않았음을 `git diff` 로 재확인했다 — 호출부만 늘었고 헬퍼의 동작·시그니처는
    그대로다.
  - 제안: 없음.

- **[INFO]** `trigger-workflow-ref.e2e-spec.ts`의 `afterAll` 관련 변경은 JSDoc(근거 서술)만
  갱신됐고 실제 정리 로직(`for (const id of createdTriggerIds) { await db... }`)은 diff에
  포함되지 않는다 — 새로운 부작용이 도입된 것이 아니라 기존에 문서화되어 있던 부작용("`secret_store`
  고아 row")의 무해성 근거를 실측표로 교체한 것.
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` JSDoc(diff 헝크 기준
    148~168행 부근), `afterAll` 함수 본문은 이 diff에서 unchanged
  - 상세: 자매 파일 `chat-channel-trigger-create.e2e-spec.ts`에도 정본을 가리키는 주석 4줄만
    추가됐고 `afterAll` 로직 자체는 변경이 없다. "고아 row가 남는다"는 부작용은 이번 커밋 이전부터
    존재했고, 이번 변경은 그 무해성 근거(세션 간 `docker compose down -v`로 볼륨째 삭제, 세션 내
    `ref LIKE <접두>` 스코프)를 표로 정리해 실었을 뿐이다.
  - 제안: 없음.

- **[INFO]** 신규 export 상수(`CANONICAL_SOURCE`, `CANONICAL_CONST`, `MIRROR_SOURCES`,
  `MIRROR_CONST`, `readStringArrayConst`, `readAllTriggerSecretColumnLists`)는 `__tests__/`
  폴더 안에서 형제 spec 파일 하나만 소비하는 devtime 전용 함수라, 공개 API 표면 확장으로 보지
  않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` 12~27행
    (export 상수), 46행/109행(export 함수)
  - 상세: `grep`으로 확인한 결과 이 export들을 import하는 곳은
    `trigger-secret-columns.spec.ts` 한 곳뿐이다. 프로덕션 런타임 경로·다른 모듈에 영향을 주는
    공개 인터페이스가 아니다.
  - 제안: 없음.

- **[INFO]** 환경 변수·네트워크 호출 신규 도입 없음.
  - 위치: 변경된 6개 파일 전체
  - 상세: `process.env` 참조는 `schedule-trigger.e2e-spec.ts`의 기존 `BASE_URL = process.env.E2E_BASE_URL ?? ...`(diff에 포함되지 않은 기존 줄) 외에 신규 추가가 없다. `chat-channel-trigger-create.e2e-spec.ts`에 추가된 것은 주석 4줄뿐이라 SLACK/DISCORD 관련 fake secret 값·provider 호출 경로는 이번 diff로 인한 변경이 아니다.
  - 제안: 없음.

## 요약

이번 diff(6개 파일, +401/-23)는 프로덕션 서비스 코드를 전혀 수정하지 않고 (1) 하드코딩된
경로만 읽는 순수 읽기 전용 신규 repo-guard, (2) `os.tmpdir()` 격리 + `afterAll` 정리로 저장소
트리 밖에 완전히 봉쇄된 스펙의 임시 파일 I/O, (3) 기존 export 헬퍼(`expectTriggerWorkflowRef`,
시그니처 무변경)를 재사용하는 e2e 단언 3곳 추가, (4) 주석/JSDoc 갱신으로만 구성된다. 전역
상태·환경 변수 읽기쓰기·네트워크 호출·기존 함수 시그니처 변경·공개 인터페이스 확장·이벤트/콜백
변경이 관측되지 않았다. `secret_store` 고아 row 관련 기존 부작용은 이번 diff가 새로 만든 것이
아니라 그 무해성 근거를 실측표로 보강한 것뿐이며, 실제 정리 로직(`afterAll` 본문)은 diff에
포함되지 않았다. 저장소 트리는 리뷰 시작·종료 시점 모두 clean 하다(`git status --short` 확인,
untracked 는 이번 리뷰 세션 자신의 산출물 디렉터리뿐).

## 위험도

NONE
