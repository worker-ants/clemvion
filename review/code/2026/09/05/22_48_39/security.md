# 보안(Security) 리뷰

## 컨텍스트

이 diff(`origin/main...HEAD`, 25개 실 코드/테스트 파일 + CHANGELOG + plan + 다수의 과거
리뷰 산출물)는 §5.4 응답-계약 검증자 배선을 4→18개 DTO 로 넓히는 작업 중 실측으로 발견된
**트리거 회전 secret 유출 결함의 수정**이 핵심이다. 아래는 실제 소스 변경분
(`codebase/backend/src/modules/{triggers,schedules,alerts,integrations,knowledge-base}/**`,
`codebase/backend/src/shared/testing/response-contract.ts`,
`codebase/backend/src/repo-guards/__tests__/**`, 각 e2e/unit 스펙)을 중심으로 분석했다.
`review/**` 하위 파일들은 이전 리뷰 라운드의 산출물(RESOLUTION/SUMMARY 등)이라 그 자체는
신규 코드가 아니므로 별도 발견사항으로 다루지 않았다.

## 발견사항

- **[INFO]** (긍정 확인) 트리거 회전 secret 2차 유출 경로(엔티티 컬럼 직접 노출 + 조인을
  통한 전이 유출)가 이번 diff 로 실제로 막혔음을 코드 레벨에서 확인했다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (`sanitizeForResponse`,
    `TRIGGER_RESPONSE_STRIP_COLUMNS`/`NOTIFICATION_SIGNING_STRIP_KEYS`/
    `INTERACTION_RESPONSE_STRIP_KEYS` 상수 및 그 사용부), `codebase/backend/src/modules/schedules/schedules.controller.ts`
    (`toResponse` private 헬퍼).
  - 상세: `sanitizeForResponse`(구 `sanitizeChatChannelForResponse`)는 (1) `config.chatChannel`
    JSONB 내부 키, (2) `config.notification.signing` 내부 키(`secret`/`secretRef`),
    (3) `config.interaction.triggerToken`, (4) `trigger` 행 자체의 회전 컬럼
    (`notificationSecretV2`, `chatChannelTokenV2`) 네 자리를 모두 정화한다. 종전에는
    `config.chatChannel` 이 없으면 **조기 return** 해 나머지 세 자리가 전혀 정화되지
    않았는데, 이번 diff 가 그 조기 return 을 제거하고 4개 자리 각각을 독립적으로 처리한다.
    삭제는 `Object.assign` 으로 만든 **새 객체(`sanitized`)** 위에서 `delete` 로 수행되므로
    원본 엔티티(`trigger` 파라미터)는 변형되지 않는다 — DB 저장 경로에 부작용이 없다.
    `SchedulesController.toResponse` 는 `leftJoinAndSelect`/`relations`로 통째로 로드되는
    `Trigger` 엔티티를 응답 직전(컨트롤러 경계)에서 `{id, name, workflowId, workflow?}` 4필드로
    좁힌다 — 서비스 계층에서 좁히지 않은 이유(내부 로직이 `trigger.isActive` 등 다른 필드를
    계속 소비하기 때문)도 주석에 근거가 명시돼 있어 판단이 추적 가능하다. `TriggersService.findAll`
    의 목록 매핑(`sanitizeForResponse` 배열 map 경로)과 `findOneDetail`/`create`/`update`
    네 경로 모두 이 함수를 거치도록 배선돼 있음을 직접 확인했고, `rotateNotificationSecret`
    처럼 이번 diff 밖에서 트리거 엔티티를 거치지 않고 신규 secret 을 1회성으로 직접 반환하는
    기존 경로는 이 스트립 대상이 아니어도 되는 것이 코드·주석상 타당하다(발급 응답 1회 노출은
    설계 의도).
  - 제안: (조치 불요, 확인 기록) — 향후 트리거/스케줄에 새 비밀 필드가 추가될 때, 이번 커밋
    자신이 세 번 반복해서 지적한 것처럼 "deny-list 나열형 방어는 축이 늘어날 때마다 또 좁게
    틀릴 위험"이 있다는 점을 유의할 것 (코드 내 JSDoc 이 이미 "네 번째 재발 시 `@Sensitive()`류
    선언적 SoT로 전환"을 명시해 뒀다).

