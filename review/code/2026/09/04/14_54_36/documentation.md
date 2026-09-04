# 문서화(Documentation) 리뷰 — 응답 DTO 83곳 `required` false→true 정정 배치

## 검증 방법

`review/code/.../_prompts/documentation.md` 의 diff 는 21개 DTO 파일 + `CHANGELOG.md` 만
보여주므로, 아래는 diff 판독뿐 아니라 실제 워킹트리(`git show 499675277`, 저장소 파일
`Read`/`grep`)를 직접 대조해 검증한 결과다. 저장소에는 아무것도 쓰지 않았다(읽기 전용
`git show`/`grep`/`Read` 만 사용).

## 발견사항

- **[INFO]** CHANGELOG 항목이 커밋 본문의 부수 효과(`ApiPropertyOptional` import 정리 12개
  파일)를 언급하지 않는다
  - 위치: `CHANGELOG.md:3`(신설 "Unreleased — 응답 DTO 83곳..." 항목 전체)
  - 상세: 커밋 메시지(`499675277`)는 "부수로 `ApiPropertyOptional` 사용이 0이 된 12파일의
    import 를 정리했다" 를 명시하지만, CHANGELOG 에는 이 내용이 없다. 클라이언트 영향이
    있는 항목이 아니라 CHANGELOG 누락이 실질적 문제는 아니다 — 하지만 CHANGELOG 본문이
    "이 배치를 등재할 때 틀렸다" 류의 자기 반증 서사를 상세히 남기는 톤을 이미 갖고
    있으므로, 완전성 차원에서 한 줄 덧붙일 여지가 있다.
  - 제안: 선택 사항. 다음 관련 커밋에서 함께 정리해도 무방.

## 검증한 항목 (문제 없음 확인)

1. **CHANGELOG 수량 주장 정확성** — "83필드" 주장을 `git show 499675277`
   diff 에서 실측(`grep -c '^-  @ApiPropertyOptional'` = 83, 옵셔널 마커(`?:`) 제거 카운트도
   83)으로 교차 검증했고 일치한다. "12파일의 import 정리" 주장도 실측 일치(12).
2. **오래된 주석(stale comment) 여부** — 변경된 83개 필드 주변 JSDoc/인라인 주석에
   "선택적"·"생략 가능"·"optional"·"undefined 가능" 류의, 이제 `required: true` 로 바뀐
   사실과 모순되는 서술이 남아있는지 21개 파일 전수(diff + 워킹트리) grep 으로 확인 —
   **0건**. 오히려 `folder-response.dto.ts` `parentId`, `execution-response.dto.ts`
   `triggerId`/`finishedAt`/`reRunOf` 등 주석은 "null 이면 무엇을 의미하는가" 만 서술하고
   있어 `required:true` 전환과 자연스럽게 부합한다.
3. **관련 규약 문서(`spec/conventions/swagger.md`) 정합성** — 이 문서는 이미
   `@ApiPropertyOptional` 대신 `@ApiProperty({ nullable: true })` 를 쓰라는 지침(107~110줄
   부근)을 담고 있다. 이번 배치는 그 지침을 코드에 소급 적용한 것이므로 규약 문서 자체를
   갱신할 필요는 없다 — 오히려 코드가 문서를 뒤늦게 따라간 사례다(CHANGELOG 표현과 일치).
4. **§5.4 링크 유효성** — CHANGELOG 의 `[API 규약 §5.4](spec/5-system/2-api-convention.md)`
   상대경로가 실제 파일로 해석되고, 해당 파일에 `§5.4` 섹션이 존재함을 확인했다.
5. **누락(batch 미완료) 여부** — "응답 DTO 의 `nullable:true` + `ApiPropertyOptional`" 패턴이
   이번 배치 이후 저장소에 잔존하는지 AST 유사 파서(괄호 깊이 추적)로 21개 대상 파일 중 잔여
   후보 8개 파일을 재검사 — 잔존 0건. grep 만으로는 인접한 다른 필드의 `nullable:true` 를
   오탐(false positive)으로 잡았으나, 블록 단위로 재확인해 배치가 스코프 내에서 완결됐음을
   확인했다.
6. **plan 문서 동기화** — `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
   해당 체크박스(§5.4 drift 배치 — 응답측 83곳)가 `[x]` 로 갱신되어 있고, 본문 서술이
   CHANGELOG·커밋 메시지와 수치·서사 모두 일치한다(83/104=21+83, "기계화되지 않는다" 오류
   정정 서사 포함).
7. **README/설정 문서** — 새 환경변수·설정·엔드포인트 추가가 아니라 기존 OpenAPI 선언의
   `required` 플래그만 실제와 맞춘 변경이라 README 갱신 대상이 아니다. API 엔드포인트 자체
   문서(스펙 §5.4, EIA §5.3, §R17 등)는 이미 이 필드들을 "항상 present" 로 서술하고 있었고
   이번 변경은 OpenAPI 선언을 그 서술에 맞춘 것이므로 별도 API 문서 갱신도 불필요.
8. **예제 코드** — Swagger `example` 값들은 필드 값 형태(`nullable: true`)를 그대로 유지한
   채 `required` 플래그만 바뀐 것이라 예시 갱신 불필요.

## 요약

이번 변경은 21개 응답 DTO 파일에서 `@ApiPropertyOptional({nullable:true}) field?: T | null`
을 `@ApiProperty({nullable:true}) field: T | null` 로 기계적으로 뒤집은 순수 문서(OpenAPI
선언) 정합화 작업이며, 동반된 `CHANGELOG.md` 항목이 배경(#1277/#1280)·수량(83)·영향(클라이언트
생성 타입 좁아짐, wire 불변)·이전 자기 판단 오류("기계화되지 않는다")의 정정 과정까지 상세히
기록하고 있다. 실측 대조 결과 CHANGELOG 의 모든 수치 주장이 정확했고, 오래된 주석이나 스펙
문서와의 불일치도 발견되지 않았으며, 관련 `plan/` 체크리스트도 동기화되어 있다. 유일한
지적사항은 CHANGELOG 가 커밋 본문의 부수 효과(import 정리 12파일)를 언급하지 않는다는
INFO 수준의 완전성 갭뿐이다.

## 위험도

NONE
