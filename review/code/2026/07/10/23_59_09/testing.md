# Testing Review — commit `efc9e791e` (fixes to prior review 23_20_33)

대상: `refactor(external-interaction): ai-review Warning 5건 반영` — W1~W5 조치 검증(fresh, adversarial).

## 검증 방법

- `pnpm install` (fresh worktree) → `codebase/backend` 에서 실제 jest 실행.
- `responses.dto.spec.ts` 단독 실행: **15/15 PASS**.
- 별도 probe 테스트(`__probe.spec.ts`, 실행 후 삭제)로 실제 생성된 OpenAPI 문서에서
  `ExecutionStatusDto.properties.context` / `.currentNode` 의 raw JSON 을 직접 덤프해
  W3/W4 단언이 참인지 실측.
- `interaction.service.spec.ts` 단독 실행: **37/37 PASS**. 모듈 전체(`external-interaction/**`):
  **220/220 PASS**.
- `WaitingContextBase`(제거된 alias) 잔존 참조 전수 grep.
- `git show <parent-commit>:.../interaction.service.spec.ts` 로 W2 이전 상태와 대조, 회귀 여부 확인.
- `npx tsc --noEmit -p tsconfig.json` (엄격 전체 프로젝트) 및 `npx eslint` 로 타입/린트 회귀 확인.

## 발견사항

### (1) W3/W4 강화된 단언 — 실 OpenAPI 문서로 확정 참

- **[INFO]** 실측 결과, 둘 다 사실로 확인됨.
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses.dto.spec.ts:91-105`
  - 상세: probe 스크립트로 덤프한 실제 스키마:
    ```
    context: { description, oneOf: [...], nullable: true }   // "type" 키 자체가 없음 → toBeUndefined() 참
    currentNode: { description, nullable: true, allOf: [{ $ref: .../CurrentNodeDto }] }  // allOf 존재 확정
    ```
    `expect(context.type).toBeUndefined()` 와 `expect(currentNode.allOf).toEqual([{ $ref: ... }])` 모두
    실제 값과 정확히 일치한다. 이전 리뷰(W3/W4 지적)의 실측(pre-change DTO 스왑 시 13/15 FAIL)과도
    합치하며, 이번 재검증에서 강화된 형태 그대로도 초록. 죽은 분기 제거(`?? [...]`) 로 인해
    실패 시나리오(currentNode 가 `$ref` 만 갖고 `allOf` 가 없는 shape 로 회귀)를 정확히 잡는 형태다.
  - 제안: 없음 — 조치가 견고함.

### (2) 신규 e2e `I-2` — 의미 있는 실 HTTP+DB round-trip, vacuous 아님

- **[INFO]** 검증 결과 유효.
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:411-464`
  - 상세: envelope 경로 `res.body.data.context` 는 인접 sibling 테스트 `I`(라인 344-409)·`A`(143-160) 와
    동일한 `TransformInterceptor` 래핑 패턴(`{ data: ... }`)을 그대로 재사용해 정확하다.
    실패 가능성을 코드로 추적하면:
    - `context.buttonConfig.buttons` 접근은 variant 선택이 `nodeOutput` 쪽으로 회귀하면
      (`buttonConfig` 키 자체가 없으므로) `undefined.buttons` 접근 TypeError 로 **즉시, 시끄럽게** 실패한다
      (조용한 오탐 없음).
    - `expect(Object.keys(context)).not.toContain('nodeOutput')` 은 variant 오선택(양쪽 키 동시 실림 또는
      nodeOutput 변형으로 fallthrough)을 정확히 포착.
    - `expect(Object.keys(context)).not.toContain('conversationThread')` 은 `conversationThread`
      가 `null` 로라도 실리면(현재 구현은 spread 로 조건부 키 부여) 실패한다 — present-when-available
      계약의 회귀를 정확히 잡는다.
    - DB fixture: `node.category='presentation'` 은 `node_category` enum(`V001__initial_schema.sql`)에
      실재하는 값이고, `node.type` 은 `VARCHAR(50)` 자유 텍스트라 `'carousel'` 삽입에 제약 위반 없음 — 확인함.
  - 제안: 없음.

### (3) W5(a) 중복 테스트 교체 — 커버리지 손실 없음, 코드로 확인

