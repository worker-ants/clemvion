# 보안(Security) 리뷰

## 검토 방법

이 diff 는 §5.4 응답-계약 검증자 배선 확대(4→18 DTO) + 트리거 회전 secret 유출 수정 +
5개 DTO 24필드 선언 보정으로 구성된다. 프롬프트에 diff 가 생략된 핵심 프로덕션 파일
(`schedules.controller.ts`, `triggers.service.ts` 의 `sanitizeForResponse` 전체 본문,
`response-contract.ts` 전체)은 워킹트리에서 `Read`/`Grep` 으로 직접 열어 현재 상태를
확인했다 — 저장소에 쓰기는 하지 않았다(`git status --short` 로 무변경 확인).

## 발견사항

- **[INFO]** 비밀 컬럼 방어가 **deny-list(제외 목록) 3벌**로 늘어난 구조이고, 같은 PR 의
  리뷰 이력 안에서 이미 두 차례 "지적받은 자리만 고치고 형제를 두는" 형태로 재발했다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`(53행) · `NOTIFICATION_SIGNING_STRIP_KEYS`(74행) · `TRIGGER_RESPONSE_STRIP_COLUMNS`(94행), 적용부 `sanitizeForResponse`(585-656행).
  - 상세: 현재 코드를 직접 읽어 확인한 바, 세 목록 모두 정확하고(`notificationSecretV2`·`chatChannelTokenV2`는 `delete`로 완전히 키 자체를 제거, `config.notification.signing.secret`/`secretRef`, `config.chatChannel.botTokenRef`/`inboundSigningRef` 등도 스트립됨), 응답 경로 4곳(`findAll`/`findOneDetail`/`create`/`update`) 전부가 이 함수를 거치는 것도 직접 추적해 확인했다. 다만 이 방어는 "새 비밀 필드가 생기면 개발자가 목록에 추가해야 한다"는 **fail-open 성격의 deny-list**다. 실제로 이 PR 자신의 리뷰 라운드 기록(`review/code/2026/09/05/18_23_02` W1)에 따르면 `notification.signing.secretRef`가 처음엔 목록에서 빠져 있었고, 그 전에는 `config.chatChannel`이 없으면 조기 return 하여 정화 자체가 스킵되는 구조적 결함도 있었다(둘 다 이번 diff에서 이미 수정 완료된 상태로 확인됨). 즉 같은 방어 패턴에서 근접 실패가 반복된 이력이 있고, 다음에 새 비밀 컬럼/키가 추가될 때 이 목록에 반영을 잊으면 조용히 다시 새어 나간다.
  - 제안: 팀이 이미 JSDoc에 "네 번째 재발 시 `@Sensitive()` 류로 SoT를 엔티티 데코레이터로 이전"이라는 조건부 계획을 남겨 두었다(`triggers.service.ts` 인접 주석 참조) — 현재 코드 상태로는 즉시 차단할 사안은 아니나, 다음에 `Trigger`/`Schedule`류 엔티티에 새 비밀 컬럼이 추가될 때 이 deny-list 갱신을 강제하는 자동 장치(예: 엔티티 컬럼 전수 대조 정적 가드, 또는 `@Sensitive()` 데코레이터로 선언적 allow-list 전환)를 앞당겨 검토할 것을 권한다.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures`(내부 health 카운터, FE 소비 0곳)가 이번 diff 로 공개 API 응답에 정식 선언됐다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:160-161` (`@ApiProperty({ example: 0 }) consecutiveNetworkFailures: number;`)
  - 상세: 시크릿은 아니고 민감도가 낮은 운영 카운터이나, 원래는 컨트롤러가 엔티티를 그대로 반환해 "선언 없이 이미 나가고 있던" 값이었다(§5.4 스윕 취지 = 문서를 wire 에 맞춤). PR 자신의 주석과 plan 트래커가 "제거가 나은 후보이나 wire 변경이라 별도 항목으로 미룬다"고 명시적으로 인정하고 있어 은닉된 확장은 아니다. 공격자 관점에서 워크스페이스 멤버 권한 범위 안의 정보 노출이라 위험도는 낮다.
  - 제안: 조치 불요 — 이미 별도 백로그 항목(plan 트래커)으로 추적 중.

- **[INFO]** 테스트 fixture 에 등장하는 `wsk_should_not_leak` · `wsk_live_secret` · `secret://triggers/.../bot-token.v2` · `plaintext-should-be-stripped` 등은 하드코딩된 실제 시크릿이 아니라 회귀 테스트용으로 의도적으로 채운 가짜 값이다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:203-214`, `codebase/backend/src/modules/schedules/schedules.controller.spec.ts:31-32`.
  - 상세: 값 자체가 "should_not_leak"/"live_secret" 등으로 명명돼 테스트 목적이 명확하고, 실제 자격증명 패턴(API 키 형식 등)과 다르다. 이 값들이 프로덕션 설정이나 `.env` 류로 흘러들어갈 경로도 없다.
  - 제안: 조치 불요.

