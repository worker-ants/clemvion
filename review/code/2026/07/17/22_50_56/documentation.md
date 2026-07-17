### 발견사항

- **[INFO]** `spec/conventions/interaction-type-registry.md` 의 "grep" 잔존 표현이 이번 AST 전환 후 문자 그대로는 다소 부정확해짐
  - 위치: `spec/conventions/interaction-type-registry.md` §1.2 rule 3 ("등록된 **grep 대상 파일**"), §2.1 `system_error`/`rag` 행 ("**grep 검증 대상**", "grep 가드 비대상"), §5 Rationale ("코드 **grep 결과**를 build 단계에서 비교"), §5 마지막 문단("등장하는지 **grep** 한다")
  - 상세: 이 문서는 가드를 1차 명칭으로 "AST 가드"라 부르면서도(§1.2/§2.1/§5, 5회) 검증 동작 자체는 "grep"으로 서술해왔다. 종전 구현(정규식 매칭)에서는 이 서술이 문자 그대로 맞았지만, 이번 변경으로 실제 TS 컴파일러 API 파싱이 되면서 "grep"이라는 단어는 이제 문자 그대로는 부정확하다(§1.2, §2.1, §5 총 6곳). 다만 이는 이번 코드 변경이 새로 만든 문제가 아니라 기존 spec 서술의 정밀도 문제이고, developer 는 `spec/` read-only(CLAUDE.md)라 이번 PR 범위 밖이다.
  - 근거: 세션에 동봉된 `review/consistency/2026/07/17/19_54_00/SUMMARY.md` 의 INFO #1과 각 checker(`convention_compliance.md`, `cross_spec.md`, `rationale_continuity.md`, `plan_coherence.md`)가 이미 독립적으로 동일 사실을 지적했고, `plan/in-progress/interaction-type-guard-comment-false-negative.md` 의 "## 후속 (본 PR 범위 밖)" 섹션에 project-planner 위임 대상으로 명시적으로 기록돼 있다. 조치가 이미 계획돼 있으므로 이 리뷰가 추가로 요구할 것은 없다 — 재확인 차원의 기록.
  - 제안: 이번 PR 에서 조치 불필요(이미 후속으로 추적됨). project-planner 트리비얼 doc-sync 시 §1.2 rule 3 / §2.1 두 행 / §5 두 문장의 "grep" 계열 표현을 "AST 파싱"/"등록 사이트 스캔" 등으로 정정 권장.

- **[INFO]** 대상 테스트 파일 자체의 주석/JSDoc은 이번 변경에서 이미 정확히 갱신됨 — 오래된 주석 없음
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts`
  - 상세: 종전 두 JSDoc 헤더의 "AST/grep guard"·"grep-finds string literals" 서술과 `ENUM_VALUES` 위 "Known limitation: the grep matches backtick-quoted mentions too..." 주석(스스로 결함을 서술하던 부분)이 이번 diff 에서 각각 "AST guard"·"parses ... asserts every enum value appears as a string literal **in code**"로, known-limitation 문단은 완전히 삭제로 정확히 갱신됐다. 실제 파일(`grep -n "Known limitation\|grep matches backtick" .../interaction-type-exhaustiveness.test.ts`)에서 잔존 문구 0건을 확인했다 — 주석 정확성 기준을 충족한다.
  - 제안: 없음(확인 완료, 긍정적 발견).

### 인라인 문서화 품질 (긍정적 관찰)

- 신설 `collectCodeStringLiterals` 함수의 JSDoc이 "왜 정규식이 아니라 TS 파서인가"를 PR #968 실측 사례(주석의 백틱·홑따옴표 인용이 실제 분기 파손을 가려 green 유지되던 구체 사례, 파일·행 수준 인용)까지 근거로 상세히 남겨, 복잡한 로직에 대한 인라인 설명 기준을 잘 충족한다. 대안(따옴표 종류 제한, `=== "x"`/`case "x":` 형태 우선 매칭)이 왜 기각됐는지도 함께 기록돼 향후 동일 재검토를 막는다.
- 신설 자기검증 `describe("collectCodeStringLiterals", ...)` 테스트에도 "이 테스트가 없으면 향후 리팩터가 주석 false-negative를 조용히 재도입해도 아래 가드들이 계속 green일 것"이라는 목적 설명이 JSDoc으로 명시돼 있어, 테스트 자체의 존재 이유가 코드만 봐서는 알기 어려운 회귀 방지 계약임을 잘 전달한다.
- `plan/in-progress/interaction-type-guard-comment-false-negative.md`는 배경·기각된 대안·양방향 mutation 실측 표(대조군 포함)·false-fail 없음 실측까지 기록해 결정 근거를 추적 가능하게 했다. `.claude/docs/plan-lifecycle.md` 관례에 부합하는 수준의 문서화.

### README / API 문서 / CHANGELOG / 설정 문서 / 예제 코드

- README 업데이트 불요: 신규 기능·설정·공개 API 변경 없음(테스트 내부 파싱 메커니즘 교체).
- API 문서 불요: 엔드포인트 변경 없음.
- CHANGELOG 불요: 순수 내부 가드 메커니즘 교체(사용자 가시 동작·spec 계약 무변경)로, `CHANGELOG.md`에서 유사한 과거 PR(#968/#969, 동일 파일 대상)도 항목이 없어 저장소 관례와 일치한다.
- 신규 환경변수·설정 없음: N/A.
- 예제 코드 불요: 신규 자기검증 테스트(`describe("collectCodeStringLiterals", ...)`)가 사실상 `collectCodeStringLiterals`의 사용 예제 역할을 겸한다.

### 요약

문서화 관점에서 이번 변경은 모범적인 수준이다. 테스트 파일 자체의 JSDoc·인라인 주석은 정규식→AST 전환에 맞춰 정확히 갱신됐고(오래된 주석 없음, 확인됨), 신설 함수·자기검증 테스트 모두 "왜 이렇게 했는가"를 구체적 실측 근거(PR #968 사례)와 함께 남겨 인라인 문서화 기준을 초과 달성했다. plan 문서도 배경·대안·mutation 실측까지 상세히 기록했다. 유일한 잔여 사항은 `spec/conventions/interaction-type-registry.md`의 "grep" 계열 서술이 이번 전환으로 문자 그대로는 다소 부정확해진다는 점이나, 이는 developer 권한 밖(spec read-only)이고 이미 plan 문서·5개 consistency checker가 독립적으로 project-planner 후속 과제로 명시 추적하고 있어 이번 PR 을 막을 사유가 아니다. README·API 문서·CHANGELOG·설정 문서·예제 코드는 이번 변경의 성격(내부 테스트 가드 메커니즘 교체)상 해당 없음이 맞다.

### 위험도
NONE
