# Consistency Check 통합 보고서

**BLOCK: YES** — `plan_coherence` 가 CRITICAL 1건을 보고했다 (target: `plan/in-progress/spec-draft-integration-error-facts.md`, `--spec` 모드).

## 전체 위험도
**HIGH** — 변경안 ②가 target 스스로 "비대상"으로 선언한 미해결 결정(홉/preflight 코드 통일)을 문서 표기로 선취해 자기모순을 일으킨다. 완화 요인(현재 도달 불가 경로)이 있어 즉각적 사용자 영향은 없으나, 규약상 CRITICAL 등급은 하향하지 않는다. 나머지 4개 checker 는 모두 LOW/NONE.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 변경안 ②(`1-http-request.md §4 step 8`·`§4.2` 신설 행 — "SSRF 가드의 고장 → `INTEGRATION_CALL_FAILED`")가 단계 구분 없이 적용되어, target 이 `## 비대상`에서 명시적으로 배제한 "홉/preflight 코드 통일" 결정을 사실상 한쪽(통일)으로 선취한다. `plan/complete/ssrf-catch-instanceof.md` 의 "호출부마다 정한 기대 동작" 표에 따르면 실제로는 preflight(step 8)=`INTEGRATION_CALL_FAILED`, redirect 홉(step 9)=`HTTP_TRANSPORT_FAILED` 로 갈린다. (완화: 가드가 낼 수 있는 유일한 비판정 오류(`TypeError`)는 `validateCredentials` 가 API 단에서 막아 현재 도달 불가 — 즉각 영향 없음) | `## 변경안 ②` (`0-common.md §4.2` / `1-http-request.md §4 step 8`·`§4.2` 신설 행 / `2-database-query.md §6.2`) + `## 비대상` 둘째 줄 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 체크박스 「가드 고장이 preflight 냐 리다이렉트 홉이냐에 따라 다른 코드로 나간다 — 그 경로의 회귀 테스트도 없다」(open) + `plan/complete/ssrf-catch-instanceof.md` "호출부마다 정한 기대 동작" 표 | `1-http-request.md §4.2` 신설 행에 "step 8(preflight) 한정 — step 9(redirect 홉)의 처분은 트래커 항목이 아직 결정하지 않음" 한정 문구를 추가하거나, 그 결정이 날 때까지 `1-http-request.md` 쪽 §4.2 신설 행 자체를 이번 draft 에서 보류하고 `0-common.md`(일반 규칙, DB 노드엔 리다이렉트 개념 없어 문제 없음)·`2-database-query.md` 둘만 이번 턴에 반영. `## 변경안 ②`와 `## 비대상`을 서로 맞출 것 |

## planner 인계 (권한 밖 Critical)

