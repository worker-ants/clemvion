# 정식 규약 준수 검토 — `spec/5-system` (--impl-prep)

검토 대상: `spec/5-system` 전체(번들). Context 예산 초과로 `spec/5-system/1-auth.md`·
`2-api-convention.md`·`3-error-handling.md` 3개 파일만 프롬프트에 전문이 포함됐고 나머지
15개 시스템 문서(`4-execution-engine.md`·`6-websocket-protocol.md`·`14-external-interaction-api.md`
등)와 `spec/conventions/**` 292개 중 286개(대부분의 cafe24/makeshop 카탈로그 제외 실질 규약
문서 다수 포함)는 프롬프트에서 생략됐다. 본 검토는 프롬프트 생략분 중 대상 문서와 직접
연관된 핵심 규약(`error-codes.md`·`swagger.md`·`redis-keys.md`·`node-output.md`·
`audit-actions.md`)을 `Read` 로 직접 열어 보강했으나, 15개 시스템 문서 본문 전체를 직접
열람하지는 못했다 — 아래 "위험도"에 이 한계를 반영한다.

## 발견사항

### [WARNING] 워크스페이스 멤버 삭제 에러 코드 `CANNOT_REMOVE_OWNER` 가 중앙 에러 카탈로그에 미등재
- target 위치: `spec/5-system/1-auth.md` §3.2 각주("† Admin 멤버 삭제의 대상 제약")
- 위반 규약: `spec/5-system/2-api-convention.md` §5.3 "어느 쪽을 택하든 [에러 처리 §1] 카탈로그에
  등재한다. 등재되지 않은 코드는 소비자가 존재를 알 방법이 없다."
