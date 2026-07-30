# 신규 식별자 충돌 검토 — spec-update-retry-claim-backstop-gap.md

## 검토 대상

- target: `plan/in-progress/spec-update-retry-claim-backstop-gap.md`
- 성격: `spec/5-system/4-execution-engine.md` §7.5 대칭 Rationale 중 한 문단(구 줄
  1387-1391)을 정정하는 **spec 갱신 제안**(project-planner 미착수, developer 가 남긴
  제안). 신규 섹션·신규 파일 신설 없이 기존 문단 텍스트만 Before/After 로 교체.

## 발견사항

이 target 이 실제로 spec 본문에 "새로" 도입하는 식별자는 사실상 없다. After 문단이
언급하는 모든 코드/문서 식별자를 원본과 대조한 결과는 다음과 같다.

| 식별자 | target 내 용법 | 기존 정의/용법 대조 결과 |
|---|---|---|
| `claimSpawnedRetryRow` | "이 2차 claim(`claimSpawnedRetryRow`) 경로는 그 백스톱이 닿지 않는다" | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:538` 의 **유일한** private 메서드 정의와 정확히 일치(다른 정의 없음, `dist/` 컴파일 산출물만 파생). spec 본문에는 지금까지 등장한 적 없어 이번이 첫 인용이지만, 의미가 코드 JSDoc(동 파일 500-527행 "알려진 백스톱 갭")과 100% 일치 — 신규 발명이 아니라 기존 단일 정의의 정확한 전재 |
| `recoverStuckExecutions` | Before/After 공통, 백스톱 주체로 계속 언급 | `execution-engine.service.ts:3040` 단일 정의. target 은 이 함수의 "적용 범위 밖" 을 명시하는 방향으로만 문구를 좁힘 — 함수 자체의 의미 변경 없음 |
| `failOrphanRunningNodeExecutions` | 근거 인용부에서만 언급(Before/After 본문에는 직접 노출 안 됨) | `execution-engine.service.ts:3171` 단일 정의. 같은 spec 파일 884행이 이미 이 함수를 "case B re-drive 진입 시 orphan NodeExecution 마감" 으로 설명 중 — target 의 신규 문단은 "그 마감 경로가 discard-후-terminal 케이스에는 적용되지 않는다" 는 **보완적 예외**를 추가하는 것으로, 884행 서술과 모순 없이 공존 |
| `claimResumeEntry` | Before/After 공통, "형제 continuation 4종" 표현 | `execution-engine.service.ts:1174` 단일 정의. 문구 변경 없음(Before/After 동일 취급) |
| `retry-turn-terminal-guard.md` #15 | "후속은 `...` #15" | 해당 plan 파일 340행 항목 번호 #15 와 정확히 일치(같은 백스톱 갭, 같은 wording "spawn row 가 RUNNING orphan 으로 영구 잔류 가능") — target 의 After 문단은 이 plan 항목의 문구를 spec 쪽으로 옮겨 적은 것 |
| `#10` (근거 요약 중 "`#10` 이 세운 패턴") | "spec 은 코드와 동반" 패턴의 출처로 인용 | `plan/complete/spec-draft-impl-prep-blockers.md:96` 및 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:574` 양쪽에서 동일하게 "retry_last_turn 원자성 spec 갱신을 코드와 동반 처리" 항목 번호로 쓰인 것과 일치 — 커밋 `b351731f0` 메시지의 "(#10 동반)" 도 같은 항목을 가리켜 3개 문서·1개 커밋 메시지가 모두 같은 참조로 수렴, 오버로드 없음 |

요구사항 ID, 엔티티/DTO/인터페이스명, API endpoint, webhook/queue/SSE 이벤트명,
환경변수·config key, 신규 spec 파일 경로 — 6개 점검 관점 중 어느 것도 target 이 새로
만들어내지 않는다(전부 "기존 식별자의 정확한 재인용" 범주). 아래 1건만 참고용 INFO 로
남긴다.

