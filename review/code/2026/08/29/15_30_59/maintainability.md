# 유지보수성(Maintainability) 리뷰

## 컨텍스트

이번 diff 는 `extractLinks()` 가 줄 단위 매칭 대신 마스킹된 전문(全文)을 한 번에 매칭하도록
바꿔 "링크 텍스트가 줄을 넘으면 통째로 놓치는" 사각지대를 닫는 변경이다. 같은 세션의 이전
두 리뷰 라운드(`review/code/2026/08/29/14_36_39`, `15_01_34`)에서 이미 지적된 maintainability
WARNING(함수 책임 과다, 펜스 분기 중복, 인터페이스 계약 미문서화)이 모두 조치돼 있음을
직접 소스(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts`)를 열어 재확인했다:

- `extractLinks` 가 `buildMaskedDoc()`(마스킹+줄매핑) / `lineForOffset()`(오프셋→원본줄
  이진탐색) 로 분리됨.
- 펜스 경계 줄·내부 줄 분기가 `isFenceBoundary || inFence || isBlank` 한 줄로 병합됨(빈 줄
  분기도 같은 자리에 통합).
- `MdLink.line`/`raw`, `LinkViolation.line` 옆에 새 계약("멀티라인이면 첫 줄", "raw 는 개행
  포함 가능")이 인라인 주석으로 명시됨.

아래는 이 최종 상태를 기준으로 새로 훑은 결과다. Critical/Warning 급 신규 발견은 없다.

## 발견사항

- **[INFO]** 테스트 헬퍼 `writeDoc` 이 두 `describe` 블록에 글자 그대로 동일하게 정의되어
  있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:229`(기존
    `describe("extractLinks — 사전 필터가 링크를 놓치지 않는다"`)와 `:282`(이번 diff 로
    신규 추가된 `describe("extractLinks — 링크 텍스트가 줄을 넘어도 본다"`).
  - 상세: 두 구현이 `(name, body) => { fs.writeFileSync(...); return p; }` 4줄 그대로
    복제돼 있다. 이 파일의 다른 `describe` 블록들도 자신만의 `root`/`beforeAll`/`afterAll`
    을 독립적으로 갖는 관례를 따르므로 패턴 자체가 새 결함은 아니지만, `writeDoc` 이라는
    이름의 헬퍼가 문자 그대로 중복된 것은 이번 diff 로 처음 생겼다. 세 번째 사본이 추가되기
    전에 정리해두는 편이 이후 유지보수 비용을 낮춘다.
  - 제안: 우선순위 낮음. `writeDoc(root, name, body)` 형태로 모듈 스코프에 한 번만 정의해
    두 describe 가 공유하도록 추출한다.

- **[INFO]** `MaskedDoc` 이 `startOf`/`srcLineOf` 두 병렬 배열로 줄 지도를 표현한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:107`–`115`
    (`interface MaskedDoc`), 채워지는 자리는 `:146`, `:149`–`151`.
  - 상세: `buildMaskedDoc` 의 for 루프 안에서 두 `push` 가 항상 쌍으로 실행되므로 실질
    인덱스 불일치 위험은 낮지만, `{ start: number; srcLine: number }[]` 단일 배열로
    합치면 그 불변식이 타입 구조 자체로 보장된다. 이전 라운드에서 이미 INFO 로 지적되고
    "함수 분리 시 자연히 완화됨"으로 트리아지된 항목이며, 이번 diff 로 새로 나빠지지도
    개선되지도 않았다 — 잔존 확인 목적으로만 재기재한다.
  - 제안: 조치 불요(이미 트리아지됨). 이 구조를 다시 만질 일이 생기면 그때 병합을 고려.

- **[INFO]** `lineForOffset` 의 이진 탐색은 정확하지만, 호출 패턴(정규식 `exec` 루프가 항상
  오름차순 `m.index` 를 낸다)만 보면 단순 전진 포인터로도 충분했을 자리다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:155`–`165`
    (`function lineForOffset`), 호출부 `:212`–`220` (`extractLinks` 의 `while` 루프).
  - 상세: `LINK_RE.exec(doc.body)` 는 매 호출마다 이전보다 큰 오프셋을 반환하므로 `lo`
    포인터 하나로 앞으로만 전진시켜도 상각 O(1)로 같은 결과를 낼 수 있다. 다만 이 함수는
    호출 순서에 의존하지 않는 독립 유틸로 분리돼 있어 재사용성·개별 테스트 용이성 대비
    복잡도 트레이드오프로 볼 수 있고, 문서화도 충분해 유지보수 비용이 낮다. 성능 문제가
    아니라 "더 단순하게 쓸 수도 있었다" 수준의 설계 관찰.
  - 제안: 조치 불요. 현재 함수가 독립적으로 테스트 가능하고 15줄 이하로 짧아 부담이 적다.

## 요약

이번 diff 는 `extractLinks` 를 `buildMaskedDoc()`/`lineForOffset()` 두 헬퍼로 분리하고
펜스·빈 줄 분기 중복을 한 줄로 병합했으며, `MdLink`/`LinkViolation` 인터페이스에 새 계약을
주석으로 명시해 이전 두 라운드의 maintainability WARNING 을 모두 조치한 상태다. 각 헬퍼가
20줄 내외로 짧고 책임이 하나씩이며, JSDoc 이 "왜 줄 단위 매칭을 버렸는가"·"마스킹이 지켜야
할 네 조건"을 실측 수치와 함께 근거로 남겨 가독성이 높다. 새 테스트도 off-by-one 이 숨는
시나리오(멀티라인 링크 1개짜리 케이스만으로는 검증 불가)를 의식적으로 피해 2개 이상·단일+
멀티 혼재·3줄 스팬 케이스를 갖췄다. 매직 넘버·과도한 중첩·순환 복잡도 문제는 관찰되지
않았고, 기존 파일의 Korean 근거-주석 컨벤션과도 일관된다. 잔여 항목은 신규 테스트 헬퍼
`writeDoc` 의 글자 그대로 중복(INFO, 이번 diff 로 새로 생김)과, 이미 이전 라운드에서
"조치 불요"로 트리아지된 병렬 배열 구조·이진 탐색 설계 관찰(INFO, 잔존 확인 목적) 뿐이며
모두 Critical/Warning 급은 아니다. `review/code/2026/08/29/{14_36_39,15_01_34}/*.md` 등
같은 diff 에 포함된 리뷰 산출물 파일들은 생성된 보고서(비-코드)라 함수 길이·중첩·매직넘버
기준이 적용되지 않으므로 별도 지적하지 않았다.

## 위험도

LOW
