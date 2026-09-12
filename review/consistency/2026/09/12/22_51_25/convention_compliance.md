# 정식 규약 준수 검토 — spec/5-system/ (--impl-prep)

## 검토 범위와 한계

- 조립 프롬프트(`_prompts/convention_compliance.md`)는 컨텍스트 예산 초과로 `spec/5-system/` 15개 파일과 `spec/conventions/**` 거의 전 파일의 본문을 절단했다. 프롬프트에 **전문이 실린 target 은 3개** — `3-error-handling.md`·`1-auth.md`·`2-api-convention.md` — 이며 본 검토는 이 3개를 정독했다.
- 절단된 `spec/conventions/error-codes.md`·`spec/conventions/swagger.md` 는 저장소에서 **직접 Read** 해 전문으로 대조했다(가장 관련도가 높은 두 문서).
- 나머지 13개 `spec/5-system/*.md` (execution-engine·websocket-protocol·webhook·EIA·chat-channel 등)와 나머지 `spec/conventions/*.md`(node-output·execution-context·audit-actions 등)는 본 세션에서 전문 대조하지 못했다 — 이 문서들이 관련되면 별도 라운드에서 직접 열어 재확인이 필요하다.
- 검토 대상 3개 문서 자체는 매우 높은 수준으로 유지되고 있다(Overview/본문/Rationale 3섹션 구조 준수, 정정 이력의 취소선 보존, historical-artifact 예외 레지스트리 정합 등). 아래 발견사항은 그 안에서 실측으로 확인한 구체적 갭이다.

## 발견사항

- **[WARNING] Background Runs REST 에러 코드가 중앙 카탈로그(`3-error-handling.md §1`)에 미등재**
  - target 위치: `spec/5-system/3-error-handling.md` §1 (전체) — 해당 섹션에 `INVALID_CURSOR`·`INVALID_LIMIT`·`BACKGROUND_RUN_NOT_FOUND`가 0건. `EXECUTION_NOT_FOUND`는 §1.6 EIA 절의 각주에서만 스쳐 지나간다(전용 행 없음).
  - 위반 규약:
    - `spec/5-system/2-api-convention.md` §5.3 "도메인 세부 사유를 어디에 싣는가" — *"어느 쪽을 택하든 [에러 처리 §1] 카탈로그에 등재한다. 등재되지 않은 코드는 소비자가 존재를 알 방법이 없다."*
    - `spec/5-system/3-error-handling.md` 자신이 §Rationale 에서 여러 차례("§1 카탈로그 완결성 — 2FA/WebAuthn(§1.2.1)·KB/Graph RAG(§1.8) 도메인 등재", "§1.9 워크스페이스 멤버 직접 추가 코드 등재(#893 후속 완결성 pass)") 확립한 자기 패턴 — 도메인 REST 엔드포인트가 발행하는 코드는 정의 SoT 는 도메인 spec 에 두고 §1 에는 "공용 카탈로그 가시성"용으로 등재한다(§1.5 WS commands, §1.6 EIA REST, §1.7 webhook, §1.8 KB/Graph RAG, §1.9 workspace 직접추가, §1.10 트리거 endpointPath 충돌, §1.11 트리거 AuthConfig binding, §1.12 chat-channel bot token 회전 — 예외 없이 전부 이 패턴을 따름).
  - 상세: `GET /api/executions/{executionId}/background-runs/{backgroundRunId}`(cursor 페이지네이션, `2-api-convention.md §8.2` 가 이 엔드포인트를 cursor 페이지네이션의 대표 예시로 직접 인용한다)가 발행하는 에러 코드 4종(`INVALID_CURSOR`/`INVALID_LIMIT`/`EXECUTION_NOT_FOUND`/`BACKGROUND_RUN_NOT_FOUND`, `spec/4-nodes/1-logic/12-background.md §8.7`)이 §1.5~§1.12 가 예외 없이 지켜 온 등재 관행에서만 빠져 있다. `12-background.md` 쪽에도 §1 로의 역참조가 없다(다른 도메인 spec 은 전부 "본 절은 공용 카탈로그 가시성 등재다" 류 상호 링크를 건다). 이 발견은 지금 착수하려는 작업(`plan/in-progress/keyset-cursor-uuid-validation.md`)이 정확히 `background-runs.service.ts` 의 `decodeCursor`/`INVALID_CURSOR` 발행 지점을 건드리므로 시의성이 있다 — 플랜 자체는 코드를 신설하지 않고 기존 `INVALID_CURSOR` 를 재사용하므로 이 갭을 만들지는 않으나, 마침 그 인접 코드를 만지는 시점이라 완결성 pass 로 같이 닫기에 비용이 낮다.
  - 제안: `3-error-handling.md` 에 §1.13(가칭 "Background Run 조회 에러 코드")을 §1.9~§1.12 와 동일한 "도메인 spec 참조" 패턴으로 신설하고 `12-background.md §8.7` 을 SoT 로 역링크한다. 또는 이 갭이 이미 알려진 defer 항목이라면(확인 못함) 그 결정 근거를 `3-error-handling.md` 나 `12-background.md` 중 한 곳에 명시해 다음 완결성 pass 가 같은 조사를 반복하지 않게 한다.

