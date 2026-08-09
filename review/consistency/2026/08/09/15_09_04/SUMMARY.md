# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 Critical 없음. 5/5 checker 전문 확보(재시도 필요 없음). 5개 checker 산출 파일(`cross_spec.md`·`rationale_continuity.md`·`convention_compliance.md`·`plan_coherence.md`·`naming_collision.md`)은 모두 디스크에 이미 존재함(영속화 불필요).

## 전체 위험도
**LOW** — spec 텍스트 변경 없는 순수 코드 하드닝(PR); 신규 400 분기가 에러 카탈로그·`code:` evidence 글로브에 미등재된 WARNING 2건(누락 성격, 계약 위반 아님) 외 실질 위배 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `X-Workspace-Id` 형식 오류(비-UUID) → `VALIDATION_ERROR`(400) 신규 분기가 canonical 에러 카탈로그·엔드포인트 실패 응답 표에 미등재. 기존 `WORKSPACE_ID_REQUIRED`(부재)와 구분되는 제3의 케이스지만 카탈로그가 이를 반영 못함(직접 모순은 아닌 incompleteness) | `codebase/backend/src/common/utils/workspace-context.util.ts` (`resolveRequestWorkspaceContext`) | `spec/5-system/3-error-handling.md` §1.3, `spec/5-system/15-chat-channel.md` §5.4(`rotate-bot-token` 실패 응답 표, R-CC-18이 §1.3을 canonical로 인용) | `3-error-handling.md` §1.3 에 "헤더 존재하나 UUID 형태 아님 → `VALIDATION_ERROR`(400), `WORKSPACE_ID_REQUIRED`(부재)와 구분" 행 추가 + `15-chat-channel.md` §5.4 등 canonical 인용처 각주 갱신. spec 쓰기는 project-planner 권한 — 후속 spec-sync 항목으로 기록 권고 |
| 2 | Convention Compliance | frontmatter `code:` 글로브가 이번 PR이 강화한 정확한 표면(`common/decorators/*.ts`·`common/utils/workspace-context.util.ts`·`common/utils/uuid.ts`)을 포함하지 않음 — evidence 추적 사슬 비어있음(빌드 비차단, `spec-code-paths.test.ts`는 `common/guards/*.ts`로 이미 충족돼 통과) | `spec/5-system/1-auth.md` frontmatter `code:`, `spec/5-system/3-error-handling.md` frontmatter `code:` | `spec/conventions/spec-impl-evidence.md` §1/§2 | `1-auth.md`의 `code:`에 `common/decorators/*.ts`(`workspace.decorator.ts`+신규 `workspace-reflection-canary.ts`)와 `common/utils/workspace-context.util.ts`·`uuid.ts` 추가. 부팅 가드(`app.module.ts`/`main.ts`)는 `1-auth.md` 또는 `3-error-handling.md` 어느 한쪽에 최소 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | reflection canary 신규 방어층이 원 설계 Rationale 문서에 역참조되지 않음(단방향 참조, 인용 자체는 실제 이력과 부합해 허구 아님) | `codebase/backend/src/common/decorators/workspace-reflection-canary.ts`, `main.ts` vs `spec/data-flow/12-workspace.md` §Rationale | `data-flow/12-workspace.md` §Rationale(또는 `1-auth.md` §3.3 인근)에 "부팅 시 reflection canary가 `@WorkspaceId()` 소비 라우트 인식 실패를 fail-closed 로 차단" 1줄 추가. 필수 아님 |
| 2 | Rationale Continuity | 코드/plan 이 인용하는 "`--impl-prep` WARNING #2/INFO #2"는 개별 checker 파일 순번이 아니라 통합 SUMMARY.md 순번(개별 파일 기준으로는 WARNING #1/INFO #1) — 내용은 정확, 지어낸 인용 아님 | `workspace-reflection-canary.ts` JSDoc, `plan/in-progress/auth-guard-reflection-hardening.md` §1 | 후속 정리 시 "SUMMARY.md WARNING #2"처럼 출처 파일 명시 또는 항목 제목 병기. 차단 사유 아님 |
| 3 | Convention Compliance | 신규 `workspace-reflection-canary.ts`가 `common/decorators/` 폴더의 암묵적 `*.decorator.ts` 접미사 관례·barrel export(`index.ts`) 패턴을 벗어남(정식 규약 없음, 위반 아님) | `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` | 정식 규약 신설은 과잉. 후속 파일 증가 시 `common/bootstrap/` 등 별도 디렉터리 분리 고려 |
| 4 | Plan Coherence | plan이 "후속(이 PR 밖)" 3건(README 캐너리 문서화·fixture 공용화·메모이제이션 실측 대기)을 미해결로 남긴 채 진행 중 — `plan-lifecycle.md` §5 이동 기준상 `complete/` 이동 불가하나 저장소 기존 관행과 일치, 새 리스크 아님 | `plan/in-progress/auth-guard-reflection-hardening.md` "## 후속 (이 PR 밖)" | 조치 불요, 기록 목적 |
| 5 | Naming Collision | 신규 `workspace-reflection-canary.ts` 파일명이 `common/decorators/` 폴더의 `.decorator.ts` 접미사 패턴과 다름(정식 규약 없어 위반 아님, Convention Compliance INFO #3과 동일 관찰) | `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` | 조치 불요 |
| 6 | Naming Collision | "canary" 용어가 `execution-engine.service.spec.ts`의 데이터 leak 캐너리 픽스처 값과 이번 부팅 self-check 개념 사이에서 문맥만 다르게 재사용됨 — 실제 식별자 충돌 없음 | `workspace-reflection-canary.ts` vs `execution-engine.service.spec.ts` | 조치 불요(선택: `spec/conventions/`에 "canary" 용어 정의 고려) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 신규 `VALIDATION_ERROR` 400 분기가 에러 카탈로그·실패응답 표 미등재(WARNING, 누락 성격) + canary 역참조 부재(INFO) |
| Rationale Continuity | NONE | 기각된 대안(라우트별 opt-in 마커) 재도입 없음, 원칙 위반 없음, 근거 인용 정확(SUMMARY 순번 사용은 INFO) |
| Convention Compliance | LOW | `code:` frontmatter 글로브가 신규 강화 표면(decorators/utils) 미포함(WARNING) + 디렉터리 명명 로컬 불일치(INFO). 에러코드·명명·API문서·구조는 전부 준수 |
| Plan Coherence | NONE | 소유 plan의 모든 결정에 `--impl-prep` 근거 존재, 타 plan과 충돌·미해소 선행조건 없음. 후속 3건 미해결은 관행상 정상(INFO) |
| Naming Collision | NONE | 신규 export 전부 유일(grep 전수 확인), 기존 `VALIDATION_ERROR` 정확 재사용. 디렉터리 명명·용어 중복은 비충돌 INFO 2건 |

## 권장 조치사항
1. (선택, spec 쓰기는 project-planner 권한) `spec/5-system/3-error-handling.md` §1.3에 "`X-Workspace-Id` 헤더 형식 오류 → `VALIDATION_ERROR`(400)" 행 추가하고 `15-chat-channel.md` §5.4 등 canonical 인용처 파급 확인 — spec-sync 후속 항목으로 기록.
2. (선택) `1-auth.md`/`3-error-handling.md` frontmatter `code:` 글로브에 `common/decorators/*.ts`·`common/utils/workspace-context.util.ts`·`common/utils/uuid.ts` 추가해 evidence 사슬 완결.
3. (선택, 필수 아님) `data-flow/12-workspace.md` §Rationale에 reflection canary 방어층 1줄 역참조 추가.
4. 그 외 INFO 항목들은 조치 불요 — 기록 목적.