# 정식 규약 준수 검토 — convention_compliance

## 검토 개요

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- **scope(`spec/5-system`) 델타: 0개 파일** — 이 브랜치는 해당 spec 영역을 바꾸지 않았다. 정상이며 그 자체로는 CRITICAL 근거가 아니다.
- 실제 판정 대상은 `git diff origin/main...HEAD` 의 구현 diff (8개 파일 · 452줄): 프롬프트 예산 절단으로 diff 본문이 프롬프트에 보이지 않아, 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/filter-pg-invalid-text`)에서 `git diff origin/main...HEAD`를 직접 실행해 확인했다.
  - `codebase/backend/src/common/utils/uuid.ts` / `uuid.spec.ts`
  - `codebase/backend/src/modules/auth/login-history.service.ts` / `.spec.ts`
  - `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` / `.spec.ts`
  - `codebase/backend/test/background-monitoring.e2e-spec.ts` / `session-revocation.e2e-spec.ts`
  - `CHANGELOG.md`, `plan/in-progress/keyset-cursor-uuid-validation.md`(신규), `plan/in-progress/spec-draft-nullable-notation-followups.md`(체크리스트 갱신)

## 발견사항

- **[WARNING] Background Runs REST 에러 코드 4종이 중앙 카탈로그(`3-error-handling.md §1`)에 미등재**
  - target 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:184` (이번 diff 가 `INVALID_CURSOR` 사용을 새 호출부로 한 곳 늘림)
  - 위반 규약: `spec/conventions/error-codes.md` 책임 경계 — "카탈로그·분류·트리거: `5-system/3-error-handling.md §1` (SoT)"
  - 상세: `INVALID_CURSOR`·`INVALID_LIMIT`·`EXECUTION_NOT_FOUND`·`BACKGROUND_RUN_NOT_FOUND` 는 `3-error-handling.md §1`의 카탈로그에 없다(§1.6 각주가 `EXECUTION_NOT_FOUND`를 "§1.2~§1.3 표준 코드 재사용"이라 적지만, 같은 문서 §1.9 기준으로는 도메인 특화 직접 등재 쪽에 더 가깝다). 이 코드 자체는 이번 diff 이전부터 존재했고 이번 diff는 기존 `INVALID_CURSOR` 사용처를 하나 늘렸을 뿐이라 **새로 만든 위반은 아니다.**
  - 이미 추적 중: `review/consistency/2026/09/12/22_51_25` convention_compliance WARNING → `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "planner 항목"으로 정확히 등재돼 있음(developer 가 spec 카탈로그를 직접 고치지 않고 planner 위임 원칙을 지킴 — CLAUDE.md 역할 경계 준수).
  - 제안: 신규 조치 불요. 다음 planner 턴에서 `3-error-handling.md §1.13` 신설 + `12-background.md §8.7` 역링크로 닫을 것을 재확인.

- **[WARNING] `2-api-convention.md §8.2` 가 cursor 페이지네이션을 단일 계약(실패 시 400 `INVALID_CURSOR`)으로만 서술 — `login-history` 는 실패 시 무시+1페이지로 이미 어긋나 있음**
  - target 위치: `spec/5-system/2-api-convention.md §8.2` vs `codebase/backend/src/modules/auth/login-history.service.ts` `decodeCursor`
  - 위반 규약: `spec/conventions/error-codes.md §1` 의미 기반 명명·카탈로그 정합 원칙(넓게는 출력 포맷 규약 — 동일 개념(cursor 실패)에 두 가지 wire 계약이 spec 본문엔 하나만 실려 있음)
  - 상세: 이번 diff 는 두 디코더의 **기존 계약(무시 vs 400)을 그대로 유지**한 채 `id` 성분 검증만 추가했다 — 비대칭을 새로 만들지 않았다. 다만 `§8.2`는 예외 각주 없이 단일 표준만 적어, 비대칭이 spec 본문에 반영되지 않은 상태가 이 diff로 사실상 고착됐다(두 계약 모두 검증이 강화돼 "다음에 통일하며 한쪽만 고친다"는 선택지가 줄었다).
  - 이미 추적 중: 같은 세션(`review/consistency/2026/09/12/22_51_25`) cross_spec WARNING → 동일 plan 파일에 "planner 항목"으로 정확히 등재. 계약 통일 여부와 함께 처리하도록 묶여 있음.
  - 제안: 신규 조치 불요. §8.2에 각주를 추가하거나 계약을 통일하는 결정은 planner 턴에서.

- **[INFO] 코드 주석 인용 형식은 규약을 정확히 준수**
  - target 위치: `uuid.ts`/`uuid.spec.ts`/`login-history.service.ts`/`background-runs.service.spec.ts`의 신규 주석 전부
  - 확인 규약: `spec/conventions/review-citations.md §2` (bare `hh_mm_ss` 금지, 전체 경로 권장)
  - 상세: 이번 diff가 추가한 리뷰 인용은 전부 `review/code/YYYY/MM/DD/hh_mm_ss` 전체 경로 형태이며(예: `review/code/2026/09/13/00_13_51`), 실제로 해당 세션 디렉터리가 워킹트리에 존재함을 확인했다(`review/code/2026/09/12/23_40_57`, `23_19_03`, `22_03_45`, `21_20_01`, `20_53_01`, `review/code/2026/09/13/00_13_51`, `review/consistency/2026/09/12/22_51_25` 전부 실재). bare 시각 인용 0건. 이 관점에서 위반 없음 — 감점 사유 아님, 참고로만 기록.

- **[INFO] `isUuidShaped` JSDoc 의 Rationale 인용이 실제 spec 대상과 일치**
  - target 위치: `codebase/backend/src/common/utils/uuid.ts` JSDoc → `spec/data-flow/12-workspace.md §"UUID 검증 강도 비대칭"`
  - 확인 규약: Rationale 인용은 실제 이력/문서와 일치해야 한다는 저장소 관행(허구 소급 근거 금지)
  - 상세: 인용된 섹션 제목이 대상 문서에 그대로 존재함을 grep으로 확인. 새 근거를 조작하지 않고 기존 SoT를 정확히 재인용했다. 위반 없음.

- **[INFO] 응답 포맷 규약 준수 (에러 봉투·목록 응답 shape)**
  - target 위치: `background-monitoring.e2e-spec.ts`(`res.body.error.code`), `session-revocation.e2e-spec.ts`(`res.body.data.items`/`nextCursor`), `background-runs.service.spec.ts`(`result.nodeExecutions.data`)
  - 확인 규약: `spec/5-system/2-api-convention.md §5.3`(에러 응답), `§8.2`(cursor pagination shape: `{data:{nodeExecutions:{data,nextCursor,hasMore}}}`)
  - 상세: 신규 테스트가 단언하는 응답 구조는 위 SoT 형태와 일치한다. 새 코드가 봉투 형식을 임의로 바꾸지 않았다.

## 요약

이번 diff(452줄, uuid 커서 검증 강화 + 회귀 e2e 2건)는 정식 규약 관점에서 **새로운 위반을 만들지 않았다**. 명명(`INVALID_CURSOR`는 UPPER_SNAKE_CASE 기존 코드 재사용, 신규 코드 미신설), 출력 포맷(에러 봉투·cursor pagination shape 모두 SoT와 일치), 리뷰 인용 형식(`review-citations.md §2` 전체 경로, 실재 확인), Rationale 인용 정확성(허구 근거 없음), 역할 경계(spec 카탈로그 갭은 developer가 직접 고치지 않고 in-progress plan에 "planner 항목"으로 정확히 위임) 모두 확인했다. 다만 이 diff가 건드리는 두 지점에는 **이미 다른 세션이 찾아 plan에 등재해 둔 pre-existing 규약 갭**이 남아 있다 — (1) Background Runs 에러 코드 4종의 `3-error-handling.md §1` 카탈로그 미등재, (2) `2-api-convention.md §8.2`의 cursor pagination 단일 계약 서술과 `login-history`의 실제(무시+1페이지) 계약 간 불일치. 둘 다 이번 diff가 새로 만든 것이 아니라 기존 계약을 그대로 강화하면서 노출을 더 굳혔을 뿐이며, planner 턴에서 처리하도록 정확히 추적되고 있어 severity를 WARNING으로 유지한다(재작업 불요, 이미 열린 항목 재확인 차원).

## 위험도

LOW
