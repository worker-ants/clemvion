# 변경 범위(Scope) 리뷰 — 연결 테스트 결과 코드 상수화 · literal union · 테스트 빈칸 (2라운드)

## 검토 방법

이번 diff(`origin/main`/anchor `ea27c21b3` → HEAD `683023dfa`)는 1라운드 구현(`9e00740b2`·`7403fc4a6`)과
1라운드 `/ai-review` 조치(`287aa2b89`·`683023dfa`)를 모두 포함한 31개 파일 전체다. `git diff --stat
origin/main...HEAD` 로 프롬프트에 나열된 31개 파일과 실제 diff 파일 목록이 정확히 일치함을 확인했고,
프롬프트가 컨텍스트 예산으로 잘라낸 대형 파일(`integrations.service.ts`·`integrations.service.spec.ts`·
`cafe24-api.client.ts`·`makeshop-api.client.ts`)은 `git diff`로 직접 재조회해 프롬프트에 실린 hunk 와
한 글자도 다르지 않음을 대조했다. 추가로 2라운드에 새로 얹힌 세 커밋(`287aa2b89`·`7403fc4a6`·`683023dfa`)을
`git show --stat` 로 개별 확인해 각 커밋이 스스로 밝힌 목적 범위(1라운드 리뷰 WARNING 조치, lint 1줄, 리뷰
산출물 저장)를 벗어나지 않음을 검증했다. 저장소 파일은 뮤테이션하지 않았다(`git status --short` 로 세션 시작
스냅샷과 diff 만 확인).

## 발견사항

