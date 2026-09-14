# 테스트(Testing) 리뷰 — trigger-canary-hardening (라운드 5)

## 검토 방법

`origin/main...HEAD` 의 실질 코드 diff 6개 파일(신규 repo-guard 2개, 캐너리 self-spec 표기
정리 1개, e2e 3개)을 대상으로, 이전 4라운드(`11_27_40`~`12_37_01`)의 RESOLUTION.md 가 이미
찾아 고친 항목들이 실제로 남아있지 않은지 **독립적으로 재검증**했다. 문서 서술을 그대로
받지 않고 다음을 직접 실행:

- `npx jest src/repo-guards/__tests__/trigger-secret-columns.spec.ts` — 12/12 GREEN 확인.
- `npx jest src/shared/testing/trigger-workflow-ref.spec.ts` — 12/12 GREEN 확인(캐너리 self-spec, 표기 정리 후에도 회귀 없음).
- `grep -nP '[①-⑪]' trigger-workflow-ref.spec.ts` — 0건, 원문자→아라비아 통일 완료 주장을 실측으로 재확인.
- **뮤테이션 재현**: `readStringArrayConst` 의 `if (!ts.isStringLiteralLike(el)) return;` 분기를 저장소 파일에서 직접 삭제 → `1 failed / 11 passed`, 실패 케이스가 정확히 "문자열이 아닌 원소가 섞이면 `null`" 한 건과 일치. `cp` 로 원본 복원 후 `git status --short` 로 잔재 없음, 재실행 12/12 GREEN 재확인. (저장소 트리 변경은 이 실험 구간에만 있었고 끝나자마자 원복했다.)
- `npx tsc --noEmit -p tsconfig.json` — 프로젝트 전역에 사전부터 있던 무관한 타입 오류(carousel/chart/table 노드 스펙의 `result.output` unknown 등, 306줄)는 있으나, 이번 diff 대상 6개 파일 중 어느 것도 그 목록에 나타나지 않음 — 이번 변경이 새 타입 오류를 만들지 않았다.

## 발견사항

- **[INFO]** 신규 repo-guard 는 이번 라운드에서 봤을 때 이미 매우 촘촘하다 — 결함 아님, 확인 기록.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts`(96~217행, `[대조군] readStringArrayConst 가 무엇을 읽고 무엇을 거절하는가` describe 블록)
  - 상세: 4라운드에 걸쳐 "JSDoc 이 N 개를 약속하고 N-1 개만 잠근다"는 형태의 결함이 다섯 번 반복되자, 분기(7개: 파일 부재·선언 없음·비-배열·비-문자열 원소·정상 배열·`as const satisfies`·괄호) ↔ 대조군 `it()` 1:1 대응표를 헤더 JSDoc 에 박아 두는 구조적 장치로 전환했다. 직접 뮤테이션으로 분기 4(비-문자열 원소)를 지워 표의 주장(그 한 건만 RED)이 실측과 일치함을 확인했다. `.toThrow()` 단독이 아니라 메시지 정규식(`/옮겨졌거나 이름이 바뀌었다/`)으로 판별해 "무엇이 던졌는지 안 본다" 함정도 피했다.
  - 제안: 조치 불필요. 다음에 `unwrap` 에 래퍼 종류를 추가하거나 `visit` 에 새 분기를 넣을 때는 이 표에 행을 먼저 추가하는 관례를 유지할 것.

- **[INFO]** `readAllTriggerSecretColumnLists`(배선 함수) 자체를 직접 겨냥한 단위 테스트는 없다 — 새로운 지적 아님, 기존 유예 재확인.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:109-123`
  - 상세: 이 함수는 `CANONICAL_SOURCE` 1개 + `MIRROR_SOURCES` 2개를 순회하며 `readStringArrayConst` 를 호출해 `Record`로 모으기만 하는 순수 배선이고, 원자 함수(`readStringArrayConst`)는 12개 케이스로 충분히 잠겨 있다. 3라운드/4라운드 RESOLUTION 이 이미 "배선 함수이고 원자 함수가 각각 잠겨 있다"로 평가하며 조치 불요로 처분했다 — 이번 라운드에서도 같은 평가가 유지된다. 재-flag 아님, 확인 기록.
  - 제안: 없음.

