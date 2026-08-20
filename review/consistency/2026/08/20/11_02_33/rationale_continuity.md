# Rationale 연속성 검토 — `token` 계열 시크릿 마스킹 확장 (spec/5-system/)

## 검토 대상
- 코드 diff: `shared/utils/sanitize-error-message.ts`(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`), `websocket.service.ts`(WS 미러 `CREDENTIAL_KEY_PATTERN`), `mcp-error-codes.ts`(`MCP_EXTRA_SECRET_PATTERNS` 비움) + 각 spec 테스트
- Target spec: `spec/5-system/14-external-interaction-api.md` §R17, `spec/5-system/11-mcp-client.md` §Rationale("에러 message redaction 은 공용 패턴 재사용"), `spec/5-system/6-websocket-protocol.md` §4.1/§Rationale, `spec/5-system/12-webhook.md` §Rationale("민감 헤더 마스킹 — ingestion 시점 채택")

## 발견사항

검토 관점 4가지(기각 대안 재도입 / 원칙 위반 / 무근거 번복 / 암묵 invariant 충돌) 전부에 대해 CRITICAL·WARNING 급 발견 없음. 아래는 검토 과정에서 확인한 잠재 충돌 지점과 그 해소 근거(참고용 INFO).

- **[INFO]** `token` 계열 정규식 일반화가 `12-webhook.md` §Rationale "민감 헤더 마스킹 — ingestion 시점 채택" 의 기각 대안(display-시점 마스킹)과 표면적으로 유사해 보임
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "언제 가리는가 — ingestion-time 과 egress-time 이 공존한다" 불릿 (diff 상 신규 아님, 이미 target 문서에 존재)
  - 과거 결정 출처: `spec/5-system/12-webhook.md` §Rationale "민감 헤더 마스킹 — ingestion(저장) 시점 채택(2026-07-07)" — "대안인 display(응답) 시점 마스킹은 기각했다 … 모든 read 경로를 개별적으로 마스킹해야 한다(whack-a-mole)"
  - 상세: 이번 diff 는 egress-time(emit/read 시점) 값-패턴 마스킹의 커버리지를 넓히는 변경(`token` 계열 bare+접두형 통합)이다. `12-webhook.md` 는 구조화된 알려진 헤더 key 에 대해 정확히 이 "display-시점 마스킹" 대안을 whack-a-mole 근거로 기각한 바 있어, 언뜻 번복처럼 보인다.
  - 재확인 결과: target 문서(R17)가 이 긴장을 **이미 명시적으로 인지·해소**하고 있다 — "그 문서는 display 시점 마스킹을 기각하며 '모든 read 경로를 개별적으로 마스킹해야 한다' 를 근거로 들었다. 타당한 우려이고 이 작업 자체가 그것을 실증했다(표면이 넷→여섯으로 늘었고 `inputData` 카브아웃 범위를 한 번 되돌렸다). 다만 여기서의 방어는 호출부를 산발적으로 패치하는 방식이 아니다 — 소수의 공유 관문(`toResponseExecution`·`emitExecutionEvent`/`emitNodeEvent`·`toTerminalErrorPayload`)으로 수렴시켜 …" 그리고 대상 구분도 명시("구조화된 시크릿 전용 필드(알려진 헤더 key)"=ingestion 이 옳음 vs "자유 텍스트·진단용 필드"=사전 특정 불가라 egress 가 옳음). 즉 기각된 대안의 무근거 재도입이 아니라, **적용 대상이 다름을 인지한 채 대안의 트레이드오프를 정면으로 인용하며 새 근거로 egress-only 를 채택**한 정상적인 Rationale 확장이다. 이번 diff(token 계열 일반화)는 이미 확립된 egress 관문(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`) 자체의 커버리지 보강일 뿐, ingestion-vs-egress 선택 축을 다시 여는 변경이 아니다.
  - 제안: 조치 불필요. 다만 향후 유사 검토에서 "egress 마스킹 확장 = ingestion 원칙 위반" 으로 오판하지 않도록, R17 의 위 문단이 SoT 임을 리뷰 체크리스트에 남겨두면 재조사 비용을 아낄 수 있다.

