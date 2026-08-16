# RESOLUTION — `17_56_15` (3라운드)

**CRITICAL 0 · WARNING 1** — 조치 완료. 이 라운드로 수렴한다.

## WARNING 1 (maintainability) — 리포트보다 먼저 고쳐져 있었다

`ResponseExecution`/`ResponseNodeExecution` 두 타입을 `ExecutionDetailWithTrigger` **앞에**
끼워 넣으면서, 원래 그 타입을 설명하던 JSDoc(`findById` 응답 shape · `executionPathTruncated`)이
분리돼 **엉뚱한 타입 위에 붙은 고아 주석**이 됐다.

리포트가 도착하기 전에 소스를 다시 읽다가 발견해 **원 대상 위로 원위치**시켰다. 중복이
생기지 않았는지 grep 으로 전수 확인했다(각 블록 1회).

> **왜 생겼나**: 타입을 "위에 추가" 하면서 아래 블록의 소속을 확인하지 않았다. 2라운드에서
> 지적받은 *"로직이 옮겨가면 설명도 함께 가야 한다"*(`stop`/`stopInternal` JSDoc)와 **같은
> 클래스**다 — 그때는 함수, 이번엔 타입이었다.

## 리뷰어의 `git checkout --` 로 인한 트리 오염 — 확인함, 피해 없음

testing reviewer 가 뮤테이션 재현 후 `git checkout --` 로 원복했다고 보고했다. 이 저장소에는
**병렬 리뷰어가 남의 미커밋 작업을 `git restore` 로 되돌린 전례**가 있어, 알림을 받은 즉시
내 미커밋 JSDoc 수정이 살아있는지 확인했다 — **손실 없음**(`git status` ` M` 유지 + 내용 grep
확인). 그 시점에 미커밋 편집이 하나 떠 있었으므로 실제 위험 구간이었다.

## INFO — 조치 안 함, 사유

- **testing INFO** `stop()` 의 `WAITING_FOR_INPUT` 분기가 마스킹 값으로 직접 단언되지 않음 —
  마스킹 관문이 `stopInternal` **바깥 단일 지점**이라 어느 내부 분기를 타든 같은 문을 지난다.
  분기 자체는 기존 테스트가 덮는다(`stop — WAITING_FOR_INPUT cancel (C-1)`). 기능적 위험 낮음.
- **testing INFO** e2e 레벨 HTTP 응답 검증 부재 — 컨트롤러가 얇은 pass-through 이고, DB 원문
  보존을 단언하는 기존 e2e 가 그대로 통과하는 것이 egress-only 원칙의 반대편 증거다.
- **side_effect INFO** copy-on-change 가 원본과 동일 참조를 돌려줄 수 있고 그것이
  `snapshotCache` 에 저장될 수 있음 — 현재 코드에 뮤테이션 지점이 없어 위험 아님(리뷰어도
  동일 판단). 기록만 남긴다.
- 나머지(잔여 갭 3종 · `triggerToken` 평문 · 엔티티-spread 응답 패턴)는 전부 **이 PR 이
  스스로 CHANGELOG·spec·트래커에 등재한** 범위 밖 항목이다.

## 검증

- TEST WORKFLOW 4스테이지 최종 재수행 — plan 체크리스트 참조
- `tsc --noEmit` 변경 파일 오류 0 · 영향 스위트 PASS
