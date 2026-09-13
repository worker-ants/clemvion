# Rationale 연속성 검토 — `spec/conventions/` (impl-done, 라운드 5)

## 스코프 판단 (실측)

`git diff origin/main...HEAD --stat -- spec/conventions/` = **0개 파일**. 이 브랜치는 이번
라운드까지 `spec/conventions/**` 를 전혀 고치지 않았다.

직전 라운드(`15_43_24`, 라운드 4) 이후 신규 커밋은 `6b4c03af6`("라운드 4 — 리뷰어의 우려는
맞고 예시는 틀렸다") 하나뿐이며, `git show --stat 6b4c03af6` 로 확인한 결과:

- 코드 변경: `guide-identifier-scan.ts`(`CODE_FIELD` 정규식에 왼쪽 경계 `(?<![A-Za-z])` 추가)
  · `guide-identifier-existence.test.ts`(음성 fixture 1건 추가, `mycode`/`statusCode` 비대상 ·
  `code`/bare `code:` 대상)
- `spec/**`·`plan/**` 파일은 **건드리지 않았다**

즉 이번 라운드가 판정할 신규 표면은 정규식 왼쪽 경계 버그 수정 하나뿐이고, 나머지는
라운드 2~4 가 이미 수렴시킨 지점과 동일하다. `spec/conventions/user-guide-evidence.md`·
`spec/conventions/error-codes.md`·`plan/complete/guide-error-code-truth.md`·
`plan/in-progress/spec-draft-nullable-notation-followups.md` 를 절대경로로 다시 열어
대조했다.

## 발견사항

- **[WARNING]** `#1330` 이 세운 "허용목록 없음" 설계 원칙의 번복이 spec `## Rationale` 밖에
  계속 머문다 (라운드 4 대비 미변경 — 5라운드 연속 동일)
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:44-51`
    ("허용목록을 둔다 — 그리고 그 결정의 대가를 적는다" 절, `GUIDE_EXTERNAL_VOCABULARY` 4강제
    정의) · `plan/in-progress/guide-identifier-existence.md §C`("`#1330` 의 '허용목록 없음'은
    이번 축에서 유지할 수 없다") · `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (해당 트래커 항목의 "**해소** — `#1331`" 각주)
  - 과거 결정 출처: `plan/complete/guide-error-code-truth.md §D`(158~172행) — "전수 열거(82종)
    + 허용목록도 검토했고 기각했다 … 탈출구를 만들지 않는다. 훗날 가이드가 로드맵을 명시적으로
    소개해야 하면 그때 RED 가 뜨고 사람이 판단한다 — 허용목록을 미리 파 두면 '…Planned니까…'
    로 오늘의 결함이 다시 들어온다." 이 결정은 **완료된 plan 문서·코드 주석 수준**에서만
    확립돼 있고, `spec/conventions/user-guide-evidence.md`·`error-codes.md` 어느 쪽
    `## Rationale` 에도 이 가드 계열(`guide-error-code-*`/`guide-identifier-*`)이 등재된 적이
    없다 — 이번 라운드에 `user-guide-evidence.md §2 "Build-time 가드 (3건)"` 표를 재열람했으나
    여전히 3건(`impl-anchor-existence`·`integrations-coverage`·`triggers-coverage`)만 있고
    frontmatter `code:` 목록에도 세 파일(`guide-identifier-scan.ts`·
    `guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts`)이 빠져
    있다. `error-codes.md §Rationale`(177~211행)도 재확인 결과 이 가드에 대한 언급이 0건이다.
    한편 `PROJECT.md`(가드 카탈로그)와 `CHANGELOG.md`는 이번 PR 에서 이미 "SoT:
    `spec/conventions/user-guide-evidence.md §2`" 라고 명시했는데, 정작 그 spec 문서 자체는
    아직 그 가드를 모른다 — 인덱스 문서가 spec 보다 앞서가는 상태다.
  - 상세: 이번 PR 은 "허용목록 없음" 원칙을 실측 근거로 명시적으로 뒤집는다 — 문맥 게이팅이
    가드 존재 이유였던 과거 결함(`MCP_INSECURE_URL_ALLOWED`, `#1330` 축 1·2·3 전부 미포착)을
    재현 테스트로 증명하고, `GUIDE_EXTERNAL_VOCABULARY` 4강제(외부 시스템 이름 의무·상한·
    여전히 인용될 것·기준집합 부재 단언, 라운드 3 뮤테이션으로 보강)로 은폐 위험을 낮췄다.
    번복 자체는 무근거가 아니다 — 코드 JSDoc·plan §A/§B/§C 양쪽에 실측 표와 함께 상세히
    남아 있다. 문제는 이 근거가 `CLAUDE.md` 가 정한 자리(해당 spec 문서 끝 `## Rationale`)로
    아직 승격되지 않았다는 것뿐이다. developer 는 이를 스스로 인지하고 있다 — plan
    frontmatter 주석에 "`user-guide-evidence.md §2` 등재는 필요하고 **developer 권한 밖**"
    이라 명시했고, 자기-반증형 소정정 예외(조건 2 "예고·트리거 문장")에도 해당하지 않는다고
    스스로 판정했다(설계 원칙 문장이지 예고 문장이 아니므로) — planner 턴으로 위임하는 것이
    맞는 경로다. `spec-draft-nullable-notation-followups.md` 에 planner 가 옮겨 쓸 수 있는
    Rationale 초안(2문단: ① 왜 허용목록 없음 원칙을 못 지켰는가, ② 왜 이번 허용목록은
    `guide-error-code-truth.md §D` 가 기각한 것과 다른가)이 이미 등재돼 있음을 재확인했다.
  - 이번 라운드의 신규 변경(`CODE_FIELD` 왼쪽 경계 버그 수정)은 이 원칙과 무관하다 —
    "허용목록 없음" 축이 아니라 "축 2(`code:` 필드) 정규식의 좌경계 부재로 인한 오매칭"
    버그 수정이며, "문맥 무관 전수 포착"(축 3)의 설계와도 충돌하지 않는다. 새 Rationale
    번복도, 새 invariant 우회도 만들지 않는다.
  - 왜 CRITICAL 이 아니라 WARNING 인가: (1) 뒤집힌 원칙이 애초에 spec `## Rationale` 에
    있던 적이 없다 — "spec 이 명시적으로 기각한 대안의 재도입" 요건을 문자 그대로 충족하지
    않는다(완료된 plan 문서·코드 주석 수준의 결정이지 spec 수준이 아니다). (2) 번복에 측정
    근거가 딸려 있고 은폐 방지 강제가 코드·뮤테이션으로 검증됐다. (3) developer 가 권한
    경계를 지키며 완결된 형태의 백로그 항목을 이미 등재했다 — spec 을 직접 고치는 월권을
    하지 않았다.
  - 라운드 경과: 이 WARNING 은 `14_41_43`(R1)→`15_03_36`(R2)→`15_23_53`(R3)→`15_43_24`(R4)
    →본 라운드(R5, `16_04_45`)까지 **5라운드 연속 동일하게 열려 있다**. 그 사이 코드 쪽 조치
    (리네임·기준집합 통합·축 교체·과거 결함 재현 테스트·뮤테이션 보강·좌경계 버그 수정)는
    모두 완료됐고, `spec/**`·`plan/in-progress/guide-identifier-existence.md`·
    `spec-draft-nullable-notation-followups.md` 는 라운드 2 이후 이 지점에 변경이 없다 — 남은
    유일한 조치는 planner 턴에서의 spec 승격이며 developer 스코프 안에서는 더 줄일 수 없는
    상태다.
  - 제안: planner 턴에서 `spec/conventions/user-guide-evidence.md` 를 한 번에 갱신 —
    (1) §2 표에 `guide-identifier-existence.test.ts`(+`guide-identifier-scan.ts`) 및
    `guide-sanitized-message-parity.test.ts` 행 추가, (2) frontmatter `code:` 목록에 세 파일
    추가, (3) 신규 `## Rationale` 항목 — ① "왜 이 가드는 '허용목록 없음' 원칙을 유지하지
    못했는가"(문맥 게이팅이 가드 존재 이유였던 결함을 못 잡음, 실측표), ② "왜 이번
    허용목록은 `guide-error-code-truth.md §D` 가 기각한 것과 다른가"(4강제 + 뮤테이션
    검증으로 은폐 불가). 초안은 `spec-draft-nullable-notation-followups.md` 해당 항목에 이미
    있으므로 복붙 수준이다.

