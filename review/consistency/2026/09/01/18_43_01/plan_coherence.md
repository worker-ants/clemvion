# Plan 정합성 검토

## 검토 범위 및 방법

target 은 `spec/5-system/` (이 브랜치의 spec 델타 0개 — 정상, 코드 전용 PR). 실제 변경은
`codebase/backend` 8파일/612줄로, `plan/in-progress/ie-resume-turn-boundary-cancel.md` ·
`plan/in-progress/retry-turn-terminal-guard.md` 두 트래커의 "C-4(2026-09-01)" 잔여 항목
처분이다. `git diff origin/main...HEAD` 로 실제 코드·plan 변경분을 직접 확인했고, 두 target
plan 은 프롬프트 번들에 전문이 포함돼 있어 그대로 검토했다. 예산 절단으로 생략된 인접 plan
(`spec-update-node-cancellation-shutdown-classification.md`, `node-cancellation-residual-signal-propagation.md`,
`update-returning-tuple-shape.md`, `eia-terminal-payload.md`) 은 절대경로로 직접 읽어 교차
확인했다.

## 발견사항

- **[WARNING]** `retry-turn-terminal-guard.md` 의 "단일 진실 목록"(§코드 — 우선순위 순)이
  이번 C-4 완료 항목 3건을 반영하지 못해 stale 하다
  - target 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` —
    `prepareSuccessTermination`(신설) · `markSpawnedRowFailed`(신설) · `finalizeGuarded`
    JSDoc `@param` 보강. 세 변경 모두 이 diff 에 실제로 존재함을 `git diff origin/main...HEAD`
    로 확인
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md:508-530` (`### 코드 — 우선순위
    순` 표, "**같은 걸 두 번 잡게 되므로 아래를 단일 진실 목록으로 삼는다**" 라고 이 plan
    스스로 명시한 절)
  - 상세: 이번 세션이 각 라운드 절의 인라인 체크박스는 정확히 갱신했다 —
    - `:520` 부근 "W3 (maintainability)" → `[x] 완료 (2026-09-01, C-4)` (`markSpawnedRowFailed` 추출)
    - `:405-412`(1R INFO 2)·`:445-450`(2R W3) → 둘 다 `[x]` 로 종결(JSDoc `@param` 보강으로 처리)
    - 4R INFO 2 → `[x] 완료 (2026-09-01, C-4)` (`prepareSuccessTermination` 도입)

    그런데 이 세 항목은 각각 마스터 표의 **#9**(`:520`, "`markSpawnedRowFailed` 추출 (3곳
    반복) | P3"), **#10**(`:521`, "`finalizeGuarded` in-place 변이 은닉 … | P3"), **#5**(`:516`,
    "`execution.error` 미클리어 … | P3") 행과 1:1 대응하는데, 그 표 자체는 이번 diff 에서
    **한 글자도 바뀌지 않았다**(`git diff -- plan/in-progress/retry-turn-terminal-guard.md`
    확인 — 표가 있는 508~530행 구간에 diff hunk 없음). 세 행이 여전히 "P3"(미해결)로 남아
    있어, 본문 프로즈만 읽지 않고 이 표만 참조하는 다음 세션은 이미 끝난 세 항목을 다시
    조사하거나 재작업할 위험이 있다.

    같은 plan 문서 안에서 이 drift 가 처음이 아니다 — 바로 위 "C-4 처분 (2026-09-01)" 절의
    "정정 (C-4 리뷰 2R)" 자체가 "표와 수치가 어긋났다" 는 자기 수정 이력을 담고 있는데, 그
    수정은 그 절 바로 아래 6행 표만 재검산했을 뿐 이 §코드 표는 건드리지 않았다 — 한 대상의
    두 사본 중 하나만 고치는 같은 패턴이 세 번째 사본(§코드 표)에서 재발했다.
  - 제안: `retry-turn-terminal-guard.md` §코드 표 #5·#9·#10 행에 "완료 (2026-09-01, C-4)"
    갈음 표시 + 해당 라운드 절 참조를 추가할 것. 표 자체가 "착수 전 재판정" 근거로 쓰이도록
    설계돼 있으므로("착수 시 주의: 병렬 세션이 먼저 닫을 수 있다"), 이 세 행을 열어 둔 채
    두면 그 설계 의도가 이 plan 자신에게서 무너진다.

