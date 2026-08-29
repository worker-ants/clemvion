# 유지보수성(Maintainability) 리뷰

## 컨텍스트

이번 diff 는 직전 리뷰 라운드(`review/code/2026/08/29/14_36_39`)의 `maintainability` WARNING #2·#3·#5 를 이미 조치한 결과물이다(`RESOLUTION.md` 참조). 실제 코드(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts`)를 직접 열어 확인한 결과:

- WARNING #2(함수 책임 과다) — `extractLinks` 가 `buildMaskedDoc()`(마스킹+줄매핑) / `lineForOffset()`(오프셋→원본줄 이진탐색) 로 분리됨(`spec-links.ts:148`, `:172`). 조치 확인.
- WARNING #3(펜스 분기 중복) — `isFenceBoundary || inFence` 로 병합됨(`spec-links.ts:158`). 조치 확인.
- WARNING #5(인터페이스 계약 미문서화) — `MdLink.line`/`raw`, `LinkViolation.line` 옆에 계약 주석 추가됨(`spec-links.ts:74-76`, `:243`). 조치 확인.

아래는 이번 최종 상태를 기준으로 다시 훑은 잔여 발견사항이다. Critical/Warning 급은 없다.

## 발견사항

- **[INFO]** 테스트 헬퍼 `writeDoc` 이 두 `describe` 블록에 동일하게 중복 정의됨 (이번 diff 가 새로 추가한 두 번째 사본)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts:229`(기존, `describe("extractLinks — 사전 필터가 링크를 놓치지 않는다"`) 와 `:282`(신규, `describe("extractLinks — 링크 텍스트가 줄을 넘어도 본다"`)
  - 상세: 두 위치의 구현이 문자 그대로 동일하다(`(name, body) => { fs.writeFileSync(path.join(root, name), body); return path.join(root, name); }` 형태 4줄). `root` 를 매개변수로 받는 모듈 스코프 헬퍼로 뽑으면 제거 가능한 중복이다. 다만 이 파일은 각 `describe` 가 자신의 `root`/`beforeAll`/`afterAll` 을 독립적으로 갖는 기존 관례를 따르고 있어(다른 3개 describe 블록도 유사 보일러플레이트를 반복) 이 패턴 자체를 "새로 도입한 나쁜 습관"으로 보기는 어렵다 — 다만 `writeDoc` 이라는 이름이 완전히 같은 헬퍼가 문자 그대로 중복된 것은 이번 diff 로 처음 생겼다.
  - 제안: 우선순위 낮음. `writeDoc(root, name, body)` 형태로 모듈 스코프에 한 번만 정의해 두 describe 가 공유하도록 하면 향후 세 번째 사본이 생기는 것을 막을 수 있다.

- **[INFO]** `MaskedDoc` 이 `startOf`/`srcLineOf` 두 병렬 배열로 줄 지도를 표현
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:132-139` (`interface MaskedDoc`)
  - 상세: 직전 라운드에서 이미 INFO #16 으로 지적되었고 `RESOLUTION.md` 는 "함수 분리(발견 #2) 시 자연히 완화됨"으로 처리한 항목이다. 실제로 두 배열은 항상 같은 길이로 함께 채워지므로(`buildMaskedDoc` 안 for 루프에서 두 `push` 가 쌍으로 실행) 인덱스 불일치 위험은 낮지만, `{ start: number; srcLine: number }[]` 단일 배열로 합치면 그 불변식이 타입 수준에서 더 명확해진다. 새로 지적하는 항목이 아니라, 여전히 남아 있다는 사실만 재확인.
  - 제안: 조치 불요(이미 트리아지됨). 이 구조를 다시 만질 일이 생기면 그때 병합을 고려.

- **[INFO]** `lineForOffset` 의 이진 탐색은 정확하지만, 호출 패턴(정규식 `exec` 루프가 항상 오름차순 `m.index` 를 낸다)을 고려하면 단순 전진 포인터로도 충분했을 자리
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:172-181` (`function lineForOffset`), 호출부 `:194-200` (`extractLinks` 의 `while` 루프)
  - 상세: `LINK_RE.exec(doc.body)` 는 매 호출마다 이전보다 큰 오프셋을 반환하므로, `lo` 포인터 하나를 유지하며 앞으로만 전진시켜도 같은 결과를 O(1) 상각으로 낼 수 있다. 현재 구현은 매 매치마다 `O(log L)` 이진 탐색을 처음부터 다시 수행한다. 다만 이 함수는 호출 순서에 의존하지 않는 독립 유틸로 분리되어 있어(파일당 재사용 가능, 향후 임의 오프셋 질의에도 안전) 견고성 대비 복잡도 트레이드오프로 볼 수 있고, 문서화도 충분하다. 성능 문제로 보긴 어렵고 순수 "더 단순하게 쓸 수 있었다" 수준의 관찰.
  - 제안: 조치 불요. 현재 함수가 독립적으로 테스트 가능하고 짧아 유지보수 비용이 낮다.

## 요약

이번 diff 는 `extractLinks()` 의 멀티라인 링크 처리 로직을 `buildMaskedDoc()`/`lineForOffset()` 두 헬퍼로 분리하고, 펜스 경계/내부 분기 중복을 `isFenceBoundary || inFence` 한 줄로 병합했으며, `MdLink`/`LinkViolation` 인터페이스에 새 계약(멀티라인 시 첫 줄 보고, `raw` 에 개행 포함 가능)을 주석으로 명시해 직전 라운드의 maintainability WARNING 3건을 모두 조치했다. 각 헬퍼가 20줄 내외로 짧고 책임이 하나씩이며, JSDoc 이 "왜 줄 단위 매칭을 버렸는가"·"마스킹이 지켜야 할 세 조건"을 근거(실측 수치 포함)와 함께 설명해 가독성이 높다. 테스트도 off-by-one 이 숨는 시나리오(멀티라인 링크 1개짜리 케이스만으로는 검증 불가)를 의식적으로 피해 2개 이상·혼재·3줄 스팬 케이스를 갖췄다. 잔여 항목은 신규 테스트 헬퍼 `writeDoc` 의 문자 그대로 중복(INFO, 이번 diff 로 새로 생김)과, 이미 이전 라운드에서 트리아지되어 "조치 불요"로 정리된 병렬 배열 구조·이진 탐색 설계 관찰(INFO, 재확인 목적)뿐이며 모두 Critical/Warning 급은 아니다.

## 위험도

LOW
