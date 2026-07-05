# 문서화(Documentation) 리뷰 — SSRF 에러 메시지 일반화 (HTTP Request)

대상: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts`,
`http-request.handler.spec.ts`, `spec/4-nodes/4-integration/1-http-request.md`,
`spec/4-nodes/4-integration/2-database-query.md`, `spec/2-navigation/4-integration.md`,
`spec/5-system/2-api-convention.md`, `review/consistency/2026/07/05/12_55_17/*`(선행 impl-prep 산출물)

## 발견사항

- **[WARNING] 클라이언트-용 메시지 상수 JSDoc이 "usage 로그에도 원본 상세가 남는다"고 잘못 서술 — 실제 코드는 usage 로그도 일반화**
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts:27-33` (`SSRF_BLOCKED_CLIENT_MESSAGE` 선언 위 JSDoc)
  - 상세: JSDoc 은 "원본 상세(hostname/IP)는 `logger.warn` + usage 로그로 서버에만 남는다" 라고 명시한다. 그러나 실제 구현(같은 파일 372-380행, 397-398행, 그리고 outer catch 530-541행)은 `logUsage` 호출의 `error.message` 에 원본 `detail` 이 아니라 **일반화된 `SSRF_BLOCKED_CLIENT_MESSAGE`** 를 넣는다. 코드 인라인 주석(371-373행)은 그 이유를 정확히 설명한다 — "원본 host/IP 는 Activity 로그 API(`GET /integrations/:id/activity`)로 workspace 사용자에게 노출되므로 usage 로그 message 도 일반화한다." 즉 원본이 실제로 남는 곳은 `logger.warn`(서버 프로세스 로그) 단 한 곳뿐이며, usage 로그(Activity 로그 API 경유로 최종 사용자에게 노출 가능한 계층)에는 원본이 들어가지 않는다. 파일 최상단 JSDoc 은 인라인 주석과 모순되는 채로 남아, 이 상수를 재사용하거나 참조하는 다음 개발자가 "usage 로그를 뒤지면 원본 host 를 찾을 수 있다"고 오인할 소지가 있다(보안 인시던트 대응 시 실제로는 없는 정보를 찾아 헤매게 됨).
  - 제안: JSDoc 을 "원본 상세는 `logger.warn`(서버 프로세스 로그)에만 남는다. usage/Activity 로그는 Activity 로그 API 로 workspace 사용자에게 노출되므로 클라이언트와 동일하게 일반화한다" 로 정정. spec `1-http-request.md` §8.3 본문에도 동일 문구("원본 상세는 서버 로그(`logger.warn`)·Usage 로그에만")가 있어 함께 정정 필요(아래 별도 항목).

- **[WARNING] spec §8.3 "원본 상세는 서버 로그·Usage 로그에만" 문구가 실제 구현과 불일치 (동일 오류가 spec 에도 전파)**
  - 위치: `spec/4-nodes/4-integration/1-http-request.md:338`("**`output.error.message`** 는 … 원본 상세는 서버 로그(`logger.warn`)·Usage 로그에만 (§8.3)"), `:364`("원본 상세(hostname/IP)는 `logger.warn`(전 인증 방식 공통) + Usage 로그(integration 한정)로 서버에만 남긴다")
  - 상세: 코드 리뷰 항목 1과 동일한 근본 원인. spec 본문이 "Usage 로그에 원본이 남는다"고 두 곳(에러 코드 표 각주 + §8.3 Rationale 본문)에서 명시하지만, 실제 구현은 Usage 로그도 일반화 문구로 채운다(위 코드 위치 참조). Usage 로그는 `IntegrationsService.logUsage` 를 거쳐 workspace 사용자가 조회 가능한 Activity 로그 API 에 남으므로, 오히려 이 설계(코드)가 정보 노출 관점에서는 더 안전한 선택이며 spec 문구 쪽이 틀렸다.
  - 제안: `1-http-request.md` §6 표 각주와 §8.3 결정 문단을 "원본 상세는 `logger.warn`(서버 프로세스 로그)에만 남는다. Usage 로그(Activity 로그 API 로 workspace 사용자 노출)는 클라이언트와 동일하게 일반화한다" 로 정정. cross_spec.md WARNING #2("DB 선례가 이미 이 약속을 어긴다")가 정확히 같은 갭을 지적했음 — 이번 HTTP 구현이 그 갭을 상속하지 않고 오히려 더 안전하게(Usage 로그도 일반화) 처리했다는 점을 spec 이 반영해야 한다. `2-database-query.md` Rationale 도 같은 문구를 쓰고 있어 DB 쪽 실제 동작(§DB_HOST_BLOCKED — 원본이 애초에 폐기됨, cross_spec.md 지적)까지 함께 정합화할 필요가 있다.

- **[INFO] `1-http-request.md` §8.3 "운영 영향(breaking)" 콜아웃이 이번 변경(메시지 일반화)과 무관한 §8.2 내용의 재사용으로 보임**
  - 위치: `spec/4-nodes/4-integration/1-http-request.md:368`
  - 상세: §8.3("SSRF 차단 메시지 일반화")의 마지막 문단은 "`none`/`custom` 인증으로 사설/loopback 대상을 호출하던 기존 워크플로가 `ALLOW_PRIVATE_HOST_TARGETS=true` 설정 전까지 실패한다"는 breaking change 를 경고한다. 그러나 이 breaking 동작은 §8.2("SSRF 가드 전 인증 방식 적용", 2026-06-11)에서 이미 도입된 것이며, §8.3 자체(메시지 문자열만 일반화 + redirect-hop 오분류 정정)는 차단 여부(어떤 요청이 막히는지)를 전혀 바꾸지 않는다 — 이미 막히던 요청이 다른 문구로 막힐 뿐이다. §8.3 에 breaking 콜아웃이 있으면 독자가 "이번 변경으로 새로운 요청들이 추가로 차단되기 시작했다"고 오독할 수 있다.
  - 제안: §8.3 breaking 콜아웃을 제거하거나, "본 변경 자체는 차단 여부를 바꾸지 않으며 §8.2 breaking 변경은 그대로 유지된다(메시지 문구만 교체)"로 명확화.

- **[INFO] cross_spec.md(선행 impl-prep 검토)가 지적한 §5.3 JSON 예시 부재 갭은 부분 해소, 완전 해소는 아님**
  - 위치: `spec/4-nodes/4-integration/1-http-request.md` §6(에러 코드 표, 338행)· §5.8(323행)
  - 상세: 사전 consistency-check(`cross_spec.md` WARNING #1)는 "`HTTP_BLOCKED` 의 `output.error.message` 예시 JSON·필드 표가 §5.3 에 전혀 없다"는 갭을 지적했다. 이번 변경은 §6 표의 `HTTP_BLOCKED` 행 설명 텍스트와 §8.3 Rationale 절을 추가해 메시지 계약을 문서화했으나, 다른 에러 코드(`HTTP_4XX`/`HTTP_5XX`/`HTTP_TRANSPORT_FAILED`)가 §5 절에서 받는 것과 같은 형태의 **JSON 응답 예시 블록**은 여전히 추가되지 않았다. 텍스트 설명만으로도 계약은 명확하지만, 다른 케이스와의 문서 형식 일관성 관점에서는 여전히 다소 비대칭이다.
  - 제안: 필수는 아니나, §5 절 어딘가(또는 §5.8)에 `HTTP_BLOCKED` 케이스의 `output.error` JSON 예시(`{ "code": "HTTP_BLOCKED", "message": "Request blocked by SSRF policy." }`) 한 블록을 추가하면 형식 일관성이 완전해진다.

- **[INFO] `spec/2-navigation/4-integration.md` 에러 코드 vocabulary 표는 이번 diff 로 갱신되어 cross_spec.md WARNING #3 갭 해소**
  - 위치: `spec/2-navigation/4-integration.md:1044-1045`
  - 상세: 확인 결과 `HTTP_BLOCKED` 행에 "(메시지는 host/IP 미포함 일반화)" 각주와 "redirect 대상·한도 초과 SSRF 포함" 문구가 정확히 추가되어, 선행 cross_spec 검토가 지적한 DB/HTTP 행 비대칭이 해소됨. 별도 조치 불필요 — 정상 반영 확인 목적의 기록.

- **[INFO] `spec/4-nodes/4-integration/2-database-query.md` Rationale 의 "follow-up" → "완료" 갱신 확인**
  - 위치: `spec/4-nodes/4-integration/2-database-query.md:1132-1138`
  - 상세: 확인 결과 "동일 원칙을 HTTP/Email SSRF 메시지 일반화 follow-up 과 공유한다"는 예고 문구가 "HTTP Request(`HTTP_BLOCKED`)도 2026-07-05 동일 일반화 완료"로 정정되고 `1-http-request.md#83-...` 로 cross-reference 링크가 걸림. cross_spec.md WARNING #1 (b) 항목 정상 이행 확인.

- **[INFO] 테스트 파일 인라인 주석은 정확하고 신규 케이스(redirect SSRF)도 목적 설명 포함**
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts:36, 46, 56-59, 68-69, 73-75`
  - 상세: 신규/변경 단언 각각에 "정찰 면 축소 — host/IP 미노출 일반화 문구" 주석이 붙어 변경 의도가 명확하다. 신규 redirect 케이스(73행)도 "start = 공인 IP → 302 → internal IMDS. manual redirect follow 가 각 hop 을 재검증하므로 redirect 대상 SSRF 차단도 HTTP_BLOCKED 로 라우팅"이라는 배경 설명이 있어 왜 이 테스트가 필요한지 이해하기 쉽다. 조치 불필요.

- **[INFO] `2-api-convention.md` diff는 SSRF 작업과 무관한 앵커 오타 수정**
  - 위치: `spec/5-system/2-api-convention.md:1584, 1733`
  - 상세: `#비-페이징-고정-컬렉션은-datitems-유지-...` → `#비-페이징-고정-컬렉션은-dataitems-유지-...` 오타 정정(마크다운 앵커 slug 오류 수정으로 보임, `data`→`dataitems`). 이번 SSRF 작업과 관련 없는 별도 수정이나 정확성 향상이므로 문제 없음 — 커밋 메시지/PR 설명에 스코프 외 변경으로 언급해 두면 리뷰 혼선을 줄일 수 있다(선택).

## 요약

이번 변경은 spec(§8.3 Rationale, §6 에러 코드 표, 2-navigation vocabulary 표, DB 문서 cross-reference)까지 폭넓게 동기화하며 선행 consistency-check(cross_spec.md)가 지적한 두 갭 중 문서화 갭(WARNING #1)을 대부분 해소했다. 다만 cross_spec.md 가 지적한 두 번째 WARNING("원본 상세는 Usage 로그에도 남는다"는 문서화된 전제가 실제로는 지켜지지 않음)은 이번 구현에서 **의도적으로 더 안전한 방향(Usage 로그도 일반화)** 으로 해소되었음에도, 코드 JSDoc과 spec §6/§8.3 본문 두 곳 모두 여전히 "Usage 로그에 원본이 남는다"는 이전 가정을 그대로 서술하고 있어 코드-스펙 양쪽에 정정이 필요한 오래된(stale) 문구가 남아 있다. 이는 보안 인시던트 대응 시 실제로 존재하지 않는 로그 소스를 찾게 만들 수 있어 WARNING 등급이 적절하다. 그 외 독스트링·인라인 주석·테스트 주석은 전반적으로 상세하고 정확하며, README/CHANGELOG/환경변수 신규 도입은 없다(기존 `ALLOW_PRIVATE_HOST_TARGETS` 재사용).

## 위험도

MEDIUM
