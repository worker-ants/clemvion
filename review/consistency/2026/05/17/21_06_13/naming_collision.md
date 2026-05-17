# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-cafe24-call-401-retry.md`
검토 모드: spec draft (--spec)
검토 시각: 2026-05-17

---

### 발견사항

- **[INFO]** `refreshViaQueue` / `jobId = integrationId` — 기존 사용처와 완전 일치 (충돌 아님)
  - target 신규 식별자: 변경 1 §6.1 및 변경 3 §10.5 신규 bullet 에서 `refreshViaQueue (jobId = integrationId)` 를 도입
  - 기존 사용처: `spec/2-navigation/4-integration.md §10.5` 기존 "Cafe24 한정" bullet — "모든 cafe24 refresh 호출은 `cafe24-token-refresh` 큐의 `jobId = integrationId` dedup 으로 클러스터 전체 직렬화된다" 로 이미 정의됨
  - 상세: target 이 새로 도입하는 것처럼 보이지만 `refreshViaQueue` 와 `jobId = integrationId` dedup 는 기존 §10.5 "Cafe24 한정" bullet 이 이미 정의한 동일 메커니즘이다. target 은 이를 "401 자동 회복 경로" 에서도 적용한다고 연장하는 것이므로 동일 의미 재사용 — 충돌 없음.
  - 제안: 기존 정의와 동일 토큰을 사용하므로 변경 불필요. 다만 변경 1 §6.1 텍스트에서 `refreshViaQueue` 의 출처 링크(§10.5 또는 구현 클래스)를 명시하면 가독성이 높아진다.

- **[INFO]** `cafe24-token-refresh` 큐 이름 — 기존과 일치 (충돌 아님)
  - target 신규 식별자: 변경 3 §10.5 신규 bullet 에서 `cafe24-token-refresh` 큐 언급
  - 기존 사용처: `spec/2-navigation/4-integration.md §10.5` 기존 "Cafe24 한정" bullet — `cafe24-token-refresh` 큐 이름이 이미 정의됨. 또한 §11.1 `cafe24-background-refresh` 잡이 이 큐로 enqueue 하는 흐름도 기존 텍스트에 있음
  - 상세: 동일 큐 이름을 신규 회복 경로에서도 재사용하는 것이 의도적이며 클러스터 전체 직렬화 보장의 근거다. 이름 충돌 없음.
  - 제안: 변경 없음.

- **[INFO]** `insufficient_scope` status_reason — 기존 enum 내에 이미 정의됨
  - target 신규 식별자: 변경 1 §6.1 403 분기에서 `status_reason='insufficient_scope'` 를 명시적으로 추가
  - 기존 사용처: `spec/1-data-model.md §2.10 Integration.status_reason` — `error → insufficient_scope` 이미 열거됨. `spec/2-navigation/4-integration.md §6` 상태 전이도 이 값을 참조함
  - 상세: 기존에 정의된 enum 값을 §6.1 에 명시적으로 연결하는 것이므로 충돌 아님. 오히려 기존 정의와 §6.1 의 정합성을 높인다.
  - 제안: 변경 없음.

- **[INFO]** "Internal Bridge 예외" 범위 식별자 — §8.4 에 새로 도입되는 개념 레이블
  - target 신규 식별자: 변경 2 §8.4 에 "**Internal Bridge 예외 (refresh_token 보유 provider)**" 라는 조건 레이블 신규 도입
  - 기존 사용처: `spec/5-system/11-mcp-client.md §8.4` 기존 텍스트 — "Internal Bridge 도 §8.4 의 인증 실패 자동 status 전환 정책을 따른다" 는 안내문이 line 69 에 있음. `spec/5-system/11-mcp-client.md §2.3` — "Internal Bridge (in-process)" 라는 섹션명이 이미 정의됨
  - 상세: 기존 §2.3 헤딩 "Internal Bridge (in-process)" 의 약칭 "Internal Bridge" 를 §8.4 예외 조건 레이블로 재사용. 동일 의미로 쓰이므로 충돌 없음. 단, 기존 line 69 의 안내문이 "Internal Bridge 도 §8.4 를 따른다" 고 했다가 변경 후에는 "refresh_token 보유 provider 의 401 은 §6.1 이 우선 적용" 으로 부분 수정되는 흐름이므로, line 69 안내문 정정(변경 2 §8.4 "line 69 인접 안내문 정정")과 함께 반드시 적용되어야 한다.
  - 제안: 변경 2 의 "line 69 인접 안내문 정정" 이 누락되면 §8.4 본문과 line 69 사이에 의미 모순이 남는다. 두 변경을 원자적으로 적용할 것을 권장.

- **[INFO]** plan 파일 경로 `plan/in-progress/cafe24-call-401-retry.md`
  - target 신규 식별자: 변경 4 Rationale 에서 "구현 plan: `plan/in-progress/cafe24-call-401-retry.md`" 참조
  - 기존 사용처: 코퍼스 내 `plan/in-progress/` 목록에서 `cafe24-call-401-retry.md` 는 발견되지 않음. 현재 코퍼스에는 `spec-draft-cafe24-call-401-retry.md` (본 draft 자체) 만 있음
  - 상세: 구현 plan 파일이 아직 생성되지 않은 상태로 Rationale 에 미래 경로를 예약 기재한 것으로 보임. 기존 경로와 충돌 없음. draft 가 승인되면 해당 경로에 실제 plan 파일을 생성해야 한다.
  - 제안: spec 반영 시 구현 plan 파일(`plan/in-progress/cafe24-call-401-retry.md`)을 함께 생성하거나, Rationale 의 해당 줄을 plan 파일 생성 이후에 기재.

---

### 요약

target 문서가 도입하는 신규 식별자 — `refreshViaQueue`, `jobId = integrationId`, `cafe24-token-refresh` 큐, `insufficient_scope` status_reason, "Internal Bridge 예외" 레이블 — 는 모두 기존 spec 코퍼스에서 동일한 의미로 이미 사용 중인 토큰을 재사용하거나 연장 적용하는 것이다. 새로운 의미를 다른 의미의 기존 식별자로 덮어쓰는 진정한 충돌은 발견되지 않았다. 주의 사항은 두 가지다: 변경 2(§8.4) 와 같은 섹션의 line 69 안내문 정정이 원자적으로 함께 적용되어야 기존 안내문과의 의미 모순이 해소되고, 구현 plan 파일 경로 참조는 실제 파일 생성 전후 타이밍을 맞춰야 한다.

### 위험도

NONE
