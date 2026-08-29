# 유지보수성(Maintainability) 리뷰

## 컨텍스트

이 diff 는 같은 세션 안에서 `extractLinks()`(멀티라인 링크 사각지대 수정)를 두고 이미 3라운드
(`14_36_39` → `15_01_34` → `15_30_59`)의 maintainability 리뷰·조치를 거친 결과물이다. 직접
`codebase/frontend/src/lib/docs/__tests__/spec-links.ts` / `spec-links.test.ts` 최종 상태를
열어 확인했다:

- 이전 라운드 WARNING(함수 책임 과다·펜스 분기 중복·인터페이스 계약 미문서화)은 모두
  `buildMaskedDoc()`/`lineForOffset()` 분리, `isFenceBoundary || inFence || isBlank` 단일
  조건 병합, `MdLink`/`LinkViolation` 필드 옆 계약 주석으로 조치되어 있다.
  `extractLinks` 자체는 21줄(사전 필터 → 마스킹 위임 → 정규식 매칭 → 줄 복원 4단계가 각각
  한 줄~두 줄), `buildMaskedDoc`은 약 20줄, `lineForOffset`은 10줄로 각각 짧고 책임이 하나씩
  이다.
- 마지막 두 커밋(`9759699f2` 문단 경계 축 추가, `6eff58339` fence fixture 의 빈 줄 제거)은
  기존 구조를 그대로 따르는 국소 수정이라 새 구조적 문제를 만들지 않았다.

## 발견사항

- **[INFO]** (재확인, 조치 불요) 테스트 헬퍼 `writeDoc` 이 두 `describe` 블록에 문자 그대로
  중복 정의되어 있다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — `describe("extractLinks
    — 사전 필터가 링크를 놓치지 않는다"` 블록의 `writeDoc`과 `describe("extractLinks — 링크
    텍스트가 줄을 넘어도 본다"` 블록의 `writeDoc`(각 블록 상단, `const writeDoc = (name, body) =>
    { ... }` 4줄).
  - 상세: 두 정의가 완전히 동일하다. 이전 두 라운드(`15_01_34`, `15_30_59`)에서 이미 INFO로
    지적되고 "우선순위 낮음"으로 트리아지된 항목이며, 이번 diff로 새로 나빠지지도 개선되지도
    않았다 — 잔존 확인 목적으로만 재기재한다.
  - 제안: 조치 불요. 세 번째 사본이 추가되는 시점에 모듈 스코프 `writeDoc(root, name, body)`로
    추출하는 것을 고려.

- **[INFO]** (재확인, 조치 불요) `MaskedDoc`이 `startOf`/`srcLineOf` 두 병렬 배열로 줄 지도를
  표현한다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`의 `interface MaskedDoc`
    선언부와 `buildMaskedDoc` 함수 본문의 두 `push` 호출부.
  - 상세: 이전 라운드들에서 이미 "함수 분리로 자연히 완화됨 · 인덱스는 항상 쌍으로 채워져
    실질 위험 낮음"으로 판정된 항목이다. 이번 diff는 이 구조에 손대지 않았다.
  - 제안: 조치 불요. 재구성할 일이 생기면 `{ start: number; srcLine: number }[]` 단일 배열
    병합을 고려.

## 요약

이 diff가 다루는 핵심 로직(`extractLinks`/`buildMaskedDoc`/`lineForOffset`)은 이전 세 라운드의
maintainability WARNING이 모두 조치된 상태로 안정화되어 있고, 이번에 추가된 두 커밋(문단 경계
축 잠금, fence fixture의 축 분리)도 그 구조를 유지한 채 국소적으로만 수정해 새로운 구조적 결함을
만들지 않았다. 함수 길이·중첩 깊이·매직 넘버·순환 복잡도 모두 문제 수준이 아니며, 각 설계
결정(왜 줄 단위 매칭을 버렸는지, 마스킹이 지켜야 할 네 조건, 왜 여기만 정규식이고 AST가 아닌지)이
JSDoc에 실측 근거와 함께 남아 있어 다음 사람이 재추론 없이 맥락을 따라갈 수 있다. 남은 항목은
전부 이전 라운드에서 이미 "조치 불요"로 트리아지된 INFO(`writeDoc` 테스트 헬퍼 중복, `MaskedDoc`
병렬 배열)뿐이며, 이번 diff로 상태가 달라지지 않았다. `review/code/2026/08/29/{14_36_39,
15_01_34,15_30_59}/**`에 포함된 리뷰 산출물 파일들은 생성된 보고서(비-코드)라 함수 길이·중첩·
매직 넘버 기준이 적용되지 않으므로 별도 지적하지 않았다.

## 위험도

LOW
