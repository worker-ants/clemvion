# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base=origin/main)

## 검토 범위 및 방법

- 모드: `--impl-done`, target scope `spec/5-system/`, diff-base `origin/main`.
- 실측: `git diff origin/main...HEAD --stat` 결과 **`spec/` 하위 변경 파일 0개** — 이번 PR 은 spec 문서를 건드리지 않고 코드만 수정했다(`auth-oauth.service.ts`/`execution-engine.service.ts`/`knowledge-base.service.ts`/신규 유틸 `update-returning-rows.ts`, 전부 `UPDATE/DELETE … RETURNING` 이 `[rows, rowCount]` 튜플임을 오인해 생긴 결함의 수정).
- 따라서 본 검토는 "diff 가 spec 을 어겼는가" 가 아니라 "diff 가 되살린/노출한 코드 표면이 `spec/5-system/` 의 기존 서술과 정식 규약(`spec/conventions/**`)에 여전히 부합하는가" 를 확인하는 방향으로 수행했다.
- 프롬프트 예산 초과로 본문이 생략된 17개 파일(`4-execution-engine.md`·`14-external-interaction-api.md`·`2-api-convention.md` 등) 중 이번 diff 와 직접 관련된 항목은 없어(진단 대상 코드는 auth-oauth/execution-engine 서비스의 내부 로직이며 EIA/API 컨벤션 표면 변경 없음) 생략에 의한 판정 왜곡 리스크는 낮다고 판단했다. 단, `4-execution-engine.md`/`node-cancellation.md`(conventions, 전문 포함됨)는 diff 가 손댄 `admission gate`/`updateExecutionStatus` 로직과 직결되므로 conventions 쪽은 전문을 대조했다.

## 발견사항

- **[WARNING] `OAUTH_STATE_MISMATCH` 가 `spec/5-system/3-error-handling.md` 중앙 에러 카탈로그에 미등재**
  - target 위치: `spec/5-system/3-error-handling.md` §1.2(인증/인가 에러) / §1.2.1(2FA·WebAuthn·재인증) — OAuth 로그인 에러가 등재될 자리. 실측: 문서 전체에 `OAUTH_STATE_MISMATCH` 출현 **0**회.
  - 위반 규약: `spec/conventions/error-codes.md` §1 (에러 코드는 의미 기반으로 명명되고 카탈로그로 가시화되어야 함) + `3-error-handling.md` §1.6~§1.9 가 스스로 표방하는 패턴("본 절은 공용 카탈로그 가시성을 위한 등재다") — 형제 도메인 코드 `KB_REEMBED_IN_PROGRESS`·`KB_REEXTRACT_IN_PROGRESS`(§1.8)는 등재돼 있는데 같은 층위의 `OAUTH_STATE_MISMATCH`(400, `auth-oauth.service.ts`/`integration-oauth.service.ts` 공유 발행)는 빠져 있다.
  - 상세: 이번 PR(`e34a85b44` 외)이 고친 튜플 shape 버그로 인해 `auth-oauth.service.ts`의 OAuth state 소비가 **상시** `OAUTH_STATE_MISMATCH` 를 발행하던 상태였다. fix 이후 이 코드는 "정상적으로는 드물게 나는 코드" 라는 원래 의미를 되찾았고, 그래서 카탈로그 등재의 실효 가치가 지금 막 생겼다. 다만 이 갭은 **미문서화가 아니라 미등재**다 — `spec/2-navigation/4-integration.md:851`(연동 OAuth 표면)과 `spec/conventions/error-codes.md:35`(명명 예시)에는 이미 나온다. 커밋 `a53af772b`가 이 갭을 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(§"추가 위임 (2026-08-14 #12)")에 위임 티켓으로 명시적으로 적어 두었으므로 **은닉된 회귀는 아니다** — 다만 target 문서(`3-error-handling.md`) 자체는 여전히 규약이 요구하는 상태(카탈로그 완결성)에 못 미친 채로 남아 있다.
  - 제안: (a) 위임 plan 을 그대로 집행해 `3-error-handling.md`에 `OAUTH_STATE_MISMATCH (400)` 행을 추가하거나, (b) 그 전까지는 `3-error-handling.md` frontmatter `pending_plans:`에도 `spec-update-node-cancellation-shutdown-classification.md`를 등재해 `spec-pending-plan-existence.test.ts`(한 방향 가드)가 이 갭을 추적 가능한 상태로 만들 것. 플랜 본문은 이 카탈로그 등재 항목을 "5건 caveat 표"와 성격이 다르다며 `pending_plans:` 등재 대상에서 제외했는데(§"부수"), 그 결과 3-error-handling.md 는 미완료 작업을 책임지는 어떤 frontmatter 참조도 갖지 않는다 — 규약 §R-5(spec→plan 역방향 링크 의무)의 취지에 비춰 재검토 권장.

