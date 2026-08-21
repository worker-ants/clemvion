# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음.

## 전체 위험도
**LOW** — Cross-Spec/Rationale/Plan/Convention 4개 checker 는 NONE, Naming Collision 1개 checker 만 어휘 근접성 관련 INFO 로 LOW 판정. Critical/Warning 없이 INFO 3건뿐.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

(없음)

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Convention Compliance | 신규 SoT 선언(`공유 패키지 @workflow/masked-markers`)에 코드 경로 markdown 링크 누락 — 같은 문서 내 다른 SoT 선언 9/22 건은 `[코드 SoT](../../codebase/...)` 링크를 건다 | `spec/5-system/14-external-interaction-api.md` §R17 (라인 1625 부근) | `공유 패키지 [`@workflow/masked-markers`](../../codebase/packages/masked-markers/)` 형태로 링크화 권장. 강제 규약 아니며(문서 내 13/22 건은 링크 없음) 비차단 |
| 2 | Convention Compliance | frontmatter `code:` 신규 항목이 glob 이 아닌 단일 파일(`src/index.ts`) — 형제 shared-package 항목(`graph-warning-rules`, `expression-engine`)은 관례적으로 glob 사용 | `spec/5-system/14-external-interaction-api.md` frontmatter `code:` | `codebase/packages/masked-markers/src/**` 로 넓혀 형제 패턴과 통일 권장. 현재는 `index.ts` 가 사실상 유일한 non-test 소스라 결과 동일, 향후 소스 파일 증가 시 커버리지 좁아짐 방지 목적. 필수 아님 |
| 3 | Naming Collision | 신설 `MAX_MASK_DEPTH` (`@workflow/masked-markers`)와 기존 `MAX_SANITIZE_DEPTH`(WS 마스커, `websocket.service.ts:80`)의 어휘상 근접성("MASK" vs "SANITIZE") — 값은 둘 다 10 이나 비교연산자(`>=` vs `>`)·스캔 대상이 다른 별개 불변식 | `codebase/packages/masked-markers/src/index.ts:81` (신규), `codebase/backend/src/modules/websocket/websocket.service.ts:80` (기존, PR 무변경) | 조치 불요(비차단) — 이번 PR 이 새로 만든 근접성이 아니라 기존 `MAX_REDACT_DEPTH` vs `MAX_SANITIZE_DEPTH` 근접성을 유지할 뿐이며, "별개 불변식" 경고가 코드 3곳(index.ts:77-79, sanitize-error-message.ts:120-126, strip-external-only-fields.ts:31-32,97-98)에 중복 배치돼 상쇄됨. 향후 리뷰에서 이 3곳 경고가 diff 로 삭제되는지만 확인하면 충분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | target 은 `14-external-interaction-api.md` frontmatter 1줄 + Rationale 재작성뿐. 데이터모델/API계약/요구사항ID/상태전이/RBAC 어느 축도 미접촉. `codebase/packages/**` 공유 SoT 패턴은 기존 6개 선례(`ai-end-reason` 등)와 동형. 인접 spec(`11-mcp-client.md`, `6-websocket-protocol.md`)의 관련 상수(`SECRET_LEAK_PATTERNS`, `MAX_SANITIZE_DEPTH`)는 이관 대상 아니고 여전히 유효 |
| Rationale Continuity | NONE | R17 "backend 가 SoT" 문구 번복이지만 날짜 붙은 새 Rationale 동반, "기각 이력 없음" 주장 `git log -S` 로 실측 확인, `spec-sync-...gaps.md:373` 이 사전에 이 경로를 권고해 둔 사실 확인. `@workflow/ai-end-reason`·`graph-warning-rules` 등 4개 이상 선례로 확립된 "shared package = SoT" 원칙을 위반이 아니라 적용. `MAX_SANITIZE_DEPTH`/`MAX_MASK_DEPTH` 분리 유지로 R17 자체 원칙("공유 프리미티브 확장 시 오염 주의")도 준수 |
| Convention Compliance | NONE (INFO 2건) | 패키지 명명(`@workflow/<kebab>`)·frontmatter `code:` 스키마·문서 3섹션 구조·spec 위치 관례(conventions 분리 불요) 모두 준수. Rationale 의 "CI 경로 게이팅" 역사적 주장은 `.github/workflows/*.yml` pathspec 과 커밋 `7cc64fa35` 로 실측 확인(허구 아님). INFO 2건은 이 문서에도 혼재된 느슨한 스타일 관례 수준 |
| Plan Coherence | NONE | `spec-sync-external-interaction-api-gaps.md` 의 선행 트래커 항목(`:373`, `:757`) 이 같은 턴에 `[x]`+대체근거로 닫힘. 타 in-progress plan 에 마스킹 마커 관련 미해결 결정 없음(grep 확인). PR 밖 후속 항목 2건이 review 산출물이 아니라 plan 본문에 정확히 등재. 등록 표면 8곳(package.json, Dockerfile 3곳, CI 워크플로 등) 코드로 재확인 |
| Naming Collision | LOW (INFO 1건) | 신규 요구사항 ID 없음(grep 0건). 패키지명·export 식별자(기존 이름 그대로 이관)·파일 경로 컨벤션 모두 충돌 없음. `MAX_MASK_DEPTH` vs `MAX_SANITIZE_DEPTH` 어휘 근접성만 INFO — PR 이전부터 있던 근접성 수준 유지, 신규 위험 아님 |

## 권장 조치사항

1. (비차단, 선택) `spec/5-system/14-external-interaction-api.md` §R17 의 `@workflow/masked-markers` SoT 서술에 `../../codebase/packages/masked-markers/` markdown 링크 추가 — `spec-link-integrity.test.ts` 자동 검증 대상에 편입시키는 부수 이익.
2. (비차단, 선택) frontmatter `code:` 의 `codebase/packages/masked-markers/src/index.ts` 를 `codebase/packages/masked-markers/src/**` glob 으로 넓혀 형제 shared-package spec 항목과 패턴 통일.
3. (비차단, 관찰만) 향후 `websocket.service.ts`(`MAX_SANITIZE_DEPTH`) 또는 `masked-markers` 패키지를 건드리는 PR 에서, 코드 3곳(index.ts:77-79 / sanitize-error-message.ts:120-126 / strip-external-only-fields.ts:31-32,97-98)의 "별개 불변식" 경고 주석이 diff 로 삭제되지 않는지만 확인.

이번 라운드는 5개 checker(cross_spec, rationale_continuity, convention_compliance, plan_coherence, naming_collision) 전원이 `success` 로 전문을 반환했고, 5개 개별 결과 파일 모두 세션 디렉토리(`review/consistency/2026/08/21/14_48_12/`)에 이미 존재함을 확인했다(영속화 조치 불필요). Critical/Warning 없이 INFO 3건만 있어 BLOCK: NO 로 수렴.