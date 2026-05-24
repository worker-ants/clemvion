# 정식 규약 준수 검토 결과

**검토 대상**: `plan/in-progress/spec-slack-discord-chat-channel.md`  
**검토 모드**: spec draft 검토 (--spec)  
**검토 일시**: 2026-05-24  
**참조 규약**: `spec/conventions/chat-channel-adapter.md`, `spec/conventions/secret-store.md`, `spec/conventions/spec-impl-evidence.md`, CLAUDE.md 명명 컨벤션

---

## 발견사항

### 1. 명명 규약

- **[INFO]** plan 파일명 내 `spec-` prefix 의 역할
  - target 위치: `plan/in-progress/spec-slack-discord-chat-channel.md` 파일명
  - 위반 규약: CLAUDE.md §정보 저장 위치 — 진행 중 작업은 `plan/in-progress/<name>.md`
  - 상세: CLAUDE.md 는 plan 파일명에 특별한 prefix 컨벤션을 강제하지 않는다. `spec-` prefix 는 "spec 단계 plan 임을 표시하려는 의도" 로 보이며, 기존 다른 plan 도 동일하게 사용 (예: `spec-telegram-chat-channel-ui-polish.md`). 컨벤션 위반이 아니라 팀 관행으로 보임.
  - 제안: 현행 유지 OK. 다만 향후 plan 네이밍 가이드를 CLAUDE.md 또는 별 docs 에 명시하면 일관성 강화.

- **[INFO]** `_overview.md` 내 §3 제목 중복
  - target 위치: `spec/4-nodes/7-trigger/providers/_overview.md` — "## 3. Future candidates" 와 "## 3. provider 식별자 컨벤션" 이 두 개 다 `##3.` 을 사용함
  - 위반 규약: 직접적 규약 위반은 아니지만 문서 내 section 번호 충돌
  - 상세: _overview.md 는 plan 의 target 문서가 아니라 산출 파일이지만, plan §1 산출물에 `_overview.md` 갱신이 포함되어 있으므로 관련성 있음. 이 파일에 `§3 Future candidates` 와 `§3 provider 식별자 컨벤션` 이 중복으로 번호 3 을 사용한다.
  - 제안: `provider 식별자 컨벤션` 섹션을 `§4` 로 번호 정정하거나, `Future candidates` 를 `§3`, 식별자 컨벤션을 `§4` 로 재배치.

### 2. 출력 포맷 규약

