# 정식 규약 준수 검토 — 03 m-4 catch 변수명 통일

검토 대상: `eslint-plugin-unicorn@^56 catch-error-name` 룰 도입 + 49개 파일 catch 변수명 `err` 통일  
diff-base: `origin/main` / 커밋: `8f2b6d12`

---

## 발견사항

### 발견사항 없음 (NONE)

검토 관점 5항목 전체에 걸쳐 정식 규약 위반이 발견되지 않았다.

**근거:**

1. **명명 규약** — 파일명·식별자·API endpoint 명명에 변경 없음. 영향 범위는 TypeScript `catch` 절 파라미터 이름(`error`/`e`/`e: unknown` → `err`/`err: unknown`, 외부 스코프 충돌 시 `err_`) 만이다. `spec/conventions/` 내 어떤 문서도 catch 파라미터 명명을 소유하지 않는다(`error-codes.md` 는 발행되는 에러 코드 *문자열* 명명만 소유하며 TypeScript 변수명은 대상이 아님). `eslint.config.mjs` 인라인 주석이 이를 명시: "spec/conventions 어느 문서도 catch 변수명을 소유하지 않으므로 이 lint 룰이 단일 진실이다."

2. **출력 포맷 규약** — API 응답 봉투·이벤트 페이로드·에러 코드 문자열 어디도 변경 없음. catch 내부 로직은 동일 — 오직 지역 변수 이름만 치환.

3. **문서 구조 규약** — spec 문서 신설·수정 없음. CLAUDE.md 의 Overview/본문/Rationale 3섹션, `_product-overview.md`·`0-` prefix 규약과 무관한 코드-only 변경.

4. **API 문서 규약** — DTO 명명·`@nestjs/swagger` 데코레이터 패턴(`spec/conventions/swagger.md`) 변경 없음.

5. **금지 항목** — conventions 가 명시 금지한 패턴(에러 코드 `lower_snake_case` 신규 발행, `UPPER_SNAKE_CASE` 에러 코드 임의 rename, 감사 액션 형식 위반 등) 없음.

**`err_` 패턴 (보조 관찰):** 일부 테스트 파일에서 외부 스코프의 `err` 식별자와 충돌을 피하기 위해 `.catch((err_: unknown) => err_)` 형태가 사용된다(예: `executions.controller.spec.ts`, `llm.service.spec.ts` 등). 이는 unicorn `catch-error-name` 룰의 `ignore: ['^_']` 면제 패턴(`^_` prefix 허용)을 trailing 변형으로 적용한 것이다. 어떤 정식 규약과도 충돌하지 않으며 규약 갱신이 필요한 사안도 아니다.

---

## 요약

본 변경은 `eslint-plugin-unicorn@^56` 의 `catch-error-name` 단일 룰을 backend eslint 설정에 추가하고, 49개 파일에 걸쳐 catch 파라미터 이름을 `err` 로 기계적으로 통일한 behavior-preserving 리팩토링이다. 변경된 내용은 TypeScript 지역 변수 이름에 한정되며, `spec/conventions/` 의 어떤 정식 규약도 catch 파라미터 명명을 소유·규율하지 않는다. 에러 코드 문자열·API 응답 봉투·DTO 패턴·문서 구조·감사 액션·audit-actions 명명 등 규약이 적용되는 모든 surface 에 변경이 없다.

---

## 위험도

NONE
