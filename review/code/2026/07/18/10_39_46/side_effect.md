# 부작용(Side Effect) 리뷰 — resumable-handler-generic-typing (2026-07-18 10:39:46)

## 개요

이번 diff 는 전 회차(`review/code/2026/07/17/22_58_45`) 리뷰 대상 4개 코드 파일에 더해
WARNING #1 fix 로 신설된 `assert-end-reason-domain.type-fixture.ts`, plan 문서, 전 회차
리뷰 산출물(SUMMARY/RESOLUTION/각 리뷰어 `.md`/상태 json) 커밋을 포함한다. 코드 파일
(파일 1·2·3·4·6)은 모두 TypeScript **타입 레벨(컴파일타임) 전용** 변경이고, 나머지
(파일 5 README, 파일 7 plan, 파일 8~20 review 산출물)는 문서/JSON 신규 추가다. 런타임
로직(`execute`/`validate`/`processMultiTurnMessage`/`endMultiTurnConversation`/
`buildMultiTurnFinalOutput` 본문)은 diff 전후 문자 그대로 동일함을 전체 파일 컨텍스트
대조로 확인했다.

## 발견사항

- **[INFO]** 신규 모듈-레벨 `const` 다수 — 런타임상 완전 inert
  - 위치: `ai-agent.handler.ts` 끝 `_endReasonDomainLock`, `information-extractor.handler.ts` 끝 `_endReasonDomainLock`, `packages/ai-end-reason/src/index.ts` 의 `_universalNonEmpty`, 신규 `assert-end-reason-domain.type-fixture.ts` 의 `_narrowingViolationIsRejected`/`_wideningViolationIsRejected`/`_exactMatchIsAccepted`
  - 상세: 전부 `const x: <조건부 타입> = true; void x;` 패턴 — 모듈 로드 시 boolean 리터럴을 할당하고 즉시 `void` 로 폐기하는 컴파일타임 단언용 상수다. export 되지 않고 외부에서 참조되지 않으며 mutable 공유 상태·I/O 도 없다. 점검 관점 #2("전역 변수 도입")에 형식적으로는 해당하나 실질 부작용은 0. 이미 코드베이스에 확립된 관례(`_exhaustive` 등)와 동일한 스타일이라 신규 패턴 도입도 아니다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 `assert-end-reason-domain.type-fixture.ts` — 어디서도 import 되지 않지만 `nest build` compilation root 로 포함되어 dist 산출물에 부수 파일이 생성됨
  - 위치: `codebase/backend/src/nodes/core/assert-end-reason-domain.type-fixture.ts` (신규), `codebase/backend/tsconfig.build.json` (`"include": ["src/**/*"]`, `exclude` 는 `**/*spec.ts` 만 — 이 파일은 `.type-fixture.ts` 라 exclude 미해당)
  - 상세: 직접 확인 결과 이 파일을 import 하는 production 모듈은 없다. 그러나 `tsconfig.build.json` 의 `include` glob 이 `src/**/*` 라 `nest build`(tsc)는 이 파일을 독립 compilation root 로 포함해 컴파일하고, `dist/nodes/core/assert-end-reason-domain.type-fixture.{js,d.ts,js.map}` 를 dist 트리에 emit 한다. 파일 내용이 `true` 대입 + `void` 뿐이라 emit 되는 JS 자체는 무해하고, 어떤 모듈도 이를 require/import 하지 않으므로 애플리케이션 시작 시 로드·실행되지 않는다(런타임 미도달 코드). `dist/` 는 gitignore 대상(`codebase/backend/.gitignore:2`)이라 커밋 오염도 없다. 저장소에 유사 선례(`*.type-fixture.ts`)가 이전엔 없어 이번이 최초 도입 패턴이지만, 부작용 관점에서는 "빌드 산출물에 죽은 파일 1개 추가"라는 무해한 부수 효과 이상은 없다.
  - 제안: 조치 불필요. (선택: 이런 파일이 늘어나면 `tsconfig.build.json` exclude 에 `*.type-fixture.ts` 패턴을 추가하는 것도 가능하나, 그러면 정확히 이 파일이 노리는 "매 `nest build` 마다 타입체크됨" 목적 자체가 깨지므로 **하지 말아야 한다** — 현재 상태가 의도된 설계다.)