- **[INFO] `EXECUTION_NOT_FOUND` 를 "표준 코드 재사용"으로 서술하는 문구가 이웃 패턴과 어긋난다**
  - target 위치: `spec/5-system/3-error-handling.md` §1.6 하단 각주 — *"`VALIDATION_ERROR`(submit_form field 검증)·`EXECUTION_NOT_FOUND`(404)·`TOKEN_INVALID`/`TOKEN_EXPIRED`(401)는 API 규약/§1.2~§1.3 표준 코드를 그대로 재사용한다(EIA 전용 아님)."*
  - 위반 규약: `spec/5-system/3-error-handling.md` §1.9 자신이 세운 구분 기준 — 동일 문서 §1.9 각주는 *"`USER_NOT_FOUND`·`WORKSPACE_NOT_FOUND`(404)는 … 전역 CRUD 공통 generic 코드라 직접-추가 distinctive 가 아니어서 본 절 미등재"* 라고 하여, "표준 코드 재사용"이라는 표현을 **문자 그대로 그 제네릭 문자열을 wire 에 낸다**는 뜻으로 쓴다.
  - 상세: 그러나 `EXECUTION_NOT_FOUND` 는 코드베이스에서 `RESOURCE_NOT_FOUND` 라는 문자열을 재사용하는 것이 아니라 **그 자체가 별개의 wire 리터럴**이다(`interaction.guard.ts`·`interaction.service.ts`·`background-runs.service.ts` 전수 grep 확인). 즉 `MODEL_CONFIG_NOT_FOUND`·`ALERT_RULE_NOT_FOUND` 처럼 "`RESOURCE_NOT_FOUND` 의 도메인 특화 코드"이지 "§1.2~§1.3 표준 코드의 재사용"이 아니다 — 위 WARNING 항목과 같은 뿌리(등재 누락)에서 나온 서술 오차다.
  - 제안: 위 WARNING 을 해소하며 `EXECUTION_NOT_FOUND` 를 `MODEL_CONFIG_NOT_FOUND` 계열과 같은 "`RESOURCE_NOT_FOUND` 의 도메인 특화 코드"로 정정 등재하면 이 문구도 자연히 정합해진다.

## 요약

검토 대상인 `spec/5-system/3-error-handling.md`·`1-auth.md`·`2-api-convention.md` 세 문서는 문서 구조(Overview/본문/Rationale)·명명 규약(`UPPER_SNAKE_CASE` + historical-artifact 예외 레지스트리 정합)·API 문서 규약(Swagger DTO/wrapping 패턴과의 상호 참조)·자기-반증형 소정정 표기(취소선 보존) 모두에서 `spec/conventions/**` 를 매우 충실히 따르고 있으며, 과거 여러 라운드의 완결성 pass 흔적이 뚜렷하다. 유일하게 실측으로 확인된 갭은 Background Runs 조회 API 의 에러 코드 4종이 이 저장소가 스스로 예외 없이 지켜 온 "§1 중앙 카탈로그 등재" 관행에서 누락돼 있다는 점이며, 마침 이번 작업이 그 인접 코드(`decodeCursor`/`INVALID_CURSOR`)를 건드리므로 부수적으로 닫기 좋은 시점이다. 다만 본 검토는 컨텍스트 예산 절단으로 `spec/5-system/` 13개 파일과 대부분의 `spec/conventions/*.md` 를 전문 대조하지 못했으므로, 그 범위에 특정 관심사가 있다면 별도 라운드에서 직접 확인이 필요하다.

## 위험도

LOW
