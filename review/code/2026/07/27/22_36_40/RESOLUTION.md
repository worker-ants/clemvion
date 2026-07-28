# RESOLUTION — 22_36_40 (retry-turn.service 3라운드 ai-review)

호출 프롬프트가 지정한 처분표를 그대로 집행했다 — 조치 대상은 Critical #1/#2,
Warning #1/#2/#4 다섯 항목. Warning #3 은 명시적 defer 지시, INFO 전체는 조치
없음 지시였다. 표 밖 항목은 건드리지 않았다.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 | 코드 (동시성/API계약) | `c946a46b7` | `finalizeGuarded` 멱등 분기가 guarded UPDATE 의 `.execute()` 반환값을 버리고 무조건 `true` 반환하던 결함. `(result.affected ?? 0) > 0` 로 다른 두 분기와 대칭 처리. `execute()` 를 `{ affected: 0 }` 으로 mock 한 회귀 테스트 추가 — (a) 종결 이벤트 미발행 (b) 다른 상태 전이 경로 미호출 단언. FAILED→RUNNING `allowRetryReentry` 재진입 경합이 0행을 실제로 만들 수 있음을 소스 주석에 근거(state-machine.ts/ai-turn-orchestrator.service.ts 인용)와 함께 남김 |
| Critical #1 (fixup) | 코드(포맷) | `d871a055c` | 위 신규 회귀 테스트가 prettier 줄바꿈 규칙 위반 → 린트 실패. 해당 한 줄만 정정(로직 무변경) |
| Critical #2 | 코드(주석만) | `084f96a51` | `retry-turn.service.spec.ts` 헤더 주석이 "엔진 thin delegator 경유·이관 시 테스트 의미 소실" 이라 서술했으나 같은 파일에 이미 mocked driver/orchestrator 로 재진입·downstream 진행을 구동하는 describe 3개(`:307`,`:418`,`:685` 원본 라인)가 존재. thin delegator 도 이미 제거됨(C-1 후속 ④). 헤더를 실제 2계층 구조(본 spec=mocked driver 격리 검증, 엔진 spec=real driver full-integration)로 정정. 테스트 코드는 무수정 |
| Warning #1 | 테스트 | `679039667` | 2R CRITICAL 회귀 테스트가 제목이 약속한 error/finishedAt/durationMs 중 error 만 assert 하던 vacuous 구간. `failRetryExecution`/`completeRetryExecution` 양쪽에 `finishedAt instanceof Date` + `durationMs === finishedAt − startedAt` 관계식 단언 추가(completeRetryExecution 쪽은 `.set()` 스파이가 아예 없어 신규 설치). 소스에서 두 필드를 실제로 제거해 RED 전환을 직접 확인한 뒤 원복 |
| Warning #2 | 문서 | `1237c18a3` | `CHANGELOG.md` #7 항목이 2R 커밋(4b52dc7a2) 이후 "멱등 no-op" 이라는 stale 문구 유지 → "상태 전이는 skip 하되 error/finishedAt/durationMs 는 관측한 상태를 조건으로 guarded 갱신, 0행이면 emit 도 skip" 으로 갱신(이번 Critical #1 수정 포함) |
| Warning #3 | 아키텍처/문서 | (defer) | `AiTurnOrchestrator` forwardRef 근거 주석 모순 — **호출 프롬프트 명시 지시로 defer**. forwardRef 제거는 모듈 레벨 import 순환 실측이 필요해 이 PR 범위 밖. plan 기존 W2 항목 유지, 재수정 금지 |
| Warning #4 | 테스트(유지보수) | `cc98374ff` | `{ id, status, startedAt }` 4줄 리터럴이 '종결 경로의 terminal 가드' describe 블록에 9곳(SUMMARY 지적 8곳 + 이번 라운드 Critical #1 회귀 테스트 1곳) 반복 → `mkLiveExecution(status)` 헬퍼 추출. 매 호출 신규 객체 반환(공유 mutable 객체 방지) 확인. 블록 밖 2키-shape(`:405`, `status` 없음)는 스코프 밖이라 미터치 |

## TEST 결과

- lint  : 통과 (50s)
- unit  : 통과 — backend 412 suites / 8330 tests(1 skipped) · frontend 281 files / 5741 tests(1 skipped) · web-chat 3 suites / 48 tests · channel-web-chat 23 files / 409 tests · internal packages(6개) 9 suites / 218 tests 전부 PASS, FAIL 0 (66s)
- build : 통과 — backend/frontend Dockerfile 빌드 검증 + 프로덕션 이미지 위생 스모크 포함, 스킵 없음 (142s)
- e2e   : 통과 — backend e2e Jest 46 suites / 260 tests + Playwright 51 tests 전부 PASS, FAIL 0 (292s, 컨테이너 정상 teardown 확인)

대상 파일(`retry-turn.service.ts`/`retry-turn.service.spec.ts`)이 `.ts` 소스라
e2e 면제 화이트리스트 대상이 아니어서 전량 실행했다(지시 준수).

## 보류·후속 항목

- Warning #3 (architecture/documentation) — `AiTurnOrchestrator` forwardRef 근거
  주석 모순. defer. `plan/in-progress/retry-turn-terminal-guard.md` 의 기존 W2
  항목으로 유지, 이번 라운드 재수정하지 않음(호출 프롬프트 명시 지시).
- INFO #1~14 전체 — 조치 없음(호출 프롬프트 명시 지시). 특히 INFO 6(in-place
  mutation), INFO 7(`resumeGraphAfterRetry` 직접 호출 비대칭), INFO 8(spawnedRow
  비원자 claim = plan W1), INFO 9(spec §6 표 갱신, project-planner 범위), INFO
  10(cancel 분기 stale error, W16 의도된 동작)은 전부 기존 plan 후속 유지.
- spec 변경 0건 — 이번 라운드에서 `spec/` 폴더 파일은 건드리지 않았다(Critical
  #2 는 `retry-turn.service.spec.ts` 라는 **Jest 테스트 파일명**이며 제품 spec
  문서가 아니다).
- 절대 하지 말 것 지시 준수 확인: `resumeGraphAfterRetry` 자연 종결 분기 무수정,
  `ALLOWED_TRANSITIONS` 무확장, `failRetryExecution` 의 `isCancelled` 분기 무수정
  (W16 의도된 동작 보존), 파일 전체 `eslint --fix`/리팩토링 drive-by 없음.

## 검증 로그 경로

- `_test_logs/lint-20260727-232505.log`
- `_test_logs/unit-20260727-232605.log`
- `_test_logs/build-20260727-232736.log`
- `_test_logs/e2e-20260727-233027.log`
- 진행 로그: `review/code/2026/07/27/22_36_40/_resolution_log.md`
- 상태 파일: `review/code/2026/07/27/22_36_40/_resolution_state.json`
