# 테스트(Testing) 리뷰

## 대상 요약

실질 테스트 대상 코드는 6개 파일이다: 신규 `shared/utils/redact-stored-error.ts`(+`.spec.ts`),
`executions.service.ts`(+`.spec.ts`), `background-runs.service.ts`(+`.spec.ts`). 나머지
(`plan/**`, `spec/**`, `CHANGELOG.md`, `.claude/docs/plan-lifecycle.md`, `review/code/2026/08/16/17_12_34/**`)는
문서·이전 리뷰 세션 산출물이라 테스트 관점 분석 대상이 아니다.

`origin/main...HEAD` 기준 실제 diff 로 확인(프롬프트가 생략한 `executions.service.ts` /
`executions.service.spec.ts` 포함), 대상 3개 spec 스위트를 직접 실행해 **67/67 PASS**
확인했다. 추가로 `background-runs.service.ts` 의 마스킹 호출 1곳을 무력화하는 뮤테이션을
넣어 신규 테스트가 실제로 RED 로 죽는지 실측 확인 후 원복했다(판별력 검증).

## 발견사항

- **[INFO]** `background-runs.service.spec.ts` 에 `error` **null passthrough** 를 명시적으로
  단언하는 테스트가 없다 — 같은 PR 안의 `executions.service.spec.ts` 대칭 테스트와 비교하면
  비대칭이다.
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts`
    — `describe('getBackgroundRun', ...)` (118번째 줄) 안, 신규 테스트
    `it('body nodeExecutions[].error 의 자격증명을 마스킹한다', ...)` (173번째 줄) 바로 다음이
    적합한 위치. 대칭이 되는 기존 테스트는
    `codebase/backend/src/modules/executions/executions.service.spec.ts` 의
    `it('error 가 null이면 null 그대로 (형태 변경 없음)', ...)` (파일 끝부분, `findByWorkflow` 케이스).
  - 상세: `toNodeExecutionDto` 는 `error: redactStoredErrorForResponse(row.error)` 를
    무조건 호출한다(`background-runs.service.ts:302`). `makeBodyNodeExec` 기본값이
    `error: null` 이라 기존의 다른 테스트들이 이 경로를 우연히 실행은 하지만, 어떤 테스트도
    `result.nodeExecutions.data[0].error` 가 `null` 인지 **명시적으로 단언**하지 않는다
    (`grep` 로 `.error` 를 단언하는 곳은 신규 leaky 케이스 1건뿐). 함수 자체는
    `redact-stored-error.spec.ts` 유닛 테스트에서 `null`/`undefined` → `null` 정규화가
    이미 고정돼 있어 실질 회귀 리스크는 낮지만, 이 PR 이 `executions.service.spec.ts` 쪽에서는
    "leaky" 와 "null" 두 경계를 대칭적으로 테스트하는 관례를 세워 놓고 자매 표면인
    `background-runs` 쪽에는 leaky 케이스만 추가했다 — 표면 전수(④ 자매 넷) 원칙을 이 파일
    안에서 다시 한 단계 좁혀 보면 "leaky 뿐 아니라 null 도 대칭으로 단언" 까지는 못 미쳤다.
  - 제안: `expect(result.nodeExecutions.data[0]?.error).toBeNull()` 한 줄을 기존 정상 경로
    테스트(`returns response with body nodeExecutions and computed status (running)`,
    121번째 줄)에 추가하거나 별도 케이스로 신설. 차단 사유는 아니다(INFO).

- **[INFO]** (긍정 관찰) `stop()` 회귀 테스트가 반환 계약 변경(참조 → 복사본)에 맞춰
  **약화가 아니라 등가 교체**로 갱신됐다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` — 기존
    `expect(result).toBe(afterCancel)` 를 `toMatchObject` + `not.toMatchObject` 쌍으로
    교체한 지점(`stop()` `WAITING_FOR_INPUT` 분기 테스트, "queued=false 면 503..." 테스트 바로 앞).
  - 상세: 참조 동일성 단언이 마스킹 도입으로 더 이상 성립하지 않게 되자, 원래 단언의 의도
    ("stale 최초 lookup 이 아니라 cancel 후 재조회 결과")를 `not.toMatchObject` 로 계속
    판별 가능하게 유지했다. 단순히 값만 느슨하게 비교했다면 stale 값도 통과하는 vacuous
    테스트가 될 뻔했다 — 이 저장소가 반복 겪은 실패 형태(`feedback_vacuous_test_three_shapes`)를
    이번엔 피했다.
  - 제안: 조치 불필요. 참고 기록.

