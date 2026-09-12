# 정식 규약 준수 검토 — spec-draft-setup-error-classification.md

## 발견사항

- **[WARNING]** `2-api-convention.md §6` 신규 502 행이 인접 행의 "코드 + 링크" 서술 패턴을 따르지 않음
  - target 위치: 결정 (4) — "추가할 행" 코드블록 (`| 502 | Bad Gateway | **외부 제3자 API** 호출 실패 …`)
  - 위반 규약: `spec/5-system/2-api-convention.md §6` 상태 코드 표의 기존 관행 (도메인-특정 상태코드 행은 구체 `error.code` 값 + SoT 링크를 명시 — `410`행: "코드 `TRIGGER_INACTIVE`/`EXECUTION_TERMINATED`/…", `413`행: "코드 `PAYLOAD_TOO_LARGE`", `503`행: "코드: `SERVER_SHUTTING_DOWN`·`EXECUTION_ENQUEUE_FAILED` — [error-handling §1.5](...)")
  - 상세: `503` 행(바로 위 이웃)은 "코드: X·Y — [link]" 형식으로 어느 `error.code` 가 이 상태를 쓰는지, 어느 도메인 spec 이 SoT 인지 명시한다. 초안이 준비한 `502` 행 텍스트는 "외부 제3자 API 호출 실패"라는 서술만 있고 `CHAT_CHANNEL_SETUP_FAILED` 코드명도, `15-chat-channel.md §5.4` 링크도 없다. `502` 는 저장소 최초 사용이라 사용처가 chat-channel 하나뿐인데도 그 연결이 표에서 끊긴다.
  - 제안: 실제 편집 시 `503` 행과 같은 형식으로 "코드: `CHAT_CHANNEL_SETUP_FAILED` — [15-chat-channel §5.4](./15-chat-channel.md#54-bot-token-rotation-api-응답-계약)" 를 덧붙인다.

- **[WARNING]** 체크리스트 (4-b) 의 "5xx 행" 표현이 `swagger.md §2-4` 표의 "행 = 단일 구체 상태코드" 관행과 어긋남
  - target 위치: 체크리스트 `- [ ] (4-b) conventions/swagger.md §2-4 에 5xx 행 신설`
  - 위반 규약: `spec/conventions/swagger.md §2-4` 데코레이터 표 — 기존 8개 행이 전부 `200`/`201`/`204`/`400`/`401`/`403`/`404`/`409` 처럼 **단일 구체 코드** 단위다. 범위(`4xx`/`5xx`)로 묶은 행은 하나도 없다.
  - 상세: 실제로 신설해야 할 것은 `@ApiBadGatewayResponse` 하나(= `502` 전용)인데, 체크리스트 라벨이 "5xx 행"이라 다음 사람이 여러 5xx 를 한 행으로 뭉치거나 `500`/`503` 까지 포함해야 하는지 오독할 여지가 있다. `500`/`503` 은 현재 swagger.md 표에 아예 없고(그 상태들은 `GlobalExceptionFilter` 가 컨트롤러 데코레이터 없이도 처리) 이번 결정의 범위도 아니다.
  - 제안: 체크리스트 문구를 "502 행 신설(`@ApiBadGatewayResponse`)"로 좁혀 범위 오독을 막는다.

