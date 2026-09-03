# 정식 규약 준수 검토 — convention_compliance

## 검토 개요

- 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
- **scope(`spec/conventions/**.md`) 델타: 0개 파일** — 이 브랜치는 어떤 정식 규약 문서도 바꾸지 않았다. 프롬프트가 명시한 대로, 이 자체는 CRITICAL 사유가 아니다(코드 전용 PR 이면 정상).
- 구현 diff(9파일/1025줄)는 `codebase/backend/src/common/__test-utils__/source-scan.ts`(+새 export `collectTsFiles`/`stripLiterals`)와 5개 `repo-guards/__tests__/*-guard.ts`(각 파일에 사본으로 있던 디렉터리 walker `walkTsFiles`/`listSourceFiles`/`collectSourceFiles`/`collectScanTargets`/`listProductionSources`를 `collectTsFiles` 하나로 통합), 그리고 `nullable-type-lie-cast-guard.ts`에 넓혀진(nullable) 필드 탐지·낡은 spec 캐스트 탐지 로직(`widenedEntityFields`/`findStaleSpecCasts`/`isNullableType`) 추가로 구성된다. 전부 **내부 회귀 가드/테스트 인프라** 코드이고, 프로덕션 API 응답·이벤트 페이로드·에러 코드·DTO·Swagger 데코레이터·감사 액션 명명 등 정식 규약이 규율하는 product-surface 를 하나도 건드리지 않는다.

## 확인한 절차

1. `spec/conventions/` 25개 최상위 파일 + 하위 `cafe24-api-catalog/`·`makeshop-api-catalog/` 전수 목록을 확보(번들 헤더 기준)하고, 이번 diff 가 건드린 5개 guard 파일·`source-scan.ts` 경로가 **어느 conventions 문서의 frontmatter `code:` 에도 등재돼 있지 않은지** grep 으로 전수 확인(`grep -rl "repo-guards" spec/conventions/*.md` → 0건).
2. 유일하게 `code:` 로 `source-scan.ts` 를 지목하는 문서(`spec/conventions/raw-query-results.md`, `status: implemented`)를 열어 diff 가 그 문서의 불변식(raw `UPDATE/DELETE … RETURNING` 튜플 언랩, snake_case 컬럼명)을 건드리는지 확인 — diff 는 `stripComments`/`countRawUpdateReturning` 등 기존 raw-SQL 관련 export 를 그대로 두고, 새로 추가한 것은 무관한 축(`.ts` 파일 수집·문자열 리터럴 마스킹)이라 그 불변식과 충돌하지 않는다.
3. `spec-impl-evidence.md`(§1 적용 대상에 `spec/conventions/**.md` 포함) 기준으로 이 diff 가 어떤 conventions 문서의 `status`/`code:` 를 stale 하게 만들지 않는지 확인 — 매치되는 명시 경로(글로브 아님)라 삭제·이동이 없는 한 gate(`spec-code-paths.test.ts`)는 항상 통과.
4. `error-codes.md`·`redis-keys.md`·`audit-actions.md`·`migrations.md`·`node-output.md` frontmatter `code:` 를 각각 열어 이번 diff 경로와 교집합이 없음을 확인.

## 발견사항

