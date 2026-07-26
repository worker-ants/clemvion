# 문서화(Documentation) 리뷰 결과

리뷰 대상: `spec/conventions/node-cancellation.md` (§1 목적 문단 정정 + §6 구현 현황 표 갱신 — chat-channel 을 N/A 로 철회, MakeShop·Cafe24 를 ✓ 로 승격)

이 diff 는 코드가 아니라 spec 문서 자체를 정정하는 변경이라, 통상적인 "코드에 문서가 따라붙었는가" 관점 대신 "문서가 스스로 정확하고 내부적으로 일관적인가" 를 중심으로 검토했다. 인용된 모든 cross-reference·테스트 파일명·인용 문구를 `Read`/`Grep` 으로 직접 열어 대조했다.

## 검증한 사실관계 (참고용 — 발견사항 아님)

- §1 목적 문단(node-cancellation.md:24)에서 `chat-channel` 이 노드 나열에서 빠진 것은 §6 표의 N/A 재분류와 정합한다.
- §6 범례(node-cancellation.md:123)에 신설된 `N/A` 정의가 실제 표에서 쓰인 4개 상태 기호(✓/🚧/—/N/A) 전부를 커버한다.
- chat-channel 행(node-cancellation.md:137)의 두 인용 링크를 직접 열어 확인:
  - `../1-data-model.md#28-trigger` → `spec/1-data-model.md:223` `### 2.8 Trigger` 실존, 앵커 슬러그 일치.
  - `../5-system/15-chat-channel.md` CCH-AD-05(`ChatChannelDispatcher` 가 `executionEvents$` 를 구독하는 outbound adapter) 및 `Rationale R1`("신규 노드로 두면 트리거 종류가 N+1 로 늘고 webhook 트리거와 90% 공통" — 별도 노드/모듈로 두지 않는 근거) 모두 실존, 인용 취지와 일치.
- MakeShop/Cafe24 행(node-cancellation.md:138-139)이 인용한 4개 단위 테스트 파일 전부 실존:
  `makeshop-api.client.spec.ts` / `makeshop.handler.spec.ts` / `cafe24-api.client.spec.ts` / `cafe24.handler.spec.ts`.
  인용된 정확한 문구 `"rethrows AbortError so the ENGINE can classify the node as cancelled"` 가 `makeshop.handler.spec.ts:577`, `cafe24.handler.spec.ts:750` 에 문자 그대로 존재.
  "§4 cascade(already-aborted 분기 포함)" 주장도 `makeshop-api.client.spec.ts:258`(`'aborts before issuing the request when the signal is ALREADY aborted'`)로 실증됨.
- frontmatter `pending_plans:` 가 가리키는 `plan/in-progress/node-cancellation-residual-signal-propagation.md` 를 열어보면 chat-channel/MakeShop/Cafe24 세 항목이 모두 `[x]` 로 표시돼 있고 본문 서술이 이번 spec 변경 내용과 정확히 일치 — 스테일 포인터 없음.
- 표 갱신일(2026-07-26)이 실제 리뷰 시점 날짜와 일치.

## 발견사항

- **[INFO]** frontmatter `code:` 목록이 이번에 ✓ 로 승격된 신규 근거 파일을 포함하지 않음
  - 위치: `spec/conventions/node-cancellation.md:3` (frontmatter `code:` 블록, `id: node-cancellation` 다음 줄부터)
  - 상세: `code:` 목록은 `node-handler.interface.ts` / `http-request.handler.ts` / `database-query.handler.ts` / `executions.controller.ts` / `executions.service.ts` / `editor-toolbar.tsx` / `executions.ts` 7개만 나열한다. 이번 diff 로 §6 표가 MakeShop·Cafe24 를 ✓ 로 승격하며 근거로 든 `makeshop-api.client.ts` · `makeshop.handler.ts` · `cafe24-api.client.ts` · `cafe24.handler.ts` 는 목록에 없다. `spec-impl-evidence` 컨벤션상 `status: partial` 은 `code:` 가 "≥1 매치"만 있으면 빌드 가드는 통과하므로 (`spec-code-paths.test.ts`) 차단 사유는 아니다. 다만 이 파일은 애초에 `ai-agent.handler.ts`/`text-classifier.handler.ts`/`information-extractor.handler.ts`/`send-email.handler.ts`/`parallel-executor.ts` 등 본문이 ✓ 로 언급하는 다른 구현 파일들도 이미 누락돼 있어, 이번 diff 가 새로 만든 문제라기보다 이 파일에 이미 있던 "code: 는 예시적 핵심 파일만, 전수 아님" 관행의 연장이다.
  - 제안: 차단 사유는 아니므로 강제하지 않되, 다음에 이 frontmatter 를 만질 기회가 있으면 최근 ✓ 로 승격된 항목의 핵심 파일(특히 handler + client 양쪽 — plan 문서가 "handler 가 신호 전달을 멈추면 client 의 cascade 는 dead code" 라고 명시한 대로 두 축 모두 evidence 로서 의미가 있음)을 추가해 traceability 를 높일 수 있다.

- **[INFO]** 이번 spec 정정과 짝을 이루는 코드 커밋(`e83da5052`, MakeShop·Cafe24 abortSignal 전파)에 `CHANGELOG.md` 항목이 없음
  - 위치: `/Volumes/project/private/clemvion/CHANGELOG.md` (Unreleased 섹션)
  - 상세: 리포 루트 `CHANGELOG.md` 는 webchat 위젯 등 사용자 가시 변경 위주로 "Unreleased" 항목을 쌓아 온 관행이 있으나, 백엔드 노드의 내부 cancellation 배선(MakeShop/Cafe24 §4 cascade + §5.1 재throw)은 그 관행에 포함되지 않았다. `PROJECT.md`/`CLAUDE.md` 어디에도 CHANGELOG 갱신을 의무화하는 명문 규정은 없어 이번 리뷰 대상(spec 문서 자체)의 결함은 아니다.
  - 제안: 필수는 아니나, 이 저장소의 CHANGELOG 관행을 "사용자 가시 변경만" 으로 명확히 할지, 백엔드 인프라 변경도 포함할지 프로젝트 차원에서 한 번 정리해두면 이후 리뷰에서 반복 판단을 줄일 수 있다.

## 요약

리뷰 대상 diff 는 코드 문서화가 아니라 spec 문서 자체의 정정(chat-channel 범주 오류 철회 + MakeShop·Cafe24 상태 승격)이다. 인용된 모든 cross-reference(데이터 모델 §2.8, chat-channel CCH-AD-05/Rationale R1)와 테스트 파일·인용 문구를 직접 열어 대조한 결과 전부 정확했고, 새로 도입한 범례(`N/A`)도 표 전체 기호와 정합하며, 연결된 plan 문서(`node-cancellation-residual-signal-propagation.md`)의 체크박스 상태도 이번 spec 변경과 완전히 일치해 스테일 포인터가 없었다. 발견된 사항은 전부 INFO 등급의 선택적 개선 제안(frontmatter `code:` 완전성, CHANGELOG 관행 정리)뿐이며, 문서 자체의 정확성·일관성에는 결함이 없다.

## 위험도

NONE