- **[WARNING]** 신규 미구현 계약(`code` 프로퍼티) 도입에도 `chat-channel-adapter.md` frontmatter `pending_plans:` 갱신이 체크리스트에 없음
  - target 위치: 체크리스트 전체 (frontmatter 갱신 항목 부재) / 결정 (2) · "구현 위임" §1~4
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1`·§3 — `status: partial` spec 은 "미구현 surface 를 책임지는 plan 경로"를 `pending_plans:` 에 의무 등재한다.
  - 상세: `chat-channel-adapter.md` 는 현재 `status: partial` 이고 `pending_plans:` 에 discord-gateway·slack-socket-mode·visual-ssr-png 3건이 이미 등재돼 있다. 이 draft 는 §1.1.2 를 신설해 "setupChannel 등이 `code: 'BOT_TOKEN_INVALID'` 를 던진다"는 **새 인터페이스 계약**을 스펙에 적는데, "구현 위임" 절이 스스로 인정하듯 이 계약은 **3개 adapter 전부 미구현**이고 developer 후속 턴으로 명시 위임돼 있다(`slack.adapter.ts`/`discord.adapter.ts`/`telegram.adapter.ts` 전부 항목 2~4). 즉 spec 이 약속하는 새 surface 가 머지 시점에 구현과 어긋난 상태로 남는데, 그 갭을 추적할 plan 경로가 `pending_plans:` 에 반영되지 않는다. 빌드 가드(`spec-pending-plan-existence.test.ts`)는 기존 3개 경로의 실존만 검증하므로 이 누락은 CI 를 깨지 않지만, 규약의 의도(§2.1)는 partial spec 의 모든 미구현 약속이 어떤 plan 으로 추적되는지 문서 자체에서 드러나는 것이다.
  - 제안: 체크리스트에 "chat-channel-adapter.md `pending_plans:` 에 트래커 항목(재기술된 developer 후속) 경로 추가" 를 넣거나, 그 근거가 이미 다른 trailing 트래커로 충분히 대체된다고 판단하면 그 판단을 Rationale 에 명시한다.

- **[INFO]** §7 "변경 관리"의 "모든 구체 어댑터 명세" 동시 갱신 의무와 결정 (6)/항목 6 의 선택적 처리 사이 긴장
  - target 위치: 결정 (6) 및 "구현 위임" 항목 6
  - 관련 규약: `spec/conventions/chat-channel-adapter.md §7` — "본 인터페이스 변경은 다음 두 spec 동시 갱신 의무: … `providers/<name>.md` (**모든** 구체 어댑터 명세)."
  - 상세: 이 draft 는 §1.1.2(신규 cross-provider 계약)를 위해 `providers/slack.md §3.1` 갱신은 필수로 결정했지만, `providers/discord.md`·`providers/telegram.md` §3.1 보강은 "§5.4 가 '무엇으로 알리든'이라 적으므로 필수는 아니다"로 선택 사항으로 남겼다. 문면상 §7 은 "모든" 이라 적어 세 파일 동시 갱신을 요구하는 것으로 읽힐 수 있다. 다만 같은 파일의 §1.1.1 선례(2026-09-10)도 이 조항을 적용해 텔레그램 한 파일만 갱신했으므로, 실무 해석은 "실제로 영향받는 provider 문서만"으로 보인다 — 완전한 위반으로 단정하기 어렵다.
  - 제안: 판단을 그대로 유지하려면 이 판단 근거(§7 의 "모든" 을 "영향받는 모든" 으로 읽는다는 해석)를 Rationale 에 한 줄 명시해 다음 검토자가 §7 문면과의 불일치를 재지적하지 않게 한다.

- **[INFO]** 결정 (3) 의 "§7.5.2 의 `serverDetail` 자리로" 표현이 REST 에러 봉투 필드명과 혼동 소지
  - target 위치: 결정 (3) 본문
  - 관련 규약: `spec/5-system/2-api-convention.md §5.3` 에러 응답 봉투 — `{ error: { code, message, requestId, details } }`. `serverDetail` 이라는 필드는 이 REST 봉투에 없고, `4-execution-engine.md §7.5.2` 의 클라이언트-경계 이벤트(`{code, message, serverDetail}`)에서만 쓰이는 이름이다.
  - 상세: 결정 (3) 은 "원문은 서버 로그(§7.5.2 의 `serverDetail` 자리)로"라고 적어, 서로 다른 두 표면(EIA 클라이언트-경계 이벤트 vs REST HTTP 에러 응답)의 필드명을 유비로 차용한다. "구현 위임" §1.ⓓ 가 "`details.reason` 원문 제거 + `logger.warn` 으로 이동"이라고 명확히 해 실제 위험은 낮지만, 결정 (3) 본문만 읽으면 REST 응답에 `serverDetail` 이라는 새 필드를 넣으라는 것으로 오독될 수 있다.
  - 제안: "§7.5.2 와 같은 원칙(클라이언트엔 고정 문구, 원문은 서버측 전용)"처럼 필드명 차용 없이 원칙만 인용하도록 문구를 다듬는다.

## 준수 확인 (긍정 소견)

- `R-CC-23`/`R-CCA-9` 넘버링 — 실측대로 `R-CC` 최대 `22`(`R-CC-14` 결번 확인), `R-CCA` 최대 `8` 이라 다음 번호가 정확히 맞물린다. 두 파일의 "Rationale ID 컨벤션" 섹션이 요구하는 `R-CC-N`/`R-CCA-N` prefix 규칙, cross-file 인용 시 `[CCA §R-CCA-N]` 형식 요구도 체크리스트 (3) 에서 명시적으로 이행 대상으로 잡혀 있다.
- 에러 코드 명명 — `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 모두 기존 코드를 rename 하지 않고 그대로 재사용한다. `error-codes.md §2` 의 "이름 정확성 향상만을 위한 rename 은 하지 않는다"를 위반하지 않는다.
- `@ApiBadGatewayResponse` — `@nestjs/swagger` 에 실재하는 데코레이터이며(`ApiBadRequestResponse` 등과 동형 명명), swagger.md §2-4 의 "상태 → `Api<Status>Response`" 명명 패턴을 그대로 따른다.
- REST 에러 봉투 형식 — `translateSetupChannelError` 가 던지는 flat `{code, message, details}` 는 `GlobalExceptionFilter`(`http-exception.filter.ts`)가 `resp.code` 직접 인식 경로로 처리해 최종 `{error:{code,message,requestId,details}}` 봉투(§5.3)를 그대로 만든다 — 502 도입이 이 경로를 새로 타는지 실측 확인을 "구현 위임" ⓕ 에 명시적으로 남겨 둔 점도 적절하다.
- `details.reason` 제거 — `api-convention §5.4` 의 "키 생략(present-when-available)" 선례(`§5.3 details` 자체가 이미 그 선례)와 정합하며, `null` 로 비우는 대신 키 자체를 없애는 방향이 기존 관행과 어긋나지 않는다.
- `review-citations.md` — 체크리스트의 bare `hh_mm_ss`(`11_50_28`, `12_05_58`) 인용은 위반처럼 보이지만, 이 문서 자체가 `plan/**` 이라 §3 표에서 명시적으로 **적용 대상 아님**으로 제외돼 있어 실제 위반이 아니다.

## 요약

target 은 `spec/conventions/**` 의 핵심 명명·인용 규약(Rationale ID 넘버링, cross-file 인용 포맷, 에러 코드 rename 금지, review-citations 예외 범위)을 정확히 실측하고 그대로 준수하도록 설계돼 있다. CRITICAL 급 위반은 발견되지 않았다. 다만 (1) `2-api-convention.md §6`/`swagger.md §2-4` 에 신설할 502 관련 행이 이웃 행들의 "코드+링크" 서술 패턴과 "행=단일 코드" 관행에서 벗어날 소지가 있고, (2) `chat-channel-adapter.md` 가 `status: partial` 인 상태에서 아직 구현되지 않은 새 계약(§1.1.2)을 추가하면서 `pending_plans:` 갱신이 체크리스트에서 누락돼 있어 spec-impl-evidence.md 의 추적 의도와 어긋난다. 나머지는 §7 "모든 어댑터 명세 동시 갱신" 문면과의 경미한 긴장, 그리고 `serverDetail` 용어 차용의 잠재적 혼동 정도로 INFO 수준이다.

## 위험도

LOW
