# Code Review 통합 보고서 (확인용 재리뷰)

**대상 브랜치**: `claude/mc-endpoint-hardening-dca699`
**검토 일시**: 2026-06-27 15:49
**변경 개요**: model-config 부속 엔드포인트 hardening + doc-sync (직전 ai-review `15_32_28` Warning 반영 후 확인용 재리뷰)

---

## 전체 위험도

**LOW** — Critical 0건, Warning 3건(전부 scope, 의도된 doc-sync 번들 + 필수 CI unblock). 직전 리뷰의 코드/문서/테스트 Warning(maintainability·api-contract·documentation·side-effect·testing)은 전부 해소 확인. 잔여는 scope 분리 권고와 INFO.

> fallback Agent fan-out (Workflow router 버그 회피).

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 처분 |
|---|----------|----------|------|
| 1 | Scope | `plan/complete/web-chat-loader-queue-replay-arguments.md`(#715) `spec_impact` 수정이 본 브랜치와 무관 | **justified(keep)** — Gate C(plan-completion) 가 빈 배열 거부로 plan-touching PR 전부의 CI 를 막던 main breakage 해소. 커밋 `7eb45204` 본문에 의도 명시 |
| 2 | Scope | `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 PR #714·#716 머지 기록 | **justified(keep)** — 사용자 요청 "A+B doc-sync" 의 B 범위. impl-prep consistency 가 직접 처방한 WARNING(stale "PR 대기") 해소 |
| 3 | Scope | `plan/in-progress/spec-sync-auth-gaps.md` dead link 정정 | **justified(keep)** — 사용자 요청 doc-sync 범위. consistency-check 가 직전 짚은 dead link |

> 3건 모두 reviewer 가 "branch 명+CHANGELOG" 로 의도를 추론해 코드 hardening 만 범위로 본 데서 비롯. 실제 의도는 사용자 요청 "A(코드)+B(doc-sync) 묶음 PR" 이며 커밋 `7eb45204` 제목("+ doc-sync")에 명시됨. 상세 disposition: RESOLUTION.md.

---

## 참고 (INFO)

| # | 카테고리 | 항목 | 처분 |
|---|----------|------|------|
| I1 | Requirement | spec §3 표 `GET :id/models` 행에 "invalid type → 400" 미기술(SPEC-DRIFT) | defer — reviewer 가 project-planner 경로로 라우팅. 400 은 이미 Swagger(@ApiBadRequestResponse·@ApiQuery enum)+CHANGELOG 에 문서화됨 |
| I2 | maintainability | `MODEL_TYPE_ENUM` unexported (서비스 레이어와 잠재 SOT 분리) | defer — 현 계약 영향 없음, 장기 DTO 이동 후보 |
| I3 | maintainability | `@Throttle` 키 순서 `{ttl,limit}` = 원본과 역전 | no-op — 코드베이스 컨벤션(10+ 파일)에 맞춘 의도적 정렬 |
| I4 | api-contract/documentation/side-effect | 각 1~3 INFO (pre-existing best-effort 200, 페이지네이션, 근거 주석 등) | defer/pre-existing |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| security | LOW | Critical/Warning 0. 입력 hardening 긍정 |
| api_contract | LOW | actionable 0. 400 경로 Swagger 문서화 확인. INFO 3 |
| requirement | NONE | 기능·엣지·에러 경로 정확. spec §3 SPEC-DRIFT INFO 1(planner) |
| testing | LOW | Critical/Warning 0. e2e `type=bogus→400` 검증 확인. (직전 W2/W3 오탐 미재발) |
| scope | LOW | Warning 3(doc-sync 번들, justified). 코드 변경은 범위 정합 |
| side_effect | LOW | Critical/Warning 0. INFO 1 |
| maintainability | LOW | Critical/Warning 0. DRY 개선 긍정. INFO 3 |
| documentation | LOW | Critical/Warning 0. INFO 3 |

---

## 라우터 결정

라우터 미사용 — fallback 평문 Agent fan-out. **실행 reviewer (8)**: security, api_contract, requirement, testing, scope, side_effect, maintainability, documentation. **제외 (6)**: performance·architecture·dependency·database·concurrency·user_guide_sync.

---

STATUS=success CRITICAL=0 WARNING=3 RISK=low PATH=/Volumes/project/private/clemvion/.claude/worktrees/mc-endpoint-hardening-dca699/review/code/2026/06/27/15_49_35/SUMMARY.md
