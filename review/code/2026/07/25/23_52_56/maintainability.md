# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** 소스 코드 JSDoc 에 브리틀한(fragile) 원본-줄번호 인용을 새로 도입 — 파일 자체의 §섹션/안정 ID 인용 관례와 불일치
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:236`
  - 상세: 새로 추가된 `abortSignal` 필드 JSDoc 문단이 `config.chatChannel` 변형의 근거를 `1-data-model.md:230` 처럼 **원본 파일의 줄번호**로 인용한다. 같은 파일 안의 다른 모든 spec 인용은 `§7.5`, `§2.13`, `CONVENTIONS Principle 7`, `CCH-AD-05`(요구사항 ID) 처럼 **문서 편집에도 안정적인 앵커**를 쓴다. 실측: `codebase/backend/src`·`codebase/frontend/src` 전체에서 `.md:<숫자>` 형태의 줄번호 인용은 이 한 줄이 유일하다(grep 결과 1건). `spec/1-data-model.md` 의 표에 행이 추가/삭제되면 `:230` 은 조용히 다른 내용을 가리키게 되며, 이를 잡아줄 자동 검증이 없다(§ 앵커와 달리 grep 으로 존재 여부만 확인 가능하고 "정확히 그 문장인지"는 확인 불가).
  - 제안: `1-data-model.md:230` 대신 `spec/1-data-model.md` 의 `Trigger.type` 필드 설명 또는 안정적 식별자(예: 해당 표의 필드명 `type`)로 인용을 바꾼다. 이미 근처에서 `CCH-AD-05` 처럼 안정 ID 를 잘 쓰고 있으므로 동일 패턴을 따르면 된다.

- **[INFO]** 동일 근거 문단이 3개 파일에 사실상 동일 문구로 중복 기재됨
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` (`abortSignal` JSDoc, 게이트 234~240) / `plan/in-progress/node-cancellation-residual-signal-propagation.md` (게이트 35~45) / `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` (게이트 194~208, "추가 위임 #5")
  - 상세: "chat-channel 은 노드가 아니라 webhook 트리거의 config.chatChannel 변형이다 / 구현은 modules/chat-channel/** 어댑터다 / executionEvents$ 구독·outbound 방향(CCH-AD-05) / abortSignal 참조 0건 / execution.cancelled 발송 대상" 이라는 동일 근거 나열이 표현만 조금씩 바뀐 채 세 곳에 반복된다. 코드 JSDoc 은 "living 소스"이고 두 plan 문서는 프로젝트 관례상 시점-고정 의사결정 기록이라는 점을 감안하면 의도된 구조로 보이나, 향후 이 판단이 수정될 경우 세 곳을 모두 사람이 직접 동기화해야 하는 부담은 남는다.
  - 제안: (필수 아님) plan 문서 쪽은 코드 JSDoc 을 링크만 하고 상세 근거는 한 곳(코드 JSDoc 또는 plan)에만 두는 방식도 고려 가능. 다만 plan 라이프사이클상 완료 후 이동되는 기록물이라는 점에서 현행 유지도 무리는 아님.

- **[INFO]** 변경분 자체는 순수 문서/주석 정정 — 로직 변경 없음
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` (`abortSignal` JSDoc), `plan/in-progress/node-cancellation-residual-signal-propagation.md`, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
  - 상세: 이번 diff 는 잘못된 JSDoc 나열("... / chat-channel")을 정정하고 근거를 남긴 것과, 두 plan 문서의 진행상황 갱신뿐이다. 함수 길이·중첩·매직넘버·중복 로직 등 나머지 관점에서 지적할 실질 코드 변경이 없다. `abortSignal` 필드 docblock 이 이제 약 30줄로 길지만, 같은 파일의 다른 필드(`engineResolvedConfigCache`, `rawConfig` 등)도 동일하게 상세한 spec-링크 주석 스타일을 쓰고 있어 파일 컨벤션과 일관되고, 새로운 문제로 보긴 어렵다.

## 요약

이번 변경은 실질적으로 `node-handler.interface.ts` 의 오래된(stale) JSDoc 한 줄을 정정하고 근거를 보강한 것과, 두 개의 plan 추적 문서를 갱신한 것뿐이라 로직 관점의 유지보수성 리스크는 거의 없다. 유일하게 주목할 점은 새로 추가된 JSDoc 문단이 파일 자체가 일관되게 써 온 `§섹션`/안정 ID 인용 관례를 깨고 다른 spec 파일의 **원본 줄번호**(`1-data-model.md:230`)를 인용한 것으로, 이는 저장소 전체에서 유일한 사례이며 대상 파일이 편집되면 조용히 스테일해질 수 있는 브리틀한 참조다. 그 외 동일 근거 문단이 코드 주석과 plan 문서 두 곳에 반복 기재된 점은 프로젝트의 plan 라이프사이클 관례(완료 기록은 동결)를 감안하면 감내할 수준의 중복이다.

## 위험도

LOW
