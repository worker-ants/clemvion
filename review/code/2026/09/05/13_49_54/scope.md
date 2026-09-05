# 변경 범위(Scope) Review

## 방법론 메모

프롬프트에 조립된 16개 파일은 `git log origin/main..HEAD` 기준 **정확히 4개 커밋**으로
구성된다 (`0498d7362` docs(review) → `ab6fa6863` feat(backend) → `df8be1859` test(backend) →
`abc87b2d4` docs(plan)). 각 커밋의 `git show --stat` 을 직접 열어 "어느 파일이 어느 커밋에서
왜 바뀌었는지"를 추적했다. 저장소에는 어떤 뮤테이션도 가하지 않았다(`git status --short` 로
확인 — 본 리뷰 세션의 산출물 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** `docs(review)` 커밋(`0498d7362`)이 이번 §5.4 작업과 주제가 다른
  `spec-conventions-engine-error-code-surface.md`(EngineErrorCode JSDoc 병기 추적 plan)도 함께
  고친다
  - 위치: `plan/in-progress/spec-conventions-engine-error-code-surface.md` 잔여 체크리스트
    하위 불릿 (취소선 처리된 두 항목)
  - 상세: 이 파일은 `response-contract.ts`/§5.4 검증자와 무관한 별개 트래킹 항목(엔진 에러
    코드 표기 이원화)이다. 다만 같은 커밋에 포함된 impl-prep consistency-check
    (`review/consistency/2026/09/05/12_48_13/plan_coherence.md` WARNING #2)이 바로 이 두 불릿을
    "이미 해소된 target 을 미해소로 지목" 이라고 지적했고, 이 커밋은 그 WARNING 을 그 자리에서
    반영한 것이다(CLAUDE.md 메모리 — "consistency WARNING 은 BLOCK:NO 여도 반영"). 즉 우연한
    drive-by 편집이 아니라 같은 턴에 돌린 필수 게이트가 낸 지적에 대한 직접 대응이라
    추적 가능하다. 다만 커밋을 열지 않고 diff 만 보면 "왜 무관한 plan 파일이 여기 끼어 있나"로
    오인하기 쉬운 지점이라 기록해 둔다.
  - 제안: 조치 불요(이미 별도 `docs(review)` 커밋으로 분리되어 있어 `feat`/`test` 커밋과
    섞이지는 않았다). 향후 유사 상황에서는 커밋 본문에 "WARNING #N 대응"처럼 근거를 한 줄
    남기면 이 추적이 더 빨라진다.

- **[INFO]** `docs(plan)` 커밋(`abc87b2d4`)이 §5.4 항목이 아닌 신규 백로그
  ("`## Overview` 유무 불일치")를 `spec-draft-nullable-notation-followups.md`(nullable 표기
  후속작업 트래커)에 얹는다
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 불릿
    "`spec/5-system/` 의 `## Overview` 유무 불일치"
  - 상세: 이 항목도 같은 impl-prep 세션의 `convention_compliance.md` WARNING #1 을 그대로
    옮긴 것이라 근거는 있다. 다만 이 plan 문서의 주제(응답 DTO nullable 표기 §5.4)와 내용
    (spec 문서 구조 관례)이 서로 다르다 — developer 가 `spec/` 쓰기 권한이 없어 "등재만 한다"고
    명시했지만, 신규 무관 주제의 백로그를 완전히 별개 신규 plan 파일 대신 이미 열려 있던
    파일에 얹은 점은 주제 응집도 관점에서 다소 어색하다.
  - 제안: 조치 불요(치명적이지 않음). 다음에 유사 항목을 등재할 때는 그 항목만을 위한 별도
    `plan/in-progress/*.md` 를 새로 여는 편이, 무관한 트래커를 열어야만 그 항목을 발견할 수
    있는 상황을 피한다.

- **[NONE]** 핵심 구현(`ab6fa6863`)과 배선 확대(`df8be1859`) 커밋 자체에는 범위 이탈이 없다
  - 상세: `response-contract.ts`/`response-contract.spec.ts` 신설과 4개 e2e 파일
    (`audit-logs`/`session-revocation`/`workflow-crud`/`workflow-execution`)에 대한 각
    `import` 2줄 + 단언 호출 5~9줄 추가는 plan
    (`spec-draft-nullable-notation-followups.md` §5.4 drift 배치 2단계 (b))이 사전에 명시한
    범위와 정확히 일치한다. 각 e2e 파일의 diff 는 기존 테스트가 이미 fetch 해 둔 리소스에
    단언 한 줄을 얹는 형태로, 무관한 리팩토링·포맷팅·주석 정리·불필요한 import 는 보이지
    않는다. `df8be1859` 의 `PropertyContract` 타입 좁히기도 같은 파일(`response-contract.ts`)
    안에서 직전 lint 지적이 깬 타입 오류를 되돌린 것으로, 별개 관심사의 리팩토링이 아니라
    같은 PR 내 자기 수정이다.

## 요약

전체 diff 는 `origin/main..HEAD` 4개 커밋(`docs(review)` → `feat(backend)` → `test(backend)` →
`docs(plan)`)으로 깔끔히 분리되어 있고, 각 커�밋이 하나의 관심사(구현/배선/필수 게이트 산출물/
plan 갱신)만 담당한다. `feat`/`test` 커밋(핵심 코드 변경)은 plan 이 사전에 정의한 범위를 정확히
따르며 드라이브바이 리팩토링·포맷팅·불필요한 import 가 없다. `docs(review)`/`docs(plan)` 두
커밋에 포함된, 주제가 다른 plan 파일 수정 2건은 전부 같은 세션에서 의무적으로 실행한
`--impl-prep` consistency-check 의 WARNING 대응이라는 근거가 있어 임의의 범위 이탈이 아니지만,
diff 만 보면 무관해 보일 수 있는 지점이라 INFO 로 기록한다. CRITICAL/WARNING 급 범위 이탈은
없다.

## 위험도

LOW
