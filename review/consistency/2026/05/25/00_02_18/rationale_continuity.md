# Rationale 연속성 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
**검토 일시**: 2026-05-25
**대상 문서**: `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/12-webhook.md` (일부 truncated)

---

## 발견사항

- **[INFO]** WebAuthn counter 역행 시 credential 삭제 — suspend 기각 결정과 완전 정합
  - target 위치: `spec/5-system/1-auth.md §1.4.4` ("counter 역행이 감지되면 ... 해당 credential row 를 즉시 삭제")
  - 과거 결정 출처: 동일 spec `## Rationale 1.4.E`
  - 상세: `1.4.E`에서 "suspend (`disabled_at` 컬럼)" 대안을 명시적으로 기각하고 즉시 삭제를 채택한 근거(클론 공격자 재활성화 위협, 운영 단순화)가 본문 구현 명세와 완벽히 일치. 정합 상태.
  - 제안: 없음 (확인 완료).

- **[INFO]** WebAuthn 환경변수 미설정 → 부팅 거부 대신 기능 비활성 — 과거 기각 결정과 정합
  - target 위치: `spec/5-system/1-auth.md §1.4.3` 활성/비활성 표
  - 과거 결정 출처: 동일 spec `## Rationale 1.4.F` (후보 A "부팅 거부" 기각, 후보 B "기능 비활성" 채택)
  - 상세: `1.4.F`에서 "부팅 거부" 옵션이 명시적으로 기각됐고, `1.4.3` 본문이 기능 비활성(503 반환)을 일관되게 기술. 정합 상태.
  - 제안: 없음 (확인 완료).

- **[INFO]** WebAuthn TOTP 자동 fallback 금지 — Rationale 1.4.D 와 정합
  - target 위치: `spec/5-system/1-auth.md §1.4.2` ("WebAuthn 이 1개라도 등록된 사용자에게는 로그인 화면에서 TOTP 입력을 제공하지 않는다")
  - 과거 결정 출처: 동일 spec `## Rationale 1.4.D`
  - 상세: phishing-resistant 인증 수단이 등록된 사용자에게 약한 수단 자동 노출을 금지한다는 원칙이 본문과 일치. 정합 상태.
  - 제안: 없음.

- **[INFO]** Graph RAG — KB 모드 사후 변경 불가 원칙 정합
  - target 위치: `spec/5-system/10-graph-rag.md §2.2 "KB-GR-MD-02"`, `§4 기술 결정 사항 "KB 모드 선택: 생성 시 결정, 불변"`
  - 과거 결정 출처: 동일 spec `## Rationale Memory §사용자 결정 (2026-05-02) #6` + `§결정 근거 "사후 변경 불가"`
  - 상세: "사후 변경의 마이그레이션·UX 부담이 점진 도입의 가치를 넘어섬"이라는 근거가 기록되어 있고, 본문 §2.2·§4·§8(비-목표)에서 동일하게 "생성 시에만 결정, 새 KB 생성으로 대체"를 명시. 정합 상태.
  - 제안: 없음.

- **[INFO]** Graph RAG — LLM 추출 단일 경로 (룰 기반 추출 기각) 정합
  - target 위치: `spec/5-system/10-graph-rag.md §8 비-목표` ("룰 기반 entity 추출 (spaCy 등)")
  - 과거 결정 출처: 동일 spec `## Rationale Memory §비-목표` ("룰 기반 entity 추출 (LLM 추출 단일 경로)")
  - 상세: 룰 기반 추출을 비-목표로 명시한 결정이 § 8 비-목표 항목에 그대로 반영. 정합.
  - 제안: 없음.

- **[INFO]** Graph RAG — Apache AGE / Neo4j 도입 연기 (PostgreSQL 충분) 정합
  - target 위치: `spec/5-system/10-graph-rag.md §2.2 범위 밖` ("Apache AGE / Neo4j 도입"), `§4 기술 결정 사항 "그래프 저장소: PostgreSQL 관계형 테이블"`
  - 과거 결정 출처: 동일 spec `## Rationale Memory §비-목표` + `§결정 근거`
  - 상세: "데이터 규모 임계 도달 시 검토"라는 기각 조건이 그대로 보존. 정합.
  - 제안: 없음.

- **[INFO]** MCP — stdio transport 미지원 결정 명시적 기각 보존 정합
  - target 위치: `spec/5-system/11-mcp-client.md §2.2 stdio 미지원 사유` + `§1 범위 "stdio MCP 서버 spawn 미포함"`
  - 과거 결정 출처: 동일 spec `§2.2`에서 기각 이유(멀티테넌트 보안 부담, 임의 명령 실행 위험) 기술
  - 상세: §1에서 MVP 미포함을 선언하고 §2.2에서 기각 근거를 명시. §12 확장 포인트에서 "데스크톱 bridge 또는 사내 격리 환경 한정"으로 향후 도입 조건도 명시. 결정 정합.
  - 제안: 없음.

- **[INFO]** MCP — 노드 간·실행 간 세션 공유 의도적 미지원 정합
  - target 위치: `spec/5-system/11-mcp-client.md §4.3` ("노드 간·실행 간 세션 공유는 하지 않는다 — 사용자 격리·세션 라이프사이클의 단순함을 위해 의도적으로 풀을 키우지 않는다")
  - 과거 결정 출처: 동일 spec §4.3 본문이 기각 근거를 inline으로 제공
  - 상세: 세션 풀링을 "의도적으로" 채택하지 않는다는 결정이 Rationale 없이 본문에만 기술되어 있음. 현재 별도 `## Rationale` 항목이 없는 상태. 충돌은 아니나, 향후 세션 풀링 요구가 생겼을 때 이 결정의 근거를 추적하기 어려울 수 있음.
  - 제안: §4.3의 세션 비공유 결정 근거(사용자 격리·단순성)를 `## Rationale` 섹션에 항목으로 추가 고려 (현재 11-mcp-client.md 에 Rationale 섹션 자체가 없음). 미작성이 의도인지 확인 필요.

