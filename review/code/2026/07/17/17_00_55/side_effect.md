# 부작용(Side Effect) 리뷰 — `@workflow/ai-end-reason` 패키지 신설 + endReason 타입 통합

## 발견사항

- **[INFO] `isConversationOutput` 이 인식하는 `endReason` 도메인이 6값→7값으로 확장됨 (`'timeout'` 신규 편입) — plan 의 "동작 무변경" 서술과 미묘하게 어긋남**
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:131-133` (`CONVERSATION_END_REASONS`), 소비처 `isConversationOutput()` 의 `looksLikeConversationEnd` 분기(L174-180)
  - 상세: 종전 하드코딩 `Set(["completed","user_ended","max_turns","max_retries","condition","error"])`(6값)가 패키지 export `CONVERSATION_END_REASONS`(`@workflow/ai-end-reason`, 7값 — `'timeout'` 추가)로 교체됐다. `plan/in-progress/is-conversation-output-restructure.md` E-4 는 "`isConversationOutput` 의 동작·조건은 무변경(이번 목표는 drift 차단이지 리팩토링이 아니다)"을 명시적으로 표방하지만, 실제로는 이 함수가 대화 종결로 인식하는 `endReason` 값 집합 자체가 넓어졌다(단순 껍데기 교체가 아니다). 실측 결과 `information-extractor.handler.ts` 전체에 `endReason: 'timeout'` 을 실제로 emit 하는 코드 경로는 0건(`portForEndReason` 도 해당 case 없이 default→`'error'`)이라 **현재는 무해**하며, `output-shape.test.ts` 의 "accepts every unified endReason as a conversation terminal" 테스트가 패키지 배열 전체(`'timeout'` 포함)를 순회하며 `isConversationOutput` 이 `true` 를 반환함을 이미 명시적으로 검증하고 있어 의도된 확장임을 확인했다. 다만 "죽은 값이 향후 되살아나면 `isConversationOutput` 이 자동으로 그 케이스를 대화 종결로 인식하게 된다"는 forward-compat 성격의 실질적 동작 변화이므로, "무변경" 서술과는 구분해 명시하는 편이 정확하다.
  - 제안: plan/PR 설명에 "화이트리스트 소스 교체가 곁들여 `'timeout'` 을 신규 인식 값으로 편입시킨다(현재 producer 없어 무해, 테스트로 고정됨)"를 한 줄 명시. 코드 수정은 불필요.

- **[INFO] `ResumableNodeHandler.endMultiTurnConversation` 시그니처 변경은 값 집합이 동일한 순수 타입 별칭 치환 — 런타임 영향 없음**
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:439-441`, `ai-turn-executor.ts` 3개 메서드(L3147·3198·3420 부근), `ai-agent.handler.ts:191-193`
  - 상세: 리터럴 유니온 `'user_ended' | 'max_turns' | 'condition' | 'error'` → `AiAgentEndReason`(동일 4값, `@workflow/ai-end-reason` export). 값 집합이 정확히 일치해 호출자 영향 없음(실측: `ai-turn-orchestrator.service.ts` 는 리터럴 `'user_ended'`/`'error'` 로만 호출). 이 인터페이스를 실제 `implements` 하는 클래스가 없고(`AiAgentHandler`·`InformationExtractorHandler` 둘 다 `NodeHandler` 만 구현, `isResumableNodeHandler` 런타임 가드로만 narrow) `InformationExtractorHandler` 의 로컬 `EndReason`(= `InformationExtractorEndReason`, 6값) 은 이 인터페이스와 구조적으로 다른 도메인이라는 gap 은 이번 diff 가 새로 만든 게 아니라 이미 있던 것을 JSDoc 으로 정확히 문서화한 것(실측 확인). 새 side effect 아님.

- **[INFO] 이전 리뷰 라운드(16:07 세션)에서 지적된 배선/파일시스템 부작용 3건은 후속 커밋(`f17fc18dd`)에서 전부 해소 확인**
  - 상세: (1) `docker-compose.e2e.yml` 의 `ai-end-reason` node_modules 볼륨 마스킹 누락 → `config-guard` CI 하드 실패 — 현재 마스킹 라인 존재, `python3 scripts/check-e2e-playwright-config.py` 재실행 결과 `[e2e-config-guard] OK` 확인(재검증 완료). (2) `packages-checks.yml` 의 `push.paths` 에 `ai-end-reason` 누락(pull_request 와 비대칭) — 현재 `pull_request`/`push` 양쪽 모두 `codebase/packages/ai-end-reason/**` 대칭 확인. (3) `codebase/packages/README.md` 가 `ai-end-reason/README.md` 와 byte 단위로 동일한 오배치 파일로 신규 생성됐던 건 — `git log` 확인 결과 `f0ef4a821` 에서 생성(28줄), `f17fc18dd` 에서 28줄 전체 삭제로 정리됨(`ls` 로 부재 확인). 세 건 모두 현재 diff 최종 상태에는 부작용으로 남아있지 않다.

