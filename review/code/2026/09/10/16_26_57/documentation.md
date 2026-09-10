# 문서화(Documentation) 리뷰 — `trigger-workflow-ref-canary` 3라운드

## 검증 방법 요약

이번 라운드 지시(개수 재검증 + 2문서 정합성 + 소스 3파일 주석 정확성)에 따라 재계산·재대조를
직접 수행했다.

- `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` / `.ts`,
  `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 를 `Read` 로 전문 열람 — 프롬프트
  diff 게이트 번호와 실제 파일 줄 번호가 일치함을 확인(신규 파일이라 두 번호 체계가 같다).
- `grep -c "^\s*it("` 로 self-spec 케이스 수 실측 → **12** (주장과 일치).
- `grep -c "expectTriggerWorkflowRef("` 로 e2e 파일의 호출 수 실측 → **6**("여섯 형태" 주장과 일치),
  `it(` 블록 수 → **5**("다섯 자리" 주장과 일치). 서로 다른 두 수치가 각각 다른 대상(호출 지점 수 vs
  테스트 블록 수)을 가리키므로 모순이 아님을 확인.
- `review/code/2026/09/10/15_52_06/{documentation,maintainability,requirement,scope,security,side_effect,testing}.md`
  7개 파일 전부에서 `[CRITICAL]`/`[WARNING]`/`## 위험도` 를 직접 세어 집계(해당 라운드는 SUMMARY.md
  가 저장소에 없어 orchestrator 집계가 아니라 7개 리포트 원문을 직접 파싱).
- `review/code/2026/09/10/15_52_06/_routing_decision.json` 의 `selected_count: 7` 과 대조.
- `git log --oneline -- <파일>` + `git show --stat`/`git diff <A> <B> -- <파일>` 로 `plan/complete/
  trigger-workflow-ref-canary.md`, `plan/in-progress/harness-review-gate-followups.md` §N 의
  서술이 실제 커밋 이력·원 리뷰 리포트(`requirement.md`/`maintainability.md`/`testing.md`)와
  일치하는지 대조.
- `review/consistency/2026/09/10/15_23_41/SUMMARY.md` 전문을 읽고 배경에 적힌 W1 정정(INFO 3→2,
  합계 9→8)이 실제로 반영돼 있는지 확인.
- 저장소 파일은 전혀 수정하지 않았다(`git status --short` 로 시작·종료 시점 모두 확인 — 본 세션
  산출물 디렉터리 외 변경 없음).

## 발견사항

- **[WARNING]** `describe()` 헤더 docstring 이 "명시 규약" 이라고 선언한 가드 실행 순서 목록이
  실제 가드보다 하나 적다 — 함수에는 11개 단언 지점이 있는데 목록은 10개만 나열한다.
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts:15-21` (목록 서술) 및
    `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:121-123` (누락된 가드의 구현),
    대응 테스트는 `trigger-workflow-ref.spec.ts:85-95`("`null` 은 부재가 아니다" 케이스, `// ──
    가드 N ──` 라벨 없음).
  - 상세: 헬퍼(`trigger-workflow-ref.ts`)의 실행 순서는 ① `dto` not-null → ② 비밀 컬럼 → ③
    `present:false` → ④ `present:true`(`hasOwn===true`) → **⑤ `expect(workflow).not.toBeNull()`**
    → ⑥ 키셋 → ⑦ `id` 타입 → ⑧ `id` UUID → ⑨ `name` 타입 → ⑩ `name` 길이 → ⑪ `expectedWorkflowId`
    로 11단계다. 그런데 spec.ts 헤더가 이번 라운드(2라운드 maintainability W3 반영)에 새로
    써넣은 "케이스 순서는 헬퍼의 가드 실행 순서를 따른다" 목록은 *"`dto` not-null → 비밀 컬럼 →
    `present:false` → `present:true` → 키셋 → `id` 타입 → `id` UUID → `name` 타입 → `name` 길이 →
    `expectedWorkflowId`"* 로 **⑤ 를 완전히 건너뛴다.** 실제로 spec.ts 안의 `// ── 가드 N ──`
    번호도 1·2·3·4·5(키셋)·6·7·8·9·10 순으로 매겨져 있어(48·54·72·97·113·140·150·172·182줄)
    5번 단계(`null` 은 부재가 아니다, 89줄)에는 애초에 번호가 없다 — 즉 그 가드 자체가 이 파일의
    번호 체계에서 "이름 없는 존재"다.
    테스트 자체는 정확한 자리(present 가드 뒤·키셋 가드 앞)에 이미 있고 지금 당장 회귀를 놓치지는
    않는다. 그러나 이 docstring 은 바로 **"새 가드를 추가하면 그 가드의 자리에 테스트도 넣을 것"**
    을 지키게 하려고 이번 라운드에 신설한 것이다(2라운드 maintainability W3 의 직접적 반영물,
    `review/code/2026/09/10/15_52_06` 참조를 헤더가 자기 인용). 그 목적함수 자체가 실제 가드
    수보다 하나 적게 세고 있으므로, 다음에 이 목록만 보고 가드를 추가하는 사람은 "10단계 중 어디"
    라는 잘못된 좌표계로 위치를 판단하게 된다 — 정확히 이 파일이 두 번(1라운드·2라운드) 재발한
    "개수를 세지 않고 적었다" 결함 클래스의 세 번째 사례로 보인다(대상만 코드 결함 개수에서 이번엔
    docstring 자기 서술로 바뀌었다).
  - 제안: 목록에 `→ (present:true 인 경우) workflow not-null` 한 단계를 삽입하거나, 해당 테스트
    위에도 `// ── 가드 5: workflow not-null ──` 식으로 번호를 매겨 번호 체계와 산문 목록 두 곳을
    함께 정정한다. 어느 쪽을 택하든 "11단계"라는 실제 개수와 일치시킬 것.

