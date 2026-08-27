# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**NONE** — `eia-misc-hygiene` 브랜치는 spec 3파일의 코드 경로/이름 참조 정정(총 3줄) + 그에 대응하는 코드 위생 리팩터(파일 이동, 함수 리네임, JSDoc 오기 정정, 테스트 재조직, 신규 테스트 헬퍼)뿐이며, 5개 checker 전원이 위험도 NONE·Critical/Warning 0건으로 판정했다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `interaction.guard.ts` JSDoc 의 존재하지 않던 요구사항 ID `EIA-AU-09` 참조 제거 — 기존 dangling 참조의 해소이지 신규 충돌 아님 | `codebase/backend/src/modules/external-interaction/interaction.guard.ts:27` | 조치 불요 |
| 2 | cross_spec | `node-output-allowlist.ts` 이동(`shared/utils/`→`nodes/core/`)에 따른 spec 경로 참조 동반 갱신, 구 경로 잔존 0건 확인 | `spec/5-system/14-external-interaction-api.md` frontmatter, `spec/conventions/{egress-masking,node-output}.md` | 조치 불요 |
| 3 | cross_spec | `node-output-allowlist.ts` 재배치는 "shared=도메인 비의존" 관례 위반을 국소적으로 해소 — 이 원칙 자체는 spec 상 formal SoT 없음(코드리뷰 영역) | `codebase/backend/src/nodes/core/node-output-allowlist.ts` | cross-spec 관점 조치 불요 |
| 4 | cross_spec | 신규 `shared/testing/swagger-probe.ts` 는 spec 문서가 디렉토리 목록을 박제하지 않으므로 문서화 대상 밖 | `codebase/backend/src/shared/testing/swagger-probe.ts` | 조치 불요 |
| 5 | convention_compliance | `spec-code-paths.test.ts` 가드는 `code:` 리스트 중 최소 1개만 매치하면 통과(any-match)라 이번 경로 정정 없이도 가드는 통과했을 것 — 이번 PR 은 가드 사각지대를 자발적으로 메운 위생 조치 | `spec/5-system/14-external-interaction-api.md`, `spec/conventions/node-output.md` frontmatter `code:` | 조치 불요(참고) |
| 6 | plan_coherence | `spec-sync-external-interaction-api-gaps.md` 내 완료 항목(`[x]`) 옆에 2026-08-23 시점의 "불변식 완전 회복 안 됨" 구 서술이 그대로 남아, 오늘(2026-08-27) 완료 주석과 시제상 어긋나 보임(날짜 병기로 이력 보존 해석 가능) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 `node-output-allowlist.ts` 재배치 항목 | 비차단 nit — 다음에 여는 사람의 오독 방지 위해 구 서술 앞에 "(이동 전 상태)" 시점 표식 한 줄 추가 권장 |
| 7 | naming_collision | 신규 식별자 4건(경로 이동 1·함수 리네임 1·`swagger-probe.ts` export 4개·tsconfig exclude 1줄) 전 저장소 grep 결과 기존 사용처와 충돌 없음, 구 이름/구 경로 잔존도 0건 | `codebase/backend/src/nodes/core/node-output-allowlist.ts`, `redact-stored-error.ts`, `shared/testing/swagger-probe.ts`, `tsconfig.build.json` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec 내용(요구사항 ID·API 계약·데이터 모델·RBAC) 변경 없음. 코드 경로 참조 3줄 동기화만. `EIA-AU-09` 오기 dangling 참조 해소. |
| rationale_continuity | NONE | `## Rationale` 본문 텍스트 무변경. 결정 번복·기각 대안 재도입·invariant 위반 없음. `node-output-allowlist.ts` 재배치는 오히려 기존 invariant 복원 방향. |
| convention_compliance | NONE | frontmatter 스키마(`id`/`status`/`code`/`pending_plans`) 요건 충족, 신규 경로 실존 확인, 구 경로 잔존 0건. `spec-impl-evidence.md` 규약 준수. |
| plan_coherence | NONE | 대응 plan(`spec-sync-external-interaction-api-gaps.md`) 5항목이 실측 근거와 함께 동시 완료 처리됨. 미해결 결정 우회 없음. INFO 1건(구 서술 시제 nit)은 비차단. |
| naming_collision | NONE | 신규 식별자(경로/함수명/신규 헬퍼 export/tsconfig 항목) 전 저장소 기준 기존 사용처와 충돌 0건. |

## 권장 조치사항
1. (선택, 비차단) `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 `node-output-allowlist.ts` 재배치 완료 항목 옆, 2026-08-23 시점 "불변식 완전 회복 안 됨" 서술 앞에 "(이동 전 상태)" 등 시점 표식을 한 줄 추가해 다음 열람자의 오독을 방지.
2. 그 외 조치 불요 — 이번 PR 은 spec/코드 참조 정합성 위생 작업으로, 모든 checker 가 위험도 NONE·Critical/Warning 0건을 보고했다.
