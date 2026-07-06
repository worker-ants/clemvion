# 요구사항 충족 검토 — 워크플로우 목록 단일 태그 필터 UI (spec §2.3 하향)

- 대상: `git diff origin/main...HEAD` (커밋 `2d0eb622c`)
- 변경 파일: `codebase/frontend/src/app/(main)/workflows/page.tsx`, `.../__tests__/workflows-page.test.tsx`, `codebase/frontend/src/lib/i18n/dict/{en,ko}/workflows.ts`, `plan/in-progress/spec-sync-workflow-list-gaps.md`, `spec/2-navigation/1-workflow-list.md`(+ 4개 consistency 산출물, 참고용)
- 관련 spec: `spec/2-navigation/1-workflow-list.md` §2.3 태그 행, Rationale §4, §3(API), `spec/5-system/2-api-convention.md` §4.2
- 서버 계약(변경 없음, 기존 구현): `codebase/backend/src/modules/workflows/dto/query-workflow.dto.ts`(`tag?: string`), `codebase/backend/src/modules/workflows/workflows.service.ts:84-86`(`:tag = ANY(w.tags)`)

## 발견사항

- **[INFO]** 공백만 입력한 태그가 trim 없이 서버로 전송됨
  - 위치: `page.tsx:207-208` (`if (debouncedTag) params.tag = debouncedTag;`)
  - 상세: `tagFilter`/`debouncedTag` 는 trim 되지 않는다. 사용자가 스페이스만 입력하면 `debouncedTag`가 `" "` 로 truthy 이므로 `?tag=%20` 이 그대로 서버에 전송되고, 서버는 `= ANY(w.tags)` 로 매칭해 (일반적으로) 0건을 반환한다. spec §2.3 문구("빈 값이면 미송신")는 문자 그대로 빈 문자열만 규정하고 공백-only trim 을 요구하지 않으므로 spec 위반은 아니다. 폴더 필터(`NativeSelect`, 값이 트리밍 불필요한 discrete select)와 달리 태그는 free-text 라 이 케이스가 발생 가능하지만, 결과가 "매칭 없음"으로 안전하게 수렴하므로 데이터 무결성·에러 유발 없음.
  - 제안: 필수 조치 아님. 원한다면 `debouncedTag.trim()` 게이트를 추가해 UX 개선 가능(별도 후속, 이번 스코프 아님).

- **[INFO]** reset 시 `tagFilter`/`debouncedTag` 동시 즉시 세팅 vs `search`의 비대칭 패턴
  - 위치: `page.tsx:387-396` (`handleResetFilters`)
  - 상세: `search` 리셋은 `setSearch("")`만 호출하고 `debouncedSearch`는 이후 300ms effect 가 자연히 `""`로 세팅한다. 반면 태그는 `setTagFilter("")` 와 `setDebouncedTag("")` 를 함께 즉시 호출한다(그 후 `tagFilter` effect 가 300ms 뒤 동일한 값을 다시 세팅해 사실상 no-op 재실행). 기능적으로는 동일한 최종 상태(빈 문자열, 필터 해제)에 도달하며, 오히려 reset 클릭 즉시 `hasActiveFilters`/EmptyState CTA 가 debounce 대기 없이 전환되는 이점이 있다(테스트 `"treats a typed tag as an active filter and clears it on reset"` 로 검증됨). 버그 아님, 구현 패턴의 사소한 비대칭.
  - 제안: 조치 불요. 통일하고 싶다면 `search` 리셋에도 동일 패턴(`setDebouncedSearch("")` 즉시 호출)을 적용하는 정도의 스타일 정리만 고려 가능.

- **[INFO]** 태그 대소문자·정규화는 spec 침묵 + 기존 서버 동작 그대로
  - 위치: 서버 `workflows.service.ts:84-86`, 엔티티 `tags: string[]`
  - 상세: `= ANY(w.tags)` 는 case-sensitive 매칭이며 저장/조회 어느 경로에도 정규화(lower-case 등)가 없다. 이는 이번 diff 로 새로 만들어진 문제가 아니라 기존 서버 계약 그대로이고, spec §2.3/§3 어디에도 대소문자 규칙을 규정하지 않는다. 회색지대.
  - 제안: 조치 불요(범위 밖).

