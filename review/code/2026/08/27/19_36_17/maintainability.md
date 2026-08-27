# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `swagger-probe.ts` 의 `schemasOf` 앞에 JSDoc 블록이 **3개 연속으로 쌓여** 있고, 그중 가운데 블록은 실제로는 `schemaOf`(단수) 함수를 설명하는 내용인데 엉뚱하게 `schemasOf`(복수) 위에 붙어 있다. 결과적으로 (a) 첫째·셋째 블록은 거의 동일한 내용의 중복 문서이고 (b) `schemaOf` 함수(95번째 줄)는 자신을 설명하던 문서를 잃어 무주석 상태다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:58-75` (실측: `Read` 로 직접 확인 — 58~62 `schemasOf` 설명, 63~70 "생성 문서에서 DTO 스키마 **하나**를 꺼낸다"/"왜 던지나" = `schemaOf` 설명, 71~75 다시 `schemasOf` 설명 반복. 정작 `schemaOf` 함수 선언(95번째 줄)에는 JSDoc 이 하나도 없다.)
  - 상세: 병합/편집 과정에서 남은 잔여물로 보인다. 이 코드베이스는 "왜"를 JSDoc 에 싣는 것을 핵심 유지보수 장치로 쓰고 있는데(다른 모든 리뷰 대상 파일이 이 패턴을 충실히 따름), 이 자리만 그 원칙이 깨져 있다. 다음에 이 파일을 여는 사람이 `schemaOf` 를 이해하려면 엉뚱한 함수 위에 붙은 문서를 찾아야 하고, TSDoc/IDE 툴팁은 그 블록을 `schemaOf` 에 붙여주지 않는다(직전 함수인 `schemasOf` 로 귀속됨).
  - 제안: 63~70번째 줄 블록(`schemaOf` 설명)을 95번째 줄 `export function schemaOf(` 바로 위로 옮기고, 58~62/71~75 의 중복 `schemasOf` 설명은 하나만 남긴다.

- **[INFO]** `node-output-allowlist.ts` 의 컴파일타임 결속 검사(`assertAllowlistCoversHandlerContract`)는 조건부 타입(`extends … ? true : never`)을 값 타입 자리에 쓰는 다소 생소한 TS 관용구다. 주석으로 의도는 충분히 설명돼 있어 이해 자체는 가능하지만, 처음 보는 개발자에게는 해독 비용이 있다.
  - 위치: `codebase/backend/src/nodes/core/node-output-allowlist.ts:106-114`
  - 상세: 기능상 문제는 없고 이미 목적을 밝히는 주석이 붙어 있어 크게 감점할 사안은 아니다. 다만 "왜 이렇게 짰는가"뿐 아니라 "이 패턴의 이름/참고 링크"까지 한 줄 보태면 다음 사람이 검색하기 쉬워진다.
  - 제안: (선택) `// TS conditional-type exhaustiveness check` 같은 검색 가능한 키워드를 주석에 한 줄 추가.

## 요약

이번 변경은 대부분 함수/파일 리네임(`redactNodeExecutionRow` → `redactNodeExecutionRowForResponse`, `node-output-allowlist.ts` 재배치), 4개 스펙 파일에 반복되던 Swagger `createDocument` 보일러플레이트를 `swagger-probe.ts` 공유 헬퍼로 추출, 관련 테스트 재배치·plan/spec 문서 동기화로 구성된 위생(hygiene) 정리 PR이다. 리네임은 호출부 전수(11곳 포함)에 걸쳐 정합하게 반영되어 있고(`grep` 실측: 구 이름 잔존 0건), 새로 추출된 `swagger-probe.ts`/`node-output-allowlist.ts` 는 "왜 이런 설계인가"를 코드베이스 관례대로 두텁게 문서화해 가독성이 높다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮게 유지되고 매직 넘버도 없다. 유일하게 실질적인 결함은 `swagger-probe.ts` 에서 편집 도중 남은 것으로 보이는 중복/오귀속 JSDoc 블록으로, 기능에는 영향이 없지만 이 코드베이스가 유지보수성의 핵심 장치로 삼는 문서 정합성을 깨뜨린다.

## 위험도

LOW
