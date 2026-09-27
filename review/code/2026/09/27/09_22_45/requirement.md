# 요구사항(Requirement) 리뷰 — dto-class-jsdoc-citation

## 발견사항

- **[INFO]** 상위 트래커 항목이 아직 미종결 상태로 남아 있다 (구현 자체와는 무관, 의도된 워크플로 단계).
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:1277` (`- [ ] **\`Ref\` DTO **클래스** JSDoc 두 곳에 리뷰 인용이 남아 있다**`)
  - 상세: `plan/in-progress/dto-class-jsdoc-citation.md` 체크리스트(파일 6, L59-61)에도 `/ai-review`·`--impl-done`·"트래커 항목 닫기 · planner draft 이동"이 아직 `[ ]`로 남아 있다. 코드·spec 변경 자체는 완전하지만, 트래커 항목 종결과 draft 의 `plan/complete/` 이동은 이번 review 이후의 "마무리 커밋"으로 미뤄져 있다는 것이 plan 문서에 명시돼 있어 결함이 아니라 워크플로상 정상 대기 상태다.
  - 제안: 조치 불요 — `/ai-review` 통과 후 `--impl-done` → 트래커/plan 마무리 커밋 순서를 그대로 따르면 된다.

## 점검 상세

**기능 완전성 / 의도-구현 일치**: 목표는 "응답 DTO 클래스 JSDoc 두 곳(`TriggerWorkflowRefDto`, `ScheduleTriggerWorkflowRefDto`)의 리뷰 인용을 `//` 로 옮기고 가드의 동결 예외 목록(`EXPECTED_DTO_JSDOC_CITATIONS`)을 비운다"이다. 두 DTO 파일을 직접 열어 확인한 결과:
- `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` — 클래스 JSDoc(L17-24)에서 `(review/consistency/2026/09/06/00_48_52 W2)` 인용이 빠졌고, 바로 위 `//` 블록(L13-16)에 동일 인용이 전체 경로 형태로 옮겨졌다.
- `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` — 동일 패턴으로 클래스 JSDoc(L14-21)에서 인용이 빠지고 `//` 블록(L10-13)으로 이동했다.
- `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts`의 `EXPECTED_DTO_JSDOC_CITATIONS`가 `[]`로 비었고, "베이스라인은 0 이다 (2026-09-27)" 문구로 의도가 명시적으로 서술된다. 함수명·주석·실제 배열 값이 정확히 일치한다.
- `dto-jsdoc-citation-guard.ts` 헤더 JSDoc 도 "클래스 JSDoc 은 지금 플러그인이 싣지 않지만 규약이 같은 규칙을 둔다"로 정정되어, 가드의 실제 동작(클래스·프로퍼티 JSDoc 둘 다 스캔, 로직 자체는 변경 없음)과 주석이 일치한다.

**엣지 케이스**: 대조군 fixture(`fixtures/dto/responses/jsdoc-citation.fixture.ts`)의 `ViolationClassCitationDto`가 이번 diff와 무관하게 이미 존재해, `EXPECTED_DTO_JSDOC_CITATIONS`가 비어도 "클래스 JSDoc 인용을 가드가 여전히 잡는다"는 축을 별도로 검증한다. plan의 뮤턴트 표(M3)가 이 축을 정확히 짚었고 실측도 일치한다.

**TODO/FIXME/HACK/XXX**: diff 대상 파일 어디에도 없음.

**에러 시나리오 / 데이터 유효성 / 반환값**: 이번 변경은 순수 주석·테스트 상수·spec 문서 수정이며 런타임 로직·API 계약·에러 처리 경로에 영향이 없다. `findDtoJsDocCitations` 함수 시그니처·정렬·반환 타입은 그대로다.

