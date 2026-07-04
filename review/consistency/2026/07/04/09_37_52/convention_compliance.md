# 정식 규약 준수 검토 — spec/5-system/4-execution-engine.md

검토 모드: impl-done (`--impl-done`)
Target: `spec/5-system/4-execution-engine.md`
Diff 근거: `execution-context.service.ts` 클래스 주석 갱신, `execution-engine.service.ts` PR4/PR3 관련 주석 정정 (origin/main...HEAD)

## 발견사항

- **[INFO]** `PR{n}` 라벨 표기는 conventions 선례와 일치 — 규약 갱신 불필요
  - target 위치: `4-execution-engine.md` §Rationale "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (§7.1/§7.2/§7.5, PR3, 2026-07-04)", 코드 주석 `**PR4** stalled-job 재배달 + 세그먼트-start 영속 구현 시 …`
  - 위반 규약: 해당 없음 (확인용 INFO)
  - 상세: `PR{n}` (PR1/PR2/PR2a/PR3/PR4 등) 은 정식 규약 문서 자체(`spec/conventions/error-codes.md` `WORKER_HEARTBEAT_TIMEOUT` 행, `spec/conventions/node-cancellation.md` "PR2a 구현 완료" 등)에서도 이미 채택된 프로젝트 공통 라벨 관행이다. target 문서와 diff 주석이 동일 관행을 따르고 있어 명명 규약 위반이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 코드 주석의 spec anchor 참조 정확성
  - target 위치: `execution-context.service.ts` 클래스 doc comment `spec/5-system/4-execution-engine.md §6.2/§9.2/§Rationale "실행 컨텍스트 in-memory + DB durable"`
  - 위반 규약: 해당 없음 (확인용 INFO)
  - 상세: 실제 target 문서에서 `### 6.2 저장 전략`(라인 773), `## 9. Redis 키 네이밍 컨벤션`/`### 9.2 용도별 키 정의 및 TTL`(라인 1091/1109), `### 실행 컨텍스트 in-memory + DB durable — Redis context store 미채택 (§6.2/§9.2, 2026-07-04)`(라인 1417, `## Rationale` 하위) 섹션이 모두 실존하며 인용 anchor 와 정확히 일치한다. `conventions/execution-context.md` 인용도 해당 문서의 원칙 4/§Rationale ("`_contextKey`" 항목) 서술과 부합한다.
  - 제안: 조치 불필요.

- **[INFO]** error-codes 규약과의 정합 — `WORKER_HEARTBEAT_TIMEOUT` PR3 정정 반영 확인
  - target 위치: `4-execution-engine.md §Rationale` "재개 race 보장을 DB 원자 claim으로" 및 "크래시/재시작 RUNNING 세그먼트 제어된 re-drive" 항목, diff 의 `execution-engine.service.ts` PR4 주석
  - 위반 규약: 해당 없음 (확인용 INFO)
  - 상세: `spec/conventions/error-codes.md` §3 `WORKER_HEARTBEAT_TIMEOUT` 행은 "PR3, 2026-07-04 …이 코드는 PR3 기간 발동하지 않는다 … PR4 target BullMQ stalled-job 재배달 attempts 소진 시 발동" 으로 이미 정정돼 있고, target 문서·diff 주석의 서술("PR3 제어된 re-drive 는 세그먼트-start 를 영속하지 않아 under-count 미해소", "PR4 stalled-job 재배달 + 세그먼트-start 영속 구현 시 flush 훅 추가 검토")과 시점·내용이 상호 모순 없이 정합한다. 안정성 정책(에러 코드 rename 금지, §2)도 위반하지 않는다 — 코드명 `WORKER_HEARTBEAT_TIMEOUT` 자체는 변경되지 않았다.
  - 제안: 조치 불필요.

## 검토 범위 관련 참고 (규약 위반 아님)

같은 diff-base 로 작성된 인접 세션(`review/consistency/2026/07/04/09_27_49/`)의 target 은 `plan/in-progress/spec-draft-c3-context-drift.md` 였고, 그 draft 자체는 top-level `plan/in-progress/*.md` 필수 frontmatter(`worktree`/`started`/`owner`) 누락 및 draft `## Rationale` 섹션 부재라는 **CRITICAL** 을 안고 있었다. 그러나 본 세션의 target 은 `spec/5-system/4-execution-engine.md` (완성된 spec 문서, frontmatter/`## Overview`/본문/`## Rationale` 3섹션 구조 모두 정상 구비) 이므로 그 CRITICAL 은 본 target 에는 적용되지 않는다. 다만 해당 draft 가 여전히 `plan/in-progress/` 에 남아 있고 그 내용은 이미 본 target 문서에 전부 반영된 상태로 보이므로(WARNING, 이전 세션에서 이미 지적) — plan lifecycle 정리는 `plan_coherence`/`rationale_continuity` 체커의 소관으로 남긴다.

## 요약

`spec/5-system/4-execution-engine.md` 자체는 문서 구조 규약(frontmatter `id`/`status`/`code`, `## Overview`/본문/`## Rationale` 3섹션), 에러 코드 명명 규약(`spec/conventions/error-codes.md` — prefix, rename 금지, historical-artifact 등록), `_`-prefix 엔진 내부 필드 분류(`spec/conventions/execution-context.md`)를 모두 정합성 있게 따르고 있다. 이번 diff(코드 주석 2건 갱신)가 참조하는 spec 섹션 anchor(§6.2/§9.2/§Rationale)는 실제 target 문서에 정확히 존재하며, `PR{n}` 라벨·`WORKER_HEARTBEAT_TIMEOUT` 시점 서술도 conventions 문서와 상호 모순 없이 정합한다. 정식 규약 직접 위반(CRITICAL/WARNING) 사항은 발견되지 않았다.

## 위험도

NONE
