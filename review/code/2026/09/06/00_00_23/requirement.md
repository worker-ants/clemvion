# 요구사항(Requirement) 리뷰

검토 범위: `9a9c024a6..HEAD` (`claude/sweep-response-contract-5ba0ad`) — §5.4 응답-계약 검증자
배선을 4→18개 DTO 로 넓히는 스윕, 트리거 회전 secret 유출 수정(엔티티 컬럼 + 스케줄 조인 2차
유출), 5개 DTO 24개 필드 선언 보정, §5.4 금지 조합(`required:false`+`nullable:true`) 래칫 신설.
이 브랜치는 이미 6~7 라운드의 자체 코드/consistency 리뷰를 거쳤고(`review/code/2026/09/05/*`),
지적된 Critical/Warning 은 후속 커밋으로 대부분 조치돼 있다. 아래는 그 라운드들이 잡지 못한
새 발견사항이다.

## 발견사항

- **[WARNING]** `IntegrationDto.appUrl` 의 새 필드 설명(공개 OpenAPI description + 내부 주석)이
  "cafe24 Private 전용" 이라고 잘못 서술한다 — 실제로는 MakeShop ShopStore 설치 통합도 이
  필드를 채운다. spec 은 이미 두 경우를 모두 정확히 문서화하고 있어, spec 이 아니라 이번에
  새로 쓴 코드측 설명이 낡은/틀린 쪽이다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:126-135`
    (내부 `//` 주석 126-128번째 줄 `"cafe24 Private 이 아니면 null 이 실린다"`, 공개 JSDoc
    133번째 줄 `/** cafe24 Private 앱의 관리자 URL — 그 외에는 \`null\` */`).
  - 상세: `IntegrationsService`(`codebase/backend/src/modules/integrations/integrations.service.ts`)
    의 `INTEGRATION_DERIVED_REGISTRY` 는 `cafe24`(private + installToken 존재 시)뿐 아니라
    `makeshop`(installToken 존재 시, `appType` 무관)도 `buildMakeshopInstallUrl` 로 non-null
    `appUrl` 을 만든다(263-303행, 특히 290-303행 makeshop 분기). `toPublic()`(1377-1436행)이
    이 값을 그대로 `appUrl` 로 내보낸다. spec 도 이를 정확히 문서화한다 —
    `spec/2-navigation/4-integration.md:795` (`GET /api/integrations/:id` 행): *"`appUrl` —
    Cafe24 Private 통합은 …, **MakeShop ShopStore 설치 통합**은 동일 패턴의 …, 그 외 통합은
    `null`"*. 즉 이번에 새로 추가된 DTO 필드 설명(내부 주석·공개 JSDoc 둘 다)이 spec·구현
    양쪽과 다르게 "cafe24 Private 전용" 으로 축소 서술한다. 이 JSDoc 은 같은 PR 이 다른 파일
    (`schedule-response.dto.ts`·`trigger-response.dto.ts`)에서 스스로 명시한 관례대로
    `introspectComments` 를 통해 **공개 OpenAPI description** 이 된다 — 즉 이 잘못된 설명이
    Swagger 문서에 그대로 노출돼, makeshop 통합 연동 개발자가 "appUrl 은 cafe24 전용이니 항상
    null 이겠거니" 하고 오판할 수 있다. `assertMatchesContract` 는 구조(required/nullable)만
    보고 description 텍스트는 검증하지 않으므로 자동 테스트로는 잡히지 않는 종류의 결함이다.
  - 제안: 공개 JSDoc 을 `/** cafe24 Private / MakeShop ShopStore 설치 통합의 관리자 URL —
    그 외에는 \`null\` */` 등으로 정정하고, 126-128행 내부 주석의 "cafe24 Private 이 아니면"
    도 같이 고친다. spec 은 이미 옳으므로 spec 변경은 불필요 — 코드측 설명만 spec 에 맞춘다.

- **[INFO]** 위 항목을 제외하면, 이번 diff 범위의 DTO 필드 추가(§5.4 기본형/키생략형 선택,
  nullable 여부) 전부를 대응 엔티티 컬럼(`AlertRule`·`Integration`·`KnowledgeBase`·`Trigger`)
  및 서비스 로직(`IntegrationsService.toPublic`)과 대조했고, `appUrl` 을 제외한 23개 필드는
  엔티티/서비스의 실제 nullable 여부·존재 조건과 일치했다. `TriggerDto.workflow?`/
  `ScheduleTriggerRefDto.workflow?` 의 "생성 응답에만 없다" 주석도 `TriggersService.create()`
  (workflow relation 미로드)·`findById()`(`relations: ['workflow']`)·
  `SchedulesService.create()`/`findAll()`/`findById()`/`update()` 실제 호출부와 대조해 정확함을
  확인했다.
  - 위치: (교차 확인, 단일 라인 아님) — 조치 불요, 참고용 기록.

- **[INFO]** `secret-store.md §1.1`·`2-api-convention.md §5.4`·`1-data-model.md §2.9.1` 등
  코드 주석이 인용하는 spec 절들을 전부 열어 문구를 대조했다 — `TRIGGER_RESPONSE_STRIP_COLUMNS`·
  `INTERACTION_RESPONSE_STRIP_KEYS`·`ScheduleDto.trigger` 상시 존재 근거·§5.4 기본형/키생략형
  선택 기준 서술이 spec 본문과 line-level 로 일치한다. `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열
  길이(78)·`plan/in-progress/spec-draft-nullable-notation-followups.md` 의 정량 서술도 실측과
  일치함을 확인했다.
  - 위치: (교차 확인) — 조치 불요.

## 요약

핵심 로직(`TriggersService.sanitizeForResponse` 의 4-축 비밀 스트립, `SchedulesController.toResponse`
의 트리거 참조 좁히기, `SchedulesService.create/update` 의 `isActive` 무관 trigger 대입,
`response-contract.ts` 의 `allowMissing`/캐싱, `swagger-dto-contract-guard.ts` 의 §5.4 금지 조합
래칫)는 기능적으로 완전하고, 관련 unit/e2e 가 각 분기(활성/비활성, 생성/조회/수정, 목록/단건,
chat-channel/non-chat-channel)를 실제 뮤턴트 검증과 함께 덮는다. 신규 선언 24개 필드는 `appUrl`
하나를 제외하면 엔티티 nullable 여부·spec 문서와 정확히 일치한다. 발견된 유일한 실질 결함은
`IntegrationDto.appUrl` 의 새 필드 설명이 makeshop 케이스를 누락한 채 "cafe24 Private 전용"으로
잘못 서술한 것 — spec(`4-integration.md:795`)은 이미 정확하므로 코드측 설명만 정정하면 된다.
기능·wire 형식에는 영향 없는 문서 정확성 결함이다.

## 위험도

LOW
