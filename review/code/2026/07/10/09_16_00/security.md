# 보안(Security) 리뷰

## 대상
- `codebase/frontend/src/components/editor/expression/use-expression-suggestions.ts` — `$input.`/`$params.`/`$sourceItem.`/`$dataSource.` 4개 중복 if-block을 `NESTED_DRILL_SOURCES` 테이블 + 단일 dispatch loop로 추출한 behavior-preserving 리팩터.
- `plan/in-progress/suggestions-prefix-dry.md` — 신규 plan 문서 (코드 변경 없음).

## 분석 요약

순수 내부 리팩터로, 로직 흐름·데이터 소스·guard 조건이 원본 4개 if-block과 1:1 대응한다.

- `$input.` → `getSample: inputSample`, `getSchema: inputSchema` — 원본과 동일.
- `$params.` → `inputSample.parameters` 가드(object 타입·비배열 체크 후 fallback `{}`) — 원본 로직 그대로 이동.
- `$sourceItem.`/`$dataSource.` → `available: (d) => !!d.sourceItemSample` 게이트로 원본의 `&& expressionData.sourceItemSample` 단락 평가를 동일하게 재현. 게이트가 false면 loop가 다음 항목으로 넘어가고, 결국 원본과 동일하게 root-variable 목록으로 fall-through.

`insertText`/`label`은 텍스트 편집기 값(`value`)에 문자열로 삽입될 뿐(`expression-input.tsx`에서 `dangerouslySetInnerHTML` 등 HTML sink로 렌더링되지 않음을 확인) XSS sink가 아니며, 이 리팩터가 해당 흐름을 바꾸지도 않는다. 사용자 입력(커서 위치 기준 token)은 여전히 `startsWith`/`slice`/정규식 매칭에만 쓰이고 `eval`류 동적 실행이나 SQL/커맨드/경로 조합에 관여하지 않는다.

하드코딩 시크릿, 인증/인가 로직, 암호화, 에러 메시지 노출, 신규 의존성 — 모두 diff 범위에 해당 사항 없음 (클라이언트 전용 자동완성 UI 로직이며 API 키/토큰/세션 처리와 무관). `plan/*.md` 파일은 문서로 실행 코드 없음.

기능적으로 새로 추가된 분기·데이터 흐름이 없으므로 신규 공격 표면(attack surface) 없음.

## 발견사항

없음.

## 요약

이번 변경은 4개의 중복 if-block을 테이블 기반 dispatch loop로 추출한 순수 리팩터이며, 데이터 소스·guard 조건·fall-through 동작이 원본과 동일하게 보존된다. 사용자 입력은 클라이언트 측 자동완성 문자열 매칭에만 사용되고 HTML/DOM/네트워크/커맨드 sink로 전달되지 않으며, 시크릿·인증·암호화·에러 노출·의존성 관련 변경도 없다.

## 위험도
NONE
