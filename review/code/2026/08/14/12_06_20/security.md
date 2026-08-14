# 보안(Security) 리뷰 — `12_06_20`

대상: `codebase/backend/src/modules/websocket/websocket.service.ts` (`stripExternalOnlyFields`/`stripDeep`),
`websocket.service.spec.ts` (신규 테스트), `CHANGELOG.md`. 그 외 `plan/**`, `review/**` 신규 파일은
계획·리뷰 산출물(마크다운/JSON)이라 보안 관점의 코드 분석 대상이 아니며, 시크릿 하드코딩 여부만
확인했다(발견 없음 — `SECRET PROMPT A/B` 류는 테스트 fixture 문자열이지 실제 크리덴셜이 아니다).

이번 라운드(`12_06_20`)는 이전 두 라운드(`10_32_27`, `11_02_16`)에서 지적된 CRITICAL/WARNING
전부가 조치된 이후의 최종 상태를 검토한 것이다 — RESOLUTION 문서(`review/code/2026/08/14/10_32_27/RESOLUTION.md`,
`review/code/2026/08/14/11_02_16/RESOLUTION.md`)의 서술을 그대로 신뢰하지 않고, 실제 코드
(`git diff origin/main...HEAD`)와 테스트를 직접 열어 대조했다.

## 발견사항

- **[INFO]** 깊이 상한(`MAX_SANITIZE_DEPTH`) 초과 서브트리에 대한 `stripDeep` 자신의 방어 부재는
  여전히 **호출 순서(sanitize → strip)에 의존**하는 설계다 — 다만 실 파이프라인 sweep 으로
  검증돼 현재는 안전하다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:393` (`if (depth > MAX_SANITIZE_DEPTH) return value;`), 대조 `:251` (`sanitizePayloadForWs` 의 동일 경계)
  - 상세: `stripDeep` 은 depth 10 을 넘으면 서브트리를 그대로 반환한다(strip 하지 않음). 이게
    안전한 이유는 오직 `stripExternalOnlyFields` 가 항상 `sanitizePayloadForWs` 를 먼저 거친
    `wireEnvelope` 에만 호출돼(`:524`, `:595`), depth 10 을 넘는 자리는 이미 `'[REDACTED_DEPTH]'`
    문자열로 치환된 뒤이기 때문이다. `stripDeep` 자체는 이 전제를 강제하지 않는다. 이번 라운드는
    이 우려를 **실행으로 검증**했다 — `websocket.service.spec.ts:834` 부근의
    `it.each([0, 5, 8, 9, 10, 11, 12])('depth %i 의 llmCalls raw 내용이 외부 fanout 에 남지 않는다', …)`
    가 실제 `service.emitExecutionEvent` 를 호출해 깊이별 마커가 외부 fanout 에 노출되지 않음을
    확인했고, 판별력까지 측정해(no-op 뮤턴트에서 depth 0·5 는 RED, depth 8 이상은 `sanitizePayloadForWs`
    가 먼저 막아 판별력이 없다는 사실도 JSDoc/테스트 주석에 명시했다). 경계 연산자도 형제 함수와
    `>` 로 통일돼 이전 라운드에서 지적된 리뷰어 간 결론 불일치(`11_02_16` CRITICAL 1)가 해소됐다.
  - 제안: 조치 불필요 — 실측으로 안전이 확인됐고 회귀 테스트로 고정됐다. 다만 이 설계는 여전히
    "함수 자신의 방어가 아니라 호출 순서의 방어" 라, 향후 `stripDeep`/`stripExternalOnlyFields` 가
    sanitize 를 거치지 않은 원본 payload 에 재사용되는 새 호출부가 생기면 이 보호가 조용히
    사라진다는 점은 유지보수 시 유념할 사항으로 남겨둔다(이미 JSDoc `:360-365` 에 명시돼 있음).

- **[INFO]** `__proto__` 프로토타입 오염(CWE-1321) 취약점은 이전 라운드에서 발견·수정·검증 완료 —
  현재 상태에서 재확인
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:406-426` (`stripDeep` object 분기)
  - 상세: 초판(`81f2c60d6`)은 `out = {}` + `out[k] = v` bracket 대입이라, `JSON.parse` 로 만들어진
    own `__proto__` 키를 만나면 값이 조용히 사라지거나(own property 로 안 남음) 반환 객체의
    프로토타입이 갈아쳐지는 결함이 있었다(`10_32_27` security W1). 현재 구현은 `out ??= { ...obj }`
    (스프레드가 `CreateDataProperty` 로 own `__proto__` 를 그대로 옮겨 상속 접근자를 가림) +
    `Object.defineProperty(out, k, {...})`(bracket 대입 대신 정의를 사용해 접근자를 타지 않음)
    이중 방어로 이 문제를 막는다(`5df89cda6`). `websocket.service.spec.ts:762`
    (`payload 에 __proto__ 키가 있어도 값 손실·프로토타입 오염이 없다`) 테스트가 값 보존 +
    프로토타입 무결성 + 전역 오염 없음을 직접 단언하며, 스프레드를 `{}` 로 되돌리는 뮤턴트에서
    RED 임이 확인됐다(판별력 실증). 코드를 직접 읽어 현재 상태에서 해당 결함이 재발하지 않았음을
    확인했다.
  - 제안: 조치 불필요. 신규 결함 없음.

