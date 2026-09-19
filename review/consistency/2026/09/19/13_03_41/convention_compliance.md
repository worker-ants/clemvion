# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-integration-connection-tests.md`

대상: `spec/2-navigation/4-integration.md` §3.3·§5.1~5.4·§5.7·§9.2·§14.1·Rationale 을 고치는 spec draft plan.
검토 모드: `--spec` (draft). 대조 규약: `spec/conventions/error-codes.md`(전문), `spec/conventions/audit-actions.md`(전문) — 이 두 파일만 예산 안에 온전히 실렸고 나머지(`node-output.md`·`swagger.md`·`secret-store.md` 등)는 번들에서 절단됐다. 절단분은 저장소 원본 파일을 직접 읽어 보강했다(`spec/conventions/node-output.md` §3.2 전문, `spec/2-navigation/4-integration.md` 실제 §5.x/§9.x/§14.1/Rationale 원문 대조).

## 발견사항

- **[INFO]** 번들 예산 절단 — 이번 라운드는 실질적 공백 아님
  - target 위치: 검토 payload 자체 (prompt 헤더 "본문 생략됨 — 컨텍스트 예산 초과")
  - 위반 규약: 해당 없음 (harness 이슈, 기존에 알려진 `--spec` 기본 예산 문제)
  - 상세: `node-output.md`(28,758자)·`swagger.md`(30,184자)·`secret-store.md`(23,654자) 등 다수 conventions 파일이 번들에서 절단되어 checker 입력만으로는 §3.2(에러 코드 표준 형태)·swagger 데코레이터 패턴을 확인할 수 없었다. 이번 검토는 저장소의 실제 conventions 파일을 직접 열어 보강했으므로 결론에 영향은 없으나, 절단 자체는 이 checker 인스턴스가 매번 수동 보강해야 하는 구조적 갭이다.
  - 제안: target 수정 불요. harness 쪽 `--spec` 번들 예산 이슈로 별도 트래킹(이미 알려진 이슈).

- **[INFO]** §14.1 신규 다섯 행의 "원인" 열 텍스트가 항목 F 에 개별 명시되지 않음
  - target 위치: target 문서 "### F. §14.1" 항목
  - 위반 규약: 없음 (규약 위반 아님, 표 채움 완결성 관련 관찰)
  - 상세: 기존 `EMAIL_HOST_BLOCKED`/`EMAIL_CONNECT_FAILED` 행은 "원인"·"영향" 두 열 모두 구체적으로 채워져 있는데(§14.1 표 실측), target 은 "영향" 칸 문구(«연결 테스트 전용 — `IntegrationTestResult.code` namespace»)만 다섯 행 공통으로 지정하고 "원인" 칸은 §5.3/§5.4 본문(A·B 항목)에 흩어진 서술을 그대로 옮기라는 취지로만 남겨 실제 적용 시 다섯 행 각각의 "원인" 문구를 표 형식에 맞춰 재작성하는 작업이 남아 있다.
  - 제안: 특별한 조치 불요 — spec 반영 단계(체크리스트 2번)에서 A·B 항목의 조건 서술(예: "인증 거부(PostgreSQL SQLSTATE class 28 ...)")을 그대로 "원인" 칸에 옮기면 기존 표 포맷과 자연히 맞는다.

## 정합성 확인 (위반 아님 — 준수 근거)

아래는 CRITICAL/WARNING 후보로 검토했으나 실측 결과 규약을 **준수**하는 것으로 확인된 항목이다. 검토 흔적으로 남긴다.

