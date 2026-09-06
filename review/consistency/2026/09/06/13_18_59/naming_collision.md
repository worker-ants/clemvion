# 신규 식별자 충돌 검토 — `spec-draft-review-citations-enforcement.md`

## 검토 범위

target 은 새 제품 기능이 아니라 **기존 두 convention 문서**(`review-citations.md`,
`spec-impl-evidence.md`)의 Rationale/필드 정의 서술을 정정하는 planner 턴 plan 이다.
따라서 신규 요구사항 ID·엔티티·endpoint·이벤트·ENV 는 애초에 도입되지 않는다. 실제로
새로 등장하는 것은 (a) 기존 파일을 가리키는 `code:` frontmatter 항목, (b) 기존 heading 을
취소선으로 수정하는 편집, (c) 기존 선례 인용 문구의 축소뿐이다. 아래는 각 관점별 실측이다.

## 발견사항

- **[INFO]** `code:` 신규 등재 대상은 이미 저장소에 존재하는 파일이며 충돌 없음
  - target 신규 식별자: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation*.ts`
    (변경안 B, `review-citations.md` frontmatter `code:` 추가)
  - 기존 사용처: 실측 결과 해당 디렉터리에 `dto-jsdoc-citation-guard.ts` ·
    `dto-jsdoc-citation.spec.ts` · `fixtures/dto/responses/jsdoc-citation.fixture.ts` 3개
    파일이 실재한다 (`find codebase/backend/src/repo-guards -iname "*citation*"`). glob
    `dto-jsdoc-citation*.ts` 는 앞 두 파일만 매칭하고(파일명이 `dto-`로 시작하지 않는
    fixture 는 매칭 안 됨) `EXPECTED_DTO_JSDOC_CITATIONS` 상수도 `dto-jsdoc-citation.spec.ts:50`
    에 실재해 target 의 서술과 일치한다.
  - 상세: 다른 spec 문서의 `code:` 슬롯이 같은 파일을 다른 의미로 이미 점유하고 있지
    않음을 확인했다 (`swagger.md`·`2-api-convention.md` 의 `code:` 는 `swagger-dto-contract*.ts`
    ·`response-contract*.ts` 를 가리키며 겹치지 않는다). 충돌 없음.
  - 제안: 없음 (참고용 기록).

- **[INFO]** `code:` glob 폭에 대한 target 의 경고가 자매 plan 과 이미 일치함 — 동기화
  작업이 "충돌 해소"가 아니라 "이미 일치한 상태의 문서화"일 가능성
  - target 신규 식별자: 없음 (기존 파일 참조 문구)
  - 기존 사용처: `plan/in-progress/spec-draft-nullable-notation-followups.md:398,400,403-405`
    이 이미 동일한 glob 폭(`dto-jsdoc-citation*.ts`, `-guard` 미부착)과 "JSDoc 축은
    `spec-draft-review-citations-enforcement.md` 가 선행 집행한다"는 문장을 등재해 두었다.
  - 상세: target 의 종결 조건 중 "자매 plan 동기화" 항목이 요구하는 내용은 실측상 **이미
    자매 plan 쪽에 반영돼 있다.** 두 문서가 같은 `code:` 슬롯에 다른 폭을 지시하는
    충돌은 현재 발생하지 않는다 — 다만 이는 신규 식별자 충돌이 아니라 plan 진행상태
    추적(다른 checker 영역)에 가까운 관찰이라 이 리포트에서는 정보성으로만 남긴다.
  - 제안: 해당 없음. (진행상태 동기화 여부는 별도 checker 소관.)

- **[INFO]** heading·`id:`·선례 인용 텍스트에 신규/중복 식별자 없음
  - target 신규 식별자: 변경안 (A) 가 인용하는 heading
    `### `code:` 가 "구현 경로" 가 아니라 "준수 예시" 를 가리키는 이유`
  - 기존 사용처: `spec/conventions/review-citations.md` 의 `## Rationale` 아래 **동일
    heading 이 이미 존재**한다 (target 은 그 heading 을 새로 만드는 것이 아니라 본문에
    취소선+정정 표를 삽입하는 in-place 편집).
  - 상세: `id: review-citations` / `id: spec-impl-evidence` 는 각 문서에서 유일하게
    쓰이고 있어 target 이 새 `id:` 값을 만들지 않는다. 변경안 (C) 가 축소하는 선례 인용
    (`spec-impl-evidence.md:81`)도 실측 결과 target 이 인용한 원문과 정확히 일치한다.
  - 제안: 해당 없음.

## 요약

target 문서는 신규 제품 표면(ID·엔티티·endpoint·이벤트·ENV·신규 파일)을 도입하지 않고,
이미 존재하는 두 convention 문서의 서술을 실측에 맞춰 좁히는 정정 작업이다. `code:` 에
새로 등재하려는 파일 경로(`dto-jsdoc-citation*.ts`)는 실제로 저장소에 존재하며 다른 spec
의 `code:` 슬롯과 의미가 겹치지 않고, glob 폭에 대한 target 의 경고는 자매 plan
(`spec-draft-nullable-notation-followups.md`)의 기존 서술과도 이미 합치한다. heading·`id:`
·선례 인용 문구 어디에도 다른 의미로 선점된 식별자와의 충돌이 관측되지 않았다.

## 위험도

NONE
