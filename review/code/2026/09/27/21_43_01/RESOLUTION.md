# RESOLUTION — 1R (`review/code/2026/09/27/21_43_01`, 판정 기준 HEAD `56f39d93a`)

리뷰 뒤 `git status --short` 는 이 세션 디렉터리만, `git diff --stat HEAD` 는 빈 출력. 리뷰어 transcript 의 쓰기 명령은 세션 디렉터리
밖 0건(스캔 패턴이 도구 호출 216건을 잡는 것을 먼저 확인). 14명 전원 리포트 확보(`forced_missing` · `unfinished` 없음).

## 조치 항목

| SUMMARY # | 판정 | 조치 | 커밋 |
|---|---|---|---|
| W1 (testing) `AlertsService.create` 소속 검사 단위 테스트 없음 | 수용 | `alerts.service.spec.ts` 신설 — 다른 워크스페이스 `workflowId` 400 + `save` 미호출 · 같은 워크스페이스 저장 · 전역 규칙(`workflowId` 없음) 미조회 | `698ad8ab7` |
| W2 (architecture · maintainability) 노드는 순차 `exists`, 엣지는 `In()` 일괄 — 같은 PR 안의 두 전략 | 수용 | `NodesService.assertPlacementInWorkflow` 를 엣지와 같은 `In()` 한 번 조회로. 단위 테스트를 `find` 조건 단언으로 바꾸고 «둘 다 틀리면 둘 다 싣는다» 추가 | `698ad8ab7` |
| W3 (documentation) e2e 헤더가 아직 없는 `plan/complete/cross-workspace-refs.md` 인용 | 수용 | 인용을 PR 안에서 옮겨지지 않는 spec(`spec/data-flow/12-workspace.md` Rationale)로 | `698ad8ab7` |
| INFO 8 (testing) 어시스턴트 세션 `llmConfigId` 단위 테스트 없음 | 수용 | `workflow-assistant-session.service.spec.ts` 신설 — 생성 · 수정 거부(404 전파, 저장 안 함) · 미지정 · `null` 미조회 | `698ad8ab7` |
| INFO 1 · 2 · 10 · 12 | 조치 불요 | 트리거 `config` 비밀 참조 · 이미 저장된 교차 행 · 엣지 UNIQUE · API 문서 미러 — 트래커 «교차 워크스페이스 참조 후속» 에 등재된 의도적 범위 밖(plan §이 PR 밖으로 넘기는 것) | — |
| INFO 3 · 4 · 6 · 13 · 14 | 조치 불요 | 전역 id 충돌 조회는 TypeORM `save` 동작 대응의 의도된 설계(spec Rationale 수용) · TOCTOU 는 기존 `assertWorkflowInWorkspace` 와 동형 · 폴더 PATCH `details` 확장은 CHANGELOG 에 적힌 의도 · 메시지 «canvas / workflow» 구분은 의도 · DB 제약 부재는 기존 스키마 | — |
| INFO 5 (`where` 소속 조건이 산문으로만 강제) | 조치 불요 | 서비스마다 `where` 단언 단위 테스트 + 뮤턴트 M2 · M5 가 «소속 조건 빠짐» 을 잡는다 | — |
| INFO 7 · 9 · 11 | 조치 불요 | 메시지 리터럴 · 빈 배열 가드 반복 · KB 재검증 비대칭 · 순차 `await` — 동작 결함 아님, 우선순위 낮음 | — |

## TEST 결과

- lint: PASS (`_test_logs/lint-20260927-215847.log`)
- unit: PASS — 백엔드 10447 passed(직전 10440 + 이번 추가 7) (`_test_logs/unit-20260927-220001.log`)
- build: PASS (`_test_logs/build-20260927-220203.log`)
- e2e: 통과 — 477 passed / 477 (`_test_logs/e2e-20260927-220512.log`)
