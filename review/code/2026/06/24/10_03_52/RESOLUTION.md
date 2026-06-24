# RESOLUTION — M-3 3단계 ai-review 재검토 (review/code/2026/06/24/10_03_52)

대상 범위: `84c56615..HEAD` (impl `813a4829` + review-fix `8426d829` 전체)
위험도: **LOW** · Critical 0 · Warning 1 · INFO 13 · 수렴

> 1차 검토(`09_51_30`, Risk LOW/Critical 0/Warning 1)의 finishReason Warning 은
> 본 재검토에서 INFO #12 로 내려가 수용됨(JSDoc 근거 명시). 본 라운드의 유일
> Warning 은 `makeResumeMeta` 공유 import — 아래 deliberate defer.

## Critical
해당 없음.

## WARNING

### W#1 — `makeResumeMeta` 공유 import 캡슐화 경계 관통 → **deliberate defer (현행 유지)**

- **판정 근거 (설계 의도)**:
  1. **본 작업 스펙이 명시한 결과**: M-3 3단계 지시가 "메서드 verbatim 이동 + 생성자 주입 + **공유 헬퍼 leaf 추출** + streamMessage 위임" — `makeResumeMeta` 의 "공유 헬퍼 leaf" 추출 = 두 모듈이 공유(import)하는 것이 의도된 설계. cross-boundary import 는 사고가 아니라 스펙된 형태.
  2. **무상태 collaborator 패턴 정합**: turn-scoped 카운터 `totalStallCount` 의 소유자는 streamMessage 다. 메타 derive 를 호출부에서 하고 collaborator 는 받은 메타만 write 하는 구조는 1단계(AssistantToolRouter)·2단계(AssistantFinishGuard) 의 "caller 가 turn 상태 소유, collaborator 무상태" 패턴과 동일.
  3. **impl-prep consistency 원칙과 정합**: `review/consistency/2026/06/24/09_39_46` INFO #4 가 "플래그 평가·변환 로직은 streamMessage 호출부에 잔류, 서비스는 받아 그대로 write" 를 명시 — 본 설계가 그 원칙의 직접 적용.
  4. reviewer 도 "현 단계 블로커 아님" 명시.
- **reviewer 대안 평가**: `persistAssistantTurn(..., stallRounds: number)` 오버로드는 derive 책임을 collaborator 로 이동 — 경계 관통 import 1개는 없애지만 무상태 writer 원칙(위 3)에서는 미세 후퇴. 양쪽 모두 streamMessage→service 로 카운터를 넘기는 coupling 은 동일(import vs raw 인자). strictly better 아니며 verbatim-추출 원칙에서 벗어남 → 현행 유지 + import 의도 주석으로 충분.
- **조치**: 코드 무변경. import 블록 의도 주석은 8426d829 에서 이미 추가됨.

## INFO 처분

| # | 항목 | 판정 |
|---|------|------|
| 1, 2, 10 | SPEC-DRIFT (§10 의사코드 위임 경로 / `consecutiveStallRounds`→`totalStallCount` / collaborator 목록) | **planner 위임** — developer spec semantic 미수정. 코드가 더 정확(#2 revert 금지). M-3 전체 완료 후 일괄 spec-sync 백로그. |
| 3 | positional 파라미터 7개 | **defer** — verbatim 이동 시그니처 보존. options object 화는 별건 중기 PR. |
| 4 | `as never` mock | **defer** — 기존 코드베이스 관행 일치. 별건 테스트 하드닝. |
| 5 | `currentTitle: undefined` 케이스 | **defer** — `currentTitle` 의 실제 소스 `session.title` 은 `string \| null`(undefined 불가). 파라미터 타입의 `\| undefined` 는 방어적 표기이고 `!currentTitle` 분기상 `null` 과 **완전 동일 경로**(이미 테스트됨). 추가 가치 미미한데 codebase 커밋이 review_guard 를 재무장해 불필요한 리뷰 라운드를 강제 → loop avoidance(MEMORY) 우선. |
| 6 | title 정확히 40자 경계값 | **defer** — `slice(0,40)` 는 표준 라이브러리 동작이라 경계 회귀 위험 낮음. #5 와 동일 사유(추가 codebase 커밋 회피)로 별건 테스트 하드닝 시 일괄. |
| 7 | `stallRounds` clamp | **defer (YAGNI)** — 유일 호출자 `MAX_STALL_ROUNDS=2` 방어. |
| 8, 9 | content 검증 / sessionId 인가 | **무변경** — pre-existing, 컨트롤러/가드/ORM 레이어 책임(본 변경 범위 외, 새 공백 아님). |
| 11 | review/** + fix 동일 커밋 | **수용** — 8426d829 은 fix+RESOLUTION 동반 커밋. 본 RESOLUTION 커밋은 review/** 전용으로 분리해 review_guard 재무장 회피(MEMORY "Review gate loop avoidance" 준수). |
| 12 | `finishReason: string` | **수용 (1차 처리됨)** — provider 원본+합성 마커 수용 필요, JSDoc 근거 명시. |
| 13 | `UsageSnapshot` diverge | **개선됨** — 본 변경의 인터페이스 추출로 완화. 이벤트 data 참조 교체는 장기. |

> **종결 판단**: 본 라운드는 codebase 무변경으로 종결한다. 유일 Warning(#1)은
> 스펙된 설계로 deliberate defer, INFO 는 전부 planner 위임·별건·방어적 표기라
> 추가 codebase 커밋 가치가 review_guard 재무장 비용(불필요한 추가 리뷰 라운드)을
> 넘지 못한다(MEMORY "Review gate loop avoidance"). 본 RESOLUTION·SUMMARY 는
> review/** 전용 커밋으로 배치 → 최신 codebase 커밋 `8426d829` 가 본 검토로 커버됨.

## 검증
- impl `813a4829` + fix `8426d829` 전체: lint·build·unit 87·e2e 214 PASS
- 본 라운드: codebase 무변경(Warning defer + INFO 위임/defer) → 재검증 불요