- **[INFO]** 손실 없음 확인.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:771-790`
  - 상세: 커밋 메시지·주석이 주장하는 "ai_conversation + thread 부재는 별도 테스트가 커버" 를 실제로
    확인함 — `it('waiting_for_input — conversation_thread 가 null(배포 이전 row)이면 conversationThread
    키 미동봉', ...)` 이 `outputData: { meta: { interactionType: 'ai_conversation' } }` +
    `conversationThread: null` 조합으로 `expect(r.context).not.toHaveProperty('conversationThread')` 를
    이미 단언하고 있다(라인 771-790, 이번 커밋 대상 밖 기존 테스트). 새 `buttons` variant 테스트가
    이 조합을 대체하지 않고 진짜 미커버 조합을 메운 것이 맞다.
  - 제안: 없음.

### (4) W2 `WaitingContextBase` alias 제거 — 타입 홀 없음

- **[INFO]** grep 전수 확인 — 잔존 참조 0건 (`WaitingContextBaseDto` 를 제외한 `WaitingContextBase` 매치 없음).
  - 위치: `codebase/backend/src/modules/external-interaction/{interaction.service.ts, dto/responses.dto.ts}`
  - 상세: alias 제거 후 `interaction.service.ts` 는 `WaitingContextBaseDto` (exported abstract class) 로
    직접 annotate — 컴파일 성공, 220/220 unit PASS. frontend(`eia-types.ts`) 등 다른 위치에서
    `WaitingContextBase` 를 import 하는 코드 없음(원래도 backend 전용 타입).

### (5) [정보성, 이번 커밋 원인 아님] 기존 `as Record<string, unknown>` 캐스트가 엄격 `tsc --noEmit -p tsconfig.json` 에서 TS2352

- **[INFO]** 사전 존재 이슈, 본 fix 커밋과 무관 — false alarm 방지 차 기록.
  - 위치: `interaction.service.spec.ts:542, 569, 689` (예: `const ctx = r.context as Record<string, unknown>;`)
  - 상세: `npx tsc --noEmit -p tsconfig.json` (전체 strict) 를 돌리면 이 캐스트들이
    "neither type sufficiently overlaps" TS2352 를 낸다. `git show 60c4c8900:...` (이번 리뷰 대상
    커밋의 **직전** 커밋, W2 patch 이전)으로 대조한 결과 동일 라인·동일 캐스트가 이미 존재해
    **이번 fix 가 도입한 회귀가 아니다**. `tsconfig.build.json` 이 `**/*spec.ts` 를 build 대상에서
    제외하므로 `pnpm build` 파이프라인은 이 경로를 타지 않고, jest 실행(ts-jest/babel transpile)도
    이 클래스의 strict 타입오버랩 검사를 하지 않아 CI 상 보이지 않는다. 커밋 메시지의 "build PASS"
    주장과 상충하지 않음 — 조치 불요, 참고용.
  - 제안: 별도 후속(비-차단)으로 `r.context as unknown as Record<string, unknown>` 이중 캐스트로
    정정할 수 있으나, 본 리뷰(fix 검증)의 스코프 밖이며 이번 커밋이 만든 문제가 아니므로 defer 적절.

## 요약

W3/W4 는 실제 생성된 OpenAPI 문서를 probe 로 직접 덤프해 대조한 결과 참으로 확인됐고, 죽은 분기 제거는 실제 회귀(예: `allOf` 없이 `$ref` 만 남는 shape)를 정확히 잡는 형태다. 신규 e2e `I-2` 는 envelope 경로(`res.body.data.context`)가 sibling 테스트와 일관되고, variant 오선택·`nodeOutput`/`conversationThread` 키 오노출 각각에 대해 구체적으로 실패하는 실질 가드다(vacuous 아님). W5(a) 의 테스트 교체는 코드 추적으로 커버리지 손실이 없음을 확인했다(`ai_conversation`+thread 부재 조합은 기존 별도 테스트가 이미 커버). W2 의 `WaitingContextBase` alias 제거는 잔존 참조 0건으로 타입 홀이 없다. 모듈 전체 unit(220/220)·대상 e2e·probe 실측이 모두 초록이며, 발견된 유일한 이슈(`as Record<string, unknown>` 캐스트의 엄격 tsc 경고)는 이번 fix 커밋 이전부터 존재하던 스펙 전용 부채로 스코프 밖이다. 다섯 건의 fix 모두 견고하며 회귀나 부작용을 유발하지 않는다.

## 위험도

NONE
