# Rationale 연속성 검토 — `--impl-done` RE-RUN

- worktree: `/Volumes/project/private/clemvion/.claude/worktrees/eia-client-context-types-33e771`
- diff-base: `1682777fe..HEAD` (5 commits: `964e887af`, `428134b64`, `dedc411fd`, `52e244034`, `25e098f76`)
- 목적: 3차 resolution 커밋(`25e098f76`)이 doc/comment-only 임을 재확인하고, FINAL 상태가 PR #904(`6483c7292`)의 결정(discriminator-free oneOf, `conversationThread` non-null-normalized key-omission, 런타임 wire 무변경)을 위반하지 않는지 검증.

## 검증 절차

1. `git log --oneline 1682777fe..HEAD` 로 5 커밋 확인.
2. `git show --stat 25e098f76` / `git show 25e098f76 -- codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts spec/conventions/spec-impl-evidence.md` 로 3차 커밋 diff 실측: `spec-impl-evidence.md` §4.2 SoT 표 1줄(`CODEBASE_SOURCE_ROOTS` 목록에 `frontend` 추가) + test 파일 **주석 3줄**(코드 라인 0) + `plan/in-progress/eia-context-schema-followups.md` 체크박스 flip + review 산출물뿐. **코드 로직 변경 없음 — claim 그대로 확인.**
3. `git show 6483c7292`(PR #904) 전문 재독: 결정 3건 —
   - **discriminator-free**: `interactionType` 은 unsound 판별자(`buttons` 가 `buttonConfig` 복원 실패 시 `nodeOutput` 변형으로 fallthrough) → `discriminator` 미선언, 키 존재(`'buttonConfig' in context`)로 분기.
   - **`conversationThread` key-omission (not `| null`)**: `present-when-available` — api-convention §5.4 규약, EIA §5.3/R17 의 "SSE 와의 wire parity" 요구에서 파생.
   - **런타임 wire 무변경**: "spec a02db4f9a 가 확정한 결정의 코드화. 런타임 wire 는 변경하지 않는다 — 타입과 OpenAPI 스키마 표현만."
4. `spec/5-system/14-external-interaction-api.md` R17 원문 재확인: "`conversationThread` 는 값이 없으면 **키를 생략**하고(형제 `currentNode`/`result`/`error` 는 `null`)... SSE `waiting_for_input` 도 present-when-available 이므로, REST 만 `null` 로 정규화하면 위젯의 `parseWaitingForInput` 재사용이 깨진다."
5. `spec/conventions/swagger.md` §Rationale "`discriminator` 는 판별자가 sound 할 때만" 재확인: EIA `getStatus.context` 를 반례로 명시.
6. 4개 신규/변경 커밋(`964e887af`/`428134b64`/`dedc411fd`/`52e244034`) 커밋 메시지 + payload diff 전수 대조.
7. `plan/in-progress/eia-context-schema-followups.md` 재확인 — 이번 PR 이 처리한 항목(client `context` 정밀화, spec 링크 가드 확장)과 의도적 defer 항목(DTO 디렉토리 정규화, swagger §1-4 본문 보강, 리뷰 후속 4건) 을 분리해 추적 중.

## 발견사항

없음. FINAL 상태와 PR #904 결정 사이에 모순 없음.

### 참고 — 정합성 확인된 항목 (비발견, 근거 기록용)

- **discriminator 미도입**: `codebase/channel-web-chat/src/lib/eia-types.ts` 의 `ButtonsContext`/`NodeOutputContext`/`WaitingContext`, `codebase/packages/sdk/src/client.ts` 의 동형 타입 모두 discriminator 필드 없이 구조적 union 으로 선언. `eia-events.test.ts`/`client.spec.ts` 양쪽에 "interactionType 은 판별자가 아님(회귀 가드)" negative `@ts-expect-error` 테스트가 명시적으로 존재 — union 이 discriminated 로 되돌아가면 `tsc`/`ts-jest` red.
- **`conversationThread` non-null 유지**: 두 파일 모두 `conversationThread?: ConversationThread`(위젯) / `conversationThread?: Record<string, unknown>`(SDK) — optional 키, `| null` 아님. `eia-events.test.ts`("conversationThread 는 present-when-available — 부재 시 키 생략(`| null` 아님)")·`client.spec.ts`("conversationThread 부재 = 키 생략(`| null` 아님)") 양쪽 테스트가 이를 고정.
- **런타임 wire 무변경**: 이번 5커밋은 백엔드 코드·backend DTO 를 전혀 건드리지 않는다(diff 범위 = 클라이언트 타입·테스트·문서·링크뿐). `use-widget.ts` 의 `status.context as WaitingForInputEvent` 캐스트 제거는 **타입 좁힘의 결과**(`WaitingContext ⊆ WaitingForInputEvent` assignability)이지 wire shape 변경이 아님 — 커밋 메시지("런타임 wire 무변경")·주석("EIA §5.3") 모두와 일치.
- **3차 커밋(`25e098f76`) 범위**: 실측 결과 `spec-impl-evidence.md`(SoT 표 1줄) + `spec-link-integrity.test.ts`(주석 3줄, 코드 0줄) + plan + review 산출물뿐. 코드 로직·타입·wire 에 대한 신규 변경 없음 — 4번째 커밋(`dedc411fd`, e2e 250)이후 실행 코드 무변경이라는 커밋 메시지 주장과 diff 실측이 일치.
- **api-convention §5.4 소급 미적용 원칙과의 정합**: PR #904 는 "기존 키 생략 필드에는 소급 적용하지 않는다" 고 명시했고, 본 PR 은 §5.4 확정 이후 신설되는 client 타입에 그 규약을 적용한 것이라 소급 범위 밖. 모순 없음.
- **plan 추적 상태**: `eia-context-schema-followups.md` 가 이번 PR 완료 항목 2건을 `[x]`로 flip 하고, defer 항목(DTO 위치 정규화·swagger §1-4 본문 보강·리뷰 후속 4건)을 별도 유지 — 결정 번복이 아니라 원 PR 에서 합의된 비차단 잔여 항목의 순차 처리로, 새로운 Rationale 부재 문제 없음(각 defer 항목에 근거·출처 checker ID 명시됨).

## 요약

3차 resolution 커밋(`25e098f76`)은 실측상 `spec-impl-evidence.md` §4.2 SoT 표 1줄 + 테스트 주석 3줄(코드 0줄) + plan 체크박스만 변경한 순수 문서/주석 정합화로, 클레임과 정확히 일치한다. 5커밋 전체(`964e887af`~`25e098f76`)를 PR #904(`6483c7292`)의 Rationale 원문과 대조한 결과, discriminator-free 설계·`conversationThread` present-when-available(키 생략, `| null` 금지)·런타임 wire 무변경이라는 세 결정 모두 클라이언트(위젯·SDK) 타입에 그대로 이식되어 있고, 이를 뒤집거나 재도입하는 코드·문서 변경은 없다. `EIA §5.3/R17`·`swagger.md §Rationale`·`api-convention §5.4` 원문도 이번 변경과 완전히 부합하며, `plan/in-progress/eia-context-schema-followups.md` 는 완료 항목과 의도적 defer 항목을 명확히 분리해 추적 중이라 무근거 번복 소지도 없다.

## 위험도

NONE

STATUS: SUCCESS