- **[INFO] 위임 plan 이 제안한 신규 카탈로그 행의 삽입 위치가 주제와 어긋남**
  - target 위치: (향후 편집 대상) `spec/5-system/3-error-handling.md` §1.8 인근으로 plan 이 지정.
  - 위반 규약: 없음(현재 spec 본문엔 아직 반영 전) — `spec/conventions/error-codes.md` §1 "도메인 prefix(권장)" 원칙과 `3-error-handling.md` 자체의 절 구성 관례(§1.2.1 2FA/WebAuthn, §1.6 EIA, §1.7 Webhook, §1.8 KB/GraphRAG, §1.9 워크스페이스 — 도메인별로 절을 나눔) 관점의 일관성 문제.
  - 상세: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(라인 626)는 `OAUTH_STATE_MISMATCH` 삽입 위치로 "§1.8 인근(도메인 전용 코드 등재 절)"을 지정했는데, §1.8 은 "KB / Graph RAG 도메인 에러 코드" 전용 절이다. OAuth 로그인 에러는 §1.2(인증/인가) 계열이 더 적절하다 — 예: §1.2.1 과 나란한 신설 소절("§1.2.2 OAuth 소셜 로그인 에러 코드") 또는 §1.2 표 자체에 행 추가.
  - 제안: 위 WARNING 항목을 집행하는 planner 턴에서 삽입 위치를 §1.2 계열로 정정할 것. 규약 갱신은 불필요 — plan 문서의 오기로 보인다.

- **[INFO] 새 공용 헬퍼(`update-returning-rows.ts`)는 각 spec `code:` glob 에 명시 등재되지 않았으나 규약상 문제 없음**
  - target 위치: `spec/5-system/3-error-handling.md`·`spec/conventions/node-cancellation.md` frontmatter `code:`.
  - 위반 규약: 해당 없음 — `spec/conventions/spec-impl-evidence.md` R-1 은 glob 허용을 명시적으로 채택했고(≥1 매치만 의무), 변경된 서비스 파일(`execution-engine.service.ts` 등)은 이미 관련 spec 들의 `code:` glob 에 포함돼 매치된다. 신규 공용 유틸이 매 소비 지점 spec 의 `code:` 에 개별 등재될 의무는 없다.
  - 상세/제안: 조치 불필요. 참고로만 기록.

## 요약

이번 PR 은 `spec/5-system/` 문서를 직접 변경하지 않았고, 수정된 코드(OAuth state 소비·execution 상태 UPDATE·KB CAS 락의 `[rows, rowCount]` 튜플 오인 버그 수정)도 API 표면·에러 코드 신설·네이밍 변경을 동반하지 않아 명명 규약·출력 포맷 규약·문서 3섹션 구조·Swagger 데코레이터 규약 관점에서는 위반이 없다. 유일하게 실질적인 간극은 이 PR 이 되살린 `OAUTH_STATE_MISMATCH` 가 `3-error-handling.md` 의 공용 에러 카탈로그에 아직 등재되지 않은 점인데, 이는 은닉된 회귀가 아니라 같은 작업 흐름 안에서 위임 plan 으로 이미 추적되고 있는 갭이다 — 다만 target 문서 자체의 frontmatter 는 이 미완료 상태를 참조하지 않아 규약이 요구하는 spec→plan 역방향 추적성이 완전하지 않다. 그 외 conventions 전문이 제공된 `error-codes.md`·`node-cancellation.md`, 그리고 전문 대조가 가능했던 `1-auth.md`·`3-error-handling.md` 본문은 도메인별 카탈로그 절 구성·`UPPER_SNAKE_CASE`·Overview/본문/Rationale 3섹션 구조를 일관되게 따르고 있다.

## 위험도
LOW
