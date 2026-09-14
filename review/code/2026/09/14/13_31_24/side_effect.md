# 부작용(Side Effect) 리뷰 — trigger-canary-hardening (round 6 누적)

## 검토 범위 및 방법

`git diff --stat origin/main...HEAD -- codebase/` 로 실제 코드 델타를 먼저 확정했다 — 6개 파일,
+419/-27, 전부 `codebase/backend` 테스트·devtime 가드다(프로덕션 `modules/**` 변경 0). 이번
프롬프트 번들에 포함된 나머지 74개 파일은 `plan/**`·`review/code/2026/09/14/{11_27_40,11_52_13,
12_17_14,12_37_01,13_04_49}/**`·`review/consistency/**` 산출물이며 이전 라운드들이 이미 이 코드
델타에 대해 side_effect 관점을 5회 독립 실행해 매번 **NONE** 판정했다(round 1~5 전부). 그 판정에
안주하지 않고, 실제 소스 파일을 직접 열어 재검증했다:

- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` — 전문 읽음
- `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` — 전문 읽음
- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` — diff 전문 읽음(주석뿐임을 확인)
- `codebase/backend/test/{chat-channel-trigger-create,schedule-trigger,trigger-workflow-ref}.e2e-spec.ts` — diff 전문 읽음
- `git diff origin/main...HEAD -- codebase/ | grep -n 'process\.env\|require(\|fetch(\|http\.\|axios\|child_process\|exec('` — 매치 1건은 기존 `BASE_URL` 컨텍스트 줄(변경 아님)
- `Makefile` 의 `e2e-test`/`e2e-down` 타겟 — teardown 관련 주석 주장을 인프라 코드로 직접 대조

이 리뷰는 저장소 트리를 뮤테이션하지 않았다(`Read`/`git diff`/`grep`만 사용). 종료 시
`git status --short` 확인 결과 코드 잔재 0, 이번 세션 자신의 산출물 디렉터리 2개만 untracked.

## 발견사항

- **[INFO]** 신규 repo-guard(`readStringArrayConst`/`readAllTriggerSecretColumnLists`)는 순수
  읽기 함수 — 전역 상태·환경 변수·네트워크 호출 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:46-106`
    (`readStringArrayConst`), `:109-123`(`readAllTriggerSecretColumnLists`)
  - 상세: `repoRoot`/`relPath`/`constName` 인자만 받아 `fs.readFileSync` 로 읽고 AST 파싱 결과를
    리턴한다. 대상 경로는 같은 파일 상단의 하드코딩 상수(`CANONICAL_SOURCE:13`,
    `MIRROR_SOURCES:23-26`)로만 호출되어 외부 입력이 경로에 개입하지 않는다. 파일 부재 시
    `fs.existsSync` 로 먼저 걸러 가드 자체 메시지로 throw 한다(`:54-59`) — silent failure 가
    아니라 fail-loud 이고, 이는 devtime 정적 검증 도구의 의도된 동작이다.
  - 제안: 없음(문제 없음, 확인 목적 기록).

- **[INFO]** 신규 spec 의 유일한 파일시스템 쓰기는 `os.tmpdir()` 격리 + `afterAll` 정리로
  저장소 트리 밖에 완전히 봉쇄된다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts:125-136`
    (`let tmp`, `beforeAll`/`afterAll`/`write` 헬퍼)
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-secret-columns-'))` 로 만든 격리
    디렉터리 안에서만 `fs.writeFileSync` 가 실행되고(`:134-137`), `afterAll` 이
    `fs.rmSync(tmp, { recursive: true, force: true })` 로 확실히 제거한다(`:130-132`). 병렬로
    돌고 있는 다른 리뷰어·프로세스와 경로가 겹치지 않는다(`mkdtempSync` 가 프로세스별 고유
    접미사를 보장). `tmp` 는 파일 스코프 `let` 이라 모듈 전역이 아니라 이 describe 블록에
    한정된다.
  - 제안: 없음.

