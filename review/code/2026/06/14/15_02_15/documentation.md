# 문서화(Documentation) 리뷰

## 발견사항

### 1. **[INFO]** `getUsage` 공개 메서드에 JSDoc 독스트링 없음
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — `getUsage()` 메서드 선언부
- 상세: 동일 파일의 `recordAudit` private 메서드는 JSDoc(`/** ... */`)을 갖추고 있으나, `getUsage` 는 공개 메서드임에도 반환 shape(`totalCalls`, `lastUsedAt`, `periodCounts`, `recentCalls[]`)과 side-effect 설명이 없다. `periodCounts` 필드가 새로 추가되면서 반환 계약이 바뀌었으므로 독스트링 부재가 더 두드러진다.
- 제안: `getUsage(id, workspaceId)` 메서드 위에 `/** §A.3 ... */` 형식의 JSDoc 추가(반환 shape, 롤링 윈도 3종, NULL 폴백 동작 요약).

### 2. **[INFO]** `ExecuteOptions` 타입 변경에 JSDoc 없음
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `ExecuteOptions` union의 `triggerId` variant (라인 558 부근)
- 상세: `sourceIp?` / `responseCode?` 두 필드가 인라인 주석(`//`)으로만 설명된다. 해당 타입은 `execute()` 의 공개 인터페이스이므로, 선택적 필드의 의미(NULL 영속 조건, optional임을 명시)를 JSDoc `/** ... */` 로 격상하면 IDE 호버 지원이 된다. 현재 인라인 주석은 충분한 내용을 담고 있어 심각도는 낮다.
- 제안: `sourceIp?` / `responseCode?` 각각에 `/** webhook/chat-channel 발화 시만 전달. 미전달 시 NULL 영속. */` 수준의 JSDoc 필드 주석 추가.

### 3. **[INFO]** `WEBHOOK_ACCEPTED_RESPONSE_CODE` 상수 문서화는 양호 — 참고 사항
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` (라인 44 부근)
- 상세: 새로 추가된 상수에 블록 JSDoc(`/** ... */`)이 작성되어 있으며, 성공 경로만 Execution row 에 남는 이유(인증 실패 시 row 미생성)까지 설명한다. 문서화가 잘 되어 있다. 단, 이 상수가 모듈 외부로 export 되지 않음에도 JSDoc 스타일을 적용한 것은 관례 불일치가 아니며 허용 범위 내.

### 4. **[INFO]** `AuthConfigUsagePeriodCountsDto` 클래스에 필드 설명 누락
- 위치: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` — `AuthConfigUsagePeriodCountsDto` 클래스
- 상세: 클래스 수준 JSDoc(`/** §A.3 기간별 호출 수 — 롤링 윈도(24h/7d/30d) 호출 건수 */`)은 있으나, 각 필드(`last24h`, `last7d`, `last30d`)의 `@ApiProperty` 에 `description` 파라미터가 없다. Swagger UI 에서는 `example` 숫자만 노출되고 "롤링 윈도 기준(캘린더 버킷 아님)" 같은 의미 설명이 없다. `AuthConfigUsageCallDto.sourceIp` / `responseCode` 는 JSDoc 이 있어 대조된다.
- 제안: `@ApiProperty({ example: 5, description: 'Rolling 24-hour window call count.' })` 형식으로 각 필드에 description 추가.

### 5. **[INFO]** `spec/1-data-model.md §2.13` 업데이트 여부 확인 필요
- 위치: `plan/in-progress/spec-sync-config-gaps.md` — §A.3 구현 완료 섹션
- 상세: 플랜 문서에 "spec 동기화: `1-data-model.md §2.13` `source_ip`/`response_code` + AuthConfig 호출 집계 경로 SoT (consistency W-1·W-2·I-1 해소)"라고 명시되어 있다. 그러나 리뷰 대상 파일 목록에 `spec/1-data-model.md` 변경이 포함되어 있지 않다. consistency-check 보고서(파일 15)가 W-1·W-2 해소를 본 PR 에서 처리하겠다고 명시했으므로, 해당 spec 파일 변경이 diff 에서 누락된 것인지, 혹은 다른 커밋에 포함된 것인지 확인이 필요하다.
- 제안: `spec/1-data-model.md §2.13 Execution` 에 `source_ip`/`response_code` 컬럼 및 AuthConfig 집계 경로 SoT 설명이 실제로 추가되었는지 확인. 누락 시 추가 필요.

