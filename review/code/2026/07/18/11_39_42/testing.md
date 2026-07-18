# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `.tsx` 오탐 방지(JSX 오인식)만 테스트되고, `scriptKindForFile` 자신의 docstring 이 명시하는 반대 방향 리스크(`.ts` 파일 안의 `<Config>{...}` 형 타입 단언이 TSX 로 잘못 파싱되면 리터럴이 유실된다)는 테스트로 고정되지 않았다.
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts` L44-46 (`scriptKindForFile` 주석), L173-196 (`.tsx` 케이스만 존재)
  - 상세: `scriptKindForFile` 의 JSDoc 은 "the reverse drops literals outright (a `<Config>{ … }` cast parsed as TSX loses its object)" 이라고 명시적으로 리스크를 서술한다. 그런데 새로 추가된 self-test 는 `.tsx` 사이트가 JSX 를 올바르게 인식하는 방향(정방향)만 `treeContainsJsx` 로 구조적으로 검증하고, `.ts` 사이트에 각괄호 타입 단언이 있을 때 그 리터럴이 살아남는지(역방향)는 검증하지 않는다. plan 문서(`plan/in-progress/interaction-type-guard-comment-false-negative.md`)의 mutation 표에도 "`scriptKind` 하드코딩 변조"라고만 되어 있어 방향성이 불명확 — TSX 로 전역 하드코딩하는 mutation 을 걸었어도, 현재 등록 사이트들이 각괄호 캐스트 문법을 안 쓰는 스타일(대개 `as Foo` 관용)이라면 기존 exhaustiveness 테스트가 red 로 안 뜨고 통과해버릴 가능성이 있다 — 즉 "AST 가드가 실제로 이 리스크를 잡는다"는 주장이 미실증 상태로 남는다.
  - 제안: 아래와 같은 fixture 로 역방향 self-test 를 추가한다.
    ```ts
    it("keeps a .ts site's angle-bracket cast literal alive (not mis-parsed as JSX)", () => {
      const tsSite = [
        "interface Config { x: string }",
        'const c = <Config>{ x: "cast_literal" };',
      ].join("\n");
      expect(collectCodeStringLiterals(tsSite, "fixture.ts").has("cast_literal")).toBe(true);
    });
    ```
    이렇게 하면 두 방향(`.tsx`→JSX 인식, `.ts`→캐스트 인식) 모두 구조적으로 잠긴다.

- **[INFO]** `treeContainsJsx` 헬퍼가 검사하는 3가지 JSX 노드 형태(`JsxElement`/`JsxSelfClosingElement`/`JsxFragment`) 중 실제 fixture 로 exercise 되는 것은 `JsxElement`(`<section>...</section>`) 하나뿐이다.
  - 위치: L82-103 (`treeContainsJsx` 정의), L173-196 (유일한 호출부)
  - 상세: 자체-테스트 헬퍼 수준이라 위험도는 낮지만, `JsxSelfClosingElement`/`JsxFragment` 분기는 현재 어떤 테스트로도 true 경로가 실행되지 않는다(coverage 상 dead 는 아니지만 미검증). 실제 등록 사이트가 `<Foo />` 또는 `<>...</>` 형태로 리터럴을 감싸는 경우까지 커버하려면 추가 케이스가 유용하다.
  - 제안: 우선순위 낮음. 필요 시 자체-검증용 별도 유닛 테스트(`describe("treeContainsJsx")`)로 세 분기를 각각 짧게 확인.

- **[INFO]** `scriptKindForFile` 은 `.ts`/`.tsx` 두 갈래만 분기하고, `.mts`/`.cts`/`.mtsx` 등 다른 TS 계열 확장자는 고려하지 않는다.
  - 위치: L44-46
  - 상세: 현재 `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES` 가 전부 `.ts` 이고 새 `.tsx` 케이스도 가상 시나리오라 실질 위험은 낮다. 다만 함수의 fallback 이 "`.tsx` 가 아니면 전부 TS"이므로, 향후 `.mts` 사이트가 등록되면 조용히 TS 로 처리되어(현재도 정상 동작하겠지만) 의도치 않게 맞을 뿐 명시적으로 검증된 계약은 아니다.
  - 제안: 현재 스코프에서는 조치 불요. 등록 사이트 확장자가 늘어나는 시점에 함께 확장.

## 긍정적 관찰

- **Mock 미사용, 실제 파서 사용**: `ts.createSourceFile` 을 직접 호출해 실제 TypeScript 컴파일러 AST 를 만들고 그 트리를 순회한다. mock/stub 이 전혀 없어 "가드가 실제로 파싱 동작에 부합하는가"를 그대로 검증한다 — 실동작과의 괴리 리스크 없음.
- **엣지 케이스 커버리지 우수**: 유니온 타입 멤버·객체 프로퍼티 값·삼항·`return` 등 실제 등록 사이트의 다양한 코드 형태를 "폼별 고유 토큰"으로 고정해 각 syntactic 형태가 개별적으로 검증되도록 설계했다(한 형태가 스캔 누락돼도 다른 형태에서 우연히 통과하는 거짓 양성 방지). 정규식 리터럴(`/…/`) 오염 배제 케이스도 `.includes` 로 "부분 문자열 유출"까지 검증해 `.has` 단독보다 엄격하다.
- **테스트 격리 양호**: 모든 신규 테스트가 로컬 인라인 문자열 fixture 만 사용하고 전역 상태·테스트 간 순서 의존이 없다. `readRepoFile` 을 쓰는 기존 exhaustiveness 테스트와도 독립적으로 실행 가능.
- **가독성·의도 서술 우수**: 각 테스트에 "왜 이 형태를 넣었는지", "이 assertion 이 어떤 회귀를 잡는지"를 주석으로 명시(예: `.includes` vs `.has` 선택 이유, JSX 트리 구조 검증이 필요한 이유). 코드 리뷰만으로 회귀 시나리오를 재구성할 수 있는 수준.
- **회귀 실증(mutation) 문서화**: plan 문서에 실측 mutation 표가 있고, 사전 상태(`ts.ScriptKind.TS` 하드코딩)로는 `treeContainsJsx(tsxSite, ts.ScriptKind.TS)` 가 `false` 임을 같은 테스트 안에서 직접 대조 단언(L194-195) — "고쳤다고 주장"이 아니라 고치기 전 상태가 실제로 실패했음을 코드로 증명한다. 이는 테스트 스위트 자체 신뢰도를 높이는 좋은 패턴.
- **테스트 용이성**: `collectCodeStringLiterals`/`scriptKindForFile`/`treeContainsJsx` 모두 순수 함수(입출력만으로 결정, 파일시스템·전역 상태 의존 없음 — `readRepoFile` 은 별도)라 단위 테스트하기 쉬운 구조. 프로덕션 로직에 대한 의존성 주입이 필요 없을 만큼 이미 잘 분리되어 있다.
- **회귀 안전성**: `fileName` 기반 분기가 기존 등록 사이트(전부 `.ts`)에 대해서는 `ts.ScriptKind.TS` 로 귀결되어 기존 테스트의 판정을 변경하지 않는다 — 하위 호환 유지.

## 요약

이번 변경은 프로덕션 로직이 아니라 가드(테스트) 자신의 정확성을 강화하는 테스트 인프라 변경이다. 실제 TS 컴파일러 API 를 직접 사용해 mock 없이 실동작을 검증하고, `.tsx` JSX 오인식 회귀를 구조적 단언(`treeContainsJsx`)으로 고정했으며 plan 문서에 기록된 양방향 mutation 실측까지 갖춰 "테스트가 실제로 회귀를 잡는가"에 대한 근거가 탄탄하다. 다만 `scriptKindForFile` docstring 이 스스로 언급한 리스크(`.ts` 파일의 각괄호 타입 단언이 잘못 파싱되는 역방향 케이스)는 테스트로 아직 고정되지 않아 비대칭 커버리지 갭이 남아 있다 — 실질 위험은 낮지만(현재 등록 사이트가 해당 문법을 쓰지 않음) 가드의 완전성을 주장하려면 보완이 바람직하다. 그 외 `interaction-type-registry.ts`(주석 문구 정정)와 plan 문서 변경은 테스트 관점에서 별도 조치가 필요 없다.

## 위험도
LOW