- 상세: `1-auth.md` §3.2 각주가 `CANNOT_REMOVE_OWNER` 코드를 명시적으로 언급하지만,
  `3-error-handling.md` §1(전체 700줄 grep 결과 0건) 어디에도 이 코드가 등재돼 있지 않다.
  같은 문서의 다른 워크스페이스 관련 코드(`NOT_A_MEMBER`·`ADMIN_REQUIRED`·`ALREADY_A_MEMBER`·
  `CANNOT_ASSIGN_OWNER`·`WORKSPACE_TYPE_MISMATCH`)는 모두 §1.2/§1.9 에 "도메인 spec 참조"
  패턴으로 포인터 행이 있는데, `CANNOT_REMOVE_OWNER` 만 이 패턴에서 빠져 있다.
  다만 `3-error-handling.md` 하단 Rationale(§1.9 후속, "그 외 workspace role/membership
  관리 코드(`SOLE_OWNER_CANNOT_LEAVE` 등)는 별도 pass")이 유사한 owner-보호 계열 코드를
  이미 추적 중인 부채로 인정하고 있어, 완전히 방치된 누락이라기보다는 **알려진 미완결 항목**에
  가깝다.
- 제안: `3-error-handling.md` §1.2 또는 §1.9 계열에 `CANNOT_REMOVE_OWNER` (403) 포인터 행을
  추가하거나, 위 Rationale 의 "별도 pass" 대상 목록에 이 코드를 명시적으로 포함시켜 추적
  누락이 없도록 한다. 코드·규약 자체 변경은 불필요 — 등재만 하면 되는 정도의 gap 이다.

### [WARNING] 프롬프트 context 예산 초과로 `spec/5-system` 15개 문서·`spec/conventions` 대다수가 검토 대상에서 생략됨
- target 위치: 조립 프롬프트 전체(`spec/5-system` 번들 섹션과 `spec/conventions/` 번들 섹션)
- 위반 규약: 해당 없음(도구/오케스트레이션 한계) — 다만 이전 프로젝트 이력에서 동일 클래스의
  문제(consistency `--spec` 기본 예산이 conventions 를 통째로 떨구는 현상)가 이미 지적된 바 있다.
- 상세: `spec/5-system` 18개 파일 중 `1-auth.md`·`2-api-convention.md`·`3-error-handling.md`
  3개만 전문이 실렸고 나머지 15개(`4-execution-engine.md`(227,815자)·
  `14-external-interaction-api.md`(134,242자)·`15-chat-channel.md`(97,171자) 등 대형 문서
  포함)는 "본문 생략됨 — 컨텍스트 예산 초과"로 대체됐다. `spec/conventions/` 는 292개 중
  단 6개(그중 실제 유의미한 것은 `audit-actions.md`·`cafe24-api-catalog/_overview.md`·
  `cafe24-api-catalog/category.md` 3개뿐)만 전문이 실렸고, `error-codes.md`·`swagger.md`·
  `redis-keys.md`·`node-output.md`·`execution-context.md`·`egress-masking.md`·
  `conversation-thread.md`·`chat-channel-adapter.md`·`interaction-type-registry.md`·
  `secret-store.md` 등 명명·출력 포맷 규약 검토에 핵심적인 문서 대부분이 생략됐다.
  본 검토는 이 중 `error-codes.md`·`swagger.md`·`redis-keys.md`·`node-output.md`·
  `audit-actions.md` 5개를 `Read` 로 직접 열람해 보강했으나, `spec/5-system` 의 15개
  생략 문서(특히 대상 영역 안에 있는 `4-execution-engine.md`·`6-websocket-protocol.md`·
  `14-external-interaction-api.md`·`12-webhook.md`·`15-chat-channel.md`)는 본 세션에서
  전문을 읽지 못했다 — 이들 문서 내부의 명명·출력 포맷 규약 위반은 이번 패스로 발견되지
  않았을 수 있다.
- 제안: (a) 이 caveat 자체를 알리는 것이 이 finding 의 목적이다 — "생략됐다는 사실을
  해당 내용이 없다는 근거로 삼지 말라"는 프롬프트의 지시를 이 보고서에도 명시해 통합
  SUMMARY 가 "convention_compliance 검토 완료 = 15개 생략 문서까지 클린" 으로 오독하지
  않게 한다. (b) 재발 방지 관점에서는 `spec/5-system` 처럼 개별 파일이 큰 영역은 파일
  단위로 청크를 나눠 별도 세션으로 처리하는 것이 근본 해법이나, 이는 orchestrator/prompt
  조립 로직의 개선 사항이다.

## 확인된 준수 사항 (참고 — 발견사항 아님)

아래는 전문을 확인한 3개 문서에서 규약 위반이 **없음**을 확인한 항목이다. 감점 요소는
아니지만 검토 범위를 명확히 하기 위해 기록한다.

- **에러 코드 명명**: `1-auth.md`·`3-error-handling.md` 전체에서 신규/구현 코드는 모두
  `UPPER_SNAKE_CASE` (`error-codes.md` §1 준수). 초대 흐름의 `lower_snake_case` 6종
  (`invitation_not_found` 등)은 `error-codes.md` §3 historical-artifact 레지스트리에
  정확히 등재된 예외이며, `1-auth.md` §1.5.4 의 각주가 그 레지스트리를 정확히 인용한다.
- **감사 액션 명명**: `1-auth.md` §4.1 이 나열한 모든 액션(`integration.*`·`workspace.*`·
  `member.*`·`auth_config.*`·`user.*`·`workflow.*`·`trigger.*`·`schedule.*`·
  `model_config.*`)이 `audit-actions.md` §3 도메인별 분류 레지스트리와 1:1 로 일치한다
  (verb 시제 분류·언더스코어 토큰 구분자 포함).
- **응답 봉투/부재 표현**: `1-auth.md` 의 엔드포인트 응답 예시(`{ data: { items: [...] } }`
  비-페이징 고정 컬렉션, `{ enabled: boolean }` 논리 payload 표기)가 `2-api-convention.md`
  §5.2/§5.4 의 규칙과 일치하고, 표기 방식 차이(논리 payload vs wire 전체)에 대해 문서
  스스로 "논리 payload 표기로 통일한다"고 명시해 오독 여지를 없앴다.
- **410 명시 의무**: `1-auth.md` §1.5.4 의 두 `410` 행(`invitation_expired`·
  `invitation_already_used`) 모두 코드를 명시하고 있어 `2-api-convention.md` §5.3 의
  "410 은 기본값이 없으므로 명시 의무" 요구를 충족한다.
- **URL/자원 액션 명명**: `1-auth.md` §5 의 엔드포인트 전부가 `2-api-convention.md` §2.2 의
  "인증 상태 전이·capability 액션" 예외 또는 "자원 액션"/RPC-style 예외 패턴에 부합한다.

## 요약

전문이 제공된 3개 핵심 시스템 문서(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`)는
명명 규약(에러 코드 UPPER_SNAKE_CASE·감사 액션 taxonomy)·출력 포맷 규약(응답 봉투·페이지네이션·
null-vs-키-생략)·문서 구조 규약(Overview/본문/Rationale)을 모두 정확히 준수하고 있으며, 규약과의
경계·예외 사유를 문서 스스로 상세히 근거를 남기는 등 규약 준수 성숙도가 높다. 유일한 실질
위반은 `CANNOT_REMOVE_OWNER` 에러 코드의 중앙 카탈로그 미등재(WARNING, 이미 알려진 부채와
동일 계열)이며, 그 외에는 이번 조립 프롬프트가 `spec/5-system` 15개 문서와 `spec/conventions`
대다수를 context 예산 초과로 생략한 탓에 이 패스가 커버하지 못한 영역이 크다는 점이
가장 중요한 caveat 이다.

## 위험도

LOW
