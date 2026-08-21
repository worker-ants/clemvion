# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 이 CRITICAL 없음으로 판정(위험도 전부 LOW). 전문 확보 못한 checker 없음(rationale_continuity 는 status=`no_status` 였으나 인라인 전문이 완전히 확보되어 정상 반영).

## 전체 위험도
**LOW** — 구현 리스크는 없고, 정본 트래커(`spec-sync-external-interaction-api-gaps.md`) 동기화 누락 1건과 실행 시 라인 오기 위험 1건이 핵심.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — target 은 spec 정정 자체를 이미 "developer 는 spec/ read-only" 규약에 따라 planner 턴으로 스스로 분리해 두었고(rationale_continuity 확인), 이번 라운드에서 새로 발견된 권한 밖 Critical 은 없다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | "미러 소멸 캐너리" 작업 항목이 스캔 대상(export 심볼 재선언 vs 문자열 리터럴 값)을 정의하지 않아, spec 이 이미 독립 메커니즘으로 확정한 두 곳과 충돌할 위험 | `plan/in-progress/masked-marker-shared-package.md` `## 작업` 체크리스트 "미러 소멸 캐너리" 항목 | `spec/5-system/14-external-interaction-api.md` 잔여③(workflow-assistant `redact.ts` — 값-패턴 마스킹과 합성 금지 명시) · `spec/5-system/12-webhook.md` §5.3(`sanitize-response-headers.util.ts`, `'[REDACTED]'` 동일 리터럴 독립 사용) | 캐너리 스코프를 "패키지가 export 하는 심볼의 재선언 감지"로 한정하고, 위 두 파일과 `http-request.handler.ts` 를 화이트리스트로 명시(선례 `masked-reject-callers-guard.ts` 의 AST+allowlist 패턴 재사용) |
| 2 | rationale_continuity, plan_coherence (동일 발견, 중복 통합) | 정본 트래커에 동일 결함("MASKED_MARKERS backend/frontend cross-stack 계약 테스트 부재")이 **두 번**(`:373`, `:757`) 등재돼 있는데 target 은 `:757` 하나만 대체·종결 대상으로 지목 | `plan/in-progress/masked-marker-shared-package.md` `## 다른 plan 과의 관계` (라인 37-47) — "정본 트래커 2항목 [x] + 대체 근거" | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:373` (`12_33_36`, 2026-08-17 등재 — "남은 것: 두 스택 대조. 공유 패키지 추출이 선행돼야 값싸다 — 그래서 별건으로 남긴다", 정확히 이 작업을 전제조건으로 이미 지목) | "다른 plan 과의 관계" 열거를 "둘"→"셋"으로 넓히고, `:373` 항목도 같은 구현 커밋 턴에 `[x]` + 대체 근거(패키지 추출로 대체) 기재. 문구가 `:757` 과 거의 동일해 대체 근거 재사용 가능 |
| 3 | naming_collision | spec frontmatter `code:` 목록 삽입 지점으로 지목한 "13행"이 실제로는 다른 기존 항목(`sanitize-error-message.ts`)의 줄이다 (`masked-markers.ts` 는 실제 15행) | `plan/in-progress/masked-marker-shared-package.md` `## 작업` — "frontmatter `code:` 목록(같은 파일 13행)에 패키지 경로를 추가" 지시 | `spec/5-system/14-external-interaction-api.md` frontmatter `code:` 리스트 6-15행(인접 항목이라 오편집 위험) | planner 턴 집행 시 라인번호 대신 `masked-markers.ts` 항목을 텍스트로 앵커해 지목하거나, 실행 직전 실측 라인 재확인 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | 공유 패키지(`codebase/packages/**`) 신설·명명·재export 정책을 다루는 전용 정식 규약 문서가 `spec/conventions/` 에 없음(target 결함 아님, 기존 갭) | `spec/conventions/` (대응 문서 부재) | 이 PR 이후 `spec/conventions/shared-packages.md`(가칭)로 `@workflow/*` 명명·등록 8표면·재export 정책 코드화 — target 의 "등록 8곳" 표를 초안으로 재사용 가능 |
| 2 | plan_coherence | "`05_23_14` 등재분 중 wrapper/미러 관련 서술" 인용이 다소 부정확 — 해당 배치엔 "미러" 를 직접 언급하는 항목이 없음(wrapper 함수명 항목만 있음) | `plan/in-progress/masked-marker-shared-package.md` `## 다른 plan 과의 관계` 둘째 불릿 | 다음 편집 시 "`05_23_14` 등재분 중 wrapper 함수명 항목"으로 정확히 지칭해 WARNING #2(`:373`/`:757` 미러 항목)와의 혼동 제거 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 요구사항 ID·API 계약·RBAC·깊이 상수 실측 전부 일치. "미러 소멸 캐너리" 스코프 미정의만 WARNING |
| rationale_continuity | LOW | `git log -S` 로 기각 이력 부재 확인, R17 정정을 planner 턴으로 분리한 판단 정당. 트래커 `:373` 교차참조 누락만 WARNING |
| convention_compliance | LOW | frontmatter Gate C·패키지 명명·상수 표기·re-export 전략 모두 실측 일치, CRITICAL/WARNING 없음. 공유 패키지 규약 문서 부재는 INFO |
| plan_coherence | LOW | 선행조건 우회·미해결 결정 무시 없음. 정본 트래커 중복 항목(`:373`) 미인지만 WARNING |
| naming_collision | LOW | 신규 식별자(`@workflow/masked-markers`, `MAX_MASK_DEPTH`) 저장소 전역 충돌 없음. frontmatter 라인번호 오기만 WARNING |

## 권장 조치사항
1. `## 다른 plan 과의 관계` 절에 `spec-sync-external-interaction-api-gaps.md:373`(`12_33_36`) 항목을 대체·종결 대상 "셋"째로 추가 — 구현 커밋과 같은 턴에 정본 트래커 `[x]` 처리(rationale_continuity + plan_coherence 공통 지적)
2. "미러 소멸 캐너리" 작업 항목에 스캔 스코프(심볼 재선언 vs 리터럴 값)를 명시하고 `14-external-interaction-api.md` 잔여③·`12-webhook.md` §5.3 대상 파일을 화이트리스트로 남긴다
3. spec frontmatter `code:` 목록 삽입 지점을 라인번호("13행") 대신 텍스트 앵커(`masked-markers.ts` 항목)로 재지목
4. (선택, 비필수) `spec/conventions/shared-packages.md` 신설 검토 — 향후 유사 패키지 추출 작업의 반복 재발굴 비용 절감
