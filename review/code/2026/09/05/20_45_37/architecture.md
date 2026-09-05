# 아키텍처 리뷰

## 발견사항

- **[INFO]** 응답 경계 정화(sanitization)의 SoT 가 여전히 서비스 레이어의 수기 목록 세 벌로 흩어져 있다 (이전 라운드부터 이월, 이번에 세 번째 축이 추가됨)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`(JSONB `config.chatChannel` 키 축) · `NOTIFICATION_SIGNING_STRIP_KEYS`(JSONB `config.notification.signing` 키 축, 신규) · `TRIGGER_RESPONSE_STRIP_COLUMNS`(엔티티 컬럼 축)
  - 상세: `sanitizeForResponse` 는 이번 diff 에서 `chatChannel` 조기 return 을 없애고 `notification.signing` 축을 추가해 두 벌이던 목록을 세 벌로 늘렸다. 이 자체는 §5.4 스윕이 실제로 드러낸 유출(트리거 컬럼·chat-channel 키·notification signing 키가 각각 별도 사건으로 새어 나갔다)을 정확히 메운 것이라 방향은 옳다. 다만 "이 필드는 응답에 나가면 안 된다"는 지식이 `Trigger` 엔티티 자체에는 없고 전적으로 서비스 레이어의 세 개 병렬 상수에 위임돼 있다는 구조는 그대로다 — 새 비밀 컬럼/JSONB 키가 추가되면 세 곳 중 어디에도 자동으로 반영되지 않는다.
  - 제안: `TRIGGER_RESPONSE_STRIP_COLUMNS` 를 `as const satisfies readonly (keyof Trigger)[]` 로 컴파일타임 존재 검증한 것과 `select:false` 를 의도적으로 피한 근거는 이미 문서화돼 있어 지금 되돌릴 사안은 아니다. 다만 같은 클래스의 결함이 이번이 두 번째(1차: chat-channel 키만 있고 엔티티 컬럼 축 부재, 2차: notification.signing 축 부재)이므로, 세 번째 재발 시 엔티티 컬럼 데코레이터에 `@Sensitive()` 류 메타데이터를 얹고 정화 로직이 거기서 목록을 도출하는 방향으로 SoT 를 엔티티 쪽으로 옮기는 것을 검토할 시점이다 (JSDoc 에 이미 이 방향이 적혀 있어 추적은 되고 있음).

- **[INFO]** 응답 DTO required:false+nullable:true 금지 조합을 추적하는 근접 명명 래칫 2벌이 상호 참조 주석만으로 동기화되고 있다 (자동 subset 검증 없음)
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(응답 DTO 전수 78건) vs `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts` `OPTIONAL_NULLABLE_DRIFT`(`ExecutionDto` 10건, 전자의 진부분집합)
  - 상세: 이번 커밋 자체가 `execution-response.dto.spec.ts` 에 "한쪽만 상환하면 다른 쪽이 조용히 낡는다 — 함께 줄여야 한다" 는 상호 참조 주석을 추가해 이 문제를 인지하고 있다. 이는 이미 별도 consistency 검토(`review/consistency/2026/09/05/19_08_19` naming_collision WARNING)가 지적한 항목이고, 그 리포트가 제시한 두 대안(병합 vs 상호 포인터 주석) 중 후자로 처리된 상태다. 다만 주석만으로는 한쪽이 78→77 로 줄었는데 다른 쪽이 10 그대로 남는 상황을 CI 가 잡지 못한다 — 사람이 두 diff 를 동시에 봐야만 드러난다.
  - 제안: 지금 당장의 조치는 불요(이미 처분된 항목). 다음에 이 78건 중 `ExecutionDto` 소속 10건이 실제로 상환될 때, `execution-response.dto.spec.ts` 쪽에서 `EXPECTED_OPTIONAL_NULLABLE_DRIFT.filter(k => k.startsWith('execution-response.dto.ts:ExecutionDto.'))` 형태의 파생 단언을 추가하면 주석 대신 테스트가 drift 를 강제할 수 있다.

- **[INFO, 긍정]** 새 3번째 검증 축(`findOptionalNullableResponseFields`)이 기존 두 검증자와 책임이 명확히 분리돼 있고, 스캔 범위 제한으로 자기 테스트 fixture 가 프로덕션 베이스라인을 오염시키지 않게 설계됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`isResponseDtoFile`, `findOptionalNullableResponseFields`), `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`
  - 상세: 런타임 값 검증자(`response-contract.ts`, 응답 실값 vs 선언 대조)와 기존 정적 가드(presence/null 축, 선언 vs TS 타입 대조)가 왜 이 조합(`required:false`+`nullable:true`)을 구조적으로 못 잡는지 JSDoc 에 근거가 적혀 있고, 이 술어는 `dto/responses/` 경로만 스캔하며 프로덕션 스캔 루트를 `src/modules` 로 좁혀 `repo-guards/__tests__/fixtures/` 아래의 양성 대조군이 78건 베이스라인에 섞이지 않게 분리했다. 이전 라운드의 Critical(존재하지 않는 fixture 경로를 참조해 술어가 실제로는 아무것도 못 잡으면서 그린이었던 결함)도 이번에 실제 fixture 신설로 해소됐다.
  - 제안: 없음 — 검증 층 간 경계를 문서화하라는 `spec/conventions/swagger.md`/`spec/5-system/2-api-convention.md` 의 기존 원칙에 부합하는 설계.

- **[INFO, 긍정]** Schedule 응답 경계 narrowing 이 트리거를 반환하는 4개 엔드포인트 전부에 적용되어 커버리지 갭이 없다
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` — `findAll`/`findById`/`create`/`update` 전부 `toResponse()` 를 거치고, `runNow`/`getPreview`/`getPreviewFromExpression`/`remove` 는 `Schedule` 엔티티를 반환하지 않아 대상에서 올바르게 제외됨
  - 상세: `toResponse` 를 서비스가 아니라 컨트롤러(응답 경계)에 둔 판단은 이전 라운드에서 이미 검토됐고(서비스 반환 타입이 `update()` 내부 로직에도 소비되므로), 이번 diff 는 그 지점을 4개 엔드포인트에 누락 없이 적용했다. `SchedulesService.update()` 는 `trigger` 채움을 `findById` 의 조인 결과 객체 참조가 그대로 보존되는 데 암묵적으로 의존하고(`create()`/`findAll` 과는 다른 경로), 이 비대칭은 PATCH e2e 계약 대조 추가로 회귀 테스트가 걸렸다 — 다만 `trigger` 가 DTO 상 optional 이라, 향후 새 서비스 메서드가 trigger 를 채우지 않고 Schedule 을 반환해도 계약 위반 없이 조용히 키가 빠질 수 있다는 구조적 여지는 남아 있다(§5.4 가 명시적으로 허용하는 키 생략형이므로 결함은 아니다).
  - 제안: 없음 — 현재 스코프에서 조치 불요.

