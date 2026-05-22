# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-triggers-edit-delete.md`
검토 일시: 2026-05-22

---

## 발견사항

- **[WARNING]** `isActive` 편집 경로 이중화 — 기존 전용 endpoint 의 위상 미정리
  - target 위치: Change 3 (§2.3.1 필드 권한 매트릭스), Overview 카드 `isActive` 행; Change 4 (§3 API) PATCH fine-print
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md §3` API 표 — `PATCH /api/triggers/:id/toggle` 이 활성/비활성 토글의 전용 endpoint 로 명시됨
  - 상세: 기존 spec 은 토글 전용 endpoint `PATCH /api/triggers/:id/toggle` 을 이미 정의한다. 본 draft 의 §2.3.1 매트릭스는 `isActive` 를 `edit` 모드로 표시하며 "§2.1 행 액션과 동등 — 동일 API" 라 기술하고, Change 4 의 PATCH fine-print 는 `isActive` 를 `PATCH /api/triggers/:id` 의 허용 키 목록에 포함시킨다. 이로써 `isActive` 변경 경로가 두 개가 된다 — `/toggle` 과 `PATCH /:id { isActive }`. 어느 쪽이 canonical 인지, 두 경로가 병행 운용될 것인지, 아니면 `/toggle` 을 deprecated 처리하는 것인지에 대한 Rationale 이 없다. 기존 결정을 번복하는 것이라면 새 근거가 필요하고, 병행 허용이라면 중복 API 도입의 의도가 명시되어야 한다.
  - 제안: §2.3.1 `isActive` 행 비고에 "내부적으로 `PATCH /api/triggers/:id/toggle` 위임 (기존 endpoint 유지)" 또는 "`/toggle` 는 이 flow 에서 래퍼로 동작, 신규 코드는 PATCH body 를 우선" 등 두 경로의 관계를 명시한다. 또는 Change 6 `## Rationale` 에 "R-4. toggle endpoint 와 isActive PATCH 의 관계" 항을 추가한다.

- **[WARNING]** `POST /api/triggers/:id/auth/rotate-secret` — RPC-style sub-channel 패턴과의 정합성
  - target 위치: Change 3 (§2.3.1) `hmacSecret` 행; Change 4 (§3 API) POST 행
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §2.2` RPC-style sub-channel action 예외 규칙 — 허용 예시는 `/api/triggers/:id/notification/rotate-secret`, `/api/triggers/:id/interaction/revoke-token`, `/api/triggers/:id/chat-channel/rotate-bot-token`
  - 상세: API 규약의 RPC-style 예외 패턴 형식은 `/{resource}/{id}/{channel}/{action}` 이며, 기존 채널 예시는 모두 EIA sub-channel(`notification`, `interaction`, `chat-channel`) 이다. Draft 가 제안하는 `/api/triggers/:id/auth/rotate-secret` 는 `auth` 를 채널로 쓰는 새 패턴이다. `auth` 는 기존 예시 어디에도 등장하지 않으며, EIA spec 의 secret rotate endpoint 는 `/notification/rotate-secret` 패턴을 따른다. 본 draft 내 Change 4 의존·side-effect 메모는 "API 도 동일 패턴: `PATCH /api/triggers/:id { config.hmacSecret }` (v1) vs `POST /api/triggers/:id/auth/rotate-secret` (v1.1)" 으로만 기술하며, 왜 `/notification/rotate-secret` 의 채널 명칭이 아닌 `/auth/` 를 쓰는지에 대한 근거가 없다. 기존 예시와 다른 채널 세그먼트를 도입하는 것은 향후 `api-convention.md` 업데이트가 필요할 수 있다.
  - 제안: Change 6 `## Rationale` 에 "R-N. `/auth/rotate-secret` 채널 이름 선택 근거" 항 추가. `/notification/rotate-secret` 과의 구분 — webhook inbound auth 자격증명 교체와 EIA outbound notification secret 교체는 서로 다른 도메인이라는 점 — 을 명시한다. 또는 `spec/5-system/2-api-convention.md §2.2` 의 예시에 `/auth/rotate-secret` 계열 추가 검토.

