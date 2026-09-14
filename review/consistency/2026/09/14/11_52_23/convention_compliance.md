# 정식 규약 준수 검토 — convention_compliance

## 검토 방법 메모

`_prompts/convention_compliance.md` 번들은 `spec/conventions/` 전체를 alphabetical 로 적재하다
budget 에 잘려 대부분 파일(`secret-store.md`·`review-citations.md`·`error-codes.md` 등)과
실제 `<git diff>` 본문이 "본문 생략됨" 플레이스홀더로만 남아 있었다. 번들의 지시(§"이 검토가
실제로 다루는 델타")에 따라 절단된 항목은 워킹트리 절대경로에서 직접 재확인했다:

- `git diff origin/main...HEAD -- codebase` (6개 파일 / 466줄 — 번들의 실측치와 일치) 를 직접 산출해 전문 확인.
- `spec/conventions/secret-store.md`, `spec/conventions/review-citations.md` 를 절대경로로 직접 Read.
- `codebase/backend/src/repo-guards/__tests__/` 의 기존 형제 가드(`redis-fail-open-catalog-guard.ts`, `masked-reject-callers-guard.ts`, `dto-jsdoc-citation-guard.ts` 등) 존재·구조를 대조.
- 인용된 리뷰 세션(`review/code/2026/09/14/11_27_40`)의 실제 WARNING 항목을 직접 확인.

**scope(`spec/conventions/`) 델타는 0개** — 이 브랜치는 spec 문서를 바꾸지 않았다(코드 전용
canary-hardening PR). 아래 검토는 "새 코드가 기존 spec/conventions 규약을 지키는가"를 다룬다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 신규 테스트 태그 표기(`[vacuity]`)와 형제 가드의 기존 태그(`[전제]`·`[캐너리]`)가 언어를 혼용
  - target 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` `it('[vacuity] 목록이 비어 있지 않다 …')`
  - 위반 규약: 해당 없음 — `spec/conventions/**` 어디에도 `it()` 라벨 표기 형식을 규정한 문서가 없다 (repo-guards 디렉토리는 `review-citations.md`·`swagger.md` 의 `code:` 준수 예시로만 등재되어 있을 뿐, 라벨 언어를 규정하지 않음)
  - 상세: `masked-reject-callers.spec.ts`/`redis-fail-open-catalog.spec.ts` 는 대조군·전제 테스트에 한국어 대괄호 태그(`[전제]`, `[캐너리]`)를 쓰는데, 이번 PR 은 같은 성격의 테스트에 영문 `[vacuity]`를 썼다. 정식 규약 위반은 아니고 형제 파일 간의 관례 일관성 정도의 사소한 차이.
  - 제안: 굳이 고칠 필요는 없음(정식 규약 대상 아님). 다음에 같은 파일을 손댈 때 태그를 `[대조군]`/`[전제]` 계열로 맞추는 정도의 선택 사항.

## 점검 관점별 확인 내역

1. **명명 규약** — `trigger-secret-columns-guard.ts` + `trigger-secret-columns.spec.ts` 쌍은 `repo-guards/__tests__/<name>-guard.ts` + `<name>.spec.ts` 명명 패턴을 그대로 따른다(`swagger.md`/`review-citations.md` 의 `code:` 가 지목하는 `dto-jsdoc-citation*.ts`·`swagger-dto-contract*.ts`·`user-entity-exposure*.ts`, 그리고 같은 디렉토리의 `redis-fail-open-catalog-guard.ts`·`masked-reject-callers-guard.ts` 와 동형). 상수명 `CANONICAL_SOURCE`/`CANONICAL_CONST`/`MIRROR_SOURCES`/`MIRROR_CONST` 도 기존 가드들의 대문자 상수 관례와 일치. 위반 없음.
2. **출력 포맷 규약** — 이번 diff 는 API 응답·이벤트 페이로드·에러 코드를 추가/변경하지 않는다(순수 테스트/가드 코드). `node-output.md`/`error-codes.md` 범위에 해당하는 변경 없음.
3. **문서 구조 규약** — `spec/**` 문서 변경 없음(델타 0). `plan/in-progress/trigger-canary-hardening.md` 의 frontmatter `spec_impact: none` 은 `feedback_spec_impact_gate_c_list` 가 요구하는 "실재 spec 경로 리스트 또는 bare `none`" 형식(스칼라 `none`)을 정확히 충족한다.
4. **API 문서 규약** — DTO·컨트롤러·OpenAPI 데코레이터 변경 없음. `schedule-trigger.e2e-spec.ts`/`trigger-workflow-ref.e2e-spec.ts` 가 쓰는 `assertMatchesContract(row, await contractForDto(TriggerDto))` 는 기존 response-contract 관례(swagger.md 계열)를 그대로 재사용하며 신규 위반 지점 없음.
5. **금지 항목** — 코드 주석의 리뷰 산출물 인용은 전부 `review-citations.md` §2 가 요구하는 "전체 경로 + 지적 번호" 형태(`review/code/2026/09/14/11_27_40 maintainability WARNING#2`, `review/code/2026/09/10/16_26_57 documentation W1` 등)로 쓰였고 bare `hh_mm_ss` 형태는 등장하지 않는다. `trigger-secret-columns-guard.ts` 의 컬럼 목록 파서가 정규식이 아니라 TypeScript AST 를 쓰는 것도 저장소가 이미 세운 형제 가드(`redis-fail-open-catalog-guard.ts`)의 관례를 따른 것으로, 금지된 패턴(정규식 기반 오판 소지)을 답습하지 않는다. `secret-store.md` §R4(트리거 삭제 시 explicit application-level cleanup, cascade 미채택)를 인용한 `trigger-workflow-ref.e2e-spec.ts` 의 새 주석은 실제 R4 본문과 일치하며 범위(프로덕션 삭제 경로 한정)도 정확히 좁혀 적었다 — SoT 를 왜곡하지 않음.

## 요약

이번 PR(`trigger-canary-hardening`)은 `spec/conventions/**` 문서를 전혀 변경하지 않는 코드
전용(canary-hardening test) 변경이며, 신규 코드가 기존 정식 규약을 위반하는 지점도 발견되지
않았다. 신규 가드 파일은 `repo-guards/__tests__/` 의 확립된 명명·AST-파서 관례를 그대로
따르고, 코드 주석의 리뷰 인용은 `review-citations.md` 의 "전체 경로 + 지적 번호" 형식을
전부 준수하며, `secret-store.md §R4` 인용도 원문 의미·적용 범위를 정확히 반영한다. 유일한
지적은 태그 언어 혼용이라는 사소한 스타일 차이(INFO)이며 이는 어떤 spec/conventions 항목도
위반하지 않는다.

## 위험도

NONE