- **[INFO]** MCP 전용 패턴을 공용으로 흡수하는 방향이 반복되는 것은 신규 원칙이 아니라 기존 "SoT 파편화 방지" 원칙의 재적용
  - target 위치: `spec/5-system/11-mcp-client.md` §Rationale "에러 message redaction 은 공용 패턴 재사용" 블록 (2026-08-17 갱신 문단)
  - 과거 결정 출처: 같은 절 본문 "별도 redaction 로직을 새로 두지 않은 이유: secret 패턴은 보안 민감 SoT 라 파편화 시 … 유지보수 위험" + 2026-07-10 갱신(URL userinfo 흡수 선례)
  - 상세: diff 는 `MCP_EXTRA_SECRET_PATTERNS`(bare `token=` 전용)를 비우고 공용 `SECRET_LEAK_PATTERNS` 로 완전히 흡수시킨다. 이는 2026-07-10 에 URL-userinfo 패턴을 흡수한 선례와 동일한 방향이며, 문서가 그 선례를 직접 인용해 정합성을 유지한다("위 파편화 방지 원칙을 …에도 적용"). 기각된 대안의 재도입이 아니라 동일 원칙의 두 번째 적용.
  - 제안: 조치 불필요.

- **[INFO]** 잔여 범위 축소(“token 계열이 닫혔다”가 아니라 "두 축에 한한 서술") 가 명시적으로 기록되어 후속 오판을 예방하고 있음
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "`token` 계열 확장 (2026-08-17)" 불릿 + "잔여 ③ (범위 밖 유지)" 불릿
  - 과거 결정 출처: 없음(신규 발견 갭 기록) — R17 자체의 관행("알려진 갭은 invariant 옆에 적는다", R14·R17·§6.4 와 동형)을 그대로 따름
  - 상세: `explore-tools.service.ts` 의 `maskSensitiveFields`(워크플로우 어시스턴트 LLM 도구 표면)는 이번 확장 대상이 아니며, 그 이유(접미 힌트 보존과 값-패턴 마스킹의 의미 충돌)까지 명시했다. 결정 번복이 아니라 스코프 경계를 정확히 그은 것.
  - 제안: 조치 불필요.

## 요약
diff 는 `token` 계열 시크릿(값 패턴 + credential 키 이름)을 공용 `SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN` 한 대안으로 일반화하고, MCP 전용 보완 패턴을 비우는 변경이다. target 문서(`14-external-interaction-api.md` §R17, `11-mcp-client.md` §Rationale, `6-websocket-protocol.md` §4.1/§Rationale)를 대조한 결과, 이 변경은 (a) 기존에 확립된 "SoT 파편화 방지"(2026-07-10 URL-userinfo 흡수 선례), "공유 관문으로 수렴"(R17 본문), "strip-only 결정은 번복되지 않음"(WS §Rationale) 원칙을 그대로 따르고 있고, (b) `12-webhook.md` 의 ingestion-시점 마스킹 채택(및 display-시점 마스킹 기각)과 표면적으로 겹쳐 보이는 지점도 R17 자신이 대상 차이(구조화된 알려진 필드 vs 사전 특정 불가능한 자유 텍스트)를 근거로 명시적으로 재확인했으며, whack-a-mole 우려를 회피하는 방식(소수 공유 관문 상속)까지 별도로 답했다. 새로 발견한 갭(잔여 ③, 프리필 왕복 카브아웃 조건)도 총칭이 아니라 열거로 기록해 후속 재조사 비용을 낮췄다. 기각된 대안의 무근거 재도입, 합의 원칙 위반, 무근거 결정 번복, 암묵적 invariant 우회로 판정할 CRITICAL/WARNING 급 항목은 발견하지 못했다.

## 위험도
NONE
