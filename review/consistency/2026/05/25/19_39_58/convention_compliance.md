# 정식 규약 준수 검토 결과

**검토 대상**: `spec/conventions/chat-channel-adapter.md`
**검토 모드**: `--impl-prep` (구현 착수 전)
**검토 일시**: 2026-05-25
**적용 규약**: `spec/conventions/spec-impl-evidence.md`, `CLAUDE.md` 명명 컨벤션, `.claude/skills/project-planner/SKILL.md` 문서 구조 지침

---

## 발견사항

### [CRITICAL] frontmatter `status: spec-only` — 구현 완료 상태와 불일치

- **target 위치**: frontmatter 3행 `status: spec-only`, 4행 `code: []`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` status 라이프사이클
  - `spec-only` = "구현 의도 결정됨, 구현 아직 없음. `code: []` OK"
  - `partial` = "일부 구현됨. `code: ≥1` 의무 + `pending_plans` 의무"
  - `implemented` = "모든 약속 구현 완료. `code: ≥1` 의무"
- **상세**: 본 컨벤션이 정의하는 `ChatChannelAdapter` 인터페이스의 6함수 모두가 이미 구현된 상태다.
  - `codebase/backend/src/modules/chat-channel/providers/telegram/telegram.adapter.ts` — `TelegramAdapter implements ChatChannelAdapter` (setupChannel / teardownChannel / parseUpdate / renderNode / sendMessage / ackInteraction / revokeBotToken? 전부 구현 확인)
  - `codebase/backend/src/modules/chat-channel/providers/slack/slack.adapter.ts` — SlackAdapter
  - `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts` — DiscordAdapter
  - `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` — §3.1 `classifyExecutionFailure` 구현
  - `codebase/backend/src/modules/chat-channel/channel-adapter.registry.ts` — §5 ChannelAdapterRegistry 구현
  `spec-impl-evidence.md §3` 전이 규칙: "최초 코드 머지 시점에 `spec-only → partial` 승격". 구현 PR 이 복수 merge 된 현 시점에서 `spec-only` 유지는 직접 위반.
- **제안**: `status: partial`로 승격 + `code:` 에 구현 경로 1개 이상 기재 + `pending_plans:` 에 미구현 plan 목록 추가 (예: `chat-channel-visual-ssr-png.md`, `chat-channel-form-native-modal.md`, `chat-channel-error-notify.md` 등 in-progress plan 중 본 컨벤션의 약속을 책임지는 것들). 전부 구현 완료라면 `status: implemented` + `pending_plans` 제거.

---

### [CRITICAL] frontmatter `pending_plans` 필드 없음 — `partial` 전환 시 필수

- **target 위치**: frontmatter 전체 (1~5행)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `status: partial` 시 `pending_plans` 의무. §4 가드 `spec-status-lifecycle.test.ts` 가 "partial 의 pending_plans 미작성" 을 build fail 으로 강제.
- **상세**: 위 CRITICAL 발견에 따라 status 를 `partial` 로 올리면, `pending_plans:` 미작성은 두 번째 CRITICAL 위반이 된다. 현재 in-progress plan 중 본 컨벤션과 직접 관련된 것이 다수 확인됨:
  - `plan/in-progress/chat-channel-error-notify.md` — §3.1 classifyExecutionFailure 구현
  - `plan/in-progress/chat-channel-visual-ssr-png.md` — §3 매핑 표 v2 SSR PNG 경로
  - `plan/in-progress/chat-channel-form-native-modal.md` — §3 `ai_form_render` v2 inline form
  이들이 `pending_plans:` 없이 방치되면 `spec-pending-plan-existence.test.ts` 가드가 본 spec 과 plan 간 역방향 링크를 확인할 수 없어 "어떤 plan 도 책임지지 않는 빈 약속"(spec-impl-evidence.md R-5 에서 지적한 텔레그램 chat-channel 케이스) 재현.
- **제안**: frontmatter 에 `pending_plans:` 블록 추가. 각 미구현 약속별로 책임 plan path 기재.

---

### [WARNING] frontmatter `code: []` — `status: spec-only` 조건에서도 구현 경로 미기재

- **target 위치**: frontmatter 4행 `code: []`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `spec-only` 상태에서 `code: []` 자체는 허용이나, 구현이 이미 존재하는 상태에서 빈 배열을 유지하는 것은 "본 spec 이 약속한 surface 의 구현 경로"(§2.1 `code` 필드 정의) 를 기록하지 않는 상태. `spec-code-paths.test.ts` 가드는 `partial/implemented` 일 때만 ≥1 매치를 강제하므로 현재 가드는 통과하나, 구현 경로가 명기돼 있지 않아 spec-coverage standing audit 이 대상 파일을 추적하지 못함.
- **상세**: 이미 `codebase/backend/src/modules/chat-channel/**` 에 수십 개의 구현 파일이 존재. status 갱신과 함께 `code:` 에 glob 기재가 필요.
- **제안**: status 승격과 동시에 `code:` 에 최소 `codebase/backend/src/modules/chat-channel/**` 기재.

---

### [WARNING] 문서 구조 — `## Overview` 섹션 미존재

- **target 위치**: 문서 상단 (7~13행, intro 서술 후 바로 `## 1. Adapter Interface` 로 진입)
- **위반 규약**: `.claude/skills/project-planner/SKILL.md` Spec 문서 구조 (3섹션 권장): `## Overview (제품 정의)` / 본문 / `## Rationale`. `spec/conventions/spec-impl-evidence.md` 에도 `## Overview (제품 정의)` 섹션 존재. `spec/conventions/cafe24-restricted-scopes.md` 도 동일.
- **상세**: 본 문서는 `# CONVENTION: Chat Channel Adapter` 제목 직후 one-liner 설명 + 관련 문서 링크로 시작하고, 바로 기술 명세 본문(`## 1.`)으로 진입한다. `## Overview` 섹션 없이 spec 이 무엇을 제공하는지·사용자 가치·적용 대상이 명시된 별도 섹션이 없어 3섹션 구조 권장에서 거리가 있다. 참고로 `spec/conventions/swagger.md`, `spec/conventions/interaction-type-registry.md` 도 Overview 섹션 없이 운영되므로 이 패턴이 convention 파일에 보편적인지는 불명확 — 권장 위반이지만 관행과의 긴장이 있다.
- **제안**: intro 서술(현재 11~12행)을 `## Overview` 섹션으로 승격하거나, project-planner SKILL.md 의 컨벤션 파일 구조를 명시적으로 "Overview 섹션 선택"으로 완화 갱신하는 것 중 선택.

---

### [WARNING] Rationale ID 혼용 — `R1~R4` (번호형) + `R-CCA-5~7` (prefix형) 공존

- **target 위치**: `## Rationale` 섹션 (`### R1.`, `### R2.`, `### R3.`, `### R4.` vs `### R-CCA-5.`, `### R-CCA-6.`, `### R-CCA-7.`)
- **위반 규약**: `spec/conventions/chat-channel-adapter.md` §Rationale 서두 — "본 컨벤션 파일의 신규 Rationale 은 2026-05-25 이후 `R-CCA-N` prefix 사용. 기존 `R1~R4` 는 하위 호환 유지 (rename 시 cross-link 깨짐 위험)". 이것은 자기 문서 내 명시적 운영 규약이므로 cross-link 가 없다면 정리 가능한 상태.
- **상세**: R1~R4 는 cross-file 인용 없이 내부 참조만 존재하는지 확인이 필요. `§R-CCA-7` 본문에서 `[R-CCA-5 대안 2](#r-cca-5)` 앵커를 사용하는데, 실제 heading 은 `### R-CCA-5. Execution Failed 분류 helper ...` 이므로 Markdown 앵커는 `#r-cca-5-execution-failed-분류-helper-를-convention-에-두는-이유-2026-05-25` 형태가 정확하다. 짧은 앵커 `#r-cca-5` 는 대부분의 MD 렌더러에서 링크가 깨진다.
- **제안**: (1) `#r-cca-5` 앵커를 전체 slug 로 수정하거나, R-CCA-5 heading 에 HTML `<a id="r-cca-5">` 앵커를 명시적으로 삽입. (2) 중장기: R1~R4 를 R-CCA-1~4 로 rename 해 일관성 확보 (현재 cross-file 인용 없음 확인 후 안전하게 진행 가능).

---

### [INFO] `§3.1 함수 위치` 주석 — 구현 경로 하드코딩

- **target 위치**: §3.1 마지막 단락 "위치: 본 helper 는 `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` 한 파일로 구현"
- **위반 규약**: 직접 위반은 없음. 정식 규약(`spec/conventions/spec-impl-evidence.md`)은 구현 경로를 frontmatter `code:` 필드로 관리하는 것을 권장. 본문에 구현 파일 경로를 하드코딩하면 파일 이동 시 양쪽 갱신 의무가 생겨 drift 위험.
- **제안**: frontmatter `code:` 에 glob 기재 후 본문 주석을 제거하거나, "구현 경로는 frontmatter `code:` 참조" 로 대체. 현재 파일이 실존(`execution-failure-classifier.ts` 확인됨)하므로 즉각 영향은 없으나 이중 SoT.

---

### [INFO] `## Changelog` 절 — 규약상 명칭 표준 미존재

- **target 위치**: 474행 `## Changelog`
- **위반 규약**: 정식 규약 파일 간 표준이 없음. `spec/conventions/cafe24-restricted-scopes.md` 는 `## CHANGELOG` (대문자), `spec/conventions/secret-store.md` 는 `## Changelog` (Title case). 본 문서는 후자를 따름.
- **상세**: 규약 위반이라기보다 관행 불일치 (2건 vs 1건). 일관성 정착 관점의 참고 사항.
- **제안**: `spec/conventions/` 전체에 걸쳐 하나의 표기로 통일하거나, conventions 신규 문서의 표준으로 `## Changelog` (Title case) 를 사용하고 기존 CHANGELOG 는 점진 통일. CLAUDE.md 나 SKILL.md 에 한 줄 명시 권장.

---

## 요약

`spec/conventions/chat-channel-adapter.md` 는 내용의 기술적 완성도는 높으나, `spec/conventions/spec-impl-evidence.md` 의 frontmatter 라이프사이클 규약을 직접 위반한다. 본 컨벤션이 정의하는 `ChatChannelAdapter` 인터페이스 및 `classifyExecutionFailure` helper 는 이미 Telegram / Slack / Discord 3종 어댑터로 구현 완료되어 있음에도 `status: spec-only` + `code: []` 를 유지하는 것은 "구현 아직 없음" 을 주장하는 것으로, build-time 가드(`spec-frontmatter.test.ts`, `spec-code-paths.test.ts`)의 보호를 스스로 차단하는 상태다. 특히 `spec-only → partial` 전환이 이루어지지 않은 채 impl-prep 단계에 진입하면, pending plan 과의 역방향 링크(`pending_plans:`)가 존재하지 않아 spec-impl-evidence.md R-5 에서 명시한 "어떤 plan 도 책임지지 않는 빈 약속" 패턴이 그대로 재현된다. 구조적으로는 `## Overview` 섹션 미존재(권장 사항), Rationale 앵커 링크 오류(내부 참조 깨짐) 가 보조 이슈로 병존한다.

---

## 위험도

**HIGH**

(CRITICAL 2건: frontmatter status 오분류 + pending_plans 미설정 — 두 build-time 가드의 보호 범위에서 본 spec 이 빠져 있으며, impl-prep 착수 후 구현 PR merge 시 가드 fail 이 발생하거나 spec-coverage audit 에서 영구 미추적 상태가 될 위험)
