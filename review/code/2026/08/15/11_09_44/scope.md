STATUS=success

===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (R8)

## 검토 방법

프롬프트 번들이 큰 파일(`execution-engine.service.{ts,spec.ts}` 등)의 diff 를 예산 초과로
생략했으므로, 해당 파일은 `git diff origin/main...HEAD -- <path>` 로 직접 전문을 확인했다.
`git log --oneline origin/main..HEAD` 로 브랜치의 12개 커밋 전체를 훑어 각 커밋이 어떤 의도에
속하는지 대조했고, 과거 3라운드 scope 리뷰(`09_58_24`/`10_18_38`/`10_34_51` 의 `scope.md`,
`RESOLUTION.md`)가 이미 지적·조치한 항목이 현재 diff 에도 남아 있는지 재검증했다.

## 발견사항

- **[INFO]** `spec/5-system/14-external-interaction-api.md` 의 Re-run 경로 `/v1/` 세그먼트
  정정은 `durationMs` 기능과 직접 관련이 없다
  - 위치: 별도 커밋 `cdaa4291d` (`fix(spec): 인접 두 줄이 자기모순 — Re-run 경로에 금지된
    /v1/ 세그먼트`)
  - 상세: `durationMs` 작업 착수 직전 의무적으로 수행한 `consistency-check --impl-prep`
    (`review/consistency/2026/08/15/08_45_50/`)이 같은 파일을 스캔하다 CRITICAL(spec 자기모순)을
    발견했고, CLAUDE.md 규약("Critical 발견 시 차단")에 따라 그 자리에서 해소한 것이다.
    이미 이전 라운드(`09_58_24/scope.md`)가 동일 항목을 INFO 로 기록·수용했고, 커밋이
    독립적으로 격리돼 있어 diff 오염은 없다. 재차단 사유 아님 — 절차상 정당한 예외.
  - 제안: 조치 불필요.

- **[INFO]** `execution-engine.service.spec.ts` 의 mock 확장(`setParameter`/`returning` stub
  추가)이 실제 프로덕션 호출 지점(5곳)보다 훨씬 많은 위치에 걸쳐 있음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    다수 지점 (`makeIdleQb`/`makeCancelQb`/`makeQb`/`mkQb`/`mkExecQb`/`NF-OB-07` 관련 mock 등)
  - 상세: 실측 결과 프로덕션 diff 는 `execution-engine.service.ts` 에 `.setParameter(` 5곳 +
    `.returning(['id','duration_ms'])` 5곳만 추가했다. 그런데 이 spec 파일은 `createQueryBuilder`
    의 파일 전역 default mock 을 다수의 무관 테스트 블록이 공유하는 구조라, 그 default 를
    쓰는 아무 테스트나 취소·stalled 종결 경로를 간접 경유하면 `setParameter is not a function`
    으로 깨진다. 따라서 이 확산은 새 리팩터가 아니라 공유 mock 구조에서 비롯된 필연적
    파급이며, 이미 `09_58_24/scope.md` 가 같은 결론으로 검증한 항목이다.
  - 제안: 조치 불필요(기록 목적).

- **[INFO]** 과거 라운드가 지적한 스코프 이탈(정규식이 `NodeExecution.durationMs` 8곳까지
  대상 밖으로 확장)은 커밋 `8a0c2348b` 로 전량 되돌려져 현재 diff 에는 존재하지 않음
  - 위치: (해당 없음 — 부재를 확인한 항목)
  - 상세: `grep -n "nodeExecution.durationMs" <diff>` 로 재검증한 결과 0건. `10_34_51/RESOLUTION.md`
    W2 가 스스로 지적하고 되돌린 내용과 최종 diff 가 일치한다.
  - 제안: 없음 — 재발 없음을 확인.

