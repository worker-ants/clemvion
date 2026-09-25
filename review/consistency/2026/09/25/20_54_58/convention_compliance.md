# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 확인

- 모드: `--impl-done`, diff-base `origin/main`, 실제 구현 diff = **2개 파일 · 91줄**
  (`codebase/backend/README.md`, `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`).
- `scope` 로 지정된 spec 영역(`2-navigation/9-user-profile.md` · `5-system/1-auth.md` ·
  `data-flow/12-workspace.md`)은 이번 라운드 **델타 0개** — 코드 전용 PR 이므로 정상이며, 이 자체를
  근거로 CRITICAL 을 내지 않는다(프롬프트 지시 준수).
- 실제 diff 는 (a) 워크스페이스 reflection 부트 캐너리 설명을 `@WorkspaceParam` 판별까지 확장한
  README 문서 갱신, (b) `transferOwnership` 의 "무락 인가 선행 → 락 재검사" 분기(강등/멤버십 소멸
  두 갈래)를 고정하는 unit 테스트 추가다. 두 변경 모두 `spec/data-flow/12-workspace.md` Rationale
  "경로 파라미터 워크스페이스도 가드가 본다 (2026-09-25)" 절이 이미 서술한 결정(§`transferOwnership`
  재검사 분기, `2026-09-25 정정`)의 실측·테스트 커버리지 보강이며, 새 API·DTO·에러 코드·redis
  key·audit action 을 신설하지 않는다.

## 관점별 점검

1. **명명 규약** — 새 식별자 없음. 언급되는 `@WorkspaceParam`·`@WorkspaceId()`·`handlerConsumesWorkspaceId`·
   `workspaceParamNamesOf` 는 기존 코드에 이미 존재하는 이름을 README 산문이 재서술한 것뿐이다. 위반 없음.
2. **출력 포맷 규약** — diff 는 API 응답·이벤트 페이로드를 건드리지 않는다. 테스트가 검증하는
   에러 코드 `OWNER_REQUIRED` 는 `spec/conventions/error-codes.md` §1·§3 이 이미 등재한 기존
   `UPPER_SNAKE_CASE` 코드이며 이번 diff 가 새로 발행하지 않는다. 위반 없음.
3. **문서 구조 규약** — `codebase/backend/README.md` 는 `spec/**` 문서가 아니므로 Overview/본문/
   Rationale 3섹션 권장이나 `_product-overview.md`·`0-` prefix 명명 규칙의 적용 대상이 아니다.
   diff 는 기존 절("### 2. 워크스페이스 reflection 캐너리")의 산문을 그 자리에서 확장한 것으로,
   문서 내 기존 절 구조·톤을 그대로 유지한다. 위반 없음.
4. **API 문서 규약(OpenAPI/Swagger 데코레이터·DTO 명명)** — diff 는 컨트롤러·DTO·swagger 데코레이터를
   전혀 건드리지 않는다(`spec/conventions/swagger.md` 의 `code:` 표면과 무관). 해당 없음.
5. **금지 항목** — `spec/conventions/**` 전체(오류 코드, cafe24/makeshop 카탈로그, redis-keys,
   migrations, secret-store, egress-masking, raw-query-results 등)에서 명시적으로 금지한 패턴 중
   이 diff 가 답습하는 것은 발견되지 않았다. 테스트 파일은 `it.each` 로 두 재검사 분기(강등/멤버십
   소멸)를 각각 다른 값으로 exercising 하며, 이는 오히려 `feedback_mutation_coverage_multiarm_operators`
   류의 "분기마다 다른 값" 원칙에 부합하는 형태다(참고 사항일 뿐 conventions 문서가 강제하는 항목은
   아님).

### 참고(INFO) — 리뷰 인용 규약과의 접점

`spec/conventions/review-citations.md` 는 `codebase/**` 의 코드·테스트 주석이 "왜 이 자리가 이렇게
생겼는지"를 리뷰 산출물 경로(날짜 포함, bare `hh_mm_ss` 금지)로 인용하는 관례를 성문화한다. 다만 이
규약은 **인용을 쓸 때의 형식**을 정하는 것이지 모든 설계-근거 주석에 인용을 강제하지는 않으며(§2 는
가드 미시행, 문서 자체도 "성문화"라고만 표현), 신규 테스트 주석
(`workspaces.service.spec.ts` 의 "트랜잭션 안 재검사 분기 — …" JSDoc)은 인용 없이 자체 설명만
담고 있다. 이는 CRITICAL/WARNING 사유가 되지 않는다 — 다만 이후 같은 자리를 다시 손볼 때, 이
분기를 발견한 리뷰 라운드(스펙 본문이 이미 "구현 뒤 리뷰가 찾았다"고 서술하는 그 라운드)의 경로를
곁들이면 저장소 관례와 더 가지런해진다는 제안 수준이다.

## 요약

이번 라운드의 실제 구현 diff(README 캐너리 설명 확장 + `transferOwnership` 재검사 분기 테스트
추가, 2파일/91줄)는 `spec/conventions/**` 가 규율하는 명명·출력 포맷·문서 구조·API 문서·금지 패턴
어느 항목과도 충돌하지 않는다. 새 API·DTO·에러 코드·식별자를 신설하지 않고 기존 문서 절과 기존
UPPER_SNAKE_CASE 에러 코드 체계를 그대로 따르는 순수 보강 변경이다. scope 로 지정된 spec 3개
파일은 이번 델타에 포함되지 않아(정상) 별도 구조 위반 여부는 이번 라운드의 판단 대상이 아니다.

## 위험도

NONE
