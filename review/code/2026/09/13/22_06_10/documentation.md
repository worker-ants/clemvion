# 문서화(Documentation) 리뷰 — error-code-emission-axis

## 검토 방법

프롬프트에 첨부된 diff(파일 1~8 이 실질 변경, 나머지는 과거 리뷰 라운드 산출물)를 기준으로 하되,
diff 가 프롬프트 크기 제한으로 생략된 파일(5·6·7·8)은 `git diff origin/main -- <path>` 로 전문을
직접 읽었다. 소스 라인 인용은 `Read`/`grep` 으로 대상 파일을 직접 열어 확인한 실제 파일 줄
번호다(조립 프롬프트 오프셋 아님).

## 발견사항

- **[CRITICAL]** 이 PR 이 닫으려 한 바로 그 "예고" 문장이 소스 주석에 정정 없이 남아 있다 — AST 축을 포기했는데 주석은 여전히 AST 축이 "등재돼 있다" 고 말한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:77`
  - 상세: `plan/in-progress/error-code-emission-axis.md` 는 이 배치의 존재 이유를 다음과 같이
    적는다 — *"`#1331` 이 남긴 직계 후속이다 — 그 PR 이 `guide-identifier-scan.ts` JSDoc 에
    **"방출 위치를 AST 로 특정하는 축이 트래커에 등재돼 있다"** 라는 **예고**를 써 두었다.
    예고를 남긴 채 두면 다음 사람이 있지도 않은 작업을 쫓는다."* 그런데 그 정확히 인용된
    문장이 `guide-identifier-scan.ts:77` 에 **그대로, 한 글자도 안 고쳐진 채** 남아 있다.
    이 diff 는 그 문장 바로 위(§`이 가드가 못 보는 것`, 59~63행)에 "2026-09-13 에 한 칸
    좁혔다" 는 새 절을 추가했지만, 77행의 원 문장 자체는 편집하지 않았다. 결과적으로 이
    한 파일 안에서 두 절이 서로 모순된 상태를 만든다 — 위쪽(59~63행)은 "발행 축이 이미
    구현됐다" 고 말하고, 아래쪽(77행)은 "AST 로 특정하는 축이 (아직) 트래커에 등재돼 있다"
    고 말한다. 게다가 77행의 "AST" 주장은 이 PR 이 실제로 채택한 설계와 **정면으로
    다르다** — 같은 파일의 새 주석(`collectCatalogCodes` JSDoc, 559행 이하) 과
    `plan/in-progress/error-code-emission-axis.md` §B 는 명시적으로 *"AST 로도 못 푼다"*
    라고 결론짓고, 실제로는 정규식 기반 "메시지 접두 ∩ 카탈로그 부재" 교집합 술어를
    채택했다. 즉 77행은 (a) 이미 끝난 일을 "등재돼 있다(미착수)" 로, (b) 채택되지 않은
    접근(AST)을 채택된 것처럼 서술하는 이중으로 낡은 예고다. 다음 사람이 이 문장을 그대로
    믿으면 이미 존재하지 않는 "AST 축" 트래커 항목을 찾아 헤매게 된다 — 이 PR 의 도입부가
    정확히 경계한 바로 그 시나리오다.
  - 제안: 77행을 `## 발행 축` 절(245행 이하, 이 PR 이 새로 추가한 절)로의 전방 참조로
    바꾸거나, "AST 로 특정하는 축이 트래커에 등재돼 있다" 를 취소선으로 남기고 "2026-09-13
    `error-code-emission-axis` 가 닫았다 — AST 가 아니라 메시지 접두 ∩ 카탈로그 부재 교집합
    으로" 라는 정정문을 덧붙인다. (이 저장소의 §자기-반증형 소정정 관례 — 원문은 취소선으로
    남기고 정정만 추가 — 를 그대로 코드 주석에도 적용할 수 있다.)

