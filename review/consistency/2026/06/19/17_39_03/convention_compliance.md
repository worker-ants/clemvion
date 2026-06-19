# 정식 규약 준수 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep)
Target: `spec/5-system/4-execution-engine.md`

---

## 발견사항

### [INFO] Redis 키 네이밍 — 전역 키 3종의 §9.1 패턴 예외가 이미 명시돼 있음
- target 위치: §9.2 하단 NOTE (`exec:recover:lock`, `exec:cont:seq:*`, `exec:seq:*`)
- 위반 규약: 해당 없음 (위반 아님 — 예외 사유가 명시돼 있음)
- 상세: 세 키는 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴을 의도적으로 따르지 않으며 그 이유(워크스페이스 비종속 전역 책임)가 NOTE 로 문서화돼 있다. 규약 위반이 아니라 허용된 예외 설계다.
- 제안: 변경 불필요. 단, 향후 전역 키가 추가될 때는 동일 NOTE 에 추가 등재하는 관행 유지.

### [INFO] §9.2 heartbeat 키 — §7.1 "별도 heartbeat 채널 신설하지 않는다" 와 미상태 정합
- target 위치: §9.2 `exec:{wsId}:worker:{workerId}:heartbeat` 행 (TTL 15초)
- 위반 규약: `spec/conventions/error-codes.md §3` `WORKER_HEARTBEAT_TIMEOUT` 설명 ("별도 heartbeat 채널을 신설하지 않는다"), §7.1 동일 진술
- 상세: §9.1 `sub` 예시에 `heartbeat` 가 열거돼 있고 §9.2 에도 `exec:{wsId}:worker:{workerId}:heartbeat` 키(TTL 15초)가 정의돼 있다. 반면 §7.1 은 "별도 heartbeat 채널 신설하지 않는다"고 명시한다. §9.2 의 heartbeat 키 행에 "Planned" 또는 "미사용" 여부 표시가 없어 구현 상태가 불명확하다.
- 제안: §9.2 의 해당 행에 "(Planned — §7.1 stalled-job 일원화 전까지 미사용)" 또는 현 구현 상태를 나타내는 메모를 추가해 §7.1 과의 정합을 명시한다.

### [WARNING] 에러 코드 `INVALID_STATE`(REST 422) — error-codes.md 중앙 카탈로그 미등재
- target 위치: §7.5.1 "REST 진입점은 422 `INVALID_STATE` 반환 … 의도적 분리"
- 위반 규약: `spec/conventions/error-codes.md §1` "에러 코드 이름은 조건의 의미를 기술한다"; §2 "에러 코드 rename 은 breaking change" — 코드 카탈로그 단일 진실 원칙
- 상세: `INVALID_STATE`(REST 422) 와 `INVALID_EXECUTION_STATE`(WS ack) 는 동일 개념의 두 표면이고, 이중 분리 의도가 §7.5.1 본문에만 설명돼 있다. `spec/conventions/error-codes.md §3`(Historical-artifact) 또는 §5(Rename 이력)에 두 코드의 관계·분리 근거가 등재돼 있지 않아, 클라이언트 코드 작성자가 어느 코드로 분기해야 하는지 단일 진실을 conventions 에서 찾을 수 없다. error-codes.md §1 의 "클라이언트는 코드의 의미로 분기하며 코드의 *정의(spec 본문)* 가 진실"이라는 원칙상 spec 본문(본 §7.5.1)이 진실 역할을 하고 있으나, conventions 문서와 연계 없이 분산돼 있어 관리 표류 위험이 있다.
- 제안: `spec/conventions/error-codes.md §3` 또는 §4 에 `INVALID_STATE`(REST-only historical 표기) 와 `INVALID_EXECUTION_STATE`(WS-only) 의 분리 의도·참조 SoT 를 짧게 등재하거나, 본 §7.5.1 에 `error-codes.md` 로의 cross-link 를 추가해 탐색 경로를 일원화한다. 또는 spec 작성자가 error-codes.md §3 Historical-artifact 에 `INVALID_STATE`(lower-case 아님이지만 REST/WS 분리를 위한 intentional divergence)로 명시하는 것도 적절하다.

### [INFO] Frontmatter `status: partial` + `pending_plans` 4개 — 규약 준수 확인
- target 위치: 파일 최상단 frontmatter
- 위반 규약: 해당 없음 (규약 준수)
- 상세: `spec/conventions/spec-impl-evidence.md §3` 에서 `status: partial` 시 `pending_plans` 의무를 요구하며, 4개 plan 경로가 모두 `plan/in-progress/` 에 기재돼 있다. `spec-pending-plan-existence.test.ts` 빌드 가드 기준 정상.
- 제안: 변경 불필요.

### [INFO] `NodeHandlerOutput.status` 인터페이스 — `string` 광범위 타입 선언
- target 위치: §5.1 `NodeHandlerOutput.status?: string`
- 위반 규약: `spec/conventions/node-output.md Principle 0` 5필드 invariant에서 `status` 허용 값을 `waiting_for_input | resumed | ended` 등으로 열거
- 상세: 인터페이스 선언에서 `status?: string` 광범위 타입이고, 허용 값은 §1.3 표에서 별도 열거한다. 규약 위반보다 타입 명세의 정밀도 문제다. 구현 코드에서 union literal 이 강제되는지 spec 범위 밖이나, spec 계약 표면 자체에서 허용 값이 인터페이스와 동일 위치에 있지 않다.
- 제안: `NodeHandlerOutput.status` 의 JSDoc 또는 타입 별칭에서 §1.3 표의 허용 값(`'waiting_for_input' | 'resumed' | 'ended' | 'requires_integration' | 'requires_playwright'`)을 spec 상에서도 명시하면 node-output.md 와의 정합이 더 명확해진다.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 정식 규약 준수 관점에서 전반적으로 양호하다. `spec/conventions/spec-impl-evidence.md` Frontmatter 스키마를 완전히 충족하고, `spec/conventions/error-codes.md §1` 의미 기반 명명 원칙을 따르며, `spec/conventions/node-output.md` Principle 4 블로킹/재개 컨트랙트를 §1.3에서 상세히 반영하고 있다. 문서 구조(Overview·본문·Rationale 3섹션)도 충족한다. 유일한 WARNING 은 `INVALID_STATE`(REST 422) 코드가 `spec/conventions/error-codes.md` 중앙 카탈로그에 등재되지 않아 단일 진실이 분산된 점이며, 구현 착수 전 차단 수준이 아니라 error-codes.md 갱신 또는 cross-link 추가로 해소 가능하다. 나머지는 모두 INFO 수준 형식 일관성 제안이다.

---

## 위험도

LOW