- **[INFO]** e2e 3곳에 추가된 `expectTriggerWorkflowRef(...)` 호출은 기존 export 헬퍼를
  시그니처 변경 없이 재사용 — 새 HTTP/DB 호출이 아니라 이미 받아온 응답 객체에 대한 순수 단언.
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts:273-278`(C-2 목록),
    `:391-395`(G. PATCH cron), `:427-432`(H. PATCH 재활성)
  - 상세: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` 자체는 이번 diff 에
    포함되지 않았다(`git diff --stat` 로 확인, 파일 목록에 없음) — 헬퍼 구현·시그니처
    무변경. 새 `import` 한 줄(`:13`)이 세 호출 지점에서 실사용되어 미사용 임포트가 아니다.
    `row`/`patch.body.data` 는 그 직전 줄의 기존 HTTP 응답을 그대로 재사용한다.
  - 제안: 없음.

- **[INFO]** `secret_store` 고아 row 잔존(기존 부작용)의 "무해함" 근거를 실측 인프라 코드로
  교차검증 — 이번 diff 가 새로 만든 위험이 아니고, 문서화된 주장도 사실과 부합한다.
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:148-167`(JSDoc),
    `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts:76-79`(포인터 주석)
  - 상세: 두 주장을 인프라 코드에서 직접 확인했다.
    1) "세션 간 `make e2e-test` 는 항상 `e2e-down`(`docker compose down -v`)을 실행" —
       `Makefile:58-61` 이 `$(MAKE) e2e-down; exit $$STATUS` 패턴을 쓰고 `e2e-down` 타겟(`:52-53`)이
       `down -v --remove-orphans` 를 실행함을 확인. 테스트 실패로 중간에 죽어도 세미콜론
       연쇄라 `e2e-down` 이 실행된다.
    2) "세션 안에서 `secret_store` 를 읽는 유일한 e2e(`secret-store-like-prefix`)가 `ref LIKE
       <자기 접두>` 로 스코프" — `grep` 결과 `secret-store-like-prefix.e2e-spec.ts` 의 모든
       쿼리(`:62`,`:69`,`:82`,`:90`)가 `WHERE ref LIKE $1` 로 자기 접두사에 한정됨을 확인,
       다른 e2e 파일 어디에도 `secret_store` 를 직접 읽는 쿼리가 없음을 확인.
    두 주장 모두 실측과 일치한다. 이번 diff 자체는 `afterAll` 의 정리 로직(raw `DELETE FROM
    trigger`)을 변경하지 않았고(코드 diff 라인 0), 근거 서술만 갱신했다 — 새로운 부작용
    표면이 아니다.
  - 제안: 없음.

- **[INFO]** `plan/**`·`review/**` 79개 파일은 harness 관례상 산출물(리뷰·컨시스턴시
  리포트, 트래커 갱신)이며 코드 실행 경로와 무관하다.
  - 위치: `plan/in-progress/*.md`, `review/code/2026/09/14/{11_27_40,11_52_13,12_17_14,
    12_37_01,13_04_49}/**`, `review/consistency/2026/09/14/{10_44_37,11_27_47,11_52_23,...}/**`
  - 상세: 전부 `new file mode 100644`(리뷰 산출물) 혹은 체크박스/각주 갱신(트래커)이고,
    실행되는 코드가 아니다. 부작용 관점의 대상이 아니다.
  - 제안: 없음.

## 요약

이번 diff(코드 6파일, +419/-27)는 프로덕션 서비스 코드를 전혀 건드리지 않으며 (1) 순수
읽기 전용 devtime repo-guard, (2) 기존 export 헬퍼를 그대로 재사용하는 e2e 단언 3건 추가,
(3) JSDoc/주석 정리로만 구성된다. 새 전역 상태·환경 변수 읽기쓰기·네트워크 호출·함수
시그니처 변경·공개 API 변경·이벤트/콜백 변경이 전혀 없다. 유일한 파일시스템 쓰기(guard
spec 의 임시 디렉터리)는 `os.tmpdir()` 격리와 `afterAll` 정리로 완전히 봉쇄되어 있다.
문서화된 `secret_store` 고아 row 부작용은 이번 PR 이 새로 만든 것이 아니라 기존에 있던
것이고, 그 "무해함" 근거(세션 간 볼륨 삭제, 세션 내 LIKE 스코프)를 `Makefile`과 형제
e2e 파일에서 직접 대조해 사실과 일치함을 확인했다. 이전 5라운드의 side_effect 판정(NONE)과
독립적으로 재확인한 결과도 동일하다. CRITICAL/WARNING 급 발견사항 없음.

## 위험도

NONE
