# 부작용(Side Effect) 리뷰 — exec-limits-refactor (ARCH#4·ARCH#6·MAINT#9)

## 검토 방법

payload(`_prompts/side_effect.md`)의 6개 코드 파일(execution-limits.ts/.spec.ts,
execution-run.processor.ts, execution-run.queue.ts/.spec.ts, system-status.constants.ts)을
전부 확인했고, `git diff origin/main...HEAD --stat` 로 16개 변경 파일 목록이 payload 와
일치함을 검증해 mis-scope 는 없었다(plan/review 아티팩트 10개는 코드가 아니라 이번 관점과
무관). 추가로 리포지토리를 직접 grep/실행해 아래를 실측 검증했다:

- `resolveExecutionRunWorkerConcurrency`/`DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY` 전체
  소비처(grep) — 이관 후 잔여 stale import 없음.
- `resolveContinuationWorkerConcurrency` 원본 소스 대조 — 로직 동일성 확인.
- Node 로 loose(`Number(env)||1`) vs strict(정규식) 파서를 나란히 실행해 입력별 분기 실측.
- 영향받는 3개 spec 파일(`execution-limits.spec.ts`, `execution-run.queue.spec.ts`,
  `system-status.constants.spec.ts` 존재 시) jest 실행 — 29/29 pass.

## 검증 결과 (요청 4개 항목)

### (1) 양의 정수 입력 — 동작 불변

`"4"`, `"007"` 등 `^\d+$` 매치 + `Number.isInteger && >0` 케이스는 loose/strict 양쪽 모두
동일 값을 반환한다(실측: `4`→`4`, `"007"`→`7`/`7`). MAINT#9 는 `system-status.constants.ts`
의 `continuationConcurrency` 계산만 교체했고, 다른 소비처(`execution-run.processor.ts`
`@Processor` concurrency 등)의 정상 입력 경로는 그대로다.

### (2) 비정수/공학표기/음수 edge — loose-accept → fallback 1, 계약 정합

실측 분기표(env 값 → loose 결과 / strict 결과):

| env raw | loose (`Number(env)‖1`) | strict (신규) | 차이 |
| --- | --- | --- | --- |
| `"-1"` | `-1` (**음수 concurrency 그대로 채택되던 잠재 결함**) | `1` | 변경 |
| `"2.5"` | `2.5` (**비정수 concurrency**) | `1` | 변경 |
| `"1e10"` | `10000000000` (**BullMQ 에 100억 concurrency 전달 가능했던 결함**) | `1` | 변경 |
| `"3.0"` | `3` | `1` | 변경 (소수점 표기 전부 거부가 정책) |
| `undefined`/`""`/`"   "`/`"abc"`/`"0"` | `1` | `1` | 동일 |

즉 이번 변경은 기존에 `Number(env)||1` 이 **음수·비정수·초거대값을 BullMQ worker
concurrency 로 그대로 통과시킬 수 있었던 잠재 결함**을 문서화된 §11 계약(비양수·비정수·
비숫자→1 fallback)에 맞춰 좁히는 방향이다. 이는 규약 정합화이자 견고화이며, "정상 동작을
깨는" 회귀가 아니다. system-status 화면의 `concurrency` 표시값이 이 edge 입력 하에서
달라지는 것은 **의도된 fix**이지 부작용이 아니다.

### (3) 이관 함수 byte-identical 여부

`execution-run.queue.ts` 에서 제거된 블록(JSDoc + 함수 본문, diff L736-756)과
`execution-limits.ts` 에 추가된 블록(diff L297-317)을 문자 단위로 대조 — JSDoc 주석,
함수 시그니처(`env: NodeJS.ProcessEnv = process.env`), 정규식(`/^\d+$/`), 분기 로직
전부 동일하다. 순수 함수(process.env 유일 의존)이므로 이관 자체가 새 부작용을 만들지
않는다. `execution-run.queue.ts` 원본 위치에는 재-export 배럴을 남기지 않고 이관 안내
주석만 남겼다(이중 SoT 방지, convention_compliance 세션 권고와도 일치).

