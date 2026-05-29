# Rationale 연속성 검토 결과

- 검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
- 검토 일시: 2026-05-29
- 대상 경로: spec/5-system/

---

## 발견사항

### [INFO] 1.4.I — `requiresTotp` 제거 결정에 연결된 Rationale 가 spec 본문보다 Rationale 절에만 존재

- target 위치: `spec/5-system/1-auth.md` §1.4.I (Rationale 절, 라인 550–589)
- 과거 결정 출처: `spec/5-system/1-auth.md` Rationale §1.4.I 자체가 결정 문서
- 상세: `requiresTotp` deprecated 필드 제거는 두 조건((1) 두 마이너 버전 경과, (2) `methods` 기반 신규 프론트엔드 배포) 충족을 근거로 결정됐다. 그러나 §1.4.2 본문 테이블에는 여전히 `requires2fa` + `methods` 인터페이스 기술만 있고, `requiresTotp` 이 완전히 제거되었다는 사실이 §5 API 엔드포인트 표나 본문 어디에도 명시되지 않았다. Rationale 절만 알고 있고 본문이 갱신을 반영하지 않는 상태.
- 제안: `spec/5-system/1-auth.md` §5 엔드포인트 표의 `/api/auth/login` 응답 형식 설명에 "`requiresTotp` 필드 없음 (§1.4.I Rationale 에 따라 완전 제거)" 한 줄 추가 권장.

---

### [INFO] 1.4.H — LoginHistoryService 이중 provider 등록의 근거가 Rationale 에는 있으나 단일 진실 관리가 약함

- target 위치: `spec/5-system/1-auth.md` §1.4.H, 라인 538
- 과거 결정 출처: `spec/5-system/1-auth.md` Rationale §1.4.H 자체
- 상세: "LoginHistoryService 는 AuthModule 과 WebAuthnModule 양쪽에 provider 로 둔다 — 두 인스턴스가 같은 DB 테이블에 INSERT 만 하므로 동작 동등. LoginHistoryModule 로의 추가 분리는 별 follow-up." 이라는 결정이 §1.4.H Rationale 에 서술되어 있다. 그러나 이 결정은 "LoginHistoryModule 분리" 라는 후속 결정을 예고하면서도 그 follow-up 의 plan 위치나 조건을 명시하지 않는다. 이후 구현자가 따로 LoginHistoryModule 을 신설하면 §1.4.H 의 근거 없이 번복되는 것처럼 보일 수 있다.
- 제안: "LoginHistoryModule 분리는 별 follow-up" 문구에 plan 파일 링크 또는 "별도 결정 시 Rationale 에 §1.4.J 로 추가" 와 같은 안내를 명시해두면 미래 번복을 근거 없는 것으로 오인하지 않는다.

---

### [INFO] `document:graph_error` 이벤트 — 의미 변경이 Rationale 에 기록되지 않음

- target 위치: `spec/5-system/10-graph-rag.md` §6 WebSocket 이벤트 표, 라인 536
- 과거 결정 출처: 없음 (이전 명시적 Rationale 항목 부재)
- 상세: `document:graph_error` 이벤트에 "(의미 변경, 2026-05-11) in-flight 일시 오류 — ... 영구 실패 신호로 사용하지 말 것 (이전 동작은 `graph_failed` 로 이관됨)" 이라는 중요한 의미 변경이 본문 표 안에 inline 주석으로만 기록되어 있다. 이전 동작·이행 이유·이벤트 역할 분리(일시 오류 vs 최종 실패)의 근거가 `## Rationale` 절에는 별도 항목으로 없다.
- 제안: `spec/5-system/10-graph-rag.md ## Rationale` 에 "document:graph_error 의미 변경 (2026-05-11)" 항목을 추가해 이전 동작과 신규 동작, 변경 이유를 형식화한다. 구현자가 참조 시 표 안 inline 주석보다 Rationale 절이 단일 진실로 역할해야 한다.

---

### [INFO] MCP client spec — stdio 미지원이 §12 확장 포인트에서 "도입 가능"으로 재개방됨

- target 위치: `spec/5-system/11-mcp-client.md` §12 확장 포인트, 라인 522
- 과거 결정 출처: `spec/5-system/11-mcp-client.md` §2.2 stdio 미지원 사유 (명시 기각)
- 상세: §2.2 에서 "멀티테넌트 백엔드에서 사용자별 subprocess 를 spawn 하는 비용·보안 부담" 및 "임의 명령 실행 권한 노출 위험" 을 이유로 stdio transport 를 명시 미지원으로 결정했다. 그런데 §12 확장 포인트에 "stdio transport: 데스크톱 bridge 또는 사내 격리 환경 한정으로 도입 가능"이라는 문구가 있다. 이는 기각된 대안을 "한정적으로 도입 가능" 하다고 재개방하는 구조다. §2.2 본문("향후 데스크톱 bridge agent 등을 통해 우회적으로 stdio 서버를 노출하는 방안은 별도 spec 으로 분리한다")과 같은 방향이기는 하지만, §12 가 §2.2 의 미지원 결정보다 구체적으로 "credentials 스키마에 command/args/env 추가하고 transport 분기" 방법론을 제시하는 점이 주목된다.
- 상세 분석: §2.2 기각 사유는 "멀티테넌트 SaaS" 한정이고 §12 는 "데스크톱 bridge 또는 사내 격리 환경 한정" 이라 적용 범위가 다르므로 논리적 모순이라기보다 범위 조건부 허용이다. 그러나 이 조건부 재개방에 대한 Rationale 항목이 없다.
- 제안: `spec/5-system/11-mcp-client.md ## Rationale` (현재 없음) 절을 신설하거나, §2.2 내에 "데스크톱 bridge/격리 환경에서의 향후 stdio 도입 조건" 항을 추가해 §12 의 확장 포인트가 §2.2 기각 결정을 의식적으로 부분 해제하는 것임을 명문화한다.

---

## 요약

`spec/5-system/` 내 검토 대상 문서들(1-auth.md, 10-graph-rag.md, 11-mcp-client.md)은 각 Rationale 에서 명시적으로 기각된 대안을 이유 없이 재도입하거나 합의된 설계 원칙을 직접 위반하는 사례가 없다. 주요 결정—WebAuthn credential 강제 삭제(suspend 기각), TOTP 자동 fallback 금지, 복구 코드 풀 분리, WebAuthn env 미설정 시 기능 비활성(부팅 거부 기각), KB 모드 불변, Graph RAG PostgreSQL 단일 인프라(Neo4j/AGE 기각), MCP stateless JWT challenge(별도 테이블 기각)—모두 spec 본문과 Rationale 가 일관되게 유지되고 있다. 발견된 항목 4건은 모두 INFO 등급으로, Rationale 형식화 보완 권장에 해당한다. 구현 착수를 차단할 CRITICAL/WARNING 수준의 Rationale 연속성 위반은 식별되지 않았다.

---

## 위험도

LOW
