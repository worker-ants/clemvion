# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 완주, Critical 발견 0건.

## 전체 위험도
**LOW** — cross-spec·rationale·plan 계보·신규 식별자 충돌은 전부 NONE, `convention_compliance` 만 문서 구조 컨벤션 WARNING 1건(4개 spec 파일의 `## Overview` 헤딩 누락, 오래된 편차)으로 전체 위험도를 LOW로 끌어올림.

## 검토 전제 (모든 checker 공통 확인)

이번 `--impl-prep` 호출의 target(`spec/5-system`)은 신규/수정 draft가 아니라 기존 SoT 전체이며, 연결된 실제 작업은 `plan/in-progress/race-helper-guard-tests.md`(`spec_impact: none`)다. `git diff origin/main --stat` 로 `spec/**`·`codebase/**` 변경이 0줄임을 5개 checker가 각자 재확인했다. 실제 변경 범위는 `codebase/backend/src/shared/testing/overlap-preconditions.ts`(신규 순수 함수 2개 + self-spec) 신설, `test/helpers/concurrency.ts` 호출 배선, `PROJECT.md:331` 예외 문구 한 줄뿐이다. 직전 라운드(`22_25_20`)에서 `plan_coherence`가 Critical로 BLOCK했던 선례 부재 오판은 이번 재실행에서 계보 실측(선례 5쌍 파일 존재·트래커 항목·`PROJECT.md` 문면 전부 확인)으로 해소되었다.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `## Overview` 문서 구조 헤딩 컨벤션 미준수 (2026-05 이래 존재하던 오래된 편차, 이번 diff 유발 아님) | `spec/5-system/5-expression-language.md`(L12-18)·`7-llm-client.md`(L20-26)·`11-mcp-client.md`(L13-19)·`16-system-status-api.md`(L8-14) | `.claude/skills/project-planner/SKILL.md` §문서 구조 + CLAUDE.md "Spec 문서 3섹션 구성" | 4개 파일 첫 섹션 헤딩을 `## Overview`(또는 `## Overview (제품 정의)`)로 통일, 또는 레거시 예외를 SKILL.md에 명시. `developer`는 `spec/` write 권한 없어 `project-planner` 턴 필요 (단, 이번 작업과 무관한 standing 편차이므로 이번 plan 을 막을 사유는 아님) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 컨텍스트 예산 절단으로 `spec/5-system` 15개 파일 + `spec/1-data-model.md` 등 커버리지 미확인 (반복 이슈) | `_prompts` 번들 메타 | 실질 위험 낮음(test-harness 전용 작업). 대형 파일 대상 향후 호출은 청크 분할 재실행 권고 |
| 2 | cross_spec | 신설 `overlap-preconditions.ts`가 어느 spec 문서의 `code:` frontmatter glob 에도 미등재 (카테고리 부재, 모순 아님) | `spec/5-system/2-api-convention.md` frontmatter `code:`(L4-19) | 강제 아님. 필요 시 `PROJECT.md` §B-2에 "테스트 오케스트레이션 순수 전제 검증 — 도메인 spec 무관" 메모로 향후 spec-coverage audit 오탐 예방 |
| 3 | convention_compliance | `spec/conventions/migrations.md` §7 Rationale 절 헤딩이 `## Rationale` 리터럴이 아니라 `## 7. 폐기 대안 (Rationale)`로 다른 conventions 문서와 형식 상이 | `spec/conventions/migrations.md` §7 | 우선순위 낮음(스타일). 다음 편집 시 `## Rationale`로 통일 |
| 4 | convention_compliance | 프롬프트 번들 절단으로 14개 파일 저장소 직접 열람 표본 검토만 수행(전수 정밀 검토 아님) | `spec/5-system/{4,6,7,8,9,10,11,12,13,14,15,17}-*.md` 등 | 후속 `naming_collision`/`cross_spec` 호출이 같은 14개 파일 재검토 시 참고 |
| 5 | naming_collision | 신규 파일 경로 2개(`overlap-preconditions.ts`/`.spec.ts`) + 함수명 2개(`assertEnoughFiresForOverlap`, `assertGuardBelowKnownTimeouts`) 저장소 전체 grep 0건, 충돌 없음, 기존 `assert*` 명명 패턴과 정합 | `codebase/backend/src/shared/testing/` | 조치 불요 — 현행 유지 |
| 6 | naming_collision / plan_coherence | `KNOWN_LOCK_TIMEOUTS_MS`는 이관 대상이 아니라 호출부만 추가되는 기존 상수, `PROJECT.md:331` 추가 문장도 새 식별자 아님 | `codebase/backend/test/helpers/concurrency.ts:12` / `PROJECT.md:331` | 조치 불요 |
| 7 | plan_coherence | 선행 계보(트래커 항목·`PROJECT.md` 문면·선례 5쌍·완료 plan 인수인계·"동시 삭제 감사 중복" 9자리 전량 종결) 전부 실측 일치 확인 | `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/complete/e2e-race-helper.md` 등 | 조치 불요 — 이번 plan 은 이 계보와 독립적인 잔여 항목 하나만 다룸 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | 직전 라운드와 spec/codebase 변경 0줄(바이트 동일), 에러 코드 카탈로그 교차 참조 재확인, cross-spec 모순 없음 |
| rationale_continuity | NONE | `spec/5-system` 무변경 확인(vacuous), 번들 3개 파일 동시성 Rationale과 이번 작업 범위(테스트 헬퍼 배치) 겹침 없음 |
| convention_compliance | LOW | 4개 spec 파일 `## Overview` 헤딩 누락(WARNING, 오래된 편차·비유발), 그 외 redis 키·감사 액션·API 명명·`pending_plans` 표본 검사 위반 0건 |
| plan_coherence | NONE | 직전 Critical(선례 부재 오판)을 계보 실측으로 해소, 선행 plan/트래커 상태 전부 일치, 후속 항목 무효화 없음 |
| naming_collision | NONE | 신규 파일 경로 2개·함수명 2개 전량 grep 0건, 기존 명명 컨벤션과 정합, 충돌 없음 |

## 권장 조치사항

1. (BLOCK 없음 — 즉시 조치 불요) `race-helper-guard-tests` plan 은 진행 가능.
2. (낮은 우선순위, 이번 작업과 무관) `spec/5-system/5-expression-language.md`·`7-llm-client.md`·`11-mcp-client.md`·`16-system-status-api.md`의 `## Overview` 헤딩 통일 또는 SKILL.md 레거시 예외 명시 — `project-planner` 턴에서 별도로 처리.
3. (선택) `spec/conventions/migrations.md` §7 헤딩을 `## Rationale`로 통일 — 다음 편집 시.
4. (선택) `PROJECT.md` §B-2 예외 목록에 "spec `code:` 미등재 — 테스트 오케스트레이션 순수 전제 검증" 메모 추가해 향후 spec-coverage audit 오탐 예방.
