# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 위험도 LOW, CRITICAL 0건)

## 전체 위험도
**LOW** — `plan/in-progress/spec-draft-auth-invariants-sync.md`(이미 결정·구현·머지된 5건 auth 불변식의 사후 spec 동기화)는 5개 checker 전원에서 CRITICAL 없이 LOW 로 수렴. WARNING 2건 + INFO 다수는 전부 정확성/서술 이슈이며 target 의 결정·근거·앵커 자체는 실측 대조 전부 일치.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision / cross_spec (중복 지적 통합, 상위 등급 채택) | `3-error-handling.md §1.3` 신규 행이 "코드" 컬럼 자체에 `` (`X-Workspace-Id` 형식) `` 한정자를 박아 넣어, 같은 PR 의 `15-chat-channel.md §5.4` diff(코드 컬럼은 순수 `VALIDATION_ERROR` 유지, 한정자는 prose 로)와 표기 방식이 갈리고 `error-codes.md` 의 "코드는 의미로 분기, 이름 토큰 파싱 금지" 원칙과도 어긋남 | `plan/.../spec-draft-auth-invariants-sync.md` 항목 1(§1.3 변경 1-b) vs 항목 2(§5.4 diff) | `spec/5-system/3-error-handling.md:76` 기존 `VALIDATION_ERROR` 행(순수 코드값), `spec/conventions/error-codes.md:38-39` 명명 규약 | 병합 전 §1.3 새 행의 "코드" 컬럼을 순수 `` `VALIDATION_ERROR` `` 로 두고 한정자는 §5.4 처럼 prose 로 이동, 또는 `RESERVED_VARIABLE_NAME` 선례처럼 별도 컬럼으로 분리 — 두 표 표기 형식 통일 |
| 2 | cross_spec | 신설 `data-flow/12-workspace.md ## Rationale` subsection 에 실측 근거로 박히는 "`ParseUUIDPipe` (`workspaces.controller.ts`) **19곳**" 수치가 실제(`grep -n "new ParseUUIDPipe()" workspaces.controller.ts` 결과 **18곳**, import 문 1건이 잘못 합산됨)와 어긋남. 이 subsection 은 항목 1 신규 `VALIDATION_ERROR` 행이 canonical 로 인용하는 근거 지점 | §4 본문 + 신설 Rationale subsection("UUID 검증 강도 비대칭") 본문 | `codebase/backend/src/modules/workspaces/workspaces.controller.ts` 실제 코드(18곳) | 병합 전 두 발생 지점 모두 "19곳" → "18곳"으로 정정. 결정(비대칭은 의도)·근거(403→400 뒤바뀜)는 영향 없음 |
| 3 | plan_coherence | target 이 스스로 실측으로 반증한 `auth-guard-reflection-hardening.md` 의 "이미 체크된 잘못된 단정문"(`:163-165`, `system-status.e2e-spec.ts` 캐너리 지목이 틀렸다는 사실)을, plan 파일임에도 `codebase/**` 취급해 "planner 권한 밖"으로 오분류 → 정정 없이 그 plan 은 `in-progress/` 에 미정정 상태로 남음(§후속 `:193-198` 근거 문장도 동일) | `plan/.../spec-draft-auth-invariants-sync.md:65-66`(⚠️ 착수 중 발견), `:352-356`(§후속 developer 범위) | `plan/in-progress/auth-guard-reflection-hardening.md:163-165`, `:193-198` (project-planner 가 직접 쓸 수 있는 `plan/**` 범위) | 같은 PR 에서 `auth-guard-reflection-hardening.md` 해당 두 지점에 정정 각주 추가(예: "정정(spec-draft-auth-invariants-sync 착수 중 실측): 이 e2e 는 이 술어에 닿지 않음 — 진짜 캐너리는 uuid.spec.ts/workspace-context.util.spec.ts"), 또는 target §후속에서 이 항목만 developer 백로그가 아닌 planner-scope 체크리스트로 재배정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec / naming_collision (중복) | `data-flow/12-workspace.md` 신설 subsection 삽입 위치 서술 "Rationale 말미"가 부정확 — 실제로는 `### URL slug = FE 라우팅 SoT` 다음이며 그 뒤로 4개 subsection 이 더 있어 진짜 파일 끝이 아님(자기모순: "말미"라면서 뒤에 섹션이 남음) | §4 신설 subsection 위치 서술 | "Rationale 말미" → "`### URL slug = FE 라우팅 SoT` 바로 다음(이후 4개 subsection 더 있음)"으로 정정. 앵커·내용은 변경 불요 |
| 2 | rationale_continuity | "부트 fail-closed 가드마다 `1-auth.md` 에 동반 기록" 이라는 일반화가 단일 선례(Production fail-closed 가드)에만 근거 — EIA 큐 boot fail-fast 는 `14-external-interaction-api.md`(자기 도메인)에 있어 반례. 다만 배치 결론(reflection 캐너리를 `1-auth.md` 에 두는 것) 자체는 독립적으로 타당 | §5 "부트 캐너리 설계 근거" §"위치 근거" | "auth/보안 크로스커팅 부트 가드는 `1-auth.md` 에 모아 왔다(도메인 특정 가드는 각 도메인 spec)"로 한정 — 선택 사항, 배치 결론 변경 불요 |
| 3 | convention_compliance | 신규 카탈로그 행 셀 포맷 선례(`RESERVED_VARIABLE_NAME` 행)가 conventions 번들 밖 문서(`3-error-handling.md`)에 있어 이 번들만으로는 완전 검증 불가 | §1 변경 1-b 각주 | 실제 반영 시 `3-error-handling.md` 현재 `RESERVED_VARIABLE_NAME` 행 셀 구조 1회 재확인 |
| 4 | plan_coherence | `spec-sync-auth-gaps.md`(미착수, 같은 `rotate-bot-token` 엔드포인트를 감사 로깅 축에서 다룸)와 target(에러 코드 카탈로그 축) 간 실제 텍스트 겹침 없음 확인 | 항목 2 (`15-chat-channel.md §5.4`) | 조치 불요 — `spec-sync-auth-gaps.md` 착수 시 §5.4 표에 감사 관련 각주 추가 필요 여부만 재확인 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | diff 컨텍스트·기술 주장 8개 대상 소스/spec 대조 전부 일치. WARNING 1건(ParseUUIDPipe 19→18곳 수치 오류), INFO 1건(삽입 위치 서술) |
| rationale_continuity | LOW | 5건 전부 사후 기록 전제 준수, 기각된 대안(라우트별 opt-in 마커) 재도입 없음, 사실 정정과 결정 번복을 명확히 구분. INFO 1건(부트 가드 배치 근거 과잉 일반화) |
| convention_compliance | LOW | error-codes.md/spec-impl-evidence.md/secret-store.md 전 규약 준수, anchor slug 사전 검증 완료. INFO 2건(절차적 한계) |
| plan_coherence | LOW | 원 plan 2건과 1:1 대응, diff 컨텍스트 stale 아님, 타 미착수 plan 과 텍스트 겹침 없음. WARNING 1건(자매 plan 오기록 미정정) |
| naming_collision | LOW | 신규 식별자(함수명·subsection 제목·frontmatter 글로브) 전부 기존 구현/컨벤션과 일치, 진짜 충돌 없음. WARNING 1건(VALIDATION_ERROR 표기 불일치), INFO 1건(삽입 위치 서술 — cross_spec 과 중복) |

## 권장 조치사항
1. (WARNING #1) `3-error-handling.md §1.3` 신규 `VALIDATION_ERROR` 행의 "코드" 컬럼에서 `` (`X-Workspace-Id` 형식) `` 한정자를 제거하고 prose 또는 별도 컬럼으로 이동 — §5.4 diff 와 표기 통일.
2. (WARNING #2) 신설 Rationale subsection 및 §4 본문의 "ParseUUIDPipe 19곳" → "18곳"으로 정정 (실측: `grep -n "new ParseUUIDPipe()" workspaces.controller.ts` = 18건).
3. (WARNING #3) `auth-guard-reflection-hardening.md:163-165`/`:193-198` 의 잘못된 캐너리 단정문에 정정 각주 추가 — `plan/**` 은 project-planner 쓰기 권한 범위이므로 이번 PR 에서 직접 처리 가능(developer 위임 불요).
4. (INFO) `12-workspace.md` 신설 subsection 삽입 위치 서술 "Rationale 말미" → "`### URL slug = FE 라우팅 SoT` 바로 다음"으로 정정.
5. (선택) §5 "부트 캐너리 설계 근거"의 일반화 문구를 auth/보안 크로스커팅 가드로 한정.
