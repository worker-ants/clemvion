# Rationale 연속성 검토 결과

대상: `plan/in-progress/spec-draft-eia-idempotency-key-scope.md` (spec draft, `--spec` 모드)
비교 대상: `spec/5-system/14-external-interaction-api.md` §Rationale (R1~R19), `spec/data-flow/15-external-interaction.md` §Rationale, `spec/0-overview.md`·`spec/1-data-model.md` 등 번들 Rationale 전체

## 발견사항

- **[INFO]** R16 "cancel = interact 의 편의 alias" 문구와의 오독 가능성 선제 차단 제안
  - target 위치: `## 스코프 식별자를 무엇으로 할 것인가` 및 `## 제안 변경 §3` (§R8 Rationale 추가 예정 문단)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` R16 — "`/cancel` 이 `interact` 의 편의 alias 라는 성격상 같은 ack 를 쓰는 것이 자연스럽고 …"
  - 상세: R16 은 `cancel`·`interact` 가 **응답 DTO 형태**(`InteractAckDto`)를 공유해야 한다는 결정이다. target 이 이번에 추가하는 축 2(엔드포인트별 캐시 키 분리)는 **캐시 네임스페이스** 얘기라 R16 과 층위가 다르지만, "alias" 라는 단어만 보고 "그러면 캐시도 공유해야 하는 것 아닌가" 로 오독될 여지가 있다. 실제로는 상충하지 않는다 — target 의 CancelDto `{}` vs interact 빈 body 충돌 시나리오는 R16 이 다루지 않은 새 관찰이다.
  - 제안: §R8 Rationale 에 새로 쓸 문단에 "R16 의 alias 는 응답 DTO 형태 공유를 의미할 뿐 idempotency 캐시 네임스페이스 공유를 의미하지 않는다" 한 줄을 명시하면 향후 구현자가 "alias 니까 같은 키를 써도 되지 않나" 로 축 2 를 되돌리는 시도를 사전 차단할 수 있다.

- **[INFO]** 유사 선례 인용 가능 — `background execution context` 키 분리 사례
  - target 위치: `## 스코프 식별자를 무엇으로 할 것인가` 전반
  - 과거 결정 출처: 실행 컨텍스트 관련 Rationale (bundle L2445 부근, `executeBackgroundSubgraph` in-memory context 키 분리 — `bg:<executionId>:<backgroundRunId>`)
  - 상세: "공유 키 네임스페이스에서 서로 다른 두 주체가 충돌 → 세그먼트 추가로 스코프 분리" 라는 동일 패턴이 이미 이 저장소에서 한 번 검증된 해법이다(부모/백그라운드 실행이 `executionId` 를 공유 in-memory Map 키로 써서 발생한 상호 오염을 `bg:<executionId>:<backgroundRunId>` 로 해소). target 의 `interaction:idempotency:<executionId>:<endpoint>:<key>` 설계는 이 선례와 구조적으로 동형이다.
  - 제안: 필수 수정 아님. §R8 신규 문단에 이 선례를 한 줄 인용하면 "임기응변" 이 아니라 "저장소에 이미 검증된 패턴의 재사용" 이라는 근거가 보강된다.

## 교차 검증 메모 (참고용, 발견사항 아님)

- `spec/5-system/14-external-interaction-api.md` R8 은 **무엇을 캐시하는가**(2xx/409/410, 400 VALIDATION_ERROR 제외, 5xx 제외)만 규정하고 **어디에 캐시하는가**(키 네임스페이스)는 어느 Rationale 에도 없음을 실측 확인했다(`interaction`·`idempotency`·`네임스페이스`·`전역` 전수 grep). 즉 target 이 다시 채택하려는 "과거 기각된 대안" 은 존재하지 않는다 — 이번 draft 는 **기존 Rationale 의 공백을 최초로 메우는 것**이지 번복이 아니다. target 스스로도 이 공백을 §3 제안에서 명시하고 새 Rationale 문단 추가를 계획하고 있어, "결정의 무근거 번복" 리스크는 target 이 자기 완결적으로 차단했다.
- target 이 "토큰 jti 로 스코프하면 안 된다" 며 기각하는 대안은 R4("per_execution 토큰 default, 짧은 TTL + 갱신") 와 EIA-RL-02("동일 키 24h 동일 응답 재현")를 정확히 근거로 들고 있다 — 토큰 회전 후 재시도가 다른 키로 떨어지면 EIA-RL-02 요구사항이 깨진다는 논증은 기존 Rationale 과 완전히 정합한다.
- "가드 미적용 시 캐시를 건너뛰고 전역 키로 fallback 하지 않는다"는 처분은 `spec/data-flow/15-external-interaction.md` §Rationale "Fail-open 정책의 일관 표기"(Redis/DB 미가용 시 기능 저하 + warn 로그, 실행 자체는 막지 않음)의 취지를 그대로 확장한 것으로, 기존 원칙과 배치되지 않는다.
- `spec/5-system/14-external-interaction-api.md` L548 ("같은 execution 의 같은 노드에 대한 두 inbound 명령 … 클라이언트는 Idempotency-Key 를 동봉하여 첫 명령의 응답을 재조회") 은 이미 "동일 execution 내 재현" 을 전제로 서술돼 있어 target 의 execution 스코프 설계와 모순 없이 정합한다.
- target 이 인용한 표 항목 위치(EIA-IN-11 L81, EIA-RL-02 L140, data-flow L93/L98/L258)는 실제 파일과 대조해 모두 실측 일치했다(라인 앵커 정확성은 본 checker 범위 밖이나 참고로 확인).

## 요약

target 은 기존 `## Rationale` 에서 명시적으로 기각된 대안을 재도입하지 않으며, 합의된 설계 원칙(R4 의 per_execution 토큰 회전, EIA-RL-02 의 24h 재현 계약, data-flow 의 fail-open 정책)을 정확히 근거로 삼아 스코프 식별자를 선택했다. 이번 변경은 과거 결정의 "번복" 이 아니라 R8 이 다루지 않았던 키 네임스페이스라는 **공백을 메우는 최초 결정**이며, target 스스로 §R8 에 새 Rationale 문단을 추가할 계획까지 포함하고 있어 "무근거 번복" 리스크를 자체적으로 차단했다. R16(alias 문구) 과의 표면적 오독 가능성 및 유사 선례(백그라운드 컨텍스트 키 분리) 인용 여지 두 가지만 INFO 로 제안한다.

## 위험도
LOW
