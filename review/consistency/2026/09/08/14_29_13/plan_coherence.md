# Plan 정합성 검토 — spec/5-system (impl-done, diff-base origin/main)

## 조사 방법

- `spec/5-system/**` 델타는 실측대로 0파일(정상 — 이 브랜치는 spec 을 바꾸지 않았다). 프롬프트가
  budget 컷으로 `<git diff … -- code_areas>` 를 통째로 생략했으므로, 실제 구현 diff(20파일/1246줄)는
  워킹트리에서 `git diff origin/main...HEAD --stat`/`-- <path>` 로 직접 재확인했다.
- `plan/in-progress/**` 도 대부분 budget 컷됐다. 실제로 이번 diff 에 포함된 두 plan 파일
  (`spec-draft-nullable-notation-followups.md`, `auth-guard-reflection-hardening.md`)과 이번 작업의
  자체 트래커(`spec-followups-batch-b.md`)는 워킹트리에서 전문·diff 를 직접 읽었다.
- 코드 diff 중 `spec/5-system/*` 의 `code:` frontmatter 와 실제로 겹치는 파일만 골라 spec 본문과
  대조했다: `http-exception.filter.ts`(→`3-error-handling.md`), `repo-guards/__tests__/
  user-entity-exposure-guard.ts`·`.spec.ts`(→`2-api-convention.md` §5.4 검증 층 표),
  `endpoint-path-conflict-wrap*`(→`3-error-handling.md §1.10`/`2-trigger-list.md §3`).
  나머지 diff 파일(workspaces/integration-oauth/workflow-versions/frontend workflows.ts 등)은
  5-system 의 `code:` glob 밖이라 이 target 의 정합성 판단 범위 밖이다.

## 발견사항

없음 — CRITICAL/WARNING 급 불일치를 찾지 못했다.

### 확인한 정합 근거 (참고용, 비발견사항)

- **B-3 (전역 필터 → `isPostgresUniqueViolation`)**: `spec/5-system/2-api-convention.md §5.3`
  이미 "409 기본값 = `RESOURCE_CONFLICT`" 를 문서화하고 있고, 이번 변경은 raw pg 23505 표면이
  그 기본값을 못 받던 구현 결함을 SoT(`pg-error.ts`)에 맞춘 것이다. spec 이 이미 선언한 것과
  구현을 일치시키는 방향이라 spec 과 충돌하지 않는다.
- **B-4 (`listMembers` → `select` 투영)**: `2-api-convention.md §5.4` 검증 층 표가 소유한
  `user-entity-exposure-guard.ts` 화이트리스트에서 해당 항목이 빠지는 것이 완료의 기계적 증거로
  설계돼 있고, diff 가 정확히 그 형태(화이트리스트 항목 삭제 + 표 주석 정정)를 따른다.
- **B-6/B-7 (`endpointPath` save 래핑 · 409 e2e)**: `3-error-handling.md §1.10`
  (`TRIGGER_ENDPOINT_PATH_CONFLICT`, `RESOURCE_CONFLICT`/409)이 이미 계약 SoT로 존재하며, 이번
  변경은 그 계약의 구현측 커버리지(래칭·e2e)를 넓히는 것이지 새 결정이 아니다.
- **사전 조건(pg-error SoT·user-entity-exposure-guard 존재)은 모두 이미 `origin/main` 에 병합돼
  있다**(`#1288`~`#1292`) — 이번 배치가 의존하는 선행 작업 중 plan 상 미해소인 것은 없다.
- **후속 항목 처리**: 이번 세션은 스스로 발견한 파생 이슈를 developer 권한(`spec/` 쓰기 불가)
  경계에 맞춰 정확히 갈랐다 — `spec-draft-nullable-notation-followups.md` 에 planner 전용 신규
  항목 3건(1-data-model.md Rationale 4번째 행 등재 · `swagger.md §1-3→§1-4` 인용 정정 ·
  `requestId` UUID 예시 정정)을 등재하고, developer 판단 항목(`User` 투영 공용 상수 승격 여부)은
  재개 신호(같은 값 자리 3번째 등장)와 함께 defer 로 명시했다. 세 planner 항목 모두 번들 본문과
  대조해 실제로 아직 미수정 상태임을 확인했다(예: §5.4 의 "Swagger 규약 §1-3" 인용은 여전히
  §1-3 을 가리키고, §1-4 로 정정돼 있지 않다 — 등재가 유효한 근거를 갖는다).
- **선행 plan 과의 상호참조 정합화**: `auth-guard-reflection-hardening.md` 에 있던 `__test-utils__`
  exclude 항목(다른 트리거 조건 — devDependency import)이, 배치 B-2 가 다른 사유(죽은 코드가
  dist 유입)로 같은 `tsconfig.build.json` exclude 를 먼저 넣자 스스로 "트리거 미충족·처방
  선행" 으로 종결 처리했다. 이는 `review/consistency/2026/09/08/13_34_30` WARNING#1(두 plan 이
  상호 참조 없이 같은 대상에 다른 결론을 들고 있다는 지적)을 정확히 해소한 것이다.
- **`spec_impact: none` 신뢰성**: 이번 트래커 머리말이 스스로 "처음에 잘못 적었다가 정정했다"고
  기록하고 있고(`review/consistency/2026/09/08/13_22_38` 지적 반영), 실측(`git diff origin/main...HEAD
  -- spec/` = 0파일)과 일치한다.

## 요약

target(`spec/5-system/`) 자체는 이번 브랜치에서 변경되지 않았고(확인: 0파일 델타), 이번 구현
diff 중 5-system 의 `code:` glob 에 걸리는 자리(전역 예외 필터의 pg-error SoT 전환, `listMembers`
투영에 따른 `user-entity-exposure-guard` 화이트리스트 갱신, 트리거 `endpointPath` 충돌 래핑·e2e)는
모두 이미 문서화된 spec 결정(§5.3 기본 409 매핑, §5.4 검증 층 설계, §1.10 트리거 충돌 코드)을
구현 쪽에서 뒤늦게 맞추는 방향이라 spec 이 "결정 필요"로 남긴 항목과 충돌하지 않는다. 이 배치가
스스로 만든 파생 이슈(User 투영 공용화 여부·데이터모델 Rationale 갱신·두 문서 인용 오류)는
developer/planner 쓰기 경계에 맞춰 정확히 분리 등재됐고, 사전에 존재하던 다른 plan
(`auth-guard-reflection-hardening.md`)과의 상호참조 충돌도 이번 라운드에 스스로 해소했다.
plan 정합성 관점에서 추가로 갱신이 필요한 자리를 찾지 못했다.

## 위험도

NONE
