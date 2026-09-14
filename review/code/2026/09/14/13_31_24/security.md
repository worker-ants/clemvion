# 보안(Security) Review — trigger-canary-hardening (2026-09-14 13:31)

## 범위 요약

`git diff --stat origin/main...HEAD -- codebase/` 로 확인한 실제 코드 diff는 6개 TS 파일,
+419/-27 이며 **프로덕션 코드(`codebase/backend/src/modules/**` 등)는 전혀 포함되지 않는다**.
전부 다음 세 범주다.

1. 신규 repo-guard(`trigger-secret-columns-guard.ts` / `trigger-secret-columns.spec.ts`) —
   트리거 응답에서 지워야 할 비밀 컬럼 목록 3중 사본의 **정적 정합성**을 AST 로 검증하는
   읽기 전용 devtime 도구.
2. 기존 e2e/스펙 파일에 단언 추가 — `expectTriggerWorkflowRef(...)` 호출로 이미 존재하는
   응답 필드를 검증(`schedule-trigger.e2e-spec.ts` 3곳).
3. JSDoc/주석 정리(`trigger-workflow-ref.spec.ts` 원문자→아라비아 숫자 통일,
   `chat-channel-trigger-create.e2e-spec.ts`·`trigger-workflow-ref.e2e-spec.ts` teardown
   근거 주석 정정) — 동작 변경 없음.

나머지(`plan/**`, `review/**`)는 계획·리뷰 산출물이며 실행 코드가 아니다. 이 변경셋은 이미
같은 세션에서 5라운드의 `/ai-review` 를 거쳤고(`review/code/2026/09/14/11_27_40` ~
`13_04_49`), 매 라운드 security 리뷰어가 독립적으로 NONE 을 판정했다. 아래는 그 다섯 판정에
더해 소스를 직접 열어 확인한 여섯 번째 독립 확인이다.

## 발견사항

- **[INFO] 신규 repo-guard 의 파일 경로 인자는 전부 하드코딩 상수 — 경로 탐색(path
  traversal) 위험 없음**
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts`
    (`readStringArrayConst`, 함수 정의 46~106행 / `CANONICAL_SOURCE` 12~13행 /
    `MIRROR_SOURCES` 23~26행 / `readAllTriggerSecretColumnLists` 109~123행)
  - 상세: `readStringArrayConst(repoRoot, relPath, constName)` 이
    `path.join(repoRoot, relPath)` 로 절대경로를 만들어 `fs.readFileSync` 로 읽는다.
    `relPath` 는 외부 입력이 아니라 같은 파일에 정의된 `CANONICAL_SOURCE`/`MIRROR_SOURCES`
    상수로만 호출된다(`readAllTriggerSecretColumnLists` 112~121행). 사용자 입력이나
    네트워크·DB 로부터 유입되는 값이 경로에 개입할 여지가 없다. 소비 spec
    (`trigger-secret-columns.spec.ts`)의 임시파일 케이스도 `fs.mkdtempSync(os.tmpdir())` 로
    만든 자체 scratch 디렉터리 안에서만 파일을 쓰고 읽어(116~225행) repo 밖 임의 경로
    접근이 아니다.
  - 제안: 조치 불필요. 향후 이 헬퍼에 호출자가 임의 문자열 경로를 넘기는 call site 가
    새로 생기면 그때 재검토.

- **[INFO] AST 기반 정적 파싱만 사용 — 코드 실행 경로 없음, 정규식 대신 AST 를 택한
  설계 근거가 타당함**
  - 위치: `trigger-secret-columns-guard.ts` (`ts.createSourceFile` + `ts.forEachChild`
    순회, 60~105행)
  - 상세: `eval`/`vm`/동적 `require` 등 코드 실행 경로가 전혀 없다. 헤더 JSDoc(29~35행)이
    밝히는 "정규식이면 주석 안 예시 문자열이 값으로 오탐된다"는 근거는 형제 가드
    (`redis-fail-open-catalog-guard.ts`)와 일관되며, 이 저장소 컨벤션(정밀 문법이 있는
    대상엔 정본 파서 사용)에 부합한다.
  - 제안: 없음.

- **[INFO] 신규 e2e 단언(`expectTriggerWorkflowRef` 3곳)은 새 네트워크/DB 호출·새 인증
  분기를 추가하지 않는다**
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` — C-2 목록 케이스(원본
    파일 기준 약 273~280행), G. PATCH cron 케이스(약 391~395행), H. PATCH 재활성
    케이스(약 427~432행)
  - 상세: `expectTriggerWorkflowRef` 자체(`codebase/backend/src/shared/testing/
    trigger-workflow-ref.ts`)는 이번 diff 에 포함되지 않아 시그니처·구현이 그대로이고,
    이미 HTTP 응답으로 받아온 `row`/`patch.body.data` 에 대한 순수 `expect` 단언만
    추가됐다. 인증 우회·권한 검증 누락과 무관하다.
  - 제안: 없음.

