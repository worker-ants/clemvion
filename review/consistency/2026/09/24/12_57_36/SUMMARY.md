# Consistency Check 통합 보고서

**BLOCK: YES** — `spec/5-system/10-graph-rag.md` frontmatter 에 `code:`↔`pending_plans:` 오염(CRITICAL)이 발견되었습니다.

## 전체 위험도
**CRITICAL** — spec-impl-evidence 규약을 어기는 frontmatter 오염이 main 에 이미 살아 있으며 CI 가드가 이를 잡지 못함(existence-check 허점). 사용자가 이번 턴에 묻고 있는 "#1339+#1382 통합" 결정 자체와는 직접 관련 없는 기존 갭이지만, `--impl-prep spec/5-system` 게이트가 이를 발견한 이상 하향할 수 없음.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `10-graph-rag.md` frontmatter — 커밋 `5fbcd20b8` 의 `pending_plans:` 삽입 위치 실수로 기존 `code:` 리스트 소속이던 `V026__graph_extraction_status_nullable_index.sql`·`V027__relation_head_tail_index.sql`·`V037__kb_retry_failed_status.sql` 3개 마이그레이션 경로가 그대로 `pending_plans:` 리스트로 재소속됨. 본문(§7·96·106행)은 이 셋을 "✅ 구현 완료" 증거로 인용 중이라 실제로는 `code:` 증거이지 "미구현 plan" 아님. `spec-pending-plan-existence.test.ts` 가 경로 존재-검사만 하므로 CI 를 통과한 채 오염이 유지됨(false negative) | `spec/5-system/10-graph-rag.md` frontmatter 4~24행 | `spec/conventions/spec-impl-evidence.md` §2.1 (`pending_plans` 정의 — "미구현 surface 를 책임지는 plan 경로만") | `pending_plans:` 를 `- plan/in-progress/update-returning-tuple-shape.md` 한 줄로 되돌리고 `V026`/`V027`/`V037` 세 줄을 `code:` 리스트 끝으로 복귀 |

## planner 인계 (권한 밖 Critical)