- **[INFO]** `src/shared/testing/response-contract.ts` 의 신규 `allowMissing` 옵션은 required 필드가 응답에 없어도 계약 위반으로 보지 않게 하는 test-only 헬퍼다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:95-113`(옵션 정의), `:247-248`(적용부), 유일한 실사용처 `codebase/backend/test/workflow-crud.e2e-spec.ts:436-440`(`ExportWorkflowDto.formatVersion` 1건, spec Planned 갭 인용과 함께).
  - 상세: `src/shared/testing/` 경로이고 e2e/unit 테스트에서만 import 되므로 런타임(프로덕션 응답 경로)에는 영향이 없다 — 보안 게이트를 우회하는 프로덕션 코드가 아니라 테스트 단언의 완화 옵션이다. JSDoc 이 "더 좁게 쓸 것", "정당한 용례는 spec 에 이미 Planned 로 적힌 갭뿐"이라고 오용을 명시적으로 경계하고 있고, 실사용도 그 가이드대로 근거 주석과 함께 1건뿐이다.
  - 제안: 조치 불요 — 향후 이 옵션이 늘어날 때 각 사용처에 spec 근거 주석이 동반되는지 계속 확인할 것.

## 확인한 항목 (문제 없음)

- 트리거 회전 secret(`notificationSecretV2` 평문 서명 secret, `chatChannelTokenV2` secret store ref)이 나가던 두 경로 — (1) `GET/POST/PATCH /api/triggers` (`sanitizeForResponse`), (2) `GET/POST/PATCH /api/schedules` 의 조인된 `trigger` (`SchedulesController.toResponse`) — 모두 현재 소스에서 직접 확인했고, 스트립은 `undefined` 대입이 아니라 `delete` 로 키 자체를 제거해 중간 소비자(직렬화 우회 등)에도 안전하다.
- `SchedulesService.create/update` 는 내부적으로 트리거 엔티티 전체(비밀 포함)를 `saved.trigger` 에 담아 서비스 경계를 넘지만, 이 서비스 메서드의 유일한 호출자는 컨트롤러이고 컨트롤러의 4개 핸들러(`findAll`/`findOne`/`create`/`update`) 전부가 `toResponse()` 를 거쳐 참조 필드로 좁힌 뒤 반환한다 — grep 으로 다른 호출자가 없음을 확인.
- `TriggersService` 의 응답 4경로(`findAll`/`findOneDetail`/`create`/`update`) 전부 `sanitizeForResponse` 를 거치며, `findById`(내부 헬퍼, 비-정화 상태로 트리거 반환)는 컨트롤러에 직접 노출되지 않고 `findOneDetail`/`update` 내부에서만 쓰인다.
- CHANGELOG 는 실제 시크릿 값이 아니라 유출 경위·영향·권고(로그/APM/캐시 점검, secret 회전 권고)만 서술 — 정보 노출 없음.
- §5.4 신규 정적 가드(`swagger-dto-contract-guard.ts` 의 `findOptionalNullableResponseFields`)와 관련 테스트는 `src/repo-guards/__tests__/` 아래의 개발 시점 정적 분석 도구로, 런타임 경로에 영향이 없다.

## 요약

이 PR 은 새 취약점을 도입하는 변경이 아니라, 트리거 회전 secret(평문 서명 secret + secret store ref)이 두 경로(트리거 자신의 응답, 스케줄 응답의 조인된 트리거)로 새어 나가던 실제 정보 노출 결함을 고치는 보안 수정이다. 프롬프트에 diff 가 생략된 핵심 파일(`schedules.controller.ts`, `triggers.service.ts`, `response-contract.ts`)을 직접 열어 확인한 결과, 비밀 컬럼은 응답 경계 4+4곳 전부에서 `delete` 기반으로 제거되고 있고 우회 경로도 발견되지 않았다. 유일하게 짚을 구조적 관찰은 이 방어가 여전히 수기 deny-list 3벌에 의존하며 같은 PR 의 리뷰 이력 안에서 근접 실패가 반복됐다는 점(팀이 이미 조건부 승격 계획을 문서화해 둠)과, 내부 카운터 필드 하나가 낮은 민감도로 신규 노출됐다는 점 — 둘 다 차단 사유는 아닌 INFO 수준이다. 하드코딩된 실제 시크릿, 인젝션, 인증/인가 우회, 안전하지 않은 암호화 사용은 발견되지 않았다.

## 위험도

LOW