- **[INFO] e2e 파일의 하드코딩된 값들은 형식 검증용 더미이며 이번 diff 로 신규
  도입된 것도 아님**
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts:46-47`
    (`SLACK_SIGNING_SECRET_HEX32`, `DISCORD_PUBLIC_KEY_HEX64`) — 이번 diff 는 이 파일에서
    76~79행 근처 주석 4줄 추가만 해당하고, 이 상수들은 diff 이전부터 존재.
  - 상세: `'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'`, `'xoxb-e2e-slack-token'` 등은 hex32/hex64
    형식 검증 통과용 더미 값이며 실제 provider API 키가 아니다(외부 provider 호출은
    e2e 네트워크에서 실패하도록 설계됨). 실제 시크릿 유출로 오인하지 않도록 기록.
  - 제안: 없음.

- **[INFO] `secret_store` 고아 row 근거 정정이 테스트 인프라 범위로 명확히 한정됨 —
  프로덕션 삭제 경로(`secret-store.md §R4`)에 영향 없음**
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (`afterAll` 상단
    JSDoc, 원본 파일 기준 약 148~168행) · `codebase/backend/test/
    chat-channel-trigger-create.e2e-spec.ts:76-79`(같은 정본을 가리키는 포인터 주석)
  - 상세: `afterAll` 의 실제 정리 로직(raw `DELETE FROM trigger`)은 이번 diff 에서
    변경되지 않았다(주석만 갱신). 새로 실은 서술은 "고아 row 가 무해하다"는 근거를
    세션 간(볼륨 삭제) · 세션 안(접두 스코프) 두 축으로 실측치와 함께 제시하고, 동시에
    "이것은 테스트 인프라 한정 판단이며 프로덕션 삭제 경로(`TriggersService.remove()`
    → `deleteByPrefix`)는 §R4 대로 explicit cleanup 을 그대로 수행한다"고 스코프를
    명시적으로 가른다. 이 구분이 없으면 "정리 불필요"가 프로덕션 코드 쪽으로 잘못
    번질 위험이 있었는데, diff 는 그 경계를 정확히 긋고 있다.
  - 제안: 없음.

- **[INFO] 에러 메시지에 민감정보 노출 없음**
  - 위치: `trigger-secret-columns-guard.ts:54-58`(`readStringArrayConst` 의
    `existsSync` 방어 분기 에러 메시지)
  - 상세: 에러 메시지는 `relPath`(저장소 상대경로, 상수)와 고정 문자열만 포함한다.
    파일 내용·환경변수·스택 트레이스의 시크릿 값이 메시지에 섞여 나갈 경로가 없다.
  - 제안: 없음.

- **[INFO] 의존성 변화 없음**
  - 상세: 신규 import 는 `node:fs`, `node:path`, `node:os`, `typescript` 뿐이며 전부
    기존 저장소 devDependency/런타임 모듈이다. `package.json`/lockfile 변경 없음
    (diff 대상 파일 목록에 없음).
  - 제안: 없음.

## 요약

이번 변경셋은 프로덕션 코드 경로를 전혀 건드리지 않으며, 신규로 도입되는 외부 입력 경로·
인증/인가 분기·암호화 로직·네트워크 호출이 없다. 신규 repo-guard 는 하드코딩된 3개 파일
경로만 읽는 순수 devtime 정적 분석 도구이고, e2e 추가분은 기존에 export 되어 있던 헬퍼를
그대로 재사용하는 단언 삽입뿐이다. 시크릿 관련 서술(비밀 컬럼 목록 정합·`secret_store`
teardown 근거)은 오히려 테스트 인프라와 프로덕션 삭제 경로의 스코프를 명시적으로 갈라
문서 정확도를 높이는 방향이며 새로운 노출 경로를 만들지 않는다. 인젝션·하드코딩된 실제
시크릿·인증 우회·안전하지 않은 암호화·에러 메시지 정보 노출·의존성 취약점 어느
카테고리에서도 결함이 발견되지 않았고, 동일 변경셋에 대한 선행 5라운드 리뷰의 security
판정(전부 NONE)과 일치한다.

## 위험도

NONE
