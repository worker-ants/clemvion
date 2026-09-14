# 부작용(Side Effect) 리뷰

## 범위 요약

실질 코드 변경은 6개 파일뿐이다(`git diff origin/main...HEAD --stat -- codebase/` 로 확인, +369/-23):
신규 repo-guard(`trigger-secret-columns-guard.ts`)와 그 소비 spec(`trigger-secret-columns.spec.ts`),
`trigger-workflow-ref.spec.ts` 의 주석 표기 통일(원문자→아라비아 숫자), 그리고
`chat-channel-trigger-create.e2e-spec.ts`·`schedule-trigger.e2e-spec.ts`·
`trigger-workflow-ref.e2e-spec.ts` 세 e2e 파일의 주석 정정 + 기존 export 헬퍼(`expectTriggerWorkflowRef`)
호출 3곳 추가다. 나머지 파일(`plan/**`, `review/code/2026/09/14/{11_27_40,11_52_13,12_17_14}/**`,
`review/consistency/2026/09/14/10_44_37/**`)은 이전 라운드(1~3)의 리뷰·컨시스턴시 산출물과 plan
트래커 갱신이며 런타임 부작용과 무관하다. 이 배치는 `4c1a49b30`(라운드1 fix)·`3f5e451b3`(라운드2
fix)·`1a99f07a4`(라운드3 fix) 세 커밋이 누적된 상태로, 세 라운드 모두 이전 side_effect 리뷰
(`11_27_40`·`11_52_13`·`12_17_14`)에서 이미 독립적으로 NONE 판정을 받았다. 이번 라운드에서 그 세
커밋의 누적 diff를 재확인하고, 라운드 간 fix가 새 부작용을 들여오지 않았는지를 중점으로 봤다.

## 발견사항

- **[INFO]** 신규 guard `readStringArrayConst`/`readAllTriggerSecretColumnLists` 는 `fs.readFileSync`
  만 쓰는 순수 읽기 함수 — 전역 상태·모듈 레벨 mutable state 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` 함수
    `readStringArrayConst`(46~106행), `readAllTriggerSecretColumnLists`(109~123행).
  - 상세: `found`(67행)는 `readStringArrayConst` 호출마다 새로 선언되는 함수-스코프 지역
    변수이고, 모듈 레벨에는 `CANONICAL_SOURCE`/`CANONICAL_CONST`/`MIRROR_SOURCES`/`MIRROR_CONST`
    4개의 `export const`(불변 리터럴)만 있어 공유 가변 상태가 아니다. 대상 경로는 하드코딩된
    상수로만 호출되고(94~106행), `abs`(51행)를 만드는 데 쓰는 `repoRoot` 도 spec 쪽에서
    `path.resolve(__dirname, ...)` 로 실제 저장소 루트만 넘긴다 — 임의 쓰기·경로 탐색 여지 없음.
    파일이 없으면 `existsSync` 방어(54~59행)로 진단 메시지를 낸 뒤 `throw` 하는데, 이는 라운드
    2에서 회귀 테스트까지 묶인 의도된 fail-loud 동작이라 부작용으로 분류하지 않는다.
  - 제안: 없음(문제 없음, 확인 목적 기록).

- **[INFO]** 신규 spec 의 임시 파일 I/O 는 `os.tmpdir()` 격리 디렉터리 안에만 쓰고 `afterAll` 에서
  회수 — 저장소 트리 밖.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts:99-104`
    (`beforeAll`/`afterAll`), `write()` 헬퍼(106~109행).
  - 상세: `beforeAll` 에서 `fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-secret-columns-'))` 로
    격리된 디렉터리를 만들고, `afterAll` 에서 `fs.rmSync(tmp, { recursive: true, force: true })` 로
    확실히 제거한다. `write()` 헬퍼도 `path.join(tmp, name)` 으로만 쓰기 때문에 저장소 트리 안에
    잔여물을 남기지 않고, 병렬로 실행 중인 다른 세션/reviewer 의 워킹트리와도 경로가 겹치지 않는다.
  - 제안: 없음.

