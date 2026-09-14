# 보안(Security) Review — trigger-canary-hardening (라운드 4, `12_37_01`)

## 범위 요약

이번 세션은 `/ai-review` 3라운드 fix(`1a99f07a4`·`3f5e451b3`·`4c1a49b30`)를 거친 뒤의 재검토다.
`git diff --stat origin/main...HEAD -- codebase/` 로 확인한 실질 코드 변경은 6개 파일, +369/-23 줄이며
**프로덕션 코드(`codebase/backend/src/modules/**`)는 한 줄도 건드리지 않는다**:

1. 신규 repo-guard `trigger-secret-columns-guard.ts` + 소비 spec `trigger-secret-columns.spec.ts` —
   트리거 응답에서 지워야 할 비밀 컬럼 목록(`TRIGGER_RESPONSE_STRIP_COLUMNS`)의 3중 사본이
   값·순서까지 일치하는지 AST 로 정적 검증하는 devtime 전용 도구.
2. `trigger-workflow-ref.spec.ts` — 원문자(①②…) → 아라비아 숫자 표기 통일 + 리뷰 이력 산문 정리
   (주석/JSDoc only, 로직 무편집).
3. `chat-channel-trigger-create.e2e-spec.ts` — 주석 4줄 추가(정본 참조 안내), 로직 무편집.
4. `schedule-trigger.e2e-spec.ts` — 기존 export 헬퍼 `expectTriggerWorkflowRef` 임포트 + 3개
   `it()` 에 양성 단언 추가(목록 조회·PATCH cron·PATCH 재활성).
5. `trigger-workflow-ref.e2e-spec.ts` — `afterAll` 상단 JSDoc 을 "미검증"에서 "두 경계에서
   실측"으로 승격(주석만, `afterAll` 구현부는 `git diff` 상 무편집).

이전 3라운드(`11_27_40`·`11_52_13`·`12_17_14`)의 security reviewer 가 매 라운드 위험도 **NONE** 을
보고했고, 이번 라운드에서 실제 코드 diff 는 그 세 라운드가 이미 검토한 것과 동일하다(fix 커밋들은
가드 로직·테스트 대조군만 건드렸다). 아래는 이번 라운드에서 직접 재검증한 결과다.

## 발견사항

- **[INFO] 신규 repo-guard 는 파일 경로 인자를 전부 하드코딩 상수로만 받는다 — 경로 탐색 위험 없음**
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts` — `readStringArrayConst`(46~106행), `readAllTriggerSecretColumnLists`(109~123행). 상수 정의는 12~14행(`CANONICAL_SOURCE`/`CANONICAL_CONST`), 23~27행(`MIRROR_SOURCES`/`MIRROR_CONST`).
  - 상세: `readStringArrayConst(repoRoot, relPath, constName)` 이 `path.join(repoRoot, relPath)` 로 절대경로를 만들어 `fs.readFileSync` 로 읽는다. `relPath` 는 오직 같은 파일 상단의 `CANONICAL_SOURCE`·`MIRROR_SOURCES` 리터럴로만 호출되며(`readAllTriggerSecretColumnLists` 112~121행), 외부 입력·CLI 인자·환경변수가 개입할 여지가 없다. 소비 spec(`trigger-secret-columns.spec.ts`)의 임시파일 케이스도 `fs.mkdtempSync(os.tmpdir())` 로 만든 자체 scratch 디렉터리 안에서만 파일을 쓰고(99~104행), 임의 상위 경로 접근이 없다. Path traversal 클래스 해당 없음.
  - 제안: 조치 불필요.

- **[INFO] AST 파싱만 사용 — 코드 실행/동적 `require` 경로 없음**
  - 위치: `trigger-secret-columns-guard.ts` — `unwrap`/`visit` 함수(68~104행), `ts.createSourceFile` 호출(60~65행).
  - 상세: `ts.createSourceFile` + `ts.forEachChild` 순회만 쓰고 `eval`/`vm`/동적 `require`/`Function()` 등 임의 코드 실행 경로가 전혀 없다. 파싱 대상도 상수 3개 파일에 한정된다(위 항목). JSDoc(29~45행)이 밝히는 "정규식 대신 AST" 설계 근거(주석 안 이름이 값으로 오탐되는 것을 막음)도 타당하고, 이 저장소가 이미 채택한 `redis-fail-open-catalog-guard.ts` 패턴과 일관된다. 신규 공격 표면 없음.
  - 제안: 없음.

- **[INFO] 이 가드가 실제로 대조하는 정본/사본 세 지점의 값이 diff 기준 시점에도 일치함을 직접 확인**
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:104-107`(`TRIGGER_RESPONSE_STRIP_COLUMNS`), `codebase/backend/src/shared/testing/schedule-trigger-ref.ts:24-27`, `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:45-48`(둘 다 `TRIGGER_SECRET_COLUMNS`).
  - 상세: 세 상수 모두 `['notificationSecretV2', 'chatChannelTokenV2']` 로 값·순서가 동일함을 직접 `grep` 으로 대조했다. 즉 신규 가드가 지금 이 순간 "거짓 GREEN"을 내고 있지 않다 — 실제로 세 사본이 일치하는 상태에서 그 일치를 고정하는 정합 가드다. `trigger-workflow-ref.ts` 의 `expectTriggerWorkflowRef` 는 `present` 옵션과 무관하게 비밀 컬럼 부재 단언(113~115행)을 먼저 수행한 뒤 `present` 분기(117행~)로 들어간다 — 이번 diff 가 `schedule-trigger.e2e-spec.ts` 에 추가한 `present: true` 신규 호출 3곳이 기존 비밀 컬럼 검증을 우회하거나 약화시키지 않는다.
  - 제안: 없음.

