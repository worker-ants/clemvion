# 정식 규약 준수 검토 — orphan pending backstop (recoverOrphanPendingExecutions)

## 검토 범위 참고

호출자가 제공한 `_prompts/convention_compliance.md` 페이로드는 `spec/5-system/1-auth.md`·
`spec/5-system/10-graph-rag.md`·`spec/conventions/{audit-actions,cafe24-api-catalog/*}.md` 만
번들되어 있고, 실제 변경 대상인 `spec/5-system/4-execution-engine.md` §7.4/§8 ·
`spec/data-flow/3-execution.md` · `CHANGELOG.md` · `execution-engine.service.ts` 는
포함되어 있지 않았다(페이로드 mis-scope, 사전 공지된 known issue). 지시에 따라 워크트리
`git diff origin/main`(실제 diff)을 1차 근거로 검토했다.

- diff 대상: `CHANGELOG.md`, `spec/5-system/4-execution-engine.md`(§7.1/§7.4/§8/Rationale),
  `spec/data-flow/3-execution.md`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  (+ 대응 spec/e2e/unit 테스트, plan 문서).

## 발견사항

- **[INFO]** convention_compliance 페이로드 mis-scope
  - target 위치: `_prompts/convention_compliance.md` 전체 (`## Target 문서` 번들)
  - 위반 규약: 해당 없음 (규약 위반이 아니라 orchestrator 산출 payload 의 스코프 누락)
  - 상세: `--impl-done, scope=spec/5-system/` 로 지정됐음에도 실제 변경 파일
    `spec/5-system/4-execution-engine.md` 가 번들에서 누락되고 무관한
    `1-auth.md`/`10-graph-rag.md` 가 대신 포함됐다. 이 자체는 target 문서의 규약 위반이
    아니라 orchestrator 측 프롬프트 조립 결함이다.
  - 제안: 코드 수정 불필요. orchestrator 프롬프트 조립 로직(diff 파일 목록 → spec 본문 번들
    매핑)을 다음 세션에서 점검 권장. 본 검토는 실제 워크트리 diff 로 대체 확인해 결론에는
    영향 없음.

- **[INFO]** 에러 코드 재사용 확인 — 신규 코드 미도입, 규약 §2(rename 안정성) 저촉 없음
  - target 위치: `spec/5-system/4-execution-engine.md` §8 (CHANGELOG 대응 항목), `execution-engine.service.ts` `recoverOrphanPendingExecutions`
  - 위반 규약: 해당 없음 — `spec/conventions/error-codes.md` §1/§2 준수 확인 항목
  - 상세: 신규 orphan-pending cancel 경로가 기존 `markQueueWaitTimeout`(조건부 UPDATE)과
    기존 코드 `EXECUTION_QUEUE_WAIT_TIMEOUT`/`cancelledBy='timeout'` 을 그대로 재사용한다
    (`git grep -n markQueueWaitTimeout` 확인 — 신규 정의 없음, 기존 메서드 호출만 추가).
    새 조건을 위해 새 이름을 만들지 않고 "consumer pick-up 시 검사했다면 나왔을 결과와
    동일"이라는 논리로 기존 코드를 재사용한 것은 error-codes.md §1 "의미 기반 명명"·
    §2 "이름 정확성 향상만을 위한 rename 은 하지 않는다"와 정확히 부합한다.
  - 제안: 없음 (규약 준수, 참고용 기록).

- **[INFO]** recovery-scan 메서드 명명 일관성
  - target 위치: `execution-engine.service.ts` `recoverOrphanPendingExecutions` (신규 private method)
  - 위반 규약: 해당 없음 — 코드베이스에 formal 명명 규약 문서는 없으나 기존 관례와 비교
  - 상세: 같은 클래스의 기존 `recoverStuckExecutions`/`reclaimStuckRunningExecution`/
    `redriveStuckExecution` 과 `recover<Subject><Verb-ing/Noun>` 패턴이 대칭이다. `spec/
    conventions/` 안에 "recovery 메서드 명명" 전용 규약 파일은 없어 CRITICAL/WARNING 대상은
    아니며, 기존 자매 메서드와의 자연스러운 일관성만 확인.
  - 제안: 없음.

