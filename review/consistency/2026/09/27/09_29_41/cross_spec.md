# Cross-Spec 일관성 검토 — dto-class-jsdoc-citation

## 검토 대상

- `spec/conventions/review-citations.md` §3 (표 + Rationale 신설 절 "§3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)")
- `spec/conventions/swagger.md` §3 (같은 근거 문장에 "필드 한정" 문구 추가)
- 구현: `dto-jsdoc-citation-guard.ts` JSDoc 정정, `dto-jsdoc-citation.spec.ts` 의 `EXPECTED_DTO_JSDOC_CITATIONS` 를 빈 배열로, `schedule-response.dto.ts` / `trigger-response.dto.ts` 두 클래스 JSDoc 인용을 `//` 로 이동

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 변경 범위가 매우 좁고 두 spec 문서·구현이 이미 상호 인용으로 동기화되어 있음
  - target 위치: `spec/conventions/review-citations.md` §3 표의 "응답 DTO 클래스의 `/** */` JSDoc" 행, `spec/conventions/swagger.md` §3 "JSDoc 은 공개 OpenAPI 로 나간다" 절
  - 충돌 대상: 없음 (참고용 확인)
  - 상세: 두 문서가 서로를 링크로 참조하며("[`swagger.md` §3`](./swagger.md)" ↔ "[`review-citations.md` §3`](./review-citations.md)") 동일한 결론(클래스 JSDoc 도 인용 대상 아님, `//` 로 옮긴다)을 진술한다. `spec/conventions/spec-impl-evidence.md` §2.1 의 `code:` 필드 정의 예외 설명도 이 규약의 강제/비강제 구분("§2 축 미강제 / §3 응답 DTO 축만 강제")과 정확히 일치한다. 실제 가드 코드(`dto-jsdoc-citation-guard.ts`)는 클래스 선언과 프로퍼티 선언을 동일 로직으로 순회하도록 이미 구현되어 있고, spec 이 서술하는 "(B) 필드와 같이 쓰지 않는다" 방향과 일치한다.
  - 제안: 없음 — 현재 상태로 충분히 정합적이다.

- **[INFO]** 앵커 링크(`#3--응답-dto-클래스-jsdoc-도-인용을-쓰지-않는다-2026-09-27`) 검증
  - target 위치: `spec/conventions/review-citations.md:72`
  - 충돌 대상: 같은 문서 내 헤딩 `review-citations.md:191`
  - 상세: 더블 하이픈(`3--응답`)이 오탈자처럼 보이지만, 이 저장소의 기존 앵커 관례(`spec/2-navigation/4-integration.md` 등에서 "` — `" 를 포함한 헤딩이 만드는 앵커, 예: `#reactive_401-jobid-unique-화--dedup-완전-우회`)와 동일한 슬러그 생성 규칙(공백 문자 개별 치환, em-dash·`§`·괄호는 치환 없이 제거)을 따른 결과이며 실제로 대상 헤딩과 정확히 일치한다. 결함 아님.
  - 제안: 없음.

## 요약

이번 변경은 `spec/conventions/review-citations.md` §3 과 `spec/conventions/swagger.md` §3 이 함께 정의하던 "DTO·컨트롤러 JSDoc 은 리뷰 인용 대상이 아니다" 규칙의 경계를 "응답 DTO 클래스 JSDoc 도 필드와 동일하게 대상 아님"으로 좁히는 문서 정정과, 그에 맞춰 가드(`dto-jsdoc-citation-guard.ts`)의 주석 근거를 고치고 기존 두 클래스 JSDoc 인용을 `//` 로 옮긴 구현으로 구성된다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 축에서도 다른 spec 영역과의 모순은 발견되지 않았다. 두 spec 문서는 상호 링크로 동기화되어 있고, `spec-impl-evidence.md` 의 `code:` 필드 예외 설명도 최신 상태와 일치하며, 실제 가드 구현·DTO 파일 변경 모두 문서가 서술한 그대로다. 범위 밖 `spec/conventions/cafe24-api-catalog/**` 등 무관 영역과의 충돌도 없다.

## 위험도

NONE
