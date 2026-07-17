# 아키텍처 리뷰 — `ResumableNodeHandler` 제네릭화 (endReason 도메인 잠금)

## 발견사항

- **[INFO]** `AssertEndReasonDomain` 잠금이 핸들러별 수동 opt-in — 구조적으로 강제되지 않음
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` (`AssertEndReasonDomain` 정의), `ai-agent.handler.ts` / `information-extractor.handler.ts` 파일 하단 `_endReasonDomainLock`
  - 상세: `implements ResumableNodeHandler<X>` 만으로는 `endReason` 파라미터가 잠기지 않는다는 것(메서드 파라미터 bivariance)을 정확히 진단하고, 그 갭을 `AssertEndReasonDomain` phantom const 로 메운 설계는 타당하다. 다만 이 lock 은 각 핸들러 파일에 **개발자가 직접 붙여야 하는** 관례이며, 어떤 중앙 레지스트리·린트 규칙도 "리소스터에 등록된 모든 resumable 핸들러가 이 lock 을 갖는다"를 강제하지 않는다. 향후 3번째 multi-turn 노드가 추가되고 lock 을 빠뜨리면 `implements` 표면(메서드 존재·state·반환 타입)은 여전히 통과하므로, 타입 인자가 다시 "검사되지 않는 주석"으로 조용히 퇴화할 수 있다.
  - 제안: 지금 당장 구조적 강제가 필요한 정도는 아니다(구현체가 2개뿐이고 문서화가 충분). 다만 `handlerRegistry`(노드 타입 → 핸들러 매핑)에 resumable 노드 목록이 이미 존재한다면, 그 목록을 순회하며 각 클래스가 `AssertEndReasonDomain` 잠금을 갖는지 확인하는 unit 테스트(타입 레벨이 아니라 명시적 리스트 대조) 하나를 추가하면 이 opt-in 성격을 완화할 수 있다. Blocking 은 아님.

- **[INFO]** 제네릭 계약의 확장 한계 — 도메인이 서로소가 되면 `UniversalEndReason` 이 `never` 로 붕괴
  - 위치: `codebase/packages/ai-end-reason/src/index.ts` — `UniversalEndReason = AiAgentEndReason & InformationExtractorEndReason` + `_universalNonEmpty` 단언
  - 상세: 두 노드 도메인의 교집합을 자동 파생시키는 설계는 손 유지 drift 를 구조적으로 차단해 우수하다. 다만 이 설계는 "모든 resumable 노드가 공통 종결 사유를 최소 하나는 공유한다"는 전제 위에 있다. 3번째 resumable 노드가 기존 두 도메인과 전혀 겹치지 않는 종결 사유만 갖는다면 `UniversalEndReason` 이 `never` 로 붕괴하고, 엔진의 범용 호출부(`handleAiEndConversation`/`handleAiTurnError`)가 `'user_ended'`/`'error'` 를 넘기는 자리에서 컴파일이 깨진다. 이는 **의도된 fail-fast**(주석·plan 문서가 명시)이며 은닉된 결함이 아니다 — "그 시점에 공유 계약 자체를 재설계해야 한다"는 전제를 명확히 남겨둔 점은 좋은 엔지니어링 판단이다. N>2 노드로 확장할 때 이 지점이 재설계 트리거가 된다는 점만 인지하고 있으면 된다.
  - 제안: 없음 (관측 사항, 이미 plan 문서 "범위 밖" 절에 유사한 인지가 기록돼 있음).

- **[INFO]** 문서 중복 — bivariance/TS2416 설명이 인터페이스 파일과 두 핸들러 파일에 거의 동일하게 반복
  - 위치: `node-handler.interface.ts` (`ResumableNodeHandler` JSDoc), `ai-agent.handler.ts` 클래스 상단 JSDoc, `information-extractor.handler.ts` 클래스 상단 JSDoc
  - 상세: 각 파일에 왜 제네릭이 필요한지, 왜 `implements` 만으로 부족한지에 대한 장문의 설명이 반복된다. 코드 중복은 아니지만, 향후 이 설계가 바뀌면 세 곳을 모두 갱신해야 하는 문서 drift 위험이 있다.
  - 제안: 현 상태로도 심각하지 않음(SoT 는 인터페이스 파일의 `AssertEndReasonDomain` doc, 핸들러 쪽은 "왜 이 클래스가 이렇게 선언됐는가"의 로컬 요약이라 완전 중복은 아님). 개선한다면 핸들러 쪽 주석을 1~2문장으로 줄이고 `{@link AssertEndReasonDomain}` 참조로 대체할 수 있으나 blocking 은 아님.

## 종합 평가

`NodeHandler` → `ResumableNodeHandler<TEndReason>` 제네릭화는 범위가 좁고(인터페이스 1개 + 구현체 2개 + 공유 패키지 1개) 목적이 분명한 타입 안전성 개선이다. 이전에는 어느 구현체도 `implements ResumableNodeHandler` 를 선언하지 않아 `endReason` 계약이 tsc 검사 없이 순전히 호출 패턴(엔진이 교집합 값만 넘긴다는 관례)에 의존했는데, 이번 변경은 (1) 인터페이스를 노드별 종결 도메인으로 파라미터화하고, (2) 메서드 파라미터 bivariance 로 인해 `implements` 만으로는 못 잡는 축을 `AssertEndReasonDomain` phantom 단언으로 메우며, (3) 노드 타입을 모르는 범용 호출부의 기본 타입 인자를 합집합이 아닌 교집합(`UniversalEndReason`, 패키지에서 자동 파생)으로 둬 "넓히면 안전이 악화된다"는 위험을 원천적으로 배제했다. 레이어 경계(`nodes/core` 계약 ↔ `nodes/ai/*` 구현 ↔ `@workflow/ai-end-reason` 값 도메인 SoT)와 기존 composition-root/collaborator 구조는 전혀 건드리지 않았고, 순환 의존성도 새로 발생하지 않았다(패키지 → 인터페이스 → 핸들러의 단방향). 엔진 호출부(`ai-turn-orchestrator.service.ts`)를 직접 확인한 결과 `'user_ended'`/`'error'` 만 넘기는 기존 호출 패턴이 새 `UniversalEndReason` 교집합과 정확히 일치해 회귀 없이 타입이 좁혀졌다. 남은 사항은 모두 INFO 수준(수동 opt-in lock의 미래 확장성, N>2 확장 시 교집합 붕괴, 문서 중복)이며 지금 구조를 막을 이유는 없다.

## 위험도

LOW
