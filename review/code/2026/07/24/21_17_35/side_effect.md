# 부작용(Side Effect) 리뷰 결과

## 검토 방법

18개 파일(테스트 1 · plan 5 · spec 1 · 이전 리뷰 라운드(`20_36_21`) 산출물 11)을 확인했다.
프로덕션 코드(`codebase/backend/src/**`) 변경은 **전혀 없다** — 변경분은 신규 e2e 테스트,
plan lifecycle 이동, spec frontmatter 갱신, 그리고 직전 리뷰 라운드의 산출물(SUMMARY/RESOLUTION/
개별 reviewer md/meta.json/_retry_state.json) 커밋뿐이다. 추가로 실제 소스를 직접 열어
다음을 교차 검증했다: (1) 신규 e2e 파일이 `git log` 상 최종본(336줄, diff 와 일치)인지, (2)
`afterAll` 미정리가 인접 e2e 파일들(`execution-concurrency-cap.e2e-spec.ts`,
`webchat-idle-reaper.e2e-spec.ts`)의 기존 관행과 실제로 일치하는지, (3) `code` 노드의
busy-wait 가 `isolated-vm` 을 통해 실행되어(`code.handler.ts` 의 `ivm.Isolate`/`script.run`)
Node 메인 이벤트루프를 점유하지 않는 스레드 모델을 쓰는지, (4) `registerAndLogin` 헬퍼가 실제
이메일 발송 없이 DB 직접 UPDATE 로 fast-track 하는지(기존 헬퍼, 이번 diff 대상 아님).
넷 다 주장대로였다.

## 발견사항

- **[INFO]** e2e 가 실제 백엔드에 workspace/workflow/execution 행을 생성하고 CPU-바운드
  busy-wait 코드 노드를 최대 3회(각 5초, 합산 최대 15초) 실행한다
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:57`
    (`INFLIGHT_WINDOW_MS = 5_000`), `:136-139`(busy-wait 코드 문자열),
    `it` 블록 3곳(:253, :289, :307)
  - 상세: `while (Date.now() < __end) {}` 동기 루프가 `isolated-vm` isolate 안에서 돈다.
    `code.handler.ts` 는 `isolate.compileScript(...).run(ctx, {...})` 을 통해 실행하며,
    `isolated-vm` 은 네이티브 스레드에서 isolate 를 구동해 Node 메인 이벤트루프를 점유하지
    않는다(HTTP 서버 응답성에 영향 없음) — 이 파일의 폴링/`stop` 왕복이 같은 테스트 안에서
    실제로 성립하는 이유이기도 하다. 3개 테스트가 순차 실행되고(`jest-e2e.json`
    `maxWorkers: 1`) CPU 코스트만 늘어나는 형태라 실질 위험은 낮다.
  - 제안: 조치 불요. CI 총 소요시간이 유의미하게 늘면 `INFLIGHT_WINDOW_MS` 축소 검토.

- **[INFO]** `afterAll` 이 생성된 workspace/workflow/execution/node_execution 행을 정리하지
  않음
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:91-93`
  - 상세: `db.end()` 만 수행. 직접 대조 확인 결과 `execution-concurrency-cap.e2e-spec.ts:58-60`,
    `webchat-idle-reaper.e2e-spec.ts:47-49` 도 동일하게 `db.end()` 외 정리를 하지 않아,
    신규 회귀가 아니라 같은 파일군의 기존 관행과 일치한다.
  - 제안: 조치 불요(컨벤션 일치).

- **[INFO]** spec frontmatter `pending_plans` 재배선 — 부작용이 아니라 규약상 필수 조치
  - 위치: `spec/conventions/node-cancellation.md`(diff, `pending_plans:` 항목 및 §6
    표 2행의 추적 링크)
  - 상세: `node-cancellation-inflight-followups.md` 완료로 `pending_plans` 포인터가
    `node-cancellation-residual-signal-propagation.md` 로 교체됐다. 대상 파일이 이번 diff 로
    실제 신설(`plan/in-progress/node-cancellation-residual-signal-propagation.md`)되어 있어
    dangling 참조가 아님을 확인했다. `plan/complete/node-cancellation-infrastructure.md` 의
    상대경로 링크 3곳(옛 `../in-progress/...`)도 같은 diff 에서 same-dir 로 갱신되어 plan
    이동이 남길 수 있었던 부작용(dangling link)이 이미 닫혀 있다.
  - 제안: 조치 불요.

- **[INFO]** 신규 plan `harness-push-gate-did-not-fire.md` — 이번 diff 의 부작용이 아니라
  이번 세션에서 관측된 **별개의 하네스 결함**을 기록한 문서
  - 위치: `plan/in-progress/harness-push-gate-did-not-fire.md`
  - 상세: 이 branch 의 실제 push 때 리뷰 게이트 훅이 발동하지 않았다는 실측을 담고 있다.
    코드 변경(테스트 파일)과 원인 계층이 다르며(하네스/훅 vs 백엔드 테스트), RESOLUTION.md
    도 "본 리뷰 대상 아님" 으로 명시한다. side-effect 관점에서 이 문서 자체는 아무 동작도
    바꾸지 않는 순수 기록이라 해당 없음(NONE) — 다만 참고용으로 기재.

## 요약

프로덕션 코드(핸들러·서비스·컨트롤러·엔진) 변경이 전혀 없어 함수/메서드 시그니처 변경, 공개
API 변경, 전역 변수 도입·수정, 예상치 못한 파일시스템 쓰기, 의도치 않은 네트워크 호출,
이벤트/콜백 배선 변경 등 핵심 부작용 축은 모두 해당 사항이 없다. 유일한 실질 부작용은 e2e
테스트 자체의 본질적 비용(HTTP 호출·DB 행 생성·CPU-바운드 busy-wait)이며, `isolated-vm` 의
스레드 격리 덕에 메인 이벤트루프를 막지 않고, DB 행 미정리도 인접 e2e 파일군과 동일한 확립된
관행임을 직접 대조 확인했다. spec/plan 문서 변경(frontmatter `pending_plans` 재배선, plan
이동, dangling 링크 보정)은 규약이 요구하는 기계적 동기화이고 대상 파일 존재까지 확인했다.
새로 추가된 `harness-push-gate-did-not-fire.md` 는 이번 diff 와 무관한 별도 하네스 결함
기록으로, 이 코드 변경 자체의 부작용은 아니다.

## 위험도

NONE
