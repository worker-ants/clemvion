# RESOLUTION — `review/consistency/2026/09/05/23_30_01`

**원 결과**: BLOCK: NO · Critical 0 · WARNING 1 · 위험도 MEDIUM

## WARNING 1 (convention_compliance) — 직전 fix 가 고친 위반을 다음 커밋이 다른 필드에 재도입

`66a2510fd` 가 `ScheduleDto.trigger` 의 필드 JSDoc 에서 리뷰 인용을 `//` 로 옮겼는데,
바로 다음 커밋 `48704becd` 이 **신규** `ScheduleTriggerRefDto.workflow` 필드 JSDoc 에
같은 형태를 다시 넣었다. 필드 JSDoc 은 `introspectComments` 로 **공개 OpenAPI
`description`** 이 되므로 문면상 위반을 넘어 실제 노출이다.

**수정** — checker 제안 그대로, 같은 파일의 `ScheduleDto.trigger` 가 쓰는 패턴에 맞췄다.
JSDoc 에는 소비자가 읽을 내용(**언제 채워지는가**)만 남기고, 정정 이력은 `//` 로 내렸다.

```ts
  /**
   * 연결된 워크플로우 — **키 생략형**이다 (§5.4 기준 (b): 선택적 부가 컨텍스트).
   *
   * **생성 응답에만 없다.** … 조회와 **수정**에는 채워진다 …
   *
   * 소비처가 부재를 정상 경로로 다룬다 — `schedules/page.tsx` 는
   * `s.trigger?.workflow?.name ?? ""` 로 읽는다.
   */
  // 종전 이 주석은 "생성·수정 응답에는 로드되지 않는다" 고 적었는데 **수정 쪽이 틀렸다**
  // (`review/code/2026/09/05/22_48_39` W3). 내부 참조는 `//` 에 둔다 — 필드 JSDoc 은
  // `introspectComments` 로 **공개 OpenAPI description** 이 된다 (`swagger.md §3`).
  @ApiPropertyOptional({ type: () => ScheduleTriggerWorkflowRefDto })
  workflow?: ScheduleTriggerWorkflowRefDto;
```

`ScheduleDto.trigger` 와 **줄 배치까지 동일**하게 맞췄다 (JSDoc 닫힘 → `//` 블록 →
데코레이터, 사이에 빈 줄 없음). 이 위반이 두 번 났으므로 "인용을 지운다" 가 아니라
**배치 패턴을 복제한다** 로 처리했다.

## INFO — 전부 이미 등재됨 (재확인만)

| # | 항목 | 상태 |
|---|---|---|
| 1 | nav-spec 에 `trigger`/`workflow` 키-생략 사유 미반영 | `spec-draft-nullable-notation-followups.md` 기등재 (planner) |
| 2 | `IntegrationDto.consecutiveNetworkFailures` 가 `4-integration.md §9.1` 미등재 | 동일 파일 기등재 |
| 3 | ratchet fixture 가 `code:` glob 밖 | 동일 파일 기등재 (planner 턴 우선순위 상향 권고) |
| 4 | PR 초안의 §5.4 금지 조합 재도입 → 같은 세션이 검출·정정 | 조치 불요 (해소 완료, CHANGELOG·plan 기록) |
| 5 | `TriggerDto.chatChannelHealth` 가 엔티티 타입 import | 저장소 전역 기존 패턴 6곳+, 이번 diff 고유 이탈 아님 — 범위 밖 |
| 6 | `secret-store.md §1` "노출 창 미마감" 문구가 이 브랜치 머지 시 거짓이 됨 | `spec-draft-notification-secret-storage.md` 가 조건부 처분으로 이미 걸어 둠. **developer 가 쓴 문장이 아니라 자기-반증형 소정정 대상 아님** → planner 턴 |
| 7 | 열린 체크박스 0인 plan 2건이 `in-progress/` 잔류 | 이 브랜치가 만든 문제 아님 — planner 턴 |
| 8 | `toResponse` vs `toResponseExecution` 명명 불일치 | 충돌 아님, 스타일 관찰 — 범위 밖 |

INFO #6·#7 은 **`spec/` 쓰기 권한 밖**이라 이 브랜치에서 집행하지 않는다. 둘 다 이미
plan 에 조건부/planner 턴으로 등재돼 있어 유실 위험이 없음을 확인했다.

## 이번 라운드에 새로 등재한 것

코드 리뷰 `23_30_00` 의 security WARNING 2건을 같은 tracker 에 등재했다 — deny-list 4벌의
선언적 SoT 승격, 열린 `config` 맵 비밀의 e2e 동반 의무. 후자는 규약 문서 편집이라
**planner 트랙**으로 적었다.

## 검증

lint PASS · unit PASS (backend 447 suites / 9,422) · build PASS · e2e PASS 297.
