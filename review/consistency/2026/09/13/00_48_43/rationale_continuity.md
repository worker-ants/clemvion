# Rationale 연속성 검토 보고서

## 검토 대상 요약

- 스코프: `spec/5-system/` (impl-done, diff-base `origin/main`)
- 실제 코드 delta: `codebase/backend/src/common/utils/uuid.ts` · `uuid.spec.ts` ·
  `modules/auth/login-history.service.ts`(+spec) · `modules/executions/background-runs/background-runs.service.ts`(+spec) ·
  `test/background-monitoring.e2e-spec.ts` · `test/session-revocation.e2e-spec.ts` · `CHANGELOG.md` ·
  `plan/in-progress/keyset-cursor-uuid-validation.md`(신규) · `plan/in-progress/spec-draft-nullable-notation-followups.md`
- `spec/5-system/**` 자체의 파일 delta 는 0 — 이 PR 은 코드 전용이며 spec 문서를 직접 수정하지 않는다.
- 이 브랜치는 트래커에 등재돼 있던 처방(`GlobalExceptionFilter` 에 SQLSTATE 22P02 → 400 분기 추가)을
  **명시적으로 기각**하고, 대신 keyset 커서 2곳(`login-history`·`background-runs`)의 id 성분 검증을
  입구에서 추가하는 방식으로 방향을 틀었다. Rationale 연속성 관점에서는 정확히 "과거 처방(대안)을
  뒤집는" 사례이므로 집중 검토했다.

## 발견사항