- **[INFO]** `review/code/**` 4라운드(`09_58_24`/`10_18_38`/`10_34_51`/`10_52_08`) +
  `review/consistency/**` 4라운드 산출물 전체가 커밋에 포함됨
  - 상세: CLAUDE.md 가 명시한 "구현 완료 후 `/ai-review` + Critical/Warning fix 는 상시
    승인된 강제 의무" 워크플로의 정상 산출물이다. 반복 라운드가 많은 이유는 실제 발견(CRITICAL
    1건 — int4 overflow 로 인한 영구 고착 가능성, 여러 WARNING)이 있었고 그때마다 fix →
    재검토가 필요했기 때문이며, 이는 scope 이탈이 아니라 표준 워크플로다.
  - 제안: 없음.

## 그 외 확인 (문제 없음)

- 브랜치의 12개 커밋(`cdaa4291d` ~ `bd611be81`) 전부가 (a) `durationMs` 기능 구현
  (`e2f4b3bfc`/`f403cd60d`/`0f0050dea`), (b) spec 동기화(`0dce2a83f`), (c) 리뷰 라운드에서
  드러난 자기 결함 수정(JSON 파싱 불가 `04ee6df5e`, 정규식 과잉 확장 되돌림 `8a0c2348b`,
  콤마 오류 `6bedc7e3c`, int4 클램프 CRITICAL `606f54418`, invariant 반례 `a67ec89b7`), (d) 트래커
  등재(`2e4c5c6e9`), (e) 미룬 단언 보완(`bd611be81`) 중 하나에 속한다. 전부 같은 작업
  (`durationMs` 종결 이벤트 배관)의 직접 산출물이거나 그 작업이 발견한 선존 결함의 즉시
  정정이다. 무관한 리팩토링·기능 확장·설정 변경은 없다.
- `codebase/frontend/**`, `codebase/channel-web-chat/**`, `.claude/**` 에는 변경이 전혀 없다
  (`git diff --stat` 확인).
- `retry-turn.service.ts`/`chat-channel.dispatcher.ts`/`types.ts`/신규 `terminal-duration.ts`
  전문을 직접 열어 대조한 결과, 프롬프트에 실린 diff 와 실제 저장소 상태가 일치하고 곁가지
  변경(불필요한 임포트, 포맷팅-only 변경, 주석 drive-by 삭제)이 없다.
- `plan/in-progress/eia-terminal-payload.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
  `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 갱신은 모두 이번 작업의
  진행상황·후속 발견(REST 비대칭, `duration_ms` 집계 오염, HMAC 화이트리스트 불일치 등) 등재이며
  이 저장소의 표준 plan 라이프사이클 관행이다.

## 요약

이번 changeset 은 "종결 이벤트(`completed`/`failed`/`cancelled`) 3종 전부에 `durationMs` 를
채운다"는 단일 의도를 벗어나지 않는다. 신규 공용 헬퍼(`terminal-duration.ts`)는 16개 emit
경로의 반복 계산·null 처리·SQL 폴백을 한 곳에 모으는 목적이 명확하고, 헬퍼 도입이 필요했던
근거(엔티티 미로드 raw UPDATE 5곳, `if` 블록 밖 hoist 로 인한 undefined 함정)도 코드·plan
양쪽에 일관되게 기록돼 있다. 과거 3라운드 scope 리뷰가 지적한 유일한 실질 스코프 이탈
(정규식이 무관한 `NodeExecution` 8곳까지 건드린 것)은 이후 커밋에서 전량 되돌려져 현재
diff 에는 남아 있지 않다. 나머지 남은 항목(Re-run `/v1/` 오탈자 정정, 광범위한 테스트 mock
확장, 다수의 리뷰 라운드 산출물 커밋)은 전부 이 프로젝트의 강제 워크플로(impl-prep 게이트,
공유 default mock 구조, ai-review 상시 의무)에서 비롯된 것으로 실측 확인됐으며 재론할
실질적 스코프 이탈이 아니다.

## 위험도

LOW