## 이번 라운드 초점 검증 결과 (재지적 아님 — 확인 결과 보고)

1. **정량 주장 직접 검산** — 전부 실측과 일치한다.
   - 누적 코드 수정 **18건**(1R 12 + `--impl-done` 1 + 2R 5): `RESOLUTION.md` 표(#1-12) + plan
     문서 "13번째 수정" 서술(#13) + 2라운드 커밋(`64334e708`) 이 나열하는 5개 항목(id fixture 교체
     · 고아 JSDoc 분리 · `/api/` 오탈자 · 근거 중복 제거 · 순서 재배열) = 12+1+5=18, 산술·서술
     모두 일치.
   - self-spec **12** 케이스: `grep -c "^\s*it("` 실측 = 12.
   - 2라운드 reviewer **7명**: `_routing_decision.json` 의 `selected_count: 7` 및 실제 산출 파일
     7개(`documentation·maintainability·requirement·scope·security·side_effect·testing`.md)와
     일치.
   - 2라운드 Critical/Warning: 7개 리포트 원문에서 `[CRITICAL]` 태그 직접 카운트 = **0**(전원).
     `## 위험도` 를 파일별로 대조한 결과 `scope`=NONE, `security`=NONE, `side_effect`=NONE,
     `testing`=LOW, `requirement`=LOW, `maintainability`=LOW, `documentation`=MEDIUM — plan 문서
     체크리스트의 *"Critical 0 · scope/security/side_effect NONE · testing/requirement/
     maintainability LOW · documentation MEDIUM"* 서술과 정확히 일치. (2라운드 세션 디렉터리에는
     `SUMMARY.md` 파일 자체가 존재하지 않아 — orchestrator 집계본 없이 커밋 메시지에만 요약이
     실렸다 — 7개 원본 리포트를 직접 열어 재집계했다. 이 부재 자체가 이번 라운드의 검증 대상
     범위 밖이라 별도 결함으로 올리지는 않는다.)

2. **정정된 두 문서의 정합성** — 둘 다 원본 리포트와 일치한다.
   - `review/consistency/2026/09/10/15_23_41/SUMMARY.md`: `rationale_continuity` INFO **2**·합계
     **8** 로 정정돼 있고, 정정 사유("그 외 확인한 항목 — 문제 없음" 절을 세 번째 INFO 로 오산)와
     "이 세션에서 여섯 번째" 목록까지 그대로 남아 있다. 대상 리포트(`rationale_continuity.md`)의
     실제 `[INFO]` 태그 수와 대조 확인은 이전 라운드 몫이었고 이번엔 SUMMARY 자체의 서술 완결성만
     재확인했다 — 이상 없음.
   - `plan/complete/trigger-workflow-ref-canary.md`: "12건" 절 바로 아래 *"이 절의 '12건' 은
     1라운드 시점 값이다 … 누적 18건"* 각주가 있고, 체크리스트 마지막 두 항목이 `--impl-done`
     13번째 수정과 2라운드 5건→누적 18건을 정확히 반영한다. `review/**` 세 문서(원 리포트)가 먼저
     13번째를 기록하고 1차 사료가 뒤늦게 따라간 "권위 역전" 서술도 실측(커밋 순서: `c696ace07` →
     이 plan 정정)과 부합한다.

