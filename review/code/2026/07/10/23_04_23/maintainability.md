# 유지보수성(Maintainability) 리뷰 결과

## 리뷰 범위 참고

리뷰 대상 24개 파일 중 실제 코드 변경은 파일 1~4(`conversation.test.ts`, `presentation.test.ts`, `presentation.ts`, `presentations.test.tsx`)뿐이다. 파일 5(plan)·6~21(consistency 리뷰 산출물)·22~24(spec 문서)는 마크다운 문서로, 함수 길이·중첩 깊이·순환 복잡도 등 코드 전용 관점이 적용되지 않아 본 리뷰에서는 제외했다(문서 구조상 특이사항 없음).

### 발견사항

- **[INFO]** 테스트 픽스처 헬퍼 `payloadOf` 가 두 파일에 중복 정의되고 시그니처가 미묘하게 다름
  - 위치: `codebase/channel-web-chat/src/lib/conversation.test.ts:134-139`, `codebase/channel-web-chat/src/widget/components/presentations.test.tsx` 내 `payloadOf` 정의부
  - 상세: 두 파일 모두 `{ type, toolCallId, renderedAt, payload }` shape 을 만드는 동일한 이름의 로컬 헬퍼를 각자 정의한다. `presentations.test.tsx` 쪽만 `truncation` 옵션 인자가 추가되어 있어, 향후 한쪽만 갱신되고 다른 쪽이 stale 해질 여지가 있다(예: PresentationPayload shape 이 필드를 하나 더 얻으면 두 곳을 모두 손대야 함을 놓치기 쉬움).
  - 제안: 두 파일 모두 `describe` 블록 스코프 안에 캡슐화되어 있어 현재는 위험이 낮지만, 반복이 3번째 파일로 늘어나면 `src/lib/__test-utils__/presentation-payload.ts` 같은 공용 fixture 빌더로 추출해 시그니처를 하나로 통일할 것을 권장.

- **[INFO]** `asEnvelope` truncation 병합의 "값 충돌" 케이스가 주석에 명시되지 않음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:126-131` (`return { config: { ...payload }, output: { ...payload, ...asRecord(o.truncation) } };`)
  - 상세: 코드 동작상 `payload.rowsTruncated` 와 `truncation.rowsTruncated` 가 서로 다른 값으로 동시에 존재하면 spread 순서상 `truncation` 이 항상 우선한다. 바로 위 주석("truncation 부재 시 asRecord 가 {} 를 주므로 spread 는 no-op")과 함수 JSDoc 은 "부재 시 유지되는 case" 만 설명하고, "충돌 시 truncation 이 이긴다"는 우선순위는 문서화돼 있지 않다. `presentation.test.ts` 신규 테스트 4건도 부재/일치 케이스만 다루고 충돌 케이스는 커버하지 않는다.
  - 제안: 주석에 "payload 와 truncation 이 같은 키를 가지면 truncation(최상위, 더 신뢰도 높은 소스)이 우선"이라는 한 줄을 추가하면 다음 유지보수자가 병합 우선순위를 추측할 필요가 없어진다.

- **[INFO]** 새 회귀 테스트에서 타임스탬프 매직 문자열이 두 파일에 반복 하드코딩
  - 위치: `conversation.test.ts:137`, `presentations.test.tsx` 내 `payloadOf` 정의부의 `renderedAt: "2026-07-10T00:00:00.000Z"`
  - 상세: 테스트 값 자체는 assertion 대상이 아니라 단순 fixture 채움 값이라 실질적 위험은 낮지만, 동일 리터럴이 여러 곳에 등장해 향후 포맷 변경(예: ms 정밀도 제거) 시 grep 대상이 늘어난다.
  - 제안: 필수 조치 아님. 위 `payloadOf` 통합 시 함께 상수화하면 자연히 해소됨.

### 요약
이번 변경은 스코프가 매우 작고(운영 코드는 `asEnvelope` 함수의 return 문 한 줄 + JSDoc 보강뿐) 목적이 명확하다. 함수 길이·중첩 깊이·순환 복잡도 증가는 없으며, 새로 추가된 테스트들은 spec 조항을 인라인 주석으로 근거를 남기는 기존 컨벤션(§7.10, §10.4 등 참조)을 일관되게 따르고, `describe`/`it` 네이밍도 "무엇을·왜" 를 한국어로 명확히 서술해 가독성이 높다. `presentation.test.ts` 의 신규 4개 테스트는 기존 파일의 inline object literal 반복 스타일을 그대로 유지해 파일 내 일관성도 지켰다. 발견된 사항은 모두 INFO 등급으로, 테스트 헬퍼의 경미한 중복과 병합 우선순위 문서화 누락 정도이며 즉각 조치가 필요한 수준은 아니다.

### 위험도
LOW
