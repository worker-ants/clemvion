# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `HttpStatusScan`/`judgeHandler` 반환 인터페이스에 `unadvertised` 필드가 추가됐다 — 시그니처 확장
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts` (`HttpStatusScan` interface, `judgeHandler` 반환 타입, `classifyDecorators` 신설)
  - 상세: `scanHttpStatusAdvertised`/`judgeHandler`/`classifyDecorators` 를 `grep` 으로 전수 확인한 결과 소비자는 같은 파일과 `http-status-advertised.spec.ts` 뿐이다. 그 spec 은 `.violations`/`.unresolved`/`.unadvertised`/`.checked` 를 개별 필드로 꺼내거나 `.map()` 한 부분집합에 `toEqual`/`toStrictEqual` 을 적용할 뿐, `scan` 객체 전체를 한 번에 비교하는 자리가 없다(`grep -n "toEqual|toStrictEqual|scan\\." ` 로 확인) — 따라서 필드 추가로 인한 회귀는 없다. 이 도구는 CI/테스트 전용 정적 분석기이고 런타임 프로덕션 코드가 아니라 외부 API 계약도 아니다.
  - 제안: 조치 불필요 — 정보성 기록. 향후 이 유틸을 다른 스크립트가 import 하면 이 확장을 인지할 것.

- **[INFO]** `triggers.controller.ts` 두 핸들러의 반환 타입이 인라인 리터럴에서 신규 DTO 클래스로 좁혀졌다(`Promise<{ secret: string; rotatedAt: string }>` → `Promise<NotificationRotateSecretDto>`, `Promise<{ token: string }>` → `Promise<InteractionRevokeTokenDto>`)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateNotificationSecret()`, `revokePerTriggerToken()`
  - 상세: `TriggersService.rotateNotificationSecret`/`revokePerTriggerToken` (`triggers.service.ts`)의 실제 반환 값은 이 diff 로 바뀌지 않았고 여전히 `{ secret, rotatedAt }`/`{ token }` 리터럴을 반환한다 — 구조적으로 새 DTO 와 필드가 정확히 일치해 컴파일이 통과하며 런타임 동작은 동일하다. 이 메서드들은 Nest 라우팅으로만 호출되는 컨트롤러 메서드라 외부(다른 모듈)에서 직접 import 해 호출하는 곳이 없음을 `grep`(`rotateNotificationSecret|revokePerTriggerToken` 전수)으로 확인했다 — 시그니처 변경의 호출자 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** e2e 신규 테스트 H(`workflow-assistant.e2e-spec.ts`)가 서비스 레이어를 우회해 raw SQL 로 `workflow_assistant_message` row 를 직접 INSERT 한다
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts` — 테스트 `'H. 세션 상세 — 메시지(도구 호출 · 계획 · 사용량)까지 응답 DTO 와 맞는다'`
  - 상세: 이 파일 머리 주석대로 이 e2e 는 LLM 을 실제로 호출하지 않으므로, 계약 검증에 필요한 `tool_calls`/`plan`/`usage` 컬럼이 채워진 assistant 메시지 행을 `db.query(INSERT ...)` 로 직접 만든다 — 애플리케이션 로직(엔티티 검증·서비스 레이어)을 거치지 않는 DB 부작용이다. 다만 생성한 세션은 테스트 끝에서 실제 `DELETE /api/workflow-assistant/sessions/:id` 엔드포인트로 지워(주석에 "cascade 로 메시지 삭제" 명시된 서비스 경로), 이 raw INSERT 로 만든 고아 row 가 남지 않는다 — 같은 PR 의 `advertised-response-contract.e2e-spec.ts`(raw `DELETE FROM trigger`만 하고 workspace/user 는 정리 안 함, 저장소 e2e 전반의 기존 관례)와 달리 이 테스트는 정상 삭제 경로를 써 부작용 잔존이 없다.
  - 제안: 조치 불필요 — 오히려 기존 e2e 관례(raw DELETE 로 정리)보다 깨끗한 형태다.

## 점검 관점별 확인 (문제 없음)

1. **의도치 않은 상태 변경 / 전역 변수**: `classifyDecorators`(신규 순수 함수)는 지역 `Set`·`let` 변수만 쓰고 모듈 레벨 상태를 갖지 않는다. 새 전역 변수 도입 없음.
2. **파일시스템 부작용**: 프로덕션 코드(`api-wrapped.ts`, DTO, 컨트롤러 데코레이터)는 파일 I/O 를 하지 않는다. 신규 e2e 는 DB 에만 쓰고 파일시스템에 쓰지 않는다.
3. **인터페이스/공개 API 변경**: 컨트롤러에 Swagger 데코레이터만 추가돼 실제 HTTP 상태 코드·응답 바디는 바뀌지 않는다(`webauthnAvailability`·`webauthnDelete`·SSE 스트림·workflow-assistant CRUD 모두 기존 `@HttpCode`/Nest 기본값과 문서가 일치함을 직접 대조). `wrapNullableDataSchema`/`ApiOkWrappedNullableResponse` 는 기존 함수를 수정하지 않고 새로 추가한 것이라 기존 호출자에 영향 없음.
4. **환경 변수**: 새 환경 변수 읽기/쓰기 없음.
5. **네트워크 호출**: 새 외부 서비스 호출 없음 — 전부 문서화 데코레이터·DTO·정적 가드·e2e 테스트.
6. **이벤트/콜백**: 이벤트 발생·콜백 등록 변경 없음.

## 요약

이번 diff(1R 픽스 커밋 `bf1fa96fc` 포함 전체)의 실질 변경은 Swagger 문서화 데코레이터·신규 응답 DTO·가드의 판정 로직 리팩터(`classifyDecorators` 분리)·e2e 계약 테스트 추가로, 런타임 동작·전역 상태·환경 변수·네트워크 호출을 건드리지 않는다. 유일하게 "시그니처가 변한 것처럼 보이는" 두 자리 — 테스트 전용 `HttpStatusScan`/`judgeHandler` 인터페이스 확장, `triggers.controller.ts` 두 핸들러의 반환 타입 narrowing — 는 전수 grep 으로 소비자를 확인한 결과 둘 다 안전(추가 필드는 대조되지 않고, 타입 narrowing 은 서비스가 이미 반환하던 형태와 구조적으로 동일)하다. 신규 e2e 테스트 H 는 raw SQL INSERT 로 서비스 레이어를 우회하지만 정상 DELETE 경로로 정리해 고아 row 를 남기지 않는다. CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
