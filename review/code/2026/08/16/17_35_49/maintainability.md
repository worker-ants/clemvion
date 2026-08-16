# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `NodeExecution.error` 마스킹 자리가, 이 PR이 바로 위(같은 함수 `findById`)에서
  `Execution.error` 에 대해 방금 고친 것과 **동일한 null-hiding 캐스트 패턴**을 재도입한다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:635`
    (`reconciledNodeExecutions` 산출부의 `} as NodeExecution),`)
  - 상세: 이 PR 은 `toResponseExecution`(gate 970, JSDoc gate 960-968)에서 정확히 이 문제를
    설명하고 고쳤다 — "엔티티는 `error: Record<string, unknown>` 로 `| null` 없이 선언돼
    있는데 `redactStoredErrorForResponse` 는 `null` 을 돌려줄 수 있다. 종전 `as Execution`
    캐스트는 그 `null` 가능성을 지워 이후 소비자가 `.error` 를 null-check 없이 만져도
    컴파일러가 침묵하게 만든다"(직전 라운드 `17_12_34` maintainability W1). 그래서 `Execution`
    쪽은 `ResponseExecution` 이라는 명시 타입(gate 87-96, `error: Record<string, unknown> | null`)을
    신설해 무단 단언을 제거했다.
    그런데 같은 함수(`findById`) 안, 그보다 불과 20여 줄 위에서 `NodeExecution.error` 를
    마스킹하는 자리(gate 627-636)는 여전히 `... as NodeExecution` 로 캐스트한다.
    `NodeExecution` 엔티티도 `error: Record<string, unknown>` 로 `| null` 이 없다
    (`modules/node-executions/entities/node-execution.entity.ts:76`) — 즉 **완전히 같은 형태의
    타입 불일치**다. 실측: 캐스트를 제거하면(`{...ne, error: redactStoredErrorForResponse(ne.error)}`,
    `as NodeExecution` 없이) `tsc --noEmit` 이 즉시
    `TS2322: Type '{ error: Record<string, unknown> | null; ... }[]' is not assignable to type 'NodeExecution[]'`
    를 낸다 — 캐스트가 실제로 그 타입 오류를 숨기고 있음을 확인했다(원복 완료).
    지금 당장은 `ne.error == null ? ne : (...)` 삼항의 else 분기 안에서만 이 값을 만들므로
    런타임에서 실제로 `null` 이 새어 나갈 가능성은 낮지만(입력이 non-null 일 때만 마스킹
    함수를 호출), 타입 시스템 관점에서는 이 PR 자신이 "왜 문제인지" 를 문서화하고 고친
    바로 그 결함 클래스를 형제 필드에 남겨 둔 것이다 — 이 저장소가 반복 기록해 온
    "하드닝을 자매 함수/자매 필드에 미적용" 패턴의 축소판이다.
  - 제안: `NodeExecution` 에도 `Execution` 과 동일한 처방을 적용한다 — 예컨대
    `type ResponseNodeExecution = Omit<NodeExecution, 'error'> & { error: Record<string, unknown> | null }`
    를 정의하고 `ExecutionDetailWithTrigger.nodeExecutions` 타입을 그쪽으로 좁힌 뒤 캐스트를
    제거하거나, 최소한 캐스트 옆에 "삼항의 else 분기이므로 이 시점엔 반드시 non-null" 이라는
    근거 주석을 남겨 왜 여기서는 무단 단언이 안전하다고 판단했는지 기록한다.

- **[INFO]** `buildSingleQB` mock 헬퍼가 같은 스펙 파일 안에서 다시 한 번 완전 복제된다 —
  직전 라운드에서 이미 INFO 로 판정·의도적으로 유지하기로 한 상태를 재확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:396`
    (`describe('findById → execution_node_log 기반 executionPath 채움', ...)` 안의 선존 정의)와
    `:861`(이번 PR 이 새로 추가한 `describe('Execution.error 응답 마스킹 — 표면 전수', ...)` 안의
    정의) — `leftJoinAndSelect`/`leftJoin`/`addSelect`/`where`/`getOne` mock 체인까지 완전히
    동일하다.
  - 상세: `review/code/2026/08/16/17_12_34/maintainability.md`(같은 changeset 에 포함된 직전
    라운드 산출물)가 이미 같은 지점을 지적했고, `RESOLUTION.md` 는 "이번 diff 가 만든 중복이
    아니다 — 선존 관행(표면별 describe 가 각자 지역 헬퍼를 정의)을 새 describe 가 그대로
    따른 것" 이라는 이유로 INFO 로 남기고 손대지 않기로 결정했다. 코드는 실제로 그 결정
    그대로다(두 정의 모두 여전히 존재). 반복 지적을 피하기 위해 참고로만 남긴다 — 헬퍼를
    파일 상단 공용 영역(다른 `buildListQB` 근처)으로 끌어올려 두 `describe` 가 공유해도
    "한 표면이 빠지면 전체가 깨진다"는 표면별 독립 테스트 의도는 그대로 보존된다.
  - 제안: 조치 불요(이미 문서화된 결정 유지). 다음에 세 번째 `describe` 가 같은 헬퍼를
    또 복제하려는 시점이 오면, 그때는 끌어올리는 편이 낫다는 정도로 기록.

