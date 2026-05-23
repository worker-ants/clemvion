# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1 & 2: `render-tool-provider.ts` / `render-tool-provider.spec.ts`

- **[INFO]** `backfillButtonUuids` 함수 내 `fillButtons` 내부 함수의 타입 캐스팅 반복
  - 위치: `render-tool-provider.ts` — `backfillButtonUuids` 함수 내부 (lines 366–403)
  - 상세: `(b as Record<string, unknown>)`, `(item as Record<string, unknown>)` 등 동일한 타입 어설션 패턴이 `fillButtons` 내부와 carousel items 순회에서 3–4회 중복된다. TypeScript unknown 타입 처리의 현실적인 한계이나, 타입 가드 헬퍼(`isObject`)를 하나 추출하면 반복이 제거된다.
  - 제안:
    ```ts
    const isObject = (v: unknown): v is Record<string, unknown> =>
      v !== null && typeof v === 'object';
    ```
    이후 `isObject(b)` / `isObject(item)` 으로 교체하면 캐스팅 없이 타입 좁히기 가능.

- **[INFO]** `backfillButtonUuids` 함수명과 plan 문서 내 `normalizeButtonIds` 명칭 불일치 (문서 잔재)
  - 위치: `plan/in-progress/render-presentation-button-click-fix.md` §C, §(C) Backend root-cause 정규화
  - 상세: plan 문서는 함수명을 `normalizeButtonIds(type, payload)` 라고 기술하고 있으나 실제 구현은 `backfillButtonUuids` 로 명명됐다. (consistency-check W5 권고를 수용한 결과로 함수명이 변경된 것이나 plan 문서가 업데이트되지 않음.) 코드 자체에는 문제 없고, 새 개발자가 plan 문서를 보고 함수를 찾을 때 혼동 가능.
  - 제안: `render-presentation-button-click-fix.md` §(C) 내 `normalizeButtonIds` 언급을 `backfillButtonUuids` 로 정정.

- **[INFO]** `fillButtons`의 반환 타입이 `unknown` — 호출부에서 타입 정보 손실
  - 위치: `render-tool-provider.ts` lines 366–378
  - 상세: `fillButtons` 가 `unknown` 을 반환하므로 바로 위 `out = { ...out, buttons: fillButtons(out.buttons) }` 등의 할당이 암묵적으로 `unknown` 을 spread 한다. 현재 `out` 의 타입이 `Record<string, unknown>` 이므로 실용적 문제는 없지만, 함수 시그니처만 보면 반환 타입을 추론하기 어렵다.
  - 제안: 반환 타입을 `unknown[]` 또는 `Record<string, unknown>[]` 로 명시하거나 Array 경우만 처리 후 `unknown[]` 반환으로 좁히는 것을 고려.

- **[INFO]** `backfillButtonUuids` 의 guard 패턴이 `buttons`, `items`, `itemButtons` 세 갈래에 걸쳐 구조적으로 유사하나 일부 표현이 다름
  - 위치: `render-tool-provider.ts` lines 381–332
  - 상세: `buttons` 처리는 `(out as { buttons?: unknown }).buttons` 형식, `items` 처리는 `(out as { items?: unknown }).items` 형식, `itemButtons` 처리는 `(out as { itemButtons?: unknown }).itemButtons` 형식으로 세 곳이 거의 동일 패턴을 반복한다. 현재 규모(약 50 LOC)에서는 허용 범위이나, 향후 `gallery` 등 새 type 이 추가될 경우 패턴 확장이 번거로워진다.
  - 제안: `const hasArray = (key: string): boolean => Array.isArray(out[key])` 정도의 로컬 헬퍼로 가드를 통일해 두면 확장 시 1행 추가로 끝남.

### 파일 3 & 4: `presentation-renderers.tsx` / `presentation-renderers.test.tsx`

- **[WARNING]** `isSelected` 가드 변경이 `CarouselContent` 와 `PresentationContent` 두 곳에 동일하게 적용됐으나 두 곳 사이에 공유 헬퍼가 없음 — 중복 로직
  - 위치: `presentation-renderers.tsx` CarouselContent line 249 / PresentationContent line ~512
  - 상세: `const isSelected = selectedButtonId != null && selectedButtonId === btn.id;` 가 두 컴포넌트에 각각 복사돼 있다. 버튼 선택 판별 로직이 앞으로 바뀔 경우(예: 멀티선택, 토글 해제) 두 곳을 모두 수정해야 한다.
  - 제안: 파일 상단에 `const isButtonSelected = (selectedId: string | undefined, btnId: string | undefined): boolean => selectedId != null && selectedId === btnId;` 를 선언해 두 컴포넌트가 호출하도록 리팩터링. 단일 진실 원칙 준수.