- **[INFO]** `§4.2` 오삭제 방지 패턴 — `_layout.md` 참조 근거 불명확
  - target 위치: Change 5 §4.2 확인 다이얼로그 "오삭제 방지" 문장
  - 과거 결정 출처: `spec/2-navigation/_layout.md` (검토 시점에 해당 패턴 미발견), `spec/2-navigation/1-workflow-list.md §2.2` ("확인 다이얼로그 후 삭제" 수준에서 명세 종료)
  - 상세: draft §4.2 는 "사용자가 트리거 이름을 정확히 타이핑해야 '삭제' 버튼이 활성화 (`spec/2-navigation/_layout.md` 참고 — 동일 패턴이 Workflow 삭제에 이미 사용 중)" 라고 기술한다. 그러나 `1-workflow-list.md` 의 삭제 항목은 "확인 다이얼로그 후 삭제" 이상으로 이름-입력-확인 패턴을 명시하지 않으며, `_layout.md` 에도 해당 패턴이 명시되어 있지 않다. "동일 패턴이 이미 사용 중" 이라는 주장의 근거 링크가 실제 spec 텍스트와 다르다. CRITICAL 수준은 아니지만 후속 구현자가 해당 패턴을 `_layout.md` 에서 찾지 못할 경우 혼란이 생긴다.
  - 제안: (a) `_layout.md` 에 이름-입력 확인 삭제 패턴을 명시한다(이미 Workspace 삭제 패턴은 `9-user-profile.md` 에 기재됨 — cross-link 보완). 또는 (b) §4.2 의 참조를 `spec/2-navigation/9-user-profile.md §5.3` (워크스페이스 삭제의 "이름 재입력 확인") 등 실제 근거 위치로 교정하고, Workflow 삭제가 이 패턴을 따르지 않는다면 해당 설명을 삭제한다.

- **[INFO]** `execution.trigger_id` SET NULL — 데이터 모델 spec 에 ON DELETE 방향 명시 없음
  - target 위치: Change 5 §4.3 cascade 동작 표 `execution.trigger_id` 행
  - 과거 결정 출처: `spec/data-flow/10-triggers.md §2.1` ("trigger_id FK SET NULL (트리거 삭제 시 실행 이력 보존)" 로 기재됨); `spec/1-data-model.md` §2.8 Execution 테이블 `trigger_id UUID?` — `ON DELETE` 방향이 명시되지 않음
  - 상세: `data-flow/10-triggers.md` 는 "SET NULL" 동작을 명시하고 있어 draft 가 이를 올바르게 인용한다. 그러나 `spec/1-data-model.md` 의 Execution 테이블 정의에는 `trigger_id` 에 대한 `ON DELETE SET NULL` 주석이 없어 두 스펙 문서 사이에 경미한 불일치가 있다. draft 가 이 불일치를 해소하지 않고 data-flow spec 만 인용한다.
  - 제안: draft 의 §4.3 또는 Change 6 Rationale 에 "data-model §2.8 의 `trigger_id` 컬럼에 `ON DELETE SET NULL` 명시 필요 — 후속 spec 정비" 메모를 추가한다. 또는 spec 저자가 `1-data-model.md` §2.8 Execution 테이블 `trigger_id` 행에 `ON DELETE SET NULL` 을 보충한다.

---

## 요약

`spec-draft-triggers-edit-delete.md` 는 기존 Rationale 에서 명시적으로 기각된 대안을 직접 재도입하거나 합의 invariant 를 정면 위반하는 CRITICAL 수준의 문제는 없다. 그러나 두 가지 WARNING 이 주목된다. 첫째, 기존 spec 에 정의된 `PATCH /api/triggers/:id/toggle` 전용 토글 endpoint 를 신설 PATCH body 의 `isActive` 키로 사실상 우회하면서 두 경로의 관계와 기존 endpoint 의 처우에 대한 Rationale 이 부재하다. 둘째, `POST /api/triggers/:id/auth/rotate-secret` 의 `auth` 채널 세그먼트가 API 규약 §2.2 의 기존 RPC-style 예시와 다른 명명 패턴을 도입하면서 이에 대한 설명이 없다. 두 WARNING 모두 새 Rationale 항 추가 또는 기존 참조 보완으로 해소 가능하며, 구현 차단 수준은 아니다. 나머지 두 INFO 항은 참조 정확성과 데이터 모델 정비에 관한 권고다.

---

## 위험도

MEDIUM
