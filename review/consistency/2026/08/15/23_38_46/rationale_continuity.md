# Rationale 연속성 검토 — spec-draft-ws-types-canonical-location.md

## 발견사항

- **[INFO]** §4.4 신규 문단의 "ES-module 그래프" 표현이 기존 표의 "(ES-module 순환 봉인)" 라벨과 나란히 놓이면 축 구분이 흐려질 수 있다
  - target 위치: 체크리스트 항목 ⑧, `spec/5-system/4-execution-engine.md` §4.4 "순환 의존 처리" 마지막 문단 뒤에 삽입될 신규 문단
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §4.4 본문의 `forwardRef` 기법 표 — 사례 열에 `ExecutionEventEmitter → WebsocketService (ES-module 순환 봉인)` 라고 명시 (C-1 후속④, PR #638) + 같은 문서 `## Rationale` "C-1 god-class strangler-fig 분할" 항의 "ES-module 순환은 … forwardRef 지연 해석으로 봉인했다" 서술
  - 상세: target 이 추가하려는 문단은 "위 두 기법(forwardRef/ModuleRef.get)은 DI 그래프를 다루고, ES-module 그래프 층위 문제는 별도(의존성-프리 모듈 분리)로 해소한다"는 **축 분리**를 명문화한다. 이 구분 자체는 실제 이력(72 suites 장애, `plan/in-progress/ws-event-types-extract.md`)에 근거가 있고 이전 `18_53_27` rationale_continuity 라운드의 W1 지적을 이미 반영한 결과라 **번복이 아니라 보완**이다. 다만 §4.4 forwardRef 표는 이미 "ES-module 순환"이라는 동일 어휘를 forwardRef 의 효과로 써 왔다 — 신규 문단이 "forwardRef 는 DI 그래프만" 이라고 읽히면, 표의 "ES-module 순환 봉인" 라벨과 표면상 충돌하는 것처럼 보일 수 있다(실제로는 "인스턴스화·주입 순서 문제"와 "모듈 평가 시점 값 undefined 문제"라는 서로 다른 실패 모드를 같은 관용어로 부른 것). 코드 쪽(`websocket-events.types.ts` 헤더 JSDoc)은 이미 이 구분을 "DI 그래프·forwardRef·emit 경로는 불변" 식으로 동일하게 서술해 두었으므로 spec 신규 문단의 방향 자체는 코드·plan 과 정합한다.
  - 제안: 신규 문단에 "위 forwardRef 표의 'ES-module 순환 봉인' 은 **DI 인스턴스화 순서** 문제를 가리키고, 본 문단이 다루는 것은 **모듈 평가 시점 값 undefined** 문제로 서로 다른 실패 모드다" 한 줄만 덧붙이면 향후 독자가 두 서술을 대립으로 오독할 여지를 없앨 수 있다. 필수 수정은 아님(BLOCK 사유 아님).

- **[INFO]** "축이 다른 세 번째 완화책" 신규 문단이 §4.4 본문 리스트 항목 사이(불릿 아님)에 삽입돼, 0-overview.md Rationale 이 명시한 "본문/Rationale 분리" 원칙과의 위치 정합을 재확인할 필요
  - target 위치: 체크리스트 항목 ⑧ "착지점" 절 — "`### 4.4` 의 `근거:` 목록 중 '순환 의존 처리' 항목 마지막 문단 바로 뒤 (… 문서 하단 `## Rationale` 이 아니다)"
  - 과거 결정 출처: `spec/0-overview.md` `## Rationale` 서두 — "본문은 latest-only 사실을 기술하고, '왜 이 선택인가 / 어떤 대안을 기각했는가' 는 본 절[하단 Rationale]을 참조한다"
  - 상세: 프로젝트 공통 원칙(CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")과 문서 3섹션 구성 원칙에 비춰보면 결정 근거는 하단 `## Rationale` 에 두는 것이 기본형이다. 그러나 `4-execution-engine.md` §4.4 는 이미 그 자체가 "결정 + 근거(`근거:` 불릿)"를 본문 안에 인라인으로 담는 기존 패턴(다른 섹션의 `> 결정:` 블록들과 동형)을 취하고 있어, target 이 그 패턴을 그대로 따르는 것은 **기존 문서 구조와의 정합**이지 신규 위반이 아니다. 다만 이 인라인 패턴 자체가 프로젝트 공통 원칙과 다소 거리감이 있다는 점은 이 문서에 이미 내재한 특성이라, target 의 착지점 선택이 그 기존 특성을 그대로 답습한다는 점만 기록해 둔다.
  - 제안: 조치 불요. 향후 §4.4 전체를 표준 패턴(본문 결정 요약 + 근거는 하단 Rationale 로 이관)으로 정리하는 별도 리팩터가 있다면 이 신규 문단도 그때 함께 이관 대상에 포함시킬 것.

## 요약

target 은 스스로 "기각한 대안 — 새 spec 문서 신설"을 명시하고 `spec/conventions/spec-impl-evidence.md` R-1/R-6 (glob 기반 `code:` frontmatter가 이미 구현 위치 추적을 담당) 과 정합하며, §4.4 "단일 sink 정책"·"이벤트 기반 디커플링으로 순환을 근본 축소"의 유예 상태를 명시적으로 보존해 과거 결정을 번복하지 않는다. §4.4 에 추가하려는 "축이 다른 세 번째 완화책" 문단은 즉흥적 주장이 아니라 실측된 장애(72 suites, `#1174`)·`plan/in-progress/ws-event-types-extract.md` 의 검증된 결론·실제 코드(`websocket-events.types.ts` 헤더 JSDoc, `spec/5-system/14-external-interaction-api.md` R10 인용과 1:1 일치)·선행 `18_53_27` rationale_continuity 라운드의 W1 해소 결과를 그대로 spec 화한 것이어서 이력 근거가 이례적으로 탄탄하다. item ⑦의 `websocket-events.types.ts` `ExecutionChannelEvent` JSDoc → EIA §R10 인용도 실제 코드와 대조해 정확함을 확인했다. 유일하게 남는 것은 "ES-module 순환"이라는 동일 어휘가 §4.4 forwardRef 표(DI 인스턴스화 순서 문제)와 신규 문단(모듈 평가 시점 값 undefined 문제)에서 서로 다른 실패 모드를 가리키는 서술상 모호함으로, CRITICAL/WARNING 급 충돌은 아니고 명확화 제안(INFO) 수준이다.

## 위험도

LOW