**비즈니스 로직(규약) 정확성**: `review-citations.md` §3 표를 "DTO 필드·컨트롤러" 행과 "응답 DTO 클래스" 행으로 분리하고, 후자에 "필드와 같이 쓰지 않는다" 규칙을 명시했다. 신설 Rationale 절 `### §3 — 응답 DTO 클래스 JSDoc 도 인용을 쓰지 않는다 (2026-09-27)`의 앵커 슬러그(`#3--응답-dto-클래스-jsdoc-도-인용을-쓰지-않는다-2026-09-27`)를 GitHub 마크다운 앵커 생성 규칙(소문자화, `§`·`—`·괄호 등 비단어 문자 제거 후 공백을 하이픈으로)으로 직접 계산해 본 결과 표 안의 링크와 정확히 일치한다 — 실제로 클릭 가능한 앵커다.

**spec fidelity**: 관련 spec 은 `spec/conventions/review-citations.md`(§3 표·Rationale)와 `spec/conventions/swagger.md`(§3 "JSDoc 은 공개 OpenAPI 로 나간다" 문단)이다. 두 문서를 직접 읽어 line-level로 대조했다:
- `review-citations.md` §3 표: 필드 행("DTO 필드 · 컨트롤러의 `/** */` JSDoc")과 클래스 행("응답 DTO 클래스의 `/** */` JSDoc")이 diff 그대로 반영돼 있다.
- `swagger.md` §3: "플러그인이 `introspectComments` 로 **프로퍼티** JSDoc 을..."로 필드 한정이 붙었고, 클래스 JSDoc 관련 문장이 `review-citations.md` §3 을 상호 참조한다 — 양방향 링크가 실제로 존재.
- 두 DTO 파일에 `@ApiSchema` 데코레이터가 없음을 직접 grep 으로 확인 — spec draft/plan 의 실측 주장("클래스 JSDoc 은 지금 OpenAPI 로 나가지 않는다")과 부합.
- CHANGELOG.md 항목(L26-31)이 실제 diff 범위(가드 동결 목록 비움, 두 spec 문서 정정)를 정확히 요약한다.
- 두 라운드의 `consistency-check`(`--spec` 08_41_33 BLOCK:NO WARNING 3건, `--impl-prep` 08_53_02 BLOCK:NO WARNING 0건) 산출물을 직접 읽어, 1차 라운드 WARNING 3건(spec_impact 에 swagger.md 누락·draft 자체 Rationale 누락·트래커 종결 위임 누락)이 최종 draft(파일 7)에 모두 실제로 반영됐음을 대조 확인했다 — WARNING #1 → `spec_impact`에 `swagger.md` 추가+본문 정정, WARNING #2 → `## Rationale (draft)` 절 추가, WARNING #3 → "구현 위임" 절에 트래커 항목 종결 문구 추가.

spec-code 불일치(CRITICAL 대상)나 SPEC-DRIFT 는 발견되지 않았다. spec 자체의 결함도 없다 — 오히려 이번 변경이 이전 spec 문구("클래스 JSDoc 도 공개 OpenAPI 로 나간다")의 실측 오류를 스스로 정정한 case로, 결론(인용 금지)은 유지하고 근거만 필드/클래스로 분리한 정당한 정정이다.

## 요약

응답 DTO 클래스 JSDoc 두 곳의 리뷰 인용을 `//` 주석으로 옮기고 가드의 동결 예외 목록을 비우는 좁은 스코프의 변경으로, 코드(두 DTO 파일·가드 스펙·가드 본체)·spec(`review-citations.md`·`swagger.md`)·plan·CHANGELOG 다섯 산출물이 서로 line-level 로 정확히 일치한다. 두 선행 consistency-check 라운드(`--spec`·`--impl-prep`)가 발견한 WARNING 전건이 최종본에 실제로 반영됐음을 직접 대조했고, 뮤턴트 표(M1~M3)가 주장하는 검증 축(정확히 일치 래칫·대조군 fixture)도 코드에서 실물로 확인된다. CRITICAL/WARNING 급 결함은 발견하지 못했다. 유일한 INFO 는 상위 트래커 항목·plan 이동이 아직 열려 있다는 점인데, 이는 plan 자체가 "이번 review 이후 마무리 커밋에서 처리"라고 명시한 정상적인 워크플로 대기 상태다.

## 위험도

NONE
