# 문서화(Documentation) 리뷰 — RE-REVIEW

대상: exec-intake-pr4-stalled — `buildExecutionRunJobId` 독스트링 정정 여부 재검증
(이전 라운드 `review/code/2026/07/04/13_08_20/documentation.md` WARNING 후속)

## 재검증 결과

**확인 완료 — 요청된 정정이 반영됨.**

`codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` L48-59
`buildExecutionRunJobId` 함수 독스트링을 직접 읽어 확인했다:

```
/**
 * BullMQ jobId 스키마.
 *
 * PR1 은 Execution row 생성당 정확히 1회 enqueue 하므로 `executionId` 자체가
 * 유일 키이고, BullMQ 가 동일 jobId 의 중복 add 를 자동 dedup 한다 (네트워크
 * 재시도·동시 호출에 대한 idempotency). 따라서 seq 를 붙이지 않는다.
 *
 * spec §9.2 의 `<executionId>:run:<seq>` 표기는 명시적 re-enqueue 를 도입하는
 * 미래 변경을 위한 일반형이다. **PR4 crash 재개는 네이티브 BullMQ stalled 재배달
 * (같은 jobId 를 그대로 재처리)** 을 쓰므로 re-enqueue 가 없어 seq 가 여전히
 * 불필요하다 — jobId=executionId 를 유지한다. 필요해지는 시점에 본 함수만 확장한다.
 */
export function buildExecutionRunJobId(executionId: string): string {
  return executionId;
}
```

이전 라운드(13_08_20)의 WARNING 이 지적한 문제 — "PR4 가 re-enqueue(`<executionId>:run:<seq>`)
를 도입할 것"이라는 옛 서술이 실제로는 "PR4 는 네이티브 stalled 재배달(같은 jobId 재처리)을 채택해
seq 가 불필요하다"는 이번 PR 자신의 결론과 모순됐던 부분 — 이 완전히 해소됐다:

- "네이티브 BullMQ stalled 재배달(같은 jobId 를 그대로 재처리)" 로 명시 → **native stalled 정확히 반영**
- "re-enqueue 가 없어 seq 가 여전히 불필요" → **seq 불필요 결론 정확히 반영**
- spec §9.2 표기(`<executionId>:run:<seq>`)를 "명시적 re-enqueue 를 도입하는 **미래** 변경을 위한
  일반형"으로 재규정 — `spec/5-system/4-execution-engine.md` §9.2 의 대응 정정
  ("당초 'PR4 활성화' 스케치를 정정 … PR4 crash 재개는 네이티브 BullMQ stalled 재배달을 쓰므로
  re-enqueue 가 없어 seq 가 여전히 불필요")과 **문구·논리 모두 일치**한다.

spec 쪽 근거 파일 대조:
- `spec/5-system/4-execution-engine.md` §9.2 `exec:run:seq:<executionId>` 행(정정 diff, L879-880):
  "PR1~PR4 미사용 — 미래 예약 … PR4 crash 재개는 네이티브 BullMQ stalled 재배달(같은 jobId 재처리)을
  쓰므로 re-enqueue 가 없어 seq 가 여전히 불필요하다(당초 "PR4 활성화" 스케치를 정정)."
- `spec/5-system/4-execution-engine.md` §Rationale "PR4 — BullMQ stalled 자동 재배달"(L930):
  "네이티브 stalled = 같은 jobId 재처리 → seq/re-enqueue 불요."

코드 독스트링과 spec 서술이 완전히 정합한다. 이전 WARNING 은 해소된 것으로 판정한다.

## 잔여 관찰 (참고용 — 이번 재검증의 주 대상 아님, 재오픈 불필요)

- **[INFO]** 같은 파일 상단 모듈 독스트링의 "PR 범위" 블록(`execution-run.queue.ts` L15-18)이
  여전히 로드맵 서술("PR3/PR4: crash RUNNING 재개(멱등 rehydration) + BullMQ stalled-job 일원화.")로
  남아 있어, PR3/PR4 가 이미 구현 완료된 현재 상태(파일 내 `EXECUTION_RUN_MAX_STALLED_COUNT = 1` 등
  실제 구현과 대조하면 확인 가능)를 완료형으로 반영하지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:15-18`
  - 상세: 이전 라운드(13_08_20) WARNING 이 "상단 모듈 독스트링도 PR3/PR4 완료 시점 기준으로
    과거형/완료형 갱신이 없어 로드맵처럼 읽힌다"고 부차적으로 언급했던 부분. 오늘 재검증 대상인
    `buildExecutionRunJobId` 독스트링(핵심 지적사항)은 확실히 수정됐으나, 이 모듈 상단 블록은
    변경되지 않은 채 남아 있다.
  - 제안(선택 사항): "PR1 (본 파일): intake 큐 + work-stealing — 구현 완료. PR2: §8 동시성 cap
    + active-running 타임아웃 — 구현 완료. PR3/PR4: crash RUNNING 재개(부팅 backstop rehydration +
    네이티브 BullMQ stalled 재배달) — 구현 완료." 식으로 갱신. 단, 이는 이번 RE-REVIEW 의 필수
    확인 대상(buildExecutionRunJobId)이 아니므로 CRITICAL/WARNING 으로 재차 차단하지 않고 INFO 로만
    기록한다 — 원 WARNING 의 핵심 요구(네이티브 stalled/no-seq 정합)는 충족됐다.

## 요약

RE-REVIEW 목적이었던 `buildExecutionRunJobId` 독스트링 정정 여부를 소스 직접 대조로 확인한 결과,
"네이티브 stalled 재배달(같은 jobId 재처리), seq/re-enqueue 불요"라는 정정 내용이 정확히 반영되어
있으며 5개 spec 파일(특히 `4-execution-engine.md` §9.2·§Rationale)과 문구·논리 수준에서 완전히
정합한다. 이전 라운드에서 지적된 CRITICAL 오래된 주석 문제는 해소됐다고 판정한다. 동일 파일 상단의
모듈 레벨 "PR 범위" 코멘트가 여전히 로드맵 어투로 남아 있는 점은 경미한 잔여 관찰(INFO)로만 남기며,
이번 재검증의 통과 여부에는 영향을 주지 않는다.

## 위험도

NONE