- **[INFO]** 이미 나간(전송 완료된) raw 프롬프트/대화 이력 데이터에 대한 사후 대응(외부 통합자
  통지 여부 등)이 아직 미결정 상태로 plan 에 열려 있다
  - 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (`## 🔴 조사 중 발견` 절 하단
    `- [ ] **이미 유출된 데이터에 대한 사후 대응 — 운영 판단 필요.**`), `CHANGELOG.md:23-24`
    (`> 영향 범위: 이 경로로 나간 데이터는 **이미 전송된 것**이다…`)
  - 상세: 코드 수정 자체는 완료됐지만, 이 결함이 실제 운영 중 언제부터 존재했는지, 어떤
    워크스페이스가 외부 SSE 토큰/webhook/chat-channel 을 실제로 연동해 사용 중이었는지에 대한
    사후 조사·통지 판단이 아직 이뤄지지 않았다. 코드 리뷰 관점에서는 결함이 아니나, 정보 노출
    사고의 사후 대응이 "운영 판단 필요" 로 명시적으로 추적되고 있다는 점은 보안 리뷰 기록으로
    남겨둔다(누락되지 않고 plan 에 등재된 점은 긍정적).
  - 제안: 코드 조치 불필요. 사용자/운영 측의 정책 판단 대기 — 이 PR 의 승인 여부와는 별개 사안.

## 확인했으나 문제 없음 (positive findings)

- `stripDeep`/`stripExternalOnlyFields` 는 export 되지 않는 내부 함수이고 호출부는 `emitExecutionEvent`/
  `emitNodeEvent` 2곳뿐 — 공개 API·인증/인가 경로에는 영향 없음.
- `EXTERNAL_STRIPPED_FIELDS` 는 이름 기반(위치 무관) strip 이라, 새로운 중첩 경로가 추가돼도
  `llmCalls` 라는 이름을 쓰는 한 자동으로 보호된다 — 이번 결함(위치 기반 depth-1 strip 이 새
  중첩 경로를 놓친 것)과 같은 클래스의 재발을 구조적으로 막는다.
  `input-controlled` 필드명 충돌 가능성(사용자 노드 출력이 우연히 `llmCalls` 필드를 가지면 함께
  strip 됨)은 이전 라운드에서 이미 INFO 로 검토·수용됐다(collateral 없음 확인 완료).
- 하드코딩된 시크릿·API 키·자격증명은 이번 diff 전체(코드 + 문서)에서 발견되지 않음.
- SQL/명령/경로 인젝션, XSS, 인증/인가 우회와 관련된 코드 경로 변경 없음 — 순수 payload 정제
  로직 리팩터 + 테스트 추가.
- 에러 메시지에 민감 정보를 노출하는 신규 코드 없음.
- 신규/변경된 외부 의존성 없음.

## 요약

이번 라운드는 신규 보안 결함이 없다. 핵심 보안 수정(`llmCalls` depth-무관 strip)은 이미 완료돼
있고, 그 수정 자체가 만들었던 두 개의 후속 결함 — `__proto__` 프로토타입 오염(CWE-1321)과
깊이 경계 연산자 불일치로 인한 리뷰어 간 불확실성 — 도 모두 조치 완료 상태이며, 두 결함 모두
"수정했다"는 서술이 아니라 뮤테이션 테스트·실 파이프라인 깊이 sweep 이라는 실행 증거로 검증돼
있다(코드를 직접 읽어 재확인함). 남은 항목은 (1) 깊이 상한이 여전히 호출 순서에 암묵적으로
의존한다는 설계상 결합(이미 문서화·테스트로 방어됨, 신규 호출부 추가 시 재검토 필요) 과
(2) 이미 전송된 데이터에 대한 사후 대응이 아직 운영 판단 대기 상태라는 것뿐이며, 둘 다 이미
plan/JSDoc 에 정확히 기록돼 추적되고 있다. `plan/**`·`review/**` 신규 문서 파일들에서 하드코딩된
시크릿이나 민감정보 노출도 없었다.

## 위험도

LOW
