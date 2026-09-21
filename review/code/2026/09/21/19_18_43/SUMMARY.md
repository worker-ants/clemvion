# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. 9개 reviewer(포함 forced 7명) 전원 결과 확보 완료, 강제 화이트리스트 미이행 없음. `scope`·`database`·`concurrency` 3개 reviewer 가 각각 사전 존재 갭(비트랜잭션 `delete→count→update` durability 창, `userId` 조건 추가의 필요최소성 여부)을 이유로 LOW 를 매겼고 나머지 6개는 NONE — 신규 결함 없이 4차 리뷰 라운드에서 수렴.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음. 이전 3개 라운드(`18_03_54`, `18_31_57`, `18_58_48`)가 지적한 WARNING 6건은 모두 후속 커밋(`a20455447`, `d3127c8a6`, `ee6fd5d56`, `7b71e9a4a`, `89566e3d5`, `15da527e7`)으로 해소되었고, 이번 4차 라운드 9개 reviewer 전원이 독립적으로 재확인해 새 WARNING 을 제기하지 않았다.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/database/concurrency | 동시 DELETE 두 건이 `user.2fa_disabled` 감사를 중복 기록하던 결함이 `affected === 0` 명시 비교로 해소됨. `!affected` 로 판정했다면 드라이버가 `undefined`/`null` 을 반환하는 정상 케이스까지 404로 오판했을 것 — `it.each([[undefined],[null]])` 대조군이 그 형태를 회귀 잠금 | `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` `deleteCredential()` (561~567행), `webauthn.service.spec.ts:550-561` | 없음 — 이미 반영, 재지적 불필요 |
| 2 | security/scope/side_effect/concurrency | DELETE 조건절에 `userId` 추가는 애플리케이션 레벨(JS 비교) 소유권 검증을 DB WHERE 절로 한 겹 더한 defense-in-depth. 정상 흐름에서는 직전 `findOne` 이 이미 걸러내 도달 불가능하지만, 형제 PR(#1369~#1375) 패턴과 일관되고 plan 문서 사전 근거 있음 | `webauthn.service.ts` `deleteCredential()`, `credentialRepo.delete({ id: credentialUuid, userId })` | 없음 |
| 3 | side_effect/scope/maintainability/documentation | `throwCredentialNotFound()` private 헬퍼 추출 — 외부 시그니처·인터페이스 영향 없음. `renameCredential` 기존 두 throw 지점까지 포함한 것은 직전 라운드 maintainability WARNING(리터럴 중복)에 대한 명시적 조치이며 별도 커밋(`d3127c8a6`)으로 분리됨 | `webauthn.service.ts` `private throwCredentialNotFound(): never` (517~522행), 호출부 4곳 | 없음 |
| 4 | security/requirement | `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401(`verifyAuthentication`, 로그인 2FA)과 404(`renameCredential`/`deleteCredential`, 관리 API) 두 status로 혼용되는 사전 존재 상태가 다섯 번째 발행 지점 추가로 이어짐 | `webauthn.service.ts` `verifyAuthentication()` 401 자리 vs `throwCredentialNotFound()` 4개 호출부 | 조치 불요 — `plan/in-progress/spec-draft-nullable-notation-followups.md`(4975~5005행)에 planner 트랙으로 이미 등재됨, 재지적 불필요 |
| 5 | requirement | spec 본문(`spec/5-system/1-auth.md`, DELETE 라우트 행)이 동시 삭제 진 쪽의 404·에러 코드를 명시하지 않음(형제 8건과 동일한 기존 문서화 공백) | `spec/5-system/1-auth.md` (해당 DELETE 라우트 행) | 조치 불요 — planner 턴에서 집행 예정, SPEC-DRIFT 아님 |
| 6 | requirement | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 WebAuthn(아홉 번째) 체크리스트가 아직 `- [ ]` 이고 "해소" 마커·`plan/complete/` 이동이 없어, CHANGELOG.md 의 "아홉 자리로 종료" 선언과 트래커 상태가 시점상 불일치 | `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/in-progress/webauthn-dup-delete.md` frontmatter | 이번 리뷰 clean 종결 시 종결 커밋에서 (1) 체크박스 `[x]`, (2) "해소" 마커+경로, (3) plan 파일 실제 이동, (4) frontmatter `status` 갱신을 함께 처리 |
| 7 | documentation | 열린 트래커 항목(`spec-draft-nullable-notation-followups.md`)의 `webauthn.service.ts:532` 인용이 이 PR 자신의 편집(JSDoc·주석 추가)으로 stale 해짐 — 다만 저장소 전반의 "발견 시점 줄 번호 동결" 기존 관례(이미 닫힌 형제 항목들도 동일)와 일치 | 위 문서 WebAuthn 체크리스트 항목 | 필수 아님 — 트래커 항목 해소 시 형제와 같은 방식으로 `[x]` + "해소(날짜)" 각주만 추가, 줄 번호 자체는 갱신 불필요 |
| 8 | database/concurrency | `delete → countCredentials → recovery-code NULL화` 세 문장이 여전히 비트랜잭션 — "같은 credential 이중 삭제" 경쟁은 DB 레벨로 닫혔으나, delete 성공 후 크래시/후속 실패 시 credential 0개인데 복구코드가 NULL화 안 된 채 남는 durability 창은 기존부터 있던 별도 갭(이번 diff 미도입, 순서 논증+e2e 캐너리로 "서로 다른 credential 이중 삭제 시 둘 다 오판" 시나리오는 반증됨) | `webauthn.service.ts:569-573` | 후속 작업으로 `verifyAuthentication()` 이 쓰는 `dataSource.transaction()` + `pessimistic_write` 패턴을 `deleteCredential` 전체에 적용 고려(이미 트래커 등재 시 중복 생성 불요) — 이미 `review/code/.../18_03_54/concurrency.md` WARNING #4 로 추적 중, 재지적 아님 |
| 9 | side_effect | e2e 두 번째 테스트에서 정상 경로(단언 통과 후 `COMMIT`)에서도 `finally` 블록이 무조건 `ROLLBACK` 을 재호출 — Postgres 는 이미 끝난 트랜잭션의 ROLLBACK 을 에러 없이 처리하고 `.catch(() => undefined)` 로 흡수돼 기능적 영향 없음, 형제 e2e 파일들과 동일 관례 | `codebase/backend/test/webauthn-credential-delete-concurrency.e2e-spec.ts` 두 번째 `it` | 없음(선택적 스타일 개선 여지) |
| 10 | testing | `findOne` 이 `null` 을 반환하는 "credential 자체가 존재하지 않음" 분기가 단위 테스트로 직접 커버되지 않음 — 이번 PR 이전부터 있던 갭, 조건 구조 자체는 변경되지 않음 | `webauthn.service.ts` `deleteCredential`/`renameCredential` | 필수 아님 — 다음에 이 영역을 만질 때 `credentialRepo.findOne.mockResolvedValue(null)` 케이스 추가 고려 |
| 11 | maintainability | `deleteCredential` 결정 배경 주석 분량, e2e `fireDelete`/락/공허성 가드 오케스트레이션 중복(형제 8개 파일과 합쳐 9회째), 매직 넘버(`1_500`, `60_000`) 반복은 이번 diff 로 신규/악화되지 않음 | `webauthn.service.ts:544-560`, `webauthn-credential-delete-concurrency.e2e-spec.ts` 다수 위치 | 조치 불요(비차단) — plan §0 결정 1 이 이미 후속 PR 에서 `raceUnderHeldLock()` 헬퍼 추출 + 상수화로 유예 결정 |
| 12 | scope/maintainability/testing/side_effect | 최종 커밋(`15da527e7`)은 JSDoc 1줄(`verifyAuthentication(:403)`→`verifyAuthentication()`) + plan 문서 서술 정정뿐인 순수 문서 self-correction — 코드 로직·구조·테스트 커버리지 변화 없음 | `webauthn.service.ts` `throwCredentialNotFound()` JSDoc, `plan/in-progress/webauthn-dup-delete.md` | 없음 |
| 13 | concurrency | `renameCredential` 은 여전히 무락 `findOne`+`save` 로 lost-update 가능성 있으나 이번 PR("동시 DELETE 감사 중복") 스코프 밖, 이번 diff 가 만든 갭 아님 | `webauthn.service.ts:486-504` | 없음(별도 스코프) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·시크릿·인증우회·enumeration·민감정보노출 신규 결함 없음. 감사 중복 해소는 보안 강화 |
| requirement | NONE | 핵심 로직 형제 8건과 정확히 일치, spec 문서화 공백은 사전 존재·planner 트랙 등재 |
| scope | LOW | 핵심 변경은 `affected` 판정 1곳에 근접, `userId` 조건·헬퍼 추출은 근거 있는 부가 방어/정리 |
| side_effect | NONE | 전역상태·환경변수·네트워크·공개시그니처 영향 없음, 유일한 동작 변화는 의도된 404 전환 |
| maintainability | NONE | 핵심 로직 선형·짧음, 유일했던 WARNING(리터럴 중복) 해소 유지 |
| testing | NONE | 대조군·공허성 가드로 판별력 높은 회귀 테스트, 회귀 없음 실측 확인 |
| documentation | NONE | 직전 라운드 WARNING 6건 전부 해소 유지, 트래커 stale 인용은 기존 관례와 일치 |
| database | LOW | PK 인덱스로 충분, `affected===0` 정확, delete→count→update 비트랜잭션 durability 창은 기존 갭 |
| concurrency | LOW | 동일 credential 경쟁은 DB 원자성으로 닫힘, 서로 다른 credential 오판 시나리오는 순서논증+e2e 로 반증 |

## 발견 없는 에이전트

없음 — 9개 reviewer 모두 최소 1건 이상의 INFO 를 남겼으나 전부 비차단.

## 권장 조치사항

1. 이번 리뷰가 clean 종결되면 종결 커밋에서 `plan/in-progress/webauthn-dup-delete.md` → `plan/complete/` 이동 + `spec-draft-nullable-notation-followups.md` WebAuthn 체크리스트 `[x]` + "해소(날짜)" 마커를 함께 반영한다(INFO #6).
2. (선택, 비차단) 향후 이 파일을 다시 만질 때 `findOne` → `null` 단위 테스트, `deleteCredential` 트랜잭션 래핑, e2e 하네스 공통 헬퍼 추출(`raceUnderHeldLock()`), 매직 넘버 상수화를 함께 고려한다 — 모두 기존 plan/트래커에 이미 근거와 함께 유예되어 있어 이번 PR 을 막지 않는다.
3. Critical/Warning 이 없으므로 이번 PR 은 추가 fix 라운드 없이 병합 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `database`, `concurrency` (9명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명) — 전원 결과 확보 완료, 화이트리스트 미이행 없음
  - **제외**: 5명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 (프롬프트에 개별 사유 미제공 — diff 가 서비스 로직 1개 SQL 조건절 수준으로 성능 영향 범위 밖으로 판단된 것으로 추정) |
  | architecture | 라우터 판단 (동일, 아키텍처 변경 없음) |
  | dependency | 라우터 판단 (동일, package.json/lockfile 변경 없음) |
  | api_contract | 라우터 판단 (동일, 공개 API 시그니처/계약 불변) |
  | user_guide_sync | 라우터 판단 (동일, 사용자 가이드 대상 UI/문서 변경 없음) |
