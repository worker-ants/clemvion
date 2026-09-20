# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-integration-error-facts.md`

## 발견사항

- **[WARNING]** 리다이렉트 홉 SSRF 가드 고장이 `HTTP_TRANSPORT_FAILED` 로 라우팅된다는 새 서술이, 그 코드를 "정상적인 third-party 실패" 로 이미 분류해 둔 다른 영역의 사용자 메시징 규약과 충돌한다
  - target 위치: 변경안 ②, `1-http-request.md §4 step 8` 끝에 추가되는 문장 — "step 9 의 리다이렉트 홉에서 같은 고장이 나면 전송 catch 로 떨어져 `HTTP_TRANSPORT_FAILED` 가 된다"
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md §3.1` "카테고리 매핑" 표 (line 498: `HTTP_TRANSPORT_FAILED` → `executionFailedThirdParty`) + `spec/5-system/15-chat-channel.md` §"언어 힌트" (`executionFailedThirdParty` 의 사용자 문구 = "외부 서비스 응답을 받지 못했습니다" / "Couldn't reach the external service")
  - 상세: 이 draft 는 "가드 자체의 고장"(우리 SSRF 가드 코드의 버그)과 "차단 판정"(정상 동작)을 구분하는 것이 핵심 취지다. HTTP preflight(step 8) 의 가드 고장은 신중하게 `INTEGRATION_CALL_FAILED` 로 라우팅해 "차단됐다" 는 거짓 신호를 피한다. 그런데 리다이렉트 홉(step 9) 의 **동일한 가드 고장**은 "전송 catch" 로 떨어져 `HTTP_TRANSPORT_FAILED` 가 되고, 이 코드는 `chat-channel-adapter.md §3.1` 에서 이미 `executionFailedThirdParty` 로 분류되어 있다 — 즉 챗 채널 사용자에게 "외부 서비스에 문제가 있다" 고 안내한다. 실제로는 **우리 쪽 SSRF 가드가 고장 난 것**이지 외부 서비스 문제가 아니므로, 이 draft 가 명시적으로 기록하려는 "가드 고장은 오분류하면 안 된다" 는 문제의식이 리다이렉트 홉 경로에서는 이미 (구현 차원에서) 위반되고 있음을 이 draft 의 새 문장이 처음으로 드러낸다. draft 는 이 결과 코드를 있는 그대로("두 시점을 통일할지는 트래커의 열린 항목") 적겠다고 명시하지만, 그 열린 항목의 서술(`비대상` 절)은 "preflight 와 리다이렉트 홉의 코드를 통일할지" 만 언급하고 챗 채널 사용자 메시지 오분류라는 **더 구체적인 파급 효과**는 언급하지 않는다. `--spec` 1차 검토가 CRITICAL 로 반증한 것과 같은 종류의 위험("아직 열려 있는 결정을 문서가 선취")은 이번엔 해소됐지만, 이 새로운 cross-spec 파급(챗 채널 오분류)은 아직 어느 문서에도 포인터가 없다.
  - 제안: `1-http-request.md` 의 새 문장 뒤 또는 `0-common.md §4.2` 의 새 구에, "리다이렉트 홉의 가드 고장이 `HTTP_TRANSPORT_FAILED` 로 합류하는 것은 챗 채널 사용자 메시지(`executionFailedThirdParty`, [`conventions/chat-channel-adapter.md §3.1`](../../spec/conventions/chat-channel-adapter.md))에서 실제로는 내부 오류를 외부 서비스 탓으로 오분류한다 — 두 시점 코드 통일 여부를 정할 때 이 파급도 함께 검토" 정도의 포인터 한 줄을 추가하거나, 트래커의 열린 항목(비대상 절이 가리키는 "preflight 와 리다이렉트 홉의 코드를 통일할지") 서술에 이 챗 채널 파급을 명시적으로 추가한다. draft 본문을 넓히지 않고 트래커에만 추가해도 된다.

- **[INFO]** MakeShop 연결 테스트가 노드 런타임과 동일한 코드(`MAKESHOP_AUTH_FAILED`)를 재사용하는 것이, 같은 문서가 세운 "연결 테스트 코드는 별도 namespace" 관례에서 유일한 비-호스트차단 예외다
  - target 위치: 변경안 ④, `2-navigation/4-integration.md §5.9` 교체 문장 — "Cafe24 가 `CAFE24_INSUFFICIENT_SCOPE` 로 가르는 자리에서 MakeShop 은 `MAKESHOP_AUTH_FAILED` 로 묶는다"
  - 충돌 대상: 같은 문서 `## Rationale` "코드 이름" 문단(§1150 부근) — 호스트 차단(`DB_HOST_BLOCKED`/`HTTP_BLOCKED`/`EMAIL_HOST_BLOCKED`)만 노드와 코드를 공유하고, 그 외 연결 테스트 코드(`DB_AUTH_FAILED`/`DB_CONNECT_FAILED`/`HTTP_AUTH_FAILED`/`HTTP_CONNECT_FAILED`/`HTTP_SERVER_ERROR`, 그리고 Cafe24 의 `CAFE24_INSUFFICIENT_SCOPE`)는 노드 런타임 코드와 분리된 전용 이름을 쓴다는 원칙 + `4-nodes/4-integration/5-makeshop.md §6` (노드 런타임 `output.error.code` 로 동일한 `MAKESHOP_AUTH_FAILED` 사용)
  - 상세: `MAKESHOP_AUTH_FAILED` 는 (a) 노드 실행 실패 시 `output.error.code` (5-makeshop.md §6), (b) 연결 테스트 `pingConnection` 의 403 분기(draft 의 실측)에서 **글자 그대로 같은 코드**로 쓰인다. 다른 모든 서비스(HTTP·DB·Cafe24)는 인증 실패류에 한해 두 층을 의도적으로 분리했는데(호스트-차단은 예외), MakeShop 만 인증 실패에도 분리하지 않는다. draft 는 사실을 정확히 기록하는 것이므로 틀린 서술은 아니지만, 이 사실이 §14.1 "에러 코드 vocabulary" 표(Cafe24/MakeShop 연결 테스트 코드는 원래 이 표에 없음)나 Rationale "코드 이름" 문단 어디에도 반영되지 않아, 다음 사람이 "연결 테스트 코드는 항상 노드 코드와 다른 namespace" 라고 그 Rationale 문단만 보고 오해할 수 있다.
  - 제안: 필수 아님 — 이번 draft 스코프(§5.9 한 문장 정정)를 넘어선다. 후속으로 Rationale "코드 이름" 문단이나 §14.1 표에 "MakeShop 은 인증 실패에도 노드/테스트 코드를 분리하지 않는다(호스트-차단과 같은 유형의 예외)" 한 구를 더할 만한 후보로 트래커에 남겨도 된다.

