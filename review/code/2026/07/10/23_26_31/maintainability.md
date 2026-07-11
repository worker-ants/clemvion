# 유지보수성(Maintainability) 리뷰 결과

## 리뷰 범위 참고

리뷰 대상 35개 파일 중 실제 코드(TS/TSX) 변경은 파일 1~4(`conversation.test.ts`, `presentation.test.ts`,
`presentation.ts`, `presentations.test.tsx`)뿐이다. 파일 5(plan)·6~32(직전 code-review/consistency-check
산출물, `review/**`)·33~35(spec 문서)는 마크다운으로, 함수 길이·중첩 깊이·순환 복잡도 등 코드 전용 관점이
적용되지 않아 제외했다. 파일 1~4 diff는 직전 라운드(`23_04_23`)의 WARNING/INFO에 대한 fix 커밋(`da3d2672c`,
RESOLUTION.md 기재)이 반영된 최종본이며, 현재 `presentation.ts` 전체를 직접 읽고 대조했다.

### 발견사항

- **[INFO]** 직전 라운드 지적사항 중 실질 개선으로 반영된 항목 확인 (조치 불요, 참고 기록)
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts:108-125` (`TRUNCATION_KEYS` + `truncationMeta()`), `:1-6`(모듈 헤더), `:140-141`(JSDoc 우선순위 서술)
  - 상세: 직전 라운드 `side_effect`/`maintainability` INFO가 지적한 "통째 스프레드로 인한 임의 키 오염 가능성"은 명시적 4-키 화이트리스트(`TRUNCATION_KEYS`)와 이를 순회하는 순수 함수 `truncationMeta()`로 봉인됐다. 함수는 이름·시그니처·주석(`/** ... */`)이 파일의 기존 헬퍼(`asRecord`/`asArray`/`asButtons`) 네이밍·문서화 컨벤션과 정확히 일치하고 8줄 단순 루프로 순환 복잡도가 낮다. "충돌 시 top-level truncation 우선" 규칙도 JSDoc(`:140-141`)에 명문화되어 다음 유지보수자가 병합 순서를 추측할 필요가 없어졌다. 모듈 헤더 요약 주석(`:1-6`)도 `asEnvelope` JSDoc과 shape 정의가 일치하도록 갱신됐다. 리뷰 관점 1(가독성)·2(네이밍)·8(일관성) 기준 모범적인 fix.

- **[INFO]** 테스트 픽스처 헬퍼 `payloadOf` 2파일 중복은 그대로 유지 (직전 라운드에서 이미 조치 보류 결정)
  - 위치: `codebase/channel-web-chat/src/lib/conversation.test.ts:134-139`, `codebase/channel-web-chat/src/widget/components/presentations.test.tsx:365-370`
  - 상세: 두 로컬 헬퍼가 `{ type, toolCallId, renderedAt, payload }` 를 만드는 동일 역할을 각자 정의하며, `presentations.test.tsx` 쪽만 `truncation?` 3번째 인자를 추가로 갖고 있어 시그니처가 미묘하게 갈라진 상태가 이번 라운드에도 그대로 남아 있다. 직전 RESOLUTION.md가 "3번째 파일로 반복이 늘 때 공용 fixture로 추출" 결정을 명시적으로 기록했고, 이번 diff에서 `presentation.test.ts`(파일 2)는 `payloadOf`를 사용하지 않으므로 반복 파일 수는 여전히 2곳 — 보류 조건 미충족. 새 조치 불요, 기록만 갱신.
  - 제안: 현재와 동일 — 3번째 소비처가 생기면 `src/lib/__test-utils__/` 같은 공용 fixture 빌더로 통합.

- **[INFO]** `presentation.test.ts` 신규 7개 `it()` 중 5개가 `{ type: "table", toolCallId: "t", payload: {...} }` 골격을 개별 리터럴로 반복
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts` — "top-level truncation.rowsTruncated 를 truncated 로 흡수", "truncation.rowsTruncated=false 면 truncated=false", "payload.rowsTruncated=true 는 truncation 부재 시에도 유지", "payload 와 truncation 이 같은 키를 가지면 top-level truncation 우선", "truncation 의 미등록 키는 output 으로 흡수하지 않음" 5개 테스트
  - 상세: 같은 파일의 6번째 테스트("truncation 이 null/문자열이면 무시")는 `const base = {...}` 로 공통 골격을 추출해 3가지 변형을 재사용하지만, 나머지 5개는 각자 전체 객체를 새로 작성한다. 각 테스트가 독립적으로 읽혀야 하는 회귀 가드 성격상 지금 정도의 반복은 파일의 기존 스타일(리터럴 위주)과 일관되고 가독성을 크게 해치지 않는다 — CRITICAL/WARNING 급은 아니다.
  - 제안: 필수 아님. 향후 유사 케이스가 추가돼 반복이 더 늘면 `const tablePayload = (payload, truncation?) => ({...})` 같은 로컬 헬퍼(6번째 테스트의 `base` 패턴 확장)로 정리 고려.

- **[INFO]** `presentation.ts` 전체 함수 길이·중첩·복잡도 — 이번 diff로 악화 없음
  - 위치: `codebase/channel-web-chat/src/lib/presentation.ts` 전체
  - 상세: `asEnvelope`(diff 대상 함수)는 조건 1개(`if (typeof o.type === "string" ...)`) 단일 분기, 중첩 깊이 1, 8줄로 유지된다. `truncationMeta` 도 단일 for-loop, 중첩 깊이 1. `toCarousel`/`toTable`/`toChart`/`toTemplate` 등 기존 함수는 이번 diff의 변경 대상이 아니며 각 15~20줄, 단일 책임(한 shape → 하나의 Data 타입)을 유지한다. 새로 추가된 코드가 함수 길이·중첩·순환 복잡도를 증가시키는 지점은 없다.

### 요약

이번 diff의 실질 프로덕션 변경은 `presentation.ts`의 `asEnvelope` 병합 로직 1곳(및 이를 지원하는 신설 상수 `TRUNCATION_KEYS`·순수 함수 `truncationMeta`)에 국한되며, 직전 리뷰 라운드(`23_04_23`)에서 지적된 INFO/WARNING(임의 키 오염 가능성, 모듈 헤더 staleness, 병합 우선순위 미문서화, 우선순위 lock-in 테스트 부재, non-object truncation 방어 테스트 부재)가 fix 커밋에서 정확히 그 항목들에 대응해 해소됐음을 코드 실측으로 확인했다. 네이밍·문서화·복잡도·중첩 모두 파일의 기존 컨벤션과 일관되고 새로운 유지보수 부채를 추가하지 않는다. 남은 항목은 전부 INFO 등급 참고 사항(`payloadOf` 2파일 중복은 프로젝트가 이미 "3번째 파일 시 추출"로 명시적 보류 결정, 신규 테스트 5건의 경미한 리터럴 반복)으로, 즉각 조치가 필요한 수준이 아니다.

### 위험도
NONE
