# Rationale 연속성 검토 — `spec/conventions/` (impl-done, guide-identifier-existence)

## 스코프 판단 (실측)

`git diff origin/main...HEAD --stat` 기준 **`spec/conventions/**` 델타 0개 파일** — 이 브랜치는
spec 을 고치지 않았다. 실제 코드 변경(누적)은:

- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (삭제) →
  `guide-identifier-existence.test.ts` (신규, 라운드 2에서 citation 경로·env 분기 대조군 보강)
- `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` (삭제) →
  `guide-identifier-scan.ts` (신규)
- `guide-sanitized-message-parity.test.ts` (참조 갱신)
- `CHANGELOG.md`, `PROJECT.md`, `plan/in-progress/guide-identifier-existence.md` (신규),
  `plan/in-progress/spec-draft-nullable-notation-followups.md` (백로그 항목 갱신)
- 라운드 2 커밋(`938060138`)은 bare `hh_mm_ss` 인용 정정 + `collectEnvDeclarations` 뮤테이션
  보강만 다뤘다 — `spec/**`·`plan/**` 미포함 (`git show --stat 938060138` 확인).

따라서 이번 검토는 "target(spec/conventions) 자체가 자기 Rationale 을 어겼는가" 가 아니라
**"이번 코드 변경이 기존 spec/plan Rationale 이 세운 원칙과 충돌하거나, 그 원칙을 무근거로
번복하는가"** 를 본다. `spec/conventions/user-guide-evidence.md`(이 가드 가족의 SoT 후보) ·
`spec/conventions/error-codes.md` 를 이번 라운드에서 다시 절대경로로 열어 대조했다.

동일 스코프의 직전 세 라운드(`12_33_41`(--impl-prep) · `14_41_43`(--impl-done) ·
`15_03_36`(--impl-done))가 이미 같은 지점을 WARNING 으로 수렴시켰다. 그 사이 라운드 2
커밋(`938060138`)은 review-citations 규약 위반(CRITICAL)과 mutation 갭(WARNING)을 고쳤을
뿐 아래 지점과는 무관하다. 이번 라운드는 그 지점이 **여전히 미해소**임을 독립적으로
재확인한다.

## 발견사항

- **[WARNING]** "허용목록 없음" 설계 원칙의 번복이 spec `## Rationale` 밖에 계속 머문다
  (직전 라운드 대비 미변경)
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 상단
    주석("허용목록을 둔다 — 그리고 그 결정의 대가를 적는다") · `plan/in-progress/
    guide-identifier-existence.md §C`
  - 과거 결정 출처: `plan/complete/guide-error-code-truth.md §D` — "전수 열거 + 허용목록도
    검토했고 기각했다 … 탈출구를 만들지 않는다 … 허용목록을 미리 파 두면 오늘의 결함이
    다시 들어온다." 이 결정은 **spec `## Rationale` 이 아니라 완료된 plan 문서**에만 산다 —
    `spec/conventions/user-guide-evidence.md §2 "Build-time 가드 (3건)"` 표를 이번 라운드에
    다시 열람했으나 `guide-error-code-*`/`guide-identifier-*` 행이 여전히 없고 frontmatter
    `code:` 목록에도 세 파일이 빠져 있다. `error-codes.md` 의 `## Rationale`(177행)에도 이
    가드에 대한 언급이 0건이다(grep 재확인).
  - 상세: 이번 PR 은 `#1330` 이 세운 "허용목록 없음" 원칙을 **실측 근거를 갖춰 명시적으로
    뒤집는다** — 문맥으로 좁힌 판이 가드를 만들게 한 과거 결함(`MCP_INSECURE_URL_ALLOWED`,
    3축 전부 미포착)을 재현 테스트로 증명하고, `GUIDE_EXTERNAL_VOCABULARY` 4강제(외부 시스템
    이름 의무·상한 5·여전히 인용될 것·기준집합 부재 단언)로 은폐 위험을 낮췄다. 번복 자체는
    무근거가 아니다 — 코드 JSDoc·plan 문서 양쪽에 근거가 상세히 남아 있고 뮤테이션 검증까지
    있다. 문제는 이 근거가 CLAUDE.md 가 정한 자리(해당 spec 문서 끝 `## Rationale`)로
    아직 승격되지 않았다는 것이다. developer 는 이를 스스로 인지하고 있다 — plan
    frontmatter 주석에 "`user-guide-evidence.md §2` 등재는 필요하고 **developer 권한 밖**"
    이라 명시했고, 자기-반증형 소정정 예외(조건 2 "예고·트리거 문장")에도 해당하지 않는다고
    스스로 판정했다(이건 설계 원칙 문장이지 예고 문장이 아니다) — planner 턴으로 위임하는
    것이 맞는 경로다. `spec-draft-nullable-notation-followups.md`(3255~3264행 부근)에 planner
    가 거의 그대로 옮겨 쓸 수 있는 Rationale 초안까지 이미 등재돼 있음을 재확인했다.
  - 왜 CRITICAL 이 아니라 WARNING 인가: (1) 뒤집힌 원칙이 애초에 spec `## Rationale` 에
    있던 적이 없다 — "spec 이 명시적으로 기각한 대안의 재도입" 요건을 문자 그대로 충족하지
    않는다(완료된 plan 문서 수준의 결정). (2) 번복에 측정 근거가 딸려 있고 은폐 방지 강제가
    코드·뮤테이션으로 검증됐다(라운드 2 에서 뮤테이션이 오히려 더 보강됐다). (3) developer 가
    권한 경계를 지키며 완결된 형태의 백로그 항목을 이미 등재했다 — spec 을 직접 고치는
    월권을 하지 않았다.
  - 라운드 2(`938060138`) 이후에도 변동 없음: 이 커밋은 review-citations 경로 표기·
    `collectEnvDeclarations` 뮤테이션 갭만 다뤘고 `spec/**`·`plan/in-progress/
    guide-identifier-existence.md`·`spec-draft-nullable-notation-followups.md` 는 건드리지
    않았다(`git show --stat 938060138` 확인). 즉 이 WARNING 은 라운드 3(14:41)·라운드
    4(15:03)에 이어 **라운드 5(현재)에도 동일하게 열려 있다** — 코드 성숙(뮤테이션 보강)과
    무관하게 spec 승격 여부는 planner 턴 전까지 바뀌지 않는 항목이다.
  - 왜 지금도 표면화해야 하는가: 같은 가드 계열(`#1330`→`#1331`)은 바로 이전 완료
    plan(`guide-error-code-truth.md §J`·§K)에서 "등재했다고 처분 표에 적고 실제로는 안 썼다"
    가 세 번 반복된 전력이 있다. 이번 PR 은 백로그 항목 자체를 완결되게 작성해 재발 확률을
    낮췄지만, spec 문서는 여전히 "가드가 3건"이라고 말하는 상태(§2 표 미갱신)가 유지된다.
    developer 쪽에서 할 수 있는 조치(뮤테이션·재현 테스트·백로그 초안 완결)는 이미 다 됐고,
    남은 것은 순수히 planner 턴의 몫이다 — push 게이트(`--impl-done`) 는 이 WARNING 을
    이유로 차단하지 않으며(BLOCK:NO 로 이미 관측됨), CRITICAL 이 아니므로 이 PR 을 막을
    근거는 아니다.
  - 제안: planner 턴에서 `spec/conventions/user-guide-evidence.md` 를 한 번에 갱신 —
    (1) §2 표에 `guide-identifier-existence.test.ts`(+`guide-identifier-scan.ts`) 및
    `guide-sanitized-message-parity.test.ts` 행 추가, (2) frontmatter `code:` 목록에 세 파일
    추가, (3) 신규 `## Rationale` 항목 — ① "왜 이 가드는 '허용목록 없음' 원칙을 유지하지
    못했는가"(문맥 게이팅이 가드 존재 이유였던 결함을 못 잡음, 실측표), ② "왜 이번
    허용목록은 `guide-error-code-truth.md §D` 가 기각한 것과 다른가"(4강제 + 뮤테이션
    검증으로 은폐 불가). 초안은 `spec-draft-nullable-notation-followups.md` 해당 항목에
    이미 있으므로 복붙 수준이다.