- **[INFO]** plan 체크리스트의 테스트 수 서술이 최신 상태와 어긋난다(사소, 회귀 아님).
  - 위치: `plan/in-progress/trigger-canary-hardening.md` — "1 — 비밀 컬럼 repo-guard … **9건 GREEN**" 항목(체크리스트 섹션, `- [x] 1 —` 로 시작하는 줄)
  - 상세: 이 숫자는 항목 1을 처음 닫았을 때(라운드 0, `efb0e4b36`)의 스냅샷이고, 이후 `/ai-review` 라운드 1~4가 각각 대조군을 추가하며 스위트가 9 → 10 → 11 → 12건으로 늘었다(각 라운드 RESOLUTION.md 에 기록됨, 실측 재확인함: 현재 12/12 GREEN). 트래커 하단의 라운드 추적 표는 최신이지만, 이 항목 자체의 숫자는 갱신되지 않아 이 한 줄만 읽는 사람은 "9건"을 현재 상태로 오인할 수 있다. 코드 정확성에는 영향 없음 — 이 프로젝트가 반복적으로 강조하는 "측정된 주장은 쓰는 시점의 실제 수치로" 원칙의 사소한 어긋남이다.
  - 제안: "9건 GREEN(라운드 0 시점) → 라운드 1~4 각각 대조군 추가로 최종 12건" 정도로 각주를 갱신하거나, 최종 수치 하나로 통일. 강제 사항 아님(문서 산문, 코드 diff 밖).

## 회귀 테스트 확인

- `trigger-workflow-ref.spec.ts` 의 diff는 헤더 JSDoc(마스터 목록)과 `## 가드 3·5` 케이스 헤딩의 표기(원문자→아라비아)에 국한되며 `it()` 본문은 무편집 — 실행해 12/12 GREEN, 표기 변경이 테스트 로직에 영향을 주지 않았음을 확인.
- `chat-channel-trigger-create.e2e-spec.ts`·`trigger-workflow-ref.e2e-spec.ts` 의 diff는 `afterAll` 상단 JSDoc(주석)만 바뀌고 정리 로직(raw `DELETE FROM trigger`) 자체는 그대로 — 새 부작용·새 회귀 표면 없음.
- `schedule-trigger.e2e-spec.ts` 에 추가된 `expectTriggerWorkflowRef` 호출 3곳(C-2 목록, G PATCH cron, H PATCH 재활성)은 각 `it()` 가 독자적으로 schedule/trigger 를 생성하고 `cronExpression` 값도 파일 내에서 서로 겹치지 않아(직접 `grep` 대조) 테스트 간 간섭이 없다. plan 문서가 주장하는 "세 자리 present:true→false 뮤턴트 → 그 세 케이스만 RED" 는 e2e(DB 필요)라 이 환경에서 직접 재현하지 못했다 — 재현 실패이지 부재의 증거는 아니며, 3라운드에 걸친 문서화된 실측 기록을 신뢰 근거로 남긴다.

## 요약

라운드 1~4가 이미 "vacuous 삼항식 → 방어 분기 미결속 → JSDoc 셋 약속에 둘만 잠금 → null/[] 경계 진입로 누락"의 네 가지 실질 테스트 결함을 순차로 찾아 뮤테이션(전/후 GREEN→RED)으로 검증하며 고쳤고, 마지막에는 "분기↔대조군 대응표"라는 구조적 장치로 재발을 막았다. 이번 라운드에서 그 결과물을 독립적으로 재실행하고, 표가 주장하는 분기 중 하나(비-문자열 원소 배제)를 직접 저장소 파일에서 지워 뮤테이션 재현했으며 문서 주장과 정확히 일치하는 결과(1 failed/11 passed)를 얻었다 — 새로운 Critical/Warning 급 테스트 결함은 발견하지 못했다. e2e 3파일의 소규모 추가(주석 정정 + 기존 헬퍼 재사용 단언 3곳)도 격리·범위 모두 적절하다. 유일한 지적은 plan 문서의 오래된 숫자 하나(INFO, 코드 밖)뿐이다.

## 위험도

NONE
