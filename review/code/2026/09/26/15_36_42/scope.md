# 변경 범위(Scope) 리뷰 — forbidden-helper-sentences

## 검토 방법

`plan/in-progress/forbidden-helper-sentences.md` 의 "방향"·"안 하는 것"·"실측" 표를 기준선으로 삼고,
19개 변경 파일 전체 diff 를 그 기준선과 대조했다. `git diff --stat`(19 files, +563/-20)로 프롬프트에
누락된 파일이 없는지도 대조 확인했고, `auth.controller.ts`·`executions.controller.ts` 에서 제거된
import(`NOT_A_MEMBER`·`ROLE_REQUIRED`)가 실제로 파일 내 다른 곳에서 쓰이지 않는지 `grep` 으로 직접
확인했다(둘 다 정확히 사용처 없음/`NOT_A_MEMBER` 는 auth.controller.ts 432행에 여전히 쓰여 import 유지가 맞음).

## 발견사항

- **[INFO]** `reRun`·`getChain` 두 곳의 서비스 문장이 "이음(joiner)" 이상으로 표기 자체도 바뀜 — plan 이 자체적으로 disclose 했지만 경계가 살짝 넓다
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:281-284`, `:313-316`
  - 상세: plan 의 "안 하는 것" 절은 "서비스 문장 표기(«— 서비스 판정» 표지)의 전면 통일 … 이음만 맞춘다" 라고
    범위를 좁혀 놓았다. 그런데 `reRun`/`getChain` 두 곳은 단순히 `, 또는` → ` 또는 ` 치환에 그치지 않고,
    서비스 문장 내부의 코드 나열 순서·구분자까지 바뀌었다 — 원문 `RERUN_PERMISSION_DENIED, RR-PL-06`
    (콤마 구분, 코드 순서 disallowed→trigger) 이 신규 `RR-PL-06 · RERUN_PERMISSION_DENIED — 서비스 판정`
    (가운뎃점 구분, 순서 반전, `— 서비스 판정` 표지 신규 부착)으로 바뀌었다. 이는 "이음 구두점 하나만 고친다"
    는 스코프보다 한 걸음 더 들어간 문서 표기 변경이다.
  - 다만 이 확장은 **은폐되지 않았다** — plan 본문 "방향" 절이 "재실행 두 곳의 서비스 문장은 저장소의
    다른 서비스 문장 표기(`(<코드> — 서비스 판정)`)로 — 종전 «— RolesGuard / … — 서비스» 는 이 두 곳만의
    형식이다" 라고 명시적으로 선언하고 근거(이 두 곳만 유일하게 다른 포맷을 썼다)까지 적어 뒀다. 응답
    자체(상태·본문·코드)는 그대로이고 광고용 설명 문자열만 바뀐다는 PR 전제와도 부합한다.
  - 제안: 차단 사유 아님 — plan 문서가 사전에 이 확장을 선언·정당화했으므로 "의도 이상의 변경"이라기보다
    "선언된 예외"에 가깝다. 다음 리뷰어가 재조사하지 않도록 기록만 남긴다.

## 스코프 적합성 확인 (문제 없음)

- **범위 일치**: plan "실측" 표(헬퍼 미사용 3곳 + `, 또는` 이음 14곳 = 17개 라우트, 편집 자리 13곳)와
  CHANGELOG "17개 라우트" 서술, 실제 diff 의 편집 자리(auth 1 · executions 4(공개 2 + 테스트훅 2) ·
  integrations 4 · workflow-test-datasets 1 · workspaces 3 = 13) 가 정확히 일치한다. 초과·누락 없음.
- **import 정리**: `executions.controller.ts` 에서 제거된 `NOT_A_MEMBER`/`ROLE_REQUIRED` import 는
  손 문자열 보간이 사라지며 실제로 고아가 된 것 — grep 으로 파일 내 잔여 사용처 0건 확인. drive-by
  import 정리가 아니라 이번 변경이 직접 유발한 정리다.
- **주석 변경**: `forbidden-descriptions.ts` JSDoc 한 줄("이 문장 뒤에 덧붙인다" → "`forbiddenWithService`
  로 덧붙인다")은 새 함수 도입을 정확히 반영하는 최소 수정이고, 신규 함수의 JSDoc 은 plan 이 명시적으로
  요구한 "이음 규칙과 근거를 헬퍼 JSDoc 에 싣는다"(`검토 경고 처리` 표 INFO2 처분) 항목을 이행한 것이다.
  두 테스트 훅 라우트(`triggerStuckRecoveryForTest`/`simulateExecutionRunRedeliveryForTest`) 위의
  대형 보안 설계 JSDoc 블록은 손대지 않았다 — `@ApiForbiddenResponse` 한 줄만 교체.
- **plan/consistency 부산물**: `plan/in-progress/forbidden-helper-sentences.md`(신규),
  `integration-personal-owner-followup.md`(2줄 추가 — 이번 PR 이 리터럴→헬퍼 호출로 바꾼 상수를 참조하는
  다른 in-progress 항목에 남긴 breadcrumb), `spec-draft-nullable-notation-followups.md`(--impl-prep 이
  발견한 §2-4 표 갭을 planner 트래커에 등재)는 전부 이번 작업이 직접 유발했거나 프로젝트 컨벤션(경고는
  고치지 말고 트래커에 등재)이 요구하는 최소 기록이다. `review/consistency/2026/09/26/15_08_57/**` 8개
  파일은 `--impl-prep` 산출물로, 별도 커밋(`73710d54f`)에 분리돼 있고 코드 커밋(`ed68742f8`)과 섞이지
  않았다.
- **포맷팅/무관 수정 없음**: 각 컨트롤러 diff 는 import 추가 1줄 + `@ApiForbiddenResponse`/모듈 상수 선언
  치환에 정확히 국한된다. 인접 라우트·무관 데코레이터·공백 변경은 없다.

## 요약

19개 변경 파일 전체가 plan 문서가 사전에 선언한 "실측 표 13자리 + CHANGELOG + 헬퍼 + 단위 테스트" 범위
안에 정확히 들어맞는다. import 제거는 이번 변경이 직접 만든 고아를 치운 것이고, 주석 변경은 새 헬퍼
도입을 반영하는 최소 수정이며, plan/review 부산물은 프로젝트 컨벤션이 요구하는 기록이다. 유일한 특이점은
`reRun`/`getChain` 서비스 문장이 "이음 구두점"보다 조금 더 넓게(코드 나열 순서·구분자까지) 바뀐 것인데,
이는 plan 본문이 사전에 명시적으로 선언·정당화한 예외라 은폐된 스코프 확장이 아니다.

## 위험도

NONE
