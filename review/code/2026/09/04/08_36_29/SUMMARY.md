# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건 모두 `plan/in-progress/entity-nullable-column-type-mismatch.md` 문서 정확성/완결성 보강 항목(코드 결함 아님)이며 코드 자체(신규 대조군 테스트 2건)는 회귀 없이 31/31 GREEN. forced whitelist(7명) 전원 결과 확보 완료 — 누락된 forced reviewer 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | plan 문서의 뮤테이션 정확성 주장이 재현 결과와 다르다 — "`WIDENED_DECL`에서 관계 데코레이터만 빼면 2건 RED(관계 대조군만)"라고 적었으나, 독립 재현 결과 실제로 실패하는 것은 신규 대조군 2건이 아니라 기존(이 PR 이전부터 있던) 테스트 2건(`관계(@ManyToOne+@JoinColumn)도 포함`, `관계 필드를 겨눈 캐스트도 잡는다`)이다. 신규 대조군은 이 뮤테이션에서 그대로 GREEN(공허하게 참 — 판정 대상 필드 자체가 widened 집합에 안 들어감). 뮤테이션 1(충돌 배제 제거→3건 RED)로는 신규 대조군 2건 모두 이미 검증됐으므로 코드 결함은 아니다. | `plan/in-progress/entity-nullable-column-type-mismatch.md:241-242` | 해당 두 줄의 "관계 대조군만" 문구를 정정하거나(예: "이는 신규 대조군이 아니라 기존 `parent` 관련 테스트다"), 뮤테이션 1 결과만 남기고 뮤테이션 2 서술은 삭제 |
| 2 | documentation | 이번 리뷰 라운드(08_18_51)에서 의도적으로 유예된 후속 항목(`@OneToOne` 관계끼리의 동명 충돌 캐너리 — 저장소 실사례 0건이라 보류)이 `plan/` 이 아니라 `review/`(RESOLUTION.md·SUMMARY.md 등) 안에만 기록돼 있다. 저장소 자신의 관례("`review/`는 SoT 아님, 미룬 항목은 그 턴에 `plan/`에 적는다")와 어긋나며, 이 plan 파일이 `complete/`로 이동하면 유예 근거의 유일한 기록이 사라질 위험이 있다(`grep -rn OneToOne plan/ spec/` = 0건). | `plan/in-progress/entity-nullable-column-type-mismatch.md:233-245` (대조: `review/code/2026/09/04/08_18_51/RESOLUTION.md:50-51`) | plan.md 해당 완료 항목 끝에 한 줄 추가: "유예: `@OneToOne` 관계끼리의 동명 충돌은 저장소에 실사례가 0건이라 캐너리를 만들지 않았다. 생기면 이 절에 `it.each`로 추가한다." (코드 변경 불요) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement/scope/side_effect/maintainability/testing/documentation (교차 확인) | 직전 라운드(1R) INFO#2 — 두 번째 신규 대조군이 `findStaleSpecCasts` 검증을 생략했던 비대칭 — 이번 diff(커밋 `6dada6b16`)에서 정확히 그 자리만 고쳐 반영됨을 6개 reviewer가 각각 독립 소스 대조로 확인 | `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:434-441` | 조치 완료 — 추가 조치 불요 |
| 2 | testing/documentation | `@OneToOne` 관계끼리의 충돌은 여전히 fixture로 검증되지 않는다(신규 대조군 2건 모두 `@ManyToOne`만 사용, docstring만 `@OneToOne` 언급). 저장소 실사례 0건 근거로 3라운드째 유예 확정된 사안이며 이번 재확인에도 전제 유효 — 코드 결함 아님(위 WARNING#2와 연동) | `spec.ts:372-386`(docstring), `:387`,`:417`(fixture, `@ManyToOne`만) | 실사례 생기면 `it.each`로 추가 — 근거를 `plan.md`에 옮기면(WARNING#2 조치) 완결 |
| 3 | requirement/documentation | 저장소 실재 관계 필드 동명 충돌 3건(`integration_oauth_state.integration`↔`integration_usage_log.integration`, `execution.trigger`↔`schedule.trigger`, `login_history.user`↔`audit_log.user`) 및 `workflow` 필드 6개 엔티티 전부 non-null이라는 docstring 주장을 각 reviewer가 소스 직접 대조로 전건 확인 — 정확함 | `spec.ts:379-381`, `plan.md:244-245` | 조치 불요 — 정확성 확인 기록 |
| 4 | scope/side_effect | 이번 diff 13개 파일 중 11개는 실질 변경이 아니라 직전 리뷰 라운드(08_18_51)의 산출물(SUMMARY/RESOLUTION/`_retry_state.json`/`meta.json`/7개 reviewer 보고서) — 프로젝트 관례(구현 후 `/ai-review` 산출물을 `review/code/**`에 커밋)에 따른 의도된 보존, 스코프 이탈 아님 | `review/code/2026/09/04/08_18_51/*` | 조치 불요 |
| 5 | side_effect/documentation | 이전 리뷰 라운드 산출물(`requirement.md`, `testing.md`)이 뮤테이션 검증을 위해 저장소 파일(`nullable-type-lie-cast-guard.ts`, 이번 diff 대상 아님)을 직접 편집했다가 scratch 오염·병렬 편집 충돌을 겪고 `cp` 기반으로 원복한 사고를 스스로 고지. 이번 라운드 documentation reviewer는 리뷰 시작 시점에 그 파일이 다시 커밋되지 않은 상태로(같은 모양의 뮤테이션) 수정돼 있는 것을 관측(다른 병렬 reviewer가 검증 중이었던 것으로 추정) — 이번 diff의 결함은 아니며, side_effect reviewer가 세션 종료 시점 `git status --short`/`git diff --stat`로 잔여물 없음(clean)을 재확인 | `review/code/2026/09/04/08_18_51/requirement.md:18-30`, `testing.md:6`; 관측 대상: `nullable-type-lie-cast-guard.ts`(diff 밖) | 조치 불요 — 사고는 disclosed·resolved, 잔여물 없음 확인됨. 후속 세션에서 유사 관측 시 참고용으로 기록 |
| 6 | maintainability | 대조군(canary) 테스트 골격이 3중 반복(`userId`/`target`/`mixed`, `it.each` 미사용) — 직전 라운드에서 "구조가 달라 개별 `it()`이 낫다"로 이미 검토·기각된 사안 | `spec.ts:344, 387, 417` | 조치 불요. 4번째 반복 시 공용 헬퍼 추출 재검토 |
| 7 | maintainability | 신규 docstring이 두 테스트 중 첫 번째 위에만 있어 어디까지 적용되는지 시각적으로 모호할 수 있음(기능적 결함 아님, 검증 깊이는 두 테스트 동일) | `spec.ts:372-386` (docstring) → `:387`, `:417` | 조치 불요 — 두 번째 테스트 제목이 이미 자기설명적 |
| 8 | testing | `npx jest`로 대상 spec 파일 직접 실행 — 31/31 GREEN, 회귀 없음. `withFiles` tmpdir 격리 패턴 재사용으로 전역 상태·잔존 없음 확인 | `spec.ts` 전체 | 조치 불요 |
| 9 | testing | plan.md의 뮤테이션 수치("충돌 배제 제거→3건 RED", "관계만 제거→2건 RED")는 이번 라운드에서 재현하지 않음 — 1R requirement reviewer가 이미 독립 재현·교차검증(cp 기반 원복, `git show HEAD:<path>` 대조)했고, 재현 반복은 병렬 워크트리 충돌 위험만 추가한다고 판단 | `plan.md:241-243` | 조치 불요 |
| 10 | security | 하드코딩 시크릿·인증/인가 변경·암호화 관련 변경·에러 메시지 민감정보 노출·신규 의존성 어느 것도 발견되지 않음(테스트는 고정 리터럴만 다루는 tmpdir 픽스처, 프로덕션 가드 구현 미변경) | N/A | 조치 불요 |
| 11 | scope | `plan.md` 변경은 단일 hunk로 코드 변경과 1:1 대응하는 체크박스 승격 + 근거 서술뿐, 인접 다른 체크박스·서술은 미변경 | `plan/in-progress/entity-nullable-column-type-mismatch.md:233-246` | 조치 불요 |
| 12 | documentation | README/API 문서/CHANGELOG/환경변수 문서 갱신 불필요 — 이 diff는 내부 개발 가드 테스트 전용 추가 + plan 체크리스트 갱신이며 wire/DTO/설정 변경 없음 | N/A | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 발견사항 없음(시크릿/인증·인가/암호화/의존성 변경 없음) |
| requirement | LOW | WARNING 1건(plan 뮤테이션 서술의 오귀속) + 저장소 실재 충돌 3건/INFO#2 재검증 정확성 확인 |
| scope | NONE | 스코프 이탈 없음 — 실질 변경 2파일이 요청 범위와 정확히 일치 |
| side_effect | NONE | 새 부작용 표면 없음 — tmpdir 격리 재사용, 이전 라운드 뮤테이션 사고는 잔여물 없이 정리됨 |
| maintainability | LOW | INFO만 — 대조군 3중 반복(기각 이력 있음), docstring 위치 모호(경미) |
| testing | LOW | INFO만 — 31/31 GREEN, `@OneToOne` 미검증(유예 유효), INFO#2 반영 확인 |
| documentation | LOW | WARNING 1건(`@OneToOne` 유예가 plan에 미기록) + 워크트리 이상 상태 관측(비-결함) |

## 발견 없는 에이전트

- security — "발견사항: 없음" 명시

## 권장 조치사항
1. `plan/in-progress/entity-nullable-column-type-mismatch.md:241-242` — 뮤테이션 2 서술의 오귀속 정정("관계 대조군만"이 아니라 기존 무관 테스트 2건이 실패함을 명시하거나 해당 문구 삭제).
2. `plan/in-progress/entity-nullable-column-type-mismatch.md:233-245` 완료 항목 끝에 `@OneToOne` 유예 근거 한 줄 추가 — `review/`에만 있는 조건부 후속을 `plan/`으로 이관해 SoT 관례 준수.
3. (참고, 비차단) 이번 diff와 무관한 관측 — 리뷰 시작 시점에 `nullable-type-lie-cast-guard.ts`(diff 밖)에 커밋되지 않은 뮤테이션이 목격됐으나 최종 확인 결과 잔여물 없음. 향후 병렬 리뷰 세션에서 동일 파일 동시 편집 시 scratch 격리를 더 엄격히 지킬 것.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **제외**: 7명 (아래 표)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — forced 전원 결과 확보 완료(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 이 diff(테스트 fixture 추가 + plan 문서 갱신)에 성능 영향 경로 없음으로 판단(라우터, 상세 사유 미제공) |
  | architecture | 아키텍처 구조 변경 없음으로 판단(라우터, 상세 사유 미제공) |
  | dependency | package.json/lockfile 변경 없음으로 판단(라우터, 상세 사유 미제공) |
  | database | DB 스키마/쿼리 변경 없음으로 판단(라우터, 상세 사유 미제공) |
  | concurrency | 동시성 관련 코드 변경 없음으로 판단(라우터, 상세 사유 미제공) |
  | api_contract | API 계약(DTO/wire format) 변경 없음으로 판단(라우터, 상세 사유 미제공) |
  | user_guide_sync | 사용자 문서 동기화 대상 아님으로 판단(라우터, 상세 사유 미제공) |