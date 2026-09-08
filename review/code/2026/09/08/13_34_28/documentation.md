# 문서화(Documentation) 코드 리뷰

## 검증 방법

정적 리딩 외에, 저장소에 인용된 모든 상호 참조를 직접 열어 대조했다(저장소 뮤테이션 없음):

- `CHANGELOG.md` 신규 두 항목(raw 23505 필터·`listMembers` 투영) vs 실제 코드(`http-exception.filter.ts`, `workspaces.service.ts`) — 표·수치·인용 전부 일치.
- `PROJECT.md` 의 새 ratchet 안내 문단 vs `.claude/test-stages.sh` 의 `_cmd_typecheck_ratchets()`/`cmd_build()` 실제 배선 — 함수명·위치·exclude 목록 4항목 전부 일치.
- 크로스 파일 상대경로 링크 3건을 실제로 `ls` 로 resolve — `workspaces.service.ts:219` → `spec/1-data-model.md`, `workflow-versions.service.ts:52` → `frontend/src/lib/api/workflows.ts`, 역방향 링크 모두 유효.
- `CHANGELOG.md` 가 인용하는 `spec/1-data-model.md ## Rationale` 표 내용을 직접 열어 "컬럼 `select: false` 기각" 서술이 실제로 존재하고 이번 PR 의 "쿼리 레벨 투영"과 다른 것임을 확인.
- `webhook-trigger.e2e-spec.ts` B4 의 단언(`RESOURCE_CONFLICT`/`details.field='endpoint_path'`/`details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'`)을 `spec/5-system/3-error-handling.md §1.10` 표와 대조 — 정확히 일치.
- `pg-error.ts` 의 `pgErrorConstraint`/`isPostgresUniqueViolation` 실제 구현을 CHANGELOG·주석의 서술과 대조 — 일치.
- 이전 라운드(`review/code/2026/09/08/12_53_08`) 문서화 리뷰가 지적한 WARNING(CHANGELOG 미갱신)이 실제로 반영됐는지 diff 로 확인 — 반영됨.

## 발견사항

- **[INFO]** 신설 JSDoc 블록이 기존 JSDoc 블록을 원래 대상(아래 `it` 블록)에서 분리시켰다 — 두 주석이 나란히 붙어 어느 것이 무엇을 설명하는지 헷갈린다
  - 위치: `codebase/backend/src/repo-guards/__tests__/production-build-devdep.spec.ts` — `describe('프로덕션 빌드 devDependency 누출', …)` 블록 안, `const buildFiles = resolveBuildFileNames(backendDir);` 선언 바로 위 (신설 `it.each` 파라미터화 diff 의 `+  const buildFiles = …` 삽입 지점)
  - 상세: 이 diff 이전에는 `/** **먼저 vacuous 방지.** … 아래 두 단언은 무엇도 검사하지 않고 통과한다 … */` 주석이 바로 아래 `it('[캐너리] 빌드 대상 파일 목록이 비어 있지 않다', …)` 블록 바로 위에 붙어 있어 그 test 를 설명했다. 이번 diff 가 그 주석과 `it(...)` 사이에 새 JSDoc(`/** 빌드 대상 목록은 **한 번만 해석한다.** … */`) + `const buildFiles = resolveBuildFileNames(backendDir);` 선언을 끼워 넣으면서, 원래 주석이 이제 `const buildFiles` 선언 바로 위(그리고 새 JSDoc 바로 위)에 놓이게 됐다. 두 JSDoc 블록이 연달아 나오고 그 아래 `const` 선언, 그리고 두 줄 띄운 뒤에야 원래 그 주석이 설명하던 `it(...)` 가 나온다 — 처음 읽는 사람은 "먼저 vacuous 방지" 주석이 `buildFiles` 상수를 설명한다고 오독하기 쉽다. 실질 피해는 낮다(주석 안의 "아래 두 단언" 표현이 여전히 문맥상 유추 가능하고, 테스트 자체는 정상 동작·정상 커버리지) — 순수 가독성/주석-코드 인접성 문제다.
  - 제안: 새 JSDoc + `const buildFiles` 선언을 `describe` 최상단(`const backendDir = …` 바로 다음)으로 옮기고, 기존 "먼저 vacuous 방지" 주석은 그 아래 `it('[캐너리] …')` 블록 바로 위에 다시 붙인다. 두 주석의 관심사(캐싱 이유 vs vacuous 방지 이유)가 다르므로 물리적으로도 분리하는 편이 더 명확하다.