- 확인 완료(결함 없음): spec §2.3 태그 행 문구("입력값을 `?tag=`로 전달", "`= ANY(tags)`", "빈 값이면 미송신", "검색과 동일 debounce", "page 리셋")와 `page.tsx` 구현이 line-level 로 정확히 일치. `debouncedTag` state, 300ms `setTimeout` debounce(`page.tsx:141-147`, `search`와 동일 구조), `if (debouncedTag) params.tag = debouncedTag`(`page.tsx:208`), `queryKey`에 `debouncedTag` 포함(`page.tsx:180`), `hasActiveFilters`(`page.tsx:384`)·`handleResetFilters`(`page.tsx:393-394`) 연동 모두 확인.
- 확인 완료(결함 없음): 필터 범위가 spec 하향(멀티→단일)과 일치 — `tagFilter`/`debouncedTag` 는 단일 `string` state, UI 는 단일 `<Input>`(멀티 선택 컴포넌트·배열 state 아님). 서버도 `tag?: string`(배열 아님) 단일 계약이라 FE-서버 양쪽 모두 단일로 일관.
- 확인 완료(결함 없음): 서버 `= ANY(w.tags)` 계약과 FE 송신 방식 정합 — 쿼리 파라미터 명(`tag`), 타입(단일 string), 빈 값 게이트(`if (tag)` 서버 / `if (debouncedTag)` FE) 모두 대칭.
- 확인 완료(결함 없음): 관련 유닛 테스트 4건(렌더, debounce 후 `?tag=`+page=1 송신, 기본 빈 값 미송신, active-filter/reset 상호작용) 전부 통과 확인(`npx vitest run` 재실행, 23/23 pass, 이 describe 블록 포함).
- 확인 완료(결함 없음): spec 문서 가드 테스트(`spec-link-integrity`, `spec-frontmatter`, `spec-status-lifecycle`, `spec-pending-plan-existence`) 712건 전부 pass — Rationale §4 앵커·frontmatter·pending_plans 실존성 문제 없음.
- 확인 완료(오탐 아님, 이력상 참고): diff 에 포함된 `review/consistency/2026/07/06/11_09_44/*.md` 4개 산출물은 **spec-only 단계**(코드 작성 이전)의 스냅샷이며 그중 `convention-compliance.md` 가 "태그 필터 코드가 없다"를 CRITICAL 로 지적한다. 그러나 이는 같은 최종 커밋(`2d0eb622c`, 11:21:31)에 FE 코드가 함께 반영되며 해소된 상태다 — 실제 diff 검증 결과 `page.tsx`/i18n/테스트에 태그 필터 구현이 존재함을 확인했다. 산출물 자체는 과거 시점 기록으로 남겨두는 것이 정상(작업 이력)이며, 이 리뷰 시점 기준으로는 CRITICAL 이 아니다.

## 요약

spec §2.3 태그 필터 행(단일 free-text, `?tag=` 단일 전달, `= ANY(tags)`, 빈 값 미송신, 검색과 동일 debounce, page 리셋)과 `codebase/frontend/src/app/(main)/workflows/page.tsx` 구현이 필드명·게이트 조건·debounce 시간·queryKey 구성까지 line-level 로 정확히 일치한다. 서버 쪽은 이번 diff 에 변경이 없고(`query-workflow.dto.ts`/`workflows.service.ts` 는 기존 구현 그대로), FE 가 그 기존 단일 계약(`tag?: string`, `= ANY(w.tags)`)에 정확히 맞춰 붙었다. 필터 범위도 spec 하향대로 단일이며 멀티 선택 요소는 어디에도 없다. 발견된 항목은 전부 INFO 수준(공백-only 미trim, reset 이중세팅, 대소문자 미정규화)으로 spec 이 규정하지 않은 회색지대이거나 기능 결함으로 이어지지 않는다. 관련 유닛 테스트(23건)와 spec 문서 가드 테스트(712건) 모두 통과했다. Critical/Warning 없음.

## 위험도

NONE
