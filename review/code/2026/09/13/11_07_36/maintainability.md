# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 동일한 사실("`latencyMs` 는 생산자 0건")에 대한 서술이 CHANGELOG 와 두 DTO 소스 파일에 걸쳐 사실상 반복(triplicate) 된다
  - 위치: `CHANGELOG.md:25`, `CHANGELOG.md:31` / `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:460-462` / `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:53-56`
  - 상세: "`latencyMs` 는 한 번도 발행되지 않았다(생산자 0건, 실측)"라는 동일한 사실이 CHANGELOG 항목 2곳과 두 DTO 파일의 인라인 주석 각각에 거의 같은 문장으로 다시 쓰여 있다. 사실 관계 자체는 정확하고 근거(실측)도 명시돼 있어 당장 오독을 유발하진 않지만, 이후 이 필드에 대한 이해가 바뀌거나(예: 다시 생산자가 생기는 경우) 정정이 필요해지면 최소 3곳(잠재적으로 `plan/in-progress/guide-error-code-truth.md` 포함 4곳)을 찾아 동기화해야 한다 — 코드 주석의 "why" 서술이 CHANGELOG 서술과 완전히 다른 매체임에도 내용이 복제된 형태다.
  - 제안: DTO 소스 주석은 "왜 제거했는가"의 1~2줄 요약("생산자 0건, 실측 — 상세는 CHANGELOG Unreleased 참조" 류)만 남기고, 조사 과정의 상세 서술(대조표·재발견 경로 등)은 CHANGELOG/plan 쪽 한 곳으로만 유지하는 편이 향후 동기화 비용을 줄인다. (다만 이 저장소의 다른 DTO — 예 `chat-channel-rotate-bot-token-response.dto.ts` — 도 유사하게 서술형 주석을 다는 관례가 이미 있어, 이 자체가 규약 위반은 아니다.)

- **[INFO]** `TestConnectionResultDto`(integrations)와 `ModelTestConnectionResultDto`(model-config) 두 DTO가 거의 동일한 shape(`success` / `message?` / 부가 필드)을 독립적으로 유지하고 있고, 이번 PR이 그 대가(shotgun surgery)를 실제로 치렀다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:456` (`export class TestConnectionResultDto`), `codebase/backend/src/modules/model-config/dto/responses/model-config-response.dto.ts:49` (`export class ModelTestConnectionResultDto`)
  - 상세: 두 DTO 모두 동일한 "유령 필드"(`latencyMs`, 생산자 0건)를 갖고 있었고, 이번 PR의 주석이 스스로 명시하듯("한쪽만 고치면 같은 거짓 광고가 남는다") 두 파일을 동시에 고쳐야 했다. 이는 공통 shape 을 추출하지 않은 구조적 결과이며, 다음에 같은 클래스의 결함(예: 새 옵셔널 필드를 한쪽에만 추가)이 생겨도 정적 도구가 자동으로 잡아주지 못하고 사람이 "자매 DTO도 같이 봐야 한다"는 것을 기억해야 한다. 두 엔드포인트가 별도 모듈 소유라는 점에서 완전한 통합이 항상 정답은 아니지만(프로젝트 메모에도 유사 사례에 대해 "의도된 분리 가능성" 언급이 있음), 반복이 이미 2회(구조적 유사성 + 이번 동시 결함) 관측됐다는 점은 기록해 둘 가치가 있다.
  - 제안: 즉시 통합을 요구하지는 않되, 세 번째로 같은 클래스의 결함(둘 중 하나만 고쳐서 재발)이 나오면 공용 `ConnectionTestResultDto` 베이스 도입을 검토할 근거로 삼을 것. (동일 관측이 `architecture.md`에도 있어 중복 지적일 수 있으나, 유지보수성 관점에서도 별도로 기록해 둔다.)

- **[INFO]** DTO 파일 내 필드 선언 대비 주석 비율이 매우 높아, "이 응답의 실제 shape이 무엇인가"를 한눈에 파악하기 어렵다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:456-489` (`TestConnectionResultDto` 전체 — 필드 3개에 주석 약 25줄)
  - 상세: `success` / `code` / `message` 세 필드만 있는 클래스에 조사 경위·반증 이력·후속 항목 위치("한쪽만 고치면…", "이 필드를 찾은 경로를 적어 둔다…")까지 담은 서술형 주석이 필드 선언보다 훨씬 길다. 근거를 남기는 것 자체는 이 프로젝트의 관례(Rationale 섹션 등)와 맞지만, DTO 소스 파일은 "이 응답이 무엇을 담는가"를 빠르게 확인하는 참조 지점이기도 해서, 처음 이 파일을 여는 사람은 실제 타입 정의를 찾기 위해 여러 문단의 조사 로그를 지나쳐야 한다.
  - 제안: 급하지 않음 — 다만 다음에 이 DTO를 다시 만질 일이 있으면, 조사 서술은 plan/CHANGELOG로 옮기고 소스에는 "무엇을·왜"를 1~3줄로 압축하는 정리를 함께 고려할 것.

