# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 1건 발견 (convention_compliance)

## 전체 위험도
**HIGH** — spec draft 가 `status: implemented` 문서에 미구현 계약을 얹으면서 `partial`/`pending_plans` 전이를 다루지 않음(Critical). 그 외에는 참조 오류·근거 범위 과잉일반화·Rationale 인용 누락 등 WARNING/INFO 수준.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 새 미구현 약속(신규 에러코드·API 동작·UI 안내)을 `status: implemented` spec 에 추가하면서 `partial`/`pending_plans` 전이를 다루지 않음 | `plan/in-progress/spec-draft-rotate-conflict.md` `## 변경안` ①~⑤(L38-81), `## 체크리스트`(L90-95) | `spec/conventions/spec-impl-evidence.md` §3 status 라이프사이클 + R-5(`pending_plans` 의무화) + R-11 선례(`secret-store.md` — 항목 하나만 미구현이어도 `partial` 로 하향) | `spec/2-navigation/4-integration.md` frontmatter 를 `status: implemented` → `partial` 로 낮추고 `pending_plans:` 에 구현 담당 후속 developer plan 경로 추가. draft 체크리스트에도 이 frontmatter 갱신 항목을 추가. 후속 PR 구현 머지 시 R-11 방식으로 재승격 |

## planner 인계 (권한 밖 Critical)

> 이 Critical 은 대상이 `plan/in-progress/spec-draft-rotate-conflict.md` (아직 `spec/` 에 반영 전 draft) 이며, 수정 권한이 이 draft 를 작성·병합할 project-planner 턴에 있다. 등급은 CRITICAL 그대로이고 `BLOCK: YES` 도 유지한다 — 이 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는 장치다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | `spec/` 문서의 `status`/`pending_plans` frontmatter 전이는 project-planner 소유 결정(SDD 규약상 spec 쓰기 권한) — draft 를 실제 spec 에 반영하는 시점에 함께 결정해야 함 | project-planner (다음 spec 반영 턴) | `spec/2-navigation/4-integration.md` frontmatter (`status: implemented` → `partial`, `pending_plans:` 추가) + `plan/in-progress/spec-draft-rotate-conflict.md` 체크리스트에 frontmatter 갱신 항목 추가 | `plan/in-progress/spec-draft-rotate-conflict.md` (체크리스트 L90-95), 반영 대상 `spec/2-navigation/4-integration.md` frontmatter |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 2 | cross_spec | ②의 "교체(rotate·재인증·토큰 갱신) = 충돌 사건" 일반화가 `data-flow/5-integration.md` 의 재인증/토큰 갱신 실제 정책(거부 없는 pessimistic-lock 직렬화, last-writer-wins)과 형태가 반대 — row 배타성으로 실동작 충돌은 없으나 서술이 오해를 유발 | `plan/in-progress/spec-draft-rotate-conflict.md` ②(§9.4 하위, "충돌이 아닌 것") | `spec/data-flow/5-integration.md` §1.2(L100-103), §6 상태 전이 표(L738) | ②를 "이 계약은 rotate 대상 행(비-OAuth)에 한정 — 재인증/토큰 갱신은 §1.2 pessimistic lock 직렬화를 그대로 유지" 로 좁히거나 상호 참조 추가. §6 표에 실패 계약 비대칭(rotate=거부, reauthorize=무거부) 각주 추가 |
| 3 | cross_spec / naming_collision | "범용 conflict 코드가 없다(백엔드 전수 집계)" 서술이 실제로는 전역 기본값 `RESOURCE_CONFLICT` 와 선례 `WORKFLOW_VERSION_CONFLICT`(동일 형태: 동시쓰기 lost-update, first-committer-wins, 409)를 놓친 과잉 일반화. 결론(신규 top-level 코드 신설) 자체는 `spec/5-system/2-api-convention.md` §5.3 규약상 뒤집히지 않음 | draft "실측" 절 — "범용 conflict 코드가 없다" 문장 | `spec/5-system/3-error-handling.md:90`(`WORKFLOW_VERSION_CONFLICT`), `http-exception.filter.ts`(`getCodeFromStatus(409)` → `RESOURCE_CONFLICT` 전역 기본값) | 실측 문장 범위를 "Integration 모듈(§9.4) 카탈로그 안" 으로 좁히고, Rationale ⑤에 `api-convention.md §5.3` + `WORKFLOW_VERSION_CONFLICT` 선례 인용. §9.4 변경안에 "구현은 `ConflictException` 생성 시 `code` 명시 필수(미지정 시 `RESOURCE_CONFLICT` 로 떨어짐)" 한 줄 추가 |
| 4 | naming_collision | 변경안 ④가 지목한 "§3 상세 화면 표"가 실제 섹션과 불일치 — §3 은 "추가 페이지"(등록 플로우)이며 해당 테이블은 §4.3 Security 탭(298행)에 있음 | draft 변경안 ④ | `spec/2-navigation/4-integration.md` §3(L132-258, 추가 페이지) vs §4.3(L292-299, Security 탭) | ④ 참조를 "§4.3 Security 탭 표의 «Rotate credentials (비OAuth)» 행(298행)" 으로 정정 |
| 5 | plan_coherence | Rationale "기각한 대안" 이 이 저장소가 최근 확립한 advisory lock 패턴(읽기→외부호출→merge→쓰기 동형 문제를 해소한 완료 plan)을 검토·기각한 이력 없이 건너뜀 | draft ⑤ Rationale "기각한 대안 — `@VersionColumn`" 단락 | `plan/complete/trigger-config-lost-update.md`(advisory lock + 외부호출 락 밖 + 락 안 재읽기), `spec/2-navigation/4-integration.md` 기존 advisory-lock 기각 근거(Cafe24 토큰 갱신) | "advisory lock(트리거-config 선례)도 검토했으나 [연결테스트의 동기적 응답 요구 등 이유]로 미채택" 한 줄 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 6 | convention_compliance | §9.4 삽입안의 `>` blockquote 표기가 대상 절 실제 리스트 형식(`- ` bullet)과 다름 | draft ①(L40-45), ②(L47-51) | 후속 반영 시 `>` 를 걷어내고 `- ` bullet(②는 하위 `  - `)로 정정 명시 |
| 7 | rationale_continuity | `@VersionColumn` 기각 근거가 이미 있는 코드베이스 선례("optimistic claim = 확립된 패턴의 일반화")를 인용하지 않음 | draft L73-76 | `spec/5-system/4-execution-engine.md` L1488 "기존 패턴의 일반화" 인용 추가 |
| 8 | rationale_continuity | advisory lock 대안 누락이 같은 문서 안 기각 논리로 이미 방어되나 명시 인용 없음 | draft L73-76 | BullMQ cafe24-token-refresh Rationale 의 advisory lock 기각 근거를 rotate 문맥으로 인용 |
| 9 | rationale_continuity | `updated_at` 술어를 "검증 안 된 의심"으로 유예한 판단은 기존 실측-우선 서술 관행과 일치 (위반 아님, 참고) | draft L77-81 | 조치 불요 |
| 10 | plan_coherence | §9.4 편집 지점이 `spec-draft-nullable-notation-followups.md` 의 미해결 항목(`INTEGRATION_TEST_FAILED` 상태코드 정정)과 같은 절 인접 행 — 직접 충돌은 아니나 병합 순서 주의 | draft 변경안 ①, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 두 plan 항목이 서로 참조("같은 §9.4, 인접 행")하도록 한 줄 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | ② 일반화가 재인증/토큰갱신 기존 정책과 형태 반대(오해 위험, 실동작 충돌은 없음); 신규코드 근거가 `WORKFLOW_VERSION_CONFLICT` 선례 누락 |
| rationale_continuity | LOW | 기존 Rationale(optimistic claim 일반화·advisory lock 기각)과 정합하나 인용 누락(INFO 3건) |
| convention_compliance | HIGH | **Critical**: `status: implemented` spec 에 미구현 계약 추가 시 `partial`/`pending_plans` 전이 누락; INFO: blockquote 서식 불일치 |
| plan_coherence | LOW | advisory lock 검토 이력 미기재(WARNING); §9.4 인접 plan 과의 병합 순서(INFO) |
| naming_collision | LOW | §3/§4.3 참조 오류(WARNING); "범용 conflict 코드 없음" 근거 범위 과잉일반화(WARNING). 신규 식별자 `INTEGRATION_ROTATE_CONFLICT` 자체는 grep 0건으로 충돌 없음 |

