### 발견사항

- **[INFO]** `asEnvelope` 의 `output` 병합 순서로 인해 `config`/`output` 대칭성이 깨짐 (payload 필드 충돌 시 `truncation` 이 조용히 우선)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:129` — `return { config: { ...payload }, output: { ...payload, ...asRecord(o.truncation) } };`
  - 상세: 변경 전에는 `config`·`output` 이 `payload` 의 완전히 동일한 shallow 사본이었다. 변경 후 `output` 에만 `truncation` 필드(`rowsTruncated`/`itemsTruncated`/`rowsTotalCount`/`itemsTotalCount`)가 spread 로 추가 병합되며, 스프레드 순서(`payload` → `truncation`)상 동일 키가 양쪽에 존재하면 `truncation` 값이 `payload` 의 값을 **`output` 쪽에서만** 조용히 덮어쓴다(`config` 는 영향 없음). 실제 `to*` 함수들이 읽는 키(`items`/`rows`/`data`/`rendered`/`columns`/`layout`/`chartType` 등)와 truncation 키가 겹치지 않아 현재 코드 경로상 실질적 충돌은 없음을 확인했으나(별도로 `presentations.tsx` 를 grep 하여 소비처가 이 4개 함수뿐임도 확인), 이 정밀한 no-collision 전제는 코드에 명시적으로 assert/테스트되어 있지 않다. 향후 payload shape 이 확장되어 우연히 `rowsTruncated` 같은 이름의 비-메타 필드를 갖게 되면 `output` 에서만 조용히 유실되는 회귀가 재발할 수 있다.
  - 제안: 정보성 사항 — 현재 스코프에선 실害 없음. 원한다면 주석에 "payload 필드명이 truncation 예약어와 겹치면 안 됨" 을 명시하거나, `truncation` 병합 대상 키를 명시적 4개(`rowsTruncated`/`itemsTruncated`/`rowsTotalCount`/`itemsTotalCount`)로 화이트리스트하여 임의 payload 필드 오염 가능성을 원천 차단할 수 있음.

- **[INFO]** exported 함수(`toTable`/`toCarousel`/`toChart`/`toTemplate`)의 반환값 변경은 의도된 동작이나 공개 표면(같은 패키지 내 export) 이라 영향 범위 재확인 필요
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` (동일 함수들, export 유지·시그니처 불변)
  - 상세: 함수 시그니처(파라미터/리턴 타입)는 변경되지 않았지만, `truncation` 을 포함한 `PresentationPayload` 입력에 대해 `toTable().truncated` 등의 반환 **값**이 이전과 달라진다(버그 수정이 의도). grep 결과 이 4개 함수의 실제 소비처는 `codebase/channel-web-chat/src/widget/components/presentations.tsx` 단 하나뿐임을 확인 — blast radius 는 plan 이 서술한 대로 위젯 렌더러 한 곳으로 정확히 국한된다. 예상치 못한 타 소비처는 없음.
  - 제안: 조치 불필요(확인 완료, 참고용 기록).

- **[NONE]** 전역 변수·환경 변수·네트워크 호출·이벤트/콜백 관련 부작용
  - 상세: `presentation.ts` 변경은 순수 함수(`asEnvelope`) 내부의 객체 리터럴 조합 로직 변경뿐이며, 모듈 스코프 상태·전역 변수·환경 변수 읽기/쓰기·네트워크 호출·콜백 발생 방식에 어떠한 변경도 없다. `classifyPresentation` 은 `PresentationPayload` 입력에 대해 fast-path(`type` + `PRESENTATION_KINDS` + `payload`)로 조기 반환하므로 `asEnvelope` 변경분(truncation 병합)의 영향을 받지 않는다 — 분류 로직과 truncation 흡수 로직이 서로 간섭하지 않음을 코드 추적으로 확인.

- **[INFO]** 신규 파일 다수 생성(`plan/in-progress/widget-presentation-restore.md`, `review/consistency/2026/07/10/**`)은 코드 부작용이 아닌 저장소 관례상 의도된 문서 산출물
  - 위치: 파일 5~24 (plan·consistency-check 산출물·spec 문서)
  - 상세: CLAUDE.md 규약상 `review/`·`plan/` 산출물은 gitignore 대상이 아니며 커밋 대상으로 명시돼 있어, "예상치 못한 파일시스템 부작용" 에 해당하지 않는다. spec 문서 3건(`1-widget-app.md`/`_product-overview.md`/`conversation-thread.md`) 변경도 문서 텍스트 정정뿐으로 런타임 부작용 없음.
  - 제안: 조치 불필요.

### 요약
실질적인 프로덕션 코드 변경은 `codebase/channel-web-chat/src/lib/presentation.ts` 의 `asEnvelope` 함수 1곳(비-export 내부 함수)에 국한되며, 순수 함수로서 전역 상태·파일시스템·환경변수·네트워크·이벤트/콜백에 아무런 부작용이 없다. 함수 시그니처는 전부 불변이고, `truncation` 흡수로 인한 반환값 변화는 exported 함수(`toTable` 등)에 전파되지만 실제 소비처가 `presentations.tsx` 단일 컴포넌트로 grep 확인돼 blast radius 가 의도대로 통제된다. 유일하게 주목할 만한 것은 `output` 병합 시 `payload`/`truncation` 필드명 충돌 시 후자가 조용히 우선하는 정밀 동작이 테스트로 명시적으로 보장되지 않는다는 점이나, 현재 필드셋 기준으로는 실해가 없다. 나머지 diff(테스트 파일, plan/spec/consistency 문서)는 실행 경로에 영향을 주지 않는 문서·테스트 전용 변경이다.

### 위험도
LOW