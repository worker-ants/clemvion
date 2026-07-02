# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `z.custom<T>()`의 "런타임 무검증(no-op validator)" 계약을 고정하는 스키마 레벨 테스트 부재 (이전 리뷰에서 제기, 아직 미해결)
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resume-state.schema.ts` (`messages: z.array(z.custom<ChatMessage>())`, `turnDebugHistory: z.custom<unknown[]>()`, `allPresentations: z.custom<PresentationPayload[]>()`) / 대응 spec 파일 `resume-state.schema.spec.ts`
  - 상세: `resume-state.schema.spec.ts`에 `z.custom` 관련 무검증 계약(예: `messages: [1,2,3]`처럼 원소가 `ChatMessage` shape 이 아닌 값도 통과함)을 직접 고정하는 테스트가 없다(grep 확인). 코드 주석(§7.5 graceful-reset 관련)에는 이 계약이 명시되어 있지만, 향후 zod 버전 업그레이드나 `z.custom` 대체 시 이 "무검증" 특성이 조용히 깨져도 잡을 안전망이 없다. 다만 RESOLUTION.md 상 이미 "선택(비강제)" 항목으로 분류되어 이번 클러스터의 필수 조치 대상은 아니다.
  - 제안: `resume-state.schema.spec.ts`에 `resumeCheckpointSchema.safeParse({ ..., messages: [1, 2, 3] }).success === true` 류의 명시적 회귀 테스트 1건 추가 권장(낮은 우선순위, 후속 클러스터에서 처리 가능).

- **[INFO]** `ai-turn-executor.ts:2440`(diff 범위 밖) 레거시 `as ChatMessage[]` 캐스트 경로는 이번 회귀 가드에서 다뤄지지 않음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:2440` 부근 (M-7 클러스터 미적용 잔존 지점, prior architecture 리뷰에서도 지적)
  - 상세: 이번 spec 변경은 diff 범위(`endMultiTurnConversation`/`processMultiTurnMessage`)만 다루므로 문제는 없으나, 해당 레거시 경로가 후속 클러스터에서 enrich 될 때 동일한 "non-default 값 회귀 가드" 패턴이 재사용될 수 있도록 현재 추가된 두 테스트가 좋은 템플릿 역할을 한다.
  - 제안: 없음(참고용).

## 검증 수행 내역
- `ai-turn-executor.spec.ts` 실행: 25/25 PASS (`npx jest src/nodes/ai/ai-agent/ai-turn-executor.spec.ts`), 신규 2건(`재개 시 turnDebugHistory/allPresentations 를 누적·보존`, `enrich 로 캐스트 제거된 필드... 를 non-default 값으로 출력에 전달`) 포함.
- `resume-state.schema.ts` 관련 unit 스위트(`utils/` 하위 6 suites) 82/82 PASS.
- `output.result.presentations` 가 실제로 `metadata.allPresentations`(`buildMultiTurnFinalOutput` 내부, L3051/L3259)에서 파생됨을 소스에서 직접 확인 — 새 테스트(spec.ts L429-454)가 진짜 프로덕션 경로를 검증하는 것이지 우연히 통과하는 assertion 이 아님을 확인.
- 두 신규 테스트 모두 독립적인 `buildExecutor()`/로컬 `state` 객체를 사용해 다른 테스트와 격리됨 — 공유 mutable fixture 없음. 기존 헬퍼(`resumeState()`/`endState()`)를 spread(`...`)로 확장하는 패턴을 그대로 따라 가독성·일관성 양호.
- 테스트명에 "M-7 enrich 회귀 가드"/"M-7 회귀 가드"를 명시해 의도(캐스트 제거 후 값 유실 방지)가 테스트 코드만으로도 명확히 드러남 — 가독성 우수.
- Mock 사용: `mockLlmService.chat`(기존 인프라 재사용), 신규 테스트는 추가 mock 없이 상태 객체만 확장 — 과도한 mocking 없이 최소 침습적.

## 요약

본 diff 는 이전 ai-review(15_09_45) 세션에서 testing 리뷰어가 지적한 W-1/W-2 두 커버리지 갭(캐스트 제거 대상 필드의 non-default 값 회귀 가드 부재, 멀티턴 재개 시 배열 누적 로직 미검증)을 정확히 겨냥한 fix 커밋이다. 신규 테스트 2건은 실제 소비 코드 경로(`buildMultiTurnFinalOutput`→`output.result.presentations`/`meta.turnDebug`, `processMultiTurnMessage` 재개 루프의 prepend+append 누적)를 정확히 타겟팅하며, 독립적인 상태 객체와 명확한 테스트명으로 가독성·격리성도 양호하다. 실행 검증 결과 25/25(신규 포함) 및 관련 스키마 스위트 82/82 전부 PASS. 남은 갭(`z.custom` 무검증 계약 자체를 고정하는 스키마 레벨 테스트)은 이미 RESOLUTION.md 에서 선택/비강제 항목으로 명시적으로 분류되어 있어 이번 클러스터의 블로킹 사유가 아니다.

## 위험도

NONE
