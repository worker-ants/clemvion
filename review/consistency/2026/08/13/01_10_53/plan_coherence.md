### 발견사항

- **[WARNING]** `data-flow/15` §4 "전 경로 fail-open (warn)" 서술의 stale 정도가 이번 diff로 더 벌어졌는데 plan 미갱신
  - target 위치: `spec/data-flow/15-external-interaction.md` §4 외부 의존 표, "Redis | 내부 | blacklist · idempotency · seq · BullMQ. 전 경로 fail-open (warn) — 가용성 우선" 행
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` L648-663 (`- [ ]` "`data-flow/15` 의 '전 경로 fail-open (warn)' 이 실제보다 한 칸 넓다", `23_48_39` rationale_continuity INFO 1, planner 인계)
  - 상세: 이 plan 항목은 두 가지를 "같은 스코프로" 처리하라고 명시한다 — (1) 기동 시 미주입 경로는 warn 이 없다는 정정, (2) 프레이밍을 "미가용" 단일 축에서 "미가용 또는 손상" 두 축으로 확장. 이번 diff(`idempotency.interceptor.ts` 클래스 docstring)는 정확히 이 두 가지를 **코드 주석에서는** 이미 구현했다 — 5-path 표(`| 1 | 기동 시 미주입 | … | — (설정 상태이지 장애가 아니다) |`, `| 5 | 캐시 엔트리·payload 손상 | … | ✓ |`)로 두 축을 명시적으로 분리했다. 반면 target 문서 `spec/data-flow/15-external-interaction.md` §4 는 여전히 "전 경로 fail-open (warn) — 가용성 우선" 단일 축 서술 그대로다. 코드 SoT(docstring)와 spec 서술 사이의 간극이 이번 PR로 더 정밀하게 드러났는데, plan L648 항목에는 "이 PR 이 corruption 축 구현을 완료해 트리거 조건이 충족됐다"는 갱신이 반영되지 않았다.
  - 제안: developer 권한 밖(spec 쓰기)이라 이번 PR 이 target 을 직접 고칠 필요는 없지만, `backend-lint-gate-broken-on-main.md` L648 항목에 "corruption 방어 구현 완료(본 PR, 커밋 `22e68459d`/`86de12278`/`c29290c71`) — 착수 가능" 한 줄을 추가해 다음 planner 턴이 즉시 반영할 수 있게 하는 것이 좋다. (동일 파일 L732 §R8 항목이 이미 이 패턴 — "선행 조건 해소 … 이제 착수 가능" — 을 쓰고 있어 선례가 있다.)

### 요약
`spec/data-flow/15-external-interaction.md`(EIA idempotency 캐시) 관련 미해결 plan 항목은 `backend-lint-gate-broken-on-main.md` 한 곳에 극히 상세하게(라운드별 뮤테이션 실측·RESOLUTION 이력 포함) 추적되고 있고, 이번 diff(`idempotency.interceptor.ts`/`.spec.ts` — 캐시 엔트리·payload 손상 방어 + `isIdempotencyEntry`/`isHttpStatusCode` 형태 가드 + `readKey`/`hashBody` 경계 테스트)의 모든 변경 사항은 그 plan 파일의 이미 `[x]` 완료 처리된 항목들과 커밋 단위로 정확히 일대일 대응한다(`git log` 로 확인: 22e68459d·86de12278·c29290c71·6cee73065·f2785d8a0). §R8 캐시 대상(2xx·409·410) 관련 선행 spec 정합화(`spec-draft-eia-r8-alignment.md`, `#1154`)도 이미 완료·머지돼 있어 이번 diff 가 가정하는 사전 조건은 충족된 상태이며, "결정 필요"로 남은 항목(예: `CCH-SE-02` dedup 배선)을 이번 diff 가 우회하지도 않았다. 유일하게 남는 것은 이미 열려 있는 plan 항목(L648, spec §4 fail-open 서술의 정밀도 부족)의 트리거 조건이 이번 PR 로 코드 측에서는 충족됐는데 plan 텍스트에 그 사실이 아직 반영되지 않은 경미한 followup 이다.
### 위험도
LOW