- **[INFO]** 2라운드가 추가한 테스트(MakeShop `pingConnection` 3분기, 타입 계약 `accepted` 배열의
  `INTEGRATION_CREDENTIALS_UNREADABLE`, `integrations.service.spec.ts` 의 복호화 불가 게이트 테스트)는
  plan 원문의 "할 것" 3항목에는 없던 추가 테스트다.
  - 위치: `codebase/backend/src/nodes/integration/makeshop/makeshop-api.client.spec.ts` (신규
    `describe('pingConnection (test-connection probe)')` 블록), `codebase/backend/src/modules/integrations/connection-test-codes.spec.ts`
    (`accepted` 배열에 `INTEGRATION_CREDENTIALS_UNREADABLE` 원소 추가), `codebase/backend/src/modules/integrations/integrations.service.spec.ts`
    (신규 `it('자격증명을 복호화하지 못하면 테스터를 부르지 않고 INTEGRATION_CREDENTIALS_UNREADABLE', ...)`)
  - 상세: 범위 이탈처럼 보이지만, 커밋 `287aa2b89`("MakeShop pingConnection 세 실패 코드 · 복호화 불가
    게이트 — 리뷰 1라운드 조치")와 `review/code/2026/09/19/23_34_45/RESOLUTION.md` 의 W1·W2 항목이 이
    추가를 정확히 지시하고 있고, 실제 diff 내용도 그 지시와 1:1 대응한다(RESOLUTION 표의 대상 파일·조치
    내용이 실제 변경분과 일치). 즉 "의도되지 않은 확장"이 아니라 CLAUDE.md 가 강제하는 "구현 완료 후
    `/ai-review` + WARNING fix" 표준 루프의 정상 산출물이다.
  - 제안: 조치 불필요.

- **[INFO]** 리뷰 산출물 디렉터리(`review/code/2026/09/19/23_34_45/**`, `review/consistency/2026/09/19/23_02_33/**`)
  19개 파일이 diff 에 포함됨.
  - 위치: 위 두 디렉터리 전체(파일 13~31)
  - 상세: 코드 변경이 아니라 `--impl-prep` consistency-check 산출물과 1라운드 `/ai-review` 산출물(SUMMARY·
    RESOLUTION·개별 reviewer 리포트·meta.json·`_retry_state.json`)이다. CLAUDE.md "정보 저장 위치" 표가
    `review/code/**`·`review/consistency/**` 를 코드 리뷰어/일관성 검토자의 정식 산출물 위치로 지정하고,
    memory 교훈("`review/` 는 gitignored 아님 — 체크와 `complete/` 이동은 한 동작")도 이 파일들이 커밋
    대상임을 뒷받침한다. 1라운드 scope reviewer(`review/code/2026/09/19/23_34_45/scope.md`)가 이미 같은
    결론(NONE)에 도달했고, 이번 재확인에서도 다른 결론에 이를 근거가 없다.
  - 제안: 조치 불필요.

- **[INFO]** `7403fc4a6`(lint 를 위한 `@ts-expect-error` 설명 길이 조정)은 `connection-test-codes.spec.ts`
  단일 파일 1줄만 건드린다 — `git show --stat` 으로 확인. 스코프 내.

- **[INFO]** 핵심 리팩터 파일 8개(`connection-test-codes.ts` 신설 포함)는 plan `할 것` 3항목(① 상수·union
  신설 ② Cafe24·MakeShop ping 코드 타입 좁히기 ③ 테스트 빈칸 3건)과 정확히 1:1 대응하고, 리터럴 문자열 →
  상수 참조 치환은 값 자체가 동일함을 좌우 대조로 확인했다(예: `'DB_HOST_BLOCKED'` ↔
  `CONNECTION_TEST_CODES.DB_HOST_BLOCKED === 'DB_HOST_BLOCKED'`). 동작 변경 없는 순수 리팩터.

- **[INFO]** `integrations.service.ts` 의 `IntegrationTestResult.code` 필드 JSDoc 코멘트 변경(`e.g. MCP_* · ...`
  → `{@link IntegrationTestResultCode}` 참조)은 그 필드 타입을 `string` → `IntegrationTestResultCode` 로
  좁히는 이번 작업의 직접 결과다. 코멘트만 따로 손댄 drive-by 변경이 아니라 타입 변경에 종속된 필연적 갱신.

- **[INFO]** blank-line 성격의 diff 라인(신규 `it`/`describe` 블록 사이 공백 26줄)은 새 테스트 코드 자체에
  속한 구조적 개행이며, 기존 코드의 무관한 재포맷팅이 섞여 들어간 흔적은 없다(`grep` 으로 순수 공백-only
  변경 라인만 추출해 확인 — 전부 신규 추가 블록 내부).

## 스코프 대조 결과

| 파일 | 스코프 근거 |
|---|---|
| `connection-test-codes.ts`/`.spec.ts`(신규) | plan ① |
| `database-connection-tester.ts`/`http-connection-tester.ts`/`integrations.service.ts` | 리터럴→상수 치환, plan ① (동작 불변, 값 대조 완료) |
| `database-connection-tester.spec.ts`(SSL it.each) | plan ③-1 (테스트 빈칸 mysql SSL 매핑) |
| `database-driver-sockets.spec.ts`(try/finally) | plan ③-2 (테스트 빈칸 소켓 정리) |
| `integrations.service.spec.ts`(rotate 404 + credentials-unreadable) | rotate 404 = plan ③-3, credentials-unreadable = RESOLUTION W2 |
| `cafe24-api.client.ts`/`makeshop-api.client.ts`(PingCode 타입) | plan ② |
| `makeshop-api.client.spec.ts`(pingConnection 3분기) | RESOLUTION W1 |
| `plan/in-progress/connection-test-codes-and-gaps.md` | developer 표준 산출물 |
| `review/code/23_34_45/**`, `review/consistency/23_02_33/**` | developer 표준 리뷰/컨시스턴시 산출물 저장 위치 |

임포트 변경(모두 신규 상수·타입 사용에 종속), 설정 파일 변경(없음), 불필요한 주석 변경(타입 변경에 종속된
1건만), 무관한 파일·영역 수정 — 전부 해당 없음. 새로 발견한 CRITICAL/WARNING 급 범위 이탈 없음.

## 요약

31개 파일 diff 전체(1라운드 구현 + 2라운드 리뷰 조치 + 양 라운드의 리뷰/컨시스턴시 산출물)를 plan
`connection-test-codes-and-gaps.md` 의 "할 것" 목록 및 1라운드 `RESOLUTION.md` 의 조치 항목과 대조한 결과,
모든 변경이 선언된 범위 안에 있다. 2라운드에서 추가된 테스트들은 새 기능 확장이 아니라 1라운드
`/ai-review` WARNING 에 대한 문서화된 조치이며, 리뷰/컨시스턴시 산출물 파일들은 CLAUDE.md 가 지정한 정식
저장 위치에 놓인 표준 워크플로 부산물이다. 범위 이탈, 불필요한 리팩토링, 요청 밖 기능 확장, 무관한 파일
수정, 포맷팅 뒤섞임, 불필요한 주석/임포트 변경, 의도하지 않은 설정 변경 중 어느 것도 발견되지 않았다.

## 위험도

NONE