- **[INFO] 신규 패키지·모듈의 부작용 표면 — 전역 변수/env var/네트워크 호출 없음**
  - 위치: `codebase/packages/ai-end-reason/src/index.ts`, `codebase/frontend/src/lib/conversation/interaction-type-registry.ts`
  - 상세: 두 파일 모두 `export const`(readonly 배열/Set) 와 `export type` 만 선언하고, `process.env`/`fetch`/`http`/네트워크 호출/mutable 전역 상태를 도입하지 않음(grep 확인, 매치 0건). `interaction-type-registry.ts` 의 두 import(`WaitingInteractionType`, `ConversationTurnSource`)는 모두 `import type`(type-only)이라 런타임 의존 그래프에 사이클을 만들지 않으며, 두 소스 파일(`execution-store.ts`, `conversation-utils.ts`)의 실제 타입 정의도 새 registry 의 값 배열과 정확히 일치함을 직접 대조해 확인했다(테스트 파일→소스 파일 이동으로 컴파일 타임 단언이 처음으로 "실제 동작"하게 되지만, 기존 drift 가 없어 새로 컴파일 에러가 나는 지점은 없다).

- **[INFO] CI/Docker 배선 변경은 전부 additive — 기존 5개 패키지(sdk/expression-engine/graph-warning-rules/node-summary/chat-channel-validation) 처리 로직에 영향 없음**
  - 위치: `.claude/test-stages.sh` `INTERNAL_PACKAGES`, 3개 Dockerfile COPY, `docker-compose.e2e.yml` volumes, `packages-checks.yml` matrix/paths, `pnpm-workspace.yaml`(변경 없음 — 기존 `codebase/packages/*` glob 이 이미 포괄)
  - 상세: 전부 배열/목록에 신규 항목 1줄(또는 대칭 2줄) 추가 형태이며 기존 항목들의 순서·값은 diff 상 그대로 보존됨. `pnpm-lock.yaml` 변경도 신규 패키지 진입점 추가 및 backend/frontend importer 항목에 `workspace:*` 참조 추가뿐, 기존 패키지 버전 핀은 무변경.

## 요약

이번 변경은 backend/frontend 에 흩어져 있던 AI 노드 `endReason` 리터럴 유니온 사본들을 신규 내부 패키지 `@workflow/ai-end-reason` 으로 단일화하는 리팩토링이며, 값 집합이 그대로인 타입 별칭 치환이 대부분이라 실질적 런타임 부작용은 극히 제한적이다. 유일하게 실측으로 확인된 실질적 동작 변화는 frontend `isConversationOutput` 이 인식하는 `endReason` 화이트리스트가 6값에서 7값으로 넓어진 것(`'timeout'` 편입)인데, 이는 대응 테스트로 명시적으로 커버되고 현재 backend 에 producer 가 없어 무해하다 — 다만 plan 문서의 "동작 무변경" 서술과는 미묘하게 어긋나므로 문서상 정확히 표기할 것을 권한다. 이전 리뷰 라운드에서 발견된 CI/파일시스템 부작용 3건(config-guard 하드 실패·CI 트리거 비대칭·오배치 README 중복 파일)은 후속 커밋에서 모두 실측 재검증을 거쳐 해소됐다. `ResumableNodeHandler` 인터페이스 시그니처 변경은 값 집합이 동일한 순수 타입 치환이고, 그 인터페이스의 사전 존재하던 구조적 검증 gap(구현 클래스가 `implements` 를 선언하지 않아 tsc 가 도메인 불일치를 못 잡는 문제)은 이 diff 가 새로 만든 게 아니라 JSDoc 으로 정직하게 문서화한 것이다. 전역 변수 도입, 예상치 못한 파일시스템 부작용, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경은 발견되지 않았다.

## 위험도

LOW
