# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 급 결함은 없으나, 이 PR 이 세 번째 재발 방지를 목표로 삼은 것과 동일 계열의 미검증 사각지대(mutation 실측으로 확인)가 형제 코드에 남아 있고, 문서-구현 간 실질 불일치(고아 주석, plan 미정정)가 5개 reviewer 에 걸쳐 중복 확인됨.

> **forced 커버리지 확인**: router 가 강제 지정한 8개 reviewer(dependency, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨(프롬프트 명시: "forced 전원 결과 확보됨"). router 가 추가 선택한 architecture 포함 총 9개 reviewer 전원 success, 누락 없음 — 강제 화이트리스트 미이행에 따른 거짓 음성 위험 없음.

## Critical 발견사항

없음 — 9개 reviewer 전원 CRITICAL 급 발견사항 보고 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/문서화/아키텍처/범위 | `output-shape.ts` 리팩터가 `MULTI_TURN_INTERACTION_TYPES` 선언은 삭제했지만 이를 설명하던 JSDoc 은 남겨 고아(dangling) 주석이 됨. 그 여파로 `isConversationOutput` 함수 자신의 JSDoc 도 실제 함수 선언과 24줄 이격됨. 남은 주석의 "AST 가드가 여기서 값 누락을 거부한다" 주장도 이제 부정확(정의가 이 파일에 없음, 게다가 이 가드는 애초에 이 파일에 적용된 적도 없었음이 실측 확인됨). 5개 reviewer(아키텍처/요구사항/범위/유지보수성/문서화) 가 독립적으로 동일 지점을 지적 | `codebase/frontend/src/components/editor/run-results/output-shape.ts:100-121` | 112-119 블록(+120-121 중복 빈줄) 삭제. `isConversationOutput` JSDoc 은 함수 선언(L135) 바로 위로 재배치 |
| 2 | 요구사항/문서화 | plan 의 E-3b 절("`output-shape.ts` 를 `REGISTRY_SITES` 에 1줄 추가")이 실제 구현과 다름 — 실제로는 `interaction-type-registry.ts` 의 `Record<WaitingInteractionType, boolean>` exhaustive 구조로 대체됐고 이게 더 안전함(문자 그대로 E-3b 를 실행했다면 `form`/`buttons` 부분집합 오탐으로 테스트가 깨졌을 것 — plan 자신의 다른 절이 이를 이미 논증). plan 이 이 피벗을 "실측 정정" 각주로 반영하지 않음(E-3·E-5·E-7 은 정정 각주가 있으나 E-3b 만 누락) | `plan/in-progress/is-conversation-output-restructure.md` E-3b 절 vs `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:39-43`(`REGISTRY_SITES`) | E-3b 에 "실측 정정" 각주 추가 — 미구현 사실 + 이유 + 대체 메커니즘 명시(다음 사람이 문자 그대로 실행해 테스트를 깨뜨리는 것 방지) |
| 3 | 아키텍처 | `ResumableNodeHandler.endMultiTurnConversation` 의 `endReason` 파라미터가 `AiAgentEndReason`(4값)으로 명명됐으나, 실제 구현체 `InformationExtractorHandler` 는 다른 6값 도메인(`InformationExtractorEndReason`)을 받음. 두 클래스 모두 `implements ResumableNodeHandler` 를 선언하지 않아 tsc 가 이 파라미터 불일치를 전혀 검사하지 않음(구조적 타이핑 + method bivariance) — 현재는 호출 관행(engine 이 `'user_ended'`/`'error'` 만 전달)이 우연히 지키는 안전이지 타입이 보장하는 안전이 아님. PR 자신의 JSDoc 이 이 사실과 해법(`ResumableNodeHandler<TEndReason>` 제네릭화)을 정확히 인지하지만 실행은 범위 밖 | `codebase/backend/src/nodes/core/node-handler.interface.ts:402-453`(특히 439-452), 실사용 `ai-turn-orchestrator.service.ts:914,927,994-996` | 이번 PR 을 막을 사유는 아님. 제네릭화를 별도 backlog 항목으로 등록 권장(JSDoc 에만 남아 plan 완료 후 고아가 될 위험) |
| 4 | 아키텍처/유지보수성 | `isConversationOutput` 의 heuristic 4-way OR-chain **구조 자체**는 이번 PR 에서 미해결 — "값 목록"(endReason/interactionType) drift 는 컴파일타임으로 완전히 막혔지만, "새 output shape 변형이 추가될 때 OR-chain 분기 자체를 빠뜨리는" 유형의 회귀엔 여전히 무방비(입력이 `unknown` 이라 타입 시스템만으로 근본 차단 불가, discriminated union 재설계 필요). PR #961 아키텍처 리뷰가 이미 지적한 사안이며 이번 PR 은 "값 drift 차단"으로 의도적으로 범위를 좁혔음(plan 명시) | `codebase/frontend/src/components/editor/run-results/output-shape.ts:135-194` | 의도된 범위 축소이므로 이번 PR 차단 사유 아님. "isConversationOutput 구조 리팩토링" 후속 backlog 명시적 등록 권장(추적이 끊기지 않도록) |
| 5 | 테스트 | `IS_MULTI_TURN_INTERACTION`(→`MULTI_TURN_INTERACTION_TYPES`) 매핑의 **키 존재**는 컴파일타임에 강제되지만 각 키의 **boolean 값**이 맞는지는 어떤 테스트도 검증하지 않음. mutation 실측: `ai_form_render: true`→`false` 변경 후 frontend 전체 278 files/5506 tests 실행 → **전원 통과(0 실패)**. 이 값이 틀리면 해당 interactionType 대화의 미리보기 탭이 사라짐 — 이 PR 이 `endReason` 에 대해 막으려는 것과 정확히 같은 증상이 형제 코드(interactionType 분류)에서 무방비 | `codebase/frontend/src/lib/conversation/interaction-type-registry.ts:69-83`, 소비처 `output-shape.ts:13,144,165,172` | `MULTI_TURN_INTERACTION_TYPES` 가 정확히 `{"ai_conversation","ai_form_render"}`(`"form"`/`"buttons"` 미포함)인지 확인하는 단언 테스트 추가 |
| 6 | 테스트 | `isConversationOutput` 의 endReason 화이트리스트 **거부(negative)** 경로 미검증 — 기존 테스트("accepts every unified endReason as a conversation terminal")는 화이트리스트 안 값에 대해 `true` 인지만(positive-only) 확인. mutation 실측: `&& CONVERSATION_END_REASONS.has(endReason)` 조건절 자체를 제거(어떤 문자열이든 통과)해도 frontend 전체 5506 tests **전원 통과**. whitelist 의 존재 이유("부정확한/미지의 endReason 을 대화로 오인하지 않기 위함")가 사실상 무검증 상태 | `codebase/frontend/src/components/editor/run-results/output-shape.ts:174-180`(`looksLikeConversationEnd`) | `hasResultMessages: true` + 화이트리스트 밖 임의 문자열(`endReason: "bogus_value"`) 조합에서 `isConversationOutput` 이 `false` 를 반환하는 negative 테스트 1건 추가 |
| 7 | 유지보수성 | `satisfies`+`Exclude` "양방향 잠금" exhaustiveness 단언 보일러플레이트(`type Missing<X> = Exclude<...>; const _noMissing: [Missing<X>] extends [never] ? true : never = true;` 6줄)가 공용 헬퍼 없이 3곳에 거의 동일하게 복붙됨(`MissingInteractionType`/`MissingSource`/`MissingEndReason`). 이 PR 의 핵심 동기("손으로 베낀 목록의 drift 를 구조적으로 제거")와 방향이 살짝 어긋남(다만 복붙이 틀려도 최악은 exhaustiveness 검사 약화이지 런타임 값 누출은 아니라 심각도는 낮음) | `codebase/frontend/src/lib/conversation/interaction-type-registry.ts:30-36,50-54`, `codebase/packages/ai-end-reason/src/index.ts:90-95` | `[X] extends [never] ? true : never` 패턴을 감싸는 제네릭 헬퍼 타입 도입 검토(우선순위 낮음) |
| 8 | 범위 | 완결되지 않은 이전 `/ai-review` 라운드(16_07_35 세션, `routing_status: "pending"`, `agents_success: []`, 14개 전원 `agents_pending`)의 상태 파일(`meta.json`/`_retry_state.json`)만 무관한 "test" 커밋(`b04ddc258`, 커밋 취지는 패키지 테스트 1개 추가)에 편입됨. 후속 커밋(`f17fc18dd`)이 "16_07_35 WARNING 처리(리뷰 지적 3건)"를 언급해 그 라운드가 실무적으로는 활용됐음을 시사하지만, git 이력에는 시작만 하고 끝나지 않은 스냅샷만 고아로 남아 실제와 다른 그림을 영구 기록. 커밋된 서브에이전트 리포트/SUMMARY.md 는 0개 | `review/code/2026/07/17/16_07_35/{meta.json,_retry_state.json}`(커밋 `b04ddc258`) | 해당 라운드를 완결(SUMMARY.md + 전체 서브에이전트 리포트 채움)하거나, 상태 파일 2개만 별도 `chore` 성격 커밋으로 재정리해 이력 오도를 최소화 |
| 9 | 문서화 | 신규 패키지 `ai-end-reason/README.md`(28줄)가 기존 4개 형제 패키지(`expression-engine`/`node-summary`/`graph-warning-rules`/`chat-channel-validation`) 전부가 예외 없이 갖는 `## 빌드`/`## 사용(Exports)`/`## 주요 export` 섹션이 없음 — rationale(왜 있나/무엇을 소유하나/왜 두 유니온이 다른가)은 상세하나 실제 소비 방법(빌드 명령·import 예시)이 전무, `src/index.ts` JSDoc 에도 `@example` 없음 | `codebase/packages/ai-end-reason/README.md` | `## 빌드`(`npm run build`/`npm test`)·`## 사용`(import 예시: `import { AiAgentEndReason, ConversationEndReason, CONVERSATION_END_REASONS } from '@workflow/ai-end-reason';`) 섹션 추가로 형제 패키지와 구조 정합 |
| 10 | 요구사항/의존성 | 신규 패키지 추가로 실제 소스 COPY 는 5개(backend Dockerfile)/manifest 는 7개(playwright-e2e Dockerfile) 가 됐으나, 인접 주석은 "4개"/"6개"로 미갱신. 실제 COPY/마스크 자체는 `check-e2e-playwright-config.py` 실행으로 정확함이 확인돼 빌드 영향은 없는 순수 프로즈 drift. 다만 이 PR 의 목적("가드가 있는 줄 알았는데 잘못된 정보를 갖던" 재발 방지)과 같은 종류의 숫자 drift 를(낮은 리스크로나마) 새로 2곳 남긴 점은 지적할 가치가 있음 | `codebase/backend/Dockerfile:29`, `codebase/frontend/Dockerfile.playwright-e2e:38-39` | "4개"→"5개", "6개"→"7개" 로 정정(기능 영향 없음, 후속 커밋에서 처리 가능) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | CI/로컬 빌드 배선의 "내부 패키지 목록"이 3곳(스크립트 배열 + workflow paths 2 + matrix 1)에 손으로 중복 유지됨 — 이번 PR 이 `endReason` 에 대해 제거하려던 것과 같은 클래스의 구조가 메타(빌드 인프라) 레벨에 잔존. 실제로 이번 세션에서 `test-stages.sh` 배선이 최초 구현에 누락돼 신규 패키지 lint/unit/build 가 로컬에서 조용히 미실행된 사고가 있었음(현재는 정정 완료) | `.claude/test-stages.sh:25-32`, `.github/workflows/packages-checks.yml` | 향후 backlog 로 "내부 패키지 목록 자동 파생"(`pnpm-workspace.yaml` glob 기반) 등록 검토 |
| 2 | 아키텍처 | `interaction-type-registry.ts` 가 "값 목록 SoT" 와 "파생 비즈니스 분류"(`IS_MULTI_TURN_INTERACTION`) 두 책임을 겸함. 지금은 파일이 작아 문제없음 | `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` | 파생 분류가 2개 이상으로 늘면 "값 SoT"와 "분류 규칙" 파일 분리 고려 |
| 3 | 요구사항 | `spec/conventions/interaction-type-registry.md` frontmatter `code:` 목록에 신설 SoT 파일 2개(`ai-end-reason/src/index.ts`, `interaction-type-registry.ts`) 미등재. `spec-code-paths.test.ts` 가드는 기존 항목으로 이미 충족돼 non-blocking | `spec/conventions/interaction-type-registry.md` frontmatter | 두 파일을 `code:` 에 추가(선택 사항) |
| 4 | 요구사항 | (리뷰 대상 diff 의 결함 아님, 범위 밖 관찰) 리뷰 중 `output-shape.ts` 에 커밋되지 않은 로컬 변경 발견 — `git show HEAD` 확인 결과 커밋된 버전엔 문제 없음. 공유 worktree 동시편집 아티팩트로 추정(memory: 유사 선례 있음) | `codebase/frontend/src/components/editor/run-results/output-shape.ts`(working tree, uncommitted) | orchestrator 가 최종 커밋 전 `git status` 로 worktree clean 여부 재확인 권장 |
| 5 | 범위/유지보수성 | 코드 삭제 후 남은 중복 빈 줄 2곳(리팩토링 부산물, 저장소에 `no-multiple-empty-lines` 류 규칙 없어 lint 로 자동 차단 안 됨) | `output-shape.ts:120-121`, `interaction-type-exhaustiveness.test.ts:8-9` | 각 위치 중복 빈 줄 1개씩 제거 |
| 6 | 범위/유지보수성/문서화 | 신규 `@workflow/ai-end-reason` type-only import 삽입이 3곳 backend 파일에서 "import 블록–코드" 사이 공백줄을 잠식(import 정렬 자동화 부수효과로 추정, `import/order` 류 규칙 부재) | `ai-turn-executor.ts:71`, `information-extractor.handler.ts:40`, `node-handler.interface.ts:4` | 각 신규 import 다음 빈 줄 1개 추가(우선순위 낮음) |
| 7 | 부작용 | `isConversationOutput` 이 인식하는 `endReason` 도메인이 6값→7값으로 확장(`'timeout'` 신규 편입) — plan 의 "동작 무변경(이번 목표는 drift 차단이지 리팩토링이 아니다)" 서술과 미묘하게 어긋남. 현재 `information-extractor.handler.ts` 에 `'timeout'` producer 없어 무해(`portForEndReason` 도 해당 case 없음), 신규 테스트가 패키지 배열 전체 순회로 명시적 커버 | `output-shape.ts:131-133`(`CONVERSATION_END_REASONS`) | plan/PR 설명에 "화이트리스트 소스 교체가 `'timeout'` 을 신규 인식 값으로 편입시킴(현재 producer 없어 무해, 테스트로 고정)" 한 줄 명시. 코드 수정 불요 |
| 8 | 테스트 | `end-reason.spec.ts` 마지막 테스트("모든 값이 ConversationEndReason 으로 좁혀진다")가 파일 자신의 설계 원칙("타입으로 이미 강제되는 것을 런타임에서 재검증하지 않는다")과 어긋나는 tautology — 컴파일 통과 시점에 이미 타입 검증은 끝난 상태라 이후 `expect(typeof narrowed).toBe('string')` 는 어떤 값 mutation 에도 실패 불가 | `codebase/packages/ai-end-reason/src/__tests__/end-reason.spec.ts:41-46` | 제거하거나, 타입이 못 잡는 실질 조건(예: 각 값이 두 도메인 중 하나에 반드시 속한다는 합집합 커버리지 확인)으로 교체 |
| 9 | 문서화 | `packages-checks.yml` 헤더 주석의 패키지 열거(4개 이름 나열)가 신규 패키지 추가 후 stale — `paths`(PR+push)/`matrix.pkg` 는 정확히 갱신됐으나 헤더 주석만 누락. 이번 PR 의 "열거 drift 제거"라는 주제와 정확히 같은 종류의 미스 | `.github/workflows/packages-checks.yml:1-4` | 괄호 열거에 `ai-end-reason` 추가 |
| 10 | 문서화 | `PROJECT.md` "공유 패키지" 행이 여전히 5개 중 2개만 열거(기존 drift, 이번 PR 로 미열거가 2→3개로 소폭 악화). 강제 규약은 없음 | `PROJECT.md:14` | 개별 나열 대신 `codebase/packages/*` 와일드카드로 전환해 손 유지 목록 자체 제거 |
| 11 | 문서화 | `information-extractor.md` §5.6 backlink 의 "본 절이 각 값의 의미·port 매핑을 소유" 주장과 `timeout` 값의 spec 무기재(§5.6/§5.3 어디에도 없음, 패키지 JSDoc 에만 존재) — 기존 자기모순(이전 consistency-check 가 이미 지적, "필수 아님"으로 보류)의 연장이며, 이번 diff 가 소유권 문구를 추가하며 간극이 소폭 더 도드라짐 | `spec/4-nodes/3-ai/3-information-extractor.md:458` | 필수 아님, 향후 이 영역 재작업 시 정합 |
| 12 | 문서화 | `interaction-type-registry.md` 재넘버링(구 §4→신 §5)으로 `plan/complete/refactor/02-architecture.md:237` 의 archived 참조("§4 Rationale")가 어긋남. `plan/complete/` 는 정책상 유지보수 대상 아니라 실질 영향 낮음(다른 활성 참조는 전수 grep 확인 결과 영향 없음) | `plan/complete/refactor/02-architecture.md:237` | 조치 불필요, 참고용 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CRITICAL/WARNING 없음. 신규 코드는 문자열 리터럴 유니온·컴파일타임 단언만으로 구성, 사용자 입력/인증/시크릿/네트워크 접근 없음 — 전부 positive 확인성 INFO |
| architecture | LOW | `ResumableNodeHandler` ISP/LSP 경계 불명확(WARNING #3), `isConversationOutput` OR-chain 구조 미해결(WARNING #4), `output-shape.ts` 고아 주석(WARNING #1) — 패키지 경계·의존성 그래프는 견고하다고 확인 |
| requirement | LOW | plan E-3b 서술-구현 불일치(WARNING #2), Dockerfile 주석 개수 stale(WARNING #10) — spec 3개 문서와 코드가 line-level 로 일치함을 실행 검증(tsc/jest/vitest 전수 통과) |
| scope | LOW | 미완결 리뷰 라운드(16_07_35) 상태 파일이 무관 커밋에 편입(WARNING #8), `output-shape.ts` 고아 주석(WARNING #1) — 37개 파일 전부 plan 의도에 직접 대응, 무관한 기능 추가 없음 |
| side_effect | LOW | endReason 6→7값 확장(INFO #7)이 유일한 실질 동작 변화(무해, 테스트로 고정) — 전역변수/env/네트워크 부작용 없음, 이전 라운드 발견 3건 후속 커밋에서 해소 재확인 |
| maintainability | LOW | `output-shape.ts` 고아 주석(WARNING #1), exhaustiveness 단언 보일러플레이트 3곳 복붙(WARNING #7) — 나머지는 국소적 스타일 잔재, 기능적 결함 없음 |
| testing | MEDIUM | mutation 실측으로 두 사각지대 확인 — `IS_MULTI_TURN_INTERACTION` 값 정확성 미검증(WARNING #5), `isConversationOutput` endReason 화이트리스트 거부 경로 미검증(WARNING #6). 둘 다 5506개 테스트 전원 미검출. 핵심 신규 자산(satisfies+Exclude 잠금)은 4방향 mutation 전부 정확히 작동 확인 |
| documentation | MEDIUM | `output-shape.ts` 고아 주석(WARNING #1, 최다 상세), plan E-3b 미정정(WARNING #2), README.md 구조 미준수(WARNING #9) — rationale 문서 자체의 정확성·상호링크는 저장소 평균 이상 |
| dependency | LOW | 신규 런타임 의존성 0개, 기존 4개 자매 패키지와 100% 동형 템플릿, 배선 완결성을 `check-e2e-playwright-config.py` 실행으로 실측 확인. Dockerfile 주석 stale(WARNING #10 기여) 외 전부 positive |

## 발견 없는 에이전트

- **security** — CRITICAL/WARNING 급 보안 취약점 발견 없음. 리포트에 담긴 5건 INFO 는 전부 "조치 불요" 성격의 positive 확인(런타임 의존성 없음, endReason 은 사용자 입력 경로 없음, errorPayload sanitize 로직 무변경, CI/Docker 배선 기존 패턴 답습, `"private": true` 부재는 기존 저장소 전반 패턴).

## 권장 조치사항

1. **`output-shape.ts` 의 고아 JSDoc 블록(L112-121) 삭제 + `isConversationOutput` 함수 JSDoc 재배치**(WARNING #1) — 5개 reviewer(아키텍처/요구사항/범위/유지보수성/문서화)가 독립적으로 지적한 가장 광범위하게 확인된 항목. 남은 주석의 "AST 가드" 주장도 부정확해 다음 편집자를 오도할 위험 있음.
2. **testing 이 mutation 으로 실측 확인한 두 사각지대에 테스트 추가**(WARNING #5, #6) — (a) `IS_MULTI_TURN_INTERACTION` 각 키의 boolean 값 정확성 단언, (b) `isConversationOutput` 의 endReason 화이트리스트 거부(negative) 케이스. 둘 다 이 PR 이 세 번째로 막으려 한 것과 동일 계열의 "미리보기 탭 소실" 증상을 형제 코드에서 무방비로 남김.
3. **plan 문서 E-3b 절에 "실측 정정" 각주 추가**(WARNING #2) — 실제 구현이 plan 서술과 다르고(더 안전한 방식), 그 이유가 plan 자신의 다른 절에서 이미 논증됨에도 정정되지 않아 문자 그대로 따르면 테스트가 깨질 위험.
4. **review/code/2026/07/17/16_07_35 세션 정리**(WARNING #8) — 완결(SUMMARY.md + 전체 리포트 채움)하거나, 상태 파일 2개를 별도 `chore` 커밋으로 재정리해 git 이력 오도 제거.
5. **신규 패키지 README.md 에 빌드/사용법/export 섹션 추가**(WARNING #9) — 기존 4개 형제 패키지 구조와 정합, 실사용자 온보딩 개선.
6. **Dockerfile 2곳의 "클로저 개수" 주석 정정**(WARNING #10) — "4개"→"5개", "6개"→"7개" (기능 영향 없음, 낮은 우선순위).
7. (낮은 우선순위, INFO 항목) satisfies+Exclude exhaustiveness 단언 공용 헬퍼화(#7), 중복 빈 줄/import 배치 정리(#5,#6), spec frontmatter `code:` 목록 보강(#3), `packages-checks.yml`/`PROJECT.md` 패키지 열거 갱신(#9,#10), plan 의 "동작 무변경" 서술에 `'timeout'` 편입 사실 한 줄 명시(#7).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency (9명, 전원 success)
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — **forced 전원 결과 확보됨** (프롬프트 명시 확인, 누락 없음)
  - **제외**: performance, database, concurrency, api_contract, user_guide_sync (5명) — 개별 사유 텍스트는 라우터 출력에 미포함. 변경 범위(신규 순수 타입 패키지 + 기존 화이트리스트 소스 교체)가 DB 스키마/동시성/외부 API 계약/성능 민감 코드를 건드리지 않는 점과 일관됨(리뷰 결과로 재확인 — 9개 실행 reviewer 어디에서도 이 5개 카테고리에 해당하는 발견 없음).

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 사유 미제공(라우터). 변경이 타입 계층 리팩터링(런타임 값 집합 동일 치환)이라 성능 영향 표면 없음 — 9개 실행 reviewer 결과와 정합 |
  | database | 사유 미제공(라우터). DB 스키마/쿼리 변경 없음(diff 에 마이그레이션 파일 없음) |
  | concurrency | 사유 미제공(라우터). 동시성 제어 로직(락/큐/트랜잭션) 변경 없음 |
  | api_contract | 사유 미제공(라우터). 외부 API 응답 스키마 변경 없음 — `endReason` 값 집합은 내부 상태 머신 산출값이며 이번 diff 로 신규 값 노출이나 필드 삭제 없음(security 리뷰가 실측 확인) |
  | user_guide_sync | 사유 미제공(라우터). 사용자 대면 UI 텍스트/가이드 변경 없음(순수 내부 타입/배선 리팩터링) |