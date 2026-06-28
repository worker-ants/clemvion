# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: http-exception.filter.spec.ts

- **[INFO]** 테스트 케이스 추가 시 구조적 일관성 유지
  - 위치: 전체 추가 diff
  - 상세: 신규 추가된 세 테스트(`23505 QueryFailedError`, `nested error envelope`, `requestId on 5xx`)는 기존 `mockHost()` / `bodyOf()` 헬퍼 패턴을 그대로 따른다. `afterEach(jest.restoreAllMocks)`도 일관 적용돼 있다.
  - 제안: 이슈 없음.

- **[INFO]** `Object.assign(new Error(...), { code: '23505' })` 패턴
  - 위치: 라인 54–56 (diff 기준)
  - 상세: QueryFailedError의 driverError를 합성하는 방식이 이 파일에서만 사용되는 one-off 패턴이다. 테스트 파일 내 도우미 함수(`makeDriverError(code)`)로 추출하면 향후 동일 케이스 추가 시 중복이 줄어든다.
  - 제안: `function makeDriverError(code: string) { return Object.assign(new Error('...'), { code }); }` 형태의 파일 범위 헬퍼 추출 권장(현재는 단일 사용이라 CRITICAL/WARNING 아님).

---

### 파일 2: client-ip.spec.ts

- **[INFO]** 테스트 설명 문자열 변경(`null` → `undefined`) 은 구현 계약 변경과 정확히 동기화됨
  - 위치: 라인 306, 320 (diff 기준)
  - 상세: 테스트 문자열과 단언(`toBeNull()` → `toBeUndefined()`)이 함께 갱신되어 일관성 유지.
  - 제안: 이슈 없음.

- **[INFO]** 인라인 주석 `// 반환형 통일: 헤더 식별 불가 시 undefined (과거 null) — 소비처 ?? undefined 제거.`
  - 위치: 라인 311 (diff 기준)
  - 상세: 변경 경위를 설명하는 한시적 주석이다. 이 파일을 접하는 다음 개발자 입장에서 `(과거 null)` 이력 언급은 혼란 소지가 있다.
  - 제안: 이력 설명은 git 커밋 메시지/JSDoc에만 두고 코드 내 주석은 `// 헤더에서 IP를 찾지 못하면 undefined` 정도로 간결화 권장.

- **[INFO]** `extractClientIp` 의 최종 폴백은 여전히 `null` 반환
  - 위치: client-ip.spec.ts 517행 `expect(extractClientIp(req)).toBeNull()`
  - 상세: `extractClientIpFromHeaders`는 `undefined` 반환으로 통일됐지만, `extractClientIp`(상위 함수)는 모든 소스 부재 시 `null`을 반환한다. 두 공개 함수의 반환 타입이 `string | undefined` vs `string | null`로 분기되어 있어 호출자가 두 함수를 혼용할 때 `?? undefined` 이슈가 재현될 수 있다.
  - 제안: `extractClientIp`도 `undefined` 반환으로 통일하거나, 두 함수 반환 타입 불일치를 JSDoc에 명시하여 의도적 차이임을 분명히 할 것.

---

### 파일 3: client-ip.ts

- **[INFO]** `extractClientIpFromHeaders` 반환 타입 변경(`string | null` → `string | undefined`)
  - 위치: 라인 555–565 (diff 기준)
  - 상세: 변경 자체는 타입 일관성을 높이는 개선이다. 단, `extractClientIp`(같은 파일 610행)는 `string | null`을 반환하므로 두 함수 간 시그니처 불일치가 잔존한다.
  - 제안: 파일 3 발견사항과 동일 — `extractClientIp` 시그니처도 `string | undefined`로 통일하거나, 불일치의 이유를 문서화.

- **[INFO]** JSDoc `@returns` 설명이 다소 길고 구현 역사 언급 포함
  - 위치: 637–636행 JSDoc
  - 상세: `(과거 string | null + 호출부 ?? undefined 제거)` 이력 설명이 JSDoc에 남아있다. 코드 자체는 이미 `undefined` 반환이므로 과거 이력은 불필요.
  - 제안: JSDoc을 `@returns 추출된 IP 문자열, 식별 불가 시 undefined` 한 줄로 단축.

---

### 파일 4: executions.service.ts

- **[INFO]** `getStatusById` 신규 공개 메서드는 의도와 책임이 명확
  - 위치: 696–701행 (diff 기준)
  - 상세: 메서드명, 반환 타입(`ExecutionStatus | null`), `.catch(() => null)` 흡수 패턴 모두 명확. JSDoc도 사용처를 명시함. private bracket 접근 제거라는 목적에 부합.
  - 제안: 이슈 없음.

- **[WARNING]** `select: ['id', 'status']` — 배열 리터럴 select 사용
  - 위치: 697–699행
  - 상세: TypeORM `findOne`의 `select` 옵션에 문자열 배열 형태(`['id', 'status']`)를 사용하고 있다. 같은 파일의 다른 `findOne` 호출들은 대부분 `select: { field: true }` 객체 형태를 사용한다(예: `assertDryRunSupported` 내 `select: { id: true, type: true, category: true }`). 배열 형태는 TypeORM v0.3 이후 deprecated 경로이며 일관성도 깨진다.
  - 제안: `select: { id: true, status: true }` 형태로 변경.

---

### 파일 5: hooks.service.spec.ts