### 6. **[INFO]** `spec/2-navigation/6-config.md §3 API` `/usage` 응답 shape 업데이트 여부 확인 필요
- 위치: consistency-check SUMMARY.md (파일 15) — I-1·I-8·I-9 해소 메모
- 상세: 플랜 및 consistency-check SUMMARY 에서 "I-1·I-8·I-9 해소: `spec/2-navigation/6-config.md §3 API` `/usage` 행에 응답 shape(`totalCalls`/`lastUsedAt`/`periodCounts`/`recentCalls[]`)을 명시한다"고 선언하였으나, 리뷰 대상 diff 에 `6-config.md` 변경이 포함되어 있지 않다. `periodCounts` 필드가 실제 응답에 추가되었으므로 API 문서도 동기화되어야 한다.
- 제안: `spec/2-navigation/6-config.md §3 Authentication API` 표의 `GET /api/auth-configs/:id/usage` 행에 `periodCounts {last24h, last7d, last30d}` 및 `sourceIp`, `responseCode` 필드가 명시되었는지 확인. 누락 시 추가 필요.

### 7. **[INFO]** `chat-channel` 경로에서 `extractClientIp` 중복 호출 — 주석 미언급
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` — `handleChatChannelWebhook` 내 변경 (라인 599 부근)
- 상세: `handleWebhook` 경로에서는 "소스 IP 추출 — 인증 IP whitelist 검증과 호출 이력(§A.3) 영속에 공용. 한 번만 추출"이라는 인라인 주석이 있다. 그러나 `handleChatChannelWebhook` 경로에서는 `extractClientIp(input.headers) ?? undefined` 를 options 객체 안에 인라인으로 직접 호출하고 있어 동일한 "한 번만 추출" 공용 변수 패턴을 따르지 않는다. 이것이 의도된 차이(chat-channel 은 authConfig 검증 없어 공용 변수 불필요)라면 주석으로 이유를 밝히는 것이 좋다.
- 제안: chat-channel 경로 변경 주석에 "chat-channel 은 IP whitelist 검증 없음 — 별도 공용 변수 불필요" 한 줄 추가 또는 현재 인라인 패턴 유지 시 설명 추가.

### 8. **[INFO]** `usage-drawer.test.tsx` 파일 최상단 모듈 주석 양호 — 긍정 사항
- 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/usage-drawer.test.tsx` (라인 1-5)
- 상세: 파일 최상단에 테스트 목적(§A.3 호출 이력), 검증 대상(소스 IP·응답 코드·기간별 호출 수), recharts stub 이유가 블록 주석으로 명확히 설명되어 있다. 다른 테스트 파일의 모범 사례로 참고할 수 있다.

## 요약

이번 변경(§A.3 호출 이력 — sourceIp/responseCode/periodCounts 추가)의 문서화 수준은 전반적으로 양호하다. SQL migration 파일에 설계 의도·NULL 정책·spec 참조가 상세히 기술되어 있고, entity 컬럼·DTO 필드·service 상수에 인라인 주석 또는 JSDoc 이 일관되게 작성되어 있다. i18n 파일(en/ko 모두)도 새 키가 누락 없이 추가되었다. 주요 미비점은 두 가지다. 첫째, `getUsage` 공개 메서드에 반환 계약 변경을 반영한 JSDoc 이 없다. 둘째, 플랜에서 완료 선언한 `spec/1-data-model.md §2.13` 및 `spec/2-navigation/6-config.md §3 API` 문서 동기화가 리뷰 대상 diff 에 보이지 않아 실제 반영 여부 확인이 필요하다. 그 외 DTO `@ApiProperty` description 부재, chat-channel 경로 주석 보완 등은 INFO 수준이다.

## 위험도

LOW
