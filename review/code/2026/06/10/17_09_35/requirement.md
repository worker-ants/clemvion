# 요구사항(Requirement) Review

## 리뷰 대상

`spec/data-flow/` 14개 파일에 대한 spec 사실성 정합 갱신 PR — 구현 코드와 spec 본문의 이격을 좁히는 문서 업데이트. 새 파일 2개(`13-agent-memory.md`, `14-chat-channel.md`, `15-external-interaction.md`는 별도 새 파일들이나 prompt payload에는 13, 14, 15가 포함됨) + 기존 10여 개 파일 수정.

---

## 발견사항

### [SPEC-DRIFT] `spec/1-data-model.md §2.9.1` — "역방향도 동일" 계약 vs 구현 갭

- 위치: `spec/data-flow/10-triggers.md §1.4`, `§3.1`
- 상세: `spec/1-data-model.md §2.9.1` (line 259)는 "Schedule is_active 변경 → 연결된 Trigger is_active도 동기화 (**역방향도 동일**)"을 명시한다. 코드 검증 결과 `triggers.service.ts` `update()` 는 `isActive` 를 `triggerRepository.save` 로만 갱신하며 `ScheduleRunnerService.registerJob/removeJob` 를 호출하지 않는다 (모듈이 `ScheduleRunnerService` 를 주입하지도 않음). `remove()` 도 `removeJob` 없이 직접 `triggerRepository.remove` 만 호출한다. 새 spec 변경이 이를 "구현 갭"으로 명시한 것은 정확하다. 단, 이 갭은 **spec(1-data-model.md §2.9.1)이 권위** 있고 구현이 뒤처진 상태다 — 코드 버그로 분류돼야 하며 SPEC-DRIFT(spec 갱신 대상)가 아니다. 새 data-flow 문서가 갭을 "구현 갭"으로 가시화한 것은 정보 공개로 적절하나, 근원 spec(1-data-model.md §2.9.1)의 "역방향도 동일" 계약은 아직 유효하므로 **코드 fix가 필요한 WARNING**이다.
- 제안: `triggers.service.ts` `update()` 에 schedule 타입 트리거의 `isActive` 변경 시 `ScheduleRunnerService.registerJob/removeJob` 호출 추가. `remove()` 에 `removeJob` 호출 추가. `1-data-model.md §2.9.1` 계약은 그대로 유지.

---

### [WARNING] `spec/1-data-model.md §2.9.1` — 구현 갭이 spec을 변경 없이 현행 유지 중

- 위치: `spec/data-flow/10-triggers.md §1.4` 구현 갭 callout
- 상세: 새 data-flow 문서는 갭을 정확히 가시화했으나, 이 갭이 `1-data-model.md §2.9.1` 의 "역방향도 동일" 계약을 위반하는 현행 코드 결함임을 `plan/`에 추적 항목으로 등록했는지 불분명하다. data-flow 문서의 callout 은 "코드가 spec을 위반 중"임을 알리는 정보이며, spec 갱신보다 코드 fix가 올바른 해결 방향이다.
- 제안: `plan/in-progress/` 또는 `plan/` 에 `trigger-schedule-reverse-sync.md` 이슈를 등록하고 `1-data-model.md §2.9.1` 의 계약 이행을 명시적으로 추적.

---

### [WARNING] `llm_config` partial UNIQUE 인덱스 — DB 단 강제 부재

- 위치: `spec/data-flow/7-llm-usage.md §2.1`, Rationale `is_default partial UNIQUE`
- 상세: 새 문서가 `llm_config_workspace_default_unique` 인덱스가 entity `@Index` 선언은 있으나 SQL 마이그레이션이 없어 실제 DB에 미생성임을 정확히 기술했다. 동일 패턴의 `rerank_config` 는 V081에서 SQL로 인덱스를 생성했으므로 불일치가 명확하다. application 트랜잭션(`saveWithDefaultSwap`)만으로 단일 default를 보장하는 현 구조는 레이스 컨디션(동시 create with is_default=true)에서 중복 default를 허용할 수 있다.
- 제안: `llm_config_workspace_default_unique` partial UNIQUE 인덱스를 SQL 마이그레이션(Vxxx)으로 추가. 이 갭을 plan에 추적.

---

### [WARNING] `WH-MG-02` — `endpoint_path` 생성 주체 명세 불명확

- 위치: `spec/data-flow/10-triggers.md §5` (Rationale/endpoint_path 섹션)
- 상세: 새 문서는 "자동 발급은 서버가 아니라 클라이언트(트리거 생성 화면의 `crypto.randomUUID()`)가 수행하며 서버는 UUID 형식을 강제하지 않는다"고 정확히 기술했다. 그러나 `spec/5-system/12-webhook.md` `WH-MG-02` 는 "생성 시 endpoint_path **자동 생성** (랜덤 UUID 기반)" 만 명시하며 생성 주체(서버 vs 클라이언트)를 명시하지 않는다. 현재 구현에서는 서버가 포맷을 강제하지 않으므로 공격자가 예측 가능한 `endpoint_path`를 직접 지정할 수 있다. 비보안 이슈지만 WH-MG-02의 의도와 구현 간 언급 누락이다.
- 제안: `spec/5-system/12-webhook.md` WH-MG-02 에 "클라이언트 생성 + 서버 UUID 형식 미강제" 사실을 명시. 서버단 UUID 검증 필요 여부를 결정.