- **[INFO]** 테스트 픽스처에 등장하는 시크릿류 문자열(`wsk_should_not_leak`,
  `wsk_live_secret`, `itk_should_not_leak`, `plaintext-should-be-stripped`,
  `secret://triggers/trg-1/bot-token.v2` 등)은 전부 스트립 로직을 검증하기 위한 명백한
  테스트용 더미 값이며, 실제 자격 증명이나 하드코딩된 운영 시크릿이 아니다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.spec.ts` (`scheduleWithSecretTrigger`),
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`notificationSecretV2`/
    `chatChannelTokenV2`/`triggerToken`/`signing.secret` 픽스처).
  - 상세: 이름 자체가 "should_not_leak"이고, `git diff` 전수(패턴: AKIA/`sk-`/PEM 헤더/
    하드코딩된 `password:` 리터럴)를 스캔해도 실 시크릿 형태의 매치는 없었다.
  - 제안: 조치 불요.

- **[INFO]** DTO 선언 보정으로 새로 노출을 "선언"하게 된 필드들(`IntegrationDto.appUrl/
  mallId/tokenExpiresAt/lastRotatedAt/lastUsedAt/consecutiveNetworkFailures`,
  `KnowledgeBaseDto.*`, `AlertRuleDto.createdBy/lastTriggeredAt`,
  `TriggerDto.chatChannelHealth/chatChannelLastError/.../notificationLastError/...`)는
  전부 **이미 wire 로 나가고 있던** 값을 DTO 선언에만 반영한 것이라 새로운 노출을 만들지
  않는다. `IntegrationDto.credentials` 필드 자체는 이번 diff 로 변경되지 않았고 클래스
  JSDoc("credentials 필드는 마스킹된 상태로 반환됩니다")도 그대로다 — 실제 자격 증명 원문이
  이번 변경으로 노출 표면에 추가되지는 않았다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`,
    `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts`,
    `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts`,
    `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts`.
  - 상세: `chatChannelLastError`/`notificationLastError` 는 "향후 adapter 가 원문 에러
    payload 를 그대로 담게 되면 잠재적 정보 노출 경로가 될 수 있다"는 점이 이미 이전 리뷰
    라운드에서 INFO 로 지적·유예되어 있다(현재 구현은 사람이 작성한 요약 메시지만 담는 것으로
    보이며, 이번 diff 는 그 필드의 *존재*를 선언했을 뿐 저장/생성 로직을 바꾸지 않았다).
  - 제안: 신규 지적 아님 — 기존 유예 사유 유지. 다음에 이 필드에 원문 에러를 담는 adapter
    변경이 들어갈 때 크기/내용 제한 불변식을 함께 검토할 것을 권고(이미 문서화된 권고).

- **[INFO]** `response-contract.ts` 의 신규 `allowMissing` 옵션은 문자열 배열을 받아
  `Set` 으로 비교만 하고, 정규식·경로 순회에 사용자 입력이 개입하지 않는다 — 인젝션·ReDoS
  경로 없음. `contractForDto` 의 신규 모듈 레벨 캐시(`Map<Type, Promise<DtoContract>>`)는
  테스트 전용 헬퍼(`src/shared/testing/`)이고 프로덕션 요청 경로에 배선되지 않으므로 DoS/캐시
  포이즈닝 표면이 아니다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts`.
  - 제안: 조치 불요.

- **[INFO]** `swagger-dto-contract-guard.ts` 의 신규 `findOptionalNullableResponseFields`
  / `isResponseDtoFile` 은 정적 분석용 TS AST 순회이며, 대상은 저장소 내 `src/modules/**`
  응답 DTO 파일로 한정(`isResponseDtoFile` 이 `/dto/responses/` 경로만 통과)되고 외부 입력이나
  사용자 제어 경로를 다루지 않는다. 경로 탐색·인젝션 표면 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`.
  - 제안: 조치 불요.

## 요약

핵심 변경은 트리거의 회전형 비밀(평문 서명 secret `notificationSecretV2`, secret-store
참조 `chatChannelTokenV2`, per-trigger bearer 토큰 `triggerToken`)이 (1) 조기 return 으로
정화를 건너뛰는 경로, (2) `GET /api/schedules` 의 트리거 조인을 통한 2차 유출 경로로 각각
새고 있던 것을 응답 경계(서비스의 `sanitizeForResponse`, 컨트롤러의 `toResponse`)에서
막은 보안 수정이다. 스트립 로직은 원본 엔티티를 변형하지 않고 새 객체 위에서 필드를
삭제하며, 목록·상세·생성·수정 네 경로 전부와 스케줄의 조인 경로까지 unit+e2e 양쪽에서
"비밀 값이 실제로 채워진 fixture"로 회귀 테스트가 걸려 있어 되돌림 뮤테이션에 대한 검출력이
확인된 상태다(이전 리뷰 라운드들의 RESOLUTION.md 가 뮤턴트 RED 를 반복 실측했다). 새로
DTO 에 선언된 필드들은 이미 wire 로 나가고 있던 값을 문서화한 것뿐이라 신규 노출 표면을
만들지 않고, 진짜 자격 증명(`credentials`)은 여전히 마스킹된 채로 나간다. 테스트 픽스처의
시크릿류 문자열은 전부 스트립 검증용 더미이며 실제 하드코딩된 자격 증명은 발견되지 않았다.
인젝션·인증/인가 우회·안전하지 않은 암호화·에러 메시지를 통한 민감정보 노출 등 다른 OWASP
축에서는 이번 diff 범위 내 새로운 결함을 발견하지 못했다. 남아 있는 것은 전부 이전 라운드에서
이미 등재·유예된 INFO 성격 관찰(`*LastError` 필드의 미래 확장 시 페이로드 노출 가능성,
deny-list 나열형 스트립의 구조적 한계)뿐이며 이번 diff 가 새로 만든 위험은 아니다.

## 위험도

NONE