- **[INFO]** `guide-sanitized-message-parity.test.ts`가 마크다운 표 행을 정규식으로 추출하는 로직을, 자매 `guide-error-code-scan.ts`의 `codeTableRows`/`TABLE_HEADER_WITH_CODE`와 별도로 새로 작성했다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:53` (`text.matchAll(/^\|\s*([A-Z][^|]*?\.)\s*\|/gm)`)
  - 상세: 두 파일 모두 "MDX 표의 특정 열을 정규식으로 걷는다"는 같은 기법을 쓰지만, 하나는 헤더로 코드 열을 식별하고 다른 하나는 셀 값의 형태(대문자로 시작해 마침표로 끝남)로 식별해 셀 선택 기준이 다르다. 지금은 각각의 판정 축이 명확히 다르므로 억지로 공유 유틸을 만들 필요는 없어 보이지만, "MDX 표 파싱"류 가드가 세 번째로 늘어나면 공통 헬퍼(`tableRows(lines, headerPredicate)` 류) 추출을 검토할 시점이라는 신호로 기록해 둔다.
  - 제안: 지금 당장의 조치는 불필요. 세 번째 유사 가드가 추가되는 시점에 공통화 검토.

## 긍정적으로 확인한 사항 (참고)

- `guide-error-code-scan.ts`는 순수 함수(`scanErrorCodeCitations`/`collectBackendTokens`)로 판정 로직을 분리하고, 그 판정을 실제로 사용하는 `guide-error-code-existence.test.ts`와 책임이 명확히 나뉘어 있다. 세 개의 정규식 축(`FIELD_TABLE_NAME`/`CODE_FIELD`/`PROSE_BACKTICK`) 각각에 대해 "왜 이 형태로 좁혔는가"를 실측 표로 남긴 주석은 향후 이 술어를 넓히거나 좁힐 때 근거를 재현하지 않아도 되게 해 준다.
- 신규 테스트들의 vacuity floor(예: `mdxFiles.length > 50`, `backendTokens.size > 800`, `byAxis(...) > N`)는 임계값이 매직 넘버로 방치되지 않고 실측값(`// 실측 92`, `// 실측 1743종` 등)과 함께 주석돼 있어, 왜 그 숫자인지 다음 사람이 추적할 필요가 없다 — 이 checklist의 "매직 넘버" 항목 기준으로 모범적인 처리다.
- `llm.service.ts`의 `testConnection` 필드 리네임(`error`→`message`)은 함수 자체의 구조·분기·중첩을 전혀 바꾸지 않고 반환 타입과 반환문 두 곳만 손댄 최소 변경이라 리뷰 부담이 낮다.

## 요약

이번 변경의 핵심(서비스/DTO/프런트엔드 필드명 통일, `latencyMs` 유령 필드 제거, 신규 `guide-error-code-existence`/`guide-sanitized-message-parity` 가드)은 대부분 국소적이고 함수 길이·중첩 깊이·순환 복잡도 측면에서 문제가 될 만한 변경이 없다. 신규 스캐너 모듈은 순수 함수 분리와 실측 기반 매직 넘버 문서화가 잘 되어 있어 오히려 모범 사례에 가깝다. 다만 (1) 동일한 "생산자 0건" 서술이 CHANGELOG와 두 DTO 소스에 반복돼 있어 향후 정정 시 동기화 비용이 있고, (2) 구조적으로 유사한 두 연결-테스트 DTO가 이번에도 같은 결함(유령 필드)을 각자 겪어 shotgun-surgery 위험이 실증됐다는 점은 기록해 둘 가치가 있다. 둘 다 즉시 차단할 사유는 아니며 정보성 관찰에 가깝다.

## 위험도

LOW
