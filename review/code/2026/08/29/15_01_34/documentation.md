# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** `extractLinks()`를 설명하는 새 JSDoc 블록이 정작 그 함수 선언과 물리적으로 분리되어, 편집기 hover/JSDoc 툴링에서 더 이상 `extractLinks`에 붙지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:107-130` (JSDoc 블록 "Extract markdown links outside fenced/inline code." + "왜 줄 단위로 매칭하지 않는가" / "마스킹이 세 가지를 동시에 지켜야 한다" 절) vs `:183` (`export function extractLinks(absPath: string): MdLink[] {` 실제 선언부).
  - 상세: 이 PR은 기존 한 줄 주석(`/** Extract markdown links outside fenced/inline code. */`)을 `extractLinks`의 설계 근거(줄 단위 매칭을 버린 이유, 마스킹이 지켜야 할 세 불변식)를 상세히 설명하는 긴 JSDoc으로 확장했다. 그런데 그 확장된 JSDoc 바로 다음 줄(`:131`)에 `interface MaskedDoc`용 별도 한 줄 JSDoc이 공백 줄 없이 바로 붙었고, 이어서 `interface MaskedDoc`(`:132-139`) → `buildMaskedDoc()`(`:148-169`) → `lineForOffset()`(`:172-181`) 세 선언이 차례로 삽입된 뒤에야 `extractLinks` 함수 본체(`:183`)가 나온다. 실제로 확인한 결과 `extractLinks` 선언 바로 위(`:182`)는 **빈 줄**이라 어떤 JSDoc 파서/에디터 hover 도 이 함수에 문서를 붙이지 못한다. 반면 `:107-130`의 장문 설명은 `:131`의 한 줄 코멘트와 공백 없이 인접해 있어 (도구에 따라) `MaskedDoc` 인터페이스의 문서로 오귀속되거나, 아예 어느 선언에도 붙지 않는 "떠 있는" 주석이 된다. 결과적으로 이 PR이 공들여 작성한 "왜 이렇게 설계했는가"라는 핵심 설명이, 정작 그것을 가장 필요로 하는 공개 함수 `extractLinks`의 실제 사용처(hover, IDE 자동완성 문서, `tsdoc`/`typedoc` 산출물)에서는 보이지 않게 됐다. 이는 순수 위치 오류이며 동작에는 영향이 없다.
  - 제안: 이 JSDoc 블록(`:107-130`)을 `export function extractLinks(...)` 선언(`:183`) 바로 위로 옮긴다. `MaskedDoc`/`buildMaskedDoc`/`lineForOffset` 는 이미 각자의 짧은 doc-comment(`:131`, `:141-146`, `:171`)를 갖고 있으므로, 큰 설명 블록만 이동시키면 중복 없이 각 선언이 제 몫의 문서를 갖게 된다.

- **[INFO]** (조치 불요) `MdLink.line`/`raw`, `LinkViolation.line` 필드에 대한 이전 라운드(`review/code/2026/08/29/14_36_39`) WARNING #5·#6 지적이 이번 diff에서 모두 반영됐다. `MdLink` 인터페이스(`:74-75`)와 `LinkViolation.line`(`:243`)에 새 계약("링크가 시작한 줄", "개행 포함 가능")이 인라인 주석으로 명시됐고, `plan/in-progress/harness-review-gate-followups.md` 상단 "현재 상태" 절도 "셋"→"둘"로 갱신되며 해소 경위가 취소선 항목으로 함께 기록됐다(관례 준수: 원문 취소선 보존 + 정정 병기).

- **[INFO]** (조치 불요) 이전 라운드의 Critical(`plan/in-progress/harness-review-gate-followups.md`의 예시 문구 `` [a]`code`(b) `` 가 인라인 코드 마스킹 규칙에 의해 실제 링크 `[a](b)`로 재구성되어 `findBrokenPlanLinks` 를 build-blocking RED로 만든 문제)는 이번 diff에서 그 예시를 코드펜스(` ``` `)로 감싸고, 정확히 그 함정에 빠졌던 경위 자체를 인접한 인용 블록(`plan/in-progress/harness-review-gate-followups.md`, "이 예시를 펜스로 감싼 이유" 단락)에 기록해 재발 방지 문서를 남겼다. `review/code/2026/08/29/14_36_39/RESOLUTION.md`의 서술과 실제 diff가 일치함을 확인했다.

- **[INFO]** (조치 불요, 긍정 관찰) `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`의 새 `describe` 블록(멀티라인 링크 텍스트, 2개 이상 멀티라인 링크의 줄 귀속, 단일+멀티 혼재, 3줄 스팬, 펜스 사이 비링크, 통합 DEAD 경로)은 각각 "왜 이 케이스가 필요한가"를 실측치·과거 결함 이력과 함께 JSDoc으로 남겨 회귀 방지 문서화 수준이 높다. README/API 문서: 이 모듈(`codebase/frontend/src/lib/docs/`)에는 README가 없고 공개 API 시그니처 변경도 없어(신규 export 없음) README·API 문서 갱신 필요성은 없다. `spec/conventions/spec-impl-evidence.md` 등 상위 spec 문서는 이 가드의 스코프(DEAD/ANCHOR, 3-scope)만 서술하고 내부 매칭 알고리즘은 언급하지 않으므로 spec 문서 drift도 없다.

## 요약

이번 diff는 `extractLinks()`의 멀티라인 링크 사각지대를 고치면서 JSDoc·인라인 주석·plan 문서(뮤테이션 근거 표 포함)를 매우 꼼꼼히 남겼고, 직전 리뷰 라운드가 지적한 Critical(plan 예시 문구가 자기 자신의 가드를 깨뜨린 문제)과 두 documentation WARNING(필드 계약 미문서화, plan 요약 stale)을 모두 정확히 해소했다. 다만 그 확장 과정에서 `extractLinks`용 장문 설계 JSDoc이 `MaskedDoc`/`buildMaskedDoc`/`lineForOffset` 세 신규 선언 앞에 끼어 정작 문서화 대상인 `extractLinks` 함수 본체와 물리적으로 분리됐고, 그 결과 실제 함수 선언 바로 위는 빈 줄이라 IDE hover 등에서 이 문서가 보이지 않는다. README·API 문서·CHANGELOG·설정 문서 관점에서는 추가 조치가 필요 없다.

## 위험도

LOW