- **[INFO] e2e 파일에 등장하는 더미 시크릿 값은 diff 범위 밖(기존 코드)이며 실제 시크릿이 아님 — 재확인**
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts:46-47`(`SLACK_SIGNING_SECRET_HEX32`, `DISCORD_PUBLIC_KEY_HEX64`), `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:136`(`botToken: '111:e2eWfRefBotToken'`).
  - 상세: `git diff --stat origin/main...HEAD -- codebase/` 로 확인한 이번 diff 는 이 두 파일에서 각각 주석 4줄(76~79행), JSDoc 갱신(148~168행 부근)만 추가했고 이 상수/리터럴 값 자체는 unchanged다. 값 형식(hex32/hex64 정규식 통과용 더미, `xoxb-e2e-slack-token`, `111:e2eTelegramBotToken` 류)도 이전 라운드가 이미 "실제 provider 키 아님"으로 확인한 패턴과 동일하다. 신규 하드코딩 시크릿 아님.
  - 제안: 없음.

- **[INFO] `secret_store` 고아 row 무해성 재서술은 프로덕션 삭제 경로와의 경계를 diff 안에서 명시적으로 유지함**
  - 위치: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` — `afterAll` 상단 JSDoc, 게이트 148~168행(unified diff 헝크 기준 151~167행이 신규/변경 텍스트).
  - 상세: 이번 diff 는 "미검증"이라고만 적혀 있던 서술을 "세션 간(볼륨 `down -v`)·세션 안(접두 스코프)" 두 경계에서 실측했다는 표로 승격시켰다. 동시에 "이것은 테스트 인프라 한정 판단이고 `secret-store.md §R4`(explicit application 경로 정리)가 규율하는 프로덕션 삭제 경로(`TriggersService.remove()` → `deleteByPrefix`)와는 무관하다"는 경계를 새로 명시했다(164~167행 부근). `afterAll` 의 실제 정리 로직(`DELETE FROM trigger`)은 이번 diff 에서 무편집이므로 새로운 부작용이나 시크릿 잔존 확대가 아니다 — 서술 정확도만 올라갔다. `chat-channel-trigger-create.e2e-spec.ts` 의 새 주석(76~79행)도 이 파일을 "정본"으로 지목해 서술 중복을 피했다.
  - 제안: 없음.

- **[INFO] `review/consistency/2026/09/14/10_44_37/cross_spec.md` 가 스스로 보고한 프롬프트 번들 절단(98%)은 이 리뷰(security)의 diff 범위 밖 harness 이슈**
  - 위치: `review/consistency/2026/09/14/10_44_37/cross_spec.md` (WARNING, "cross_spec 프롬프트 번들이 대상 corpus 의 98%를 절단").
  - 상세: 해당 파일은 별도 세션(`--impl-prep`)이 생성한 산출물이며, 그 WARNING 자체는 consistency-check 오케스트레이터의 번들 조립 로직(`.claude/skills/**`) 문제이지 이번 PR 의 `codebase/**` 코드가 만든 취약점이 아니다. 보안 관점에서 이 코드 변경 자체에 미치는 영향은 없다 — 참고 기록만 남긴다.
  - 제안: 없음(scope 밖). harness 조립 스크립트 자체의 점검은 별도 트랙.

## 검증

- `git diff --stat origin/main...HEAD -- codebase/` 로 실질 코드 변경 파일 6개·+369/-23 확정.
- `TRIGGER_RESPONSE_STRIP_COLUMNS`/`TRIGGER_SECRET_COLUMNS` 세 정의를 `grep` 으로 직접 대조 — 값·순서 일치 확인.
- `git status --short` — 이번 리뷰 세션이 만든 산출물 디렉터리 외 잔여 변경/뮤테이션 흔적 없음(저장소를 뮤테이션하지 않았음).

## 요약

이번 diff 는 프로덕션 코드 경로, 인증/인가 로직, 암호화, 네트워크 호출, 사용자 입력 처리 어느 것도
추가하지 않는다. 신규 repo-guard 는 하드코딩된 3개 상대경로만 읽는 devtime AST 정적 분석 도구로
경로 탐색·코드 실행 위험이 없고, 실제로 지금 이 순간 정본·사본 값이 일치함을 직접 확인해 "가드가
검증하는 대상"의 유효성도 확인했다. e2e 변경은 기존 export 헬퍼(`expectTriggerWorkflowRef`)를
재사용하는 양성 단언 3건 추가와 주석/JSDoc 정리뿐이며, 그 헬퍼는 `present` 옵션과 무관하게 비밀
컬럼 부재 검증을 항상 먼저 수행하므로 신규 단언이 기존 시크릿 스트립 검증을 약화시키지 않는다.
e2e 더미 시크릿 값(hex32/hex64, `xoxb-*`, `111:*`)은 이번 diff 대상이 아니며 이전 라운드가 이미
비-실제 값으로 확인한 것과 동일하다. `secret_store` 고아 row 무해성 서술은 프로덕션 삭제 경로
(`secret-store.md §R4`)와의 경계를 diff 안에서 명시적으로 갈라 확산 오독 위험을 낮췄다. 인젝션·
하드코딩된 실제 시크릿·인증 우회·안전하지 않은 암호화·에러 메시지 정보 노출·의존성 취약점 중 어느
카테고리에서도 발견사항이 없다.

## 위험도

NONE