## 요약

이번 diff 는 §5.4 응답-계약 스윕의 후속 라운드로, 이전 라운드에서 지적된 항목들(트리거 정화의 조기 return·notification.signing 축 누락·isActive 조건부 응답 형태·존재하지 않는 fixture 를 참조하던 vacuous 가드)을 실제로 닫고, 응답 DTO 전수에 대한 `required:false`+`nullable:true` 금지 조합 래칫이라는 새 정적 검증 축을 기존 두 검증자와 명확히 분리된 책임으로 추가했다. 레이어 책임(서비스는 자기 응답 정화, 컨트롤러는 조인 관계 좁히기)과 모듈 경계(Schedule 이 Trigger DTO/엔티티를 재사용하지 않고 좁은 참조 DTO를 자체 소유)에 대한 이전 라운드의 판단은 이번에도 일관되게 지켜졌다. 유일한 잔여 구조적 리스크는 민감 필드 정화 지식이 여전히 엔티티가 아니라 서비스 레이어의 병렬 목록(이번에 두 벌에서 세 벌로 증가)에 있다는 점과, 근접 명명의 두 래칫이 자동 검증 없이 주석으로만 동기화된다는 점인데, 둘 다 이미 문서화되고 추적 중인 트레이드오프이지 이번 diff 가 새로 만든 결함은 아니다.

## 위험도

LOW
