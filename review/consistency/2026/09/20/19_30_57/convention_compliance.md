### 발견사항

- **[WARNING] `details.field` 값의 표기 규칙이 같은 문서 안에서 갈린다 (snake_case vs camelCase)**
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 하단 註 (`` `(endpoint_path)` UNIQUE ... `details.field='endpoint_path'` `` 부분)
  - 위반 규약: 직접 명문화된 단일 조항은 없으나, `spec/conventions/swagger.md` §1 (DTO 필드는 `class-validator`/`@ApiProperty` 기반 camelCase 선언) 및 같은 문서 내부에서 반복되는 `details.field` 표기 관행(에러 출력 포맷의 자기 일관성)과 어긋난다.
  - 상세: 같은 `2-trigger-list.md` §3 안에서 `details.field` 값이 6곳 모두 camelCase 다 — `botTokenRef`, `chatChannel`, `provider`, `type`, `inboundSigningPlaintext` (line 376·377·433·434·435·648). 이들은 전부 실제 PATCH body 의 wire 필드명(`endpointPath`, `chatChannel.botTokenRef` 등)과 1:1 로 대응한다. 그런데 단 한 곳(line 436)만 `` `details.field='endpoint_path'` `` 로 **DB 컬럼명(snake_case)** 을 그대로 썼다 — 정작 같은 필드의 PATCH body 키는 §2.3.1·§3 여러 곳에서 `endpointPath` (camelCase) 로 명시돼 있다(예: `` `PATCH /api/triggers/:id { endpointPath }` ``). 클라이언트가 `error.details.field === 'endpointPath'` 로 분기하도록 다른 5개 사례로 학습했다면, 이 한 곳만 매치가 안 되는 실제 동작 차이(혹은 단순 오기)로 이어질 수 있다.
  - 제안: `details.field='endpoint_path'` 를 `details.field='endpointPath'` 로 정정하거나, 이 자리만 DB 컬럼명을 쓰는 의도라면(예: UNIQUE 제약이 DB 레벨이라서) 그 이유를 각주로 명시해 나머지 5곳과의 표기 불일치가 의도임을 밝힌다. 표기 규칙 자체가 `spec/conventions/error-codes.md` §4 (details 파이프라인) 범위 밖이라면, 이번 기회에 그 규약 문서에 "`details.field` 는 요청 wire 필드명(camelCase) 을 그대로 쓴다" 한 줄을 추가하는 편이 재발을 막는다.

- **[INFO] `pending_plans` 에 이미 `plan/complete/` 로 이동한 항목을 원경로 표기 없이 직접 등재**
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans: - plan/complete/workflow-duplicate-nodes-edges.md`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`pending_plans` 는 "미구현 surface 를 책임지는" 미완료 plan 경로) — 강제 위반은 아니다. 가드(`spec-pending-plan-existence.test.ts`)는 리터럴 경로 실존만 확인하므로 통과하며, 같은 문서 §R-11 이 "공유 트래커 문서의 승격 판정은 파일 이동이 아니라 그 문서 몫의 미구현 surface 로 본다"는 예외를 이미 인정하고 있어 구조적으로는 정당화된다.
  - 상세: 다만 이 항목이 가리키는 `workflow-duplicate-nodes-edges.md` 는 이미 `plan/complete/` 에 있고, 그 작업(§2.6/§3 `duplicate` 엔드포인트)은 본문에 완료된 것으로 서술돼 있다. 남은 미구현 surface 는 `marketplace-and-plugin-sdk.md`(§2.7 마켓플레이스 추천 링크 Planned) 하나뿐으로 보인다. `pending_plans` 가 "이 문서를 아직 책임지는 미완료 plan" 이라는 원래 의도(R-5)에 비춰보면, 이미 종료된 항목을 계속 나열하는 것은 사소한 신선도 저하다.
  - 제안: 실질적 영향은 없음(가드 통과, R-11 예외로 이미 설명 가능) — 다음에 이 frontmatter 를 건드릴 때 완료된 `workflow-duplicate-nodes-edges.md` 항목을 정리하는 정도로 충분하다. 규약 갱신은 불필요.

### 요약

`spec/2-navigation/1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md` (전문 확보분) 을 `spec/conventions/` 의 error-codes.md·spec-impl-evidence.md·swagger.md·secret-store.md·chat-channel-adapter.md·audit-actions.md 와 대조한 결과, frontmatter 스키마(`id`/`status`/`code`/`pending_plans`), 에러 코드 명명(`UPPER_SNAKE_CASE`+의미 기반+도메인 prefix), audit action taxonomy(`<resource>.<verb>`+시제 3분류), DTO/Swagger 명명(`Update<Entity>Dto`, 참조 DTO 분리, enum 값), 문서 구조(다중 파일 영역이므로 Overview 는 `_product-overview.md` 로 위임하고 개별 문서는 본문+Rationale 만 구성) 모두 정식 규약을 정확히 따르고 있다. 유일하게 확인된 실질 이슈는 `2-trigger-list.md` 내부에서 `details.field` 표기가 한 곳(`endpoint_path`)만 DB 컬럼명 스타일이고 나머지 다섯 곳은 wire camelCase 라는 자기 불일치이며, 이는 CRITICAL 급 규약 위반이라기보다 문서 정정으로 해소 가능한 WARNING 이다. 상당수 conventions 파일(`error-codes.md`·`secret-store.md`·`swagger.md`·`chat-channel-adapter.md`·`spec-impl-evidence.md` 등)은 컨텍스트 예산 초과로 프롬프트 번들에서 생략돼 있었으므로, 그 부분은 직접 `Read` 로 열어 대조했다(프롬프트의 지시대로).

### 위험도
LOW
