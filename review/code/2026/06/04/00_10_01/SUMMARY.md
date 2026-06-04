# Code Review 통합 보고서

## 전체 위험도
**LOW** — 대부분 spec 내부 링크·앵커 정합 수정 및 gate 테스트 추가로 구성. 기능·로직 변경 없음. 신규 gate 테스트의 vacuous pass 가능성이 일부 존재하나 서비스 동작에 영향 없음.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `spec-plan-completion.test.ts` — `GATE_C_CUTOFF` 날짜 하드코딩(2026-06-04)으로 사실상 모든 기존 plan 이 grandfathered. `enforced` 배열이 비어있을 가능성이 높아 gate 가 vacuous pass 상태일 수 있음 | `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` 24행 | `enforced.length > 0` assertion 추가 또는 cutoff 이후 started plan 픽스처 테스트 추가 |
| 2 | Testing | `spec-link-integrity.test.ts` — `findBrokenLinks` 가 내부에서 예외를 무시하고 0을 반환할 경우 silent vacuous pass 가능. CI 환경에서 `spec/` 미 checkout 시 violations 0으로 리턴 위험 | `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` 43-46행 | `spec-links.ts` 의 `findBrokenLinks` 에 결과 0개 수신 시 throw/경고 guard 추가 |
| 3 | Testing | `spec-area-index.test.ts` — `collectAreas()` 가 빈 배열을 반환하면 동적 describe 블록 미생성, vacuous pass 가능. `areas.length > 5` 하한만으로는 area 내용 검증 부재 | `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` 69행 | `spec/5-system` area 의 siblings 수 추가 assert (예: 10개 이상) |
| 4 | Testing | `plan-frontmatter.test.ts` — `plans.length > 20` sanity guard 가 충분히 보수적이지 않음. `repoRoot()` 오해석 시 탐지 실패 가능 | `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 45행 | 알려진 특정 plan 파일 존재 assertion 추가 (예: `plan/in-progress/knowledge-base-quality-improvements.md`) |
| 5 | Testing | `spec-links.ts` — catalog 파일 면제 정규식(`^spec\/conventions\/[^/]+-api-catalog\/[^/]+\/.+\.md$`)에 대한 단위 테스트 없음. depth 오산 시 silent 오동작 가능 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 및 `spec-frontmatter-parse.ts` | catalog 면제 패턴 단위 테스트 케이스 추가 |
| 6 | Documentation | `spec/2-navigation/2-trigger-list.md` — `#7-시크릿-회전--token-revoke` → `#7-데이터-모델` 앵커 변경으로 링크 텍스트("SoT 는 [Spec EIA §7]")와 실제 섹션 heading 의 의미 불일치 발생 가능 | `spec/2-navigation/2-trigger-list.md` 줄 478, 479, 497 | `spec/5-system/14-external-interaction-api.md` §7 실제 heading 확인 후 링크 텍스트를 섹션 제목과 정합되도록 갱신 |
| 7 | Documentation | `spec/conventions/node-cancellation.md` — 기존 잘못된 상대 경로 패턴 잔존 (`../../spec/5-system/` → 올바른 경로는 `../5-system/`) | `spec/conventions/node-cancellation.md` 줄 1632 | `../../spec/5-system/` → `../5-system/` 경로 수정 (이번 변경 범위 외, 별도 작업 권장) |
| 8 | Requirement | `spec/5-system/15-chat-channel.md` — `3.1` heading 이 두 개 존재 (`#### 3.1 어댑터 라이프사이클` 줄 49, `### 3.1 전체 시퀀스` 줄 118). 앵커 혼동 잠재 위험 | `spec/5-system/15-chat-channel.md` | 향후 project-planner 가 heading 번호 정리 검토. 현재 수정 기능적으로는 정확 |
| 9 | Requirement | `spec/conventions/spec-impl-evidence.md` §4 제목 "Build-time 가드 (5건)"과 Gate D(advisory, build 차단 아님) 포함 여부 불명확 — 제목 카운트와 본문 설명이 잠재적으로 불일치 | `spec/conventions/spec-impl-evidence.md` §4 | project-planner 가 Gate D 를 별도 advisory 섹션으로 분리하거나 제목 주석 명확화 검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | 앵커 수정 30여 건 전수 검증 완료 — `#1-condition-구조`, `#44-사용자-입력-대기-이벤트-상세`, `#7-integration-노드-4종`, `#9-presentation-노드-5종`, `#3-인가-authorization`, `#62-저장-전략`, `#5-출력-구조`, `#31-어댑터-라이프사이클`, `#42-trigger-테이블-신규-컬럼` 등 모두 실제 heading 과 정확히 일치 | spec/ 전체 | 없음 |
| 2 | Requirement | 상대 경로 오류 수정 정확 — `../../1-data-model.md` → `../1-data-model.md`, `../4-execution-engine.md` → `4-execution-engine.md` | `spec/2-navigation/6-config.md`, `spec/5-system/15-chat-channel.md` | 없음 |
| 3 | Testing | `spec-link-integrity.test.ts` `slugify` pin 케이스(`"## 1. Condition 구조" → "1-condition-구조"`)가 이번 앵커 수정과 직결된 효과적인 회귀 가드 | `spec-link-integrity.test.ts` 55-73행 | 없음 (긍정적 평가) |
| 4 | Testing | `spec-area-index.test.ts` — `spec/conventions/` 면제가 코드 주석으로만 설명됨. 향후 해당 폴더에 index 파일 추가 시 silent 건너뜀 발생 가능 | `spec-area-index.test.ts` 46행 | 면제 로직 검증 테스트 추가 권장 |
| 5 | Documentation | `spec/5-system/_product-overview.md` 시스템 영역 spec 맵 16개 신설 — 기존 3개 링크 포함, 정보 손실 없음 | `spec/5-system/_product-overview.md` | 없음 |
| 6 | Documentation | `spec/7-channel-web-chat/_product-overview.md` 구성요소 spec 4개 링크 추가 — 영역 index 완전성 향상 | `spec/7-channel-web-chat/_product-overview.md` | 없음 |
| 7 | Documentation | `spec/conventions/spec-impl-evidence.md` Gate C 추가·가드 수 4→5 갱신·Gate D advisory 소절 신설 — 실제 게이트 구성 정확 반영 | `spec/conventions/spec-impl-evidence.md` | 없음 |
| 8 | User Guide | 매트릭스 19개 trigger 중 `spec-major-change` 1개 glob 매칭. 그러나 diff 전수 검토 결과 동반 갱신 의무 발생 0건 | `.claude/config/doc-sync-matrix.json` | 없음 |
| 9 | Requirement | `spec/conventions/spec-impl-evidence.md` `code:` frontmatter 에 `spec-plan-completion.test.ts` 경로 추가 — self-consistent 갱신, plan item 7 의도 충족 | `spec/conventions/spec-impl-evidence.md` frontmatter | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | 앵커 수정 30여 건 전수 정확 확인. plan item 1·6·7 모두 충족. 기능·로직 변경 없음 |
| testing | MEDIUM | Gate C cutoff 하드코딩으로 vacuous pass 가능. 4개 gate 테스트 모두 repoRoot FS 완전 의존, silent pass 방어 보강 필요 |
| documentation | LOW | trigger-list.md 앵커 의미 불일치, node-cancellation.md 기존 경로 오류 잔존. 대부분 양호 |
| user_guide_sync | NONE | 동반 갱신 의무 0건. 매트릭스 trigger 매칭 후 semantic 분석으로 누락 없음 확인 |

