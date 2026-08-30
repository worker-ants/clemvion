# Rationale 연속성 검토 — spec/data-flow/ (impl-done, raw-update-guard-scope)

## 검토 범위

- target: `spec/data-flow/` 번들 (`3-execution.md`, `2-auth.md`, `9-observability.md`, `14-chat-channel.md`, `15-external-interaction.md`, `0-overview.md`, `1-audit.md` + 11개 stub) + 관련 Rationale 발췌(`5-system/4-execution-engine.md`, `1-data-model.md`)
- 실제 code 변경(diff): `execution-engine.service.ts` `updateExecutionStatus` else 분기(§M-3, 옛 raw UPDATE)를 `dataSource.transaction` 으로 감싸고, 두 분기(`linkedNodeExec` 분기 / else 분기) 공통 종결부를 `finishStatusTransition` 으로 추출. 대응 spec 변경은 `spec/data-flow/3-execution.md` §2.1 스키마 매핑 표 `execution` 상태 전이 행(2026-08-30 각주)에 반영되어 있다.

## 발견사항

- **[WARNING]** else 분기 guarded UPDATE 를 트랜잭션으로 감싸는 원자성 확장 결정에 `## Rationale` 전용 항목이 없다 — schema 표 각주로만 존재
  - target 위치: `spec/data-flow/3-execution.md` §2.1 Postgres 스키마 매핑 표, `execution` "상태 전이" 행 (2026-08-30 각주) — 문서 끝 `## Rationale` 섹션(§371~410)에는 대응 항목 없음
  - 과거 결정 출처: (a) `spec/5-system/4-execution-engine.md` `## Rationale` "PR4 — BullMQ stalled 자동 재배달" 항의 하위 불릿 "**dead-letter 마감의 원자성 (2026-08-15 원자화)**" — 자매 2-테이블 쓰기(`cancelParkedExecution`/`markWebChatIdleTimeout`)가 이미 트랜잭션으로 원자화돼 있었는데 `finalizeStalledExhausted` 만 열려 있었다는 동일 유형의 발견을, 그때는 엔진 Rationale 문서에 날짜 딱지가 붙은 전용 불릿으로 기록했다. (b) `spec/data-flow/9-observability.md` `## Rationale` "liveness / readiness probe 분리 (기존 "/api/health = liveness" 결정 번복)" 항 — 이 프로젝트는 동작을 뒤집는 변경에 "(...번복)" 라벨을 단 전용 Rationale 항목을 다는 관행이 확립돼 있다.
  - 상세: 이번 변경은 else 분기 UPDATE 가 "애플리케이션 트랜잭션 밖이라 throw 가 롤백을 부르지 못한다"던 **기존에 명시적으로 인지되어 있던 한계**(구 코드 주석, ai-review `17_15_21` WARNING 1 대응 당시 문구)를 제거하고, 가드 throw 시 실제 롤백이 일어나도록 원자성 보장 범위를 넓힌다. 이는 "가드가 막으려던 무기한 대기가 가드가 발동한 순간에 생긴다"는, 이전에는 문서화되지 않았던 실제 결함(운영상 stuck 상태를 낳는 latent bug)을 근거로 한 결정이다. 규모·성격이 (a)의 dead-letter 원자화 결정과 동형인데, (a)는 spec Rationale 전용 불릿을 받았고 이번 건은 스키마 표 각주 한 줄로만 남아 "왜 이전엔 트랜잭션 밖이었는데 지금은 안인가"의 서사(구 한계 인지 → 실제 결함 발견 → 트랜잭션으로 감싸 해소)가 spec 상에는 드러나지 않는다. `## Rationale` 은 이 프로젝트 컨벤션상 "결정의 배경·근거"의 단일 저장 위치(CLAUDE.md 정보 저장 위치 표)이므로, 근거 서사 전체가 코드 JSDoc(`finishStatusTransition` 주석, `18_19_33` concurrency INFO 9 인용)에만 있고 spec 쪽엔 요약 각주만 있는 현재 상태는 그 컨벤션에서 다소 벗어난다.
  - 제안: `spec/5-system/4-execution-engine.md` `## Rationale` 에 "dead-letter 마감의 원자성 (2026-08-15 원자화)" 항과 형제로 "`updateExecutionStatus` else 분기 원자화 (2026-08-30)" 같은 짧은 항목을 추가해 (i) 이전 상태가 "트랜잭션 밖"으로 알려진 한계였다는 사실, (ii) 그 한계가 실제로 낳는 결함(가드 발동 시점에 무기한 대기 상태가 생성됨), (iii) 트랜잭션 원자화로 해소했다는 결론을 3줄 내외로 남기고, `3-execution.md` 의 각주는 그 항목을 가리키도록 링크만 남기면(현재 `#11-execution-상태` 링크는 §1.1 본문이지 Rationale 이 아님) 이 문서의 기존 스타일(예: 표 245행이 `#1.2` 본문을 가리키는 것과 동형)과도 정합하면서 근거 서사가 SoT 에 남는다. 이미 CRITICAL 은 아님 — 서사 자체는 코드 JSDoc 에 충실히 남아 있어 유실 위험은 낮다.

## 요약

target 스코프(`spec/data-flow/`, 특히 `3-execution.md`) 는 기존 `## Rationale` 에서 명시적으로 기각한 대안을 재도입하거나, 확립된 원칙(원자성 보장·park-release·rehydration 단일 경로·DB 원자 claim 계열 결정 등)을 위반하는 지점을 찾지 못했다. 오히려 diff 의 핵심 변경(else 분기 guarded UPDATE 를 트랜잭션으로 감싸 롤백 가능하게 함)은 `§1.1 원자성 보장` 원칙을 더 철저히 이행하는 방향이며, "자매 함수 한쪽만 고치는 drift" 를 경계하는 이 코드베이스의 반복 교훈(예: dead-letter 마감 원자화 사례) 과도 같은 결이다. 새 호출 제약("자신의 트랜잭션 콜백 안에서 부르지 말 것", 20개 호출부 lexical 대조)도 §7.5 재개-claim 결정이 `updateExecutionStatus` choke point 를 의도적으로 우회하는 기존 설계와 충돌하지 않는다. 유일한 지적은 이 원자성 확장 결정이 spec 의 정식 `## Rationale` 저장소가 아니라 스키마 표 각주 한 줄로만 남아, 이 프로젝트가 동급 결정(dead-letter 원자화, health probe 분리 등)에 적용해 온 "전용 Rationale 불릿 + (번복/원자화 등) 라벨" 관행에서 다소 벗어난다는 점이다 — WARNING 한 건.

## 위험도
LOW