- **[INFO]** 테스트 파일에서 인라인 주석이 길고 반복됨
  - 위치: `presentation-renderers.test.tsx` describe 블록 앞 주석 (lines 400–408)
  - 상세: spec 참조 주석(§10.5 / §1 배경 설명)이 매우 상세해 맥락 이해에 도움이 되나, 동일 맥락 설명이 spec.ts 와 tsx 테스트 파일에 산재해 있다. 향후 spec 참조 번호가 바뀌면 두 파일을 동시에 갱신해야 한다. 핵심 one-liner 만 남기고 plan/spec 을 cross-ref 하는 방식이 더 유지보수에 유리하다.
  - 제안: 테스트 주석을 "// spec §10.5 step 3 — backfill guard. See plan/.../render-presentation-button-click-fix.md" 수준으로 줄여도 충분.

- **[INFO]** `backfillButtonUuids` 테스트의 'table / chart / template' 케이스가 단일 `it` 블록에 세 종류 assertion 을 합산
  - 위치: `render-tool-provider.spec.ts` lines 105–136
  - 상세: `table`, `template`, `chart` 세 타입에 대한 검증이 동일 `it` 블록에 있어 테스트 실패 시 어느 타입이 문제인지 메시지만으로 즉시 파악하기 어렵다.
  - 제안: `it.each([['table', tablePayload], ['template', templatePayload], ['chart', chartPayload]])` 또는 개별 `it` 블록으로 분리. 실패 메시지에 타입 이름이 나타난다.

### 파일 5–8: plan 문서 (md)

- **[INFO]** `plan/in-progress/render-presentation-button-click-fix.md` §(C) 의 함수명이 실제 구현(`backfillButtonUuids`)과 다름 (위에서 언급)
  - 위치: plan 문서 line 587 `normalizeButtonIds(type, payload)` 기술
  - 제안: `backfillButtonUuids` 로 정정.

- **[INFO]** `plan/in-progress/spec-draft-presentation-normalize-button-ids.md` 의 worktree frontmatter 가 `render-presentation-button-click-fix-683f3a` 로 명시됐으나, 문서 내 "본 draft 의 적용은 project-planner 가 처리" 라고 되어 있어 실제 적용 worktree 가 어디인지 불명확
  - 위치: plan 문서 frontmatter `worktree` 필드 vs 본문 "project-planner 위임" 기술
  - 상세: plan 라이프사이클 규약상 worktree 는 단일 값이어야 하는데, 문서는 두 가지 주체(developer, project-planner)를 암시한다. 실제로 spec 변경이 동일 worktree 에서 일어났다면 frontmatter 가 정확하고 본문 표현이 과거 의도를 기술하는 것이므로 기능상 문제는 없다.
  - 제안: Closeout 섹션에 spec 갱신이 동일 worktree 에서 완료됐음을 한 줄 기재하면 추적성 향상.

### 파일 9: `_retry_state.json`

- **[INFO]** JSON 파일 끝에 개행 없음 (`\ No newline at end of file`)
  - 위치: diff 마지막 줄
  - 상세: 자동 생성 파일이므로 기능상 무해하나, git diff 출력 시 노이즈가 생기고 일부 toolchain 이 경고를 발생시킬 수 있다.
  - 제안: 생성 코드(orchestrator)가 JSON 직렬화 후 개행을 추가하도록 수정.

---

## 요약

이번 변경은 버튼 클릭 무반응 회귀를 backend UUID 보완(`backfillButtonUuids`)과 frontend 방어적 가드(`isSelected` null 체크) 두 계층으로 동시에 해소한 잘 구조화된 수정이다. 함수명(`backfillButtonUuids`)은 의도를 명확히 나타내고, JSDoc과 인라인 주석으로 spec 참조가 충실히 연결되어 있다. 주요 유지보수 위험은 두 가지다: (1) `isSelected` 판별 로직이 `CarouselContent`/`PresentationContent` 양쪽에 복사돼 있어 향후 변경 시 이중 수정이 필요하고, (2) plan 문서에 구 함수명(`normalizeButtonIds`)이 남아 있어 추적 시 혼동 가능성이 있다. 타입 캐스팅 반복과 테스트 구조는 현재 규모에서는 허용 범위지만 리팩터링 여지가 있다. 전반적으로 유지보수성은 양호하며 핵심 로직의 가독성과 테스트 커버리지는 충분하다.

## 위험도

LOW