3. **소스 3파일 주석/독스트링의 커밋 시점 사실 일치 여부** — 위 WARNING 1건 외에는 재배열·축약으로
   옛 구조를 가리키는 문장을 찾지 못했다. 구체적으로 확인한 것들:
   - `trigger-workflow-ref.spec.ts` 헤더의 *"8/8 GREEN 을 유지했다"*(153줄)·*"12/12 GREEN 을
     유지했다"*(117줄)는 각각 1라운드 이전(8케이스 시점)·2라운드 이전(12케이스 시점) 뮤테이션
     실측을 가리키는 **명시적 과거 시점 인용**이며 현재 상태를 주장하는 문장이 아니어서 낡지
     않았다.
   - `trigger-workflow-ref.ts` 파일 스코프 `//` 주석의 "정본 세 번째 사본" 서술은 `TRIGGER_
     RESPONSE_STRIP_COLUMNS`(triggers.service.ts) + `schedule-trigger-ref.ts` 사본 + 이 파일로
     이어지는 3중 구조를 정확히 가리킨다(파일 자체 재확인).
   - `trigger-workflow-ref.e2e-spec.ts` 의 "다섯 자리"(`spec.ts:9`) vs "여섯 형태"(`e2e-spec.ts:18`)
     는 서로 다른 단위(it 블록 수 vs 호출 수)를 가리키는 것으로 확인돼 상호 모순이 아니다. case E
     의 R-CC-10 경고 블록(13번째 수정)도 실제로 존재하며 `grep`으로 `R-CC-10`·`rotate-bot-token`·
     `우회` 가 이제 해당 파일에 등장함을 확인했다.
   - `harness-review-gate-followups.md` §N 의 *"2라운드에서 `testing` 이 2절을 근거로 헬퍼를 직접
     뮤테이션했고 … `requirement` 는 관측된 저장소 이상 상태로 리포트 상단 한 절을 썼고 … 
     `maintainability` 는 인용 블록으로 남겼다"* 는 세 리포트(`testing.md`·`requirement.md`·
     `maintainability.md`, 전부 `15_52_06`) 원문과 대조해 정확함을 확인했다.

## 요약

이번 라운드의 좁은 초점(정량 주장 재검산·2문서 정합성·주석 정확성)을 직접 실측으로 검증한 결과,
지시된 네 가지 수치(누적 18건, self-spec 12, 2라운드 7명, 그 라운드 Critical 0/위험도 집계)와 두
정정 문서(`15_23_41/SUMMARY.md`, `plan/complete/trigger-workflow-ref-canary.md`)는 모두 원본과
일치했다 — 이 세션이 반복해 온 "개수를 세지 않고 적었다" 결함이 이번 라운드에서는 재발하지 않았다.
다만 소스 쪽에서 하나를 새로 찾았다: 2라운드 반영으로 이번에 처음 작성된 "가드 실행 순서" 명시
목록(`trigger-workflow-ref.spec.ts` 헤더)이 실제 헬퍼의 11단계 중 `workflow` not-null 가드
1단계를 누락해 10단계로 적고 있다. 이 목록은 바로 그 종류의 누락(암묵적 순서 관례가 깨지는 것)을
막으려고 신설된 것이므로, 목적과 결과가 어긋난 채로 남으면 다음 가드 추가 시 같은 결함 클래스가
다시 재발할 토양이 된다. 그 외 재배열·축약으로 인한 옛 구조 잔존 서술은 발견하지 못했다.

## 위험도

LOW — 발견된 유일한 결함(가드 순서 목록 누락)은 현재 테스트 스위트의 판정력·순서 자체에는 영향이
없고(테스트는 이미 올바른 위치에 있다), 향후 유지보수 시 참조 목록의 신뢰도를 떨어뜨리는 문서
정확성 문제다. 정량 주장·문서 정합성 검증에서는 결함을 찾지 못했다.

STATUS: success
