# 보안(Security) Review — trigger-canary-hardening

## 범위 요약

실질 코드 diff(`git diff origin/main...HEAD --stat -- codebase/`)는 6개 파일, +357/-23 로 전부
**backend 테스트·devtime 정적 가드**에 국한된다. 프로덕션 코드(`codebase/backend/src/modules/**` 등
런타임 서비스 로직)는 전혀 건드리지 않는다.

1. 신규 repo-guard `trigger-secret-columns-guard.ts` / 그 소비 spec `trigger-secret-columns.spec.ts`
   — 트리거 응답에서 지워야 할 **비밀 컬럼 목록**이 세 파일(정본 1 + 사본 2)에 중복 정의된 것의
   정합성을 TypeScript AST 로 정적 검증하는 순수 읽기 devtime 도구.
2. `trigger-workflow-ref.spec.ts` — 원문자(①②③…) → 아라비아 숫자 표기 통일 + 리뷰 이력 서술 정리
   (JSDoc/주석만, 테스트 로직 무변경).
3. `schedule-trigger.e2e-spec.ts` — 기존 export 헬퍼 `expectTriggerWorkflowRef(...)` 호출 3곳 추가
   (목록 C-2, PATCH G·H) — 이미 존재하는 응답 필드에 대한 양성 단언 확장.
4. `chat-channel-trigger-create.e2e-spec.ts` / `trigger-workflow-ref.e2e-spec.ts` — `secret_store`
   고아 row 무해성 근거를 "미검증"에서 "두 경계에서 실측"으로 승격하는 JSDoc 정정. `afterAll` 실제
   teardown 로직은 diff 밖(unchanged).

새로 도입되는 외부 입력 경로, 인증/인가 분기, 암호화 로직, 네트워크 호출, API 표면 변경이 없다.
이 배치는 동일 PR 의 3번째 `/ai-review` 라운드이며, 앞선 두 라운드(`review/code/2026/09/14/11_27_40`,
`11_52_13`)의 security 관점 판정도 모두 NONE 이었다. 소스 파일을 직접 `Read` 로 열어 diff 내용과
최종 상태가 일치함을 확인했다.

## 발견사항

- **[INFO] 신규 repo-guard 의 파일 경로 인자는 하드코딩 상수로만 호출되어 경로 탐색 위험이 없다**
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` —
    `readStringArrayConst` (게이트 46~106) · `readAllTriggerSecretColumnLists` (게이트 108~123)
  - 상세: `readStringArrayConst(repoRoot, relPath, constName)` 이 `path.join(repoRoot, relPath)` 로
    절대경로를 만들고 `fs.readFileSync` 로 읽는다. `relPath` 는 외부 입력이 아니라 같은 파일에
    선언된 `CANONICAL_SOURCE`(게이트 12~13)와 `MIRROR_SOURCES`(게이트 23~26) 상수로만 호출된다
    (게이트 113~120). 소비 spec(`trigger-secret-columns.spec.ts`)의 대조군 케이스도
    `fs.mkdtempSync(os.tmpdir())` 로 만든 자체 scratch 디렉터리 안에서만 파일을 쓰고 읽어
    (`beforeAll`/`afterAll`/`write` 헬퍼) 저장소 밖 임의 경로 접근이 없다. 경로 탐색(path
    traversal) 클래스에 해당하지 않는다.
  - 제안: 조치 불필요. 향후 호출자가 임의 문자열(사용자 입력·CLI 인자 등)을 이 함수에 넘기는 새
    call site 가 생기면 그때 입력 검증 재검토.

- **[INFO] AST 파싱은 코드 실행이 아니다 — 정규식 대신 AST 를 선택한 설계 근거가 타당하고 오탐
  방지 목적에도 부합한다**
  - 위치: `trigger-secret-columns-guard.ts` (JSDoc 게이트 29~45, 구현 게이트 60~106)
  - 상세: `ts.createSourceFile` + `ts.forEachChild` 순회만 사용하고 `eval`/`vm`/동적 `require` 등
    코드 실행 경로가 없다. JSDoc 이 밝히는 "정규식이면 주석 산문 속 컬럼명(`notification_secret_v2`
    등)이 값으로 오탐돼 가드가 자기 오판을 사실로 굳힌다"는 근거는 형제 가드
    `redis-fail-open-catalog-guard.ts` 와 일관된 설계다. 보안 결함 아님.
  - 제안: 없음.

- **[INFO] 비밀 컬럼명 문자열(`notificationSecretV2`/`chatChannelTokenV2`)은 컬럼 식별자일 뿐
  실제 시크릿 값이 아니다 — 하드코딩된 시크릿으로 오인 방지**
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` (게이트
    115, 250 부근), `chat-channel-trigger-create.e2e-spec.ts` 신규 주석(게이트 76~79)
  - 상세: diff 전체를 `password|api[_-]?key|secret|token|BEGIN (RSA|PRIVATE)` 패턴으로 스캔한 결과,
    매치되는 것은 전부 (a) 컬럼/상수/테이블 이름(`TRIGGER_SECRET_COLUMNS`, `secret_store`,
    `notificationSecretV2`), (b) 산문 설명(`secret-store.md §R4` 인용, "고아 row" 서술)뿐이며 실제
    API 키·비밀번호·인증서 리터럴은 없다. `chat-channel-trigger-create.e2e-spec.ts` 에 존재하는
    더미 hex 값들(`SLACK_SIGNING_SECRET_HEX32` 등)은 이번 diff 범위 밖(주석 4줄 추가뿐)이고 형식
    검증용 fake 값으로 기존에 이미 있던 것이다.
  - 제안: 없음.

