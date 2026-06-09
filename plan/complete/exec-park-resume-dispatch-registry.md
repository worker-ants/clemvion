---
worktree: exec-park-followup-272c4f
started: 2026-06-06
owner: developer
completed: 2026-06-10
spec_impact: none
---

# Plan — resume dispatch registry 추출 (exec-park B-1 "rehydration 일반화")

> umbrella [`exec-park-durable-resume.md`](exec-park-durable-resume.md) §"umbrella 잔여" 의 PR3
> "rehydration 일반화(ai_agent → 일반 노드)" 항목. 조사(2026-06-06) 결과 **현 시점 실제
> 기능 갭은 없음** — park 가능 노드 4종(form·buttons·ai_agent·information_extractor) 모두
> 재개 경로 존재, spec §1.3 L111 의 checkpoint allow-list(ai_agent·information_extractor)와
> 정합. 사용자 결정(2026-06-06): **확장성 리팩토링까지 진행** — 미래 blocking 노드 타입이
> plug-in 되도록 type-별 하드코딩 분기를 registry 기반 dispatch 로 추출.

## 동기 / Rationale
- **실제 중복(DRY)**: 동일한 form/buttons/ai if-else-throw 분기가 `driveResumeAwaited`(top-level,
  L1876–1958)와 `driveResumeFrame`(nested call-stack frame, L2270–2336) **두 곳에 중복**. 선택
  로직·처리기 호출이 동일, 차이는 반환 타입(`void` vs `{parked,output}`)과 에러 메시지 문구뿐.
- **확장 seam**: 새 blocking 노드 타입의 재개 로직을 self-contained `ResumeTurnDispatch`
  (selects/handle) 객체로 표현 + ordered registry 1곳 등록 — 성장하는 if/else 대비 계약 명확.
- **동작 보존**: 선택 우선순위(form → buttons → ai), 에러 코드(`RESUME_CHECKPOINT_MISSING`/
  `RESUME_INCOMPATIBLE_STATE`), PARK_RELEASED 조기반환 의미 **불변**. 순수 구조 리팩토링.

## 스코프
- [x] **S1** `shared/execution-resume/process-turn-result.ts` 신설 — `PARK_RELEASED`/`ParkSignal`/
      `ProcessTurnResult` 를 service(구 L275–285)에서 이관. service 는 import 로 대체(33 PARK_RELEASED
      참조 무변, 로컬 선언 동일 커밋 삭제 — W6). shared 순수성 유지(모듈 의존 0).
      파일명 `park-signal.ts`→`process-turn-result.ts`(--impl-prep W5: `park-release-signal.ts` 혼동 회피).
- [x] **S2** `modules/execution-engine/resume-turn-dispatch.ts` 신설 — `ResumeTurnDispatch`
      인터페이스(`kind`/`selects(sel)`/`handle(ctx)`) + `ResumeTurnSelector`/`ResumeTurnContext` 타입.
- [x] **S3** service 에 lazy `resumeTurnRegistry`(form→buttons→ai, 기존 우선순위) + 단일
      `dispatchResumeTurn(ctx)`(registry find → 없으면 RESUME_CHECKPOINT_MISSING) + `handleAiResumeTurn`
      (buildRetryReentryState+seed+processAiResumeTurn 캡슐화) 추가.
- [x] **S4** `driveResumeAwaited`·`driveResumeFrame` 두 분기 블록을 `dispatchResumeTurn` 호출 +
      `if (outcome === PARK_RELEASED) <site별 조기반환>` 으로 대체. ~150줄 중복 제거.
- [x] **S5** 단위테스트 7건(`dispatchResumeTurn` describe): form/buttons/ai 라우팅, form>buttons 우선,
      PARK_RELEASED 전파, 미지원→throw, ai checkpoint 부재→throw. execution-engine spec 322→329.

## 워크플로
- [x] 사전 일관성 검토: `/consistency-check --impl-prep spec/5-system/` → BLOCK:NO(`18_51_56`, W5/W6 반영).
- [x] TEST(lint 0err / unit 6402 / build / e2e 176 — `execution-park-resume.e2e-spec.ts` 포함) 전부 PASS.
- [x] `/ai-review`(`19_18_43` LOW/7W → fix `8e07a29c` → 최종 `19_32_46` LOW/4W) +
      `/consistency-check --impl-done`(`19_32_46` BLOCK:NO/MEDIUM 2W). 모든 W 조치/수용/후속.
- [x] SPEC-DRIFT(§7.5/§6.2·interaction-type-registry dispatch 레이어 미반영) → 비차단,
      `spec-sync-resume-dispatch-registry.md` 신설 추적(planner). 본 PR 코드 무변경 종결(루프 회피).
- spec 변경 불요(동작·allow-list 불변, registry 는 내부 메커니즘). 신규 파일 2개는 모두 기존
  spec frontmatter 글롭(`modules/execution-engine/**`·`shared/execution-resume/**`)에 포함.

## 진행 메모
- 2026-06-06 착수. origin/main 기반(plan housekeeping commit `3267f44d` 위). worktree exec-park-followup-272c4f.
