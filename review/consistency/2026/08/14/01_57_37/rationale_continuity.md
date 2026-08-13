# Rationale 연속성 검토 결과

## 검토 범위 정정 (먼저 읽을 것)

prompt 가 지목한 target(`spec/5-system/`, "EIA r8 캐시 스코프" 워크트리 이름)과 이 워크트리의
실제 `git diff origin/main...HEAD` 는 **일치하지 않는다.** 실측:

- `git branch --show-current` → `claude/raw-query-audit-followups` (워크트리 디렉터리명
  `eia-r8-cache-scope-4ae434` 는 재사용된 stale 이름).
- `git diff origin/main...HEAD --stat` → `spec/**` 변경 **0줄**. 실제 변경은 전부
  `codebase/backend/src/{modules/auth,modules/execution-engine,modules/knowledge-base,common/utils,common/__test-utils__}`
  (raw `UPDATE`/`DELETE … RETURNING` 튜플-오독 버그 수정) + `plan/in-progress/*.md` +
  `review/**` 산출물이다.
- 이 harness 라우팅 결함(prompt/output 경로가 가리키는 워크트리가 무관한 브랜치를 체크아웃
  중)은 **이미 식별·기록된 상태**다 — 직전 라운드
  `review/consistency/2026/08/14/00_00_45/rationale_continuity.md` 가 동일 사실을 CRITICAL/HIGH
  로 보고했고, `plan/in-progress/update-returning-tuple-shape.md` §후속의
  "harness: stale 워크트리 이름이 consistency 검토 대상을 오염시킨다" 항목이 근본 원인·후보
  처방까지 적어 두었다(미해결 `[ ]`, push 를 막지 않음이 이미 확인됨). 같은 사실을 다시
  CRITICAL 로 반복 보고하지 않고, 아래는 **실제 존재하는 diff**(코드 전용)를 대상으로 spec
  Rationale 연속성을 분석한 결과다. "spec/5-system 델타가 없다" 자체를 근거로 판정을
  회피하지 않았다.

### 발견사항

