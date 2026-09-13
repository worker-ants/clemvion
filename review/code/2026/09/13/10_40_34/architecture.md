# Architecture Review — guide-error-code-truth (round 2)

## 검토 범위

실제 코드 변경분(파일 1~21)을 전수 확인했다. 파일 22 이후(`plan/**`, `review/code/2026/09/13/10_12_19/**`,
`review/consistency/**`)는 직전 라운드(`10_12_19`)의 산출물을 커밋에 포함한 것으로, 이번 라운드
자체의 아키텍처 변경 대상이 아니라 참고 문서다(직전 라운드 architecture.md 의 발견을 이번
diff 가 어떻게 처분했는지 대조하는 데만 썼다). `llm-model-config.controller.spec.ts` (파일 3),
`guide-error-code-existence.test.ts`/`guide-error-code-scan.ts` (파일 18·19) 는 프롬프트에서
diff 가 생략돼 `Read` 로 원본을 직접 열어 확인했다. 모듈 의존 방향은 `grep` 으로 `model-config
↔ llm` 양방향을 대조해 순환이 없음을 확인했다.

## 발견사항

- **[INFO]** 직전 라운드 architecture WARNING#1(“8갈래 문장이 수기 사본이라 무가드”)을 구조적으로 닫았다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (신규 파일 전체)
  - 상세: 신규 가드가 `sanitize-error.util.ts` 의 `return '...';` 리터럴을 SoT 로 텍스트 추출해
    `models{,.en}.mdx` 표와 **양방향**(표→SoT 누락, SoT→표 orphan) 대조한다. 추출 실패가
    조용히 통과하지 않도록 `toHaveLength(8)` vacuity floor 를 앞에 뒀다 — 자매 가드 가족
    (`guide-error-code-existence.test.ts`)과 동일한 설계 원칙(순수 스캐너 + vacuity floor +
    대조군)을 재사용해 응집도가 유지된다. 이 저장소의 "TS 소스 대상 = blind 정규식 대신 AST"
    원칙과 겉보기엔 어긋나 보이지만, 대상이 `sanitize-error.util.ts` 의 **문법 구조**가 아니라
    "8개의 고정 반환 문자열이 존재하는가" 라는 좁은 술어이고 floor 가 파손을 즉시 드러내므로
    이 경계 안에 있다.
  - 제안: 없음 (긍정적 관찰).

- **[INFO]** 직전 라운드 api_contract WARNING#3(형제 `TestConnectionResultDto` 가 실제로 발행되는
  `code` 를 미선언)을 부분적으로 닫았다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`TestConnectionResultDto.code` 신규 선언, 게이트 464~479행)
  - 상세: `code?: string` 선언을 추가하고 그 반대 방향 유령 필드 `meta`(생산자 0건, 전수 확인)를
    같은 커밋에서 제거했다 — "선언 초과"와 "선언 부족"이라는 반대 방향 결함 두 개를 한 자리에서
    같이 닫은 점이 좋다. 다만 같은 인터페이스의 MCP 전용 필드(`capabilities`·`serverInfo`·
    `preview`)는 이번 PR 범위에서 닫지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    로 명시적으로 이연했다 — 스코프를 좁히면서도 갭을 유실하지 않은 처리다.
  - 제안: 없음 (스코프 판단이 적절하고 후속 추적 문서가 있음).

