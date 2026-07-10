# 테스트(Testing) 리뷰

대상: `codebase/channel-web-chat/src/lib/{conversation,presentation}.{ts,test.ts}`,
`codebase/channel-web-chat/src/widget/components/presentations.test.tsx` (+ 부속 plan/review 문서)

검증 방법: 정적 리뷰 + `npx vitest run src/lib/conversation.test.ts src/lib/presentation.test.ts
src/widget/components/presentations.test.tsx` 실행 확인 — **3 files / 84 tests 전부 green**(신규 8건 포함:
conversation.test.ts 4건, presentation.test.ts 4건, presentations.test.tsx 4건 — 실제로는
presentations.test.tsx 신규 4건 + presentation.test.ts 신규 4건 + conversation.test.ts 신규 4건 = 12건이나
diff 상 정확 건수는 각 describe 블록 내 `it` 개수 참조).

## 발견사항

- **[INFO]** `truncation` vs `payload` 내부 동명 필드 충돌 시 우선순위가 테스트로 고정되지 않음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:129` (`asEnvelope`) — `{ ...payload, ...asRecord(o.truncation) }`
  - 상세: 현재 스프레드 순서상 `truncation.rowsTruncated` 가 `payload.rowsTruncated` 보다 항상 우선한다. 신규 테스트는
    (a) `truncation` 만 있는 경우(true/false), (b) `payload.rowsTruncated` 만 있고 `truncation` 이 아예 부재한 경우만
    커버한다(`presentation.test.ts:204-245`). **두 필드가 동시에 존재하고 값이 다른 경우**(예:
    `payload.rowsTruncated:true` + `truncation.rowsTruncated:false`)는 어느 쪽이 이기는지 테스트가 없다. 실제
    `render-tool-provider` 페이로드가 이 충돌을 만들 가능성은 낮아 보이지만(문서 주석상 payload 는 노드 전용 필드,
    truncation 은 AI 전용 필드로 서로 배타적 사용을 암묵 전제), 스프레드 순서를 바꾸는 향후 리팩터가 이 전제를
    조용히 뒤집어도 어떤 테스트도 red 로 전환되지 않는다.
  - 제안: `{ payload: { rows: [...], rowsTruncated: true }, truncation: { rowsTruncated: false } }` 케이스를 1건
    추가해 "top-level truncation 이 최종 권위"라는 의도를 명시적으로 lock-in.

- **[INFO]** `toCarousel` 의 `truncation.itemsTruncated` 흡수는 "파싱을 깨지 않음"만 검증, "메타가 실제로 소비됨"은
  검증(도 구현도) 없음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts:226-235` (`toCarousel — top-level truncation 이
    있어도 items 파싱은 그대로`), `codebase/channel-web-chat/src/lib/presentation.ts:39` (`CarouselData` 에
    `truncated` 필드 없음), `codebase/channel-web-chat/src/widget/components/presentations.tsx:174-199`(테이블만
    truncated 배너 렌더, 카루셀 대응 없음 — grep 확인)
  - 상세: `asEnvelope` 주석(`presentation.ts:115-118`)과 spec `0-common.md §10.4` 는 `itemsTruncated`/`rowsTruncated`
    를 "동등한 메타"로 규정하지만, 실제로 `output.itemsTruncated` 를 읽어 카루셀 잘림 배너를 그리는 코드는 존재하지
    않는다(`TableData.truncated` 만 있고 `CarouselData` 에는 해당 필드가 없음). 신규 테스트는 이 비대칭을 드러내지
    못하고 "items 배열이 안 깨진다"만 확인한다 — 이번 diff 의 실제 결함 수정 범위(테이블 truncation)를 벗어나는
    이슈이므로 이번 PR 의 blocking 사유는 아니나, "카루셀도 동등하게 흡수된다"는 주석 문구가 소비처 부재로 절반만
    참이라는 점은 커버리지 갭으로 남는다.
  - 제안: 이번 PR 스코프 밖이면 무시 가능. 다만 카루셀 truncation 배너를 실제로 구현하는 후속 작업이 있다면, 그때
    `PresentationList`/`PresentationBlock` 레벨의 렌더 테스트(현재 테이블에만 존재하는
    `presentations.test.tsx:289-303` 패턴)를 카루셀에도 대칭 추가해야 한다.

