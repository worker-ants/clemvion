# 유지보수성(Maintainability) 리뷰 — rotate-bot-token-body

## 발견사항

- **[WARNING]** 캐너리 spec 3파일의 4-테스트 템플릿이 거의 그대로 복제됨 (rule-of-three 충족)
  - 위치: `codebase/backend/src/modules/executions/executions-continue-body.spec.ts:22-68`,
    `codebase/backend/src/modules/triggers/triggers-rotate-bot-token-body.spec.ts:24-69`
    (참고 대조: `codebase/backend/src/modules/hooks/hooks-webhook-body.spec.ts:12-38` 는 축약된
    3-테스트 변형)
  - 상세: 두 파일 모두 같은 4개 `it()` shape — ① `bodyParamDesignType` 이 `Object` 인지(캐너리),
    ② 여분 키를 실은 본문이 `CustomValidationPipe` 를 그대로 통과하는지(캐너리), ③ 실 컨트롤러의
    `@ApiBody` 가 맞는 DTO 를 가리키는지(가드), ④ 스텁 컨트롤러로 렌더한 스키마 검증(렌더) —
    를 엔티티 이름만 바꿔 반복한다. `swagger-probe.ts` 자신의 JSDoc(`codebase/backend/src/shared/testing/swagger-probe.ts:13-29`)이
    이미 "네 스펙이 같은 보일러플레이트를 반복 → 공유 헬퍼로 추출" 이력을 설명하는데, 이번 PR 로
    그 반복이 유틸 함수 층(`buildSwaggerDocument`/`schemaOf`/`bodyParamDesignType`)에서는
    해소됐지만, 실제 4-테스트 "모양" 자체는 여전히 파일 단위로 복제된다. `workflows-execute-body.spec.ts`
    까지 포함하면 이 패턴은 최소 3곳(+hooks 축약형까지 4곳)에서 반복 중이라, 이 프로젝트가 다른
    곳(전역 `@ApiBody` 가드 유예 근거)에서 직접 쓰는 "rule of three" 기준을 이미 충족한 상태다.
  - 제안: `describeApiBodyOnlyRoute({ controller, method, dto, required, extraKeysSample })` 류의
    공용 test factory로 반복되는 캐너리+가드+렌더 4종을 추출하는 것을 고려. 다만 캐너리 JSDoc이
    "이 테스트를 조용히 고쳐 통과시키지 말 것" 이라며 각 파일이 독립적으로 읽히길 의도한 정황도
    있어, 추출이 오히려 "읽자마자 이해" 가치를 깎을 수 있다 — 최소한 다음(5번째) 유사 라우트가
    생기면 이번 3~4곳 사례를 근거로 추출 여부를 재검토할 것을 권장.

- **[INFO]** `bodyParamDesignType` 내부 `body` 변수명이 실제 "요청 본문"이 아니라 라우트 인자
  메타데이터 튜플을 가리켜 혼동 소지
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:147`, `:163`
  - 상세: `const body = Object.entries(args).find(...)` 는 `@Body()` 파라미터의 메타데이터 엔트리
    (`[key, { index }]`)이지 실제 HTTP 요청 본문 값이 아니다. 같은 파일이 다루는 도메인(캐너리
    스펙들에서 `body` 는 항상 "실제 요청 바디 객체"를 뜻함)과 이름이 겹쳐, 이 함수만 따로 읽을 때
    잠깐 헷갈릴 수 있다. `types[body[1].index]` 처럼 튜플 인덱스를 두 번 파고드는 접근도 그 자체로는
    의도가 즉시 드러나지 않는다.
  - 제안: `const bodyArgEntry = ...` 로 이름을 바꾸거나, `const [, { index: bodyIndex }] = bodyArgEntry ?? [undefined, undefined]` 형태로 구조 분해해 의도를 이름에 드러낼 것.

- **[INFO]** Nest 비공개/내부 export 경로(`ROUTE_ARGS_METADATA`, `RouteParamtypes`)에 대한 의존
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:9-10`(import), `:145`, `:154`(사용)
  - 상세: `@nestjs/common/constants` 와 `@nestjs/common/enums/route-paramtypes.enum` 은
    `@nestjs/common` 최상위에서 공개 export 되는 안정 API 가 아니라 서브패스 내부 모듈이다.
    JSDoc(`:138-139`)이 "파라미터 순서에 기대지 않는다"는 장점을 명시해 트레이드오프를 인지한
    선택으로 보이지만, 반대급부로 Nest 메이저 업그레이드 시 이 경로/키 상수가 예고 없이 바뀌면
    캐너리 3개가 "왜 실패하는지 알기 어려운" `design:paramtypes 가 없다` 류의 에러로 한꺼번에
    깨질 수 있다.
  - 제안: 함수 JSDoc에 "Nest 내부 API 의존 — 메이저 버전 업그레이드 시 재검증 필요" 한 줄을
    남겨 다음 업그레이드 담당자가 원인을 빠르게 찾을 수 있게 할 것.

