# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] 테스트 헬퍼 함수 중복 — 두 describe 블록에 동일 구조의 보조 함수 재정의
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` — 첫 번째 describe(L155~200) vs 두 번째 describe(L531~576)
- 상세: `createWorkflow()`, `saveCanvas()`, `poll()` 세 함수가 두 describe 블록 안에 각각 독립 복사본으로 존재한다. 내용이 거의 동일하나 `poll`의 `timeoutMs` 기본값만 다르다(15_000 vs 20_000). 파일이 860줄에 달하는 주된 이유이기도 하다.
- 제안: 파일 상단 또는 `helpers/execution.ts`로 추출해 두 describe가 공유하도록 리팩터링. `poll`의 기본값 차이는 호출 시 명시적으로 전달하거나 매개변수를 추가해 해소한다.

### [INFO] `as never` 타입 캐스팅 — 의도가 불명확한 관용구
- 위치: `execution-park-resume.e2e-spec.ts` L252, L284, L389, L430, L716, L754, L796, L832
- 상세: `TERMINAL_STATUSES.includes(s as never)` 패턴이 파일 전체에 반복된다. `as never`는 TypeScript `readonly tuple`에 `includes`를 적용할 때 발생하는 타입 오류를 억제하는 workaround이지만, 코드를 처음 보는 사람은 의도를 즉시 이해하기 어렵다.
- 제안: `const isTerminal = (s: string): boolean => (TERMINAL_STATUSES as readonly string[]).includes(s)` 같은 타입-안전 헬퍼를 선언해 단일 지점으로 집약하면 가독성과 타입 명확성이 모두 개선된다.

### [INFO] 인라인 타입 단언(`as { id: string }`) 산재
- 위치: `execution-park-resume.e2e-spec.ts` L68, L162, L245, L383, L662, L709
- 상세: 응답 body에 대한 타입 단언이 매 테스트 케이스마다 산재한다. 변경 대상 diff의 L68 `(llmCreateRes.body.data as { id: string }).id` 패턴이 신규 추가됐으며, 기존 코드에서도 동일하게 반복된다.
- 제안: `interface ApiResponse<T> { data: T }` 형태의 공유 타입을 helpers에 두거나, supertest request에 제네릭 래퍼 헬퍼를 도입하면 반복을 줄이고 타입 오류를 컴파일 타임에 잡을 수 있다.

### [INFO] `docker-compose.e2e.yml` ENCRYPTION_KEY 값이 예측 가능한 패턴
- 위치: `docker-compose.e2e.yml` L886, L1038
- 상세: `0123456789abcdef...` 64-hex 값은 테스트 전용임이 주석으로 명시되어 있으나, 동일 파일 내 `INTEGRATION_ENCRYPTION_KEY`(32-char)와 시각적으로 유사해 "왜 두 키의 길이가 다른가"를 파악하는 데 시간이 걸린다. 주석은 이미 충분히 설명하고 있으나, 두 키의 길이 차이가 의도된 것임을 한 줄로 명시하면 좋다.
- 제안: 현재 주석이 이유를 설명하고 있으므로 INFO 수준. 추가 조치 선택사항.

### [INFO] `spec/5-system/7-llm-client.md` §7.1 — 제목 번호 체계 불일치
- 위치: `spec/5-system/7-llm-client.md` 신규 섹션 `### 7.1 테스트 전용 Stub 모드`
- 상세: 기존 문서의 섹션 7은 "7. 보안 고려사항"으로 보이며, `7.1`이 신규 삽입되면서 후속 섹션(§8 스트리밍)이 번호 갭 없이 바로 이어진다. 문서 독자가 §7에 다른 하위 섹션이 있는지 혼동할 여지가 있다.
- 제안: `### 7.1`보다 `### 7.x` 패턴이 이미 있다면 일관성을 확인하거나, 독립 섹션으로 격상(예: `## 7-a. 테스트 전용 Stub 모드`)하는 방안 검토.

### [INFO] `spec/5-system/14-external-interaction-api.md` §8.3 변경 — 기존 불릿의 들여쓰기 레벨 변화
- 위치: `spec/5-system/14-external-interaction-api.md` diff L1237~1243
- 상세: 기존 단일 불릿 "JWT HS256, secret 은 trigger 별 분리"가 중첩 불릿(두 family 설명)으로 교체됐다. 변경 내용 자체는 명확하고 정확하나, 아래 이어지는 `iext_*` jti blacklist 불릿이 새 중첩 구조와 같은 레벨로 이어지므로 시각적으로 `iext_*` 설명이 두 곳에 걸쳐 분산되는 느낌이 있다.
- 제안: `iext_*` 의 jti blacklist 문장을 `iext_*` 중첩 불릿 안으로 이동시키면 응집도가 높아진다. (선택사항 — 현재도 이해 가능)

## 요약

이번 변경의 핵심인 e2e DB-insert 우회를 정식 API 경로로 교체한 부분(파일 1 diff)은 의도가 명확하고 주석이 충분하다. `docker-compose.e2e.yml`의 ENCRYPTION_KEY 교정도 주석으로 이유를 잘 설명하고 있다. 주요 유지보수성 이슈는 기존 코드에서부터 이어지는 두 가지 반복 패턴 — (1) `describe` 블록 간 헬퍼 함수 복제, (2) `as never` 타입 캐스팅 관용구의 산재 — 이며, 신규 diff에서 추가된 코드는 이 패턴을 따른 것이지 새로 도입한 것은 아니다. Spec 문서 변경은 내용이 정확하고 읽기 쉬우나, §7.1 번호 체계와 §8.3 불릿 구조 일관성을 소폭 개선할 여지가 있다. 전반적으로 유지보수성 위험은 낮다.

## 위험도

LOW