- **[INFO] `raw-query-results.md` 의 `code:` 대상 파일이 문서 스코프보다 넓어졌다**
  - target 위치: 이번 diff — `codebase/backend/src/common/__test-utils__/source-scan.ts` (신규 export `collectTsFiles`/`stripLiterals`)
  - 관련 규약: `spec/conventions/raw-query-results.md` frontmatter `code: - codebase/backend/src/common/__test-utils__/source-scan.ts`, 및 그 `## Overview` — "raw SQL(`.query()`) **결과를 읽는 방법**의 SoT"
  - 상세: 이 문서는 자신을 "raw SQL 결과 읽기" 축(튜플 언랩·snake_case)의 SoT 로 좁게 선언하고 그 근거로 `source-scan.ts` 를 `code:` 에 명시한다. 이번 diff 로 그 파일에 **디렉터리 파일 수집(`collectTsFiles`)·리터럴 마스킹(`stripLiterals`)** 이라는, raw-query-results 축과 무관한 두 번째 책임이 들어왔다. `code:` 필드는 "파일 단위" 참조이므로 gate(`spec-code-paths.test.ts`, ≥1 매치)는 그대로 통과하며 **CRITICAL 은 아니다** — 다만 이 문서를 근거로 그 파일 전체가 raw-SQL 전용이라고 추정하면 오독이 생긴다.
  - 제안: 강제 사항 아님. 필요하면 `raw-query-results.md` frontmatter 옆에 짧은 주석("이 파일은 raw-SQL 축 외에 walker 공유 유틸도 포함 — 그 축의 SoT 는 없음")을 남기거나, `source-scan.ts` 최상단 docstring(이미 "세는·모으는 방식의 단일 출처"로 diff 안에서 갱신됨)만으로 충분하다고 판단해 문서 쪽은 그대로 둬도 무방.

- 그 외 명명 규약·출력 포맷 규약·문서 구조 규약·API 문서 규약·금지 항목 위반 **없음**. 근거:
  - 명명: 신규 export(`collectTsFiles`/`CollectTsFilesOptions`/`stripLiterals`/`widenedEntityFields`/`findStaleSpecCasts`/`StaleSpecCast`/`isNullableType`)는 모두 기존 `source-scan.ts` 자매 함수(`countRawUpdateReturning`/`stripComments`)와 동일한 camelCase 함수·PascalCase 인터페이스 규약을 따른다. 정식 규약이 이 계층(테스트 전용 내부 유틸)의 명명을 별도로 규율하지 않는다.
  - 출력 포맷: API 응답·이벤트 페이로드·에러 코드 신설/변경 없음.
  - 문서 구조: `spec/conventions/**.md` 변경 없음(델타 0) — Overview/본문/Rationale 3섹션·`_product-overview.md`·`0-` prefix 규율이 적용될 대상 자체가 없다.
  - API 문서 규약(`swagger.md`): 컨트롤러·DTO·데코레이터 변경 없음.
  - 금지 항목: 오히려 이 diff 는 conventions 가 명시적으로 금지하는 패턴(`spec/conventions/raw-query-results.md` §Rationale "네 번 독립 재발견"과 같은 클래스의 **로직 사본화**)을 walker 5사본 → `collectTsFiles` 1곳으로 **줄이는** 방향이다.

## 요약

이번 diff 는 회귀 가드(repo-guards)와 그 공용 test-utils(`source-scan.ts`) 내부에서 디렉터리 walker 사본 5개를 하나로 통합하고, nullable 타입 거짓말 가드에 "넓혀진 필드 겨눈 낡은 spec 캐스트" 탐지를 추가한 순수 내부 인프라 변경이다. `spec/conventions/` 문서는 한 파일도 바뀌지 않았고(정상 — 프롬프트가 이를 CRITICAL 사유로 삼지 말라고 명시), diff 가 건드린 코드 경로 중 정식 규약 frontmatter `code:` 에 등재된 것은 `raw-query-results.md` → `source-scan.ts` 하나뿐인데 이 파일은 삭제·이동 없이 그대로 존재해 gate 를 깨지 않는다. API 응답 포맷·에러 코드·감사 액션·Redis 키·마이그레이션·Swagger 데코레이터 등 정식 규약이 규율하는 어떤 product-surface 도 이 diff 의 대상이 아니므로, 명명·출력 포맷·문서 구조·API 문서·금지 항목 다섯 관점 모두에서 실질적 위반이 없다. 유일하게 남긴 것은 `raw-query-results.md` 의 `code:` 참조 파일이 이제 그 문서 스코프 밖 책임(파일 수집 유틸)도 갖게 됐다는 INFO 수준의 문서-정밀도 관찰뿐이다.

## 위험도

NONE