## 확인했으나 문제 없음으로 판정한 항목 (기록용)

- **`spec-update-node-cancellation-shutdown-classification.md` 최상단 미해결 (a)/(b) 결정**
  (SIGTERM/timeout 유발 abort 를 `failed` 로 유지할지 `cancelled` 로 재정의할지, 사용자 결정
  대기) — 이번 diff 의 `executeSync` timeout catch 반환값 소비 fix 는 **기존 `FAILED`
  분류를 그대로 유지**한 채 관측성(warn 로그)만 추가했다. 분류 자체를 바꾸지 않으므로 이
  미해결 결정을 우회하거나 선점하지 않는다.
- **`node-cancellation-residual-signal-propagation.md`** — "IE multi-turn resume 경로 signal
  미전파" 항목이 `ie-resume-turn-boundary-cancel.md` 로 이관됐음을 명시하고 "실제 진행은 그
  plan 의 체크박스로 읽을 것" 이라 정확히 위임 — 이번 target 변경과 충돌 없음.
- **`execution.entity.ts` `error` 필드 `Record<string, unknown> | null` 로 타입 확장** —
  `spec/1-data-model.md:474` §2.13 이 이미 `error | JSONB? |` 로 nullable 을 선언하고 있어,
  이번 변경은 새 계약을 만드는 것이 아니라 **기존에 spec 보다 좁았던 엔티티 타입을 spec 에
  맞춘 정정**이다. `eia-terminal-payload.md`(완료, `retry-turn.service.ts:963` 동일 코드
  구역을 다뤘던 plan)의 wire 계약(`error` 객체화, `code`/`nodeId` nullable)과도 레이어가
  다르다 — 그쪽은 FAILED/CANCELLED 종결의 wire payload shape, 이번 건은 COMPLETED 종결의
  DB 컬럼 클리어라 겹치지 않는다.
- **`retry-turn-terminal-guard.md` 마스터 표 #3**(atomic-consume SQL 실 Postgres 검증
  갭)은 이번 C-4 의 "W6" 완료로 **부분적으로만** 좁혀졌다 — unit 계층 mock-인자 단언은
  추가됐으나 실 Postgres 검증은 여전히 없고, 그 항목 자체(및 대칭 항목 #4 COALESCE e2e)도
  C-4 처분표에서 "e2e 인프라 필요, 단위는 원리적으로 SQL 유효성을 못 본다" 로 스스로 열어
  뒀다. 표 미갱신이 아니라 실제로 남아 있는 갭이므로 위 WARNING 대상에 포함하지 않았다.

## 요약

target 코드 diff(8파일/612줄)는 `ie-resume-turn-boundary-cancel.md` · `retry-turn-terminal-guard.md`
두 plan 이 명시적으로 추적하던 C-4 잔여 항목의 처분이며, 두 plan 이 남긴 미해결 결정
(`spec-update-node-cancellation-shutdown-classification.md` 최상단 (a)/(b) 택일)을 우회하거나
선점하는 결정은 발견되지 않았다. 선행 plan 의존 관계(부모 plan → 이관, spec 위임 완료 상태)도
정확히 반영돼 있다. 유일한 실질 결함은 `retry-turn-terminal-guard.md` 내부에 있다 — 이 plan이
스스로 "단일 진실 목록" 으로 지정한 §코드 표가 이번에 완료된 3개 항목(#5·#9·#10)을 반영하지
못해, 그 표만 보는 다음 세션이 이미 끝난 작업을 다시 조사할 위험이 남는다. 이는 이 plan 계열이
과거에도 반복 지적받은 "여러 사본 중 일부만 갱신" 패턴의 재발이며, cross-plan 충돌이 아니라
plan 자체의 후속 항목 동기화 누락이다.

## 위험도

LOW
