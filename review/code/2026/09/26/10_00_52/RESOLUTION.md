# RESOLUTION — `review/code/2026/09/26/10_00_52` (1라운드)

SUMMARY: Critical 0 · Warning 3 · INFO 8. forced 6명 전원 리포트 확보(`forced_missing` 없음).
정지 규칙(결과 보기 전 선언): «Critical 0 · Warning 0 · 그 라운드 codebase 수정 0건» — 이 라운드는 codebase 를 고쳤으므로
**2라운드를 돈다**.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
| --- | --- | --- |
| W1 상태 변경 4라우트의 성공 경로 e2e 부재 | 새 e2e `codebase/backend/test/action-success-status.e2e-spec.ts` — 인증 설정 재발급(200 · 같은 id) · 초대 수락(200 · 합류 워크스페이스) · 나가기(200 `{ok:true}` · 멤버십 행 0) · 초대 취소(200 `{ok:true}` · 초대 행 0). 상태만이 아니라 효과까지 본다(«아무 일도 안 하고 200» 과 구별). 초대 생성의 throttle backoff 를 `createInvitation` 헬퍼로 떼어 `inviteAndAccept` 와 공유 | `f5b10f57b` |
| W2 14곳의 wire-level 성공 코드 변경 = 외부 소비자에게 breaking | **코드 변경 없음 — 기조치.** CHANGELOG 항목이 변경 목록과 «`=== 201` 로 비교하는 외부 호출자는 확인할 것» 을 싣고, 저장소 내 소비자(`frontend` · `channel-web-chat` · `packages`)의 201 정확 비교는 0건(grep), assistant SSE 클라이언트는 `response.ok` 판정. 리뷰어 제안도 «배포 전 한 번 더 확인» 이라 PR 본문에 같은 경고를 싣는다 | — |
| W3 `regenerate` 의 `@HttpCode` 가 주석 · `@Roles` 앞 | `@Roles('admin')` 뒤로 이동 — 14곳 중 이 자리만 어긋났다(diff 전수 확인) | `f5b10f57b` |
| INFO1 리뷰 중 `regenerate` 의 `@HttpCode` 가 잠시 사라짐 | 리뷰 종료 후 `git status --short` 에 codebase 변경 없음 · 파일 원상 확인 — 리뷰어의 뮤테이션 검증 흔적(원복됨). 결함 아님 | — |
| INFO4 `workflow-crud` import `[200, 201]` | `201` 로 조임(`importWorkflow` 는 `@HttpCode(HttpStatus.CREATED)`). e2e 의 `[200, 201]` 은 0건 | `f5b10f57b` |
| INFO2 · INFO6 · INFO7 · INFO8 | 조치 불요(범위 밖 · 정상 확인 · 모범 사례 기록) | — |
| INFO5 `judgeHandler` 가 추출과 판정을 한 함수에서 | 이 라운드 미조치 — 필수 아님(리뷰어 판정). 뮤턴트 15/15 가 판정 분기를 전부 가른다는 것을 확인했다(plan 표) | — |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260926-101426.log`)
- unit: PASS (`_test_logs/unit-20260926-101517.log`)
- build: PASS (`_test_logs/build-20260926-101627.log`)
- e2e: 통과 — 73 스위트 · 409건(새 `action-success-status` 3건 포함, `_test_logs/e2e-20260926-101909.log`)

## 보류·후속 항목

- INFO3 `integrations` `:id/reauthorize` · `:id/request-scopes`, `knowledge-base` `POST /search` 의 성공 경로 e2e — 외부 OAuth
  제공자 · 임베딩 모델에 닿아 e2e 인프라(모킹)가 없다. 선언은 정적 가드가, «Nest 가 선언대로 싣는다» 는 가드 캐너리가, 같은
  스택을 지나는 성공 코드는 이 PR 의 다른 대상 라우트 e2e 가 본다. 등재하지 않는다(리뷰어 판정 «우선순위 낮음 · 인프라 없으면
  기록만»).
