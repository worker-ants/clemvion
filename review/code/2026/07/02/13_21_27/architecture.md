# Architecture Review — M-7 ai-turn-executor 클러스터 (resume-state 타입화, 재확인)

## 발견사항

- **[INFO]** `endMultiTurnConversation` 경계에서만 `state as ResumeState` 로 좁히고, 동일 클래스의 다른 `state` 소비 메서드(`buildAiNodeRefFromState`, `threadHolderFromState`, `processMultiTurnMessage` 본문 등)는 여전히 `Record<string, unknown>` + 인라인 캐스팅 유지
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2916-2927`(신규 좁힘) vs 파일 내 다른 state 소비부(미전환)
  - 상세: 공개 핸들러 인터페이스(`processMultiTurnMessage` — information_extractor 와 polymorphic 공유) 제약상 진입점 파라미터는 `Record` 유지가 합리적이나, 함수 본문 내부에서 `ResumeState`로 좁히는 패턴이 적용된 지점과 미적용 지점이 파일 내 공존해 과도기적 비일관성이 존재한다.
  - 제안: M-7 점진적 롤아웃 의도로 판단됨(커밋 메시지·plan `03-maintainability.md` M-7 항목이 후속 클러스터를 명시). 후속 클러스터에서 나머지 `state as X` 단언 지점도 동일 패턴으로 정리하면 파일 전체 타입 경계가 통일된다. 차단 사안 아님.

- **[INFO]** `ResumeState`/`RetryState`가 `.partial().catchall(z.unknown())` open 스키마 — 컴파일타임 타입 힌트일 뿐 런타임 미검증
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` (allow-list 스키마 정의부)
  - 상세: 설계 의도(zod `parse`/`safeParse` 미사용, 문서화+타입파생+테스트 oracle 전용)가 헤더 JSDoc에 명확. `catchall(z.unknown())` 때문에 `model`/`rawConfig`/`ragLastDiagnostics` 등 일부 필드는 여전히 `as` 단언이 남는데, 이는 결함이 아니라 명시된 trade-off다.
  - 제안: 없음(문서화 충분). 다만 향후 유사 커밋에서 "타입 안전성 확보"라는 표현을 쓸 때 이 한계(런타임 비검증)를 함께 명시하면 오해를 줄일 수 있다.

- **[INFO]** `isRecord`/`toRecord` 는 plain-object 가드가 아니라 "property 접근 가능한 non-array object" 판별 — 단일 책임에 충실, JSDoc/테스트로 계약 고정
  - 위치: `codebase/backend/src/modules/execution-engine/utils/to-record.ts:143-155`, `to-record.spec.ts:36-47`
  - 상세: class 인스턴스·`Object.create(null)`도 통과시키는 caveat을 문서·테스트로 명시해 호출부 오용(plain-object 전용 가정)을 예방. 소비처(`handler-output.adapter.ts`, `execution-engine.service.ts`)와 무관한 순수 스펙 고정이며 이번 diff 로 새 소비처는 없다.
  - 제안: 없음.

- **[INFO]** 모듈 경계 — `nodes/ai/ai-agent` → `modules/execution-engine/utils/resume-state.schema` type-only import, 순환 없음
  - 위치: `ai-turn-executor.ts` 상단 `import type { ResumeState, RetryState } from '../../../modules/execution-engine/utils/resume-state.schema'`
  - 상세: 기존 의존 방향(`nodes/` → `modules/execution-engine/`)과 일치. `import type`이라 런타임 순환 위험 없음. `resume-state.schema.ts`는 `modules/execution-engine`를 역참조하지 않는 leaf 유틸이라 정적 import가 적절하고 리버스 방향 import도 확인되지 않음.
  - 제안: 없음.

- **[INFO]** 첨부된 `RESOLUTION.md`/`SUMMARY.md` (13_08_49 세션)는 동일 diff 를 대상으로 이미 수행된 8-agent 리뷰의 기록물로, W-1/W-2(testing) 두 건이 `ai-turn-executor.spec.ts` 회귀 테스트 추가로 이미 fix 완료된 상태를 보여준다. 아키텍처 관점에서는 새로운 코드 변경이 아닌 리뷰 산출물 파일이므로 별도 구조적 이슈 없음.

## 요약

이번 변경은 M-7 리팩터 시리즈(#782 toRecord 인프라, #783 resume-state.schema SoT)의 연장으로, `ai-turn-executor.ts`의 `endMultiTurnConversation`/`buildMultiTurnFinalOutput`/`buildRetryState` 체인에서 `Record<string, unknown>` 단언을 zod 파생 `ResumeState`/`RetryState` 도메인 타입으로 국소 치환하고, `isRecord`에 plain-object 가드가 아니라는 계약을 문서화 테스트로 고정했다. 스키마는 의도적으로 런타임 비검증·`catchall` open 상태를 유지해 behavior-preserving 원칙을 지키며, 모듈 경계·의존 방향(`nodes → modules`, type-only)도 기존 패턴과 일치해 순환 위험이 없다. 유일한 지적사항은 같은 파일 안에서 타입 좁힘이 일부 메서드에만 적용되어 과도기적 비일관성이 존재한다는 점인데, 이는 프로젝트의 클러스터 단위 점진적 롤아웃 관행(M-7 순차 클러스터, plan에 후속 예고됨)에 부합하여 차단 사유가 아니다. 함께 포함된 review 산출물(SUMMARY/RESOLUTION)도 동일 결론(NONE, Critical/Warning 0, 이미 fix 반영)을 재확인하고 있어 이번 재검토에서도 위험도 상향 요인은 없다.

## 위험도
NONE
