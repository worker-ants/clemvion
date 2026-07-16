# AI Review 통합 보고서 — W4/W2 후속 (operation-tool-schema dedup + parity)

- 범위: `git diff origin/main..HEAD` (693e52fe1..HEAD) — 7개 파일 (shared 모듈 신규 + cafe24/makeshop provider 위임 + 테스트 + plan).
- 실행 reviewer: 8 (security / architecture / requirement / scope / side_effect / maintainability / testing / documentation) — fallback 평문 Agent fan-out (router-empty·FS-flakiness 회피).
- 방식: 각 reviewer 가 실제 코드 정독 + 다수는 jest/eslint/grep 실증.

## 전체 위험도: LOW

**Critical 0 / Warning 2 / INFO 3.** 순수 내부 dedup 리팩터(동작 불변, drift-0)이고 코드 결함은 없음. 두 Warning 은 동일한 **spec 문서 pointer drift** 한 건을 requirement·documentation 이 각각 보고한 것.

## Warning

| # | Reviewer | 발견 | 위치 | 처분 |
|---|----------|------|------|------|
| W1 | requirement / documentation | **[SPEC-DRIFT]** `spec/conventions/cafe24-api-metadata.md` 가 이제 존재하지 않는 구현 위치 `Cafe24McpToolProvider.buildJsonSchema()` 메서드를 "실제 production 구현" 으로 지목. 선행 PR #955 에서 이미 module 함수로 승격돼 1차 stale 했고, 본 PR 이 그 함수를 shared `operation-tool-schema.ts` 의 `buildOperationJsonSchema()` 로 이관해 파일명·심볼명 둘 다 어긋남. **코드 정상, spec 위치 참조만 낡음.** | `spec/conventions/cafe24-api-metadata.md:153`(§2), `:398`(§7) | **FIX**: §2:153·§7:398 을 `operation-tool-schema.ts` 의 `buildOperationJsonSchema()`(cafe24/makeshop 공유)로 정정. 타깃은 2 reviewer + 코드 diff 로 검증됨. code→spec SoT 참조(`operation-tool-schema.ts` JSDoc)는 이미 유효 — spec→code pointer 만 갱신. |

## INFO (조치 불요, 기록)

| # | Reviewer | 항목 |
|---|----------|------|
| I1 | requirement | shared `buildOperationJsonSchema` 의 oneOf 필터 후 `.fields` 접근이 `?? []` 로 방어 완화됨(구조적 상위형 사용 결과). concrete 카탈로그는 항상 `fields` 필수라 실사용 byte-identical, DRIFT-0 위반 아님. 이론상 malformed 입력 시 과거 TypeError → 현재 `anyOf: []`(무해). |
| I2 | requirement | makeshop 측 `.parameters`(JSON Schema) 직접 assert 통합 테스트 부재 — 본 PR 이전부터 존재하던 갭(diff 밖). drift-0 identity 테스트 + 신규 shared spec 이 간접 커버. 후속 backlog 검토 가능. |
| I3 | documentation | 순수 내부 리팩터라 README/API/.env/CHANGELOG 갱신 불요(동작 불변 — #955 와 카테고리 상이). |

## 검증된 사항 (이상 없음)

- **W4 drift-0**: 필드 타입 매핑·`required`+`oneOf`→`allOf`/`anyOf`·allowlist `*`/빈배열 시맨틱이 제거된 per-provider 함수와 byte-identical (jest 164/164, eslint clean, dangling reference 0).
- **W2 parity**: `loadIntegrationsForBudget` 가 `getForExecution` 과 **동일** `isUnreadableCredentials` 술어·`__unreadable` sentinel 사용, not-found best-effort skip 확인 (requirement 가 소스 직접 대조).
- **아키텍처**: shared 모듈이 cafe24/makeshop metadata 무import(순환 없음), 구조적 타입 경계 적절 (architecture 0C/0W).
- **scope/side_effect/maintainability/security**: 0C/0W. 제거된 export `buildCafe24JsonSchema` 는 자기 spec 만 참조했고 shared 로 재지정됨.

## 조치 계획

- W1(SPEC-DRIFT): spec pointer 2줄 정정 → `/consistency-check --impl-done` 로 code↔spec 정합 검증. 본 리팩터가 유발한 drift 이므로 본 PR 에서 해소.
- I1/I2/I3: 조치 불요 (기록).
