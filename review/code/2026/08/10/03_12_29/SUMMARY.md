# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 이번 라운드(`03_12_29`)의 diff 계산이 직전 실질 코드 변경 커밋 2건(`bc10e215e`, `e64b1218b`)을 완전히 누락해 router 가 "소스 코드 0개"로 오판했고, 그 결과 requirement/documentation 외 12명 reviewer 는 해당 실질 로직 변경을 검토할 기회조차 갖지 못했다. 여기에 더해 이전 라운드(`02_47_31`)의 RESOLUTION.md 결손, `spec-links.ts` JSDoc 오귀속, review 산출물 2건의 죽은 상대링크가 확인됐다.

**forced 화이트리스트 이행 상태**: `documentation`, `requirement` 모두 강제 대상이었고 둘 다 결과를 정상 확보(success)했다 — 화이트리스트 미이행 항목 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 이번 라운드의 diff 범위가 직전 실질 프로덕션 코드 변경 2건(`bc10e215e` frontmatter 판정을 `plan-scan.ts` 로 추출 + negative-path fixture, `e64b1218b` `isIsoDate` 라운드트립 비교 통합)을 완전히 누락. 27개 배정 파일 중 `plan-scan.ts`/`plan-scan.test.ts`/`plan-frontmatter.test.ts` 는 0건이며, router 도 "소스 코드 파일 0개"로 판정해 documentation/requirement 외 12명(security/testing/scope 등)이 이 로직 변경을 검토하지 못함 | 세션 메타 `review/code/2026/08/10/03_12_29/meta.json`("files" 27건), `_prompts/_router.md` | `codebase/frontend/src/lib/docs/__tests__/{plan-scan.ts,plan-scan.test.ts,plan-frontmatter.test.ts}` 를 대상으로 한 별도 `/ai-review` 를 push 전에 수행. 다른 병행 라운드가 이미 커버했는지 먼저 확인 |
| 2 | requirement | `review/code/2026/08/10/02_47_31/RESOLUTION.md` 가 이 PR 의 code-review 8개 라운드 중 유일하게 없음. 해당 라운드 SUMMARY 의 WARNING 1건(frontmatter 4종 판정 positive-only)·SPEC-DRIFT 1건(`.claude/docs/plan-lifecycle.md:83` 소재 오지목)은 실제로 `bc10e215e` 에서 line-level 로 해소된 것을 직접 diff 로 확인했으나, 그 사실을 formal 하게 닫는 RESOLUTION.md 만 빠짐(7개 다른 라운드는 모두 별도 커밋으로 존재) | `review/code/2026/08/10/02_47_31/` (RESOLUTION.md 부재) | `RESOLUTION.md` 작성해 WARNING#1·SPEC-DRIFT#1 이 `bc10e215e`(+`e64b1218b`)로 해소됐음을 명문화. W2(prettier 포맷)는 "저장소에 prettier 설정·의존성 없어 미반영"으로 기각 근거 기록 |
| 3 | documentation | `spec-links.ts` 의 `findBrokenPlanLinks` 를 설명하는 대형 JSDoc 블록이 엉뚱한 선언(`export { collectLivePlanMarkdown };`)에 붙어 있음. IDE hover/TypeDoc 은 다음 선언에 JSDoc 을 귀속시키므로 `collectLivePlanMarkdown` 을 hover 하면 무관한 설명이 뜨고 `findBrokenPlanLinks` 는 문서 없는 것처럼 보임 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:269-304`(JSDoc 269-301) / 실제 대상은 306줄 | JSDoc 블록(269-301줄)을 `export function findBrokenPlanLinks`(현 306줄) 바로 위로 이동. `collectLivePlanMarkdown` 위 2줄 line-comment(302-303줄)는 그대로 남김 |
| 4 | documentation | `review/consistency/**` SUMMARY.md 2건의 `harness-review-gate-followups.md` 상대링크가 깨짐 — `../` 4개만 사용했으나 실제로는 6단계(`review/consistency/2026/08/10/<세션>/`) 필요. resolve 하면 `review/consistency/plan/in-progress/...` 로 존재하지 않는 경로가 됨. `spec-link-integrity.test.ts` 는 `review/**` 를 검증 대상으로 보지 않아 build 가 못 잡음 | `review/consistency/2026/08/10/02_18_34/SUMMARY.md:45`, `review/consistency/2026/08/10/02_33_44/SUMMARY.md:40` | `../../../../../../plan/in-progress/harness-review-gate-followups.md`(6단계)로 정정. SUMMARY 템플릿의 back-link 상대깊이 자동 계산 또는 커밋 전 육안 확인 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | 위 WARNING 2건을 제외하면 26개 review/consistency 산출물이 인용하는 사실 관계(줄번호·함수 시그니처·상수값·커밋 해시)는 전수 대조에서 전부 정확. `TERMINAL_PLAN_STATUSES` 4곳 일치, 도입 커밋 author date 정정 확인, 신규 plan 2건 frontmatter·본문 인용 일치. TODO/FIXME/HACK/XXX 마커 0건 | 해당 없음 | 조치 불요 |
| 2 | documentation | `harness-env-value-subpattern-dedup.md` 새 절 blockquote 한 줄이 `>` 뒤 공백 누락, 같은 문단 형제 줄과 형식 불일치(CommonMark 렌더링엔 영향 없음) | `plan/in-progress/harness-env-value-subpattern-dedup.md:64` | `> 두면` 으로 정정(사소, 게이트 비차단) |
| 3 | documentation | 본 라운드가 배정받은 prompt 에 실제 코드 diff 가 빠진 것은 이미 `plan/in-progress/harness-review-gate-followups.md` 에 등재된 알려진 결함. documentation reviewer 는 워킹트리 직접 조회로 대체 판정 수행. 배정된 26개 리뷰 산출물 자체는 문서화 관점에서 실질 결함 없음 | 해당 없음 | 조치 불요 (위 WARNING#1 의 후속 조치로 이미 커버) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | MEDIUM | diff 계산이 직전 2개 실질 코드 커밋을 누락(router 오판 유발) + `02_47_31` RESOLUTION.md 결손. spec fidelity 자체는 결함 없음 |
| documentation | LOW | `spec-links.ts` JSDoc 오귀속(WARNING) + review 산출물 2건 링크 깊이 오류(WARNING). 핵심 신규 코드(`plan-scan.ts` 등) 문서화 수준은 높고 SoT 4개 층 정합 확인 |

## 발견 없는 에이전트

없음(실행된 2개 에이전트 모두 발견사항 있음).

## 권장 조치사항
1. `codebase/frontend/src/lib/docs/__tests__/{plan-scan.ts,plan-scan.test.ts,plan-frontmatter.test.ts}` 를 대상으로 별도 `/ai-review` 를 push 전에 수행 — 이번 라운드가 놓친 실질 로직 변경(frontmatter 판정 추출, `isIsoDate` 통합)에 대한 검증 공백을 메운다.
2. `review/code/2026/08/10/02_47_31/RESOLUTION.md` 작성 — 해당 라운드 WARNING/SPEC-DRIFT 가 `bc10e215e`/`e64b1218b` 로 해소됐음을 명문화하고 push-gate freshness 계약 완결.
3. `spec-links.ts` JSDoc 블록을 올바른 대상(`findBrokenPlanLinks`) 위로 이동.
4. `review/consistency/2026/08/10/{02_18_34,02_33_44}/SUMMARY.md` 의 `harness-review-gate-followups.md` 상대링크 깊이 정정.
5. (선택) `harness-env-value-subpattern-dedup.md:64` blockquote 공백 정정.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `requirement`, `documentation` (2명)
  - **제외**: 아래 표 (12명)
  - **강제 포함(router_safety)**: `documentation`, `requirement` — 둘 다 결과 정상 확보(success), 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | security | router: 배정 파일 27건이 review/consistency 산출물·spec 문서로 판정되어 보안 관점 해당 없음 |
  | performance | router: 소스 코드 변경 없음으로 판정(실제로는 직전 커밋 2건 누락 — 위 WARNING#1 참조) |
  | architecture | 상동 |
  | scope | 상동 |
  | side_effect | 상동 |
  | maintainability | 상동 |
  | testing | 상동 — 실제로는 `plan-scan.test.ts` negative-path fixture 추가가 있었음(누락 diff 범위 밖) |
  | dependency | 상동 |
  | database | 상동 |
  | concurrency | 상동 |
  | api_contract | 상동 |
  | user_guide_sync | 상동 |