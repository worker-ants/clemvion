# Plan 정합성 검토 — `spec/2-navigation/13-user-guide.md`

## 발견사항

- **[WARNING]** IA 트리(§2)가 완료된 plan 후속 산출물(`validation-errors` 페이지)을 반영하지 않음
  - target 위치: `spec/2-navigation/13-user-guide.md` §2 정보 구조 (IA), `05-run-and-debug/` 서브트리 (running-a-workflow / run-results / error-handling / version-history 4개만 나열)
  - 관련 plan: `plan/in-progress/parallel-p2-followups.md` L38 — `(→ backend-msg-i18n-impl.md, 완료 60c01585) user-guide MDX(05-run-and-debug/validation-errors.mdx + .en) graph validation 에러 안내 추가됨` (완료 표시, `plan/complete/backend-msg-i18n-impl.md` Phase 5 에 실작업 기록: `order:5`, frontmatter 포함)
  - 상세: 실제 코드베이스에는 `codebase/frontend/src/content/docs/05-run-and-debug/validation-errors.mdx`(+`.en.mdx`, `order: 5`)가 존재하고 `registry.ts` 스캔 대상이라 사이드바에 실제로 노출된다. 그러나 target §2 의 canonical IA 트리는 이 섹션에 4개 페이지만 나열해 실제 5개와 불일치한다. target §2 는 "사이드바 항목 수는 아래 canonical 페이지 수와 같다"고 명시하므로, 이 진술 자체가 현재 거짓이다. `parallel-p2-followups.md` 는 여전히 `in-progress` 상태로 이 완료 항목을 참조하고 있어 — plan 의 후속 산출물이 target(spec) 에 반영되지 않은 전형적 케이스.
  - 제안: target §2 IA 트리의 `05-run-and-debug/` 항목에 `validation-errors # 저장 시 그래프 검증 에러 안내` 행 추가 (order 4/5 사이 표기 순서 확인).

- **[INFO]** IA 트리(§2)가 `web-chat-sdk` 페이지도 누락 (plan/in-progress 와 직접 연결 안 됨 — 참고용)
  - target 위치: `spec/2-navigation/13-user-guide.md` §2 `06-integrations-and-config/` 서브트리 (11개 나열, 실제 12개)
  - 관련 plan: 없음 — `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat-sdk.mdx`(`order: 12`, "웹채팅 위젯 직접 통합 (SDK)")는 `plan/complete/channel-web-chat-followups.md` 계열의 오래된 완료 작업 산출물(커밋 `ba76cc0e8`)이며 현재 `plan/in-progress/**` 어디에도 추적되지 않음. 엄밀히 "plan 정합성" 범위(진행 중 plan 미해소)는 아니지만, 위 validation-errors 건과 같은 성격의 IA 드리프트라 함께 정정하는 편이 효율적.
  - 제안: target §2 `06-integrations-and-config/` 에 `web-chat-sdk # 웹채팅 SDK 직접 통합` 행 추가. (범위상 별도 consistency-checker spec-code 트랙에서도 잡힐 수 있는 항목.)

- 검토했으나 충돌 없음으로 판단한 항목:
  - `plan/in-progress/ai-agent-tool-connection-rewrite.md` — 미해결 결정("도구 등록 모델" 등 TBD)이 남아있으나, target §2 의 `containers-and-tools` 페이지 설명("설정 패널 기반 도구 연결")은 plan 이 기술한 **현재 상태**(Tool Area 제거됨, KB/MCP 만 설정 패널 연결)와 일치 — 재설계 결과를 선점하지 않음. 충돌 없음.
  - `plan/in-progress/cafe24-backlog-residual.md` — `cafe24.mdx`/`cafe24.en.mdx` 관련 항목은 모두 이미 정정 완료(`customer_update`→`customer_delete` 등)로 기록되어 target 과 충돌 없음.
  - `plan/in-progress/chat-channel-discord-gateway.md` / `chat-channel-slack-socket-mode.md` — 둘 다 `backlog`/미착수 상태이며 target 은 이 신규 기능을 전제하는 서술이 없음. 선행 조건 미해소 상태이나 target 이 이를 가정하지 않으므로 비충돌.
  - `plan/in-progress/marketplace-and-plugin-sdk.md` — "매뉴얼·문서" 항목(`content/docs/` 마켓 가이드 신설)이 `[ ]` 미착수라 target IA 에 아직 반영되지 않은 것이 정상.
  - `plan/in-progress/self-hosting-deployment.md` — self-hosting 문서를 `content/docs/` 안에 둘지 별도 `docs/self-hosting/` 로 둘지 결정 미정 (`[ ]`). target 은 이 결정을 선점하는 서술이 없어 비충돌.

## 요약

`plan/in-progress/**` 전수(제공된 5개 + 직접 관련성 있는 나머지 30개 전체를 `content/docs`/`user-guide`/`.mdx` 키워드로 교차 검색)를 target `spec/2-navigation/13-user-guide.md` 와 대조한 결과, 미해결 결정을 target 이 일방적으로 침범한 사례(CRITICAL)는 없었다. 다만 `parallel-p2-followups.md` 가 참조하는 완료 후속 작업(`validation-errors.mdx` 신설)이 target §2 의 canonical IA 트리에 반영되지 않아 "사이드바 항목 수 = canonical 페이지 수" 진술이 현재 사실과 어긋난다(WARNING). 같은 성격의 `web-chat-sdk.mdx` 누락도 함께 발견했으나 이는 특정 in-progress plan 에 연결되지 않는 오래된 드리프트라 INFO 로 별도 표기했다. 그 외 진행 중 backlog/미착수 plan(Discord Gateway, Slack Socket Mode, marketplace SDK, self-hosting)들은 아직 target 이 전제하지 않는 미래 기능이라 선행 plan 미해소 충돌은 없다.

## 위험도

LOW
