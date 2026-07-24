# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** e2e 테스트가 실제 백엔드에 대해 workspace/workflow/execution 행을 생성하고 CPU-바운드 busy-wait 코드 노드를 최대 3회(각 5초) 실행한다
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:57` (`INFLIGHT_WINDOW_MS`), `:136-141` (busy-wait 코드 문자열), 3개 `it` 블록(`:240`, `:279`, `:297`)
  - 상세: 각 테스트가 `createTwoStepWorkflow` → `execute` 로 실제 HTTP 호출을 발생시키고, `slow` 노드는 `while (Date.now() < __end) {}` 동기 루프로 5초간 CPU 코어 1개를 점유한다(isolated-vm isolate 스레드, 메인 이벤트 루프는 아님). 3개 테스트 합산 최대 15초의 실제 CPU 소모가 e2e 스위트에 추가된다. 다만 `jest-e2e.json` 의 `maxWorkers: 1` 로 다른 e2e 파일과 동시 경합은 없으며, 이는 파일 최상단 주석에서 flaky 회피를 위해 의도적으로 설계된 트레이드오프임이 명시돼 있다. 부작용이라기보다 문서화된 리소스 비용이라 실질 위험은 낮다.
  - 제안: 별도 조치 불요. CI 전체 소요시간이 유의미하게 늘어난다면 향후 `INFLIGHT_WINDOW_MS` 축소를 검토할 수 있다는 정도만 참고.

- **[INFO]** 테스트가 생성한 workspace/workflow/execution/node_execution 행을 `afterAll` 에서 정리하지 않는다
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:91-93` (`afterAll`)
  - 상세: `afterAll` 은 `db.end()` 만 수행하고 `beforeAll`/각 테스트가 만든 workspace·workflow·execution 행은 DB 에 잔존한다. 다만 이는 같은 파일군의 확립된 관행이다 — `execution-concurrency-cap.e2e-spec.ts`, `webchat-idle-reaper.e2e-spec.ts` 도 동일하게 `db.end()` 외 정리를 하지 않는다. 신규 회귀가 아니라 기존 컨벤션을 그대로 따른 것.
  - 제안: 조치 불요(컨벤션 일치).

- **[INFO]** spec frontmatter `status: partial → implemented` 전환 + `pending_plans:` 제거가 §6 구현 현황 표의 잔여 미구현 항목(chat-channel/MakeShop/Cafe24 노드 signal 전파)과 미묘하게 어긋난다
  - 위치: `spec/conventions/node-cancellation.md` 프론트매터(`status:` 필드, `pending_plans:` 삭제 라인) — 전체 파일 컨텍스트 기준 line 3, line 11-12(구 라인) 참고. 표 자체는 이번 diff 로 수정되지 않은 기존 라인 135-137(`chat-channel`/`MakeShop`/`Cafe24 노드 signal 전파` 행, 추적처로 이미 `complete/` 로 이동된 `node-cancellation-infrastructure.md` 를 인용)
  - 상세: `pending_plans:` 제거는 이번 diff 가 `node-cancellation-inflight-followups.md` 를 `plan/complete/` 로 이동시킨 데 따른 규약상 필수 조치(그러지 않으면 `spec-pending-plan-existence.test.ts` 가드가 dangling 참조로 실패)라 이 자체는 정상 흐름이다. 다만 표에는 여전히 3개 노드 타입의 signal 전파가 "미구현(Planned)"으로 남아 있고, 그 추적처로 이미 완료·이동된 plan 파일을 가리킨다 — 즉 이 잔여 표면들을 추적하는 **활성** plan 이 현재 없다. 이 dangling 상태 자체는 이번 diff 가 새로 만든 것이 아니라 표 내용을 건드리지 않은 pre-existing 상태이므로 이번 변경의 부작용으로 보기는 어렵다. spec 의 정확성 문제이므로 side-effect 보다는 consistency-checker 영역에 가깝다.
  - 제안: 별도 조치 불요(참고만). 필요 시 project-planner 가 §6 표의 추적처를 갱신하거나 새 후속 plan 을 신설할지 판단.

## 요약

이번 변경분은 신규 e2e 테스트 파일 1개, plan 파일의 in-progress → complete 이동(git mv 성격), spec frontmatter 메타데이터(status/pending_plans) 1건 갱신으로 구성되며 프로덕션 코드(핸들러·서비스·컨트롤러) 수정은 전혀 없다. 따라서 함수 시그니처 변경, 공개 API 변경, 전역 변수 도입, 예상치 못한 파일시스템 쓰기, 의도치 않은 네트워크 호출, 이벤트/콜백 변경 등 핵심 부작용 축은 해당 사항이 없다. 유일한 실질 부작용은 e2e 테스트 자체가 실제 백엔드에 HTTP 호출·DB 행 생성·CPU-바운드 busy-wait 를 일으키는 것인데, 이는 e2e 테스트의 본질적 목적이자 같은 파일군의 기존 컨벤션(정리 없는 afterAll, `maxWorkers: 1`)과 일치하고 파일 상단 주석에 트레이드오프가 상세히 문서화돼 있다. spec frontmatter 의 `pending_plans` 제거는 plan 이동에 따른 규약상 필수 조치이며, 표에 남은 dangling 추적 참조는 이번 diff 이전부터 존재하던 별개 이슈다.

## 위험도

NONE