- **[INFO] `secret_store` 고아 row 무해성 근거 정정은 프로덕션 삭제 경로(`secret-store.md §R4`)와
  스코프를 명확히 분리해 확산 위험을 스스로 차단한다**
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` — `afterAll` 상단 JSDoc
    (게이트 148~168 부근)
  - 상세: e2e teardown 이 raw `DELETE FROM trigger` 로 `secret_store` row 를 정리하지 못하는 것을
    "무해하다"고 결론짓는 근거(세션 간 볼륨 삭제, 세션 내 접두 스코프)가 **테스트 인프라 한정**임을
    명시하고, 실제 프로덕션 삭제 경로(`TriggersService.remove()` → `deleteByPrefix`)는
    `secret-store.md §R4`(explicit application-level cleanup, cascade 미채택)를 그대로 따른다고
    별도로 적었다. 이 구분이 없었다면 "정리 안 해도 된다"가 프로덕션 코드 쪽으로 오인 확산될 위험이
    있었는데, diff 는 그 경계를 정확히 긋는다. `afterAll` 의 실제 정리 로직 자체는 diff 밖(unchanged)
    이라 회귀나 신규 위험이 아니다.
  - 제안: 없음. (참고: `secret-store.md §R4` 원문의 메서드명 표기(`delete()` vs 실제 `remove()`)
    오기는 이 diff 이전부터 spec 문서에 있던 것으로 앞선 라운드 checker 가 이미 planner 백로그로
    등재했다 — 이 diff 코드의 결함이 아니다.)

- **[INFO] e2e 신규 단언은 기존 export 헬퍼 재사용 — 새 인증/인가 로직·시그니처 변경 없음**
  - 위치: `codebase/backend/test/schedule-trigger.e2e-spec.ts` (게이트 277~280, 392~395, 429~432)
  - 상세: `expectTriggerWorkflowRef(dto, { present, expectedWorkflowId })` 는 이번 diff 에 포함되지
    않은 기존 export(`shared/testing/trigger-workflow-ref.ts`)를 그대로 호출하며, 추가된 것은 이미
    HTTP 응답으로 받아온 `row`/`patch.body.data` 에 대한 순수 `expect` 단언뿐이다. 인증 우회·권한
    검증 누락과 무관하다.
  - 제안: 없음.

## 검증

- 신규 가드/spec 소스를 diff 가 아니라 워킹트리에서 직접 `Read` 로 열어 최종 상태(라운드 2 수정
  반영분: `if (value === null) throw` 분기, `fs.existsSync` 방어, 메시지 기반 `.toThrow()`)와 diff
  서술이 일치함을 확인했다.
- `git diff origin/main...HEAD -- codebase/` 전체를 시크릿 관련 키워드로 스캔해 실제 자격증명
  리터럴이 없음을 확인했다(위 세 번째 발견사항).

## 요약

이번 변경(3번째 `/ai-review` 라운드 시점 diff, 6개 코드 파일)은 프로덕션 서비스 코드·인증/인가
로직·암호화·네트워크 호출·사용자 입력 처리 어느 것도 추가하지 않는다. 신규 repo-guard 는 세
파일 안에 하드코딩된 경로 상수만 읽는 순수 읽기 전용 정적 분석 도구이고, TypeScript AST 파싱만
사용해 코드 실행 경로가 없다. e2e 변경은 기존 export 헬퍼를 재사용하는 양성 단언 추가와 JSDoc/주석
정정뿐이며, 비밀 컬럼 strip·`secret_store` teardown 근거에 대한 서술은 오히려 프로덕션/테스트
스코프를 명확히 갈라 문서 정확도를 높이는 방향이라 새로운 노출 경로를 만들지 않는다. 인젝션·
하드코딩된 실제 시크릿·인증 우회·안전하지 않은 암호화·에러 메시지 정보 노출·의존성 취약점 중
어느 카테고리에서도 Critical/Warning 급 발견사항이 없다.

## 위험도

NONE