## 발견 없는 에이전트

- **user_guide_sync** — 동반 갱신 누락 발견 없음
- **requirement** — Critical/기능 이슈 없음

## 권장 조치사항

1. **[우선순위 1] `spec-plan-completion.test.ts` `enforced` 배열 vacuous pass 해소** — `enforced.length > 0` assertion 추가 또는 cutoff 이후 시작된 픽스처 plan 으로 enforce 동작 검증 테스트 추가. 현재 gate 가 사실상 미동작 상태.
2. **[우선순위 2] `spec-links.ts` `findBrokenLinks` silent 0-return guard** — `collectSpecMarkdown` 결과 0개 수신 시 throw 또는 명시적 경고 추가. CI 환경에서 spec 미 checkout 시 false-green 방지.
3. **[우선순위 3] catalog 면제 정규식 단위 테스트 추가** — `spec-link-integrity.test.ts` 또는 `spec-frontmatter.test.ts` 에 면제 패턴 케이스 추가.
4. **[우선순위 4] `spec/2-navigation/2-trigger-list.md` 링크 텍스트 정합 확인** — `#7-데이터-모델` 앵커 변경 이후 링크 텍스트가 섹션 실제 heading 과 일치하는지 검토·수정.
5. **[우선순위 5] `spec/conventions/node-cancellation.md` 경로 수정** — `../../spec/5-system/` → `../5-system/` (기존 문제, 향후 링크 정합 작업 시 함께 처리 권장).
6. **[우선순위 6] `spec-area-index.test.ts`·`plan-frontmatter.test.ts` sanity guard 강화** — 대표 area sibling 수 assert 및 알려진 plan 파일 존재 assertion 추가.
7. **[정보] `spec/conventions/spec-impl-evidence.md` §4 제목 명확화** — Gate D advisory 포함 여부를 제목 주석 또는 별도 소절로 명확화 (project-planner 판단).

## 라우터 결정

라우터가 선별 실행 (routing_status=done).

**실행** (4명): `requirement`, `testing`, `documentation`, `user_guide_sync`

**강제 포함 (router_safety)**: `documentation`, `requirement`

**제외** (10명):

| 제외된 reviewer | 이유 |
|------------------|------|
| security | spec 내부 링크/앵커 수정 및 gate 테스트 추가 — 보안 취약점 변경 범위 없음 |
| performance | 기능/로직 변경 없음 — 성능 영향 해당 없음 |
| architecture | 아키텍처 구조 변경 없음 |
| scope | 명세 범위 내 수정 작업 |
| side_effect | 부수효과 유발 코드 변경 없음 |
| maintainability | 유지보수성 영향 최소 — gate 테스트 추가는 오히려 긍정적 |
| dependency | 외부 의존성 변경 없음 |
| database | DB 스키마/쿼리 변경 없음 |
| concurrency | 동시성 관련 변경 없음 |
| api_contract | API 계약 변경 없음 |