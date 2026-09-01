# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** plan 체크리스트가 "이 PR 에서 고치지 않는다" 고 명시한 두 항목이, 같은 diff 안의
  실제 코드 변경으로 이미 해소돼 있다 — 체크박스·서술이 갱신되지 않아 plan 과 코드가 서로
  모순된 상태로 커밋됐다.
  - 위치: `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md:124`
    (`- [ ] **\`parser.ts:317\` \`no-case-declarations\`**...`) 와 `:127`
    (`... 이 PR 에서 고치지 않는다: 원인이 환경이면 고칠 대상이 아니고, 무관한 파일을 이
    changeset 에 끌어들이게 된다.`)
  - 상세: 바로 이 changeset 의 `codebase/packages/expression-engine/src/parser.ts:317`
    (`case TokenType.LParen: {` — 블록으로 감싼 수정)이 정확히 이 항목이 "안 고친다" 고 선언한
    바로 그 결함을 고쳤다. plan 문서 자체가 이 체크리스트 항목을 unchecked(`- [ ]`)로 남긴 채
    커밋됐으므로, 이 문서만 읽는 다음 사람은 "parser.ts 는 이 PR 범위 밖" 이라고 오해한다.
  - 제안: 체크박스를 `[x]` 로 바꾸고, "안 고친다" 는 원 결정을 취소선으로 남기되 실제로는
    같은 PR 에서 고쳤다는 사실과 근거(아래 lint 글롭 결함이 진짜 원인이었음)를 정정문으로
    추가한다.

- **[WARNING]** 같은 plan 파일의 "로컬-CI 툴체인 차이" 조사 항목도 마찬가지로 미해결로
  남아 있는데, 실제로는 그 항목의 근본 원인(추정한 Node 버전·설치 방식이 아니라 lint 스크립트의
  따옴표 없는 glob)이 같은 changeset 에서 이미 규명·수정됐다.
  - 위치: `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md:118`
    (`- [ ] **로컬-CI 툴체인 차이 규명** (신규, 2026-09-01)...`) 와 `:122`
    (`... 재개 신호: 이 PR 의 \`packages-checks\` 결과.`)
  - 상세: 이 항목은 "설치 방식이 원인일 것" 이라는 **아직 검증 안 된 가설**로 적혀 있고, "이 PR
    의 CI 결과를 보고 재개" 한다고 되어 있다. 그런데 실제 diff 는 이미
    `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,
    graph-warning-rules,masked-markers,node-summary}/package.json:11` 에서
    `"lint": "eslint src/**/*.ts"` → `"lint": "eslint \"src/**/*.ts\""` 로 6개 패키지 lint
    스크립트를 고쳤다 — 이것은 조사 중이라던 가설에 대한 **답이자 수정**이다. plan 문서가 이
    사실을 반영하지 않은 채 "아직 모른다" 는 진술로 남아, 코드와 plan 이 서로 다른 이야기를
    한다.
  - 제안: 조사 결과("설치 방식 가설은 틀렸고 실제 원인은 따옴표 없는 glob") 와 적용한 수정을
    plan 에 반영해 체크 상태를 갱신한다.

- **[INFO]** 원래 "잔여 2건(residual 2건)" 을 닫는 작업(worktree 명 `close-two-residuals`
  및 커밋 제목 "+ 잔여 2건" 이 시사)이었던 changeset 에, 두 항목보다 큰 세 번째 항목 — 6개
  패키지의 `package.json` lint 스크립트 수정 + `parser.ts` 결함 수정 — 이 별도 plan 문서 없이
  기존 `expression-engine-error-shape-spec-broken-on-main.md` 체크리스트의 unchecked 항목으로만
  흡수됐다.
  - 위치: `codebase/packages/ai-end-reason/package.json:11`,
    `codebase/packages/chat-channel-validation/package.json:11`,
    `codebase/packages/graph-warning-rules/package.json:11`,
    `codebase/packages/masked-markers/package.json:11`,
    `codebase/packages/node-summary/package.json:11`
    (expression-engine 자신의 `package.json:11` 은 원래 대상 패키지라 범위 안)
  - 상세: 이 5개 패키지(ai-end-reason·chat-channel-validation·graph-warning-rules·
    masked-markers·node-summary)는 "expression-engine 컴파일 실패" 라는 원 plan 의 대상과 무관한
    패키지다. 다만 변경 자체는 각 파일 1줄, 기계적으로 동일한 글롭 따옴표 수정이고, 위 WARNING
    2건에서 지적한 근본 원인 규명과 직접 연결되며, 대조군 실측(`tokens.ts` 에 위반 주입 →
    옛 글롭 GREEN/새 글롭 RED)까지 포함해 근거가 견고하다. 판단컨대 무단 리팩토링이 아니라
    발견에 따른 정당한 확장이나, **plan 산출물(체크리스트)이 이 확장을 정확히 반영하지 않은
    채 커밋됐다는 점**이 위 WARNING 의 핵심이다.
  - 제안: 별도 조치 불요 — 위 WARNING 2건의 plan 갱신에 이 범위 확장의 근거를 함께 적으면
    해소된다.

## 긍정적 관찰 (참고용)

- `package.json` 6곳의 변경은 전부 동일한 한 줄(`lint` 스크립트 글롭 따옴표) 뿐이며, 그 외
  포맷팅·의존성·다른 스크립트 변경은 섞여 있지 않다.
- `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` 의 변경은 plan
  체크리스트의 이미 완료 표시(`[x]`)된 "타입 유도로 해소" 항목과 diff 내용이 정확히 일치한다 —
  선언된 범위와 실제 코드가 맞는 사례.
- `parser.ts:315`~`317` 의 수정은 `case` 블록을 중괄호로 감싸는 최소 변경 + 그 이유를 설명하는
  짧은 주석 하나뿐이고, 인접 로직에 대한 부가 리팩토링은 없다.
- `plan/in-progress/spec-draft-avatar-storage-key.md` → `plan/complete/spec-draft-avatar-storage-key.md`
  는 `git diff --name-status` 상 `R096`(rename, 96% 유사)로 처리되며, 완료 배너·인바운드 링크
  정정 외의 본문 재작성은 없다 — 이 PR 이 닫으려던 "잔여 2건" 중 하나로 처음부터 선언된 작업과
  일치한다.

## 요약

핵심 코드 변경(6개 패키지 lint 글롭 따옴표 수정, `parser.ts` 블록 스코프 수정, `error-shape.spec.ts`
타입 유도 전환, avatar plan 문서 이동)은 전부 근거가 뚜렷하고 최소 범위로 적용돼 있어
"의도하지 않은 변경"·"불필요한 리팩토링"으로 보기는 어렵다. 다만 같은 changeset 안에 포함된
plan 문서(`expression-engine-error-shape-spec-broken-on-main.md`)의 체크리스트가 "이 PR 에서
고치지 않는다" · "재개 신호: 이 PR 의 packages-checks 결과"(즉 아직 미해결)라고 명시한 두 항목을,
바로 그 diff 의 코드가 이미 해소해 버려 **plan 이 선언한 범위와 실제로 커밋된 범위가 어긋난 채
남아 있다.** 이는 향후 이 plan 문서만 보고 판단할 사람에게 잘못된 스코프 정보를 준다는 점에서
문서-코드 정합성 관점의 실질적 결함이며, 시정은 plan 체크리스트 갱신만으로 간단히 해소된다.

## 위험도

MEDIUM