- **[INFO]** 시그니처/인터페이스 변경은 순수 타입 레벨이나 `endReason` 파라미터 타입이 실질적으로 narrow 됨 — 유일 소비처는 정합 확인됨
  - 위치: `node-handler.interface.ts` — `ResumableNodeHandler<TEndReason extends ConversationEndReason = UniversalEndReason>` (구 비제네릭 인터페이스 대비), `isResumableNodeHandler` 반환 타입 `handler is ResumableNodeHandler<UniversalEndReason>`, `endMultiTurnConversation(state, endReason: TEndReason, ...)` (구 `AiAgentEndReason` 고정 대비)
  - 상세: 제네릭에 기본 타입 인자(`UniversalEndReason`)가 있어 기존에 타입 인자 없이 쓰던 자리(`ResumableNodeHandler` bare)는 계속 컴파일된다는 점에서 **소스 호환**이다. 다만 `UniversalEndReason`(`user_ended`/`max_turns`/`error`, 교집합)은 구 고정 타입이었던 `AiAgentEndReason`(`user_ended`/`max_turns`/`condition`/`error`)보다 `'condition'` 값 하나만큼 **좁다** — 즉 `endReason` 파라미터가 bare `ResumableNodeHandler` 를 통해 호출되는 자리에서 실질적으로 narrow 됐다. 리포지토리 전체에서 bare 참조는 `ai-turn-orchestrator.service.ts:974`(`handleAiTurnError(..., handler: ResumableNodeHandler, ...)`) 1곳뿐이며, 그 호출부가 실제로 넘기는 리터럴은 `'user_ended'`(914행)/`'error'`(996행) 두 값뿐으로 둘 다 `UniversalEndReason` 원소다. `AiAgentHandler`/`InformationExtractorHandler` 는 각자 자기 도메인(`AiAgentEndReason`/`EndReason`)으로 `implements` 해 이 narrowing 의 영향을 받지 않는다. `ResumableNodeHandler` 인터페이스는 backend 내부 전용이며(grep 결과 frontend·packages 어디서도 import 없음) cross-package 공개 API 파손 우려도 없다.
  - **검증**: 전 회차 side_effect WARNING("풀빌드 재검증 못 함")에 대응해 이번 세션은 실제 빌드 로그(`_test_logs/build-20260718-000600.log`, backend `nest build` + 전 패키지 + Docker 이미지 빌드 검증, 마지막 tail 에 에러 없이 성공 종료 확인)와 RESOLUTION.md 의 재검증 기록(`pnpm --filter backend build` EXIT=0)을 직접 대조해 narrowing 이 실제로 컴파일 에러 없이 통과함을 확인했다. 추가로 `git log` 로 해당 fix 커밋들(`b612cae74`/`580a615dd`/`b742f341d`)이 실재함을 확인.
  - 제안: 조치 불필요 — 이미 실측 재검증됨.

- **[관찰/비발견]** 파일시스템·환경 변수·네트워크 호출·이벤트/콜백 (점검 관점 #3·#6·#7·#8)
  - 코드 파일(1·2·3·4·6) 중 어느 것도 파일 I/O, `process.env` 읽기/쓰기, 외부 HTTP/DB 호출, 이벤트 emit·콜백 등록/해제 경로를 추가·수정하지 않는다. 전부 타입 선언·타입 단언·`implements` 절 추가뿐이다.
  - 신규 문서/JSON 파일(파일 5·7~20)은 `review/**`, `plan/**` 하위에만 생성되며 프로젝트 컨벤션(코드 리뷰·plan 산출물은 커밋 대상, gitignore 되지 않음)과 일치한다. 프로덕션 코드 경로·빌드 스크립트에 영향을 주는 파일시스템 부작용은 없다.

## 요약

diff 전체가 런타임 동작·전역 mutable 상태·파일시스템(프로덕션 경로)·환경 변수·네트워크·이벤트 발행 경로 중 어느 것도 건드리지 않는 순수 컴파일타임 타입 안전성 강화다. 신규 모듈 레벨 `const` 6곳(기존 2 + fixture 3 + 패키지 1)은 전부 `void` 로 즉시 폐기되는 inert 값이며, 신규 `.type-fixture.ts` 가 `nest build` compilation root 로 포함돼 gitignore 된 `dist/` 에 미참조 산출물을 하나 추가하는 것이 유일한 부수 파일시스템 효과이나 완전히 무해하고 의도된 설계다. 유일한 실질적 리스크였던 `ResumableNodeHandler` 기본 타입 인자 narrowing 의 ripple 은, 유일 소비처(`ai-turn-orchestrator.service.ts`)가 넘기는 리터럴이 새 좁은 타입의 원소임을 grep 으로 확인하고, 이번 세션에서 실제 최신 빌드 로그(EXIT=0, 에러 0건)로 재검증까지 완료했다 — 전 회차 WARNING 은 해소된 상태다.

## 위험도

LOW
