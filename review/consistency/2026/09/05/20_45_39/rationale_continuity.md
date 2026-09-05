# Rationale 연속성 검토 — sweep-response-contract-5ba0ad (impl-done, scope spec/5-system/)

## 메타

- diff-base: `origin/main` (tip `9a9c024a6`) → `HEAD` (`a4e1e04dc`)
- 코드 diff 실측: `codebase/` 범위 29파일, 1000행 (`git diff origin/main...HEAD --stat -- codebase/`) — prompt 예산 절단으로 본문이 안 보여 워킹트리에서 직접 `git diff` 재확보 후 전문 대조
- spec/5-system/ 자체 델타: 0 (정상 — 이번 PR 은 코드 전용)
- 대조에 사용한 spec 근거: `spec/5-system/2-api-convention.md §5.4`, `spec/5-system/1-auth.md`, `spec/conventions/secret-store.md §1·§1.1`, `spec/1-data-model.md`(Trigger), `spec/2-navigation/2-trigger-list.md`, `spec/5-system/12-webhook.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`

## 발견사항

없음 — target diff 는 기존 Rationale 을 위반하거나 기각된 대안을 되살리는 지점이 없다. 아래는 대조 과정에서 확인한 근거(발견 아님, 참고용).

- **§5.4(부재 표현 `null` vs 키 생략) 준수**: 이번 diff 가 신설한 모든 응답 DTO 필드(`AlertRuleDto.createdBy/lastTriggeredAt`, `IntegrationDto.appUrl/mallId/tokenExpiresAt/lastRotatedAt/lastUsedAt/consecutiveNetworkFailures`, `KnowledgeBaseDto.*` 7필드, `ScheduleDto.trigger`/`ScheduleTriggerRefDto.workflow`, `TriggerDto.chatChannelHealth/chatChannelLastError/chatChannelSetupAt/chatChannelRotatedAt/notificationHealth/notificationLastError/notificationRotatedAt`)를 개별 확인한 결과, "상시 존재 → `@ApiProperty`+`nullable:true`+`T|null`" 과 "키 생략 → `@ApiPropertyOptional()`+`T?`(`|null` 금지)" 두 형태를 전부 정확히 따른다. `IntegrationDto.appUrl` 코드 주석은 첫 판에서 키-생략형으로 잘못 적었다가 신설된 e2e 계약 대조(`assertMatchesContract`)가 그 자리에서 바로 반증해 정정한 이력을 스스로 기록하고 있다 — 검증자가 설계대로 작동한 사례이지 Rationale 위반이 아니다.
- **secret-store.md §1.1("비대상 필드도 응답 바디에는 나가지 않는다") 의 직접 이행**: 이 조항(및 그 앞 `Trigger.notification_secret_v2` 비대상 등재, 결정 2026-09-05)은 이미 `origin/main`(commit `9a9c024a6`)에 병합된 규범이고, 그 등재 자신이 "`GET/POST/PATCH /api/triggers` 와 `GET /api/schedules` 응답에도 이 컬럼이 그대로 실린다 — 이 등재는 그 상태를 승인하지 않는다"고 명시해 두었다. 이번 diff 의 `triggers.service.ts`(`sanitizeForResponse` 확장, `TRIGGER_RESPONSE_STRIP_COLUMNS`)와 `schedules.controller.ts`(`toResponse` 로 조인된 `trigger` 를 참조 수준으로 narrowing)는 정확히 그 유출 두 경로를 닫는다. `select:false` 를 쓰지 않은 이유(회전 스윕이 그 컬럼을 읽어야 하므로 fail-silent 회피)도 secret-store.md §1.1 의 문구("컬럼 수준은... 조용히 오작동하므로 쓰지 않는다")를 그대로 인용한다.
- **§5.4 "검증 층" 표에 이미 문서화된 두 검증자 역할 분리 유지**: diff 가 추가한 `findOptionalNullableResponseFields`(선언↔선언, 정적) 래칫은 `swagger-dto-contract-guard.ts`(정적 검증자) 안에 있고, 값↔선언 축은 건드리지 않는다 — §5.4 검증 층 표의 경계를 그대로 지킨다. 이 래칫 자체를 spec Rationale 에 옮겨 적지 않은 것도 §5.4 자신의 지시("판정 규칙의 상세 표는 코드의 JSDoc 이 단일 진실이다 — 여기 옮겨 적으면 drift 소스가 하나 늘 뿐")를 따른 것이다.
- **기존 debt 래칫(freeze-known-drift) 패턴과의 정합**: 신설된 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78건, 응답 DTO 전수)는 `required:false`+`nullable:true` 금지 조합의 기존 위반을 "빚으로 동결"하는 방식인데, 이는 이미 이 저장소에 있는 선례(`execution-response.dto.spec.ts` 의 `OPTIONAL_NULLABLE_DRIFT`, 그리고 origin/main 에 이미 병합된 `c6dcbacf6 fix(dto): §5.4 drift 배치 — 검증되는 5곳만, 나머지 99곳은 왜 못 가는지 확정`)와 같은 종류의 결정이다. 이번 diff 가 새로 추가한 응답 필드 중 이 금지 조합에 해당하는 것은 없음을 목록 대조로 확인했다(모두 §5.4 준수 형태로 선언됨) — 즉 새 빚을 만들지 않았고, 기존 빚(사전 존재)만 명시적으로 열거해 고정했다.
- **`notificationHealth`/`chatChannelHealth` 등은 신규 결정이 아니라 갭 해소**: `spec/2-navigation/2-trigger-list.md`·`spec/5-system/12-webhook.md`(WH-MG-07/09)가 이미 이 필드들을 트리거 상세 화면에 노출한다고 문서화해 두었다("`chatChannelHealth`/`notificationHealth` 배지"). `TriggerDto` 에 이 필드가 없던 것은 spec-code 갭이었고, 이번 diff 는 그 갭을 닫을 뿐 새 노출 결정을 내리는 것이 아니다.

## 요약

이 PR 은 `spec/5-system/` 문서 자체를 변경하지 않았고(델타 0, 정상), 코드 diff 전문을 워킹트리에서 직접 재확보해 대조한 결과 §5.4(부재 표현 규약)·`conventions/secret-store.md §1.1`(비대상 필드도 응답 노출 금지)·기존 debt-ratchet 관행이라는 세 축의 기존 Rationale/원칙을 모두 준수한다. 오히려 이 diff 는 최근 병합된 두 결정(`9a9c024a6` 의 "notification_secret_v2 노출 금지 규범", `983fd0ade`/`f5d97aa39` 의 §5.4 검증 층 신설)이 아직 안 닫혔다고 스스로 표시해 둔 구체적 유출 지점(트리거 자신·schedule 조인 두 경로)을 정확히 닫는 후속 구현이다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 결정 번복, invariant 우회 중 어느 것도 발견하지 못했다.

## 위험도

NONE