---

### [INFO] `spec/data-flow/12-workspace.md §3.1` — `pruneExpired` 프로덕션 호출자 부재

- 위치: `spec/data-flow/12-workspace.md §3.1`
- 상세: 새 문서는 "만료 row 정리용 `WorkspaceInvitationsService.pruneExpired` 가 존재하나 **현재 프로덕션 호출자가 없어** 만료 row 는 영구 잔존"을 정확히 기술했다. 코드 검증으로도 확인됨 — `pruneExpired` 는 서비스에 정의되어 있으나 `app.module.ts`, scheduler, 또는 다른 서비스에서 호출하는 코드가 없다. 이는 의도된 미구현 상태이며 기능상 결함은 아니나(만료 판정은 조회 시점에 `assertTokenUsable`로 수행), 장기 운영 시 DB storage 누수가 발생한다.
- 제안: 추후 BullMQ repeatable job으로 `pruneExpired` 연결 예정임을 plan에 기록.

---

### [INFO] `spec/data-flow/8-notifications.md` — `integrationExpiryEmail` default 변경 명세

- 위치: `spec/data-flow/8-notifications.md` Rationale `notification_preferences JSONB`
- 상세: 구 문서는 "누락된 키는 default true로 해석"이라 했으나 신 문서는 "키 누락 시 false (이메일 채널 OFF)"로 수정했다. 코드(`integrationExpiryEmail === true` 엄격 비교)와 일치하므로 정확한 수정이다. 단, 이 동작 변경이 의도적 설계 결정인지 코드가 먼저 바뀌고 spec이 뒤늦게 반영된 것인지 명확하지 않다. 사용자 입장에서 이메일 알림 off가 기본값이 됨은 UX 영향이 있다.
- 제안: 이 변경이 의도적 결정임을 `spec/1-data-model.md §2.21` (notification_preferences 정의)에도 반영 여부 확인.

---

### [INFO] `spec/data-flow/15-external-interaction.md §1.5` — notification signing secret 승격 구현 갭

- 위치: `spec/data-flow/15-external-interaction.md §1.5`
- 상세: 문서는 `promoteRotatedNotificationSecrets`가 v2 평문을 `config.notification.signing.secret` 에 쓰면서 `signing.secretRef`를 제거하지 않아, `resolveSigningSecret`이 `secretRef` 우선으로 구 secret을 계속 사용한다는 갭을 정확히 기술했다. 코드 현실을 솔직하게 기술한 점은 올바르다. 단, 이 갭은 보안 운영에 직접 영향하는 결함으로 별도 plan 추적이 필요하다.
- 제안: `plan/in-progress/` 에 `notification-signing-secret-promote-fix.md` 이슈를 등록.

---

### [INFO] `spec/data-flow/7-llm-usage.md §1.3` — AI 노드 `LlmCallContext` 미전달 attribution 갭

- 위치: `spec/data-flow/7-llm-usage.md §1.3`, Rationale
- 상세: 구 문서는 "AI 노드 호출은 `workflow_id, execution_id, node_execution_id` 를 모두 채운다"고 잘못 기술했으나 신 문서는 실제로 세 ID 모두 NULL임을 정확히 수정했다. 코드 검증 불가(파일 접근 범위 외)이나, 문서 검증 결과 구 문서의 기술이 틀렸다는 근거가 명확하게 제시되어 있다. 워크플로우별 비용 집계가 현재 assistant 호출만 반영하는 것은 기능 한계다.
- 제안: `AI Agent` / `Text Classifier` / `Information Extractor` 핸들러에 `LlmCallContext` 전달 추가를 plan에 기록.

---

## 요약

이번 변경은 `spec/data-flow/` 산하 14개 spec 문서를 코드 검증 기반으로 갱신한 대규모 spec fidelity 정합 작업이다. 검증한 핵심 사항들(snapshot에 `settings` 미포함, `schedule.isActive` 만 확인하는 process(), `crypto.randomUUID()` 클라이언트 생성, `sendWorkspaceInvitationEmail` 함수명, `resolveTokenWorkspaceContext` 함수명, `auto_resume` SSE 이벤트, `integrationExpiryEmail === true` 엄격 비교 등)은 모두 코드와 일치하며 정확하게 기술되어 있다. 주요 구현 갭(Trigger→Schedule 역방향 동기화 부재, `removeJob` 누락, `llm_config` partial UNIQUE 인덱스 미생성)도 사실에 기반해 가시화했다. 그러나 이 중 **Trigger↔Schedule 역방향 동기화 갭**은 `spec/1-data-model.md §2.9.1`의 명시적 계약(역방향도 동일)을 위반하는 코드 결함이며 spec 갱신이 아닌 **코드 fix**가 필요하다. `llm_config` partial UNIQUE 인덱스 부재도 동일하게 별도 마이그레이션이 필요한 코드 결함이다.

## 위험도

MEDIUM

— Trigger 역방향 동기화 갭과 `llm_config` 인덱스 미생성이 기능 버그 및 데이터 정합성 위험을 내포하고 있으나, 새 spec 문서가 이를 명확히 가시화하여 다음 fix 사이클의 출발점을 제공했다.