- **[INFO]** `truncation` 이 비객체(non-object) 값일 때의 방어 테스트 부재
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:88-90` (`asRecord`), `129`
  - 상세: `truncation: "garbage"` 또는 `truncation: null` 처럼 top-level `truncation` 이 object 가 아닌 경우
    `asRecord` 가 `{}` 를 반환해 안전하게 no-op 이 되는 방어 로직은 있으나, 이를 명시적으로 잠그는 테스트는 없다.
    `config`/`output`/`payload` 에 대해서는 이미 유사 malformed-input 테스트가 파일 곳곳에 존재하는 반면(예:
    `classifyPresentation(null)`, `classifyPresentation("x")` — `presentation.test.ts:32-33`), `truncation` 필드
    자체에 대해서는 대칭 케이스가 빠져 있다. 위험도는 낮음(순수 함수 + 이미 검증된 `asRecord` 재사용).
  - 제안: 선택 사항. `truncation: null` 1건 정도만 추가하면 `asRecord` 가드가 이 필드에도 동일하게 적용됨을
    문서화할 수 있음.

## 각 관점별 요약

1. **테스트 존재 여부**: 프로덕션 변경(`asEnvelope` 의 `truncation` 흡수 1줄)에 대해 회귀 테스트가 3개 레이어
   (순수 함수 `presentation.test.ts`, 조합 함수 `conversation.test.ts`, 렌더 `presentations.test.tsx`)에 걸쳐
   충실히 추가됨. plan 문서(`plan/in-progress/widget-presentation-restore.md` §4-2)가 명시한 "TDD red 확인 —
   신규 테스트 중 truncation 2건만 실패, 복원 4종 렌더는 처음부터 통과" 주장은 현재 상태(수정 반영 후) 전체
   green 으로 정합적이며, 별도로 `npx vitest run` 실행 결과도 3 files / 84 tests 전부 통과로 확인됨.
2. **커버리지 갭**: 위 INFO 3건(충돌 우선순위 미고정, 카루셀 truncation 미소비 비대칭, non-object truncation 미검증)
   외에는 갭이 크지 않음. `toChart`/`toTemplate` 은 spec 상 truncation 개념이 없는 타입이라(§4 는 carousel/table
   한정) 해당 변환기에 truncation 테스트가 없는 것은 정당함(누락 아님).
3. **엣지 케이스**: `presentations: []` 빈 배열, text 없는 presentation-only turn, `truncation` 부재, `false`
   명시값 vs 부재, payload-level 폴백 보존 등 실질적인 경계값이 잘 커버됨.
4. **Mock 적절성**: 이번 diff 는 순수 함수 테스트 + RTL 실제 컴포넌트 렌더뿐이며 mock/stub 사용이 없음(적절 —
   `PresentationList` 는 실제 DOM 출력까지 `screen.getByText` 로 검증해 "testid 만 있고 내용은 비었다"는 얕은
   회귀를 방지하려는 의도가 주석에 명시돼 있고 실제로 그렇게 구현됨).
5. **테스트 격리**: `conversation.test.ts` 의 `restoredThread` 는 describe 블록 스코프의 불변 객체로 여러 `it` 이
   read-only 로 공유 — 어떤 테스트도 이를 mutate 하지 않아 순서 의존성 없음. `presentations.test.tsx` 는
   `@testing-library/react` 기본 auto-cleanup(vitest `globals:true` + `vitest.setup.ts`)에 의존하며 이는 기존
   인프라로 diff 범위 밖. 신규 테스트 4건 모두 자체 완결적 `render()` 호출로 독립 실행 가능.
6. **테스트 가독성**: Korean 서술형 `it` 이름 + spec 앵커(ai-agent §7.10, 0-common §10.4) 인용 주석이 일관되게
   달려 있어 "왜 이 테스트가 존재하는가"가 명확함. `payloadOf` 헬퍼가 `conversation.test.ts` 와
   `presentations.test.tsx` 양쪽에 유사한 형태로 중복 정의되어 있으나(파일 간 공유 helper 로 뽑을 수도 있음),
   테스트 파일 간 독립성을 우선하는 통상적 트레이드오프이며 blocking 사유 아님.
7. **회귀 테스트**: 기존 테스트 바디는 diff 에서 전혀 수정되지 않았고(순수 append), 전체 스위트 실행으로
   기존 72건 + 신규 12건 모두 green 확인. `presentation.test.ts` 의 사전 존재 "converters — {config,output}
   envelope 회귀(하위 호환)" describe 블록도 이번 `asEnvelope` 변경(‘truncation’ 흡수 추가) 이후에도 영향받지
   않음 — `o.truncation` 이 없는 legacy envelope 입력에서는 `asRecord(undefined)` → `{}` 로 no-op.
8. **테스트 용이성**: `asEnvelope`/`toCarousel`/`toTable`/`toChart`/`toTemplate`/`classifyPresentation` 모두
   `unknown` 입력을 받는 순수 함수라 DI 없이도 테스트 친화적 구조 유지. 이번 변경도 기존 구조를 그대로 따름.

## 요약

프로덕션 변경은 `asEnvelope` 한 줄(top-level `truncation` 을 `output` 으로 흡수)에 그치지만, 회귀 테스트는
순수 로직·조합 함수·렌더 3계층에 걸쳐 균형 있게 추가되었고 실행 확인 결과 전부 green(3 files / 84 tests)이다.
새로고침 복원 경로(PresentationPayload shape)에 대한 커버리지도 4종 타입 전부, role 축약, text-less turn 등
핵심 시나리오를 빠짐없이 다뤄 테스트 존재성·엣지 케이스·가독성 면에서 모두 양호하다. 발견된 이슈는 전부 INFO
등급으로, (1) `payload`/`truncation` 동명 필드 충돌 시 우선순위 미고정, (2) 카루셀의 `itemsTruncated` 흡수가
실제 소비처 없이 "파싱 안 깨짐"만 검증되는 문서-구현 간 비대칭, (3) non-object `truncation` 방어 로직의 명시적
테스트 부재 — 셋 다 저위험이며 이번 PR 을 막을 사유는 아니다.

## 위험도
LOW