- **[INFO]** "문서 전용 DTO" 설계 근거 서사가 파일마다 거의 동일 문장으로 반복
  - 위치: `codebase/backend/src/modules/executions/dto/continue-execution.dto.ts:3-10`,
    `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts:3-11`
    (선행 선례: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:3-29`)
  - 상세: 신규 DTO 두 개는 "전역 `CustomValidationPipe` 가 `Object` metatype 만 검증을 건너뛴다 →
    DTO 로 타입하면 계약이 바뀐다"는 동일한 핵심 근거를 각 파일 `//` 주석에 거의 같은 문장으로
    다시 적는다(선례까지 포함하면 사실상 3벌째 사본). 설계 결정 자체가 바뀌면(예: 파이프 예외
    정책 변경) 이 근거 서사가 있는 파일을 전부 찾아 고쳐야 한다. 긍정적인 부분: 선례
    (`execute-workflow.dto.ts`)는 이 서사를 공개 노출되는 `/** */` JSDoc 안에 두어
    `swagger.md` §3(내부 서사가 공개 OpenAPI 로 나가면 안 됨) 위반 소지가 있었는데, 이번 두 신규
    파일은 그 문제를 스스로 인지하고 서사를 `//` 라인 주석으로, JSDoc 은 소비자용 한 줄로 분리해
    §3 위반 표면을 새로 넓히지 않았다 — 일관성 측면에서는 오히려 선례보다 개선됐다.
  - 제안: 핵심 근거(전역 파이프가 `Object` metatype 만 건너뛴다는 사실)를 `spec/conventions/swagger.md`
    또는 `CustomValidationPipe` 자신의 JSDoc처럼 단일 출처에 두고, 각 DTO 주석은 그 출처를
    인용하는 짧은 형태로 줄이는 것을 고려(현재도 차단 수준은 아님).

## 요약

이번 변경은 세 라우트(`triggers.rotateBotToken` · `executions.continueExecution` · `hooks.receiveWebhook`)에
`@ApiBody` + 문서 전용 DTO를 추가하는 좁고 잘 문서화된 변경이다. 새로 추가된 헬퍼
(`bodyParamDesignType`)와 두 DTO 클래스는 짧고 단일 책임을 지키며, 기존 `execute-workflow.dto.ts`
선례를 그대로 따르되 `//`/JSDoc 서사 분리는 오히려 선례보다 개선된 형태로 적용했다. 매직 넘버·과도한
중첩·복잡한 분기는 없다. 가장 눈에 띄는 지점은 세(사실상 네) 개 캐너리 spec 파일이 거의 동일한
4-테스트 템플릿을 반복한다는 것과, 그 설계 근거 산문이 DTO 파일마다 다시 쓰인다는 것인데, 둘 다
기능적 결함이 아니라 "같은 내용을 여러 곳에서 유지해야 하는" 미래 유지보수 비용에 가깝다. 전반적으로
CRITICAL 급 유지보수성 결함은 없다.

## 위험도

LOW
