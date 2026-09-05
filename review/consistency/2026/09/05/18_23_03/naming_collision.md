# 신규 식별자 충돌 검토

## 범위와 방법

- `--impl-done` 모드. scope `spec/5-system/`의 spec 텍스트 델타는 **0개 파일**(정상 — 이 브랜치는 spec 을 바꾸지 않았다).
- 실제 신규 식별자는 구현 diff(`origin/main...HEAD`, 25개 파일 / 594줄)에서 나온다. HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)에서 `git diff`/`git log`/`git status`를 직접 실행해 새로 도입된 식별자를 추출하고, 각각을 기존 코드베이스 전수 grep 으로 대조했다.
- 이 커밋(`dfb2664af`)은 `spec/5-system/2-api-convention.md §5.4` 검증 층(`response-contract.ts` / `swagger-dto-contract-guard.ts`, #1288·#1289 기완료)이 잡아낸 drift를 메우는 "스윕 1차"다 — 신규 API·신규 spec ID·신규 이벤트를 도입하는 작업이 아니라 기존 DTO 선언을 실제 wire 에 맞추는 정정 위주다.

## 발견사항

새 요구사항 ID, 새 API endpoint(method+path), 새 webhook/queue/SSE 이벤트명, 새 환경변수·config key, 새 spec 파일 경로 — 이 다섯 축에서는 **신규 식별자 자체가 없다**(diff 전수 확인: `@Get/@Post/@Patch/@Delete` 신규 라우트 0건, `process.env.*` 신규 참조 0건, spec 파일 추가/이름변경 0건).

아래는 diff 가 실제로 도입한 신규 식별자(타입/필드/함수명)를 기존 사용처와 대조한 결과다. 전부 **충돌 없음**으로 판정했으나 근거를 남긴다.

- **[INFO]** `ContractCheckOptions.allowMissing` 신설 — 기존 `allowUndeclared`와 이름 대칭(거울상)으로 설계됐고, `response-contract.spec.ts`에 "두 축은 갈려 있다"는 전용 테스트(`allowMissing 은 undeclared 를 면제하지 않는다`)까지 있어 혼동 방지 장치가 이미 코드에 내장돼 있다. 기존 사용처와 이름이 겹치지 않으므로 충돌 없음.
- **[INFO]** `TriggersService.sanitizeChatChannelForResponse` → `sanitizeForResponse`로 개명, `SchedulesController.toResponse` 신설 — 코드베이스 전체를 grep 했을 때 `sanitizeForResponse`는 유일한 정의처이고, `toResponse`는 `ExecutionsService.toResponseExecution`(별도 클래스, 별도 이름)과 문자열이 다르므로 정확한 이름 충돌은 아니다. 둘 다 `private` 메서드라 클래스 경계 밖에서 이름이 부딪힐 일도 없다. 다만 "응답 경계에서 엔티티를 얕게 변환한다"는 동일 패턴을 서로 다른 이름(`sanitizeForResponse` / `toResponse` / `toResponseExecution`)으로 반복하고 있어, 다음에 같은 패턴을 또 추가할 사람이 명명을 고를 때 참고할 컨벤션 문서는 없다 — 충돌은 아니지만 명명 일관성 관점의 개선 여지.
- **[INFO]** `TRIGGER_RESPONSE_STRIP_COLUMNS` 신설(엔티티 컬럼 스트립 목록) — 기존 `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`(JSONB 내부 키 스트립 목록)와 이름·역할이 명확히 분리돼 있고 JSDoc 이 "같은 등급의 비밀이 두 곳에 산다"고 관계를 명시한다. 충돌 없음.
- **[INFO]** 신규 DTO 필드 (`IntegrationDto.appUrl/mallId/tokenExpiresAt/lastRotatedAt/lastUsedAt/consecutiveNetworkFailures`, `KnowledgeBaseDto.documentCount/embeddingModelConfigId/rerankMode/rerankCandidateK/rerankScoreThreshold/rerankConfigId/rerankLlmConfigId`, `AlertRuleDto.createdBy/lastTriggeredAt`, `TriggerDto`의 `chatChannelHealth/chatChannelLastError/chatChannelSetupAt/chatChannelRotatedAt/notificationHealth/notificationLastError/notificationRotatedAt`) — 전수 grep 결과 모두 대응 엔티티 컬럼명과 **정확히 일치**하고 의미도 동일하다(예: `createdBy`는 `integration`·`workflow`·`workflow-version` 엔티티에서 이미 "생성자 user id"로 쓰이는 것과 동일 의미). 새 의미로 기존 식별자를 재사용한 사례 없음.
- **[INFO]** 신규 DTO 클래스 `ScheduleTriggerRefDto`, `ScheduleTriggerWorkflowRefDto` — 코드베이스 전체에 `*RefDto` 명명 패턴이 이전에 없었다(최초 도입). 기존 정의와의 충돌 없음. `ScheduleDto.trigger` 필드도 다른 응답 DTO에 동명 필드가 없어 형태 충돌 없음.
- **[INFO]** `contractForDto`는 기존 함수를 캐싱 래퍼로 감싸고 내부에 `buildContractForDto`(신규, 비공개)를 분리했다 — 공개 API 시그니처(`contractForDto(Dto)`)는 그대로라 호출부 영향 없고, 신규 비공개 함수명도 grep 상 유일.

## 요약

이 PR 은 새 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·spec 파일 경로를 하나도 추가하지 않는다 — `spec/5-system/2-api-convention.md §5.4` 응답-계약 검증자가 검출한 undeclared 필드/보안 유출을 기존 DTO에 선언으로 반영하고 sanitizer 를 넓히는 정정 성격의 커밋이다. 새로 도입된 코드 식별자(옵션 플래그·private 헬퍼·DTO 필드·DTO 클래스)를 전수 대조한 결과 기존 사용처와 의미가 어긋나는 재사용은 없었다 — 신규 DTO 필드는 예외 없이 대응 엔티티 컬럼과 이름·의미가 일치했고, 신규 클래스·상수·private 메서드명도 기존 정의와 겹치지 않았다. 유일하게 남는 것은 "응답 경계 변환" 패턴이 서비스마다 다른 이름(`sanitizeForResponse`/`toResponse`/`toResponseExecution`)으로 반복된다는 명명 일관성 관찰이며, 이는 충돌이 아니라 향후 컨벤션화를 고려해볼 만한 INFO 수준 제안이다.

## 위험도
NONE
