### 발견사항

- **[WARNING] `GET /api/triggers/:id/history` 의 응답 포맷이 다른 목록 endpoint 와 달리 미표기**
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표, `GET /api/triggers/:id/history` 행
  - 위반 규약: `spec/conventions/swagger.md` §5-2 (`ApiOkWrappedArrayResponse` vs `ApiOkPaginatedResponse` 구분) · 같은 문서 내 다른 목록 endpoint(`GET /api/workflows`, `GET /api/triggers`, `GET /api/schedules`, `GET /api/folders`)가 일관되게 명시하는 "페이지네이션 응답 형식은 [API 규약 §5.2] 준수" 관행
  - 상세: 같은 표의 다른 목록성 endpoint 는 전부 페이지네이션 준수 여부를 명시적으로 적는데, `.../history` 행만 "호출 이력 조회"라고만 적혀 있어 소비자가 페이지네이션 유무·응답 shape 를 알 수 없다. 실제 backend(`triggers.controller.ts`)를 확인하니 `@ApiOkWrappedArrayResponse(TriggerHistoryItemDto)` 로 **최근 10건 고정 배열**(비페이징) 을 반환하고 있어, 페이지네이션 표기가 없는 것 자체는 틀리지 않지만 "왜 없는지"(bounded array, 10건 cap)가 spec 어디에도(§2.1 · §2.3 · R-6 · R-13 · `14-execution-history.md` 확인 포함) 명시돼 있지 않다.
  - 제안: 해당 API 표 행에 "최근 10건 고정 배열(비페이징) — [swagger §5-2] `ApiOkWrappedArrayResponse` 패턴" 정도의 한 줄을 추가해 다른 목록 endpoint 와 표기 밀도를 맞춘다.

- **[INFO] rotate-secret 응답 예시가 `{data:...}` 봉투를 생략**
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3, `POST /api/triggers/:id/notification/rotate-secret` 행 — "응답 `{ secret, rotatedAt }`"
  - 위반 규약: `spec/conventions/swagger.md` §2-5 (TransformInterceptor 가 성공 응답을 `{ data: ... }` 로 감쌈)
  - 상세: 실제 wire 는 `{ data: { secret, rotatedAt } }` 이겠지만 프로즈에는 내부 payload만 적혀 있다. 다만 같은 문서의 `ScheduleDto`/`TriggerDto` 등 다른 응답 설명도 동일하게 `{data}` 봉투를 생략하는 문체를 일관되게 쓰고 있어 이 문서 자체의 스타일 불일치는 아니다 — 문서 전반의 관행이라 CRITICAL/WARNING 급은 아니고 참고용 INFO.
  - 제안: 필요하면 스타일 통일 차원에서 spec 전역에 "이 문서의 응답 예시는 `{data}` 봉투를 생략하고 payload 만 적는다" 는 한 줄 각주를 `_layout.md` 등에 두는 정도로 충분.

### 요약
`spec/2-navigation/1-workflow-list.md · 2-trigger-list.md · 3-schedule.md` 는 frontmatter 스키마(`id`/`status`/`code`/`pending_plans`, `spec-impl-evidence.md` §2 준수, id 충돌 없음, pending_plans 실존 확인 완료), DTO/Update 접두 명명(`swagger.md` §1-7), secret 필드의 write-only/hasBotToken 패턴(`swagger.md` §1-5, `secret-store.md` §1.1), `chatChannel.uiMapping` enum 값(`chat-channel-adapter.md` §2.3 과 완전 일치), audit action 명명(`audit-actions.md` §2.1 과거분사 + resource dot-prefix), 에러 코드 명명(`error-codes.md` §1 의미 기반·UPPER_SNAKE_CASE, `RESOURCE_NOT_FOUND`/`VALIDATION_ERROR` 등 시스템 공용 코드의 prefix-less 예외 정확히 적용), 응답 부재 표현(`null` vs 키 생략, API 규약 §5.4)까지 정식 규약을 매우 정밀하게 인용·준수하고 있다. Overview 섹션이 개별 파일에 없는 것도 `_product-overview.md` 존재로 정당한 예외에 해당해 문서 구조 규약 위반이 아니다. 발견된 것은 `GET /api/triggers/:id/history` 응답 포맷(페이지네이션 여부·10건 cap)이 형제 endpoint 대비 문서화 밀도가 낮다는 WARNING 1건과, 응답 봉투 생략 문체에 대한 참고용 INFO 1건뿐이며 둘 다 문서 전체의 신뢰도를 해치는 수준은 아니다.

### 위험도
LOW
