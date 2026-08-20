# RESOLUTION — 14_00_15

대상 SUMMARY: `review/code/2026/08/17/14_00_15/SUMMARY.md` (위험도 **MEDIUM**, Critical **0**, WARNING **5**, INFO 9)

**처분: WARNING 5건 전부 조치 + INFO 3건 반영.** 병행한 consistency `14_00_50`(BLOCK: NO)의
WARNING 1건도 같은 턴에 처리했다.

> 이 세션은 주간 한도로 전 에이전트가 죽어 리포트 0건이었다가, 한도 리셋 후 **같은 세션·같은
> 프롬프트로 재실행**해 채웠다. 코드는 그동안 `45ba37792` 로 동결돼 있었고 diff base
> (`origin/main`)도 움직이지 않아 프롬프트가 그대로 유효했다.

---

## WARNING 1 — 미러에 회귀 테스트가 없었다 (testing) — **수정**

리뷰어의 뮤턴트를 그대로 재현해 확인했다. `websocket.service.ts` 의
`CREDENTIAL_KEY_PATTERN` 을 변경 직전 목록으로 되돌려도 **48건 전원 GREEN** — 내가 "의도된
미러" 라고 주석에 써 놓은 그 변경에 안전망이 **전혀** 없었다.

원인은 명확했다. 그 파일에는 이미 *"전체 키 패턴 집합"* 을 도는 테스트가 있는데 **키 목록이
옛 집합 그대로**여서, 계열 확장을 되돌려도 신호를 못 냈다. 목록 자체가 커버리지인데 그것을
안 늘렸다.

- 그 테스트의 키 목록에 계열 5종 추가 (`x-auth-token`·`csrf_token`·`csrfToken`·
  `session_token`·`id_token`) — 자매 파일(`sanitize-error-message.spec.ts`)의 `FAMILY` 와 같은 축
- **오탐 경계 캐너리 신설** — `tokenizer` 는 보존, `nextPageToken` 은 마스킹

**재검증(뮤테이션)**: 같은 뮤턴트 → **2 RED**(수정 전 0 RED). 미러가 이제 신호를 준다.

- `codebase/backend/src/modules/websocket/websocket.service.spec.ts`

## WARNING 2 — 공용 JSDoc 이 이 diff 로 자기모순이 됐다 (documentation) — **수정**

기존 문단은 *"`x-api-key` / `x-auth-token` 을 공용에만 추가로 담는다"* 고 단언하는데, 이번
diff 의 계열 대안이 **양쪽 파일에** 들어가면서 `x-auth-token` 은 WS 도 덮게 됐다. 즉 내가
바로 위 문단을 거짓으로 만들어 놓고 정정하지 않았다.

- "additionally covers" 를 `x-api-key` 하나로 좁힘
- 계열 대안이 **양쪽에** 착지해 `x-auth-token` 은 이제 공유이고, **남은 비대칭은 `x-api-key`
  하나이며 의도된 것**임을 명시

- `codebase/backend/src/shared/utils/sanitize-error-message.ts`

## WARNING 3 — CHANGELOG 관행 이탈 (documentation) — **수정**

이 이니셔티브의 직전 4커밋이 전부 `Unreleased` 절을 남겼는데 이번만 빠졌다. 같은 포맷으로
추가했다 — 3축 결함, 계열 통합, **범위 결정(#4 `maskSensitiveFields` 미포함)**, 흡수한 MCP
패턴, 받아들이는 오탐, 그리고 반증된 트래커 전제.

- `CHANGELOG.md`

## WARNING 4 — 주석 블록 컨벤션 불일치 (maintainability) — **수정**

같은 선언을 설명하는 인접 두 블록이 `/** */` 와 `/* */` 로 갈렸다. 자매 파일은 하나의 JSDoc
안에 문단으로 병합하는 방식이다. 신규 블록을 기존 JSDoc 에 문단으로 흡수했다.

같은 편집에서 **INFO 1** 도 처리 — 미러의 범위를 명시했다(`x-api-key` 는 REST 표면 전용
확장이라 동기화 대상이 아니다). "함께 갱신한다" 만 적어 두면 이 비대칭까지 미러로 오독된다.

- `codebase/backend/src/modules/websocket/websocket.service.ts`

## WARNING 5 — 내 뮤테이션 수치가 틀렸다 (requirement) — **수정, 다만 리뷰어 수치도 틀렸다**

리뷰어는 내 "8 RED" 가 실제로는 5 RED 라고 했다. **둘 다 틀렸다** — 직접 재실행하니 **6 RED**
이고, 실패 집합은 `id_token`·`csrf_token`·`csrfToken`·`session_token`·`x-auth-token` +
캐너리 `nextPageToken` 이다. 리뷰어는 `x-auth-token` 을 빠뜨렸다(그쪽 뮤턴트가 그 대안을
남겨 뒀을 것이다).

숫자만 적으면 재현이 안 돼 이런 일이 생긴다. plan 에 **뮤턴트를 명시**하고(각 축의 계열
대안을 변경 직전 목록으로 되돌린다), 왜 옛 목록이 이미 담고 있던 3건은 세면 안 되는지까지
적었다.

- `plan/in-progress/eia-secret-pattern-token-family.md`

---

## consistency `14_00_50` WARNING 1 — **수정**

*"`token` 계열이 닫혔다"* 는 §R17 서술이 **구현보다 넓었다** — `maskSensitiveFields` 축은 여전히
접두 계열을 통과시킨다. 이 저장소가 반복해 온 "문서한 보장이 구현보다 넓다" 클래스라
§R17 에 캐비엇을 넣어 **두 축에 한한 서술**임을 못박고 잔여 ③ 과 연결했다.

- `spec/5-system/14-external-interaction-api.md`

## INFO 반영 (3건)

| # | 처분 |
|---|------|
| 1 | 미러 범위 명시 — W4 편집에 흡수 |
| 7 | plan "설계" 절 정규식이 shipped 코드와 비동치 → 실제 두 정규식으로 교체하고 왜 단순화했는지 기록 |
| 8 | 쿼리스트링 테스트에 `state=x` 보존 단언 추가 — 자매 테스트가 이미 하는 것이고, 없으면 패턴이 줄 전체를 삼켜도 초록이다 |

**미반영 INFO (6건)** — 2·3·4·5 는 리뷰어 자신이 "조치 불필요" 로 판정했거나 이미 트래커가
소유한다. 6(MCP no-op 루프 인라인 주석)·9(ReDoS 벤치마크 자동화)는 선택 항목이라 코드
라운드를 더 열지 않는다. 9 는 벤치마크가 plan 에 실측으로 남아 있고 패턴이 단일 `*`+리터럴
(중첩 정량자 없음)이라 회귀 위험이 낮다.

## 검증

fix 반영 후 TEST WORKFLOW 4단계 전부 PASS:

| 단계 | 결과 |
|---|---|
| lint | PASS (51s) |
| unit | PASS — backend 427 suites / **8,832** · frontend 6,030 · 내부 packages 451 |
| build | PASS (65s) |
| e2e | PASS — backend supertest 276 + playwright 51 |

> e2e 가 한 번 `duration=0s` 로 FAIL 했는데 Docker 데몬이 꺼져 있었던 것이다(회귀 아님).
> 데몬 기동 후 정상 통과.
