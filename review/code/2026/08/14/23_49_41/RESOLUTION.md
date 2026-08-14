# RESOLUTION — `23_49_41`

ai-review **CRITICAL 0 / WARNING 4**. 전부 조치.

**이 라운드의 정직한 요약: 넷 중 둘이 "내가 방금 열었던 파일에서 자매를 또 놓친 것"이다.**

## W2 — 같은 파일 161행은 고치고 150행은 안 봤다 (requirement)

**조치 완료.** 직전 라운드에서 `chat-channel-adapter.md` 의 산문(`:161`, *"`| string` 인
이유"*)을 정정하면서, **바로 위 `:150` 의 `EiaEvent` TS union** 이 `code: string`
(non-nullable)로 남은 걸 못 봤다. 같은 파일, 11줄 위다.

`code: string | null` 로 정정. 런타임 타입(`chat-channel/types.ts`)은 이 PR 이 이미
맞춰 뒀으므로 이제 spec union · 런타임 타입 · §6.4 세 곳이 일치한다.

## W3 — 하단 체크리스트만 갱신하고 본문 체크박스는 안 봤다 (documentation)

**조치 완료.** 같은 문서 안에 체크리스트가 **두 절**이다 — 본문 "이번 PR" 범위 선언용
(`:173,175,177`)과 하단 `## 체크리스트`. 하단만 `[x]` 로 바꾸고 본문은 `[ ]` 로 뒀다.

**네 번째 재발이다.** 그리고 직전 라운드에서 *"체크리스트가 커밋보다 늦은 것이 세 번째"*
라는 회고를 **바로 그 문서에 써 놓고** 재발시켰다. 회고를 쓰는 것과 그 회고가 가리키는
행동을 하는 것은 별개다.

> 이 저장소의 기록된 교훈이 정확히 이것이다 — *"본문 체크박스 + 하단 `## 체크리스트`
> 양쪽 동기화"*. 알고 있던 함정에 다시 빠졌다.

## W1 — sentinel `code` 가 wire 까지 가는지 아무도 안 봤다 (testing)

**조치 완료.** 이전 라운드에서 "`finalizeFailedExecution` emit 은 이미 덮인다" 고 뮤테이션으로
확인했는데, **그건 일반 에러 경로였다.** 리뷰어의 이번 지적은 다른 claim 이다 —
sentinel(`ErrorPortFallbackError`) 경로에서 `code` 가 **wire 까지 보존되는지**는 안 걸려
있었다(DB write 만 `ERROR_PORT_FALLBACK` 를 단언).

이 PR 의 요점이 *"DB 와 wire 를 같은 값으로"* 이므로 emit 단언에 sentinel code 를 고정.
`? { code: error.code }` → `? {}` 뮤턴트로 RED 확인.

> **교훈**: "뮤테이션으로 확인했다" 도 **어떤 뮤턴트냐**에 갇힌다. 일반 경로 뮤턴트가
> 죽는다고 sentinel 경로가 덮인 게 아니다. `--impl-done` 의 "실측했다는 측정 범위 안에서만
> 참" 과 같은 형태다.

## W4 — 외부 구독자 breaking change (api_contract)

**운영 확인 항목으로 등재.** `execution.failed` 의 `error` 형태 변경은 버전 협상 수단이
없는 저장소에서 CHANGELOG 만이 통지 경로다.

**저장소에서는 활성 구독자 유무를 알 수 없다** — notification config 는 워크스페이스별 DB
데이터다. 코드로 답할 수 없는 질문이라 plan 에 남겼고, 직전 PR 의 "이미 유출된 데이터"
항목과 **같은 워크스페이스 집합을 조회하면 함께 답이 나온다** 는 점을 연결해 뒀다.

완화 요인도 기록했다: 새 형태가 §6.4 의 **원래 목표 형태**와 일치하므로, 문서를 보고 짠
통합자는 이미 object 를 기대한다. 깨지는 쪽은 문서 대신 실제 wire 를 보고 짠 통합자다.

## INFO 넘김

| # | 처분 |
|---|---|
| 5 (`message`/`details` 마스킹) | 백로그 등재 유지. `details` 가 채워지기 전에 처리하라는 리뷰어 조언을 항목에 반영 |
| 6·7 (빈 객체 / message 없는 객체 경계) | 헬퍼가 `message: ''` 로 흡수 — 크래시 경로 아님. 3라운드 연속 같은 판단 |
| 8 (관용구 3중 반복) | 4번째에 헬퍼 추출 — 합의됨 |
| 9·10·13 (방어 범위·장문 주석·`null` vs `""`) | 기결정, 라운드마다 재확인됨 |
| 11 (`cancelled` 비대칭) | 범위 밖, plan 등재됨 |
| 12 (프로세스 산출물 비중) | 리뷰어가 전수 대조해 무단 확장 아님 확인 |
| 14 (user guide) | trigger 0건 |
| 15 | positive finding (prototype pollution 없음 · 캐스팅 제거 · DB↔wire drift 구조적 해소 · 프런트 narrowing) |

## 검증

- 백엔드 **424 suites / 8674 passed** · spec 가드 **2931** · lint 0 · 타입 199(래칫 동일)
- W1 판별력: sentinel code 보존 제거 뮤턴트에서 RED
