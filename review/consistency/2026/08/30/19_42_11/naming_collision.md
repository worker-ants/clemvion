# 신규 식별자 충돌 검토 (impl-done) — `spec/data-flow/` scope

## 검토 범위 요약

`git diff --stat origin/main...HEAD` 로 실측한 이번 변경의 실제 touch 범위는 매우 좁다:

- `spec/data-flow/3-execution.md` — 1줄 수정 (§2.1 Postgres 스키마 표, `execution` "상태 전이" row)
- `spec/5-system/4-execution-engine.md` — §1.1 「원자성 보장」 블록에 각주 추가 (+18줄)
- `CHANGELOG.md` — 소급 정정 각주 추가 (+16줄)
- `codebase/backend/.../execution-engine.service.ts` — `updateExecutionStatus` else 분기를
  `dataSource.transaction` 으로 감싸고, 공유 종결부를 `private finishStatusTransition(...)` 헬퍼로 추출
- `execution-engine.service.spec.ts` — 회귀 테스트 2건 추가

프롬프트에 번들된 나머지 `spec/data-flow/*.md` (2-auth, 9-observability, 14-chat-channel,
15-external-interaction, 0-overview, 1-audit + 컨텍스트 예산 초과로 생략된 9개)는 **이번 diff 의
변경 대상이 아니다** — 신규 식별자가 기존 사용처와 충돌하는지 대조하기 위한 참조 컨텍스트로만
번들됐다. 대조 결과, target 이 도입하는 신규 식별자 자체가 없어 이 파일들과의 충돌도 없다.

## 점검 관점별 확인

1. **요구사항 ID 충돌** — target 은 새 요구사항 ID 를 전혀 부여하지 않는다. 인용하는 ID
   (`PR2a §8`, EIA-RL-06/07 등)는 모두 기존 문서에서 이미 정의된 것을 참조만 한다. 해당 없음.

2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 없음. `execution`/`node_execution` 테이블·
   컬럼명은 기존 그대로다. 해당 없음.

3. **API endpoint 충돌** — 새 endpoint 없음. 해당 없음.

4. **이벤트/메시지명 충돌** — 새 webhook/queue/SSE 이벤트명 없음. 해당 없음.

5. **환경변수·설정키 충돌** — 새 ENV var·config key 없음. 해당 없음.

6. **파일 경로 충돌** — 새 spec 파일 생성 없음(기존 `3-execution.md`/`4-execution-engine.md`
   수정뿐). 해당 없음.

## 확인한 세부 사항

- **`finishStatusTransition` (private 메서드, 코드 신규)**: `git -C <worktree> grep -n
  "finishStatusTransition"` 결과 정의 1곳(`execution-engine.service.ts:8768`)·호출 2곳
  (`:8665`, `:8746`) 뿐이며, 저장소 전체에서 동명의 다른 식별자(다른 클래스의 메서드·함수·
  변수)는 없다. private 이라 외부 노출 표면도 없다. 같은 PR 의 코드 리뷰(`review/code/2026/08/30/
  17_36_15`, `18_10_28`, `19_26_58`)가 이미 이 헬퍼를 다각도로 검증했고 결함 지적 없음(스코프
  일탈 여부만 INFO 로 논의 후 "정당" 처분). spec 문서 어디에도 이 메서드명이 노출되지 않아
  spec 레벨 식별자 충돌 표면 자체가 없다. **충돌 없음.**

- **"guarded UPDATE" 서술 재사용**: `spec/5-system/4-execution-engine.md`(3곳), `spec/conventions/
  node-cancellation.md`(2곳), `spec/data-flow/3-execution.md`(신규 1곳) 에서 전부 동일한 의미
  (`status IN (non-terminal)` 조건부 UPDATE)로 일관되게 쓰인다. formal ID 가 아닌 서술적 표현이고,
  의미가 갈리는 재사용도 없다. **충돌 없음.**

- **날짜 라벨 `(2026-08-30)` 재사용**: `3-execution.md`§2.1 신규 문장의 날짜 각주와 `4-execution-
  engine.md`의 두 개 각주("후속 각주 (2026-08-30)" + "else 분기(직접 마감)도 트랜잭션 안에서
  돈다 (2026-08-30)")가 같은 날짜를 쓰지만, 이는 저장소 전역에 이미 확립된 패턴(날짜는 식별자가
  아니라 타임스탬프이며 부제로 구분)이고 이전 라운드(`review/consistency/2026/08/30/17_49_59/
  naming_collision.md`)가 이미 같은 패턴을 검토해 결함 아님으로 처분했다. 이번 라운드도 동일하게
  확인. **충돌 없음.**

- **커밋/PR 참조 식별자**: `#1242`, `8332d9a20`, `519671792` 등은 모두 실제 커밋을 가리키며
  ( `git log --oneline` 로 `5fbcd20b8 ... (#1242)` 존재 확인, `8332d9a20`/`519671792` 는 diff
  맥락과 일치) 오인용 없음.

- **앵커 링크 정합성** (충돌은 아니지만 인접 확인): `3-execution.md` 신규 문장의
  `[실행 엔진 §1.1 원자성 보장](../5-system/4-execution-engine.md#11-execution-상태)` 는
  대상 파일의 실제 헤딩 `### 1.1 Execution 상태` (slug `11-execution-상태`) 와 일치한다.

- **`spec/conventions/raw-query-results.md`** (auth.md 번들 파일이 참조): 이번 diff 이전 커밋
  (`5fbcd20b8`, #1242)에서 이미 승격된 기존 규약 파일이며, 이번 target 이 신규 도입하는 파일이
  아니다. 신규 식별자 충돌 검토 대상이 아니다.

## 발견사항

없음.

## 요약

이번 target 변경은 `spec/data-flow/3-execution.md` §2.1 표에 한 문장을 보강하고
`spec/5-system/4-execution-engine.md`/`CHANGELOG.md` 에 소급 각주를 추가하는 순수 서술
보정이며, 코드 쪽에서 유일한 신규 식별자인 private 헬퍼 `finishStatusTransition` 은 저장소
전체에서 유일하게 정의·사용되고 spec 문서에도 노출되지 않는다. 새 요구사항 ID·엔티티/DTO명·
API endpoint·webhook/queue/SSE 이벤트명·ENV/설정키·spec 파일 경로 중 어느 것도 새로 도입하지
않았고, 재사용되는 서술 표현("guarded UPDATE", 날짜 라벨)도 기존 확립된 패턴을 그대로 따라
의미 충돌이 없다. 신규 식별자 충돌 관점에서 이 변경은 위험이 없다.

## 위험도

NONE
