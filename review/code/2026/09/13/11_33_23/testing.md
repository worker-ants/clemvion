# 테스트(Testing) 리뷰 — guide-error-code-truth (라운드 4)

## 검토 범위

프롬프트에 실린 28개 변경 파일(코드 24 + 리뷰/plan 산출물) 중 테스트 관점이 유효한 파일을
전수 확인했다. 프롬프트가 절단한 diff(파일 4·19·20·23·24)는 저장소에서 `Read`로 원본을
직접 열어 대조했다. 이 PR 은 이미 3라운드의 `/ai-review`+`--impl-done` 을 거치며 UI 실패
경로 무테스트(라운드1), 8갈래 문장 무가드(라운드1), 형제 DTO 계약 미배선(라운드2), spec §1.4
표 누락(라운드3) 등을 스스로 뮤테이션 테스트까지 곁들여 처분한 상태다(`plan/in-progress/
guide-error-code-truth.md` §G~§I). 아래는 그 세 라운드가 아직 건드리지 않은 잔여 축만 다룬다.

## 발견사항

- **[WARNING]** `/api/integrations/:id/test` 에는 이 PR 이 형제 엔드포인트에 도입한 "와이어
  계약(HTTP round-trip)" 검증 층이 빠져 있다 — 같은 `TransformInterceptor` 를 타는데 검증
  깊이가 비대칭이다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:685-699`
    (`assertMatchesContract` 가 **서비스 반환값**에만 배선됨) vs
    `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts:129-262`
    (`POST /model-configs/:id/test — 와이어 계약 (HTTP)` — `Test.createTestingModule` +
    `supertest` + 전역 `TransformInterceptor` 를 실제로 태우는 신규 describe)
  - 상세: `llm-model-config.controller.spec.ts` 의 자체 주석(129~151행)이 정확히 이 axis 를
    설명한다 — *"서비스 단위 프로브는 서비스 반환 객체만 보고, 반환과 응답 본문 사이의
    `TransformInterceptor` 층을 한 번도 태우지 않는다. 오늘은 그 층이 키를 안 건드리지만
    그 사실을 검증하는 게 이 describe 다."* 이 근거는 `IntegrationsController` 에도 글자
    그대로 적용된다 — `app.module.ts:203` 에서 `TransformInterceptor` 가 `APP_INTERCEPTOR` 로
    전역 등록돼 모든 컨트롤러에 걸리기 때문이다(`grep` 으로 확인). 그런데 이번 PR 은
    `TestConnectionResultDto` 에 `code?: string` 을 새로 선언하면서 그 검증을
    `integrations.service.spec.ts` 의 서비스-레벨 `assertMatchesContract` 한 곳에만 걸었고,
    `codebase/backend/src/modules/integrations/` 전체에 `supertest`/`createNestApplication`
    을 쓰는 스펙이 하나도 없다(`grep -rl supertest codebase/backend/src/modules/integrations/`
    → 0건, e2e 쪽도 `/api/integrations/:id/test` 응답 shape 을 왕복 검증하는 스펙 없음).
    즉 향후 인터셉터·직렬화 옵션이 바뀌어 `code`/`message` 키 이름이 응답 직전에 달라져도
    이 엔드포인트에서는 어떤 테스트도 못 잡는다 — 이번 PR 이 LLM 쪽에서 정확히 이 이유로
    새 계층을 추가한 것과 대칭이 안 맞는다.
  - 참고: `plan/in-progress/spec-draft-nullable-notation-followups.md:3266-3287` 에 이미
    "MCP 전용 필드 3종 미선언 + 계약 검증자 미배선" 항목이 있지만, 그 항목이 말하는 미배선은
    **서비스 레벨** `assertMatchesContract` 를 가리키며(`capabilities`·`serverInfo`·`preview`
    선언 갭), 여기서 지적하는 **와이어(HTTP) 레벨** 축과는 별개다. 기존 등재 문구로는 이
    갭이 커버되지 않는다.
  - 제안: 이번 PR 을 막을 사유는 아니다(diff 밖, `integrations.controller.spec.ts` 자체가
    변경 대상이 아님). 다만 같은 결함 클래스(값 vs 선언 불일치가 인터셉터 층에서 재발할 수
    있다)이므로, 위 backlog 항목 옆에 "와이어-레벨 supertest 검증도 아직 없다" 를 한 줄
    추가해 두는 것을 권고한다. 그래야 다음 사람이 "서비스 레벨은 이미 걸었으니 끝났다" 로
    오판하지 않는다.

## 긍정적으로 확인한 사항 (참고)

- `llm-model-config.controller.spec.ts:215-247` 의 실패 경로 테스트는 mock 서비스가 아니라
  진짜 `LlmService` 를 DI 하고 `LLMClientFactory`/`ModelConfigService`/`LlmUsageLogService`
  등 **의존만** mock 했다 — 원래 결함(필드 이름 불일치)이 정확히 "서비스 반환 리터럴을 내가
  적고 내가 단언" 하는 축이었는데, 그 축에서 vacuous 해지지 않도록 설계했다. 같은 테스트가
  키 전수(`Object.keys(...).sort()`)까지 단언하고, 그 단언이 실제로 무엇을 가르는지 뮤테이션
  결과표(RED/GREEN 4행)를 주석으로 남겨 "이 단언이 왜 필요한가" 를 다음 사람이 재추론하지
  않게 했다 — 드문 수준의 테스트 근거 문서화다.
- `guide-error-code-existence.test.ts` 는 vacuity floor(코퍼스 크기·축별 최소 건수·root 별
  적재 확인)와 축별 대조군(합성 fixture 로 각 축의 포착/비포착 경계를 양성 확인)을 분리해
  갖추고 있다. 특히 "[경계] 축 1 은 줄 단위라 여러 줄로 쪼갠 행은 놓친다" 처럼 **놓치는
  것 자체를 테스트로 고정**한 방식은, 스캐너 자체가 `return []` 로 퇴화해도 baseline-0
  단언이 저절로 통과하는 함정을 막는다.
- `guide-sanitized-message-parity.test.ts` 는 SoT(backend `sanitize-error.util.ts` 반환
  리터럴)를 정규식으로 추출한 뒤 가이드 mdx 표와 **양방향**(표→SoT 누락 확인, SoT→표 누락
  확인) 대조하고, 추출 자체가 깨지는 경우를 잡는 vacuity floor(`toHaveLength(8)`)를 먼저
  둔다 — 부분집합 단언만 있었다면 "행을 지우는 편집"이 조용히 통과했을 것이라는 이유를
  주석에 명시했다.
- `model-config-manager.test.tsx` 의 신규 실패 토스트 테스트는 `stringContaining` 같은 느슨한
  매처 대신 **정확 문자열** 매칭을 쓰고, 사유 필드가 빈 경우를 대조군으로 별도 케이스화해
  "느슨한 단언이었다면 버그가 있어도 통과했다" 는 근거를 스스로 반증 가능한 형태로 남겼다.
  `updateMock` 이 실패 경로에서 호출되지 않았음을 함께 단언해 성공/실패 분기점도 고정했다.
- `model-configs.test.ts` 의 픽스처 교체(`latencyMs: 120` → `dimension: 1536`)는 "생산자가
  0건인 필드로 옵셔널-필드-통과를 주장하면 그 통과가 아무것도 보증하지 않는다"는 근거를
  주석으로 남기고 같은 축을 실재 필드로 옮겼다 — 지어낸 픽스처를 실재 값으로 교체하는
  올바른 방향의 수정이다.
- 신규 테스트들의 `beforeEach`(`vi.clearAllMocks()`/`jest.fn()` 재발급)와 `afterAll`
  (`app.close()`)가 빠짐없이 짝을 이뤄 테스트 간 격리·리소스 정리가 깨지지 않는다.

## 요약

이 PR 은 이미 세 라운드의 리뷰를 거치며 테스트 관점의 굵직한 갭(UI 실패 경로 무테스트,
8갈래 문장 무가드, 형제 DTO 계약 미배선, spec 표 누락)을 스스로 뮤테이션 검증까지 곁들여
닫은 상태이고, 남은 신규 테스트(`llm-model-config.controller.spec.ts`, `guide-error-code-
existence.test.ts`, `guide-sanitized-message-parity.test.ts`, `model-config-manager.test.tsx`
추가분)는 vacuity floor·대조군·정확 문자열 단언 등 검증 자체의 견고성까지 코드로 고정해
둔 높은 수준이다. 유일하게 새로 발견한 갭은 이번 PR 이 `/api/model-configs/:id/test` 에
도입한 "와이어(HTTP, TransformInterceptor 포함) 계약 검증" 층이 같은 인터셉터를 타는 형제
엔드포인트 `/api/integrations/:id/test` 에는 아직 없다는 점이다 — diff 밖이고 blocking
사유는 아니지만, 기존 backlog 항목(서비스-레벨 미배선)과는 다른 축이라 별도로 적어 두지
않으면 "이미 걸었다" 로 오판될 수 있다.

## 위험도

LOW