(없음) — 이 세션은 project-planner 의 `--spec` 게이트(target 자체가 `plan/in-progress/spec-draft-*.md`)이므로, 위 Critical 의 근본 원인(비대상 선언과 변경안의 모순)은 호출자(작성자) 자신의 draft 안에서 바로 고칠 수 있는 범위다. 별도 역할 인계가 필요한 "권한 밖" 사안이 아니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | 변경안 ③이 신규 등재하는 두 코드(`INTEGRATION_INCOMPLETE`·`INTEGRATION_AUTH_UNSUPPORTED`)가 인접 Rationale 문단의 "닫힌 다섯"(연결 테스트 전용 코드는 다섯 뿐) 서술과 어긋난다 — 같은 문서 안에서 본문(§5.3/§14.1, 이번에 정정됨)과 Rationale(그대로 남음)의 완전성이 갈린다 | `## 변경안 ③ HTTP 연결 테스트의 두 코드` (§5.3 결과 목록 끝 문장 / §14.1 두 행 추가안) | `2-navigation/4-integration.md` `## Rationale` → "연결 테스트 — Database·HTTP 는 실제로 접속한다…"(2026-09-19) → "**코드 이름**:" 문단 | 그 Rationale 문단(또는 target 의 `## Rationale`)에 "`INTEGRATION_INCOMPLETE`·`INTEGRATION_AUTH_UNSUPPORTED` 는 연결 테스트 전용이 아니라 노드와 공유하는 공통 코드(`resolveHttpCredentials` 가 요청 전 반환)" 한 문장 추가, target 체크리스트에 반영 항목으로 등재 |
| 2 | convention_compliance | `1-http-request.md` 안에서 같은 트리거(SSRF 가드 고장)를 다루는 두 표 중 draft 는 §4.2(Usage 매트릭스)만 갱신하고 §6(에러 코드 카탈로그, `INTEGRATION_CALL_FAILED` 괄호 예시 나열)은 그대로 둔다 — 병합 후 문서 내부에서 완전성이 갈린다 | `## 변경안 ②` `1-http-request.md` 항목 | `1-http-request.md §6` `INTEGRATION_CALL_FAILED` 행의 괄호 예시("integrationId 부재 — `requireEntity` fallback") | §6 괄호에 "(또는 SSRF 가드가 판정 아닌 오류를 던진 경우)"를 추가하거나, §6 이 포괄 서술이라 예시 나열이 완전성을 주장하지 않는다는 점을 target 의 `## Rationale`에 한 줄 남겨 §4.2/§6 비대칭이 의도임을 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | HTTP 연결 테스트(§5.3)의 "가드의 고장" 사례가 이 draft 가 반영하는 새 어휘(노드 런타임 3곳) 밖에 남아, 같은 성격의 연결 테스트 문서만 상세도가 비대칭 (`http-connection-tester.ts` line 118 은 이미 이 구분을 코드로 갖고 있음) | `2-navigation/4-integration.md §5.3` "결과:" 목록 (line 476-485) | 이번 draft 범위는 아니므로 차단 사유 아님 — 후속 트래커 항목으로 "가드 자체 오류(판정 아님) → `HTTP_CONNECT_FAILED`" 한 줄 추가를 등재 |
| 2 | plan_coherence | 변경안 ①이 frontmatter `code:`에 추가하는 `http-redirect.ts` 경로는 현재 구현 위치 기준 정확하지만, 별도 진행 중인 미해결 항목(공용 SSRF 가드 `http-safety.ts`를 `http-request/` 밖 중립 위치로 이동)이 실행되면 이 경로도 재조정 대상이 된다 | `## 변경안 ① 1-http-request.md frontmatter code:` | 별도 조치 불요 — 해당 이동 항목 실행자가 `code:` 재조정 범위에 이번에 추가하는 `http-redirect.ts` 항목도 포함됨을 인지하면 충분 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 사실 정정 4건 모두 코드 실측과 일치. HTTP 연결 테스트 §5.3 대칭성 결여만 INFO |
| rationale_continuity | LOW | ①②④는 기존 Rationale·결정과 정합. ③이 인접 Rationale "닫힌 다섯" 문단 갱신을 누락(WARNING) |
| convention_compliance | LOW | 명명·표 구조·frontmatter·plan 파일명 규약 위반 없음. `1-http-request.md` 내부 §4.2/§6 비대칭만 WARNING |
| plan_coherence | MEDIUM(체커 자체 판정) | ②가 target 자신의 `## 비대상` 선언과 모순 — 미해결 트래커 결정(홉/preflight 코드 통일)을 문서 표기로 선취 (CRITICAL). ①은 별도 이동 계획과의 재조정 필요성만(INFO) |
| naming_collision | NONE | 신규 식별자 0건. 전수 대조 결과 기존 코드 재사용뿐, 의미 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소 우선) `plan/in-progress/spec-draft-integration-error-facts.md` `## 변경안 ②`의 `1-http-request.md §4.2` 신설 행에 "step 8(preflight) 한정 — step 9(redirect 홉)는 `spec-draft-nullable-notation-followups.md` 의 개방 항목이 결정할 때까지 미반영" 한정 문구를 추가하거나, 이번 턴에는 `0-common.md`·`2-database-query.md` 둘만 반영하고 `1-http-request.md §4.2` 신설 행은 보류할 것 — 어느 쪽이든 `## 변경안`과 `## 비대상`을 서로 일치시킨다.
2. `2-navigation/4-integration.md` `## Rationale`의 "코드 이름:" 문단에 `INTEGRATION_INCOMPLETE`·`INTEGRATION_AUTH_UNSUPPORTED`가 연결 테스트 전용이 아닌 노드 공유 공통 코드임을 밝히는 문장을 추가하고, target 체크리스트에 반영 항목으로 등재.
3. `1-http-request.md §6`의 `INTEGRATION_CALL_FAILED` 괄호 예시에 SSRF 가드 고장 케이스를 추가하거나, Rationale에 §4.2/§6 비대칭이 의도임을 명시.
4. (참고) HTTP 연결 테스트 §5.3 "결과:" 목록에 "가드 자체 오류 → `HTTP_CONNECT_FAILED`" 대칭 항목을 후속 트래커에 등재 검토.
5. (참고) `http-safety.ts` 중립 위치 이동 항목 실행 시 `1-http-request.md` frontmatter `code:`의 `http-redirect.ts` 재조정 범위에 포함되어 있음을 인지.
