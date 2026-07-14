# 유지보수성(Maintainability) 리뷰 결과

## 스코프 확인

본 델타는 3개 파일 · 4개 위치의 **주석/JSDoc 전용** 정합화이며 실행 로직 변경은 없다 (payload 명시 + diff 직접 확인 완료).

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `resolveWaitingNodeExecutionId` JSDoc `@param expectedNodeId` 설명 교체.
- `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` — F-1 테스트 케이스 상단 설명 주석 교체.
- `codebase/backend/src/modules/external-interaction/interaction.service.ts` — `interact()` 내부 인라인 주석 + `assertNodeId` JSDoc 2곳 교체.

공통 변경 내용: "`in_process_trusted`(chat-channel) 면제 사유 = nodeId 를 모르기 때문" 이라는 기존 서술을 "**scope 단위**(정책적) 면제이며 nodeId 가용 여부와 무관" 으로 정정. 함수 길이·중첩·매직 넘버·중복 로직·순환 복잡도 항목은 로직 변경이 없어 해당 없음(N/A) — 이하 가독성·정합성·일관성 관점만 평가.

## 발견사항

- **[INFO]** `handleFormStep` 참조로 주석 신뢰도 검증 완료 — 정확한 정정
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:120` (`interact()` 인라인 주석)
  - 상세: 새 주석은 "form 제출 `handleFormStep` 은 nodeId 를 알아도 동일 policy 로 면제" 라고 명시한다. `codebase/backend/src/modules/hooks/hooks.service.ts:888-892` 를 확인한 결과 `handleFormStep` 은 실제로 `nodeId: formState.nodeId` (알려진 값)를 `interact()` 에 전달하면서도 `scope: 'in_process_trusted'` 이므로 `isInternalCtx(ctx)` 분기에서 `expectedNodeId` 가 `undefined` 로 무시된다. 기존 주석("nodeId 미상이라 면제")은 이 케이스를 설명하지 못하는 부정확한 서술이었고, 이번 정정이 실제 코드 동작과 일치한다. 또한 "scope" 용어는 `interaction.guard.ts` 의 `InteractionScope` / `ctx.scope` 와 동일 어휘를 재사용해 코드베이스 기존 개념과 자연스럽게 정렬된다.
  - 제안: 없음 — 정정 방향이 정확하고 근거도 검증됨. 순수 긍정 사례로 기록.

- **[INFO]** 4개 위치 간 문구의 사소한 문법적 불일치
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5278-5279` vs `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:1361-1362`
  - 상세: 두 곳 모두 "nodeId 가용 여부(와) 무관" 을 표현하지만 조사가 다르다 — execution-engine.service.ts 는 "nodeId 가용 여부와 무관", interaction.service.spec.ts 는 "nodeId 가용 여부 무관" (조사 "와" 누락). 의미 차이는 없으나 동일 불변식을 설명하는 4곳의 문장이 토씨 단위까지 완전히 통일되어 있지는 않다.
  - 제안: 사소하여 별도 커밋 불필요. 향후 동일 주석을 재차 손댈 일이 생기면 4곳을 한 번에 동일 문구로 맞추는 정도로 충분.

- **[INFO]** 동일 불변식이 4곳에 중복 서술되는 기존 구조(본 델타가 새로 만든 문제는 아님)
  - 위치: `execution-engine.service.ts` JSDoc, `interaction.service.ts` 인라인 주석 + `assertNodeId` JSDoc, `interaction.service.spec.ts` 테스트 주석
  - 상세: "`in_process_trusted` 는 scope 단위로 nodeId 검사 면제" 라는 동일 규칙이 파일 3개·위치 4곳에 각각 산문으로 반복 서술된다. 이번 델타는 기존에 있던 중복 서술 4곳을 정합되게 함께 고쳤다는 점에서 오히려 모범적으로 처리됐지만, 구조 자체는 향후 규칙이 다시 바뀔 때마다 4곳을 빠짐없이 찾아 고쳐야 하는 유지보수 부담을 그대로 안고 있다. `assertNodeId` JSDoc 한 곳을 canonical 설명으로 삼고 나머지 3곳은 `{@link assertNodeId}` 류의 짧은 참조로 축약하는 리팩터를 장기적으로 고려할 만하다.
  - 제안: 이번 PR 범위에서 조치 불필요(주석 전용 정합화 목적에 부합). 후속 문서 정리 백로그로만 남길 것을 제안.

## 요약

본 델타는 로직 변경 없는 순수 주석/JSDoc 정합화로, "`in_process_trusted` 면제 사유가 nodeId 미상이 아니라 scope 단위 정책"이라는 더 정확한 서술로 4개 위치를 일관되게 교정했다. `hooks.service.ts` 의 `handleFormStep` 실제 호출부와 대조한 결과 새 주석이 실제 동작(알려진 nodeId 를 가지고도 scope 로 면제됨)과 정확히 일치함을 확인했고, "scope" 용어도 `InteractionScope` 기존 타입과 정렬돼 가독성·정확성이 순수하게 개선됐다. 4곳 간 조사(토씨) 수준의 사소한 불일치와, 동일 규칙이 여러 파일에 산문으로 중복 서술되는 기존 구조(이번 델타가 새로 만든 문제는 아님)만 경미하게 관찰된다. 유지보수성 관점에서 리스크는 없다.

## 위험도

NONE
