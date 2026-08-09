# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 0건 (5개 checker 전원 success, 전문 확보 완료)

## 전체 위험도
**LOW** — 순수 코드 hardening(부팅 시 `@WorkspaceId()` reflection fail-closed 캐너리 + `X-Workspace-Id` 헤더 UUID 형식 검증). `spec/` 변경 없음, `spec_impact: none` 이 실제와 일치. Critical 0건, WARNING 2건(모두 문서 동기화 지연 성격, 기능 결함 아님), 나머지는 INFO.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `X-Workspace-Id` 헤더(신규 `isUuidShaped`, permissive — nil UUID·v6/v7·비-RFC variant 허용)와 워크스페이스 `:id` 경로 파라미터(기존 `ParseUUIDPipe`, RFC variant만 허용)가 같은 "워크스페이스 UUID" 개념에 서로 다른 검증 강도를 갖게 됐는데 이 비대칭이 어느 spec 문서에도 반영되지 않음 | `common/utils/uuid.ts`(`isUuidShaped`) · `common/utils/workspace-context.util.ts` | `spec/5-system/1-auth.md` §5(`:id` 는 `ParseUUIDPipe`) · §3.3 · `spec/5-system/2-api-convention.md` §2.3 · `spec/data-flow/12-workspace.md` | `1-auth.md` §3.3 또는 `data-flow/12-workspace.md` §1.5 Rationale 에 "헤더는 `ParseUUIDPipe`보다 느슨한 `isUuidShaped`만 적용 — 403↔400 응답 뒤바뀜 방지(nil-UUID e2e 프로브 보호)" 한 줄 추가 |
| 2 | rationale_continuity | 신규 부트 가드(`assertWorkspaceIdReflectionWorks`)의 설계 근거(왜 필요한가·opt-in 마커 대안 재기각 이유·`assertProductionConfig`와 별도 단계로 둔 이유)가 코드 주석에만 있고, 이 프로젝트가 유사 부트 가드마다 지켜온 "spec Rationale 동반 기록" 관행에 반영되지 않음 | `common/decorators/workspace-reflection-canary.ts`(신규) · `main.ts` 호출부 | `spec/5-system/1-auth.md` §Rationale "Production fail-closed 가드" · `spec/data-flow/12-workspace.md` §Rationale "멤버십 검증은 가드 1곳에서"(2026-08-08, `#1103`) | 두 Rationale 중 하나(권장: `data-flow/12-workspace.md`)에 소절 추가 — (a) reflection 자가검증 이유 (b) opt-in 마커 대안 재기각 이유 (c) `assertProductionConfig`와 별도 부트 단계로 둔 이유. spec 쓰기는 developer 권한 밖 → 다음 planner 턴 반영 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `WORKSPACE_ID_REQUIRED`(헤더 부재) 옆에 신규 malformed-header→`VALIDATION_ERROR` 케이스가 카탈로그에 각주로 없음 | `spec/5-system/3-error-handling.md` §1.3 | `WORKSPACE_ID_REQUIRED` 행에 "형식 오류는 `VALIDATION_ERROR`" 각주 추가 |
| 2 | rationale_continuity | 캐너리 주석의 "73건" 인용이 원 Rationale 의 `@Roles()` 미부착 서브셋 수치를 전체 소비 라우트 수처럼 읽힐 수 있음 | `common/decorators/workspace-reflection-canary.ts` | 주석에 서브셋 수치임을 명시하거나 실측 전체 소비 라우트 수로 갱신 |
| 3 | convention_compliance | 신규 파일(`workspace-reflection-canary.ts` 등)이 `1-auth.md` frontmatter `code:` 글로브에 개별 매치되지 않음(build 가드는 기존 글로브로 이미 충족, 위반 아님) | `spec/5-system/1-auth.md` frontmatter | 후속에 `code:` 를 `common/decorators/*.ts` 로 넓히는 것 고려(강제 아님) |
| 4 | plan_coherence | `spec-fix-swagger-forbidden-response.md`(별도 in-progress plan)의 "제안 변경" draft 절과 "반영 완료" 기록의 인용이 서로 다름 — 본 PR target 과 무관 | `plan/in-progress/spec-fix-swagger-forbidden-response.md` | 본 PR 범위 밖. 해당 plan 을 다음에 만질 때 draft 절 정정 또는 "적용본과 다름" 각주 |
| 5 | naming_collision | `common/decorators/` 디렉토리 내 기존 파일은 전부 `*.decorator.ts` 접미사인데 신규 파일은 검증 유틸이라 접미사 관례에서 벗어남(문서화된 위반 아님) | `common/decorators/workspace-reflection-canary.ts` | 급하지 않음. 배럴 export 혼입 여부만 후속 확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 헤더 vs 경로파라미터 UUID 검증 강도 비대칭 미문서화(WARNING) + INFO 2건 |
| rationale_continuity | LOW | 신규 부트 캐너리 설계 근거가 spec Rationale 에 미반영(WARNING) + "73건" 인용 서브셋/전체 혼동(INFO) |
| convention_compliance | NONE | CRITICAL/WARNING 0건. 에러코드·헤더포맷·문서구조·명명규약 전부 기존 규약과 정합 확인 |
| plan_coherence | NONE | `spec_impact: none` 실측 일치. 인접 in-progress plan 전제 무효화 없음. target 밖 사소 인용 불일치(INFO) 1건만 |
| naming_collision | NONE | 신규 식별자 전부 유일, `VALIDATION_ERROR` 재사용은 규약 준수. 파일명 관례 미세 이탈(INFO) |

## 권장 조치사항
1. (WARNING #1) `1-auth.md` §3.3 또는 `data-flow/12-workspace.md` §1.5 Rationale 에 헤더/경로파라미터 UUID 검증 비대칭 근거 한 줄 추가 — 향후 "일관성" 명목의 회귀(nil-UUID e2e 프로브 파손) 예방.
2. (WARNING #2) `data-flow/12-workspace.md` 또는 `1-auth.md` §Rationale 에 신규 부트 reflection 캐너리 설계 근거 소절 추가. 두 항목 모두 `spec/` 쓰기가 필요해 developer 권한 밖이므로 다음 project-planner 턴에서 반영.
3. (INFO, 선택) `3-error-handling.md` §1.3 에 malformed-header 케이스 각주, 캐너리 주석의 "73건" 수치 명확화, `1-auth.md` `code:` 글로브 확장 검토.
4. 본 PR 자체는 차단 사유가 없으므로 push 진행 가능 — WARNING 2건은 다음 planner 턴 spec 갱신으로 해소.