- **[INFO]** `.claude/docs/plan-lifecycle.md` 의 `pending_plans` 키가 선언 위치(spec 레벨 vs
  plan 레벨)에 따라 의미가 갈리는 오버로딩을 문서 자신이 인지한 채로 도입 — 코드는 아니지만
  네이밍/일관성 관점에서 동일 관찰
  - 위치: `.claude/docs/plan-lifecycle.md:80-96` (신규 표 + 캐비엇)
  - 상세: 같은 키 `pending_plans` 가 `spec/**` frontmatter 에서는 "이 spec 의 미구현 surface 를
    책임지는 plan"(강제 게이트 있음, `spec-pending-plan-existence.test.ts`)을, `plan/**`
    frontmatter 에서는 "이 plan 의 선행/의존 plan"(가드 없음, 사람이 읽는 힌트)을 뜻한다.
    판별 근거는 선언 파일의 **경로뿐**이고 별도 discriminator 필드가 없다. 문서 자신이
    "이미 관행이 됐다"며 금지하지 않는다고 명시하고, 이는 이미 앞선 리뷰 라운드
    (`review/code/2026/08/16/17_12_34/architecture.md`)에서 INFO 로 다뤄진 항목이라 중복
    지적을 피하되, 유지보수성 관점에서도 같은 결론이다 — 같은 키를 다른 강제 수준의 계약에
    재사용하는 것은 일반적으로 읽는 사람이 파일 위치를 먼저 확인해야만 의미를 알 수 있는
    암묵적 인터페이스이며, 트레이드오프를 문서가 명시적으로 감수하고 있으므로 차단 사유는
    아니다.
  - 제안: 조치 불요. 다만 이후 세 번째 소비처가 생기면 그때는 `pending_plans_spec`/
    `pending_plans_upstream` 처럼 키를 분리하는 것을 고려할 만하다.

## 요약

이번 changeset 의 실질 코드 변경(`redact-stored-error.ts`/`.spec.ts` 신규, `executions.service.ts`,
`background-runs.service.ts` 및 각 `.spec.ts`)은 대체로 단정하다 — 신규 함수는 짧고 단일
책임을 지키며, 직전 라운드가 지적한 `as Execution` null-hiding 캐스트는 `ResponseExecution`
명시 타입 신설로 정확히 고쳐졌고(`toResponseExecution`), `stop`/`stopInternal` 분리도 "모든
반환 지점이 같은 마스킹 관문을 통과"시키기 위한 목적이 JSDoc 에 정확히 설명돼 있다. 다만
바로 그 수정과 **완전히 같은 형태의 문제**가 같은 함수(`findById`) 안 `NodeExecution.error`
마스킹 자리에는 그대로 남아 있다(`as NodeExecution`, gate 635) — 이 PR 이 스스로 문서화하고
고친 결함 클래스를 형제 필드에는 적용하지 않은 것으로, 이 저장소가 반복적으로 기록해 온
"하드닝을 자매 자리에 미적용" 패턴의 소규모 재발이다. 나머지 두 항목(`buildSingleQB` 중복,
`pending_plans` 키 오버로딩)은 이미 직전 라운드에서 검토·의도적으로 유지하기로 결정된
상태를 재확인한 것으로 조치를 요구하지 않는다. plan/spec/review 문서 다수는 링크 경로 정정과
상태 갱신 위주의 기계적 변경으로 유지보수성 관점에서 특기할 사항이 없다.

## 위험도

LOW
