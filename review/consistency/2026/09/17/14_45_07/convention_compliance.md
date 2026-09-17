# 정식 규약 준수 검토 — `spec/2-navigation/`

## 전제 확인

- 이 PR 은 `spec/2-navigation/` 를 **한 파일도 변경하지 않았다** (scope 델타 0). target 문서
  `2-trigger-list.md` 는 diff 이전과 동일한 워킹트리 파일이며, 이번 진짜 변경은 backend 5개
  코드/테스트 파일(484줄) — `jest.config.ts`, `trigger-transaction-mock.ts`,
  `triggers.service.spec.ts`, `triggers.service.ts`, 신규 `test/trigger-update-save-window.e2e-spec.ts`.
- 위 코드 diff 는 DTO·컨트롤러·API 경로·에러 코드·swagger 데코레이터를 건드리지 않는다 —
  `TriggersService.update()` 내부 저장 전략(엔티티 통째 `save` → 부분 객체 `save`)만 바꾼다.
  따라서 "명명 규약"·"출력 포맷 규약"·"API 문서 규약"(swagger/DTO) 축에는 이 diff 로 인한
  신규 위반이 없다 — 기존 에러 코드(`RESOURCE_CONFLICT`/`VALIDATION_ERROR`/`INVALID_FIELD` 등)
  표기는 `spec/conventions/error-codes.md` §1 `UPPER_SNAKE_CASE` 규율과 그대로 부합한다.
- 실제로 걸리는 축은 **"문서 구조 규약"** 중에서도 spec 자신이 성문화한 증거-등재 관례
  (`spec/conventions/spec-impl-evidence.md`)와, CLAUDE.md §자기-반증형 소정정 프로세스다.

## 발견사항

- **[WARNING]** §3 "실측되지 않은 잔여" 註가 같은 PR 의 diff 로 이미 반증됐는데 target 이 갱신되지 않았다
  - target 위치: `spec/2-navigation/2-trigger-list.md:203-207` (§3 API, "⚠️ 실측되지 않은 잔여" 블록)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` 의 evidence-traceability 원칙(§Overview:
    "spec 가 약속한 surface 가 *지금* 구현됐는가") + CLAUDE.md §자기-반증형 소정정("틀린 예고를
    남겨 두면 다음 사람이 있지도 않은 작업을 쫓는다")
  - 상세: target 은 "PATCH 의 기본 저장 경로(엔티티 통째 저장)는 ① 재읽기와 저장 사이의 CASCADE
    창에서의 실패 방식, ② 락 밖 컬럼 한정 갱신과의 경합이 확인되지 않았다" 고 적고 있다. 그런데
    이번 diff 의 `codebase/backend/test/trigger-update-save-window.e2e-spec.ts`(신규, 237줄)가
    바로 그 ①·②를 실제 Postgres + TypeORM 으로 재현해 실측했고(① CASCADE → 시끄러운 실패,
    롤백·부활 없음 확인 / ② 락 밖 컬럼 쓰기가 되돌아가는 **실결함**을 발견), 같은 diff 의
    `triggers.service.ts` 가 엔티티 통째 `save` 를 부분 객체 `save` 로 바꿔 그 실결함을 고쳤다.
    즉 "확인되지 않았다" 는 이제 참이 아니다 — **같은 PR 안에서 스스로 반증된 문장**이다. 이
    문제는 이미 `review/code/2026/09/17/13_44_39`(W1)·`14_11_48`(INFO#12)·`14_34_56`(INFO#1
    `[SPEC-DRIFT]`) 세 라운드 연속 지적됐고, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    (target 자신의 `pending_plans:`)에 planner-턴 항목으로 이미 등재돼 있다(항목 1). CLAUDE.md
    §자기-반증형 소정정 Rationale 이 바로 이 시나리오를 경고한다 — 반증된 예고가 남으면 다음
    사람이 "여기 아직 안 재본 위험이 있다" 로 오독해 이미 끝난 실측을 다시 쫓을 수 있다.
  - 제안: target 수정이 맞다(단 developer 자신이 이 문장을 planner 턴 없이 직접 고칠 수는
    없다 — 조건 2 판정: 이 문장은 동시성 계약의 일부 서술이라 순수 "예고·트리거" 로만 보기
    애매하고, plan 의 Rationale("① 을 planner 턴으로 돌린 이유")이 이미 유사 사례에서 조건
    엄격 적용을 선례로 남겼다). 이미 plan 에 준비된 교체 문구("① 재읽기 뒤 FK CASCADE 는
    시끄러운 실패로 실측(롤백·부활 없음) · ② 락 밖 컬럼 경합은 실결함이었고 부분 객체 `save`
    로 수정됨")를 planner 턴에서 반영할 것.

- **[WARNING]** 신규 증거 e2e 파일이 frontmatter `code:` 에 등재되지 않음 — 문서 자신의 관례 위반
  - target 위치: `spec/2-navigation/2-trigger-list.md:1-82` (frontmatter `code:` 목록)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의("본 spec 이 약속한
    surface 의 구현 경로")를 이 문서 자신이 frontmatter 인라인 주석으로 더 좁게 성문화한 규칙 —
    `trigger-workflow-ref.e2e-spec.ts` 항목 옆 주석: "註에 'e2e 가 고정한다' 고 적으면서 그 파일을
    등재하지 않으면 보장의 근거가 추적 불가다"
  - 상세: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` 는 §3 동시 쓰기 직렬화
    관련 개런티(위 항목의 ①·②)를 고정하는 특성 테스트인데, frontmatter `code:` 목록에는 없다
    (현재 목록엔 `trigger-workflow-ref.e2e-spec.ts` 류만 있음). `--impl-prep`
    `review/consistency/2026/09/17/13_04_39`(W1)에서 이미 같은 지적이 나왔고 plan 항목 2 로
    등재돼 있다. `code:` glob 자체는 `triggers.service.ts` 가 이미 매치해 build 가드
    (`spec-code-paths.test.ts`)는 통과하지만, 그것과 "이 문서가 스스로 정한 인용 규율 준수"는
    별개다 — 후자가 이번 발견의 대상.
  - 제안: 위 WARNING 과 같은 planner 턴에서 `code:` 에
    `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` 추가.