- **[WARNING]** MCP — `11-mcp-client.md`에 `## Rationale` 섹션 부재
  - target 위치: `spec/5-system/11-mcp-client.md` 전체 (섹션 12 이후 Rationale 미존재)
  - 과거 결정 출처: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 규약
  - 상세: `spec/5-system/11-mcp-client.md`는 다수의 중요한 설계 결정(stdio 미지원, 세션 비공유, 단일 transport 선택, 메타도구 평탄화 모델, usage log 미기록 범위 등)을 포함하고 있음에도 `## Rationale` 섹션이 없음. 결정 근거가 본문 inline에만 산재되어 있어 형식 규약 미준수. 다른 spec 파일(`1-auth.md`, `0-overview.md`, `1-data-model.md` 등)은 모두 `## Rationale` 섹션을 보유.
  - 제안: `11-mcp-client.md` 말미에 `## Rationale` 섹션을 추가하고, stdio 미지원(§2.2), 세션 비공유(§4.3), Transport 선택(Streamable HTTP 단일), 메타도구 allowlist 미적용(§5.6), usage log 기록 범위(§8.3) 등 핵심 결정을 항목으로 정리. 구현 착수 전에 완료 권장.

- **[INFO]** Auth — `requiresTotp` deprecated 필드 제거 — 조건부 번복이나 Rationale 1.4.I 에 명확히 기술
  - target 위치: `spec/5-system/1-auth.md ## Rationale 1.4.I`
  - 과거 결정 출처: 동일 spec `§1.4.2` 과 `Rationale 1.4.I` (두 마이너 버전 경과 + 신규 프론트엔드 배포 조건 명시)
  - 상세: `requiresTotp` 필드가 호환 bridge 역할을 마친 후 제거하는 결정이며, 제거 조건 두 가지가 모두 충족됐음을 Rationale에서 명시. 무근거 번복이 아닌 조건부 결정의 정상 실행. 정합.
  - 제안: 없음.

- **[INFO]** Graph RAG — Microsoft GraphRAG community detection / 글로벌 요약 기각 유지 정합
  - target 위치: `spec/5-system/10-graph-rag.md §2.2 범위 밖`, `§6 Phase Plan "P2+ (후속)"`, `§8 미결/후속 검토`
  - 과거 결정 출처: 동일 spec `## Rationale Memory §비-목표`
  - 상세: community detection을 P0-P2 범위 밖으로 명시적으로 제외한 결정이 현재 spec과 일치. P2+ 후속으로 위치 보존. 정합.
  - 제안: 없음.

- **[INFO]** Auth — WebAuthn challenge stateless JWT (별도 테이블 없음) — Rationale 1.4.C 정합
  - target 위치: `spec/5-system/1-auth.md §1.4.4` (`optionsToken JWT 발급 (kind=webauthn_register, 5분)`)
  - 과거 결정 출처: 동일 spec `## Rationale 1.4.C`
  - 상세: `webauthn_challenge` 테이블 대신 JWT를 사용하는 결정 근거(replay 방어 충분, 운영 부담 감소)가 Rationale에 명시되어 있고 본문이 이를 따름. 정합.
  - 제안: 없음.

- **[INFO]** Auth — 복구 코드 풀 분리 (TOTP/WebAuthn 별도) — Rationale 1.4.B 정합
  - target 위치: `spec/5-system/1-auth.md §1.4.1`
  - 과거 결정 출처: 동일 spec `## Rationale 1.4.B`
  - 상세: 공통 풀 및 WebAuthn fallback 없음 대안 모두 기각된 결정이 §1.4.1 구현 명세(두 컬럼 분리)와 일치. 정합.
  - 제안: 없음.

- **[INFO]** Auth — 초대 토큰 만료 7일 — Rationale 1.5.C 정합
  - target 위치: `spec/5-system/1-auth.md §1.5.1` (만료: 발급 시점 + **7일**)
  - 과거 결정 출처: 동일 spec `## Rationale 1.5.C`
  - 상세: 24~48시간 단기 및 14일+ 장기를 기각하고 7일을 채택한 근거가 명시되어 있고 본문이 이를 따름. 정합.
  - 제안: 없음.

---

## 요약

`spec/5-system/` 대상 문서들(1-auth.md, 10-graph-rag.md, 11-mcp-client.md) 전반에 걸쳐 과거 Rationale에서 기각된 대안을 재도입하거나 합의된 invariant를 위반하는 사례는 발견되지 않았다. 인증 시스템(1-auth.md)은 WebAuthn 관련 결정(1.4.A~1.4.I)이 모두 Rationale과 일치하며, Graph RAG(10-graph-rag.md)는 2026-05-02 사용자 결정 스냅샷이 현재 spec과 완전 정합한다. 유일한 구조적 미비는 `11-mcp-client.md`에 `## Rationale` 섹션이 부재하다는 점으로, 다수의 중요한 설계 결정(stdio 미지원, 세션 비공유, single-transport 선택 등)의 근거가 본문 inline에만 산재해 프로젝트 규약(결정 근거는 Rationale 섹션에 기술)을 따르지 않고 있다. 이 점은 기각된 대안의 재도입은 아니나 추적 가능성 관점에서 WARNING 수준으로 판단한다. 구현 착수 전 `11-mcp-client.md`에 Rationale 섹션을 보강할 것을 권장한다.

---

## 위험도

LOW
