# 문서화(Documentation) Review

## 발견사항

- **[INFO]** `it.each` fixture 개수와 닫힌 키 집합 개수를 잇달아 다른 숫자 대명사("이 넷"/"이 셋")로 지칭해 순간적으로 오독 가능
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.spec.ts:355`(게이트 숫자 기준, diff 상 새 줄)
  - 상세: `// `details` 는 호출자가 명시적으로 실은 경우에만 붙는 선택 키다 — 이 넷은 안 싣는다.` 다음 줄 `// 이 셋을 벗어난 키가 생기면(...) 여기서 RED.` 에서 "이 넷"은 바로 위 `it.each` 의 4개 fixture(매핑 안 된 Error·http-error 4xx·HttpException·QueryFailedError)를, "이 셋"은 단언 배열의 3개 키(`code`/`message`/`requestId`)를 각각 가리킨다. 실제로는 정확한 서술이지만, 두 문장이 인접해 있고 지시 대상이 바뀌는 지점이 표시돼 있지 않아 빠르게 훑는 리뷰어가 "4개 키 중 3개만 검사하나?" 로 오독할 수 있다.
  - 제안: "위 네 fixture 모두 `details` 를 안 싣는다" / "이 세 키(`code`/`message`/`requestId`)를 벗어난 키가 생기면" 처럼 지시 대상을 명시하면 오독 가능성이 사라진다. (블로킹 아님 — 실제 진술은 코드와 정확히 일치함을 실측 확인함.)

## 확인한 사항 (문제 없음 — 교차검증 결과)

이 변경분은 대부분 **주석·테스트 문서화 자체가 목적인 정리 PR**이라, 통상적인 "코드 따라 문서가 뒤처짐" 유형의 리스크보다 "주석이 가리키는 대상이 실제로 맞는가" 가 핵심 리스크다. 아래를 `Read`/`Grep` 으로 직접 열어 대조했고 전부 일치했다:

- `http-exception.filter.spec.ts` 새 `describe` 블록의 JSDoc이 인용하는 `spec/5-system/3-error-handling.md §6.3.1`(존재, L474) 및 "`telegram-client.ts` 의 `describeFetchError` 가 유일하게 `.cause` 를 읽는다" 주장 — `grep -rn '\.cause' codebase/backend/src` 로 실측, 정확히 그 한 곳(L92)뿐임을 확인.
- `expression-resolver.service.spec.ts` 가 "축이 enumerable own key 인 이유"의 정본으로 위임한 `packages/expression-engine/src/__tests__/error-shape.spec.ts` 상단 주석 — 실제로 그 근거 문단이 그 파일에 있음을 확인(정본 위치가 올바름).
- `code.handler.spec.ts` 도 같은 정본을 가리키도록 갱신돼 있고(종전에 형제 spec을 가리켜 "한 다리 더 건너던" drift가 제거됨), 그 파일 자신의 `C1 —` 주석(L218 부근)도 형식 일치.
- `secret-resolver.service.ts` 의 "형제 4곳" 주장 — `grep -n "C1 —"` 로 `expression-resolver.service.ts`/`code.handler.ts` 2곳 + 대응 `.spec.ts` 2곳(총 4곳)을 실측 확인. 종전 "3곳" 오기가 정확히 4곳으로 정정됨.
- `redis-fail-open-catalog-guard.ts`/`.spec.ts` 의 JSDoc이 가리키는 `spec/5-system/_product-overview.md §NF-OB-07`(L75, L88 — `component (idempotency)` 표기가 가드의 정규식과 정확히 매칭)과 `spec/data-flow/9-observability.md` `## Rationale` 하위 "`component` 를 실제 배선된 값만 열거하는 이유"(L261) — 둘 다 실재하고 서술과 일치.
- `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 "9건 추가(10→19)" 정량 주장 — diff의 신규 `it`/`it.each` 실행수(개별 4 + `it.each` 4 + 1 = 9)와 원본 파일의 기존 `it` 개수(10개)를 직접 세어 확인, 일치.
- `worktree:` frontmatter가 두 plan 파일 모두 현재 워크트리(`eia-failopen-observability-18dc47`)로 갱신되어 실제 작업 위치와 일치.
- 신규 가드 파일들은 export 함수 전부에 "왜 이렇게 구현했는가"를 설명하는 JSDoc을 갖추고 있고(`readUnionMembers`가 정규식 대신 AST를 쓰는 이유, `readCatalogComponents`가 빈 배열 대신 throw 하는 이유 등), 형제 가드 `masked-reject-callers-guard.ts` 와의 관계도 명시돼 있어 신규 코드에 대한 문서화 수준은 양호.

## 해당 없음 확인

- **README/설정 문서**: 새 환경변수·설정 옵션 없음(순수 테스트/가드/주석 정리 + plan 트래커 갱신). 갱신 불요.
- **API 문서**: 엔드포인트 변경 없음.
- **CHANGELOG**: 이 저장소의 `CHANGELOG.md` 는 사용자 관측 가능한 런타임 동작 변경만 기록하는 관례이고(상단 "Unreleased" 항목들이 전부 동작 변경 서술), 이번 변경은 회귀 테스트 추가·주석 drift 정리·내부 가드 신설·plan 문서 갱신뿐이라 항목 추가가 불필요함을 확인.
- **예제 코드**: 사용자 대상 API가 아닌 내부 회귀 테스트·정합성 가드라 별도 사용 예시 불필요.

## 요약

이번 diff는 실질적으로 "문서(주석)가 실체와 어긋나는 문제를 스스로 찾아 고치는" 성격의 PR이다. `cause` 비노출 계측 테스트 신설, C1/C2 근거 주석의 정본화(패키지 레벨로 이동), `secret-resolver.service.ts` 의 "형제 3곳→4곳" 오기 정정, 신규 `redis-fail-open-catalog` 3자 정합 가드까지 — 모든 교차 참조(spec 절 번호, 파일 경로, 클래스/함수명, 정량 수치)를 직접 열어 대조했고 전부 실체와 일치했다. 뮤테이션 검증 결과(예측/실측 표)까지 plan 문서에 남겨 "왜 이 테스트가 필요한가"의 근거를 검증 가능한 형태로 제공하고 있어, 문서화 품질은 이 저장소 평균 대비 높은 수준이다. 유일한 지적은 인접한 두 문장에서 지시 대명사("이 넷"/"이 셋")가 서로 다른 대상(fixture 개수 vs 키 개수)을 가리켜 빠르게 읽으면 혼동될 수 있다는 가독성 수준의 INFO 하나뿐이며, 실제 정확성 문제는 아니다.

## 위험도

NONE