- **[INFO]** (긍정 관찰) copy-on-change 최적화가 **값 비교가 아닌 참조 동일성**으로 고정돼
  있어 실제로 판별력이 있다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts` —
    `it('⑤-c \`error\` 가 없는 행은 **원본 참조 그대로** 돌려준다 (무조건 spread 회귀 차단)', ...)`.
  - 상세: 무조건 `{...ne, error: ...}` 로 되돌리는 회귀를 넣어도 값만 비교하는 단언(`⑤-b`)은
    여전히 GREEN 이 되므로, `toBe(clean)` / `not.toBe(failed)` 로 참조를 직접 확인하는 이
    테스트가 유일하게 그 회귀를 잡는다. 실제로 `background-runs.service.ts` 뮤테이션 실측으로
    이웃 표면의 판별력도 별도 확인했다(상단 "대상 요약" 참조).
  - 제안: 조치 불필요.

## 확인한 항목 (문제 없음)

- **테스트 격리**: `executions.service.spec.ts`/`background-runs.service.spec.ts` 모두
  최상위 `beforeEach` 에서 `service`/repo mock 을 전부 새로 생성한다. 모듈 레벨 공유 상태
  (`snapshotCache`)는 인스턴스 필드라 테스트 간 오염이 없음을 소스로 확인했다.
- **Mock 적절성**: `redactStoredErrorForResponse` 를 mock 하지 않고 실제 구현을 그대로
  태워 마스킹 결과값을 단언한다(`MASKED` 상수가 실제 정규식 동작과 일치함을
  `sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS` 대조로 확인) — 과도한 mock 으로
  실동작과 괴리되는 흔한 실패 형태를 피했다.
- **엣지 케이스**: `redact-stored-error.spec.ts` 는 URI 자격증명·Bearer 토큰·중첩
  `details` 키·null/undefined·비변이·레거시 string/number 통과·자격증명 없는 연결 문자열
  캐너리·평범한 메시지 무변화 캐너리까지 9개 케이스를 커버한다. `executions.service.spec.ts`
  신규 스위트는 4개 독립 반환 지점(`findById`/`findByWorkflow`/`getChain`/`stop`) +
  `stop` 의 `affected=0` 분기 + `nodeExecutions[]` 형제 필드 우회까지 개별 단언한다 — "한
  헬퍼 호출로 한 번만 검증" 하지 않고 표면마다 독립적으로 겨눠, 특정 호출부 하나만 빠지는
  회귀(이 PR 이 실제로 겪은 실패 형태)를 각각 잡는다.
- **테스트 가독성**: 각 테스트 상단 주석이 "왜 이 테스트가 필요한가"(예: `⑤-c` 가 `⑤-b` 의
  vacuous 함을 왜 보완하는지)를 명시해 의도가 분명하다.
- **테스트 용이성**: `toResponseExecution` 단일 관문화로 4개 반환 지점의 마스킹 누락
  가능성이 구조적으로 줄었고, `as Execution` 무단 단언 제거로 `.error` null-check 누락을
  컴파일러가 잡을 수 있게 됐다 — 테스트가 아니라 타입이 첫 번째 방어선이 되도록 리팩터한
  점은 테스트 용이성 관점에서 바람직하다.
- **회귀 테스트**: 기존 테스트(`stop()` 참조 동일성 단언, `affected=0` 관련 등)가 API 변경에
  맞춰 의도를 보존한 채 갱신됐음을 확인했다(위 발견사항 참조). `npx jest` 로 3개 스위트
  67/67 PASS 를 직접 재현했다.

## 요약

이번 diff 는 신규 유틸 1개 + 소비처 2개 서비스에 대해 표면별 독립 테스트, copy-on-change
참조 동일성 검증, 캐시 경로 재확인, 반환 타입 변경에 따른 등가 교체 회귀 테스트까지 갖춰
테스트 품질이 전반적으로 높다. 직접 실행(67/67 PASS)과 표적 뮤테이션(마스킹 호출 제거 →
RED 확인 후 원복)으로 판별력도 실측했다. 유일하게 남는 것은 INFO 수준의 대칭성 갭 —
`background-runs.service.spec.ts` 에 `error: null` 패스스루를 명시적으로 단언하는 테스트가
없다(같은 PR 이 `executions.service.spec.ts` 쪽에는 세워 둔 대칭 케이스). 차단 사유는 아니다.

## 위험도

LOW