- **[INFO]** 신규 e2e 단언(`expectTriggerWorkflowRef` 호출 3곳)은 기존에 export 되어 있던 헬퍼를
  시그니처 변경 없이 재사용 — 새 네트워크/DB 호출 없음.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — C-2 목록 케이스(277~280행),
    G 케이스(392~395행), H 케이스(429~432행).
  - 상세: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` 자체는 이번 diff 에
    포함되지 않았다(`git diff --stat` 로 확인). `expectTriggerWorkflowRef(dto, { present,
    expectedWorkflowId })` 시그니처도 그대로이며, 새로 추가된 것은 이미 응답으로 받아온
    `row`/`patch.body.data` 에 대한 순수 `expect` 단언뿐이라 추가 HTTP/DB 호출이 없다. 각 `it()`
    안에서 이 신규 단언이 던지면 그 뒤에 이어지는 `db.query('SELECT is_active FROM schedule …')`
    검증(G: 397~401행, H: 434~438행)은 건너뛰지만, 이는 Jest 의 통상적 fail-fast 순서일 뿐이고
    이 파일은 애초에 생성한 schedule/trigger row 를 테스트별로 명시 정리하지 않는 기존 관례라
    (`afterAll` 은 `db.end()` 뿐, 55~57행) 이번 삽입이 새로운 자원 누수 경로를 만들지 않는다.
  - 제안: 없음.

- **[INFO]** `trigger-workflow-ref.e2e-spec.ts` 의 `afterAll` 관련 변경은 **주석(rationale)만
  갱신**되었고 실제 정리 로직(raw `DELETE FROM trigger`, `secret_store` 고아 row 방치)은 동일 —
  새 부작용이 아니라 기존에 이미 문서화된 부작용의 근거를 실측 표로 교체한 것.
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` JSDoc(148~168행 부근),
    `afterAll` 본문(169행~)은 diff 대상 밖.
  - 상세: `git diff origin/main...HEAD` 로 `afterAll` 구현부에 diff 라인이 없음을 확인했다.
    자매 파일 `chat-channel-trigger-create.e2e-spec.ts` 에도 정본을 가리키는 주석 4줄만
    추가됐고(`76~79행`) `afterAll` 로직 자체(81행~)는 그대로다. "e2e 테스트가 `secret_store` 에
    고아 row 를 남긴다"는 부작용은 이번 배치 이전부터 있었고, 이번 배치는 그 무해성 근거(세션
    간 볼륨 삭제, 세션 내 `LIKE` 접두 스코프)를 표로 정리했을 뿐이다. 회귀나 신규 위험이 아니다.
  - 제안: 없음.

- **[INFO]** `review/code/2026/09/14/{11_27_40,11_52_13,12_17_14}/**`·
  `review/consistency/2026/09/14/10_44_37/**`·`plan/in-progress/*.md` 는 harness 관례상 정상적인
  신규 산출물(리뷰/컨시스턴시 리포트, 작업 트래커)이며 런타임 부작용과 무관.
  - 위치: 위 각 디렉터리.
  - 상세: 전부 `new file mode 100644` 로 생성되거나 체크박스/각주만 갱신된 마크다운/JSON이며,
    코드 실행 경로에 영향을 주지 않는다. CLAUDE.md 가 지정한 저장 위치(`review/code/**`,
    `review/consistency/**`, `plan/in-progress/**`) 규약과도 일치한다.
  - 제안: 없음.

## 요약

이번 누적 diff(라운드 1~3 fix 포함)는 프로덕션 서비스 코드(`codebase/backend/src/modules/**`)를
전혀 수정하지 않는다. 신규 코드는 (1) 하드코딩된 3개 상대경로만 읽는 순수 읽기 전용 repo-guard,
(2) `os.tmpdir()` 격리 + `afterAll` 회수로 완전히 봉쇄된 임시 파일 I/O, (3) 이미 존재하는 export
헬퍼를 시그니처 변경 없이 재사용하는 e2e 단언 3곳, (4) 주석/JSDoc/plan 문서 갱신으로만 구성된다.
새 전역 변수·모듈 레벨 mutable state·환경 변수 읽기쓰기·네트워크 호출·기존 함수/공개 API
시그니처 변경·이벤트/콜백 변경은 관측되지 않았다. `secret_store` 고아 row 관련 부작용은 이번
배치가 새로 만든 것이 아니라 기존에 문서화되어 있던 것의 근거를 실측으로 보강한 것이며, 그 근거가
"테스트 인프라 한정"임을 `secret-store.md §R4`(프로덕션 삭제 경로) 와 명시적으로 갈라 적어 확산
오독 위험도 스스로 차단했다. 라운드 1~3에서 각각 독립적으로 NONE 판정된 side_effect 리뷰 결과와
이번 재확인이 일치한다.

## 위험도

NONE