- **[INFO]** 부분 재도입은 `#1330`(`guide-error-code-truth.md §D`)이 기각한 이유 중
  **frontend 자기증명 오염** 부분은 그대로 보존하고 있다 — 완전한 재도입은 아니다
  (직전 라운드 대비 미변경)
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts`
    (`// frontend 소스는 **넣지 않는다**` 취지 주석) · `guide-identifier-scan.ts`
  - 과거 결정 출처: `plan/complete/guide-error-code-truth.md §D` — "frontend 소스를
    기준집합에 넣으면 가이드가 인용한 이름이 프런트 라벨 맵으로 자기를 증명한다."
  - 상세: `#1330` 이 기각한 대안은 두 요소의 결합이었다 — (a) 전수 열거(백틱 무조건) +
    (b) 그 결과 필요해지는 기준집합 확장(frontend 소스 포함, 자기증명 오염). 이번 PR 은
    (a)는 채택하지만 (b)는 명시적으로 계속 거부한다 — 기준집합은 backend·packages ∪ env
    선언처로 한정한다. 기각 사유가 분리 가능한 두 요소 중 하나만 남았음을 실측으로
    확인하고 선택적으로 뒤집은 것이며, 통째로 되살린 것이 아니다.
  - 제안: 없음 — 위 WARNING 항목의 Rationale 신설 시 이 구분("무엇을 뒤집고 무엇을
    보존했는가")을 한 문장으로 포함할 것.

## 요약

이번 diff(`spec/conventions/**` 델타 0, 라운드 2 포함 누적)는 기존 spec 문서의
`## Rationale` 을 직접 위반하지 않는다 — `user-guide-evidence.md`·`error-codes.md` 어디에도
이번 변경과 충돌하는 기존 spec Rationale 항목이 없다(이 가드 가족 자체가 애초에 그 문서들에
미등재). 그러나 이번 구현은 완료된 plan 문서(`guide-error-code-truth.md §D`)에만 기록돼
있던 설계 원칙("허용목록 없음")을 실측 근거를 갖춰 명시적으로 뒤집으면서도, 그 근거를
CLAUDE.md 가 정한 자리(spec `## Rationale`)로 아직 승격하지 않았다. 절차(권한 경계 준수,
planner 백로그에 완결된 초안 위임)는 옳고 번복 자체에도 근거가 있으며, 라운드 2 는 이
지점과 무관한 별도 지적(review-citations 표기·뮤테이션 갭)만 해소했다 — 이 WARNING 은
세 라운드 연속(14:41 → 15:03 → 15:23) 동일하게 열려 있고 developer 쪽 조치는 이미 완료된
상태라 이후 조치는 순수히 planner 턴의 몫이다. 같은 가드 계열이 직전 완료 plan 에서
"등재했다고 적고 안 했다"를 세 번 반복한 전력이 있어, 이 공백이 다음 planner 턴에서
표·frontmatter·Rationale 을 한 번에 처리하지 않으면 네 번째 반복이 될 위험이 남는다. 반면
기준집합 확장(frontend 미포함 유지)은 과거 기각 사유 중 자기증명 오염 축을 정확히 보존하고
있어 그 자체로는 원칙 위반이 아니다.

## 위험도

MEDIUM
