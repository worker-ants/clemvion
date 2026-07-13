# 유지보수성(Maintainability) 리뷰 결과

본 델타는 F-1 review-fix(JSDoc 주석 + 테스트 assertion) + doc-sync. 실제 애플리케이션 코드 변경은
`interaction.service.ts` 클래스 JSDoc 갱신(로직 변경 없음)과 `hooks.service.spec.ts` 회귀 가드
assertion 1건뿐이며, 나머지(CHANGELOG.md, plan md, spec 3편, `review/**` 산출물)는 문서/리뷰 아카이브다.

## 발견사항

- **[WARNING]** 회귀 가드 assertion 이 파일 내 유일하게 `mock.calls[]` 직접 인덱싱 + 인라인 타입 캐스팅 패턴을 도입 — 기존 `objectContaining` 관용구와 불일치
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:817-822`
    ```ts
    const dtoArg = interactionService.interact.mock.calls[0][1] as {
      nodeId?: string;
    };
    expect(dtoArg.nodeId).toBeUndefined();
    ```
  - 상세: `hooks.service.spec.ts` 전체에서 `interactionService.interact` 호출 검증은 예외 없이
    `expect(interactionService.interact).toHaveBeenCalledWith(expect.objectContaining({...}), expect.objectContaining({...}))`
    형태를 쓴다(같은 테스트의 바로 위 807~816줄 포함, `grep -n ".mock.calls\["` 결과도 이 한 줄이 파일
    전체에서 유일). 이번에 추가된 3줄은 그 관용구 대신 `.mock.calls[0][1]` 로 직접 배열 인덱싱한 뒤
    구조적 타입 리터럴로 캐스팅하는 새 패턴을 쓴다. 필요성 자체는 이해된다 — `interactionService` 목
    타입이 `interact: jest.MockedFunction<() => Promise<void>>` (569~571줄)로 실제 시그니처
    `interact(ctx, dto)` 를 반영하지 않아 `mock.calls[0]` 이 `never[]` 로 추론되므로 캐스팅이 불가피했을
    수 있다. 다만 검증하려는 것("두 번째 인자 dto 에 `nodeId` 가 없다")은 기존 `objectContaining` 블록에
    `nodeId: undefined` 한 줄을 추가하는 것으로도 동일하게 표현 가능하다(Jest 의 `objectContaining` 은
    프로퍼티 부재와 명시적 `undefined` 를 `equals()` 로 동일하게 취급). 새 패턴이 이후 다른 테스트가
    참조할 선례가 되면 파일의 관용구가 두 갈래로 갈릴 위험이 있다.
  - 제안: 가능하면 기존 `toHaveBeenCalledWith(..., expect.objectContaining({ command: 'submit_message', message: 'my answer', nodeId: undefined }))` 형태로 흡수해 관용구를 하나로 유지. 그대로 둔다면 최소한 목 타입(`interact: jest.MockedFunction<() => Promise<void>>`)을 실제 시그니처에 맞춰 좁혀 `as` 캐스팅을 없애는 편이 타입 안전성 면에서 더 낫다(파일 전역 영향이라 별도 후속으로 검토 가능).

- **[INFO]** dispatch 매핑 표가 세 곳(class JSDoc·`spec/data-flow/15-external-interaction.md`·`spec/5-system/4-execution-engine.md`)에 거의 동일한 문구로 존재 — 수동 동기화 부담
  - 위치: `interaction.service.ts:84-90`(class JSDoc), `spec/data-flow/15-external-interaction.md`(같은 표), `spec/5-system/4-execution-engine.md` §7.5.1(내용 참조)
  - 상세: 이번 diff 는 세 곳 중 두 곳(JSDoc, data-flow spec)을 함께 `expectedNodeId` 반영으로 갱신해 드리프트를 해소했다는 점에서 doc-sync 자체는 잘 수행됐다. 다만 구조적으로 동일 정보가 세 위치에 나열되는 형태는 유지되므로, 향후 dispatch 시그니처가 다시 바뀌면 세 곳을 모두 손봐야 한다. 직전 리뷰 라운드(`review/code/2026/07/14/01_09_10/maintainability.md`)에서 이미 같은 패턴을 INFO 로 지적했고 이번 delta 가 그 지적대로 정확히 동기화를 수행했다는 점은 긍정적이나, 구조 자체는 변하지 않았다.
  - 제안: 지금은 문제 없음. 이후 이 표가 더 자주 바뀔 경우, 코드 JSDoc 은 "표는 spec §7.5.1 SoT 참조" 수준으로 축약하고 상세 표는 spec 한 곳에만 두는 편을 고려(직전 라운드 제안과 동일).

- **[INFO]** JSDoc 갱신 내용은 실제 구현(`interact()` 본문의 4개 `continueX(..., expectedNodeId)` 호출)과 정확히 일치, 가독성 양호
  - 위치: `interaction.service.ts:84-90` vs `:112-160` 구현부
  - 상세: 순수 주석 변경이며 로직 변경이 없다. 4줄 매핑 각각에 `expectedNodeId` 인자가 정확히 추가됐고, 상단 설명 문장("외부 scope 는 `expectedNodeId`(=`dto.nodeId`)를 함께 넘겨 … in_process_trusted 는 undefined")도 실제 `expectedNodeId = isInternalCtx(ctx) ? undefined : dto.nodeId` 로직과 정합한다. 오래된 주석(stale comment) 문제를 정확히 해소했다.

## 요약

이번 델타는 코드 로직 변경이 없는 review-fix(JSDoc 주석 정합화, 회귀 가드 테스트 1건 추가)와 문서 동기화(CHANGELOG·plan·spec 3편)로, 유지보수성 관점에서 구조적 위험은 없다. class JSDoc 은 실제 구현과 정확히 재정합됐고, `hooks.service.ts` 의 `nodeId: 'chat-channel'` placeholder 제거를 지키는 회귀 테스트도 의도가 주석으로 잘 설명되어 있다. 다만 새 assertion 이 파일 내 다른 어디에도 없는 `mock.calls[]` 직접 인덱싱 + 인라인 캐스팅 패턴을 도입해 기존 `objectContaining` 관용구와 갈라진 점은 사소하지만 실제 불일치이며, 이후 이 스니펫이 복붙 선례가 되지 않도록 정리하는 편이 좋다. dispatch 매핑 표의 3-way 문서 중복은 직전 라운드부터 알려진 구조적 특성으로 이번에 정확히 동기화됐을 뿐 새로 악화되지는 않았다.

## 위험도

LOW