- **[INFO]** 두 개의 유사 shape DTO(`TestConnectionResultDto` / `ModelTestConnectionResultDto`)가
  각 모듈에 독립 유지되는 구조가 이번 라운드에서도 반복 부담을 그대로 보여준다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:456~`,
    `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:49~`
  - 상세: 두 DTO 모두 같은 유령 필드(`latencyMs`, 생산자 0건)를 독립적으로 갖고 있었고, 이번
    라운드도 "한쪽만 고치면 같은 거짓 광고가 남는다" 는 주석과 함께 양쪽을 손으로 동기화했다.
    `code` 필드는 `integrations` 쪽에만 추가되고 `model-config` 쪽엔 없다 — 이는 두 엔드포인트의
    실제 응답 shape 이 다르다는 의도된 차이(LLM 연결 테스트는 코드를 내지 않는다, CHANGELOG 에
    명시)이므로 결함은 아니다. 다만 공통 필드(`success`, `message`)는 여전히 두 곳에 별도
    선언돼 있어, 세 번째 유령 필드가 생기면 또 손 동기화에 의존하게 된다. 프로젝트 메모의
    cafe24/makeshop 미러 중복처럼 의도된 모듈 경계 분리일 가능성이 높아 강제 리팩터를 권고하지
    않는다.
  - 제안: 없음 — 이미 직전 라운드에서 같은 관찰이 기록됐고 처분(강제 통합 안 함)이 재확인됨.
    다음(세 번째) 재발 시 공용 `ConnectionTestResultDto` 베이스 도입을 검토할 근거로만 남긴다.

- **[INFO]** `LlmService.testConnection` 의 반환 타입은 여전히 `ModelTestConnectionResultDto` 와
  타입 수준으로 연결되지 않은 별도의 인라인 리터럴이다
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection` 시그니처,
    게이트 323~326행: `Promise<{ success: boolean; message?: string; dimension?: number }>`)
  - 상세: 이번 결함(서비스/DTO/프런트 3층 이름 불일치)의 근본 원인은 두 계약(서비스 내부 반환
    타입과 OpenAPI DTO)이 컴파일러로 연결돼 있지 않다는 것이다. 이번 수정은 이름을 맞추고
    `assertMatchesContract` 를 두 지점(서비스 단위·컨트롤러 HTTP 왕복)에 배선해 **이 엔드포인트에
    한해** 회귀를 런타임으로 고정했다 — 견고한 처치다. 다만 타입 시스템 자체는 여전히 두 선언을
    독립적으로 두므로, 이 엔드포인트가 아닌 다른 필드/다른 엔드포인트가 같은 클래스의 결함을
    내는 것은 여전히 가능하고, 그때마다 동일한 계약 테스트를 개별 배선해야 방지된다. 이는
    `response-contract.ts` 자체가 이미 "엔티티↔DTO 타입 통합은 실측으로 기각됐다(불일치 59건 중
    46건이 Date→string 정상 동작)" 고 문서화해 둔, 의도적으로 선택된 트레이드오프이므로 새로운
    지적이 아니라 이번 diff 가 그 트레이드오프를 다시 한 번 옳게 적용한 사례로 본다.
  - 제안: 없음 — 기존 아키텍처 결정(타입 통합 대신 런타임 계약 검사)의 일관된 적용. 신규
    엔드포인트를 추가할 때 같은 패턴(계약 테스트 배선)을 잊지 않도록 리뷰 체크리스트화하는 것만
    참고로 권고.

- **[INFO]** 모듈 의존 방향 확인 — 순환 없음
  - 위치: `codebase/backend/src/modules/llm/llm.module.ts`, `llm-model-config.controller.ts`,
    `llm.service.ts` (이번 diff 로 새로 추가된 의존은 없음 — 기존 `model-config → llm` import 는
    grep 으로 0건 확인)
  - 상세: `llm` 모듈이 `model-config` 모듈의 서비스/DTO/엔티티를 단방향으로 import 하고
    (`ModelConfigModule` 직접 import, forwardRef 미사용 — 주석에 "C-2 cluster 4 에서 역의존 제거"로
    명시), 역방향 import 는 존재하지 않는다. 이번 diff 가 추가한 신규 import
    (`llm-model-config.controller.spec.ts` 의 `ModelTestConnectionResultDto`,
    `llm.service.spec.ts` 의 동일 심볼)도 같은 단방향(`llm → model-config`)이라 순환 의존을
    새로 만들지 않는다.
  - 제안: 없음 (확인용 기록).

## 요약

이번 라운드는 새 아키텍처 결함을 도입하지 않고, 직전 라운드(`10_12_19`) 리뷰가 지적한 두 개의
아키텍처 갭(문구 정확성 무가드 · 형제 DTO 의 `code` 미선언)을 각각 양방향 텍스트 대조 가드와
DTO 필드 백필로 닫았다. 서비스 반환 타입과 OpenAPI DTO 가 타입 수준으로 통합돼 있지 않다는
근본적 여지는 남아 있지만, 이는 이 저장소가 실측(엔티티↔DTO 불일치 사례) 끝에 의도적으로 선택한
트레이드오프(타입 통합 대신 계약별 런타임 검사)이며 이번 diff 는 그 패턴을 정확히 재적용했다.
두 개의 유사 shape DTO 가 별도 모듈에 중복 유지되는 점도 계속 관찰되나 모듈 경계상 허용 범위이고
새 리스크는 아니다. 모듈 의존 방향은 여전히 단방향(`llm → model-config`)이며 순환 의존은 없다.

## 위험도

LOW
