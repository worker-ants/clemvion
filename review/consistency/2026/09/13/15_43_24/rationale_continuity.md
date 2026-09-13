# Rationale 연속성 검토 — `spec/conventions/` (impl-done, 라운드 4)

## 스코프 판단 (실측)

`git diff origin/main...HEAD --stat` 기준 **`spec/conventions/**` 델타 0개 파일** — 이 브랜치는
spec 을 고치지 않는다. 코드 델타(누적)는:

- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts`(삭제) →
  `guide-identifier-existence.test.ts`(신규)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts`(삭제) →
  `guide-identifier-scan.ts`(신규)
- `guide-sanitized-message-parity.test.ts`(참조 갱신)
- `CHANGELOG.md`·`PROJECT.md`·`plan/in-progress/guide-identifier-existence.md`(신규)·
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(백로그 항목 갱신)

직전 라운드(`15_23_53`, --impl-done) 이후 최신 커밋(`b75fe0ace`, "라운드 3 — 주석에만 있던
설계 결정을 뮤턴트로 고정한다")의 diff 를 확인했다 — `guide-identifier-existence.test.ts` 에
합성 fixture 테스트 1건만 추가됐고 **`spec/**`·`plan/**` 는 건드리지 않았다**
(`git show --stat b75fe0ace` 로 재확인). 따라서 이번 라운드의 판정 대상은 직전 세 라운드
(`12_33_41`(--impl-prep)·`14_41_43`·`15_03_36`·`15_23_53`(--impl-done))가 이미 수렴시킨
지점과 **동일**하며, 아래는 그 지점이 이번 라운드에도 그대로 열려 있음을 독립적으로
재확인한 결과다. `spec/conventions/user-guide-evidence.md`·`spec/conventions/error-codes.md`
를 절대경로로 다시 열어 대조했다.

## 발견사항

- **[WARNING]** `#1330` 이 세운 "허용목록 없음" 설계 원칙의 번복이 spec `## Rationale` 밖에
  계속 머문다 (직전 4라운드 대비 미변경)
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 상단
    주석("허용목록을 둔다 — 그리고 그 결정의 대가를 적는다" 절, `GUIDE_EXTERNAL_VOCABULARY`
    정의) · `plan/in-progress/guide-identifier-existence.md §C`("`#1330` 의 '허용목록 없음'은
    이번 축에서 유지할 수 없다")
  - 과거 결정 출처: `plan/complete/guide-error-code-truth.md §D`("전수 열거(82종) + 허용목록도
    검토했고 기각했다 … 탈출구를 미리 파 두면 오늘의 결함이 다시 들어온다")와 삭제된
    `guide-error-code-scan.ts` 상단 JSDoc(현재는 git 이력에만 존재: "탈출구(허용목록)를 미리
    파 두면 '…' 로 오늘의 결함이 다시 들어온다"). 이 결정은 **완료된 plan 문서·코드 주석
    수준**에서만 확립돼 있었고, `spec/conventions/user-guide-evidence.md`·`error-codes.md`
    어느 쪽 `## Rationale` 에도 이 가드 계열(`guide-error-code-*`/`guide-identifier-*`)이
    등재된 적이 없다 — `user-guide-evidence.md §2 "Build-time 가드 (3건)"` 표를 이번 라운드에
    재열람했으나 여전히 3건(`impl-anchor-existence`·`integrations-coverage`·
    `triggers-coverage`)만 있고 frontmatter `code:` 목록에도 세 파일이 빠져 있다.
    `error-codes.md` 의 `## Rationale`(177행 이하)도 grep 재확인 결과 이 가드에 대한 언급이
    0건이다.
  - 상세: 이번 PR 은 "허용목록 없음" 원칙을 실측 근거로 명시적으로 뒤집는다 — 문맥 게이팅이
    가드 존재 이유였던 과거 결함(`MCP_INSECURE_URL_ALLOWED`, `#1330` 축 1·2·3 전부 미포착)을
    재현 테스트로 증명하고, `GUIDE_EXTERNAL_VOCABULARY` 4강제(외부 시스템 이름 의무·상한
    5·여전히 인용될 것·기준집합 부재 단언, 이번 라운드까지 뮤테이션으로 보강)로 은폐 위험을
    낮췄다. 번복 자체는 무근거가 아니다 — 코드 JSDoc·plan §A/§B/§C 양쪽에 실측 표와 함께
    상세히 남아 있다. 문제는 이 근거가 `CLAUDE.md` 가 정한 자리(해당 spec 문서 끝
    `## Rationale`)로 아직 승격되지 않았다는 것뿐이다. developer 는 이를 스스로 인지하고
    있다 — plan frontmatter 주석에 "`user-guide-evidence.md §2` 등재는 필요하고 **developer
    권한 밖**" 이라 명시했고, 자기-반증형 소정정 예외(조건 2 "예고·트리거 문장")에도
    해당하지 않는다고 스스로 판정했다(설계 원칙 문장이지 예고 문장이 아니므로) — planner
    턴으로 위임하는 것이 맞는 경로다. `spec-draft-nullable-notation-followups.md`(3255~3264행
    부근)에 planner 가 거의 그대로 옮겨 쓸 수 있는 Rationale 초안이 이미 등재돼 있음을
    재확인했다.
  - 왜 CRITICAL 이 아니라 WARNING 인가: (1) 뒤집힌 원칙이 애초에 spec `## Rationale` 에
    있던 적이 없다 — "spec 이 명시적으로 기각한 대안의 재도입" 요건을 문자 그대로 충족하지
    않는다(완료된 plan 문서·코드 주석 수준의 결정이지 spec 수준이 아니다). (2) 번복에 측정
    근거가 딸려 있고 은폐 방지 강제가 코드·뮤테이션(라운드 3 에서 `UPPER_SNAKE` 밑줄 요건
    뮤턴트까지 보강)으로 검증됐다. (3) developer 가 권한 경계를 지키며 완결된 형태의 백로그
    항목을 이미 등재했다 — spec 을 직접 고치는 월권을 하지 않았다.
  - 라운드 경과: 이 WARNING 은 `14_41_43`(R1)→`15_03_36`(R2)→`15_23_53`(R3)→본
    라운드(R4, `15_43_24`)까지 **4라운드 연속 동일하게 열려 있다**. 그 사이 코드 쪽 조치
    (리네임·기준집합 통합·축 교체·과거 결함 재현 테스트·뮤테이션 7건 보강·라운드3 fixture
    추가)는 모두 완료됐고, `spec/**`·`plan/in-progress/guide-identifier-existence.md`·
    `spec-draft-nullable-notation-followups.md` 는 라운드 2 이후 변경이 없다 — 남은 유일한
    조치는 planner 턴에서의 spec 승격이며 developer 스코프 안에서는 더 줄일 수 없는 상태다.
  - 제안: planner 턴에서 `spec/conventions/user-guide-evidence.md` 를 한 번에 갱신 —
    (1) §2 표에 `guide-identifier-existence.test.ts`(+`guide-identifier-scan.ts`) 및
    `guide-sanitized-message-parity.test.ts` 행 추가, (2) frontmatter `code:` 목록에 세 파일
    추가, (3) 신규 `## Rationale` 항목 — ① "왜 이 가드는 '허용목록 없음' 원칙을 유지하지
    못했는가"(문맥 게이팅이 가드 존재 이유였던 결함을 못 잡음, 실측표), ② "왜 이번
    허용목록은 `guide-error-code-truth.md §D` 가 기각한 것과 다른가"(4강제 + 뮤테이션
    검증으로 은폐 불가). 초안은 `spec-draft-nullable-notation-followups.md` 해당 항목에 이미
    있으므로 복붙 수준이다.

- **[INFO]** 부분 재도입은 `#1330`(`guide-error-code-truth.md §D`)이 기각한 이유 중 **frontend
  자기증명 오염** 부분은 그대로 보존한다 — 완전한 재도입은 아니다 (직전 라운드 대비 미변경)
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

이번 diff(`spec/conventions/**` 델타 0, 라운드 4 누적 포함)는 기존 spec 문서의
`## Rationale` 을 직접 위반하지 않는다 — `user-guide-evidence.md`·`error-codes.md` 어디에도
이번 변경과 충돌하는 기존 spec Rationale 항목이 없다(이 가드 가족 자체가 애초에 그 문서들에
미등재). 다만 이번 구현은 완료된 plan 문서(`guide-error-code-truth.md §D`)·삭제된 코드
주석에만 기록돼 있던 설계 원칙("허용목록 없음")을 실측 근거를 갖춰 명시적으로 뒤집으면서도,
그 근거를 `CLAUDE.md` 가 정한 자리(spec `## Rationale`)로 아직 승격하지 않았다. 절차(권한
경계 준수, planner 백로그에 완결된 초안 위임, 뮤테이션 검증 보강)는 옳고 번복 자체에도
근거가 충분하다 — 이 WARNING 은 4라운드 연속(14:41→15:03→15:23→15:43) 동일하게 열려 있고
developer 쪽 조치는 이미 완료된 상태라 이후 조치는 순수히 planner 턴의 몫이다. 같은 가드
계열이 직전 완료 plan(`guide-error-code-truth.md §J`·§K)에서 "등재했다고 적고 실제로는
안 썼다" 를 반복한 전력이 있어, 이 공백이 다음 planner 턴에서 표·frontmatter·Rationale 을
한 번에 처리하지 않으면 재발 위험이 남는다. 반면 기준집합 확장(frontend 미포함 유지)은
과거 기각 사유 중 자기증명 오염 축을 정확히 보존하고 있어 그 자체로는 원칙 위반이 아니다.

## 위험도

MEDIUM
