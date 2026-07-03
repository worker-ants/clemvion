# 정식 규약 준수 검토 — spec-draft-crash-running-redrive.md

## 대상

- target: `plan/in-progress/spec-draft-crash-running-redrive.md` (spec draft, PR3 — 크래시/재시작 RUNNING 세그먼트 제어된 re-drive)
- 반영 대상 spec: `spec/5-system/4-execution-engine.md` §7.1/§7.2/§7.3/§7.5 + Rationale
- 대조 규약: `spec/conventions/error-codes.md`, `spec/conventions/migrations.md`, `spec/conventions/spec-impl-evidence.md`, `.claude/skills/project-planner/SKILL.md`, `.claude/skills/consistency-checker/SKILL.md`

## 발견사항

- **[INFO]** draft 파일명·구조는 규약 파일명 패턴과 일치, 단 Rationale 섹션 헤딩이 정식 컨벤션 표기(`## Rationale`)와 다르다
  - target 위치: `## Δ5 — Rationale 신규 항목: "..."` (파일 L66)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §3 "draft 작성 … 본문 끝에 `## Rationale` 로 결정 근거 명시"
  - 상세: 파일명(`spec-draft-<name>.md`)은 `project-planner`/`consistency-checker` SKILL 규약과 정확히 일치한다. 다만 SKILL 이 요구하는 draft 말미 섹션 헤딩은 `## Rationale` 인데, 본 draft 는 `## Δ5 — Rationale 신규 항목: "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (§7.1/§7.2, PR3, 2026-07-03)"` 라는 커스텀 타이틀을 쓴다. 내용상으로는 "target spec 에 삽입할 신규 Rationale 항목"을 통째로 인용한 것이라 실질은 규약 의도(결정 근거 명시)를 충족하지만, 헤딩 문자열 자체가 순수 `## Rationale` 이 아니어서 자동 파싱 도구(예: 향후 draft linter)가 있다면 매치를 놓칠 수 있다. 또한 draft 뒤에 `## side-effect 점검 대상` 섹션이 한 번 더 이어져 "본문 끝 Rationale" 관례와 순서가 어긋난다(Rationale 이 최종 섹션이 아님).
  - 제안: 사소한 형식 이슈이므로 규약 위반이라기보다 관례 편차. 필요 시 `## Δ5 — Rationale (신규 항목 초안)` 형태로 `Rationale` 토큰을 명시적으로 유지하거나, `side-effect 점검 대상`을 Rationale 앞으로 재배치. 이 draft 는 이미 다른 `spec-draft-*.md` 선례(`spec-draft-c2-atomic-claim.md`)와 대비할 때 실질적 문제는 아니며 차단 사유가 아니다.