- **[WARNING] 5개 spec 문서가 "구현됨/race-free" 로 단언하는 invariant 가 실제로는 장기간
  미작동이었고, 소급 각주가 이 PR 로는 반영되지 않는다 (project-planner 위임 대기 중)**
  - target 위치: 코드 diff — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    (`admitExecutionOrDefer`, `updateExecutionStatus`), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`
    (CAS 락 2곳·재큐 2곳), `codebase/backend/src/modules/auth/auth-oauth.service.ts` (OAuth state 소비)
  - 과거 결정 출처:
    - `spec/5-system/4-execution-engine.md` L1138·L1694-1701 "admission gate 는 advisory lock 으로
      TOCTOU 를 원자화한다"(PR2b 구현 완료), L1540 "종결 경로가 모두 조건부 UPDATE 를 거치므로
      이미 cancelled 인 행은 덮이지 않고 종결 이벤트도 발행되지 않는다"
    - `spec/5-system/8-embedding-pipeline.md` L264·L389 "결과가 0행이면 409 KB_REEMBED_IN_PROGRESS"
      / "`UPDATE ... WHERE reembed_status='idle' RETURNING id` 으로 race-free"
    - `spec/conventions/node-cancellation.md` §2.4 "retry 재진입 종결 경로 terminal 가드
      (구현됨 2026-07-28)"
    - `spec/data-flow/2-auth.md` "OAuth state 의 one-shot DELETE" (원자적 one-shot 소비)
  - 상세: `plan/in-progress/update-returning-tuple-shape.md` 가 실측·재현으로 밝힌 바에 따르면,
    TypeORM 0.3.31+pg 는 `UPDATE`/`DELETE ... RETURNING` 에 `[rows, rowCount]` **튜플**을
    돌려주는데 8개 호출부가 이를 행 배열로 오독해 위 spec 이 "구현 완료"·"race-free"·
    "발행되지 않는다" 로 단언한 가드들이 **한 번도 발동하지 않았다**(admission cap 미집행,
    KB CAS 락 미거절, 동시 cancel 종결 이벤트 중복 발행 미차단, 소셜 로그인 OAuth 콜백
    상시 실패). 이는 spec Rationale 이 기록한 설계 의도 자체를 뒤집는 것이 아니라 — 오히려
    이 PR 은 그 의도를 **처음으로 올바르게 구현**한다 — 그러나 결과적으로 **위 4개 spec +
    node-cancellation.md, 총 5개 문서가 현재 "항상 작동해 왔다" 는 인상을 주는 문구를
    그대로 유지한 채 병합**된다. `developer` 는 `spec/` 쓰기 권한이 없어(본 프로젝트 규약)
    이 PR 자체로는 소급 각주를 못 넣으며, plan 이 `spec_impact` frontmatter 에 위 5개 문서를
    전부 열거하고 "[planner 위임] 소급 각주 — 대상이 한 문서가 아니다" 항목(대상별 caveat
    문구까지 구체적으로 명시, 영향받는 11개 호출부/3파일 표 포함)으로 project-planner 턴을
    명시적으로 요구해 두었다 — **절차 자체는 규약(developer 는 멈추고 planner 위임)을
    올바르게 따른다.** 다만 그 planner 턴이 아직 집행되지 않은 시점에서 이 5개 문서를
    단독으로 읽는 독자는 "이 가드가 항상 정상 작동해 왔다" 고 오인할 수 있다.
  - 제안: 이 developer PR 이 머지된 직후 project-planner 턴으로 plan 이 이미 구체적으로
    적어 둔 5건 각주(execution-engine.md §1.1·§8, embedding-pipeline.md §7.3,
    graph-rag.md 동시 호출 표, data-flow/2-auth.md OAuth state 소비, node-cancellation.md
    §2.4 — 표 행이 아니라 실제 소비 경로 단위로)를 적용할 것. Gate C(`spec-plan-completion.test.ts`)
    가 `spec_impact` non-none 을 이미 강제하므로 `plan/complete/` 이동 전 자동으로 걸리게
    설계돼 있다 — 이 경로가 실제로 지켜지는지만 후속 확인하면 된다.

- **[INFO] `spec/conventions/node-cancellation.md` §2.4 "retry 재진입 종결 경로 terminal
  가드(구현됨 2026-07-28)" 표현이 특히 오인 소지가 크다**
  - target 위치: `spec/conventions/node-cancellation.md:97-103`
  - 과거 결정 출처: 동일 문서 §2.4, 그리고 `plan/in-progress/update-returning-tuple-shape.md`
    "영향 있음 — 11곳/3파일" 표(`retry-turn.service.ts` `finalizeGuarded`(:672)·
    `resumeGraphAfterRetry`(:892) 포함)
  - 상세: 이 항목은 "확인 없이 쓰면 취소가 소실된다" 는 위협을 서술하며 "구현됨" 이라고
    단정하지만, 실제로는 그 확인이 의존하는 `updateExecutionStatus` 반환값(`persisted`)이
    이 PR 이전엔 상수 `true` 였다 — 방어 코드는 존재했으나 **트리거된 적이 없다.** §2.4 바로
    위 두 항목("노드 경계 재확인"·"park↔resume 짝 전이 terminal 가드")은 `assertExecutionNotCancelled`
    재조회나 `FOR UPDATE` 잠금 기반이라 이 버그의 영향을 받지 않았음을 plan 이 별도로
    확인했으므로(같은 캡션의 "영향 없음" 목록), §2.4 전체가 아니라 **"retry 재진입 종결
    경로" 항목 하나만** caveat 이 필요하다 — plan 도 이 구분("표의 행 라벨이 아니라 실제
    소비 경로 단위로")을 이미 명시했다.
  - 제안: 위 WARNING 과 동일 planner 턴에서 처리. 문서 행 전체가 아니라 해당 단락에만
    "2026-08-13 까지 `persisted` 반환값 오독으로 미작동, PR #(이 작업)로 수정" 각주를 붙일 것.

### 검토했으나 위반 없음으로 판정한 항목 (참고)

- `common/utils/update-returning-rows.ts` 신설이 기존 `assertRowArray` 의 "raw SQL 결과가
  배열인지 확정하는 한 가지 일만 한다" 는 설계 원칙과 충돌하는지 확인했다 — 충돌 없음.
  `assertRowArray` 원본 docstring 은 SELECT 류 일반을 전제했고, 이번에 발견된 것은 그
  전제의 사각지대(UPDATE/DELETE RETURNING 도 배열이라 그대로 통과)다. 신설 헬퍼는 그
  사각지대만 좁게 담당하도록 docstring 상호 참조(`assert-row-array.ts` 쪽에도 "이걸
  UPDATE/DELETE RETURNING 에 쓰지 마라" 역참조 추가)로 명확히 분리했다 — "메시지는 호출부가
  준다" 는 기존 관례도 그대로 유지.
  `spec/**` 어디에도 `assertRowArray`/`updateReturningRows` 를 참조하는 Rationale 이 없어
  (grep 0건), 애초에 spec 레벨에서 판정할 대안 재도입 여지가 없다.
- `execution-engine.service.ts` 의 두 수정(`admitExecutionOrDefer`·`updateExecutionStatus`)과
  `knowledge-base.service.ts` 의 CAS 락·재큐 수정은 모두 위 WARNING 에서 인용한 spec
  Rationale 이 **이미 서술한 설계**(advisory-lock TOCTOU 원자화, "이미 cancelled 인 행은
  종결 이벤트가 발행되지 않는다", "idle 일 때만 진입 가능")를 **처음으로 실제 구현에
  일치**시킨다 — 기각된 대안의 재도입이나 원칙 위반이 아니라 그 반대(원칙과 구현의
  드리프트를 좁힘)다.
- `spec/5-system/4-execution-engine.md:1541` "옛 서술 철회(2026-07-28)" 는
  `plan/in-progress/retry-turn-terminal-guard.md` 의 "project-planner 위임" 항목(줄 343,
  전이표 L77/L1454 대 L79-92 자기모순 정정 요청)이 요구한 정정과 내용이 일치하며 **이미
  spec 에 반영되어 있다** — 다만 해당 plan 의 체크박스는 아직 `[ ]` 로 남아 있어(plan
  status: in-progress) 실제 완료 상태와 어긋난다. Rationale 자체의 문제는 아니라 plan
  위생 사안이라 WARNING 이 아닌 참고로만 남긴다.
- `auth-oauth.service.ts` 의 `remember_me` snake_case 처리 신설(`AuthOAuthStateRow`)이
  자매 파일 `integration-oauth.service.ts` 의 "entity shape 통과 허용" 우회로를 **의도적으로
  두지 않은** 것은 코드 docstring 이 그 자리에서 바로 근거를 밝히고 있어(우회로가 있으면
  숨겼던 결함이 재발) 무근거 번복이 아니다.
- OAuth state 관련 `spec/data-flow/2-auth.md` "one-shot DELETE" Rationale(동시 callback
  경합에서 정확히 한 요청만 state 를 얻는다)은 **DELETE 자체의 원자성**을 다루며 이번
  버그(응답 파싱 오류)와 무관하게 항상 성립했다 — 정정이 필요한 것은 "그 이후 provider/
  remember_me 읽기가 항상 실패했다" 는 별도 사실이며, 위 WARNING 의 소급 각주 대상에
  이미 포함돼 있다.

### 요약

이 세션의 워크트리 이름(`eia-r8-cache-scope-4ae434`)과 prompt 가 지목한 "EIA r8 캐시
스코프" target 은 실제 체크아웃된 브랜치(`claude/raw-query-audit-followups`)와 무관하며,
`spec/**` diff 는 0줄이다 — 이 harness 라우팅 결함은 직전 라운드(`00_00_45`)가 이미 CRITICAL/
HIGH 로 기록했고 `update-returning-tuple-shape.md` 에 원인·처방까지 남아 있는 **기지 사안**이라
재차 CRITICAL 로 반복하지 않았다. 대신 실제 존재하는 코드 diff(raw `UPDATE`/`DELETE …
RETURNING` 튜플 오독 8곳 수정)를 spec Rationale 대비 분석했다. 결론: 이 diff 는 기각된
대안을 되살리거나 합의 원칙을 위반하지 않는다 — 오히려 `execution-engine.md`·
`embedding-pipeline.md`·`node-cancellation.md`·`data-flow/2-auth.md` 가 이미 서술해 둔
설계(advisory-lock admission gate, CAS 락, 종결 이벤트 중복 차단, OAuth state one-shot 소비)를
장기간 미작동 상태에서 처음으로 실제로 작동하게 만든다. 남은 리스크는 그 **소급 각주가
developer 권한 밖이라 이 PR 자체로는 5개 spec 문서에 반영되지 않는다**는 점이며, plan 이
project-planner 위임을 frontmatter `spec_impact` + 구체적 각주 문구로 이미 명시해 두어
절차상 규약을 따르고 있다 — 그 planner 턴이 실제로 집행되는지 후속 확인이 필요하다.

### 위험도
LOW