1. **명명 규약 (§1 error-codes.md, 의미 기반 + 도메인 prefix)** — target 이 신설하는 `DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_AUTH_FAILED`·`HTTP_CONNECT_FAILED`·`HTTP_SERVER_ERROR` 는 전부 `UPPER_SNAKE_CASE`, `<DOMAIN>_<CONDITION>` 형식으로 §1 권장 패턴(`CAFE24_*`/`OAUTH_*`와 동류)을 따른다. 실측: 저장소 전체(`--include=*.ts --include=*.md`)에서 다섯 이름 모두 target 문서 자신을 빼면 0건 — "충돌 없음" 주장이 실증됐다.
2. **§5.4 소문자 코드 철회 = error-codes.md §1 CRITICAL 위반의 직접 시정** — 현재 `spec/2-navigation/4-integration.md:490` 은 `auth_failed`/`network`/`unknown_error` (lower_snake_case) 로, §1 `UPPER_SNAKE_CASE` 원칙 위반이자 §3 historical-artifact 예외 레지스트리에도 없는 미등록 예외였다. target 의 항목 A 가 이를 `DB_AUTH_FAILED`/`DB_CONNECT_FAILED`/(SSRF 차단은 기존 `DB_HOST_BLOCKED` 재사용)로 대체하는 것은 규약 준수 방향의 정정이다.
3. **네임스페이스 분리 원칙 준수** — target 은 신설 코드들을 "`IntegrationTestResult.code` namespace (§5.5)"로 명시해, 노드 런타임 `output.error.code`(`node-output.md` §3.2, 독립 UPPER_SNAKE_CASE 계약)와 별개 계층임을 §5.5 기존 서술(`EMAIL_CONNECT_FAILED`/`EMAIL_HOST_BLOCKED` 선례)과 동일한 방식으로 이어받는다. 레이어 혼동 없음.
4. **§14.1 표 포맷 준수** — 항목 F 가 예고한 "«연결 테스트 전용 — `IntegrationTestResult.code` namespace»" 표현은 기존 `EMAIL_CONNECT_FAILED` 행의 "영향" 칸 문구("**연결 테스트 전용** — `IntegrationTestResult.code` namespace (노드 런타임 `ErrorCode` enum 과 별개)")와 동일 어휘·형식이다.
5. **문서 구조 규약 (Overview/본문/Rationale)** — `spec/2-navigation/4-integration.md` 는 이미 §1~14 본문 + 말미 `## Rationale`(하위 `### 제목 (날짜)` 서브섹션 다수) 구조를 갖추고 있고, target 의 항목 G("## Rationale 맨 위 —")는 기존 서브섹션 명명 패턴(`### <제목> (YYYY-MM-DD)`)을 그대로 따른다. 문서 구조를 흔들지 않는 삽입.
6. **plan frontmatter 스키마 (plan-lifecycle.md §4)** — `worktree`/`started`/`owner` 3필드 모두 존재, `spec_impact` 는 실재 spec 경로 리스트(`- spec/2-navigation/4-integration.md`) 형식으로 Gate C 요구(bare string/빈 배열 금지)를 앞서 만족. 파일명 `spec-draft-integration-connection-tests.md` 도 `plan/complete/spec-draft-*.md` 100건 이상의 기존 선례와 일치.
7. **인용 정밀도** — target 이 인용하는 원문 라인(490/476/429/449/560/236/810 행)을 실제 `spec/2-navigation/4-integration.md` 에서 grep 대조한 결과 전부 일치. 참조 상대경로(`../4-nodes/4-integration/2-database-query.md`)도 실재 파일 위치와 일치. `review-citations.md` 관점에서도 "왜 지금" 절의 리뷰 산출물 인용(`review/consistency/2026/09/19/10_58_34`)이 전체 경로(날짜 포함) 형태로 bare `hh_mm_ss` 금지 규칙을 준수.
8. **§9.2/§9.4 API 문서 규약** — target 의 항목 E 는 §9.2 `preview-test` 행의 "설명" 칸 문구만 교체하며 표 컬럼 구조(메서드/경로/설명)를 그대로 유지한다. §9.4 의 기존 `INTEGRATION_TEST_FAILED`(422) 대 실제 400 코드 불일치는 target 이 스스로 "비대상"(트래커행)으로 명확히 분리해, 이번 draft 의 스코프 밖 결함과 뒤섞지 않았다 — 스코프 관리가 적절하다.

## 요약

target plan draft 는 `spec/conventions/error-codes.md` 의 명명 규약(의미 기반 · UPPER_SNAKE_CASE · 도메인 prefix · 네임스페이스 분리)을 CRITICAL 위반 상태(소문자 `auth_failed` 등)에서 준수 상태로 정정하는 것이 핵심 내용이며, 신설 코드 다섯 개는 저장소 전수 grep 으로 충돌 부재가 실증됐다. `spec/2-navigation/4-integration.md` 의 기존 §5.5/§14.1 표 포맷·Rationale 서브섹션 명명·plan frontmatter 스키마(Gate C 포함)·인용 라인 번호까지 모두 대조 확인했으며 불일치가 없다. 유일한 지적은 이번 checker 입력 번들이 예산 초과로 다수 conventions 파일을 절단한 harness 레벨 이슈(INFO, target 결함 아님)와, §14.1 신설 다섯 행의 "원인" 칸이 draft 단계에서 아직 행 단위로 완결되지 않았다는 표 채움 완결성 관찰(INFO) 뿐이다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도
NONE
