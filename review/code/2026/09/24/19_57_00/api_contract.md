# API 계약(API Contract) 리뷰

## 발견사항

해당 없음.

검토 대상 13개 파일은 다음 세 그룹으로 구성된다.

1. `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.{ts,test.ts}`,
   `spec-pending-plan-existence.test.ts` — spec frontmatter 의 `pending_plans:` 항목이
   실제 work plan(`plan/in-progress/**.md` 또는 `plan/complete/**.md`)을 가리키는지 검사하는
   순수 함수 `isPendingPlanPath` 와 그 단위/통합 테스트. HTTP 엔드포인트·컨트롤러·DTO·라우트가
   전혀 없는 빌드타임 문서 검증 가드다.
2. `plan/in-progress/pending-plan-is-plan.md`,
   `plan/in-progress/spec-draft-nullable-notation-followups.md` — 작업 추적용 plan 문서.
3. `review/consistency/2026/09/24/19_35_41/**` — 이미 실행된 `/consistency-check` 세션의
   산출물(SUMMARY, 각 checker 리포트, 상태 json). 리뷰 산출물 자체이지 API 구현이 아니다.

세 그룹 모두 API 계약(하위 호환성·버전 관리·응답/에러 형식·요청 검증·URL 설계·페이지네이션·
인증/인가)이 적용될 표면(NestJS 컨트롤러·DTO·라우트·미들웨어 등)을 포함하지 않는다.
`spec/5-system/2-api-convention.md`(API 계약 SoT) 변경 논의가 파일 5 안에 텍스트로 인용되어
있으나, 이는 과거(2026-09-04) `--spec` 검토 이력을 기록한 완료된 인용일 뿐 이번 diff 가 그
spec 파일 자체를 변경하는 것이 아니다(`spec_impact: none` — 파일 4 frontmatter로 확인).

## 요약

이번 변경은 spec 문서의 `pending_plans:` frontmatter 필드가 실제 plan 파일을 가리키는지
검증하는 문서 린트 가드(순수 함수 + 테스트)와 그에 따른 plan/리뷰 산출물 추가로 구성되며,
REST API 엔드포인트·요청/응답 스키마·인증/인가·페이지네이션 등 API 계약에 해당하는 코드
변경이 없다.

## 위험도

NONE