- **[WARNING]** `_overview.md` §2 표의 신규 provider 상태 표현이 `spec-impl-evidence.md` status enum 과 불일치
  - target 위치: plan §Phase 4 — "_overview.md §1 표에 새 상태 컬럼 또는 enum 추가 필요성 점검 (현재는 `supported (v1)` 만)"
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §3` status 라이프사이클 — 값은 `backlog`, `spec-only`, `partial`, `implemented`, `archived` 5종
  - 상세: plan §Phase 4 에서는 "_overview.md §1 표에 `spec-only` 상태 도입 + Rationale" 가능성을 언급하고 있다. 그런데 실제 산출된 `_overview.md` 는 §2 "Spec-defined / impl-pending" 이라는 자연어 섹션 제목을 사용했고, plan §1 산출물 표의 비고에도 "상태 = `spec-only`" 라고 적혀 있다. 이는 `spec-impl-evidence.md §3` 의 `spec-only` 값 (spec 파일 frontmatter 전용) 과 catalog 의 provider 상태 enum(현행 `supported (v1)`) 이 다른 도메인임에도 같은 토큰을 공유하는 형태다. _overview.md 의 §2 섹션명 ("Spec-defined / impl-pending") 과 §1 표 내 `supported (v1)` 의 기존 표기 방식이 혼재 — 표에 상태 컬럼이 없는 상태로 섹션 분리만으로 구분하고 있어, `cafe24-api-catalog/_overview.md §3 status enum` 처럼 명시적 status 컬럼 + enum 테이블을 갖추지 않은 불완전한 구조.
  - 제안: `_overview.md` §1 표에 `status` 컬럼 추가 + enum 정의 (`supported`, `spec-only`) 로 `cafe24-api-catalog` 패턴을 적용하거나, 현재 섹션 분리 방식을 Rationale 에 공식화하면 일관성 개선. 현재 Rationale 에는 섹션 분리의 근거가 있으므로 최소 조치는 섹션 분리 자체에 컨벤션 note 를 추가하는 것.

### 3. 문서 구조 규약

- **[CRITICAL]** 산출 spec 파일 (slack.md, discord.md) 섹션 번호 구조가 template 에서 선언한 "7섹션 구조" 와 불일치
  - target 위치: plan §1 산출물 표 — "Telegram spec 과 동일 7섹션 구조 + Rationale", plan §Phase 2/3 의 섹션 목록 (§Overview, §3, §4, §5, §6, §7, §Rationale)
  - 위반 규약: `spec/4-nodes/7-trigger/providers/_overview.md` §3 신규 provider 추가 절차 step 2 — "동일한 섹션 구조 채택 (Overview / Bot API 매핑 / 명령 매핑 / 인터랙션 노드 UI 매핑 / 보안 / 비기능 / Rationale)"
  - 상세: 실제 slack.md 와 discord.md 의 섹션 구조를 확인하면:
    - `## Overview (제품 정의)` — §1/§2 내포
    - `## 3. Web API 호출 매핑` (Slack) / `## 3. REST + Interactions Webhook 호출 매핑` (Discord)
    - `## 4. 명령 매핑`
    - `## 5. 인터랙션 노드 UI 매핑`
    - `## 6. 보안`
    - `## 7. 명령 처리` — 이 섹션이 Telegram 에는 없거나 §6 에 통합되어 있어 §7 번호 충돌 발생
    - `## 8. 비기능`
    - `## Rationale`
    실제 섹션 수는 8개 본문 + Rationale 이므로 plan 에서 선언한 "7섹션" 과 불일치. 더 중요하게는 `_overview.md` 가 명시한 섹션 구조 "보안 / 비기능 / Rationale" 이 번호상 `§6 보안 / §7 명령 처리 / §8 비기능 / Rationale` 로 변경되어 **"명령 처리" 섹션이 삽입**됨. 이 섹션은 Telegram.md 에는 §7 로 존재할 수도 있으나, _overview.md 의 공식 7섹션 목록에 없는 섹션이다. plan §Phase 2 의 섹션 목록에도 명시되어 있지 않고, §Phase 5 `convention-compliance-checker` 가 점검해야 할 사항으로 남겨져 있다. 다른 시스템이 "7섹션 구조" 를 가정하고 parse 한다면 invariant 가 깨진다.
  - 제안: (a) `_overview.md` step 2 의 섹션 목록에 "명령 처리" 를 공식 추가하여 8섹션으로 갱신, 또는 (b) slack.md / discord.md 에서 "§7 명령 처리" 를 "§6 보안" 안의 sub-section 으로 흡수하여 7섹션 유지. 규약 문서 (`_overview.md`) 와 구현 산출물 (`slack.md`, `discord.md`) 의 섹션 구조가 일치해야 이후 provider 추가 시 일관성이 유지됨.

- **[WARNING]** plan 내 Rationale 절 없음 — plan 자체는 Rationale 권장 섹션 미포함
  - target 위치: `plan/in-progress/spec-slack-discord-chat-channel.md` 전체 구조 (§0~§7)
  - 위반 규약: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
  - 상세: CLAUDE.md 의 규약은 spec 문서와 decisions 에 적용. plan 문서에 대해서는 3섹션 (Overview/본문/Rationale) 의무가 명시되어 있지 않다 — 각 SKILL.md 참고로 위임. plan 에 Rationale 이 없는 것 자체는 위반이 아님. 다만 §4 "위험/결정 보류" 에 해당 내용이 상당 부분 있어 사실상 Rationale 역할을 한다. 형식 일관성 관점의 제안 수준.
  - 제안: INFO 수준으로 강등 가능. 현행 유지 OK.