### (4) 이관 심볼의 다른 소비처 영향

grep 으로 전체 저장소를 스캔한 결과, 이관 전 유일한 실사용 소비처는
`execution-run.processor.ts`(`@Processor` 데코레이터 concurrency 옵션) 였고, 이번 변경으로
`system-status.constants.ts` 도 같은 함수를 재사용하도록 새로 연결됐다. 두 소비처 모두
import 경로가 `../execution-limits`(신규 canonical 위치)로 정확히 갱신됐고,
`execution-run.queue.ts`/`execution-run.queue.spec.ts` 에는 옛 이름에 대한 잔여 참조가
전혀 없다(`grep -rn` 확인). 관련 jest 스위트(`execution-limits.spec.ts`,
`execution-run.queue.spec.ts`, `system-status` 계열) 실행 결과 29/29 pass.

## 발견사항

- **[INFO]** `execution-run.processor.ts` 의 `@Processor({ concurrency:
  resolveExecutionRunWorkerConcurrency() })` 는 데코레이터 평가 시점(모듈 로드, DI
  이전)에 1회 실행된다 — 이관 전과 위치만 바뀌었을 뿐 평가 시점·값은 불변이라 side
  effect 없음. 참고용으로만 기록.
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts:33`
  - 제안: 조치 불필요.

- **[INFO]** MAINT#9 로 `system-status.constants.ts` 의 `MONITORED_QUEUES` 배열 내
  `continuation` 항목 `concurrency` 값이, 운영 환경에서 만약 `CONTINUATION_WORKER_CONCURRENCY`
  가 이미 소수/공학표기/음수로 **잘못 설정돼 있었다면** 화면 표시값이 달라질 수 있다(이전:
  그 오설정 값 그대로 노출 → 이후: `1`). 이는 §11 계약을 따르는 개선이지만, 만약 실제 운영
  `.env` 에 그런 비정형 값이 설정돼 있다면 배포 시점에 표시값 변화를 인지할 필요가 있다.
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts:48`
  - 상세: 코드 검색으로 저장소 내 `.env`/`.env.example`/docker-compose 등에 실제 설정값이
    있는지는 이번 리뷰 범위(side-effect 관점) 밖이라 미검증. 값 자체의 위험이 아니라
    "배포 전 실제 env 값 확인" 수준의 운영 체크리스트 항목.
  - 제안: 배포/PR 체크리스트에 이미 존재하는 절차로 충분 — 별도 코드 조치 불필요.

CRITICAL/WARNING 없음.

## 요약

이번 변경은 순수 함수 이관(ARCH#4) + JSDoc 확장(ARCH#6) + 기존 canonical strict 파서
재사용으로의 교체(MAINT#9) 세 건 모두 "동작 보존" 목표에 부합한다. 이관 함수는
byte-identical 이고 process.env 외 의존이 없어 순환 의존·전역 상태 변경이 없으며, 이관
전 유일 소비처(`execution-run.processor.ts`)와 신규 연결 소비처(`system-status.constants.ts`)
모두 import 경로가 정확히 갱신되어 다른 소비처가 깨지지 않았다(grep 실측 + jest 29/29 pass).
MAINT#9 의 유일한 실질 동작 변경은 `CONTINUATION_WORKER_CONCURRENCY` 의 비정수/음수/공학
표기 edge 입력에서 loose-accept(잠재적으로 음수·초거대 concurrency 를 BullMQ 에 전달할 수
있던 결함)를 spec §11 문서화 계약대로 fallback=1 로 좁히는 것 뿐이며, 이는 강화(hardening)
방향의 의도된 변경이지 회귀가 아니다. 시그니처/공개 API/전역 변수/파일시스템/네트워크/
이벤트 콜백 어느 관점에서도 의도치 않은 부작용은 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
