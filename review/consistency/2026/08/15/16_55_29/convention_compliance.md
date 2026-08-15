# 정식 규약 준수 검토 — spec/5-system/ (--impl-done)

> **검토 범위 확인**: prompt 번들은 컨텍스트 예산 초과로 `spec/5-system/` 19개 파일 전부와
> `spec/conventions/` 대부분(주로 cafe24/makeshop API 카탈로그)의 본문, 그리고 실제 diff(placeholder
> `<git diff origin/main...HEAD -- code_areas>` 로만 표기)를 생략했다. "번들에 없다 = 없다" 로 오판하지
> 않기 위해 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`,
> 현재 브랜치 `claude/eia-stalled-atomicity`, HEAD `f0c55e679`)를 절대경로로 직접 `git diff`/`Read`/
> `grep` 로 실측했다.
>
> 실측 결과 — `git diff origin/main...HEAD --name-only`(review/·plan/ 제외) 는 4개 파일뿐이다:
> `CHANGELOG.md`, `spec/5-system/4-execution-engine.md`,
> `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`,
> 같은 디렉터리의 `.spec.ts`. `spec/conventions/**` 자체는 이번 diff 에서 전혀 건드리지 않았다(0
> changes) — `error-codes.md`(`WORKER_HEARTBEAT_TIMEOUT` 레지스트리)·`node-cancellation.md`·
> `node-output.md` 모두 diff 밖의 context 로만 대조했다.
>
> **직전 라운드와의 연속성**: 같은 세션 `review/consistency/2026/08/15/16_32_26/convention_compliance.md`
> (--impl-done)가 이미 이 변경(`finalizeStalledExhausted` 트랜잭션 원자화)을 검토해 CRITICAL/WARNING
> 없이 INFO 3건만 남겼다. 그중 하나는 Rationale bullet 제목의 "정정" 표현이 이 저장소의
> correction-history 관례(실제로는 이전 서술을 뒤집는 경우에 씀)와 결이 다르다는 **편집 취향 수준**
> 제안이었다. 이번 라운드 diff(`git diff 0d9c6166f..HEAD -- spec/5-system/4-execution-engine.md`)를
> 대조하니 그 제목이 실제로 "**(2026-08-15 정정)**" → "**(2026-08-15 원자화)**" 로 바뀌어 그 제안이 그대로
> 반영됐음을 확인했다. 그 외 diff 는 (a) 코드 JSDoc 에 "함수 레벨 try/catch 가 의도적으로 없다" 절 5줄
> 추가, (b) 그 계약을 잠그는 신규 유닛테스트 1건(`트랜잭션 중간 실패는 삼키지 않고 던진다 + 종결
> 이벤트도 안 나간다`), (c) `CHANGELOG.md` Unreleased 항목 1개, (d) `plan/in-progress/
> eia-stalled-atomicity.md` 체크리스트 동기화뿐이다. `spec/conventions/**` 규약을 새로 촉발할 명명·
> API surface·에러 코드·DTO 변경은 없다.

## 발견사항

- **[INFO]** 직전 라운드 편집 취향 제안("정정"→"원자화")이 이번 diff 로 그대로 반영됨 — 확인 기록
  - target 위치: `spec/5-system/4-execution-engine.md` `## Rationale` → `### PR4 — BullMQ stalled
    자동 재배달 (2026-07-04)` 절, bullet 제목
  - 위반 규약: 해당 없음 — 규약 위반이 아니라 이전 INFO 의 후속 반영 확인.
  - 상세: `git diff 0d9c6166f..HEAD -- spec/5-system/4-execution-engine.md` 는 정확히 1줄 변경이며
    "**dead-letter 마감의 원자성 (2026-08-15 정정)**" → "**dead-letter 마감의 원자성 (2026-08-15
    원자화)**" 만 바뀌었다. "정정"을 correction-history 전용 어휘로 남겨두려는 이 저장소 관례
    (`node-cancellation.md` Rationale "이 항목은 2026-08-15 에 두 번 정정됐다" 사례)와의 결 차이가
    해소됐다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 JSDoc 절("함수 레벨 try/catch 의도적으로 없음")과 신규 테스트가 실제 호출부와
  일치함 — 확인 기록
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    `finalizeStalledExhausted` JSDoc, `execution-engine.service.spec.ts` "트랜잭션 중간 실패는
    삼키지 않고 던진다 + 종결 이벤트도 안 나간다"
  - 위반 규약: 해당 없음.
  - 상세: JSDoc 은 "유일 호출부(`ExecutionRunProcessor.onFailed`)가 `.catch()` 로 흡수" 한다고
    주장한다. `queues/execution-run.processor.ts:88-94` 를 직접 대조하니
    `void this.engine.finalizeStalledExhausted(executionId).catch((err_) => { this.logger.error(...) })`
    로 정확히 일치한다. spec/conventions 범위의 명명·포맷 규약과는 직접 관련 없으나, 문서-코드
    일치 확인 차원에서 기록한다(범위가 다른 rationale_continuity/cross_spec 체커의 영역과 중복되지
    않도록 결론만 남김).
  - 제안: 조치 불필요.

- **[INFO]** 이번 diff 는 `spec/conventions/**` 문서 자체를 건드리지 않음 — 스코프 확인
  - target 위치: N/A (부재의 확인)
  - 위반 규약: 해당 없음.
  - 상세: `error-codes.md`(§3 `WORKER_HEARTBEAT_TIMEOUT` 레지스트리 — 코드가 **언제** 발행되는지는
    바뀌지 않고 원자성만 강화됐으므로 "진실(의미)" 열 갱신 불필요, 직전 라운드가 이미 확인)와
    `node-cancellation.md`(§2.4 취소 관측 가드 — 이번 변경은 `AbortSignal`/`ExecutionCancelledError`
    경로가 아니라 stalled-소진 dead-letter 경로라 무관) 모두 diff 0 을 재확인했다. 신규 migration·
    controller·DTO·API endpoint·audit action 도 없어 `migrations.md`/`swagger.md`/`audit-actions.md`
    의 명명 규약이 적용될 표면 자체가 없다.
  - 제안: 조치 불필요.

## 요약

이번 라운드의 실질 변경분은 직전 라운드(`16_32_26`)가 이미 검토한 `finalizeStalledExhausted` 트랜잭션
원자화에 대한 (1) 그 라운드의 편집 취향 INFO 를 그대로 반영한 1줄 spec 표현 수정, (2) "함수 레벨
try/catch 없음" 계약을 문서화하는 JSDoc 5줄 + 이를 고정하는 신규 유닛테스트 1건, (3) CHANGELOG·plan
체크리스트 동기화뿐이다. `spec/conventions/**` 문서 자체는 diff 0 이며, 신규 명명·API endpoint·에러
코드·DTO·migration 표면이 없어 명명 규약·출력 포맷 규약·문서 구조 규약(Overview/본문/Rationale, 본문↔
Rationale 앵커 링크)·API 문서 규약(Swagger/DTO)·금지 항목 어느 관점에서도 CRITICAL/WARNING 급 위반은
발견되지 않았다. 신규 JSDoc 주장(유일 호출부가 `.catch()` 로 흡수)은 실제 코드(`execution-run.
processor.ts`)와 대조해 사실과 일치함을 확인했다. 위 INFO 3건은 모두 확인 기록 또는 조치 불필요.

## 위험도

NONE
