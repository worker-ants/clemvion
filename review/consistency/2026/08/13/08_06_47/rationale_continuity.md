# Rationale 연속성 검토 — `plan/in-progress/backend-lint-gate-broken-on-main.md`

## 발견사항

없음. target 문서가 재도입한 기각 대안, 위반된 합의 원칙, 무근거 번복, invariant 우회 사례를 찾지 못했다.

### 검토 근거 (참고)

- **EIA §R8 캐시 키 스코프 (핵심 항목)** — target 의 "idempotency 캐시 키가 execution/인증
  컨텍스트로 스코프되지 않는다" 항목(§후속)은 `spec/5-system/14-external-interaction-api.md`
  `## Rationale` R8 의 "캐시 키 스코프" 문단(선행 planner 턴 `eia-idempotency-key-scope`,
  #1156 에서 이미 SoT 로 확정)을 **그대로 구현**한다. 키 형식
  (`interaction:idempotency:<executionId>:<route>:<key>`) · execution 축 근거 · route 축
  근거 · "토큰이 아니라 execution 스코프" 원칙 · "ctx 부재 시 전역 fallback 금지, skip 만" —
  target 의 완료 서술이 R8 본문과 문구 단위로 일치한다. 새 결정이 아니라 이미 합의된
  Rationale 의 집행이므로 번복이 아니다.
- **R16 (`interact`/`cancel` 공통 ack DTO) 과의 경계 확인** — target 은 route 축 스코프링이
  "cancel 은 interact 의 편의 alias" (R16) 와 충돌하지 않는지 자체적으로 구분한다
  ("응답 DTO 형태가 같다는 뜻이지 캐시 네임스페이스를 공유한다는 뜻이 아니다") — 이 구분은
  R8 본문에 이미 명시된 문장을 그대로 옮긴 것으로, 새로 지어낸 정당화가 아니다.
- **Fail-open 정책 일관성** — target 의 "`IdempotencyInterceptor` fail-open 미준수" 수정
  항목은 `spec/data-flow/15-external-interaction.md` `## Rationale` "Fail-open 정책의 일관
  표기" 절이 명시한 "Redis/DB 미가용 시 fail-open (경고 로그)" 원칙을 **따르는 방향**으로
  `catchError` 를 추가했다 — docstring 을 좁히는 선택지(원칙 축소)를 배제하고 spec 이 요구한
  대로 구현을 고쳤다는 점에서 원칙을 위반하지 않고 오히려 정합시켰다.
- **기각 대안의 명시적 보존** — `deleteByPrefix` LIKE 이스케이프 후속 항목에서 target 은
  "mock 에 LIKE 해석기" 대안을 기각한 근거를 **의도적으로 보존**한다고 적었다("더 간단해
  보여 재도입 압력이 있는 대안이라, 근거를 지우면 다음 사람이 같은 선택을 다시 검토한다") —
  이는 본 checker 가 찾는 결함 패턴(근거 없는 재도입)을 target 스스로 예방한 사례다.
- **결정 번복에 새 Rationale 동반** — "ratchet 도입 여부"를 "전량 처분" 으로 뒤집은 항목은
  "전수 조사가 전제를 뒤집었다"(처분 불가능한 자리가 실제로는 0건이었다는 실측)를 번복
  근거로 명시했다 — 관점 3(무근거 번복) 에 해당하지 않는다.
- **문서-구현 괴리는 방치가 아니라 planner 인계로 기록** — `data-flow/15` 의 "4xx 캐시 제외"
  요약이 SoT(R8)보다 넓었던 선재 불일치, `4-execution-engine.md` §9.1 Redis 키 레지스트리
  누락 등은 target 이 스스로 해결권한 밖(`spec/` 은 developer 권한 밖, CLAUDE.md §Skill 체계)
  임을 인지하고 미해결 상태로 checkbox 를 열어 둔 채 planner 인계로 남겼다 — 이는 원칙 위반이
  아니라 권한 경계를 지킨 정상 처리다.

## 요약

target 문서(`backend-lint-gate-broken-on-main.md`)는 원래 lint 게이트 복구 plan 이었으나,
후속 §후속 절에서 이번 워크트리(`eia-r8-cache-scope`)가 다루는 idempotency 캐시 키 스코프
구현 이력까지 함께 기록한다. 그 구현은 `spec/5-system/14-external-interaction-api.md` §R8
Rationale — 이미 선행 planner 턴(#1156)이 "캐시 키 스코프" 문단으로 SoT 화해 둔 결정 — 을
문구 단위로 그대로 따르며, 기각된 대안은 근거와 함께 보존하고, 결정 번복은 매번 새 근거를
동반한다. Fail-open 원칙·R16 DTO 공유 원칙과의 경계도 spec 본문을 인용해 정확히 구분했다.
`spec/` 권한 밖의 잔여 불일치(§9.1 키 레지스트리 누락 등)는 해결하지 않고 planner 인계로
명시적으로 남겨 두어 은폐가 아니다. Rationale 연속성 관점에서 특기할 결함이 없다.

## 위험도

NONE