- **[INFO]** `_overview.md` 에 frontmatter 없음 — spec-impl-evidence 의 적용 대상 제외 여부 확인 필요
  - target 위치: `spec/4-nodes/7-trigger/providers/_overview.md` 파일 상단
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §1` 적용 대상 / 제외 목록
  - 상세: `spec-impl-evidence.md §1` 의 제외 조건에 "`spec/_*.md` 및 `spec/<영역>/_*.md` (밑줄 prefix — leaf 가 아닌 layout/index 성격, 예: `_layout.md`, `_product-overview.md`, `_overview.md`)" 이 명시되어 있으므로 `_overview.md` 는 frontmatter 면제 대상. 위반 아님.
  - 제안: 현행 유지 OK. 면제 규칙이 명확하게 정의되어 있음.

### 4. API 문서 규약

- **[INFO]** 관련 없음 — target 문서는 plan 파일 + spec 파일이며, swagger.md 의 NestJS API 데코레이터·DTO 명명 패턴은 codebase 구현 단계에 적용됨. spec 단계 plan 문서에는 해당 없음.

### 5. 금지 항목

- **[CRITICAL]** plan §Phase 6 에 선언된 후속 impl plan 스켈레톤 (`chat-channel-slack-impl.md`, `chat-channel-discord-impl.md`) 이 실제로 생성되지 않은 상태에서 `_overview.md` 가 해당 파일에 링크 (broken link)
  - target 위치: `spec/4-nodes/7-trigger/providers/_overview.md` §2 표 — `chat-channel-slack-impl` / `chat-channel-discord-impl` 링크
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4` `spec-pending-plan-existence.test.ts` — `pending_plans:` 의 모든 path 가 `plan/in-progress/` 에 실존해야 함. 또한 `_overview.md` 의 링크가 실존하지 않는 파일을 가리킴.
  - 상세: `_overview.md` §2 에 `../../../../plan/in-progress/chat-channel-slack-impl.md` 와 `../../../../plan/in-progress/chat-channel-discord-impl.md` 링크가 있으나, 이 파일들은 `plan/in-progress/` 에 존재하지 않는다 (Phase 6 미완료). spec 파일의 cross-link 가 dead link 상태. `spec-pending-plan-existence.test.ts` 가드가 활성화되면 build fail 가능성 있음 (단, `_overview.md` 는 frontmatter 면제 대상이라 `pending_plans:` 필드는 없음 — 가드가 직접 적용되지는 않지만 dead link 자체는 문서 신뢰성 문제).
  - 제안: Phase 6 완료 전에는 `_overview.md` §2 의 링크를 "후속 impl plan (예정)" 으로 교체하거나, Phase 6 를 먼저 완료하여 스켈레톤 파일을 생성. 또는 plan §Phase 2/3/4 를 먼저 완료하고 Phase 6 에서 파일 생성 시 _overview.md 링크를 동시 갱신하도록 plan 체크박스 순서를 명확히 기재.

- **[WARNING]** `chat-channel-adapter.md` §2.3 `ChatChannelConfig` 에 `signingSecretRef` / `publicKeyRef` 가 추가됐으나, plan 의 §Phase 4 컨벤션 점검 체크박스는 아직 미완료 (`[ ]`)
  - target 위치: plan §Phase 4 — `spec/conventions/chat-channel-adapter.md` 6함수 인터페이스 / 데이터 타입 review 체크박스
  - 위반 규약: `spec/conventions/chat-channel-adapter.md §7 변경 관리` — 인터페이스 변경은 `spec/5-system/15-chat-channel.md` + 모든 구체 어댑터 명세 동시 갱신 의무
  - 상세: `chat-channel-adapter.md` 의 Changelog (2026-05-24) 를 보면 `signingSecretRef?` 와 `publicKeyRef?` 가 이미 `§2.3 ChatChannelConfig` 에 추가됐다. 이는 해당 컨벤션의 변경 관리 규약 §7 에 따라 "인터페이스 변경 시 spec/5-system/15-chat-channel.md 동시 갱신 의무" 를 발생시킨다. plan §Phase 4 체크박스에 `spec/5-system/15-chat-channel.md review` 가 있지만 미완료이며, 해당 갱신이 완료됐는지 불명확.
  - 제안: `spec/5-system/15-chat-channel.md §4.1` 의 `Trigger.config.chatChannel` 타입 정의에 `signingSecretRef?` / `publicKeyRef?` 추가 여부 확인 + 누락 시 Phase 4 에서 동시 갱신. Convention §7 의 의무 사항.

