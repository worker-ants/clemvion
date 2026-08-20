# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(backend 소스 주석이 이번 PR 의 프런트 파일 이동으로 stale 해짐, 코드 리뷰 소관과 겹치는 사안)과 INFO 다수(추적성 nit)만 존재.

## Critical 위배 (BLOCK 사유)

없음.

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision (convention_compliance 도 동일 사실을 범위밖 INFO 로 확인) | 이번 PR 이 `MASKED_MARKERS`/`isMaskedMarker` 정본을 `dynamic-form-ui.tsx` → `codebase/frontend/src/lib/utils/masked-markers.ts` 로 옮겼는데, backend 의 교차참조 주석과 plan 트래커 배경지가 옛 위치(`dynamic-form-ui.tsx`)를 그대로 가리켜 "미러 동기화" 전제가 깨졌다 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:143` (주석) + `plan/in-progress/spec-sync-external-interaction-api-gaps.md:317` (배경지) | 실제 신규 정본 위치 `codebase/frontend/src/lib/utils/masked-markers.ts` | `sanitize-error-message.ts:143` 주석의 인용 파일명을 `masked-markers.ts` 로 1줄 갱신(developer 권한 내, 소스 주석 수정 — 이번 PR 의 코드 리뷰/후속 커밋에서 반영 권장). trailing 트래커 문구도 다음에 열 때 함께 정정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec + naming_collision (중복 통합) | 신규 공용 유틸 `masked-markers.ts` 가 관련 spec 어느 `code:` frontmatter 목록에도 등재되지 않음(같은 계약을 쓰는 `rerun-modal.tsx`/`editor-toolbar.tsx` 는 등재됨) | `spec/5-system/14-external-interaction-api.md` frontmatter `code:` | `codebase/frontend/src/lib/utils/masked-markers.ts` 를 목록에 추가 (비차단, 추적성 nit) |
| 2 | cross_spec | 프런트 마커 가드는 UI 우회 시(직접 API 호출) 강제되지 않음 — 그러나 §R17 이 처음부터 "UI 정상 흐름 방어"로 범위를 명시한 설계이며 이번 PR 이 새로 만든 갭이 아님 | `spec/5-system/14-external-interaction-api.md` §R17 / `spec/5-system/13-replay-rerun.md` §8.1 | 서버측 리터럴 마커 거부 방어선 추가 여부는 별도 보안 백로그 검토 항목으로 남길 만함(이번 PR 범위 밖) |
| 3 | rationale_continuity | WS §4.1 캐비엇이 EIA §R17 을 인용하고 §R17 은 다시 R-5 를 원용 — 2홉 인용에서 R-5 의 스코프 caveat(Config 탭 직접 대상 아님)이 표면상 사라짐. 결론 자체는 매 단계 타당 | `spec/5-system/6-websocket-protocol.md` §4.1 | 다음에 이 인용부를 만질 때 "원 출처 R-5" 를 한 홉 더 명시 |
| 4 | plan_coherence | `eia-inputdata-marker-guard.md`/`spec-draft-inputdata-egress-masking.md` 두 plan 이 아직 `status: in-progress` — 이번 `--impl-done` 호출 자체가 그 체크리스트 마지막 항목의 실행 도중이라 정상 | `plan/in-progress/eia-inputdata-marker-guard.md` 체크리스트 최하단 | push 직전 체크리스트 완료 표시 + `status` 전환 후 `plan/complete/` 이동 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 6개 spec 문서에 egress 마스킹 카브아웃 폐지가 동일 날짜·동일 서술로 정합적으로 미러됨. CRITICAL/WARNING 없음, INFO 2건(추적성 nit·설계상 범위 한정) |
| rationale_continuity | NONE | §R17 "잔여 ②" 조건 충족 후 카브아웃을 닫은 정당한 번복. 직전 라운드 WARNING(whack-a-mole 반박 누락)도 이번 target 에 보강 확인됨. 새 긴장 없음 |
| convention_compliance | NONE | frontmatter `code:` 신규 항목 실존·경로 형식 준수, 문서 구조·앵커·표기 관례 위반 없음. 코드 주석 drift 1건은 범위 밖으로 명시 후 naming_collision 이 WARNING 으로 포착 |
| plan_coherence | NONE | 선행 `--impl-prep`/`--spec` 게이트 → planner 정정 → developer 재개 순서가 실제 git 이력과 일치. 타 in-progress plan 과 충돌 없음, 후속 항목(앵커 삭제·frontmatter) 누락 없음 |
| naming_collision | LOW | 신규 코드/i18n 식별자 충돌 없음. backend↔frontend `MASKED_MARKERS` 동명은 의도된 미러. WARNING 1건(파일 이동으로 backend 주석·트래커 배경지가 stale) |

## 권장 조치사항
1. (비차단, 권장) `codebase/backend/src/shared/utils/sanitize-error-message.ts:143` 주석의 프런트 미러 위치 인용을 `dynamic-form-ui.tsx` → `codebase/frontend/src/lib/utils/masked-markers.ts` 로 갱신.
2. (비차단) `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 에 `codebase/frontend/src/lib/utils/masked-markers.ts` 추가.
3. (비차단) push 직전 두 in-progress plan 의 체크리스트를 완료 표시하고 `plan/complete/` 로 이동.