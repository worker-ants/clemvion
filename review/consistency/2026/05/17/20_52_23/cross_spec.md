# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전 검토)
검토 범위: `cafe24-call-401-retry`

> Target 문서 본문이 `(없음)` — 신규 spec draft 가 아닌 **순수 코드 구현 착수 전 검토**다.
> 구현 의도는 `plan/in-progress/cafe24-call-401-retry.md` 에 기술되어 있다.

---

## 발견사항

### 발견사항 1

- **[CRITICAL]** `spec/4-nodes/4-integration/4-cafe24.md §6.1` — 구현 의도와 직접 모순
  - target 위치: `plan/in-progress/cafe24-call-401-retry.md` "갭 위치 / 목표" 절 — `executeWithRateLimit()` 401 수신 시 refresh 후 1회 재시도 추가
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md §6.1 인증 실패 자동 status 전환` 마지막 줄
    > "자동 복구 없음 — 토큰이 다시 유효해지면 사용자가 명시적으로 `Reauthorize` 로 `connected` 복귀."
  - 상세: §6.1 은 401/403 응답 시 즉시 `CAFE24_AUTH_FAILED` + `error(auth_failed)` 전이를 명시하고, **"자동 복구 없음"** 을 규범적으로 선언한다. 구현이 이 문장이 존재하는 상태로 머지되면 코드가 spec 을 위반하는 상태가 된다. 다른 spec 인 `spec/5-system/11-mcp-client.md §8.4` 도 동일 정책("자동 복구는 하지 않는다 — 운영 가시성")을 독립적으로 선언하고 있어, 충돌이 2개 문서에 걸쳐 있다.
  - 제안:
    - 코드 구현 **이전** 또는 **동시** PR 로 `spec/4-nodes/4-integration/4-cafe24.md §6.1` 의 "자동 복구 없음" 문장을 `spec-update-cafe24-call-401-retry.md` 의 제안 본문으로 대체해야 한다.
    - `spec/5-system/11-mcp-client.md §8.4` 의 동일 정책 문장("자동 복구는 하지 않는다 — 토큰이 다시 유효해지면 ... 운영 가시성을 해친다") 도 범위에 포함되는지 project-planner 가 검토해야 한다. MCP Bridge 는 `executeWithRateLimit()` 을 공유하므로 동일 코드 경로가 적용될 가능성이 높다.
    - plan 의 `문서·플랜` 항목에서 이미 `spec-update-cafe24-call-401-retry.md` 가 분리 위임으로 작성되어 있으나, spec 갱신 PR 이 코드 PR 보다 **이후** 로 계획된 점이 CRITICAL 위험의 원인이다. 순서를 역전하거나(spec 먼저) 동일 PR 에서 처리해야 한다.

---

### 발견사항 2

- **[WARNING]** `spec/2-navigation/4-integration.md §10.5` — 구현이 커버하는 경로가 spec 에 미명시
  - target 위치: `plan/in-progress/cafe24-call-401-retry.md` "목표" 절 — `call() → executeWithRateLimit` 경로에 401 자동 회복 이식
  - 충돌 대상: `spec/2-navigation/4-integration.md §10.5 토큰 자동 갱신`
  - 상세: §10.5 는 "노드 실행 **직전** 만료 확인 → 만료됐으면 갱신 후 호출"(proactive) 만 정의한다. 실행 **도중** 401 수신 → refresh → 재시도(reactive) 경로는 §10.5 어디에도 없다. spec 이 없는 상태로 코드만 추가되면 §10.5 의 정의가 불완전한 상태가 유지된다. 이는 발견사항 1 의 spec 갱신 시 함께 해소되어야 한다. `spec-update-cafe24-call-401-retry.md` 가 §10.5 갱신 제안을 이미 포함하고 있으므로 중복 작업은 없으나 타이밍이 관건이다.
  - 제안: `spec-update-cafe24-call-401-retry.md` 의 §10.5 추가 bullet 을 코드 PR 과 함께(또는 선행하여) 반영. 코드 단독 머지는 spec 드리프트 상태를 의도적으로 생성하는 것이므로 plan 의 "코드 머지 후 spec 갱신 따라온다" 순서를 재검토 권장.

---

### 발견사항 3

- **[WARNING]** `spec/5-system/11-mcp-client.md §8.4` — MCP Bridge 경로의 정책 변경 범위 불명확
  - target 위치: `plan/in-progress/cafe24-call-401-retry.md` 전체 — MCP 호출 경로(`executeWithRateLimit`)에 401 자동 회복 추가
  - 충돌 대상: `spec/5-system/11-mcp-client.md §8.4` — "자동 복구는 하지 않는다"
  - 상세: Cafe24 노드와 AI Agent MCP Bridge 는 같은 `Cafe24ApiClient.executeWithRateLimit()` 를 공유한다. 코드 변경이 두 경로 모두에 적용된다면 MCP Bridge spec §8.4 도 갱신이 필요하다. 반대로 MCP Bridge 는 기존 정책(즉시 격하)을 유지하고 싶다면 `executeWithRateLimit` 내에 caller-context 분기가 필요하며 이는 설계 복잡도 상승이다. plan 이 이 범위를 명시하지 않았다.
  - 제안: `spec-update-cafe24-call-401-retry.md` 의 갱신 제안이 §10.5 만 타깃하고 §8.4 (MCP Bridge) 를 명시적으로 포함하거나 제외하는지 project-planner 와 개발자가 명확히 결정해야 한다. Internal MCP Bridge 경로가 같은 자동 회복 혜택을 받는 것이 의도인지 여부.

---

### 발견사항 4

- **[INFO]** `plan/in-progress/cafe24-call-401-retry.md §문서·플랜` — spec-코드 순서 역전 위험 명시 부재
  - target 위치: `plan/in-progress/cafe24-call-401-retry.md` 체크리스트 — `[x] spec-update 위임 완료`, `[ ] 본 PR 머지 시 spec 갱신은 별 PR`
  - 충돌 대상: CLAUDE.md `개발 방법론` — "모든 개발은 반드시 SDD(Spec-Driven Development) 로 접근"
  - 상세: 현 plan 은 코드 PR 을 spec 갱신 PR 보다 먼저 머지하는 흐름을 기술하고 있다. 이는 SDD 규약의 "spec 이 코드보다 선행" 원칙과 충돌한다. Critical 위험은 아니나, spec이 코드를 뒤쫓는 드리프트 윈도우가 생긴다.
  - 제안: plan 의 `문서·플랜` 체크리스트에 "코드 PR 머지 전 §6.1/§10.5 spec 갱신 PR 머지 완료" 또는 "동일 PR 에 spec 갱신 포함" 을 명시. 별 PR 분리가 불가피하면 spec 갱신 PR 이 코드 PR 보다 선행되어야 함을 기록.

---

## 요약

구현 착수 대상(`cafe24-call-401-retry`)은 `spec/4-nodes/4-integration/4-cafe24.md §6.1` 의 **"자동 복구 없음"** 조항과 직접 모순되는 코드 변경을 계획하고 있다. 같은 정책이 `spec/5-system/11-mcp-client.md §8.4` 에도 독립적으로 명시되어 있어 충돌이 2개 spec 문서에 걸쳐 있다. plan 은 이미 spec 갱신 위임(`spec-update-cafe24-call-401-retry.md`)을 생성했으나 코드 머지 이후로 spec 갱신을 뒤로 미루는 순서를 채택해 SDD 원칙과 어긋난다. 코드 구현 착수 전에 §6.1 의 "자동 복구 없음" 문장을 포함한 spec 갱신을 완료하거나, 동일 PR 에 spec 변경을 포함해야 CRITICAL 위험이 해소된다. §8.4 (MCP Bridge) 의 정책 적용 범위도 의사결정이 선행되어야 한다.

---

## 위험도

**HIGH**