- **[WARNING]** `R-S-7` (file_shared → files.info 후속 조회) 에서 `parseUpdate` pure 계약 예외 처리가 불명확
  - target 위치: `spec/4-nodes/7-trigger/providers/slack.md` §4.1 / Rationale R-S-7
  - 위반 규약: `spec/conventions/chat-channel-adapter.md §1.1` — `parseUpdate` 는 "Side-effect free (DB 미접근, 외부 API 미호출)"
  - 상세: Slack 의 `file_shared` event 는 `mimeType` 없이 `fileId` 만 포함 → mimeType 조회를 위해 `files.info` 를 호출해야 한다. R-S-7 에서 "어댑터 pure 계약 유지를 위해 호출자(`HooksService`)가 files.info 를 호출" 로 위임하는 방향을 채택했지만, 이것이 컨벤션의 `parseUpdate pure` 계약과 정합한지 최종 결론이 "채택" 으로 명시되지 않고 "호출자가 보강" 이라는 대안 방향으로 기록되어 있어 실제 구현 시 혼동 가능성.
  - 제안: R-S-7 에 "채택" 명시를 명확히 하고, HooksService 가 files.info 를 호출하는 흐름을 spec 본문 (§4.1 또는 별 §3.x 절) 에 normative 하게 기술. parseUpdate 의 return 에서 mimeType 이 `"application/octet-stream"` 임을 명시.

- **[INFO]** plan §6 후속 plan 경로에 `plan/in-progress/` prefix 없음
  - target 위치: plan §6 "후속 plan" 절 — `plan/in-progress/chat-channel-slack-impl.md`, `plan/in-progress/chat-channel-discord-impl.md`
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `pending_plans:` path 는 레포 루트 기준 상대경로
  - 상세: plan 파일 본문 §6 의 링크 기술은 path 형식 (`plan/in-progress/...`) 으로 일관되며 CLAUDE.md 의 규약과 부합. 단순 사실 확인.
  - 제안: 현행 유지 OK.

---

## 요약

target 문서 (`plan/in-progress/spec-slack-discord-chat-channel.md`) 와 그 산출 파일 (`slack.md`, `discord.md`, `_overview.md`, `chat-channel-adapter.md`, `secret-store.md`) 전반에 걸쳐 정식 규약 준수 수준은 **양호**하다. 6함수 인터페이스·데이터 타입·Form 다단계 시퀀스 규약·secret URI scheme 은 `spec/conventions/chat-channel-adapter.md` 및 `spec/conventions/secret-store.md` 를 올바르게 준수했으며, 신규 provider 식별자(`slack`, `discord`)도 kebab-case lower-case 규칙을 지켰다. 다만 두 가지 CRITICAL 이 식별됐다: (1) `_overview.md` 에서 존재하지 않는 impl plan 파일을 가리키는 dead link, (2) 산출 spec 파일 (`slack.md`, `discord.md`) 의 실제 섹션 구조 (8섹션 + Rationale) 가 plan 선언 및 `_overview.md` 공식 절차에 명시된 "7섹션 구조" 와 불일치. 또한 `chat-channel-adapter.md §2.3` 변경에 따른 `spec/5-system/15-chat-channel.md` 동시 갱신 의무 미확인 (WARNING) 이 있으므로 Phase 4 에서 반드시 확인이 필요하다.

## 위험도

**MEDIUM**

CRITICAL 2건은 모두 Phase 진행 순서의 결과 (Phase 6 미완료 + 섹션 구조 선언/실제 불일치) 이며, 다른 시스템의 invariant 를 즉각 깨는 수준은 아니다. 단, `_overview.md` 의 dead link 는 build-time 가드 (`spec-pending-plan-existence.test.ts`) 대상이 아니더라도 다음 provider 추가 시 혼동을 유발할 수 있고, 섹션 구조 불일치는 규약 문서와 구현 산출물이 이미 벌어진 상태이므로 조기 수정이 권장된다.
