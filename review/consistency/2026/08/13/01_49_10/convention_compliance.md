# 정식 규약 준수 검토 — spec/data-flow/ (impl-done, diff-base origin/main)

## 검토 대상 요약

- 구현 변경(diff)은 두 파일뿐: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` ·
  `idempotency.interceptor.spec.ts`. 손상된 Redis 캐시 엔트리(바깥 JSON·안쪽 `responseJson`)를 fail-open 으로
  처리하도록 강화한 순수 내부 하드닝이며, **DTO·Controller·API endpoint·Swagger 데코레이터·에러 코드 신설은
  없음** (재사용된 기존 `IDEMPOTENCY_KEY_CONFLICT` 만 그대로 유지).
- 대응하는 spec 문서는 `spec/data-flow/15-external-interaction.md` (§1.2, §2.2, §4, Rationale "Fail-open 정책의
  일관 표기") — 이번 diff 에서 spec 파일 자체는 변경되지 않았다(코드만 변경).
- 점검 관점 1~5(명명/출력포맷/문서구조/API문서/금지항목)를 아래 관련 정식 규약과 대조했다. 예산 절단으로
  번들에 요약만 남은 `error-codes.md`·`swagger.md`·`interaction-type-registry.md`·`spec-impl-evidence.md`
  는 워크트리 절대경로에서 직접 Read 로 원문을 재확인해 판단 공백을 메웠다.

## 발견사항

없음 — CRITICAL/WARNING 대상 위반을 찾지 못했다. 근거:

- **명명 규약**: 이번 diff 가 다루는 상태값·식별자(`IDEMPOTENCY_KEY_CONFLICT`, Redis 키 `interaction:idempotency:<executionId>:<route>:<key>`, `MAX_KEY_LENGTH` 등)는 diff 이전부터 존재했고 diff 는 이를 변경하지 않았다. 신규로 추가된 내부 헬퍼(`isIdempotencyEntry` · `isHttpStatusCode` · `describeShape` · `discardCorruptEntry`)는 클라이언트에 노출되지 않는 module-private 구현 세부이며, `spec/conventions/error-codes.md` 의 적용 범위(§ Overview "본 규율은 ... 프로젝트 전체의 에러 코드 **문자열**에 적용")·`node-output.md §3.2` UPPER_SNAKE_CASE 요구는 wire 로 나가는 `error.code` 값에 대한 것이라 해당 없음.
- **출력 포맷 규약**: 캐시 엔트리 `{bodyHash, responseJson, statusCode}` shape 는 Redis 내부 저장 포맷일 뿐 API 응답·이벤트 payload 가 아니다(클라이언트가 캐시된 원 응답을 그대로 재생받을 뿐, 이 wrapper shape 자체를 보지 않는다). `swagger.md §2-4/§2-5/§5` (상태 코드 데코레이터·응답 wrapping·응답 DTO)는 Controller 층 규약인데 이번 diff 는 Interceptor 내부만 건드려 해당 조항의 적용 대상이 아니다.
- **문서 구조 규약**: `spec/data-flow/15-external-interaction.md` 를 포함해 번들에 포함된 `spec/data-flow/*.md` 전 파일이 Overview → 번호 섹션(1~4/5) → Rationale 3단 구조를 일관되게 따른다. `spec/data-flow/**` 는 `spec-impl-evidence.md §1` 의 inclusive list 에서 **명시적으로 제외**된 영역이라(“데이터 흐름 다이어그램·엔티티↔플로우 매핑 문서로 ... frontmatter 의무 대상이 아니다”) `id/status/code` frontmatter 부재는 위반이 아니다(직접 원문 확인 완료). `0-` prefix 는 루트 `0-overview.md` 에 정상 사용.
- **API 문서 규약**: 이번 diff 는 controller/DTO 를 건드리지 않아 Swagger 데코레이터·DTO 명명 패턴 조항(§1~§2)이 적용될 신규 표면이 없다. `spec/5-system/14-external-interaction-api.md` frontmatter 의 `code:` glob (`codebase/backend/src/modules/external-interaction/**`) 이 이미 `idempotency.interceptor.ts`/`.spec.ts` 를 포괄하므로 spec-impl-evidence 관점의 커버리지 갭도 없다.
- **금지 항목**: `swagger.md §6` “레거시 패턴 제거”(빈 껍데기 스키마, pagination 형태 오기재)에 해당하는 패턴 없음. 코드 코멘트가 `spec/data-flow/15-external-interaction.md` 의 “Redis … 전 경로 fail-open (warn) — 가용성 우선” 문구를 인용하는데, 실제 §4 외부 의존 표의 문구와 일치해 근거 없는 인용(Rationale 왜곡)도 아니다.

## 참고 (비위반, 관찰만)

- 코드 JSDoc(`intercept()` 클래스 주석)에 “종전엔 세 경로였는데 실제로는 넷이었다” 류 mutation-testing 이력 서술이 상세히 박혀 있다. 이는 정식 규약이 규정하는 대상(명명/출력/문서구조/API문서/금지항목) 밖의 스타일 사안이라 findings 로 올리지 않았다 — 참고로만 남긴다.
- 번들(`_prompts/convention_compliance.md`)의 `spec/conventions/error-codes.md`·`swagger.md`·`execution-context.md`·`node-output.md`·`interaction-type-registry.md`·`spec-impl-evidence.md` 는 컨텍스트 예산 초과로 본문이 절단돼 있었다(“의도된 절단” 배너). 이번 검토는 그 5개 문서를 워크트리 절대경로에서 직접 Read 해 원문 기준으로 판단했으므로 판정 자체는 예산 절단의 영향을 받지 않았다. 다만 코드/문서 규모가 더 큰 change 를 이 컨벤션 checker 로 돌릴 때는 동일 절단이 재발할 수 있다는 점은 남겨 둔다.

## 요약

이번 PR 은 EIA idempotency 인터셉터의 캐시 손상 방어를 강화하는 순수 내부 하드닝으로, Controller·DTO·API endpoint·에러 코드 등 정식 규약이 규율하는 어떤 외부 표면도 새로 만들거나 바꾸지 않았다. 대상 spec 문서 `spec/data-flow/15-external-interaction.md` 는 문서 구조 규약(Overview/본문/Rationale)을 그대로 따르고, `spec/data-flow/**` 의 frontmatter 면제는 `spec-impl-evidence.md` 에 명시된 의도된 예외이며, `code:` glob 커버리지도 이미 이번 변경 파일을 포괄한다. 점검 관점 5가지 전부에서 CRITICAL/WARNING 급 위반을 발견하지 못했다.

## 위험도

NONE
