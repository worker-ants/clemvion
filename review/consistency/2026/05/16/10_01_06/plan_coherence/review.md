# Plan 정합성 Review — spec/5-system/ 구현 착수 전 검토

검토 모드: `--impl-prep`  
대상 영역: `spec/5-system/` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md, 12-webhook.md, 13-replay-rerun.md)  
검토 일시: 2026-05-16

---

## 발견사항

- **[WARNING]** `replay-rerun.md` — PR2(구현) 착수 전 선행 조건 미합의
  - target 위치: `spec/5-system/13-replay-rerun.md` 전체 (§8 API, §9 데이터 모델, §7.2 dry-run 명세)
  - 관련 plan: `plan/in-progress/replay-rerun.md` §3 백엔드 구현 ~ §5 검증 (모두 미체크 `[ ]`)
  - 상세: spec/5-system/13-replay-rerun.md 는 PR1(Spec)이 완료됐고 spec 자체는 확정됐으나, plan 에서 PR2(구현) 의 모든 백엔드·프론트엔드·e2e 항목이 아직 미완(`[ ]`)이다. "PR1 완료, 머지 대기 / 본 plan 은 PR2 구현 머지 후 closure" 표기가 있어, 해당 plan 이 여전히 in-progress 상태다. impl-prep 관점에서 spec 자체는 확정됐으므로 구현 착수 자체는 허용되지만, plan 에 선행 의존으로 명시된 `plan/complete/engine-raw-config-exposure.md` 가 완료 폴더에 있음을 확인해야 한다 (plan 본문에서 이미 ✅ 표기). 문제 없음 — 그러나 PR1 머지 상태(브랜치 머지 여부) 가 plan 에 명확히 표기되지 않아 구현 팀이 잘못된 base 를 잡을 위험이 있다.
  - 제안: `plan/in-progress/replay-rerun.md` 에 "PR1 머지 완료 날짜 / base commit" 한 줄을 추가해 PR2 착수 기점을 명확히 한다.

- **[WARNING]** `2fa-webauthn.md` — `spec/5-system/1-auth.md` 미결 결정과의 충돌 가능성
  - target 위치: `spec/5-system/1-auth.md` §1.4 2FA (TOTP 정의), §2 세션 관리
  - 관련 plan: `plan/in-progress/2fa-webauthn.md` §1 디자인 결정 (모든 항목 `[ ]` 미합의)
  - 상세: 1-auth.md 는 현재 2FA 를 TOTP 전용으로 정의하고 있다. `2fa-webauthn.md` plan 은 WebAuthn 추가를 목표로 하지만 §1 디자인 결정(라이브러리 선택, rpID/origin, 사용자 흐름, 다중 등록, 복구 코드 정책)이 모두 미합의 상태다. 만약 impl-prep 범위가 1-auth.md 의 현 TOTP 구현(이미 ✅)을 포함하는 구현을 건드린다면, WebAuthn plan 의 미결 결정(복구 코드 통합 vs. 분리 등)이 구현 범위와 교차될 수 있다. 현재 1-auth.md 에 WebAuthn 흐름이 명시되지 않은 상태에서 auth 관련 구현을 확장하면 spec 와 코드가 불일치할 위험이 있다.
  - 제안: impl-prep 범위가 1-auth.md 기반 auth 구현을 포함한다면, `2fa-webauthn.md` 의 디자인 결정이 완료되기 전까지 auth 모듈의 2FA 관련 확장은 직렬화(defer)할 것을 plan 에 명시한다. 현재 TOTP 이외의 auth 구현이 아닐 경우 영향 없음.

- **[WARNING]** `ai-agent-tool-connection-rewrite.md` — `spec/5-system/` 와 간접 교차 (MCP client 관련)
  - target 위치: `spec/5-system/11-mcp-client.md` 전체 (MCP 도구 연결 명세)
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 디자인 결정 (모든 항목 `[ ]` 미합의), §4 백엔드 구현 (`[ ]`)
  - 상세: 11-mcp-client.md 는 `mcp_*` 도구의 완전한 명세를 포함하며 현재 spec 으로 확정되어 있다. `ai-agent-tool-connection-rewrite.md` plan 은 일반 도구(`tool_*`) 재설계를 대상으로 하지만, 미결 결정인 "도구 호출 시 실행 컨텍스트 (sub-execution vs inline)" 와 "ND-AG-21 우선순위 규칙" 은 MCP 도구 실행 흐름(§7 실행 흐름 요약)과 연계된다. plan 에서 "MCP 도구는 영향 없다"고 명시하지만, 일반 도구의 실행 컨텍스트 결정에 따라 MCP 도구의 `AgentToolProvider` 인터페이스 계층에 영향이 생길 수 있다. 또한 `conversation-thread.md` 과의 순서 의존성이 plan 에 명시돼 있으나 (`conversation-thread-e509c5` worktree merge 이후 착수) 해당 plan 의 spec 갱신이 이미 완료됐으므로 이 블로커는 해소됐다.
  - 제안: 11-mcp-client.md 를 impl-prep 범위로 구현 착수할 경우, `ai-agent-tool-connection-rewrite.md` 의 ND-AG-21 우선순위 결정이 MCP 도구 실행 흐름과 충돌하지 않는지 plan 에 확인 항목을 추가한다.