- **[INFO]** "orphan" 서술어의 3중 용법 — 같은 spec 파일 안에서 명시적 상호 참조 없음
  - target 신규 식별자: 정식 식별자 아님. After 문단의 "discard 된 spawn row 자체는
    RUNNING orphan 으로 영구 잔류할 수 있다" (일반 서술어 "orphan" 사용)
  - 기존 사용처:
    - `spec/5-system/4-execution-engine.md:884` — "orphan row 마감"
      (`failOrphanRunningNodeExecutions`, case B re-drive 시 옛 RUNNING NodeExecution
      을 terminal 로 마감)
    - `spec/5-system/4-execution-engine.md:1663-1671` — "orphan pending backstop"
      Rationale (`recoverOrphanPendingExecutions`, PENDING Execution 대상)
  - 상세: 세 용법 모두 "orphan" 이라는 동일 낱말을 쓰지만 가리키는 엔티티·상태·처리
    결과가 전부 다르다 — ① 884행: NodeExecution/RUNNING/**마감됨**(백스톱 있음),
    ② 1663행: Execution/PENDING/**cancel 됨**(백스톱 있음), ③ target 신규 문단:
    NodeExecution(spawn row)/RUNNING/**미해결 잔류**(백스톱 없음). 셋 다 서로 다른
    함수·다른 트리거 조건이라 실질적인 이름 충돌은 아니며, ③은 이미
    `retry-turn-terminal-guard.md` #15 에 존재하던 문구를 그대로 승계한 것이라 target
    이 새로 지어낸 표현도 아니다. 다만 한 파일 안에 "orphan" 이 쓰인 세 문단 중
    ①②는 백스톱이 있고 ③만 없다는 대비가 상호 참조 없이 흩어져 있어, 빠르게 훑는
    독자가 "orphan = 이미 처리되는 것" 으로 일반화해 ③을 놓칠 소지가 있다.
  - 제안: (선택, 저비용) After 문단 끝 또는 `함께 반영할 것` 절에 "본 orphan 은
    §7.1/§7.4 Rationale 의 orphan pending(Execution, PENDING, cancel 로 해소)·
    orphan NodeExecution 마감(884행, case B re-drive 시 해소) 과는 별개로, 어느
    백스톱도 닿지 않는 유일한 잔류 케이스" 라는 1문장 각주를 붙이면 세 orphan 서술의
    경계가 명확해진다. 이미 승인된 plan 문구의 정확한 계승이므로 이는 target 결함이
    아니라 선택적 명확화 제안이다.

## 요약

target 은 `spec/5-system/4-execution-engine.md` §7.5 대칭 Rationale 한 문단의 텍스트만
교체하는 매우 좁은 스코프의 spec 갱신 제안이며, 신규 요구사항 ID·엔티티/DTO/인터페이스·
API endpoint·이벤트명·환경변수/설정키·파일 경로 중 어느 것도 새로 도입하지 않는다.
문단에 처음 등장하는 코드 식별자 `claimSpawnedRetryRow` 를 포함해 인용된 모든
식별자(`recoverStuckExecutions`, `failOrphanRunningNodeExecutions`, `claimResumeEntry`,
plan #15, PR/항목 #10)를 코드·plan 원본과 대조 확인한 결과 전부 기존 단일 정의와
정확히 일치했고 다른 의미로 쓰이는 사례는 발견되지 않았다. 유일한 관찰은 "orphan" 이라는
일반 서술어가 같은 spec 파일 내 이미 존재하는 두 개의 다른 orphan 개념(orphan pending
backstop·orphan NodeExecution 마감)과 표면적으로 겹쳐 보일 수 있다는 INFO 수준
명확화 여지뿐이며, 이는 새 용어 신설이 아니라 기존 plan 문구의 정확한 승계다. 신규
식별자 충돌 관점에서 이 target 은 안전하다.

## 위험도

NONE
