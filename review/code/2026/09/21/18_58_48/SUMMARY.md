# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. WARNING 2건은 모두 이번 라운드 정정 작업(stale 줄 번호 인용 제거)이 **소스 JSDoc과 자매 plan 문서 두 곳에는 아직 적용되지 않은** 문서 일관성 문제이며, 현재 시점 기준으로는 사실관계가 틀리지 않았고 기능·계약에 영향 없음. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화(documentation) | `throwCredentialNotFound()` JSDoc의 `` `verifyAuthentication`(:403) `` 하드코딩 줄 번호 인용이 코드 자체에 새로 도입됨. 현재는 정확하지만(직접 grep 확인), 이 PR이 방금 `plan/` 문서에서 "줄 번호 인용은 stale해진다"는 동일 교훈을 학습·정정했음에도 같은 리팩터 커밋(`d3127c8a6`)이 써 넣은 소스 주석 자체에는 그 교훈을 적용하지 않았다 — `verifyAuthentication` 앞쪽 코드가 편집되면 조용히 틀린 줄을 가리키게 됨 | `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts:512` (`throwCredentialNotFound()` JSDoc) | `` `verifyAuthentication`(:403) `` → `` `verifyAuthentication()` `` 로 줄 번호 제거(동명 메서드 없어 명확성 손실 없음) |
| 2 | 문서화(documentation) | 동일한 stale 줄 번호 인용(`:403`·`:497`·`:504`·`:527`)이 자매 plan 문서에는 정정되지 않고 그대로 남아, 저장소 내 같은 사실에 대한 서술 신뢰도가 문서마다 달라짐 | `plan/in-progress/webauthn-dup-delete.md` (`/consistency-check --impl-prep` 체크리스트 항목 아래) | 필수는 아님(완료된 체크리스트 항목이라 historical 기록으로 방어 가능) — 일관성을 위해 "(리팩터 전 기준, 커밋 `d3127c8a6` 이후 줄 배치 변경됨)" 같은 시점 명시 추가 또는 `plan/complete/` 이관 시 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/데이터베이스 | 핵심 수정 — `deleteCredential()`의 `affected===0` 명시 비교로 동시 DELETE 진 쪽을 404 처리, 감사 로그(`user.2fa_disabled`) 중복 기록 결함(포렌식 오판 위험)을 해소 | `webauthn.service.ts` `deleteCredential()` (561-567행) | 조치 불요 — 유효한 보안 개선 |
| 2 | 보안/데이터베이스/API계약 | DELETE 조건절에 `userId` 추가 — 소유권 검증을 애플리케이션 JS 비교에서 DB WHERE 절로 강화(defense-in-depth). 클라이언트 관측 응답 형태·계약 변경 없음 | `webauthn.service.ts:559-563` (`credentialRepo.delete({ id, userId })`) | 조치 불요 — 긍정적 강화 |
| 3 | 보안/동시성 | `findOne`(무락)→`delete` 사이 TOCTOU 존재하나, 최종 게이트가 원자적 DB WHERE 절이라 교차 사용자 삭제(IDOR)로 이어지지 않음. 레이스는 감사 중복(이번 diff로 해소)만 유발했었음 | `webauthn.service.ts` `deleteCredential()` 전체 | 조치 불요 — 설계·실측상 닫혀 있음 |
| 4 | 보안 | 인젝션 벡터 없음 — 전 SQL 파라미터 바인딩(`$1`/`$2`) 확인, 신규 e2e 포함 문자열 접합 쿼리 없음. 하드코딩 시크릿·자격증명도 없음 | 변경 파일 전체 | 조치 불요 |
| 5 | 보안/요구사항/API계약 | `WEBAUTHN_CREDENTIAL_NOT_FOUND` 코드가 401(`verifyAuthentication`)과 404(`renameCredential`/`deleteCredential`)를 겸용하고 에러 코드 카탈로그(`spec/5-system/3-error-handling.md`)에 미등재 — 이 diff 이전부터 존재. 이미 `/consistency-check --impl-prep`가 잡아 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 planner 후속 항목으로 등재됨 | `webauthn.service.ts:403-404`(401) vs `:497,:500,:542,:566`(404, 헬퍼 호출로 형태만 변경) | 이번 PR 조치 대상 아님 — 이미 planner 트랙 등재, 재-flag 불필요 |
| 6 | 데이터베이스/동시성/요구사항 | `affected===0` 명시 비교(`!affected` 아님) 채택은 DB 드라이버 계약상 정확 — `undefined`/`null`(미보고) vs `0`(실제 미삭제) 구분. `it.each([[undefined],[null]])` 대조군이 형제 PR(#1371)의 32건 뮤턴트 생존 재발을 방지 | `webauthn.service.ts:561-567`, `webauthn.service.spec.ts` `describe('동시 삭제')` | 조치 불요 |
| 7 | 유지보수성/부작용/동시성 | `throwCredentialNotFound(): never` private 헬퍼 추출로 `NotFoundException` 리터럴 4곳(`renameCredential` 2곳, `deleteCredential` 2곳)을 통합 — private이라 외부 시그니처·에러 payload 영향 없음. 직전 라운드 WARNING이 정확히 해소됨 | `webauthn.service.ts:517-522`(정의), 호출부 `:497,:500,:542,:566` | 조치 불요 — 완료 확인 |
| 8 | 부작용/API계약 | 유일한 외부 관측 가능 행동 변화 — 동시 삭제 레이스 패자가 204 대신 404를 받음. 라우트/시그니처/`{remaining}` 반환 계약은 불변, breaking change 아님. 형제 8건(#1369~#1375)과 동일 패턴 | `webauthn.controller.ts` `webauthnDelete` | 조치 불요 |
| 9 | 데이터베이스 | `delete→count→conditional update` 시퀀스가 여전히 트랜잭션 없이 순차 실행됨(pre-existing). 서로 다른 credential 동시 삭제 시 `remaining` 오판 우려(WARNING #4)는 커밋 순서 논증 + 락 기반 e2e로 반증됨. 신규 관찰: "삭제 진행 중 신규 credential 등록(INSERT)" 인터리빙까지는 다루지 않음(좁은 타이밍 윈도우, 이번 diff가 만들거나 넓히지 않음, 기존 후속 트랜잭션 개선 트래커 범위로 흡수 가능) | `webauthn.service.ts:561-574` | 이번 PR 착수·병합 차단 사유 아님 — 후속 트랜잭션 개선 시 DELETE-INSERT 인터리빙도 시나리오에 포함 권장 |
| 10 | 동시성/테스트/요구사항 | e2e 동시성 하네스 — 별도 `locker` 커넥션의 `SELECT...FOR UPDATE`로 강제 인터리빙 + `Promise.race` 기반 1.5초 공허성 가드로 "겹침이 실제로 일어났음"을 관측. 두 번째 e2e(WARNING #4 반증)도 첫 번째와 동일한 가드가 이번 라운드에 추가되어 판별력 확보(직전 라운드 WARNING 해소) | `webauthn-credential-delete-concurrency.e2e-spec.ts:52-118, 150-227` | 조치 불요 — 완료 확인 |
| 11 | 테스트 | `renameCredential`/`deleteCredential`의 "credential 자체가 존재하지 않음"(`findOne`→`null`) 분기가 단위 테스트로 직접 커버되지 않음 — pre-existing 갭, 이전 라운드에 이미 등재·비차단 처리 | `webauthn.service.ts` `deleteCredential`/`renameCredential`의 `if (!credential ...)` 조건 | 필수 아님 — 다음 편집 시 `findOne.mockResolvedValue(null)` 케이스 추가 고려 |
| 12 | 범위(scope) | 핵심 버그 수정(`affected` 판정)과 `userId` 조건 추가(부가 방어 강화)가 같은 hunk에 묶임 — plan 문서에 사전 근거 있고 형제 8개 PR과 일관된 작은 변경이라 스코프 이탈 아님 | `webauthn.service.ts` `deleteCredential()` | 조치 불요 |
| 13 | 유지보수성 | e2e 두 `it` 블록의 `fireDelete`/락/공허성 가드 오케스트레이션과 매직넘버(`1_500`, `60_000`)가 파일 내부 2회 + 형제 8개 e2e까지 합쳐 반복 — 이미 plan에서 실측·후속 PR(`raceUnderHeldLock()` 공용 헬퍼)로 결정됨 | `webauthn-credential-delete-concurrency.e2e-spec.ts:66-105, 178-220` | 이번 PR 조치 불요 — 기 등재된 후속 PR 범위에서 처리 |
| 14 | 범위(scope) | `CHANGELOG.md`의 취소선이 마크다운 `~~`와 HTML `<del>` 두 형식으로 혼용 — `auth_config` 섹션은 중첩 취소선 파싱 모호성을 피하려 의도적으로 HTML 사용(커밋 메시지에 근거 명시) | `CHANGELOG.md` 두 "남는 것" 단락 | 조치 불요 |
| 15 | API계약 | DELETE 라우트 Swagger 문서에 `@ApiNotFoundResponse` 누락(404 케이스 미문서화) — pre-existing, 이번 diff 변경 대상 아님 | `webauthn.controller.ts:316-327` | 필수 아님 — 다음 편집 시 추가 고려 |
| 16 | 유저가이드 동기화 | `auth-session-flow-change` 매트릭스 행이 glob상 매칭되나, 레이스는 프런트 UI의 `disabled={pendingDelete}` 가드로 정상 흐름에서 도달 불가하고, 신규 에러 메시지·i18n 키도 없으며, e2e 보강은 이미 diff에 포함됨 — 동반 문서 갱신 불요 | `codebase/frontend/.../passkey-card.tsx:375`, `security-2fa.mdx` | 조치 불요 — 그레이존 후보를 정밀 판단으로 배제 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 감사 중복 해소, `userId` 스코핑 강화, 인젝션 벡터 없음. 401/404 겸용은 pre-existing·이미 트래킹 |
| requirement | NONE | 핵심 로직·엣지케이스·spec 일치 재확인. 유일 관찰(JSDoc 줄 인용)은 현재 정확해 INFO |
| scope | LOW | userId 조건·헬퍼 추출 확장이 근거 있는 부가 강화, CHANGELOG 포맷 혼용은 의도적 |
| side_effect | NONE | 콜백 억제가 의도된 유일한 부작용, 204→404 행동 변화는 breaking 아님 |
| maintainability | NONE | 이전 WARNING(리터럴 중복) 해소 확인, e2e 중복은 기 결정된 후속 PR 범위 |
| testing | NONE | WARNING(공허성 가드 부재) 해소 확인, `findOne null` 분기 미검증은 pre-existing 비차단 |
| documentation | LOW | 이전 WARNING 4건 해소 확인, 신규 WARNING 2건(stale 줄 인용이 소스/자매 plan에 잔존) |
| database | LOW | `affected` 판정 견고, 트랜잭션 부재는 pre-existing + DELETE-INSERT 인터리빙 신규 관찰(비차단) |
| concurrency | LOW | 핵심 수정 견고, WARNING #4(remaining 오판) 반증 재확인, 신규 결함 없음 |
| api_contract | LOW | breaking change 없음, 401/404 겸용·Swagger 누락은 pre-existing |
| user_guide_sync | NONE | glob 매칭 후보 1건을 6가지 근거로 동반 갱신 불요 판정 |

## 발견 없는 에이전트

없음 — 전 11개 reviewer가 최소 1건 이상의 INFO/WARNING을 보고함.

## 권장 조치사항
1. `webauthn.service.ts:512` JSDoc의 `` `verifyAuthentication`(:403) `` 하드코딩 줄 번호를 `` `verifyAuthentication()` `` 로 변경(줄 번호 제거) — WARNING #1.
2. `plan/in-progress/webauthn-dup-delete.md`의 동일 stale 줄 번호 인용에 시점 명시를 추가하거나 `plan/complete/` 이관 시 정정 — WARNING #2(필수 아님).
3. (비차단, 후속 트래커 참고) 향후 `deleteCredential()` 트랜잭션 개선 작업 시 DELETE-DELETE 뿐 아니라 "삭제 진행 중 신규 credential 등록" 인터리빙 시나리오도 포함.
4. (비차단, 기 결정됨) 동시성 e2e 공용 헬퍼(`raceUnderHeldLock()`) 추출 후속 PR에서 매직넘버(`1_500`, `60_000`) 상수화 함께 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(단일 DELETE 조건절/판정 변경)와 낮은 관련성 |
  | architecture | router 판단상 이번 diff 범위와 낮은 관련성 |
  | dependency | 의존성 추가/변경 없음 |
