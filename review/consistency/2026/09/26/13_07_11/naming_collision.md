# 신규 식별자 충돌 검토 — `spec-draft-swagger-success-advert.md`

## 발견사항

없음. target 이 실제로 도입/변경하는 식별자는 다음 넷뿐이며, 전수 검토 결과 기존 사용처와 충돌하지 않는다.

1. **신규 함수명 `ApiOkWrappedNullableResponse`** (§5-2 래퍼 표에 추가)
   - `codebase/backend/src/common/swagger/api-wrapped.ts` 전체와 저장소 전체(`.ts`/`.md`)를 grep 한 결과, 이 문자열은
     target 문서와 그 짝인 구현 plan(`plan/in-progress/success-advert.md`) 외에는 등장하지 않는다 — 기존 사용처 0건.
   - 명명 패턴도 기존 헬퍼군(`ApiOkWrappedResponse` · `ApiOkWrappedOneOfResponse` · `ApiOkWrappedArrayResponse` ·
     `ApiCreatedWrappedResponse` · `ApiAcceptedWrappedResponse` · `ApiOkPaginatedResponse`)의 `ApiOk<Modifier>Response`
     규칙을 그대로 따른다 — `Modifier=Nullable` 은 기존 `Modifier` 어휘(`OneOf`·`Array`·`Paginated`)와 겹치지 않는다.
   - 저장소에 이미 존재하는 "Nullable" 계열 식별자(`nullable-type-lie-cast-guard.ts`, `optional-nullable.fixture.ts`)는
     **필드 레벨** nullable 선언을 다루는 별개 축(§1-4/§1-6 DTO 필드 규약)이라 **응답 wrapper 레벨** 새 헬퍼와 의미가 다르고,
     이름도 `Api*Response` 접두 유무로 구분돼 혼동 여지가 낮다.

2. **규칙 문구 변경** — 「성공 응답을 하나도 광고하지 않는 핸들러는 대조하지 않는다」 → 「라우트는 성공 응답을 하나 이상
   광고한다」. 이 규칙의 SoT 는 `spec/conventions/swagger.md` §2-4 한 곳뿐이다(`spec/5-system/2-api-convention.md` 등
   인접 문서에 동일/유사 규칙 문장이 이중으로 존재하지 않음을 grep 으로 확인). 저장소 가드 식별자 `http-status-advertised` 도
   기존 이름을 그대로 재사용(신규 가드 파일 추가 아님) — frontmatter `code:` 글롭(`http-status-advertised*.ts`)이 이미
   이 가드와 그 fixture 를 포괄해 새 파일 경로 등재가 불필요하다.

3. **파일 경로** — target 자신(`plan/in-progress/spec-draft-swagger-success-advert.md`)은 이 저장소의 기존 컨벤션
   `spec-draft-<slug>.md`(예: 선례 `plan/complete/spec-draft-swagger-http-status-guard.md`)를 그대로 따르고, 짝이 되는
   구현 plan `plan/in-progress/success-advert.md` 와 이름이 겹치지 않는다(prefix `spec-draft-swagger-` 로 구분).

4. **요구사항 ID · API endpoint · 이벤트/메시지명 · 환경변수/설정키** — target 은 이 네 축 어느 것도 새로 도입하지 않는다
   (기존 `swagger.md` 문단·표·체크리스트·Rationale 불릿의 텍스트 편집일 뿐, 새 엔드포인트·이벤트·ENV 없음).

## 요약

target 이 새로 들여오는 식별자는 사실상 `ApiOkWrappedNullableResponse` 하나뿐이고, 저장소 전수 grep 결과 이 이름은 어디에도
선점되어 있지 않으며 기존 `ApiOk<Modifier>Response` 명명 관례와도 일치한다. 규칙 문구 변경은 `swagger.md` §2-4 한 곳이 유일한
SoT 라 이중 정의 충돌이 없고, 재사용하는 가드 이름(`http-status-advertised`)·파일 경로(`code:` 글롭)도 기존 것 그대로다. spec
draft 파일명 자체도 저장소의 `spec-draft-<slug>.md` 관례와 선례(`spec-draft-swagger-http-status-guard.md`)를 그대로 따른다.
신규 식별자 충돌 관점에서 이 target 은 깨끗하다.

## 위험도

NONE