- **[INFO]** `5-system/3-error-handling.md §1.4` 의 "카테고리 | 코드" 공용 카탈로그가 HTTP/DB 행에 `INTEGRATION_CALL_FAILED`/`INTEGRATION_AUTH_UNSUPPORTED`/`INTEGRATION_INCOMPLETE` 를 신설하지 않아, 이번에 §4.2·§6.2·§14.1 세 곳에 채워 넣는 트리거 상세가 이 네 번째 카탈로그에는 여전히 없다
  - target 위치: 변경안 ②③ 전체 — `0-common.md §4.2`, `1-http-request.md §6`, `2-database-query.md §6.2`, `2-navigation/4-integration.md §14.1` 네 곳을 갱신
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.4 "노드 수준 런타임 에러" 표 — HTTP 행(`HTTP_TRANSPORT_FAILED`·`HTTP_4XX`·`HTTP_5XX`·`HTTP_TIMEOUT`·`HTTP_BLOCKED`)과 Database 행(`DB_QUERY_FAILED`·`DB_CONNECTION_ERROR`·`DB_CONSTRAINT_VIOLATION`·`DB_PERMISSION_DENIED`·`DB_HOST_BLOCKED`)에 `INTEGRATION_*` 계열이 아예 없다 (Email 행만 `details.integrationCode` 로 언급)
  - 상세: 이 표는 "주요 항목" 이라고 스스로 밝히는 비-망라 카탈로그라 직접 모순은 아니다. 다만 이 draft 가 4 개 문서(0-common·http-request·database-query·navigation)에 걸쳐 `INTEGRATION_CALL_FAILED`/`INTEGRATION_AUTH_UNSUPPORTED` 서술을 촘촘히 채우는데, 정작 "공용 카탈로그" 를 표방하는 다섯 번째 문서는 그대로 남아 격차가 더 도드라진다.
  - 제안: 이번 draft 스코프 밖(spec_impact 네 파일에 이 파일이 없다) — 반영하지 않아도 BLOCK 사유는 아니다. 트래커에 "5-system/3-error-handling.md §1.4 HTTP/DB 행에 INTEGRATION_* 계열 추가" 후속 항목으로 남기는 정도면 충분하다.

## 요약

이 draft 가 손대는 네 파일(spec_impact) 자체의 내부 정합은 `--spec` 1·2차에서 이미 CRITICAL 0·WARNING 0 으로 수렴했고, 오늘 재확인한 범위에서 데이터 모델·API 계약·요구사항 ID·RBAC·계층 책임 축에는 새로운 충돌이 없다. 유일하게 실질적인 cross-spec 파급은 상태 전이/에러 코드 축에서 나왔다 — 변경안 ②가 정확하게 기록하는 "리다이렉트 홉의 SSRF 가드 고장 → `HTTP_TRANSPORT_FAILED`" 사실이, 그 코드를 이미 "정상적인 외부 서비스 실패" 로 분류해 사용자에게 노출하는 `conventions/chat-channel-adapter.md`·`5-system/15-chat-channel.md` 의 기존 규약과 부딪힌다 — 내부 결함이 사용자에게 "외부 서비스 문제" 로 오안내되는 경로가 이 draft 를 계기로 처음 문서 표면에 드러난다. 이는 구현이 이미 그렇게 동작하는 사실이라 draft 자체를 막을 이유는 아니지만, 트래커의 "두 시점 코드 통일" 열린 항목에 이 파급을 명시해 두지 않으면 다음 사람이 그 결정을 좁게(코드 이름 통일 여부만) 내릴 위험이 있다. 나머지 두 개는 INFO 수준 — MakeShop 의 테스트/런타임 코드 미분리, `5-system/3-error-handling.md` 카탈로그의 사전 비대칭 — 이며 이번 반영을 막을 사유는 아니다.

## 위험도

LOW
