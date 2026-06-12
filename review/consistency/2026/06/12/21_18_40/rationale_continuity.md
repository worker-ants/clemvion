# Rationale 연속성 검토 결과

검토 대상: `spec/5-system` (1-auth.md, 10-graph-rag.md, 11-mcp-client.md 포함)
검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system, diff-base=origin/main)

---

### 발견사항

- **[INFO]** M-5: spec 의 SameSite/CSRF 정책이 원안 Lax 기본 권장안에서 none 기본으로 최종 변경됐고, Rationale 2.3.B 는 이 번복 경위를 충분히 설명함
  - target 위치: `spec/5-system/1-auth.md §2.3` 표 / `Rationale §2.3.B`
  - 과거 결정 출처: spec 에 SameSite 정책 자체가 공백이었음 (plan B 판정). plan `04-security.md` M-5 원안 권장은 "Lax 기본 (옵션 A)"
  - 상세: plan 원안 권장은 "Lax 기본"이었다. 그러나 "프론트와 API 가 사이트 경계(eTLD+1)를 달리하는 배포가 실제 사용 중"임이 확인되어 `none` 기본으로 전환됐다. spec Rationale 2.3.B 는 이 배경과 CSRF 보완책(Origin allowlist 검증)을 함께 기록하고 있다. 기각된 `Lax 기본` 안은 plan 에 옵션 A 로 기록돼 있다. spec 에 "기각된 Lax 기본 원안" 을 선택하지 않은 이유가 명시적으로 없어 spec 독자가 직접 plan 을 참조하지 않으면 이 결정을 재도입하려는 혼선이 생길 수 있다.
  - 제안: Rationale 2.3.B 에 "cross-site 배포 실사용 확인으로 Lax 기본 원안 기각" 한 줄 보완 권장.

- **[INFO]** M-6: `notifications:` 채널 authorizer 의 "선제 fail-closed" 결정 근거가 spec Rationale 에 부재
  - target 위치: `spec/5-system/6-websocket-protocol.md §3.3` 채널 인가 표
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md ## Rationale` (관련 항목 없음)
  - 상세: 구현은 `notifications:<userId>` 채널에 authorizer 를 선제 추가했고 spec §3.3 표에도 반영됐다. 그러나 WebSocket spec Rationale 에는 "emit 미구현임에도 authorizer 를 먼저 두는 이유(emit 도입 시 누락 재발 위험 + fail-closed 원칙)" 가 없다. 기각된 대안("emit 구현 시점에 추가")의 거부 이유가 plan 에만 있다.
  - 제안: `spec/5-system/6-websocket-protocol.md ## Rationale` 에 "notifications: 채널 선제 authorizer 배치 이유" 항목 신설 권장.

- **[INFO]** m-3: `TRUST_CF_CONNECTING_IP` 신뢰 플래그 결정에서 인프라 AOP 강제 원안 기각 근거가 spec Rationale 에 부재
  - target 위치: `spec/5-system/1-auth.md §2.3` 표, `Rationale §2.3.B`
  - 과거 결정 출처: plan `04-security.md` m-3 (원안 권장 A = 인프라 Authenticated Origin Pulls / IP allowlist 강제)
  - 상세: 원안 권장은 "코드 무변경 + 인프라 AOP 강제(옵션 A)"였으나, CF Tunnel 사용으로 origin 직접 노출이 없어 IP allowlist 가 불필요하다는 추가 맥락으로 "env 게이트 신설" 로 전환됐다. Rationale 2.3.B 는 TRUST_CF_CONNECTING_IP 결정을 기술하나 "인프라 강제 원안을 왜 기각했는가" 에 대한 설명이 없다.
  - 제안: Rationale 2.3.B 의 "클라이언트 IP 신뢰" 항목에 "CF Tunnel 사용으로 origin 직접 노출 없어 인프라 AOP 강제는 권고에서 제외" 한 줄 추가 권장.

---

### 요약

refactor-04-security 구현은 spec/5-system 의 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 사례가 없다. M-5(SameSite none 기본), M-6(WebSocket IDOR authorizer), M-7(production fail-closed), M-1(Swagger 게이팅), m-1(DOMPurify 화이트리스트), M-3(safe-regex) 등 모든 결정은 spec Rationale 또는 plan 파일에 근거가 기록돼 있다. 단, 원안 권장안을 번복한 세 결정(M-5 Lax 기본 기각, M-6 선제 fail-closed 채택, m-3 인프라 강제 기각)의 번복 근거가 spec Rationale 에 없고 plan 에만 있어, spec 독자가 추후 기각된 대안을 재도입하려는 혼선 위험이 낮게 존재한다. 심각한 Rationale 연속성 위반은 없으며 세 건 모두 INFO 수준 보완 권장이다.

### 위험도

LOW
