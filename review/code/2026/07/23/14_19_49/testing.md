### 발견사항

- **[INFO]** `output.endReason` fallback 분기가 어떤 fixture 로도 격리 테스트되지 않음 (사전 존재 갭, 이번 diff 로 신규 도입 아님)
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:202` (`const endReason = (result?.endReason as string | undefined) ?? (output.endReason as string | undefined);`) / 대응 테스트 파일 `__tests__/output-shape.test.ts`
  - 상세: `grep -n "endReason:" __tests__/output-shape.test.ts` 결과 모든 fixture 가 `output.result.endReason` (nested) 형태로만 `endReason` 을 싣는다. `?? output.endReason` (top-level, `result` 밖) fallback 을 단독으로 참으로 만드는 fixture — 즉 `hasResultMessages === true` 이면서 `result.endReason` 은 없고 `output.endReason` 만 있는 케이스 — 는 이번에 추가된 "키 부재" 테스트를 포함해 어디에도 없다. 이 fallback 을 통째로 지워도 (`(result?.endReason as string | undefined)` 로만 남겨도) 현재 40개 테스트 중 어느 것도 red 가 되지 않을 것으로 보인다. 함수 JSDoc 은 "생산자 없음" 방어 분기로 `output.interactionType`/`output.conversationConfig` 두 곳만 명시하고, 이 `?? output.endReason` fallback 은 그 목록에 없어 존재 이유가 코드에서 스스로 설명되지 않는다.
  - 제안: 이번 작업 범위(주석/문서 정리 + `endReason` 키 부재 테스트 1건)와는 별건이므로 이 diff 를 막을 사유는 아니다. 다만 `isConversationOutput` 을 이미 "판정 분기 전량 mutation 고립" 대상으로 삼은 플랜(`plan/in-progress/output-shape-comment-followups.md`)의 취지에 정확히 부합하는 잔여 갭이므로, 후속 편집 시(또는 새 이월 항목으로) `output.endReason`-only 고립 fixture 1건 추가와 JSDoc 방어 목록에 이 분기 언급 여부를 함께 정리할 것을 권한다.

- **[INFO]** 신규 테스트 주석이 "고립 근거"를 넘어 "왜 이 테스트가 유의미한가"(mutation 클래스·tsc 실측)까지 서술 — 이번 작업이 스스로 정한 SoT 위임 규약과 부분적으로 어긋남
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts:61-98` (`rejects result.messages when the endReason key is absent entirely`)
  - 상세: 같은 diff 의 JSDoc(`output-shape.ts`) 말미에 "테스트 파일 주석은 각 fixture 가 **어떤 분기를 고립시키는가**(필드의 존재/부재)만 적고 근거는 이 문서로 위임한다 — 같은 근거를 양쪽에 두면 한쪽만 갱신돼 어긋난다" 는 규약을 새로 명문화했다. 그런데 바로 그 아래 추가된 신규 테스트 자체의 주석은 TS2345 컴파일 실패·R1/R2/R3 mutation 결과 등 `plan/in-progress/output-shape-comment-followups.md` 의 "측정 1" 표와 거의 동일한 내용을 중복 서술한다. 이 내용은 "왜 이 함수가 이 분기를 갖는가"(JSDoc 소관)는 아니지만, mutation 실측치라는 점에서 plan 문서와 두 곳에 같은 근거가 존재하는 상태다 — plan 문서는 완료 후 `plan/complete/` 로 이관되면 사실상 아카이브라 향후 리팩터가 이 테스트의 mutation 클래스 설명만 갱신하고 실측치 원본(plan)은 갱신하지 않아도 아무도 모순을 못 잡는다.
  - 제안: 정보 손실 없이 mutation 실측 결과 자체는 plan 문서(SoT)에 남기고, 테스트 주석에서는 "이 conjunct 를 지워도 관측되지 않는 이유(타입 시스템이 대신 잡음) + 실제로 지키는 리팩터 클래스" 요약 한두 줄 + plan 문서 포인터로 축약하는 것을 고려. 다만 이번 커밋 자체를 막을 정도는 아님(INFO).

- **[INFO]** 새 테스트가 검증하는 대상과 회귀 안전망의 대응 관계가 잘 명시됨 — 특이사항 없음, 긍정 평가
  - 위치: `output-shape.test.ts:61-98`
  - 상세: `raw` fixture 를 직접 실행해 본 결과(`config: {}, output: { result: { messages: [...], turnCount: 1 } }, meta: { model: "m" }`) 다른 5개 OR-분기(top-level `interactionType`/`conversationConfig`, `output.messages`, `output.interactionType`, `meta.interactionType`, `output.conversationConfig`, `status`)가 전부 거짓이 되도록 정확히 고립돼 있어 주석의 "고립 조건" 서술과 실제 fixture 가 일치한다. `plan/in-progress/output-shape-comment-followups.md` 의 R1/R2/R3 mutation 표도 이 테스트가 `endReason ?? "completed"` 류 리팩터와 `typeof endReason !== "string" || has(...)` 반전 리팩터 두 클래스를 정확히 잡고, 단순 conjunct 삭제는 tsc 가 잡는다는 것(TS2345)을 실측으로 구분해 뒀다 — "테스트로 뭘 지키는지" 를 과장하지 않고 정밀하게 경계 지은 드문 사례.

### 요약

이번 변경은 `isConversationOutput`/`output-shape.ts` 의 JSDoc 을 영어/한국어 혼용에서 한국어로 통일하고 근거 서술을 JSDoc 단일 SoT 로 재편한 것, 테스트 파일의 기존 주석 6곳을 "내부 변수명" 대신 "필드 존재/부재" 서술로 정비한 것, 그리고 `endReason` 키 자체가 부재한 경우를 고정하는 신규 테스트 1건(39→40) 추가로 구성된다 — 프로덕션 로직(`isConversationOutput` 본문)은 diff 상 전혀 변경되지 않았다. 신규 테스트는 fixture 를 직접 검증한 결과 고립 조건이 정확하고, 첨부된 plan 문서(`plan/in-progress/output-shape-comment-followups.md`)가 mutation 10건(신규 테스트 대상 3건 + 기존 고립 테스트 7건 회귀) 을 실측해 "R1/R2 는 신규 테스트만 red, R3 은 vitest 로는 무관측이나 tsc 가 막음"까지 근거를 남겨 테스트 추가의 실효성을 통상 이상으로 뒷받침한다. 발견된 것은 이번 diff 범위 밖의 사전 존재 갭(`?? output.endReason` fallback 이 어떤 fixture 로도 격리되지 않음) 과, 신규 테스트 주석이 방금 스스로 정한 "JSDoc=근거 SoT, 테스트 주석=고립 조건만" 규약을 mutation 실측 서술 부분에서 부분적으로 벗어난다는 점 정도이며 둘 다 INFO 수준으로 병합을 막을 사유는 아니다.

### 위험도
LOW