## 비대상 확인 (오탐 방지용 기록)

- diff 의 `triggers.service.spec.ts`/`trigger-transaction-mock.ts` 변경은 **단위 테스트·mock 헬퍼**
  이고 target 본문이 "e2e 가 고정한다" 로 명시 인용하는 대상이 아니므로 `code:` 개별 등재 의무가
  없다(기존 `triggers.service.ts` 글롭이 이미 커버).
- 에러 코드 신설·rename 없음 — `error-codes.md` §2 rename 안정성 정책 위반 없음.
- DTO·컨트롤러·swagger 데코레이터 변경 없음 — `swagger.md` 축 위반 없음.
- `2-trigger-list.md` 의 3섹션(화면 구조/기능 상세·API / Rationale) 구조 자체는 이번 diff 로
  변경되지 않았고 기존 관행(다른 `2-navigation/*.md` 와 동일)과 일치 — 별도 위반 아님.

## 요약

이번 diff 는 `spec/2-navigation/` 을 직접 건드리지 않는 순수 backend 동시성 버그 수정(엔티티
통째 `save` → 부분 객체 `save`)이라 명명·출력 포맷·API 문서 규약 축에는 신규 위반이 없다. 다만
target 문서 §3 의 "실측되지 않은 잔여" 註가 같은 PR 의 신규 e2e 특성 테스트로 이미 반증됐는데도
target 이 갱신되지 않았고, 그 e2e 파일이 문서 자신이 정한 증거-등재 관례(`code:` 인용)에서
빠져 있다 — 둘 다 `spec-impl-evidence.md` 취지 및 CLAUDE.md §자기-반증형 소정정과 맞닿아 있다.
다행히 이 두 갭은 새로운 발견이 아니라 직전 세 차례 `/ai-review` 라운드(13:44:39 W1 · 14:11:48
INFO#12 · 14:34:56 INFO#1 SPEC-DRIFT)와 `--impl-prep` 13:04:39(W1)에서 이미 포착돼
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner-턴 항목(교체 문구까지
준비됨)으로 명시 등재돼 있다 — 즉 프로세스가 이미 인지하고 정상 트랙(§자기-반증형 소정정 조건
불충족 → planner 턴)에 태워 둔 상태다. 이번 결과는 그 두 항목이 아직 미반영임을 재확인하는
용도로 보면 된다.

## 위험도

LOW
