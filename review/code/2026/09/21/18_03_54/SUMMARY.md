# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건, WARNING 4건(CHANGELOG 누락·JSDoc `@throws` 미기재·에러코드 헬퍼 미추출·이종 credential 동시삭제 시 `remaining` 비원자성). forced whitelist(7명) 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `CHANGELOG.md` 에 이번 수정("아홉 번째이자 마지막 자리") 항목이 없음 — 형제 8건(#1369~#1375) 전원이 예외 없이 지켜온 관례의 유일한 이탈. 기존 CHANGELOG 두 곳(`auth_config`·`model_config` 섹션)이 이 PR 을 전방 참조("남는 것: WebAuthn credential 삭제, 아홉 번째")하고 있는데 이 PR 이 그 참조를 해소/정정하지 않음 | `CHANGELOG.md` (신규 섹션 부재) | 형제와 동일 형식(재현 상태쌍 `[204,204]`→`[204,404]`, 감사 2건→1건)으로 `## Unreleased` 섹션 추가 + 기존 두 전방 참조 문구를 취소선으로 정정 |
| 2 | Documentation | `deleteCredential()` JSDoc 이 새로 의미가 생긴 동시-삭제 404 를 문서화하지 않음 — 직전 형제(#1375, `ModelConfigService.remove()`)는 `/ai-review` 지적을 받고 정확히 같은 이유로 `@throws` 를 추가했는데 이 자리엔 없음 | `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:512-517` (`deleteCredential` JSDoc) | `@throws {NotFoundException} WEBAUTHN_CREDENTIAL_NOT_FOUND` 및 "동시 삭제 시 진 쪽은 404" 한 줄을 JSDoc 에 추가 |
| 3 | Maintainability | `WEBAUTHN_CREDENTIAL_NOT_FOUND` `NotFoundException` 객체 리터럴이 파일 내 4곳(순수 404 케이스)에 중복. 같은 결함 시리즈의 형제 두 파일(`auth-configs.service.ts`, `model-config.service.ts`)은 이미 `private throwXxxNotFound()` 헬퍼로 추출했는데, 이번에 편집한 파일만 인라인을 유지해 시리즈 내 일관성이 깨짐 | `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:497-500`, `:503-506`, `:527-530`, `:554-557` (`renameCredential`·`deleteCredential`) | `private throwCredentialNotFound(): never { throw new NotFoundException({ code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND', message: '인증기를 찾을 수 없어요.' }); }` 로 추출해 형제 패턴과 통일 (401 분기는 예외 타입이 달라 대상 아님) |
| 4 | Concurrency | `deleteCredential` 의 삭제 이후 `remaining` 계산 + 복구 코드 NULL 화가 여전히 비원자적 — 이번 diff 는 **동일 credential** 이중 삭제만 닫았을 뿐, 사용자가 **서로 다른** credential 두 개를 거의 동시에 삭제하면 두 `countCredentials` 호출이 서로 상대의 커밋 전 스냅샷을 읽어 둘 다 `remaining===1`로 오판, 복구 코드가 NULL 화되지 않고 남을 수 있음(실제 0개인데도 유효 2FA 우회 수단으로 남는 결함으로 이어질 수 있음). 이번 PR 이 새로 만든 갭은 아니고 축이 다른 인접 사전 존재 이슈 | `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:549-565` (변경 없는 560-564행 `countCredentials`/`usersService.update` 블록) | 이번 PR 범위 밖 — 별도 plan 항목으로 분리해 `deleteCredential` 전체를 트랜잭션+행 락(`verifyAuthentication` 의 `pessimistic_write` 패턴 참고)으로 감싸는 후속 작업 검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 동시 삭제 감사 로그(`user.2fa_disabled`) 중복 기록 결함이 이번 diff 로 해소됨 — 침해 대응/포렌식 무결성 관점에서 유효한 보안 개선 | `webauthn.service.ts:549-558` | 조치 불요(이미 반영됨) |
| 2 | Security / Database / Concurrency / API Contract | DELETE 조건절에 `userId` 추가로 소유권 검증이 애플리케이션(JS 비교) 레벨에서 DB WHERE 절로 강화됨(defense-in-depth). `findOne`→`delete` 사이 TOCTOU 는 있으나 최종 게이트가 원자적 단일 SQL 이라 교차사용자 삭제로 이어지지 않음이 실측·e2e 로 확인됨 | `webauthn.service.ts:549-552` | 조치 불요 — 긍정적 강화로 기록만 유지 |
| 3 | Security / Requirement / Documentation / API Contract | `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401(`verifyAuthentication`)과 404(`renameCredential`/`deleteCredential`) 두 status 로 혼용되고 에러 코드 카탈로그에도 미등재 — 이번 diff 가 만든 결함이 아니라 사전 존재하며, 이미 같은 세션의 `/consistency-check --impl-prep`(`review/consistency/2026/09/21/17_39_06`, WARNING 1)이 적발해 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 planner 후속 항목으로 등재해 둠 | `webauthn.service.ts:403` vs `:497,504,527` / `spec/5-system/3-error-handling.md` §1.11 | 이번 PR 착수/병합 차단 사유 아님 — 재등재 불필요, planner 트랙에서 처리 |
| 4 | Requirement | spec 본문(`spec/5-system/1-auth.md:498`)의 WebAuthn credential DELETE 행이 동시 삭제 시 404 의미론과 에러 코드를 명시하지 않음 — 형제 8건 전부에 존재하는 기존 문서화 공백, 이미 트래커 등재됨. SPEC-DRIFT 아님(회색지대 INFO, 코드 되돌리기 대상 아님) | `spec/5-system/1-auth.md:498` | planner 턴에서 §5 DELETE 행에 코드 명시 + `3-error-handling.md` 등재 |
| 5 | Requirement | 같은 PR 이 커밋한 `review/consistency/2026/09/21/17_39_06/SUMMARY.md` 가 "`_NOT_FOUND`≠404 유일 예외" 문구 소재를 §1.3 으로 오기재(실제는 §1.11) | `review/consistency/2026/09/21/17_39_06/SUMMARY.md` (경고 표 1행) | 기능 영향 없음, 필요 시 후속 세션에서 §1.11 로 정정 |
| 6 | Testing / Database | e2e 가 실제 DB 삭제 상태(대상 행 부재/생존 행 존재)를 SQL 로 직접 확인하지 않고 HTTP status + 감사 카운트만 대리 지표로 사용 — 형제 8개 전부가 공유하는 기존 관례이며 이번 PR 이 새로 만든 갭 아님 | `test/webauthn-credential-delete-concurrency.e2e-spec.ts:96-101` | 트래커에 등재된 "동시성 e2e 공용 헬퍼 추출" 전용 PR 에서 SQL 상태 확인 옵션 포함 고려 |
| 7 | Database | `DELETE` 이후 `countCredentials`+`usersService.update` 가 트랜잭션 밖 별도 두 쿼리 — 위 WARNING #4 와 동일 축의 사전 존재 TOCTOU, 이번 diff 범위 밖 | `webauthn.service.ts:560-564` | WARNING #4 항목과 함께 별도 트래킹 |
| 8 | Scope | 핵심 결함(감사 중복) 수정과 소유권 스코핑 강화(`userId` 조건 추가)가 같은 diff hunk 에 묶여 있음 — plan 문서에 사전 근거 명시 + 형제 8건과 일관된 패턴이라 스코프 이탈로 보기 어려움 | `webauthn.service.ts:549-552` | 조치 불요, 커밋 메시지에 부수 변경 한 줄 언급 권장 |
| 9 | Documentation / API Contract | DELETE 라우트 Swagger 문서에 `@ApiNotFoundResponse` 없음 — 소유권 불일치 404 는 이번 PR 이전부터 존재, 동시 삭제 404 도 같은 미문서화 경로를 탐 | `webauthn.controller.ts` (`webauthnDelete` 데코레이터 블록) | 필수 아님, 여유 있으면 추가 고려 |
| 10 | Maintainability | e2e 동시성 하네스(BEGIN→행 락→동시 발사→공허성 가드→COMMIT) 오케스트레이션이 9번째로 거의 동일 복제 — 이미 `plan/in-progress/webauthn-dup-delete.md` §0 결정에서 실측과 함께 "전용 PR 에서 추출" 로 유예 결정됨 | `test/webauthn-credential-delete-concurrency.e2e-spec.ts` 전체 | 유예 결정 유효, 재지적 불필요 |
| 11 | User Guide Sync | `auth-session-flow-change` semantic trigger 의 경로 glob 이 `webauthn.service.ts` 와 표면적으로 겹치나, 정상 단일-삭제 사용자 플로우·문서화된 UX·에러 코드 표면에 변화가 없어 실질 갱신 불필요로 판정(`spec_impact: none`, 형제 8건 동일 선례) | `codebase/frontend/src/content/docs/07-workspace-and-team/security-2fa.mdx:65` (변경 불요 확인) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 감사 중복 해소 확인, 소유권 DB 스코핑 강화, IDOR/인젝션 벡터 없음 |
| requirement | NONE | 형제 8건과 동일 패턴 정확 재현, spec 문서화 공백은 사전 등재된 이슈 |
| scope | LOW | 핵심 수정에 소유권 스코핑이 부수적으로 혼재하나 근거 있음 |
| side_effect | NONE | 의도된 동작 변화(패자 404) 외 신규 부작용 없음 |
| maintainability | LOW | `NotFoundException` 리터럴 중복이 형제 헬퍼 패턴과 불일치(WARNING) |
| testing | NONE | unit+e2e 견고, 대조군·공허성 가드로 판별력 확보 |
| documentation | MEDIUM | CHANGELOG 누락 + JSDoc `@throws` 미기재로 형제 시리즈 대비 문서화 밀도 하락 |
| database | LOW | 원자적 조건부 DELETE 로 경합 해소, `remaining` 계산은 여전히 비트랜잭션(사전 존재) |
| concurrency | LOW | 동일 credential 레이스는 정확히 닫힘, 이종 credential 동시삭제 시 `remaining` 비원자성 잔존(WARNING) |
| api_contract | LOW | 외부 계약(라우트/상태코드/응답 바디) 불변, 401/404 코드 혼용은 사전 등재된 이슈 |
| user_guide_sync | NONE | `auth-session-flow-change` 표면 겹침이나 실질 갱신 불요로 판정 |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상의 INFO/WARNING 을 보고함(대부분 사전 존재·이미 트래킹된 이슈로 비차단 판정).

## 권장 조치사항

1. `CHANGELOG.md` 에 이번 수정("동시 DELETE 두 건이 `user.2fa_disabled` 감사 행을 두 번 남기던 것") 섹션을 형제 8건과 동일 형식으로 추가하고, 기존 두 전방 참조 문구를 취소선으로 정정한다 (WARNING #1).
2. `deleteCredential()` JSDoc 에 `@throws {NotFoundException} WEBAUTHN_CREDENTIAL_NOT_FOUND` 및 동시 삭제 시 진 쪽 404 설명을 추가해 직전 형제(#1375)와 문서화 밀도를 맞춘다 (WARNING #2).
3. `WEBAUTHN_CREDENTIAL_NOT_FOUND` `NotFoundException` 리터럴 4곳을 `private throwCredentialNotFound()` 헬퍼로 추출해 `auth-configs.service.ts`/`model-config.service.ts` 와 패턴을 통일한다 (WARNING #3).
4. (이번 PR 범위 밖, 후속 plan 항목) 서로 다른 credential 을 동시 삭제할 때 `remaining` 계산과 복구 코드 NULL 화가 비원자적인 문제를 트랜잭션+행 락으로 감싸는 개선을 별도로 추적한다 (WARNING #4).
5. (비차단, 이미 트래킹됨) `WEBAUTHN_CREDENTIAL_NOT_FOUND` 401/404 혼용·에러 코드 카탈로그 미등재·spec 본문 동시 삭제 의미론 누락은 `plan/in-progress/spec-draft-nullable-notation-followups.md` planner 트랙에서 계속 처리하고 이번 PR 에서 재등재하지 않는다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — forced 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 변경은 성능 특성에 영향 없는 동시성/조건절 수정으로 분류됨 (개별 사유 상세는 `_routing_decision.json` 미제공) |
  | architecture | router 판단 — 단일 메서드 내부 로직 수정으로 아키텍처 영향 없음으로 분류됨 |
  | dependency | router 판단 — 신규/변경 의존성 없음으로 분류됨 |

(참고: 위 SUMMARY.md 는 `summary_output_file` 에 Write 를 시도했으나 하네스가 `SUMMARY.md` basename 을 차단해 `write_blocked` 로 반환됨 — 위 전문을 호출자가 디스크에 멱등 기록해야 함. 11개 reviewer 파일은 모두 이미 디스크에 존재함을 확인했으므로 추가 영속화 작업은 불필요했음.)
