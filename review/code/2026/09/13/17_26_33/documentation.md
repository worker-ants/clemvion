# 문서화(Documentation) 리뷰 — guide-identifier-existence (라운드 8, 라운드 7 CRITICAL 수정 반영 후)

## 검증 방법

이 PR 은 이미 `documentation` 리뷰어가 7라운드 연속으로 통과시킨 이력이 있다(`review/code/2026/09/13/{14_41_14,15_03_06,15_24_12,15_42_54,16_04_15,16_28_47,16_56_29}/documentation.md`). 그래서 이번 라운드는 과거 지적을 반복 나열하지 않고, **라운드 7 이후 실제로 바뀐 자리**(`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`/`plan/in-progress/guide-identifier-existence.md`)를 직접 `Read` 하고 다음을 실측으로 재확인했다:

- `grep -rn "guide-error-code" codebase/ spec/ PROJECT.md CHANGELOG.md` → 4건, 전부 `#1330`/`#1331` 각주가 붙은 의도적 역사 서술(댕글링 참조 0건).
- `grep -n "#1331" codebase/.../guide-identifier-scan.ts codebase/.../guide-identifier-existence.test.ts CHANGELOG.md PROJECT.md` → 0건(검증 불가능한 미확정 PR 번호 잔존 없음, 라운드 6 지적이 실제로 해소됨).
- `CHANGELOG.md`·`PROJECT.md` 의 가드 서술(3축·백틱 전수·베이스라인 0·허용목록 4강제·`MAKESHOP_UNRESOLVED_PATH_PARAM` 예시)을 `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 현재 코드와 대조 — 전부 일치. 특히 `MAKESHOP_UNRESOLVED_PATH_PARAM` 예시는 라운드 7 에서 "왜 통과하는가"의 근거가 바뀌었는데(인용 미탐지 → 이제는 탐지되지만 존재≠방출이라 통과), CHANGELOG/PROJECT.md 의 현재 문구("메시지 접두로만 쓰이는 토큰도 통과한다")는 **바뀐 뒤 근거와 일치**한다 — 낡은 근거를 그대로 옮기지 않았다.
- `spec/conventions/user-guide-evidence.md` §2 를 직접 열어 "가드 3건"이 여전히 이 4번째 가드(`guide-identifier-existence`)를 반영하지 않음을 확인.

## 발견사항

- **[INFO]** SPEC-DRIFT — `spec/conventions/user-guide-evidence.md §2` 가 이 가드 가족의 카탈로그로서 이 PR 이 리네임·확장한 `guide-identifier-existence`(구 `guide-error-code-existence`)를 반영하지 못한 상태로 남아 있다.
  - 위치: `spec/conventions/user-guide-evidence.md:155` ("build-time 가드 3건 (§2)")
  - 상세: `PROJECT.md:300`·`CHANGELOG.md:69-81`은 이 가드를 `user-guide-evidence.md` "가드 가족"의 일원으로 명시적으로 선언하지만, 그 SoT 문서 자신은 이 가드의 존재·3축(`field-table`/`code-field`/`backtick`)·허용목록(`GUIDE_EXTERNAL_VOCABULARY`)을 모른다. 이 갭은 이번 PR 이 새로 만든 것이 아니라 `#1330`(전신 `guide-error-code-existence.test.ts` 최초 도입)부터 있던 선재 결함이다. `developer` 는 `spec/` 쓰기 권한이 없고, 자기-반증형 소정정 예외(조건 1: "developer 자신이 그 문장을 썼다")도 적용되지 않는다 — 이 문서를 developer 가 쓴 적이 없기 때문이다.
  - **이미 조치됨**: `plan/in-progress/guide-identifier-existence.md` §D 에 planner 등재 항목(파일명·스코프·Rationale 초안 포함)으로 이미 기록돼 있고, 지난 7라운드에 걸쳐 매 라운드 독립적으로 재확인되어 왔다(4~10번째 확인, 각 라운드 RESOLUTION.md 참조). 새로운 조치를 요구하지 않는다 — 기록으로만 남긴다.
  - 제안: 다음 `project-planner` 턴에서 §2 표(3건→4건 이상) + frontmatter `code:` 목록 + `## Rationale`("허용목록 없음" 원칙을 이 PR 이 실측으로 번복한 근거)을 한 번에 갱신할 것. 이미 plan 에 초안이 있어 실행 비용은 낮다.

## 전반 평가 — 특기할 만한 강점 (조치 불요, 기록)

이번 diff(및 그 이전 7라운드 누적)는 문서화 관점에서 이례적으로 충실하다:

- `guide-identifier-scan.ts` 상단·각 정규식 JSDoc이 **설계 결정마다** "왜 이 경계인가 · 무엇을 놓치는가 · 어느 방향이 안전한가"를 실측 표와 함께 적었고, 라운드 5~7 에서 그 서술 자체가 틀렸던 자리(예: "모든 백틱"이 실은 "붙어 있는 백틱"만 뜻했던 것)를 **지우지 않고 정정 문단으로 남겨** 같은 결함이 반복 재발하지 않도록 자기참조적 경고를 걸어 두었다(§53-93, §196-221).
- "이 주석을 지우지 말 것" 지시가 한 번 재작성 과정에서 실제로 삭제됐던 사고(§83-93 문단)까지 경위·재발 방지책과 함께 기록해, CLAUDE.md/MEMORY.md 가 요구하는 "오래된 주석 vs 실제 코드 불일치" 점검을 코드 스스로 수행하는 드문 사례다.
- `CHANGELOG.md`/`PROJECT.md`의 가드 카탈로그 서술이 코드의 축 구성·베이스라인·허용목록 강제 조건과 자구까지 일치하며, 예시(`MAKESHOP_UNRESOLVED_PATH_PARAM`)의 근거가 라운드 중 바뀌었음에도 최신 근거로 갱신돼 있다.
- 테스트 파일(`guide-identifier-existence.test.ts`)의 각 `it` 블록이 "왜 이 fixture 가 필요한가 · 어떤 뮤턴트가 생존했었는가 · 판별 fixture가 왜 그 값이어야 갈리는가"를 인라인 주석으로 남겨, 향후 회귀 시 원인 추적 비용이 낮다.

## 요약

라운드 7 CRITICAL(백틱 축이 "모든"을 참칭한 결함)의 수정 이후 상태를 직접 재확인한 결과, 코드 주석·CHANGELOG·PROJECT.md·plan 문서 간 서술이 전부 최신 코드와 일치하며 새로운 CRITICAL/WARNING 급 문서화 결함은 발견되지 않았다. 유일한 잔여 항목은 `user-guide-evidence.md §2` 카탈로그 미등재인데, 이는 developer 권한 밖의 선재 SPEC-DRIFT로 이미 plan 에 등재되어 있고 7라운드 연속 독립 재확인된 사안이라 이번 라운드가 새로 요구할 조치는 없다.

## 위험도

NONE