> 이 항목은 developer(현재 세션, `jest-esm-native-load` 작업)가 만든 결함이 아니라 과거 커밋
> `5fbcd20b8` 이 남긴 기존 spec drift 이며, 정정 자체가 `spec/5-system/*.md` frontmatter 를
> 직접 고치는 작업이라 developer 권한(`spec/` read-only) 밖입니다. 등급은 CRITICAL, `BLOCK: YES`
> 그대로 유지 — 이 표는 차단을 푸는 장치가 아니라 다음 행동(누가·무엇을)을 지정하는 장치입니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/5-system/10-graph-rag.md` frontmatter 수정은 `spec/` write. developer 자기-반증형 소정정 예외(조건 1: "developer 자신이 그 문장을 썼다")에도 해당 안 됨 — 원인은 과거 커밋 `5fbcd20b8` 의 YAML 삽입 실수이지 developer 의 예고 문장이 아님 | project-planner | `spec/5-system/10-graph-rag.md` frontmatter: `pending_plans:` 를 `- plan/in-progress/update-returning-tuple-shape.md` 한 줄로, `V026`/`V027`/`V037` 세 경로를 `code:` 리스트로 복귀. 동일 커밋이 함께 오염시킨 `spec/5-system/8-embedding-pipeline.md` 의 `status: implemented` + 비어있지 않은 `pending_plans:` 조합(아래 경고 #1)도 같은 턴에 정리 권장 | `review/consistency/2026/09/24/12_57_36/convention_compliance.md` CRITICAL 항목, `git show 5fbcd20b8 -- spec/5-system/10-graph-rag.md spec/5-system/8-embedding-pipeline.md` |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `status: implemented` 인데 `pending_plans:` 가 비어 있지 않음(§3 lifecycle 표 직접 위반). `8-embedding-pipeline.md` §7.3.2 는 이 문서 몫 결함이 `#1168`으로 이미 고쳐졌다고 적고 있어 R-11 기준 트래커를 빼야 하는데 안 뺐음 | `spec/5-system/8-embedding-pipeline.md:11-12`, `spec/5-system/10-graph-rag.md:19-20`(위 CRITICAL 교정 후에도 남는 1행) | `spec/conventions/spec-impl-evidence.md` §3 상태 라이프사이클 표 · §3.1 R-11 승격 규칙 | (a) 이 문서 몫이 끝났다면 `pending_plans:` 제거, (b) 남았다면 `status: partial` 로 하향. project-planner 턴에서 정정 — 위 planner 인계 #1 에 병합 처리 권장 |
| 2 | convention_compliance | `4-execution-engine.md` frontmatter·본문 두 곳이 이미 `plan/complete/exec-intake-followups.md` 로 이동·완료(`status: complete`, 전 항목 `[x]`, `spec_impact: none`)된 트래커를 여전히 "잔여 후속" 으로 지목 | `spec/5-system/4-execution-engine.md` 12행(frontmatter), 439·1155행(본문) | `spec/conventions/spec-impl-evidence.md` §2.1 취지(`pending_plans` = 실제 미구현 surface) | 이 문서 몫이 끝났다면 frontmatter/본문 두 곳에서 제거, 남았다면 새 plan 또는 명시적 각주로 대체 |
| 3 | plan_coherence | 사용자가 이번 턴 제안한 "#1339+#1382 를 한 PR 로 통합" 은 `@nestjs/common` 11→12 동반 상향을 함의(`jest-esm-native-load.md` 자신이 "`common@12` 없이는 `platform-express`가 `ERR_MODULE_NOT_FOUND`로 죽는다"고 실측 확인). 이는 `auth-guard-reflection-hardening.md`/`CHANGELOG.md`(L2864-2867) 가 이미 "`@nestjs/*` 업그레이드 = `RolesGuard`/`@WorkspaceId()` 의 `ROUTE_ARGS_METADATA` 비공개 export 의존 reflection 경로에 대한 보안 회귀 우선조사 대상, flaky 취급 금지" 라고 명문화한 트리거 이벤트의 정확한 사례인데, 현재 어느 plan 에도 이 업그레이드 후 reflection 캐너리/가드 unit 스위트를 별도 검증하는 스텝이 없음(부트 캐너리는 "전체 파손"만 잡고 부분 파손은 못 잡는다고 spec 이 자인) | `spec/5-system/1-auth.md` "부트 캐너리 — `@WorkspaceId()` reflection 자가검증" 절(~794-828행) | `plan/in-progress/auth-guard-reflection-hardening.md` §1 · `CHANGELOG.md` L2864-2867 · `plan/in-progress/jest-esm-native-load.md` §E | 통합을 채택한다면 plan 에 "업그레이드 후 `workspace-reflection-canary` 부팅 로그 소비 라우트 수(기준값) 불변 + `@WorkspaceId()` 가드 unit 스위트가 의도한 경로를 그대로 태우는지"를 **명시적 검증 스텝**으로 추가할 것. "unit/e2e 숫자 그대로면 통과"로 뭉뚱그리지 말 것 |
| 4 | plan_coherence | `codebase/backend/package.json` 의 `@nestjs/*` 13개 패키지가 전부 `^11.x` 로 고정. `platform-express`(#1382) 하나만 올려도 `common`(및 사실상 peer 인 나머지 패키지들)의 호환 버전 동반 상향이 필요할 가능성이 높아, "#1339+#1382 를 한 PR 로" 는 문자 그대로의 2-패키지 범프가 아니라 사실상 NestJS v11→v12 마이그레이션일 수 있는데 이 규모·롤백 전략을 다루는 plan 이 없음. 오히려 현재 `jest-esm-native-load.md` §E 는 "동반 업그레이드는 별 PR" 이라고 정반대로 명시 결정해 둔 상태 | (target 없음 — 구현 스코프 대 plan 등재 여부 문제) | `plan/in-progress/jest-esm-native-load.md` §E "하지 않는 것" | 스코프 확장을 결정하면 (a) `jest-esm-native-load.md` 의 Overview/§B/§E/체크리스트를 확장된 스코프로 갱신하거나, (b) 별도 plan(`spec_impact` 명시, 영향받는 `@nestjs/*` 패키지 전수 나열, 위 #3 검증 스텝 포함)을 새로 세울 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `CANNOT_REMOVE_OWNER`/`OWNER_ROLE_PROTECTED`/`SOLE_OWNER_CANNOT_LEAVE` 가 중앙 에러 카탈로그(`3-error-handling.md` §1)에 미등재. 이미 알려진 갭 — `3-error-handling.md` §1.9 Rationale 이 스스로 "별도 pass" 라 명시했고, 오늘 이른 시각(`07:29:15`) 다른 `--impl-prep` 세션이 이미 같은 INFO 를 planner 백로그(`plan/in-progress/spec-draft-nullable-notation-followups.md:5097-5100`)에 등재함 | `spec/5-system/1-auth.md` §3.2 각주(377-381, 553-554행) | 오늘 착수하는 `jest-esm-native-load` 스코프 아님. 재등재 불필요 |
| 2 | rationale_continuity | impl-prep 스코프 선정(`spec/5-system`)이 실제 diff 표면(jest 설정/실행 스크립트)과 느슨함 — 이 plan 이 건드리는 어떤 소스도 `spec/5-system/*.md` 의 `code:` frontmatter 가 가리키지 않음 | 워크플로 스코프 선택(`--impl-prep spec/5-system`) | 차단 사유 아님. 결과에 "스코프 불일치로 형식 통과" 를 남겨 재추적 부담을 줄일 것 |
| 3 | convention_compliance | `spec/5-system` 내부에서 `## Overview` 섹션 헤더 표기가 3갈래(`## Overview` / `## Overview (제품 정의)` / `## 1. 개요` 또는 무헤더)로 혼재. `## Rationale` 헤더는 15개 파일 전부 일관 | `1-auth.md`(54행) 외 다수, 상세 목록은 `convention_compliance.md` 참고 | 새로 손대는 파일부터 `## Overview (제품 정의)` 로 통일, 또는 project-planner SKILL 에 다중-파일 영역 예외를 명문화 |
| 4 | naming_collision | 이번 plan(`spec_impact: none`, `spec/5-system` 대비 diff 0)은 신규 식별자를 하나도 도입하지 않아 6개 관점 전부 점검 대상 없음 | `plan/in-progress/jest-esm-native-load.md` 체크리스트의 스코프 지정 | 다음에 이 게이트를 돌릴 땐 스코프를 실제 영향 영역(harness/CI)에 맞추면 예산 절약 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 새 cross-spec 충돌 없음. 유일한 관찰(에러 코드 미등재)은 기존에 알려진 갭 |
| rationale_continuity | NONE | 관련 Rationale 항목(otplib v13 ESM-only 등)과 계획이 정합. 위반 없음 |
| convention_compliance | HIGH | `10-graph-rag.md` frontmatter CRITICAL 오염 1건 + lifecycle 위반 WARNING 2건 |
| plan_coherence | MEDIUM | 사용자가 이번 턴 제안한 PR 통합이 문서화된 reflection 보안회귀 트리거를 검증 없이 밟을 위험 |
| naming_collision | NONE | 신규 식별자 도입 없음(diff 0, spec_impact: none) |

## 권장 조치사항

1. **(BLOCK 해소 우선)** `spec/5-system/10-graph-rag.md` frontmatter 오염을 project-planner 턴에서 정정 — `pending_plans:` 를 `update-returning-tuple-shape.md` 한 줄로, `V026`/`V027`/`V037` 을 `code:` 로 복귀. 같은 턴에 `8-embedding-pipeline.md` 의 `status`/`pending_plans` 불일치(경고 #1)도 함께 정리하면 커밋 1건으로 끝남. 이 정정은 이번 `jest-esm-native-load` 작업(#1339)의 착수를 막을 이유는 아니지만(원인이 그 작업과 무관), 게이트 규약상 Critical 이 있는 한 `BLOCK: YES` 는 유지된다 — planner 정정 PR 을 먼저 머지하거나 병행 진행할 것.
2. **사용자의 "#1339+#1382 통합" 질문에 대한 직접 답**: plan_coherence 관점에서 이 통합은 안전성 면에서 두 갈래 리스크를 새로 진다 — (a) `@nestjs/common` 동반 상향이 이미 문서화된 `RolesGuard`/`@WorkspaceId()` reflection 보안회귀 트리거인데 검증 스텝이 plan 에 없고, (b) 실질 스코프가 2-패키지 범프가 아니라 NestJS v11→v12 전체 마이그레이션일 가능성이 높은데 그 규모를 다루는 plan 이 없다. 통합을 진행하기로 하면, 착수 전에 `jest-esm-native-load.md`(또는 신규 plan)에 이 두 갭을 반영 — 그 후에는 "별도 PR로 통합 작업 진행 후 테스트 → #1339/#1382 close" 방향 자체는 plan_coherence 가 막을 사안이 아니다(사용자가 지금 결정을 묻는 단계).
3. 여유가 있다면 `4-execution-engine.md` 의 완료된 `exec-intake-followups.md` 참조(경고 #2)도 같은 planner 턴에 정리.
4. `## Overview` 헤더 표기 통일(INFO #3)은 비차단 — 다음에 해당 파일을 손댈 때 처리.