- **[INFO]** `spec/5-system/1-auth.md` §1.1 Rate Limit 미결 값
  - target 위치: `spec/5-system/1-auth.md` §1.5.1 토큰 정책 표 — `Rate Limit: 워크스페이스·invited_by 단위 분당 N회 (구현 시 결정)` 
  - 관련 plan: 해당 항목을 명시적으로 추적하는 in-progress plan 없음
  - 상세: 초대 Rate Limit 의 구체 값("N회")이 spec 에서 "구현 시 결정"으로 열려 있다. 이는 미해결 결정이므로 구현 시 개발자가 임의로 값을 결정할 경우 spec 와 코드 불일치가 생긴다.
  - 제안: 구현 착수 전 Rate Limit N 값을 결정해 spec 에 확정하거나, 구현 담당자가 결정 후 spec 을 갱신하도록 plan 에 후속 항목으로 추가한다.

- **[INFO]** `replay-rerun.md` — worktree 명 미기재
  - target 위치: `plan/in-progress/replay-rerun.md` frontmatter
  - 관련 plan: `plan/in-progress/replay-rerun.md` (worktree 필드 없음)
  - 상세: plan 문서에 frontmatter 의 `worktree` 필드가 없다. PR1 작업이 완료돼 어느 worktree 인지 알 수 없어, PR2 구현 worktree 를 신규 생성 시 혼선이 생길 수 있다.
  - 제안: PR2 착수 시 frontmatter 에 신규 worktree 이름을 추가한다.

- **[INFO]** `spec/5-system/10-graph-rag.md` — 후속 항목(P2+) 추적 plan 부재
  - target 위치: `spec/5-system/10-graph-rag.md` §6 Phase Plan — P2+ (community detection / Neo4j 등) ❌
  - 관련 plan: P2+ 후속 항목을 추적하는 in-progress plan 없음 (§3.7 "미결/후속 검토" 로만 spec 에 기록됨)
  - 상세: Graph RAG P0~P2 는 구현 완료됐으나 P2+ 항목(community detection, Neo4j 검토, KB 단위 prompt override 등)이 spec 에 "별도 PRD 로 검토" 로만 표기되고 plan 으로 추적되지 않는다. 구현 착수 시 이 항목들에 대한 작업이 우발적으로 포함될 위험은 낮으나, 중기 로드맵 추적 공백이다.
  - 제안: 명시적 추적이 필요하다면 별도 plan 을 생성하거나, 0-unimplemented-overview.md 에 항목을 추가해 가시성을 확보한다.

- **[INFO]** `spec/5-system/12-webhook.md` §8 비밀 키 암호화 미결
  - target 위치: `spec/5-system/12-webhook.md` §8 보안 고려사항 — `config.secret`, `config.bearerToken`은 DB에 저장 (향후 암호화 적용)
  - 관련 plan: 암호화 적용을 추적하는 in-progress plan 없음
  - 상세: Webhook 비밀 키의 DB 암호화가 "향후 적용" 으로 열려 있다. 구현 착수 시 암호화 없이 평문 저장이 코드에 고착될 위험이 있다.
  - 제안: 구현 착수 전 암호화 정책을 결정해 spec 에 확정하거나, 별도 plan 항목으로 추적한다.

---

## 요약

`spec/5-system/` 의 5개 파일 전반은 spec 으로서 잘 확정돼 있고, 진행 중인 plan 과의 직접적인 CRITICAL 충돌(미해결 결정 우회, 동시 worktree 경합)은 발견되지 않았다. 주요 위험은 두 가지 WARNING 으로 좁혀진다: (1) `replay-rerun.md` PR2 구현의 PR1 머지 기점이 plan 에 명시되지 않아 구현 팀이 잘못된 base 에서 시작할 수 있고, (2) `2fa-webauthn.md` 의 미결 디자인 결정이 `1-auth.md` 구현 범위 설정에 모호함을 남긴다. `ai-agent-tool-connection-rewrite.md` 의 미결 사항은 MCP client spec 과 간접적으로 연계되어 WARNING 수준으로 추적이 필요하다. INFO 항목들(Rate Limit N값 미결, Webhook 암호화 미결, P2+ 로드맵 추적 공백, replay-rerun frontmatter 누락)은 즉각 차단 사안은 아니나 구현 단계에서 임의 결정이 발생할 수 있어 사전 합의를 권장한다.

---

## 위험도

MEDIUM
