# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `nextE2eClientIp()` 함수의 모듈 수준 가변 상태(`let clientIpSeq`)
  - 위치: `/codebase/backend/test/helpers/e2e-client-ip.ts` line 956 (diff) / 모듈 최상단
  - 상세: 모듈 레벨 mutable 변수를 사용하는 것은 Jest의 파일별 모듈 격리 덕분에 현재는 안전하지만, 동일 파일 내에서 병렬 테스트 실행 환경으로 이동하거나 `--runInBand` 외 설정을 바꿀 경우 상태가 공유되어 순서 의존성 버그가 생길 수 있다. JSDoc에 이 격리 전제가 명시되어 있어 의도는 명확하나, 상태 공유 리스크를 이해한 독자에게만 안전하다.
  - 제안: 현재 구현은 문서화가 충분하므로 즉각 수정 필요는 없다. 다만 향후 `--isolateModules` 설정 변경 시 재검토 필요. 대안으로 `randomUUID()` 기반 고유 IP(예: 마지막 3옥텟을 UUID 일부에서 파생)를 쓰면 상태 없이도 고유성 보장이 가능하나, 현행 충분함.

- **[INFO]** `.set('x-forwarded-for', nextE2eClientIp())` 패턴이 3개 파일 16곳에 분산 반복
  - 위치: `chat-channel-discord.e2e-spec.ts` (5회), `chat-channel-slack.e2e-spec.ts` (6회), `external-interaction.e2e-spec.ts` (5회)
  - 상세: 헬퍼 함수(`nextE2eClientIp`)로 IP 생성 로직은 단일 진실로 추출되어 있어 핵심 중복은 없다. 그러나 `.set('x-forwarded-for', nextE2eClientIp())` 호출 자체가 각 요청에 개별적으로 산재한다. 공개 webhook POST를 래핑하는 헬퍼(예: `postPublicHook(url, body, headers?)`)를 두면 향후 정책 변경(예: 헤더 이름 변경, 추가 헤더 요구) 시 단일 지점에서만 수정 가능하다.
  - 제안: 현재는 단순·명시적 패턴이라 INFO 수준으로 유지. 공개 hook 요청이 더 많은 파일로 확산되면 래퍼 헬퍼 도입을 고려.

- **[INFO]** `external-interaction.e2e-spec.ts`의 `createTriggerWithInteraction` 함수 길이 및 복잡도
  - 위치: `/codebase/backend/test/external-interaction.e2e-spec.ts` lines 633-720
  - 상세: 본 변경의 범위 밖이지만 기존 코드로, 이 함수는 약 90줄이며 workspace·user·workspace-retry·workflow·node·trigger 등 6개의 DB INSERT를 순차적으로 수행한다. 단일 함수가 여러 엔티티 생성을 담당해 함수 길이가 길고 가독성이 다소 낮다. 또한 첫 번째 workspace INSERT 실패를 `.catch(() => {})` 로 무시하고 두 번째 삽입에서 FK 만족 후 재시도하는 패턴이 암묵적이다.
  - 제안: 이번 변경과 무관하므로 지적만 기록. 향후 리팩토링 시 `createTestUser`, `createTestWorkspace`, `createTestWorkflow` 등으로 분리 검토.

- **[INFO]** `e2e-client-ip.ts` JSDoc의 `spec/7-channel-web-chat/4-security.md §4·R6` 참조
  - 위치: `/codebase/backend/test/helpers/e2e-client-ip.ts` line 953 (diff 기준)
  - 상세: 정책 SoT로 `spec/7-channel-web-chat/4-security.md`를 가리키고 있으나, 본 헬퍼는 chat-channel e2e 외에도 `external-interaction.e2e-spec.ts`에 사용된다. chat-web-chat spec만 SoT로 참조하면 external-interaction 담당자가 스펙 연결을 놓칠 수 있다.
  - 제안: JSDoc에 `PublicWebhookThrottleGuard` 구현 파일(`src/modules/hooks/public-webhook-quota.service.ts`)을 공통 SoT로 표기하는 것은 이미 되어 있으므로 현실적 문제 없음. 심각도 낮음.

## 요약

이번 변경은 공개 webhook e2e 요청의 rate-limit 버킷 분리를 위해 단순하고 명확한 방식을 선택했다. 핵심 헬퍼(`e2e-client-ip.ts`)는 34줄로 간결하고, JSDoc이 배경·사용법·IP 대역·격리 전제를 모두 설명하며, 각 e2e 파일의 변경은 단일 패턴(`nextE2eClientIp()`)의 기계적 삽입으로 일관성 있게 적용되어 있다. 함수 길이, 중첩 깊이, 네이밍 모두 기존 코드베이스 관례를 준수한다. 유일한 유지보수 관점의 유의사항은 모듈 레벨 카운터 상태와 공개 hook 요청 래퍼 부재이나, 현재 규모와 문서화 수준에서는 모두 INFO 수준이다.

## 위험도

NONE
