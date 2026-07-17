# 변경 범위(Scope) 리뷰

## 대상

- `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
- `codebase/backend/src/nodes/core/node-handler.interface.ts`
- `codebase/packages/ai-end-reason/src/index.ts`
- `plan/in-progress/resumable-handler-generic-typing.md` (신규)

## 작업 의도

`ResumableNodeHandler.endMultiTurnConversation` 의 `endReason` 파라미터가 `AiAgentEndReason` 하나로
고정돼 있어 `InformationExtractorHandler` 가 자기 도메인으로 `implements` 할 수 없던 상태(→ 어느
구현체도 `implements` 안 해 tsc 검사가 전혀 작동하지 않던 상태)를, 인터페이스를
`ResumableNodeHandler<TEndReason>` 로 제네릭화해 두 핸들러가 각각 자기 도메인으로 `implements`
하도록 만드는 순수 타입 안전성 작업. `plan/in-progress/resumable-handler-generic-typing.md` 에
결정 근거·범위 밖 항목이 명시돼 있다.

## 발견사항

- **[INFO]** 세 파일(`ai-agent.handler.ts`, `information-extractor.handler.ts`,
  `node-handler.interface.ts`)에 걸쳐 "bivariance 때문에 `implements` 만으로는 부족하다" /
  "`AssertEndReasonDomain` 이 필요한 이유" 설명이 거의 동일한 문구로 3회 반복된다.
  - 위치: `ai-agent.handler.ts:46-51` / `information-extractor.handler.ts:342-348` /
    `node-handler.interface.ts` (`ResumableNodeHandler` JSDoc, `AssertEndReasonDomain` JSDoc)
  - 상세: 각 정의 사이트에 로컬로 설명을 두는 것은 이 리포의 기존 문서화 관례(spec Rationale 섹션
    패턴)와 일치하며 실질 변경(타입 파라미터화)과 직접 결부된 설명이라 "무관한 주석"은 아니다. 다만
    문구 반복량이 상당해 향후 한쪽이 갱신되고 다른 쪽이 stale 해질 drift 위험은 존재한다.
  - 제안: 별도 fix 불필요. 후속에서 문구가 어긋나면(예: bivariance 설명이 한 곳만 수정되는 경우)
    consistency-check 대상으로 인지.
- 그 외 CRITICAL/WARNING 급 범위 이탈 없음.

## 관점별 점검

1. **의도 이상의 변경**: 없음. 4개 코드 파일 전부 "ResumableNodeHandler 제네릭화" 라는 단일 목적에
   직접 기여한다 — 인터페이스 제네릭 파라미터 도입, 두 핸들러의 `implements` 좁히기 +
   `AssertEndReasonDomain` 잠금, 패키지의 `UniversalEndReason` 교집합 파생 + non-empty 단언. 런타임
   로직·시그니처 동작 변경은 없다(순수 컴파일 타임 계약 강화).
2. **불필요한 리팩토링**: 없음. 기존 메서드 본문·위임 구조(handler → executor)는 무변경. diff 는
   `implements` 절 교체와 파일 말단 `_endReasonDomainLock` 상수 추가에 국한.
3. **기능 확장**: 없음. plan 문서가 "spec 영향 없음 — 값 도메인·의미·port 매핑 무변경, 순수 타입
   안전성 작업"이라고 명시하고 실제 diff 도 이를 뒷받침한다(런타임 분기·값 목록 변경 없음).
4. **무관한 수정**: 없음. `node-handler.interface.ts` 의 JSDoc 확장은 새로 도입된 `TEndReason` /
   `AssertEndReasonDomain` / `UniversalEndReason` 를 설명하는 데 직접 필요한 내용이며, import 변경
   (`AiAgentEndReason` → `ConversationEndReason, UniversalEndReason`)도 해당 타입 사용에 정확히 대응한다.
5. **포맷팅 변경**: 없음. 순수 whitespace/개행 정리가 실질 변경과 섞인 흔적 없음.
6. **주석 변경**: 상당량의 JSDoc 이 추가됐으나 전부 이번에 도입된 타입 설계(제네릭·bivariance 한계·
   교집합 vs 합집합 기본값 선택 근거)를 설명하는 데 쓰인다. 기존 무관 주석의 삭제/변경은 없음(위 INFO
   항목의 반복 서술 외 특이사항 없음).
7. **임포트 변경**: `NodeHandler` → `ResumableNodeHandler`(ai-agent, information-extractor 핸들러),
   `AssertEndReasonDomain` 추가 임포트 — 둘 다 실제로 그 파일에서 사용됨. `node-handler.interface.ts`
   의 `AiAgentEndReason` 단일 임포트 → `ConversationEndReason, UniversalEndReason` 임포트 교체도
   제네릭 파라미터 제약/기본값에 정확히 필요한 만큼만 변경됨. 미사용 임포트·불필요한 정리 없음.
8. **설정 변경**: 없음. `.eslintrc`/`tsconfig`/`package.json` 등 설정 파일은 diff 에 포함되지 않음.

## 부가 관찰 (긍정적 스코프 규율)

- plan 문서의 "범위 밖 (관측만)" 섹션이 이번 작업 중 발견했지만 의도적으로 손대지 않은 두 항목(IE의
  `endMultiTurnConversation` 이 `errorPayload` 를 받지 않아 런타임에서 버려지는 선재 동작, `AiTurnExecutor`
  가 `NodeHandler` 미구현이라 `implements` 대상에서 제외됨)을 명시적으로 기록해뒀다. 이는 발견한 인접
  문제를 이번 PR 로 끌어들이지 않고 스코프를 지켰다는 근거다.
- `plan/in-progress/resumable-handler-generic-typing.md` 신규 추가는 프로젝트 관례
  (`plan/in-progress/<name>.md` + `worktree` frontmatter)를 따른 것으로 스코프 이탈이 아님.

## 요약

4개 코드 파일 변경이 "ResumableNodeHandler 제네릭화로 endReason 계약을 타입으로 잠근다"는 단일 목적에
빈틈없이 수렴한다. 런타임 동작·값 도메인·설정·포맷팅 변경이 전혀 섞이지 않았고, 추가된 JSDoc 은 전부
이번에 도입된 비자명한 타입 설계(제네릭 파라미터·bivariance 한계·교집합 기본값)를 설명하는 데 직접
쓰인다. plan 문서가 범위 밖 항목까지 명시적으로 경계를 그어둬 스코프 규율이 특히 우수하다. 유일한
관찰 사항은 세 파일에 걸친 설명 문구의 상당한 반복인데, 이는 스코프 이탈이 아니라 향후 drift 가능성에
대한 참고 수준의 INFO다.

## 위험도

NONE