- **[INFO]** spec "구현 완료/구현 상태" 배너·Rationale 서브섹션 제목 패턴 일치
  - target 위치: `spec/5-system/4-execution-engine.md` §7.1 상단 상태 배너, §Rationale
    신규 서브섹션 `### orphan pending backstop — recoverStuckExecutions 재사용 + PENDING cancel (2026-07-04)`
  - 위반 규약: 해당 없음 — CLAUDE.md "Rationale" 섹션 관례, 문서 내부 기존 제목 스타일과 비교
  - 상세: §7.1 배너에 "**PR3 구현, 2026-07-04**" 식으로 이미 구현 완료 표기가 있던 문장에
    "같은 스캔이 orphan `pending` 도 회수한다(2026-07-04)" 를 자연스럽게 이어 붙였다. 신규
    Rationale 서브섹션 제목도 기존 형식 `### <주제> (§n, PR ID, 날짜)`(예: `### 크래시/재시작
    RUNNING 세그먼트 제어된 re-drive (§7.1/§7.2/§7.5, PR3, 2026-07-04)`, `### 동시성 cap
    admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)`)와 동일한
    `<타이틀> — <부제> (<날짜>)` 골격을 그대로 따른다. Overview/본문/Rationale 3섹션 구조도
    유지된다(신규 섹션 추가가 아니라 기존 §7.1/§7.4/§8/Rationale 내부 보강).
  - 제안: 없음 (규약·기존 관례 부합).

- **[INFO]** CHANGELOG 컨벤션 일치
  - target 위치: `CHANGELOG.md` 최상단 신규 엔트리 `## Unreleased — orphan pending backstop (§8 recoverStuckExecutions)`
  - 위반 규약: 해당 없음 — 문서 내 기존 CHANGELOG 항목 포맷과 비교
  - 상세: 기존 항목들과 동일하게 `## Unreleased — <제목>` → `### 변경 사항` → 번호 목록
    `N. **볼드 리드** — 상세 설명 ... SoT: <spec 경로>.` 골격을 그대로 따른다. 신규 항목이
    맨 위(최신)에 삽입된 순서도 기존 파일의 역순(최신이 위) 관례와 일치한다. "신규
    migration·env·에러코드 없음" 명시도 실제 diff(migrations/ 무변경, DTO 무변경, 에러 코드
    재사용)와 부합해 과장 없는 정확한 기술이다.
  - 제안: 없음.

- **[INFO]** 문서 구조 — Overview/본문/Rationale 유지, `data-flow` 상태 다이어그램 갱신 정합
  - target 위치: `spec/data-flow/3-execution.md` state diagram (`pending --> cancelled` 전이)
  - 위반 규약: 해당 없음
  - 상세: 기존 단일 전이 설명("사용자 cancel")을 "(a) 사용자 cancel (b) 5분 초과 —
    admission 시점 검사 또는 orphan pending backstop" 으로 확장. `4-execution-engine.md`
    §7.4/§8 본문과 상호 포인터가 일치하며 새 용어(SoT 분산)를 만들지 않고 기존 §8/§7.4
    앵커를 그대로 재사용한다 — CLAUDE.md 의 "정보 저장 위치 단일 진실 원칙"(spec 본문에
    기술 명세, data-flow 문서는 그 파생 다이어그램)에도 부합.
  - 제안: 없음.

## 요약

실제 변경(`recoverOrphanPendingExecutions` 메서드 + spec §7.4/§8 배너·표·Rationale 서브섹션
+ CHANGELOG 엔트리 + data-flow 상태 다이어그램 갱신)은 정식 규약(`spec/conventions/**`)
관점에서 위반 사항이 발견되지 않았다. 에러 코드는 신규 발행 없이 기존
`EXECUTION_QUEUE_WAIT_TIMEOUT`/`markQueueWaitTimeout` 을 재사용해 error-codes.md §1/§2
(의미 기반 명명·rename 안정성)를 정확히 준수했고, CHANGELOG 항목은 기존 파일의 제목·섹션·
번호 목록·SoT 포인터 골격을 그대로 따랐다. spec 본문의 "구현 완료" 배너·Rationale 서브섹션
제목도 동일 문서 내 기존 항목들(PR3/PR4/PR2b 등)과 형식이 일치하며, 신규 SoT 를 만들지
않고 기존 §7.4/§8 앵커에 흡수시켜 CLAUDE.md 의 단일 진실 원칙에도 부합한다. 유일한
프로세스성 이슈는 본 검토에 전달된 `_prompts/convention_compliance.md` 번들이 실제 변경
파일(`spec/5-system/4-execution-engine.md`)을 포함하지 못하고 무관한 `1-auth.md`/
`10-graph-rag.md` 를 실었다는 점인데, 이는 target 문서의 결함이 아니라 orchestrator 측
페이로드 조립 문제이므로 BLOCK 사유가 아니다(INFO 로만 기록).

## 위험도
NONE

BLOCK: NO

STATUS: SUCCESS
