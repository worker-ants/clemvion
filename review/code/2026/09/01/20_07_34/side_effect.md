# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `lint` 스크립트 quoting 이 6개 패키지에서 실제 lint 스코프를 확장한다 — 의도된 부작용이지만 "인터페이스 변경" 항목상 기록
  - 위치: `codebase/packages/ai-end-reason/package.json:11`, `codebase/packages/chat-channel-validation/package.json:11`, `codebase/packages/expression-engine/package.json:11`, `codebase/packages/graph-warning-rules/package.json:11`, `codebase/packages/masked-markers/package.json:11`, `codebase/packages/node-summary/package.json:11` (모두 `"lint": "eslint src/**/*.ts"` → `"lint": "eslint \"src/**/*.ts\""`)
  - 상세: 단순 quoting 이 아니라 **글롭 확장 주체가 바뀐다**. `pnpm lint` 는 스크립트를 셸(POSIX `sh`/`bash`, globstar 기본 off)로 실행하는데, 따옴표 없는 `src/**/*.ts` 는 이 셸에서 "한 단계 하위 디렉터리"만 매치하는 일반 글롭으로 축소 해석된다 — 실측:
    ```
    $ cd codebase/packages/expression-engine && bash -c 'echo src/**/*.ts'
    src/__tests__/*.ts src/functions/*.ts   ← src/ 바로 아래 top-level *.ts(parser.ts, errors.ts, tokens.ts, ast.ts, evaluator.ts, tokenizer.ts, index.ts, disambiguate-labels.ts) 는 매치되지 않음
    ```
    즉 **개정 전 스크립트는 `src/` 최상위 파일들을 사실상 lint 하지 않고 있었다** — 이번 PR 의 `parser.ts:317` `no-case-declarations` 미검출 원인이 정확히 이것이다(plan `expression-engine-error-shape-spec-broken-on-main.md` 가 원인을 "로컬-CI 툴체인/설치 방식 차이"로 잠정 지목했지만, 이 셸 글롭 축소가 더 직접적인 메커니즘일 가능성이 크다). quoting 하면 eslint 자체의 재귀 글롭 엔진이 패턴을 해석해 최상위 파일까지 전부 포함된다.
    이 변경은 `expression-engine` 뿐 아니라 **함께 quoting 된 나머지 5개 패키지의 lint 대상도 동시에 넓힌다.** 다른 4개 패키지(`ai-end-reason`, `graph-warning-rules`, `masked-markers`, `node-summary`)에도 `src/__tests__/`·`src/rules/` 같은 하위 디렉터리가 있어 같은 축소가 있었다.
    **실측 검증**: quoted 패턴으로 5개 미수정 패키지 전부에 `eslint "src/**/*.ts"` 를 직접 실행 — 전부 0 에러로 통과(신규 lint 위반 없음). `expression-engine` 도 이번 PR 의 `parser.ts` 수정과 합쳐 통과. 즉 스코프 확장 자체는 **현재 시점엔 안전**하지만, 이 PR 의 diff 만 보면 "quote 를 더했다" 로 보이는 1줄 변경이 실은 6개 패키지 CI lint job(`packages-checks.yml` matrix)이 검사하는 파일 집합을 조용히 넓히는 변경이라 향후 이 패키지들에 새 최상위 파일이 추가될 때 지금까지 안 걸리던 lint 룰이 처음으로 걸릴 수 있다.
  - 제안: 조치 불요(실측상 회귀 없음). 다만 PR 설명·커밋 메시지에 "lint 스코프가 넓어진다"는 사실을 한 줄 남겨 두면, 이후 이 패키지들에서 새로운 lint 실패가 나타났을 때 "왜 갑자기?"로 재조사하는 비용을 줄일 수 있다.

- **[INFO]** 필드시스템 부작용 — `plan/in-progress/spec-draft-avatar-storage-key.md` 삭제 + `plan/complete/spec-draft-avatar-storage-key.md` 신규 생성 (git 상 `git mv` 아닌 delete+add, blob hash 상이)
  - 위치: `plan/in-progress/spec-draft-avatar-storage-key.md` (삭제) / `plan/complete/spec-draft-avatar-storage-key.md` (신규)
  - 상세: 이 저장소 CLAUDE.md/메모리는 "plan 은 체크와 `complete/` 이동이 한 동작이어야 한다"·"이동은 언제나 실제 완료 반영과 동시" 라고 규정한다. 이번 변경은 파일 이동과 함께 완료 배너·frontmatter(`status: in-progress` → `applied`, `completed: 2026-09-01` 추가)를 갱신했으므로 그 규약에 부합하는 **의도된** 파일시스템 변경이다. 부작용 관점에서 문제는 없으나, `git mv` 가 아니라 add+delete 형태라 커밋 시 두 pathspec 을 각각 add 해야 하며 — 사용자 메모(`git mv + multi-pathspec add = 침묵 stale 커밋`)가 지적하는 실패 패턴과 같은 조작이므로, 커밋 직후 `git show HEAD:plan/complete/spec-draft-avatar-storage-key.md` 로 실제 반영을 확인할 필요가 있다(코드 리뷰 범위 밖이라 여기선 확인만 권고).
  - 제안: 커밋 후 `git show HEAD:<new-path>` 로 내용이 stage 된 그대로인지 1회 확인.

- **[NONE]** `parser.ts` 의 `case TokenType.LParen: { ... }` 블록화는 스코프만 도입하고 실행 순서·반환값·부작용이 동일 — 런타임 동작 변화 없음(확인만 하고 별도 발견사항으로 등재하지 않음).
- **[NONE]** `error-shape.spec.ts` 의 타입 유도(`SubclassName`/`ErrorsModule`) 변경은 컴파일 타임 타입 좁히기일 뿐 `Object.entries(errors).filter(...)` 의 런타임 필터 바디(`typeof value === 'function' && value !== ExpressionError && value.prototype instanceof ExpressionError`)는 그대로다 — 테스트가 실제로 순회하는 클래스 집합에 변화 없음.

## 요약

이번 changeset 은 대부분 부작용 표면이 낮다 — parser.ts 의 `case` 블록화와 error-shape.spec.ts 의 타입 유도는 런타임 동작이 동일함을 확인했고, plan 문서 이동은 규약에 맞는 의도된 파일시스템 변경이다. 유일하게 실질적인 부작용은 6개 패키지 `package.json` 의 `lint` 스크립트 quoting인데, 이는 겉보기엔 사소한 quoting 이지만 **셸 글롭 확장 방식이 바뀌어 lint 대상 파일 집합이 실제로 넓어지는 인터페이스 변경**이다(직접 실측: quote 없이는 `src/` 최상위 `.ts` 파일이 애초에 lint 대상에서 빠져 있었다). 5개 비수정 패키지에 대해 quoted 글롭으로 직접 eslint 를 실행해 신규 위반이 없음을 확인했으므로 현재 시점 회귀는 없지만, 향후 이 패키지들에 파일이 추가될 때 처음으로 걸리는 lint 실패의 원인이 "이번 quoting" 임을 추적하기 쉽도록 기록해 둘 가치가 있다. 전역 상태·환경 변수·네트워크 호출·시그니처/공개 API 변경·이벤트 콜백 관련 부작용은 발견되지 않았다.

## 위험도

LOW