## 권장 조치사항
1. **(BLOCK 해소 필수)** `spec/2-navigation/4-integration.md` frontmatter 를 `status: implemented` → `partial` 로 낮추고 `pending_plans:` 에 구현 담당 후속 developer plan 경로를 추가 — 이 draft 가 실제 spec 반영 시점에 project-planner 가 처리 (§planner 인계 참고).
2. draft 변경안 ④의 위치 참조를 "§4.3 Security 탭 표 298행" 으로 정정.
3. "범용 conflict 코드 부재" 실측 문장 범위를 "Integration 모듈 §9.4 카탈로그 안" 으로 좁히고, `spec/5-system/2-api-convention.md §5.3` + `WORKFLOW_VERSION_CONFLICT` 선례를 Rationale ⑤에 인용. 구현 시 `ConflictException` 의 `code` 명시 필수 사항도 §9.4 변경안에 추가.
4. ②의 "교체=충돌" 일반화를 rotate 대상 행(비-OAuth)에 한정하는 문구로 좁히거나 `data-flow/5-integration.md §1.2` 를 상호 참조.
5. Rationale ⑤에 advisory lock 대안 검토·기각 근거(연결 테스트의 동기적 응답 요구 등) 한 줄 추가, 아울러 `spec/5-system/4-execution-engine.md` "기존 패턴의 일반화" 인용도 함께 보강.
6. §9.4 삽입 서식을 `>` blockquote 대신 대상 절의 `- ` bullet 형식으로 정정.
7. `spec-draft-nullable-notation-followups.md` 의 §9.4 인접 미해결 항목과 상호 참조 추가(병합 순서 충돌 방지).