- **[INFO]** (확인, 조치 불요) 이전 라운드 문서화 리뷰의 유일한 WARNING(`CHANGELOG.md` 미갱신)이 이번 diff 에서 정확히 해소됐다
  - 위치: `CHANGELOG.md` 최상단 신규 `## Unreleased — 가장 넓은 fallback…` 섹션
  - 상세: `review/code/2026/09/08/12_53_08/documentation.md` W1(CHANGELOG 미갱신)과 `review/code/2026/09/08/12_53_08/RESOLUTION.md` 가 약속한 대로, raw-표면 23505 필터 수정(B-3)과 `listMembers` 검출→강제 전환(B-4) 두 항목이 정확히 그 성격(SoT 통합 버그 수정 / User 노출 방어 강화)에 맞는 분량과 형식(표·blast-radius 실측·뮤테이션 결과)으로 CHANGELOG 에 실렸다. 나머지 B-1·B-2·B-5~B-8(harness·순수 리팩터·테스트 추가·타입 개명)이 CHANGELOG 에서 빠진 것도 이 저장소의 확립된 관례(개발 노트가 아니라 보안/동작 공지)와 일치한다.

- **[INFO]** (확인, 조치 불요) `plan/in-progress/spec-followups-batch-b.md` 의 `spec_impact` 오기를 잡은 후속 커밋(`05b899d1f`)이 정정 근거(실측 diff 0파일)를 정확히 남기고, 자매 트래커(`spec-draft-nullable-notation-followups.md`)의 8개 체크박스가 전부 완료 근거(RED→GREEN, 뮤테이션 결과, 실행 로그)와 함께 플립됐다
  - 위치: `plan/in-progress/spec-followups-batch-b.md` frontmatter `spec_impact: none` + 본문 인용문, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 B-1~B-7 대응 8개 항목
  - 상세: 이 저장소가 요구하는 "plan 체크박스 = 실제 상태" · "spec_impact 는 검증 가능한 주장" 규율을 그대로 지켰다. 특히 B-6 완료 노트는 최초 처방(술어)이 vacuous 였다는 자기반증과 두 번의 자기 결함(변수명 오판·fail-open 판정)을 숨기지 않고 기록해, 다음 사람이 같은 함정에 빠지지 않도록 돕는다.

## 요약

이번 diff(배치 B 6건 + 후속 fix 2건, 총 8개 커밋 범위)는 이 저장소의 매우 높은 문서화 밀도 관례를 그대로 유지하며, 실제로 존재하는 문제만 골라도 딱 하나 — `production-build-devdep.spec.ts` 에서 새 JSDoc/선언을 끼워 넣으며 기존 JSDoc 을 원래 대상에서 분리시킨 것 — 뿐이다(INFO, 낮은 실질 영향). 그 외 CHANGELOG.md·PROJECT.md·`.claude/test-stages.sh`·JSDoc·spec 상호 참조를 전수 대조한 결과 모두 정확했고, 직전 라운드(`12_53_08`)가 지적한 CHANGELOG 미갱신 WARNING 도 정확히 해소됐다. `WorkflowVersionDetailProjection` 개명·`listMembers` DB 투영·`pg-error.ts` SoT 통합 등 모든 실질 변경에 "왜"를 설명하는 JSDoc/인라인 주석과 plan 완료 근거가 동반되었고, README·API 문서·환경변수 문서 갱신이 필요한 신규 공개 표면 변경은 없었다. CRITICAL/WARNING 급 문서화 결함 없음.

## 위험도

LOW
