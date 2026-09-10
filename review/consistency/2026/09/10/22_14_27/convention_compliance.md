# 정식 규약 준수 검토 — spec-draft-telegram-signing-carveout.md

## 발견사항

- **[CRITICAL] plan frontmatter 필수 필드 `started` 누락 (`created` 로 대체)**
  - target 위치: 문서 최상단 frontmatter 블록 (`title`/`status`/`owner`/`worktree`/`spec_impact`/`created`)
  - 위반 규약: `.claude/docs/plan-lifecycle.md` §4 (`CLAUDE.md` → "PLAN 라이프사이클·이동 규칙·frontmatter 스키마" 링크가 위임하는 문서구조 규약. 점검 관점 3 "CLAUDE.md 의 명명 컨벤션 준수"에 해당) + 시행 코드 `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts` (`checkPlanFrontmatter`) / `plan-frontmatter.test.ts`
  - 상세: §4 는 top-level `plan/in-progress/*.md` 에 `worktree`/`started`/`owner` 세 필드를 **필수**로 요구하며 build guard 가 강제한다(`plan-frontmatter.test.ts`). target 은 이 세 필드 대신 `worktree`/`owner`는 있으나 `started` 자리에 **`created: 2026-09-10`** 를 썼다. 가드 구현을 직접 추적한 결과: `checkPlanFrontmatter` 는 raw YAML 블록에서 정확히 `^started:` 로 시작하는 최상위 키만 `rawScalar(block, "started")` 로 읽고(`created:` 는 이 정규식에 매치되지 않음), 값이 없으면 `isIsoDate(null)` 이 `false` 를 반환해 **`started-invalid` 위반**을 만든다. `worktree:` 필드는 `.claude/worktrees/x` 형태를 basename 으로 정규화하는 fallback(`_normalize_worktree_value`)이 있어 문제 없지만, `started` 에는 `created` 를 받아주는 별칭·fallback 이 존재하지 않는다. 실제로 저장소의 다른 모든 top-level in-progress plan(예: `harness-changeset-exclusion`·`cafe24-backlog-residual-batch`·`eia-r8-cache-scope-4ae434` 등)이 예외 없이 `started:` 필드명을 쓰고 있어, target 만 이 관례에서 벗어난다.
  - 제안: frontmatter 의 `created: 2026-09-10` 를 `started: 2026-09-10` 로 필드명만 교체한다(값은 그대로 ISO 날짜 유지). `plan/complete/` 로 이동하기 전에 반드시 고쳐야 `plan-frontmatter.test.ts` 가 통과한다 — 지금 상태로 커밋되면 frontend 테스트 스위트가 이 파일에서 실패한다.

## 참고 — 위반 아님으로 확인한 항목 (오탐 방지용 기록)

- **`secret-store.md §5.5` / `chat-channel-adapter.md §2.3·§2.4` 인용** — 두 컨벤션 문서를 직접 열어 대조한 결과, target 의 인용(§5.5 의 server-issued 경로가 매 `setupChannel` 마다 `rotate()` 로 재저장한다는 서술, §2.3 의 `inboundSigningRef` provider 분기 표, §2.4 `SetupResult.issuedInboundSigning` 의 "1회 노출 → caller 가 store" 서술)은 정확히 일치한다. 오히려 두 컨벤션 문서는 **이미** telegram 의 "매 호출마다 재발급" 동작을 정확히 서술하고 있었다 — 이번 carve-out 이 컨벤션 문서를 고칠 필요가 없다는 target 자신의 판단(§"이미 그어져 있던 경계")이 실측과 맞는다.
- **`swagger.md` DTO 명명(`ChatChannelPatchConfigDto` 등)** — target 은 이 결정을 "이 턴에 하지 않는 것"으로 명시적으로 유예하고 구현 턴에서 `ChatChannelUpdateConfigDto`(Update 축)로 간다고 적었다. `swagger.md` 를 전수 확인한 결과 현재 "`Patch` 접두 금지"를 명문화한 규칙은 **없다**(`naming_collision` 체커가 별도로 신설 제안 중인 항목) — target 이 규약을 어긴 것이 아니라 아직 존재하지 않는 규약의 신설을 올바르게 별 트래커로 넘긴 것이다.
- **`spec_impact` 리스트 형식** — YAML 리스트로 3개 spec 경로를 선언, Gate C 스키마(리스트 또는 `none`) 준수.
- **인용 형식(review-citations.md)** — 이 컨벤션은 `plan/**` 문서를 명시적으로 "대상 아님"으로 제외한다(§3 표). target 이 체크리스트에 쓴 bare `hh_mm_ss`(`21_53_42` 등)는 그래서 위반이 아니다. 반면 target 이 `spec/5-system/15-chat-channel.md` 등에 삽입을 제안하는 신규 문구(예: 기존 "(2026-09-10 정합화)" 패턴을 따르는 정정 각주)는 모두 날짜를 포함한 형식을 유지하고 있어, 실제 spec 반영 시에도 §2 요구(날짜 포함)를 만족할 것으로 보인다.
- **`spec/5-system/15-chat-channel.md` frontmatter `pending_plans`** — `status: partial` 인데도 최초 12줄만 보면 `pending_plans` 가 없어 보이지만, 실제로는 18번째 줄 아래 세 항목(`chat-channel-discord-gateway.md` 등)이 선언돼 있어 `spec-impl-evidence.md §2.1` 의무를 충족한다(target 의 편집 대상이 아니므로 이 자체는 target 의 결함이 아니라 판정 확인용 기록).

## 요약

target 의 실질 내용(D-A/D-B/D-C 결정, 변경안 A~H)은 `spec/conventions/secret-store.md`·`chat-channel-adapter.md`가 이미 서술하고 있는 telegram server-issued 재발급 흐름과 정확히 정합하며, 인용된 절 번호·본문 대조 결과 왜곡이나 과장이 없었다. DTO 명명·응답 필드 실측 캡처처럼 아직 미확정인 사안은 스코프 밖으로 명시적으로 유예해 규약 신설 권한 경계도 지켰다. 다만 문서 자체의 frontmatter 가 `.claude/docs/plan-lifecycle.md` §4 가 강제하는 3필수 필드 중 `started` 를 `created` 로 잘못 적어, 이 파일이 그대로 커밋되면 `plan-frontmatter.test.ts` 빌드 가드가 실패한다 — 내용의 정합성과 무관한 기계적 스키마 결함이지만 실제로 테스트를 깨뜨리는 수준이라 CRITICAL 로 등급을 매겼다.

## 위험도

CRITICAL