- **[INFO]** `isUuidShaped` 소비처 확장이 원 Rationale 의 서술 범위를 벗어났는데, 그 Rationale 원문(spec) 은 아직 갱신되지 않았다
  - target 위치: `codebase/backend/src/common/utils/uuid.ts` JSDoc, `codebase/backend/src/modules/auth/login-history.service.ts` (`decodeCursor`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (`decodeCursor`)
  - 과거 결정 출처: `spec/data-flow/12-workspace.md` § `X-Workspace-Id` 헤더 vs `:id` 경로 파라미터 — UUID 검증 강도 비대칭 (2026-08-09)
  - 상세: 이 Rationale 은 `isUuidShaped`(느슨한 술어)를 쓰는 이유를 **"헤더가 인가 판정의 입력이기 때문에 403→400 뒤바뀜을 막는다"** 는 인가(authorization) 컨텍스트로 명시적으로 한정해 서술한다("헤더는 **인가 판정의 입력**이므로…"). 이번 diff 는 이 술어의 소비처를 인가 입력이 아닌 **리소스 지목(커서 id)** 축까지 확장했다. `plan/in-progress/keyset-cursor-uuid-validation.md` §B 각주가 이 확장을 스스로 인지하고 "원칙 위반은 아니다 — 술어가 답하는 질문(Postgres 가 파싱하는가)은 컨텍스트 무관"이라는 근거를 남겨 두었고, `uuid.ts`/`uuid.spec.ts` 의 JSDoc 도 소비처가 3곳으로 늘었음을 반영했다. 즉 판단과 근거 자체는 합리적이고 은폐되지 않았다(암묵적 가정 충돌을 스스로 드러내고 방어했다는 점에서 절차상 모범 사례에 가깝다). 다만 **정식 Rationale 의 SoT 인 `12-workspace.md` 원문**은 여전히 "헤더 vs `:id` 경로 파라미터" 두 축만 언급하고, 소비처가 커서까지 넓어졌다는 사실이 그 문서에는 반영돼 있지 않다 — 다음에 이 Rationale 만 읽는 사람(코드 주석·plan 을 안 보는 사람)은 `isUuidShaped` 가 인가 컨텍스트 전용이라고 오해할 수 있다.
  - 제안: 블로킹 사유는 아니다(코드 axis 는 이미 스스로 근거를 남겼고 원칙 위반도 없음). 여유가 될 때 `spec/data-flow/12-workspace.md` 의 해당 Rationale 말미에 "이 술어의 소비처가 커서 id 검증(`login-history`/`background-runs`, `plan/in-progress/keyset-cursor-uuid-validation.md`)까지 확장됐고, 판단 축은 동일(Postgres 파싱 가능 여부)하되 주어는 '인가 입력'이 아니라 '리소스 지목'으로 다르다"는 한 줄 각주를 planner 턴에 추가하는 것을 권한다.

- **[정보 확인 — 위반 아님]** "필터에 22P02→400 분기" 트래커 처방의 기각이 근거를 갖췄는지 검증
  - target 위치: `CHANGELOG.md` (Unreleased 절), `plan/in-progress/keyset-cursor-uuid-validation.md` §A, `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 체크박스 `[x]`)
  - 과거 결정 출처: 동일 followups 트래커에 2026-09-12 등재된 "`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다" 항목 (처방: 필터에 400 분기 추가)
  - 상세: 이번 PR 은 그 처방을 실행하지 않고 **won't-do 로 명시 종결**했다. 근거로 인용한 `spec/5-system/3-error-handling.md §1` 문장("**JWT 클레임은 검증하지 않는다**(서버가 서명한 값이라 거기서 400 을 내면 서버 버그를 클라이언트 오류로 보고하게 된다)")을 실제 spec 원문과 대조한 결과 **정확히 일치**한다(라인 80). 필터의 기존 SQLSTATE 분기(23505→409, 23502 는 500 유지)도 `http-exception.filter.spec.ts` 실측과 일치한다. 지어낸 선례를 근거로 든 것이 아니라 실재하는 Rationale 을 정확히 인용해 "같은 축의 원칙"이라는 유비로 확장한 것이며, 이는 과거 사례에서 지적된 "선례에 없는 근거를 소급 부여"하는 결함과는 다르다 — 유비의 성격을 "새 원칙"이 아니라 "기존 원칙의 같은 축"으로 명확히 표시했다.
  - 제안: 조치 불요. 다만 이 won't-do 결정은 트래커 체크박스로만 존재하고 `3-error-handling.md` 자체의 Rationale 절에는 등재되지 않았다 — 동일 제안이 반복되는 것을 막으려면(트래커 항목이 archive 로 이동하면 근거가 묻힐 수 있음) 향후 planner 턴에서 `3-error-handling.md` 의 Rationale 에도 짧게 등재하는 것을 고려할 수 있다(INFO 수준, 이번 PR 블로킹 사유 아님).

- **[정보 확인 — 위반 아님]** 두 커서 디코더의 실패 계약 비대칭(무시 vs 400)이 `2-api-convention.md §8.2` 단일 표준과 어긋나는 상태를 "굳히는" 것인지
  - target 위치: `login-history.service.ts` (무시 후 1페이지) / `background-runs.service.ts` (400 `INVALID_CURSOR`)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §8.2` (cursor 실패 시 400 `INVALID_CURSOR` 단일 서술, opaque base64)
  - 상세: 이 비대칭은 이번 PR 이 새로 만든 것이 아니라 **기존에 이미 존재하던 계약 차이**이며, 이번 PR 은 각 디코더의 기존 계약을 유지한 채 id 검증만 추가했다(계약 통일은 명시적으로 범위 밖으로 뺐다). `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목(§8.2 예외 각주 또는 계약 통일)으로 이미 등재돼 있고, 직전 코드 리뷰 라운드(`review/code/2026/09/13/00_36_16` WARNING#1)도 동일하게 "코드 변경 불요, 이미 등재됨"으로 판정했다.
  - 제안: 조치 불요 — 이미 올바르게 planner 트래커로 넘겨졌다.

## 요약

이번 diff 의 핵심은 과거 트래커 처방(필터 22P02→400 분기)을 **번복**한 것인데, 그 번복에는 실재하는 spec Rationale(`3-error-handling.md §1` JWT 클레임 원칙)을 정확히 인용한 새 근거가 함께 실려 있어 "무근거 번복"에 해당하지 않는다. `isUuidShaped` 술어의 소비처를 인가 컨텍스트에서 커서(리소스 지목) 컨텍스트로 넓힌 것도 원 Rationale 의 핵심 질문("Postgres 가 파싱 가능한가")과 모순되지 않으며, 코드 주석과 plan 문서가 그 확장을 스스로 명시했다. 다만 그 확장 사실이 원 Rationale 의 SoT 문서(`data-flow/12-workspace.md`)에는 아직 반영되지 않아, 이 문서만 읽는 미래 독자에게는 소비처 범위가 실제보다 좁게 보일 수 있다(INFO, 비차단). 두 커서 디코더의 실패 계약 비대칭도 새로 만든 문제가 아니라 기존 갭을 planner 트래커로 정확히 승계했다. 전반적으로 이 PR 은 Rationale 연속성 관점에서 모범적으로 처리됐다 — 기각한 대안·번복한 결정 모두 실재 근거를 명시했고, 새로 발견한 확장·비대칭도 임의 처리하지 않고 추적 항목으로 등재했다.

## 위험도
NONE