- **[INFO]** 부분 재도입은 `#1330`(`guide-error-code-truth.md §D`)이 기각한 이유 중 **frontend
  자기증명 오염** 부분은 그대로 보존한다 — 완전한 재도입은 아니다 (라운드 4 대비 미변경)
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
    ("frontend 소스는 **넣지 않는다**" 주석) · `guide-identifier-scan.ts`
  - 과거 결정 출처: `plan/complete/guide-error-code-truth.md §D` — "frontend 소스를
    기준집합에 넣으면 가이드가 인용한 이름이 프런트 라벨 맵으로 자기를 증명한다."
  - 상세: `#1330` 이 기각한 대안은 두 요소의 결합이었다 — (a) 전수 열거(백틱 무조건) + (b)
    그 결과 필요해지는 기준집합 확장(frontend 소스 포함, 자기증명 오염). 이번 PR 은 (a)는
    채택하지만 (b)는 명시적으로 계속 거부한다 — 기준집합은 backend·packages ∪ env 선언처로
    한정한다. 기각 사유가 분리 가능한 두 요소 중 하나만 남았음을 실측으로 확인하고 선택적
    으로 뒤집은 것이며, 통째로 되살린 것이 아니다.
  - 제안: 없음 — 위 WARNING 항목의 Rationale 신설 시 이 구분("무엇을 뒤집고 무엇을
    보존했는가")을 한 문장으로 포함할 것.

## 요약

이번 라운드에서 `spec/conventions/**` 델타는 여전히 0이고, 신규 코드 변경(`CODE_FIELD` 정규식
좌경계 버그 수정 + 음성 fixture 추가)은 기존 spec `## Rationale` 어느 항목과도 충돌하지
않는다 — 순수 버그 수정이며 "허용목록 없음"·"백틱 전수 문맥 무관" 등 이 PR 이 이미 세운
설계 원칙과도 정합적이다. 지속적으로 열려 있는 유일한 항목은 developer 가 실측 근거를 갖춰
명시적으로 뒤집은 `#1330` 의 "허용목록 없음" 원칙인데, 그 뒤집기 자체는 절차(권한 경계 준수,
뮤테이션 검증, planner 백로그에 완결된 초안 위임)와 근거 모두 갖춰져 있고 유일하게 남은
결손은 그 근거를 `CLAUDE.md` 가 정한 자리(spec `## Rationale`)로 아직 승격하지 않았다는
점이다. 이 WARNING 은 5라운드 연속(14:41→15:03→15:23→15:43→16:04) 동일하게 열려 있고
developer 쪽 조치는 이미 완료된 상태라 이후 조치는 순수히 planner 턴의 몫이다. 반면
기준집합 확장(frontend 미포함 유지)은 과거 기각 사유 중 자기증명 오염 축을 정확히 보존하고
있어 그 자체로는 원칙 위반이 아니다. Rationale 연속성 관점에서 이 PR 을 codebase 쪽에서
더 막을 이유는 없다 — 남은 조치는 planner 턴 하나뿐이다.

## 위험도

MEDIUM
