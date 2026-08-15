# 유지보수성(Maintainability) 코드 리뷰

## 리뷰 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted` 두 UPDATE 를 `dataSource.transaction` 으로 원자화(자매 함수 `cancelParkedExecution`/`markWebChatIdleTimeout` 과 동형화) + JSDoc 보강
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 회귀 테스트 3건 + 헬퍼 `installStalledTx` 추가/재사용
- `CHANGELOG.md`, `spec/5-system/4-execution-engine.md`, `plan/in-progress/*.md` — process/문서 파일. 코드 유지보수성 관점 밖이라 서술 품질만 가볍게 확인, 별도 지적 없음.

이 diff 는 직전 라운드(`review/code/2026/08/15/16_04_38`)의 WARNING 4건이 이미 반영된 상태다 —
`installStalledTx` 헬퍼가 신규 첫 테스트에서도 재사용되고, cascade UPDATE 의 `where`/`andWhere`
단언이 추가됐고, CHANGELOG·JSDoc 이 채워졌다. 그 4건은 재확인만 하고 새로 발견된 것만 아래
기재한다.

### 발견사항

- **[WARNING]** JSDoc 문단과 바로 아래 인라인 주석이 거의 동일한 문장을 두 번 반복 — 이 diff 자체가 새로 만든 중복(직전 라운드 W3 "JSDoc 미갱신" 을 고치며 생김)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3325-3328`(JSDoc, `finalizeStalledExhausted` 헤더 안 "두 UPDATE 는 단일 트랜잭션이다" 문단) vs `:3348-3351`(함수 본문 최상단 인라인 주석)
  - 상세: 두 블록 모두 "자매 `cancelParkedExecution`/`markWebChatIdleTimeout` 과 동형이다 → 종전엔 이 함수만 각각 autocommit 이라 첫 UPDATE 커밋 후 둘째 실패 시 자식이 영구 RUNNING 잔류 → 셋 중 이 하나만 열려 있었다" 를 문장 단위로 거의 그대로 반복한다(약 90% 동일 문구, 4줄씩). 이번 diff 가 직전 라운드 WARNING #3("JSDoc 미갱신")을 고치며 JSDoc 문단을 새로 추가했는데, 그 자리 바로 아래에 원래 있던 인라인 주석(이번 diff 이전부터 존재)과 통합하지 않고 나란히 남겼다. 이 저장소가 스스로 반복 지적해 온 "손으로 반복하면 갈린다"(테스트 파일 `:4966`, `:3391` 주석이 같은 원칙을 명시)는 원칙이 바로 이 자리에서 comment 레벨로 재현된 형태 — 나중에 한쪽만 수정되면(예: race 각주 갱신, 트랜잭션 세부 변경) 두 설명이 서로 모순되는 상태로 방치될 위험이 있다. 대조로 자매 `cancelParkedExecution`(`:1017-1021`)은 트랜잭션화 근거를 JSDoc 한 곳에만 적고 본문에는 반복하지 않는다 — 이 함수만 두 곳에 적힌 형태로 벗어났다.
  - 제안: 인라인 주석(`:3348-3351`)을 "자매와 동형 — 근거는 위 JSDoc 참조" 한 줄로 축약하거나, 반대로 JSDoc 을 축약하고 본문 주석 쪽에만 상세를 남긴다. 어느 쪽이든 근거 서술은 한 곳에만 남긴다.

### 확인만 하고 넘어간 항목 (이미 트래커에 등재·의도적 보류)

- **[INFO]** `RETURNING` duration 추출 관용구(`toFiniteNumber((result.raw as ...)?.[0]?.duration_ms) ?? null`)가 `cancelParkedExecution`/`markWebChatIdleTimeout`/`finalizeStalledExhausted` 3곳에 손으로 복붙돼 있다 — 신규 코드가 만든 중복이 아니라 기존 패턴을 그대로 답습한 것이며, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:324-336`("종결 duration 관용구가 16곳에 손으로 복붙돼 있다")에 이미 등재되고 "넓은 일괄 편집이 과거 대상 밖을 조용히 바꾼 전례가 있어 별도 PR로 미룬다"는 근거까지 명시돼 있다. 이번 PR 범위에서 추가 조치 불요.
- **[INFO]** `finalizeStalledExhausted` 는 자매 두 함수와 달리 함수 레벨 `try/catch` 가 없다(이번 diff 가 만든 변화 아님, diff 전후 모두 부재) — 직전 라운드(`16_04_38` maintainability INFO)에서 이미 지적·조사됐고, 유일 호출부 `execution-run.processor.ts` `onFailed` 의 `.catch()` 가 실질적으로 흡수함이 확인돼 "무조치(선택)" 로 처분된 항목이다. 재지적하지 않는다.

### 그 외 확인 사항 (문제 없음)

- 트랜잭션 클로저 안에서 `let finalized = false` / `let stalledDurationMs` 를 외부 선언·내부 대입하는 패턴은 자매 함수(`cancelled`/`cancelledDurationMs`)와 동일한 기존 관용구 재사용 — 새 부채 아님.
- 테스트 파일의 `mkExecQb`/`installStalledTx` 네이밍은 파일 내 다른 describe 스코프의 동명 헬퍼(`makeCancelQb`/`installCancelTx`, `mkQb`)와 충돌하지 않도록 스코프별 접두사를 쓰는 이 파일의 확립된 컨벤션(`:3262-3266` 주석이 그 컨벤션의 유래를 명시)을 그대로 따른다.
- cascade UPDATE 의 `error.code` 를 `stalledError.code` 로 참조해 부모/자식 코드 문자열이 갈릴 여지를 제거한 것(매직 스트링 하드코딩 중복 회피)은 양호한 리팩터링.
- 매직 넘버·과도한 중첩·순환 복잡도 증가 없음. 함수 길이(`finalizeStalledExhausted` 약 80줄)는 자매 두 함수와 동형 구조를 유지하기 위한 의도적 선택으로, 분리보다 일관성이 우선된 판단이며 이 저장소 컨벤션과 부합한다.

### 요약

핵심 프로덕션 변경(`finalizeStalledExhausted` 트랜잭션 원자화)은 확립된 자매 함수 패턴·네이밍·에러 처리 스타일을 정확히 재사용해 가독성·일관성이 높고, 테스트 쪽도 직전 라운드 WARNING(헬퍼 미재사용)이 이미 반영돼 중복이 사라졌다. 새로 발견된 유일한 실질 결함은 직전 라운드에서 "JSDoc 미갱신"을 메우려고 추가한 문단이 바로 아래 기존 인라인 주석과 거의 동일한 설명을 반복해, 두 서술이 향후 각자 갱신되며 어긋날 수 있는 comment-level 중복이다(WARNING 1건). 그 외 이미 알려진 관용구 중복·try/catch 비대칭은 모두 정본 트래커에 등재됐거나 이미 처분이 끝난 항목이라 재지적하지 않는다.

### 위험도

LOW