- **[INFO]** `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의가 이미 spec 에 1차 반영된 것을 draft 가 재차 좁히면서, 최종 의미가 두 단계(§7.1 현행 banner의 1차 재정의 → 본 draft의 2차 재정의)로 누적된다는 점이 draft 본문만으로는 약간 불명확
  - target 위치: draft L24 `> WORKER_HEARTBEAT_TIMEOUT 코드는 유지·의미 축소: …`
  - 위반 규약: `spec/conventions/error-codes.md` §2 "안정성/rename 정책" — 코드 rename 은 금지되나 "의미 재정의"는 허용되는 영역이며, §3 예외 레지스트리에 기존에 이미 `WORKER_HEARTBEAT_TIMEOUT` 의 1차 의미 재정의("30분 절대 stale" → "stalled 재배달 소진")가 등재돼 있다(error-codes.md §3 표 마지막 행).
  - 상세: draft 는 PR3 반영 후 `WORKER_HEARTBEAT_TIMEOUT` 이 "stale RUNNING 일괄 fail" 표기가 아니라 "재구동조차 불가/한도 초과로 종결된 잔여" 표기로 쓰인다고 서술하지만, 정작 draft 의 Δ1/Δ2 본문에서 PR3 시점의 실제 terminal 코드는 `EXECUTION_TIME_LIMIT_EXCEEDED`(§8)이다. 즉 PR3 구현 완료 시점엔 `WORKER_HEARTBEAT_TIMEOUT` 이 실질적으로 어떤 케이스에도 발행되지 않고 "PR4 stalled 모델의 terminal 로 남긴다"는 미래 예약 상태로만 존재하게 되는데, draft L24 문구("표기에만 쓰인다")는 마치 현재도 발행되는 사례가 있는 것처럼 읽힐 여지가 있다. `error-codes.md` §3 예외 레지스트리 갱신 시(project-planner 실제 spec 반영 단계) 이 뉘앙스(= PR3 시점엔 dormant, PR4 stalled 도입 시 재활성)를 명확히 하는 것이 좋다.
  - 제안: 실제 spec 반영 시 §7.1/§2.13(`1-data-model.md`)/`error-codes.md` §3 세 곳 모두에서 "PR3 구간에는 `EXECUTION_TIME_LIMIT_EXCEEDED` 가 terminal, `WORKER_HEARTBEAT_TIMEOUT` 은 PR4 stalled 도입 전까지 미발행(reserved)"라는 문구를 통일해 반영하면 error-codes.md §2 rename 안정성 정책과 완전히 정합.

## 정합성 확인 (문제 없음 — 참고용 근거)

- **명명 규약**: draft 가 사용하는 신규/재사용 식별자(`EXECUTION_MAX_ACTIVE_RUNNING_MS`, `active_running_ms`, `EXECUTION_TIME_LIMIT_EXCEEDED`, `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`, `execution_node_log`, `claimResumeEntry` 패턴)는 모두 기존 spec(`4-execution-engine.md` §7.5/§8, `1-data-model.md` §2.13)과 실제 코드(`execution-limits.ts`)에 이미 존재하는 이름을 그대로 재사용한다. `error-codes.md` §1 "의미 기반 명명" 원칙 위반 없음 — 신규 코드 신설이 아니라 기존 코드의 적용 범위 확장/재사용이다.
- **출력 포맷 규약**: draft 는 신규 API 응답·이벤트 페이로드를 도입하지 않는다(`RESUME_*` 이벤트 표면은 §7.5 기존 계약 그대로, WS ack 신규 없음). `error-codes.md` §2 rename 안정성 정책도 준수 — 신규 코드 신설 대신 기존 코드의 의미 확장.
- **문서 구조 규약**: draft 는 `plan/in-progress/spec-draft-<name>.md` 명명(project-planner/consistency-checker SKILL 규약)과 정확히 일치. 반영 대상 `spec/5-system/4-execution-engine.md` 는 이미 `id/status/code/pending_plans` frontmatter 를 보유(`status: partial`, `pending_plans` 에 `exec-park-durable-resume.md` 기 등재)해 `spec-impl-evidence.md` 규약과 충돌 없음 — PR3 반영이 `status: partial` 을 유지하는 것도 §7.2 point 2(PR4 Planned) 가 남아있어 타당.
- **마이그레이션 규약**: draft 가 "신규 마이그레이션 불요"라 명시하고 근거(기존 `started_at`/`execution_node_log`/`active_running_ms` 컬럼 재사용)를 제시한 것은 `migrations.md` §2 "재사용 금지·gap 금지" 등 V번호 정책과 무관하며 오히려 불필요한 신규 마이그레이션을 피하는 바람직한 판단. plan(`exec-park-durable-resume.md` "## PR3" 섹션)의 "max 버전 참고 = V103" 표기와도 일치.
- **금지 항목**: draft 는 `error-codes.md` §2 가 금지하는 "이름 정확성 향상만을 위한 rename"을 시도하지 않는다(`WORKER_HEARTBEAT_TIMEOUT` 유지, 신규 코드 미신설). `migrations.md` §3 append-only 원칙 위반(기존 마이그레이션 수정) 없음. spec 본문 구조상 §1.1 전이표에 없는 `running → running` self-transition 을 "상태 enum 무변경(§1.1 전이표 변경 불필요)"로 처리한 것도 기존 `waiting_for_input → waiting_for_input`(rehydration self-loop, §1.1 표) 선례와 동일한 패턴이라 새로운 예외를 만들지 않는다.
- **근거 스코핑 정합**: draft 의 Q1/Q2 결정, "신규 마이그레이션 불요", side-effect 점검 대상(§7.4 Rationale L1372 등)은 `plan/in-progress/exec-park-durable-resume.md` "## PR3 — 크래시 RUNNING 세그먼트 멱등 재개 (스코핑 확정 2026-07-03)" 섹션과 문구 수준까지 일치 — 근거 문서와의 괴리 없음.

## 요약

target draft 는 정식 규약(`spec/conventions/error-codes.md`, `spec/conventions/migrations.md`, `spec/conventions/spec-impl-evidence.md`) 이 요구하는 명명 안정성·마이그레이션 재사용 원칙·frontmatter/문서 구조 관례를 모두 준수한다. 신규 에러 코드·API 표면·마이그레이션을 만들지 않고 기존 식별자를 정확한 위치에서 재사용하며, 근거로 인용한 plan 스코핑 문서와도 문구 수준으로 정합한다. 유일하게 짚을 점은 draft 말미 섹션 제목이 SKILL 이 요구하는 순수 `## Rationale` 표기가 아니라는 것과, `WORKER_HEARTBEAT_TIMEOUT` 의 PR3 구간 dormant 상태를 실제 spec 반영 시 조금 더 명시적으로 밝히면 좋겠다는 점인데, 둘 다 차단 사유가 아닌 INFO 수준의 형식 제안이다. Critical/Warning 급 정식 규약 위반은 발견되지 않았다.

## 위험도

NONE