- **[WARNING]** 편집 도중 남은 orphan 주석 조각 — 이미 다른 곳에서 완전히 서술된 내용을 문맥 없이 반복한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:11`
  - 상세: 원래 파일은 `// SoT: spec/conventions/user-guide-evidence.md (가드 가족) ·
    spec/conventions/error-codes.md` / `// (코드 명명·은퇴 이력) · spec/5-system/3-error-handling.md
    §1 (카탈로그).` 두 줄이 한 문장이었다. 이번 diff 가 첫 줄을 7줄짜리 새 설명(4~10행,
    "SoT 로 단정하지 않는다" 는 취지)으로 교체했는데, 이어지던 둘째 줄(`// (코드 명명·은퇴
    이력) · spec/5-system/3-error-handling.md §1 (카탈로그).`)은 context 줄이라 그대로
    남았다. 그 결과 지금 11행은 앞에 붙을 주어가 없는 **문법적으로 붕 뜬 조각**이고,
    "spec/5-system/3-error-handling.md §1 (카탈로그)" 는 이미 5행에서 새로 서술됐으므로
    **의미도 중복**이다. 기능에는 영향 없지만 "주석 정확성/오래된 주석" 관점에서 다음
    편집자가 "왜 이 조각이 여기 있나" 를 다시 추적해야 하는 비용을 만든다.
  - 제안: 11행을 삭제한다 (5행이 이미 같은 내용을 포함).

## 긍정적으로 확인한 점

- `CHANGELOG.md`·`PROJECT.md`·`logic.mdx`/`logic.en.mdx` 의 신규 서술이 인용하는 소스 위치
  (`execution-engine.service.ts:7121·7125`(`CONTAINER_MISSING_EMIT`)·`:7130`
  (`CONTAINER_MULTIPLE_EMIT`)·`makeshop.handler.ts:436`(`MAKESHOP_UNRESOLVED_PATH_PARAM`))를
  전부 `grep` 으로 직접 대조해 정확함을 확인했다. `spec/5-system/3-error-handling.md:112`
  의 "앵커 없는 7종" 인용도 실재를 확인했다.
- `guide-identifier-existence.test.ts`·`guide-identifier-scan.ts` 신규 export
  (`collectQuotedLiterals`·`collectMessagePrefixes`·`collectCatalogCodes`·
  `isMessagePrefixOnly`·`computeNonEmittedOffenders`·`GUIDE_NON_EMITTED_VOCABULARY`) 는
  전부 JSDoc 이 있고, 설계 근거(왜 `matchAll` 인지, 왜 두 인자를 분리해 받는지, 왜
  `GUIDE_EXTERNAL_VOCABULARY` 와 합칠 수 없는지)까지 구체적으로 적혀 있다. 이 저장소가
  기존에 겪은 실패(카탈로그를 요구 조건으로 오인, AND 항 진리표 미검증, `where` 단일
  매치)를 각 함수 JSDoc 이 명시적으로 인용해 "왜 이 형태인가" 를 설명하는 점이 특히
  좋다 — 코드만 봐서는 알 수 없는 반증 이력을 코드 옆에 남겼다.
- `PROJECT.md:300` 의 가드 설명이 "발행 축" 추가분과 "여전히 열린 한계"(소비자·분류기
  인용으로 우회 가능, 안 읽히는 env 변수는 여전히 통과)를 함께 적어, 가드가 보장하는
  범위를 과장하지 않는다. 등재 미완료(`user-guide-evidence.md §2` 표에 아직 없음) 사실도
  숨기지 않고 명시했다 — 문서한 보장이 구현보다 넓어지는 흔한 실패를 피했다.
  (INFO 성격 — 이미 자체 공시돼 있어 새 결함으로 세지 않았다.)
- `plan/in-progress/error-code-emission-axis.md`·`spec-draft-nullable-notation-followups.md`
  는 기각한 대안(AST, 카탈로그를 요구 조건으로)과 그 근거를 실측과 함께 남겨, Rationale
  "기각된 대안" 요건을 충족한다.
- CHANGELOG 신규 항목은 파일 상단(기존 `## Unreleased` 스택 맨 위)에 추가돼 이 저장소의
  기존 관례(다중 `## Unreleased` 헤더를 최신순으로 쌓는 방식)와 일치한다.

## 요약

핵심 코드(`guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`)의 JSDoc/인라인
주석 밀도와 정확성은 전반적으로 높고, 가이드 문서(logic.mdx/en)·CHANGELOG·PROJECT.md 의
신규 서술은 소스 줄 번호까지 실측 대조 결과 정확했다. 다만 CRITICAL 1건이 이 PR 의 존재
이유 자체와 직결된다 — plan 문서가 "이 PR 은 `guide-identifier-scan.ts` 의 낡은 AST 예고를
닫으러 왔다" 고 명시하면서 정작 그 예고 문장(77행)을 고치지 않아, 같은 파일 안에서 "이미
구현됐다" 는 새 절과 "아직 트래커에 등재돼 있다(AST 로)" 는 옛 절이 공존한다. WARNING 1건은
편집 중 남은 문법적으로 붕 뜬 orphan 주석 조각(11행)으로, 의미상 중복이라 삭제가 맞다. 두
건 모두 국소적 수정으로 해결 가능하며, 나머지 신규 코드·가이드·plan 문서의 품질은 이
저장소의 높은 문서화 기준에 부합한다.

## 위험도

MEDIUM