- **[WARNING]** IIFE(`(() => { ... })()`)를 사용한 mock 빌더 패턴 — 가독성 저하
  - 위치: 1618–1633행, 1736–1751행 (두 곳 동일)
  - 상세: `ExecutionsService` mock이 IIFE로 클로저를 만들어 `executionRepository.findOne`에 내부 위임하는 구조다. 이 패턴은 의도가 명확하지 않아 처음 읽는 개발자가 왜 IIFE인지 파악하는 데 시간이 걸린다. 더 큰 문제는 동일 IIFE 블록이 두 곳에 완전히 중복된다(`useValue` 블록 88~110, 1732~1751행 코드가 동일).
  - 제안: 파일 상단에 `function buildExecutionsServiceMock()` 팩토리 함수로 추출해 두 곳에서 `useValue: buildExecutionsServiceMock()`으로 호출. 중복 제거 + 의도 명확화 동시 달성.

- **[INFO]** `execRepo.findOne.mockResolvedValue(...)` 를 통한 간접 상태 제어 방식
  - 위치: 2346–2352행, 2481–2488행
  - 상세: 테스트가 `executionRepository.findOne`을 직접 제어해 `getStatusById` 동작을 간접으로 조종한다. mock 내부 구현 세부사항에 테스트가 결합되어 있다. 장기적으로 `getStatusById` 구현이 바뀌면 이 테스트도 깨질 수 있다.
  - 제안: 중장기적으로 `getStatusById` mock을 직접 제어하는 방식(`execService.getStatusById.mockResolvedValue(ExecutionStatus.WAITING_FOR_INPUT)`)으로 전환. 단기 호환성 유지를 위한 현행 위임 패턴은 수용 가능하나, 별도 후속 리팩토링 계획을 남길 것.

- **[INFO]** `let moduleRef: any` 타입
  - 위치: 1673행
  - 상세: `moduleRef`에 `any` 타입이 사용된다. `TestingModule` 타입으로 교체 가능.
  - 제안: `import { TestingModule } from '@nestjs/testing'` 후 `let moduleRef: TestingModule`으로 교체.

---

### 파일 6: hooks.service.ts

- **[INFO]** `extractClientIpFromHeaders(input.headers) ?? undefined` 제거 — 간결해짐
  - 위치: 149행, 259행, 629행 (diff 기준)
  - 상세: 반환 타입 통일 덕분에 `?? undefined` 이중 변환이 제거되어 코드가 명확해짐. 세 곳 모두 동일하게 처리.
  - 제안: 이슈 없음.

- **[INFO]** `getActiveExecutionStatus` — private bracket 접근 제거로 캡슐화 개선
  - 위치: 884–881행 (diff 기준)
  - 상세: `this.executionsService['executionRepository']?.findOne?.(...)` 패턴이 공개 메서드 위임으로 교체되어 클래스 경계 존중 및 테스트 용이성 향상. 변경 전보다 13줄 → 4줄로 단순화됨.
  - 제안: 이슈 없음.

- **[WARNING]** `handleChatChannelWebhook` 함수 길이 및 복잡도
  - 위치: 2829–3242행 (전체 파일 컨텍스트 기준, 이번 diff와 무관하지만 변경 맥락)
  - 상세: 이번 변경이 추가한 코드는 아니지만, 해당 메서드가 약 400행에 달하며 다수의 분기(`/help`, `/cancel`, `open_form_modal`, `form_submission`, 활성 execution 포워딩, 새 실행 시작)를 단일 함수에서 처리한다. 순환 복잡도가 매우 높다. 이번 변경으로 `getActiveExecutionStatus` 호출부가 이 함수 내에 포함되므로 유지보수성 관점에서 언급이 필요하다.
  - 제안: 중장기 리팩토링 후보로 등록. 각 command 분기(`/cancel`, `form_submission`, `open_form_modal`, 일반 텍스트 포워딩)를 별도 private 메서드로 추출하면 순환 복잡도와 함수 길이를 대폭 줄일 수 있다.

- **[INFO]** `readChatChannelConfig` 주석 — "dispatcher 와 중복 정의 OK"
  - 위치: 3581행
  - 상세: 의도적 중복임을 명시한 주석은 유지보수 시 혼란을 방지한다. 다만 dispatcher 파일 경로를 같이 명시하면 더 유용하다.
  - 제안: `(HooksService 내부 헬퍼 — dispatcher(hooks.dispatcher.ts)와 중복 정의 OK)`처럼 파일명 참조 추가.

---

## 요약

이번 변경 세트는 `null` → `undefined` 반환 타입 통일, private bracket 접근 제거라는 두 가지 명확한 목적을 가지며, 해당 범위 내에서는 코드가 간결하고 의도가 드러난다. 주요 유지보수성 이슈는 두 가지다: (1) `executionsService.ts`의 `getStatusById`에서 `select` 옵션이 문자열 배열을 사용해 같은 파일의 다른 객체 형태와 일관성이 깨진다; (2) `hooks.service.spec.ts`에서 동일한 IIFE mock 빌더가 두 곳에 중복되어 향후 `ExecutionsService` 인터페이스 변경 시 두 곳을 함께 수정해야 한다. 또한 `extractClientIp`(상위 함수)가 여전히 `null`을 반환해 `extractClientIpFromHeaders`의 `undefined` 통일과 타입 계약이 불일치하는 점은 호출자 혼란의 잠재 원인이다. `handleChatChannelWebhook` 함수의 높은 복잡도는 이번 변경 범위 밖이지만, 해당 함수 내에 이번 변경 사항이 포함되므로 중장기 리팩토링 후보로 주목할 필요가 있다.

## 위험도

LOW
