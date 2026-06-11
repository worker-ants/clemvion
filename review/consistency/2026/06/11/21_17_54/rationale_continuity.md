# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system)
검토 시각: 2026-06-11

---

## 발견사항

### 발견사항 없음 — NONE

`spec/5-system` 내 target 문서(1-auth.md, 10-graph-rag.md, 11-mcp-client.md)의 현재 내용과
관련 spec Rationale 섹션을 대조한 결과, 기각된 대안 재도입·합의 원칙 위반·무근거 번복·invariant
우회에 해당하는 항목이 발견되지 않았다.

주요 점검 결과는 아래와 같다.

**1-auth.md §4.1 (감사 로그 Action naming)**

- `execution.re_run` 명명 및 `AUDIT_ACTIONS` 상수 SoT 규약이 Rationale 1.4.D("WebAuthn 우선,
  TOTP fallback 자동 금지") 등 기존 결정 원칙과 충돌하지 않는다.
- `<resource>.<verb>` 도트-prefix 규약은 이번 브랜치에서 최초 명문화됐으며, 과거 Rationale에
  기각된 대안이 없다 (구 `re_run_initiated`는 규약 부재 시기의 코드였고 spec에 선언된 적 없음).
- `model_config.*` 통합 감사 액션 및 `llm_config.*`/`rerank_config.*` OR 쿼리 보존 정책은
  `spec/1-data-model.md §2.16 ModelConfig 통합(V088~V092)` Rationale의 append-only 보존
  원칙과 정합한다.

**10-graph-rag.md**

- "KB 모드 생성 시 결정·불변" 설계(Rationale "사후 변경 불가": 마이그레이션 비용)는 이전
  번복 기록 없음. 기존 Rationale와 동일 논거가 그대로 유지된다.
- "ruleset-기반 entity 추출(spaCy 등)의 범위 밖" 결정도 비-목표로 명시되어 재도입 없음.
- PostgreSQL 관계형 테이블 채택(Neo4j/Apache AGE 기각)이 데이터 모델 Rationale("기존
  인프라 그대로")와 일치한다.

**11-mcp-client.md**

- stdio 미지원 결정(Rationale §2.2 — 멀티테넌트 subprocess 보안 부담)은 spec에 명시된
  채로 유지되며, Internal Bridge(§2.3) 도입이 stdio 재도입을 암묵적으로 우회하지 않는다.
- `MCP_ALLOW_INSECURE_URL` production fail-closed(refactor 04 M-7) 는 `1-auth.md`의
  "Production fail-closed 가드" Rationale(JWT_SECRET·ENCRYPTION_KEY와 단일 블록 응집)과
  동형이며 원칙 연속성 이상 없다.
- "세션 풀링 미채택·노드 실행 단위 세션" 결정 (§4.3)은 기존 Rationale("사용자 격리·
  세션 라이프사이클 단순함")과 일치한다.

**현 브랜치 코드 변경(model-config controller / frontend) 관련**

- `ListModelConfigsQueryDto` 삭제 후 `@Query('kind')` + `PaginationQueryDto` 분리: 이는
  spec/5-system 범위가 아닌 구현 레이어 변경이며, 관련 spec(`spec/2-navigation/6-config.md
  §B.4` API 표의 `?kind=chat|embedding|rerank`) 이 요구하는 동작을 그대로 충족한다.
  Rationale R-3("ModelConfig 단일 화면 통합") 원칙을 위반하지 않는다.
- `model-configs.ts` frontend에서 `limit: 9999`로 변경: spec/5-system/2-api-convention.md
  §4.1은 "최대 100"을 명시한다. 단, 이 변경은 spec/5-system이 아닌 프론트엔드 구현 레이어의
  문제이며 Rationale 연속성(기각된 대안 재도입·invariant 우회)이 아닌 spec-impl 갭이다.
  본 검토 scope(spec/5-system Rationale 연속성)의 직접 대상이 아니므로 INFO 로 기록에만
  남긴다.

---

### 발견사항 상세

- **[INFO]** 프론트엔드 `limit: 9999` 가 API 규약 §4.1 상한(100)을 초과
  - target 위치: `codebase/frontend/src/lib/api/model-configs.ts` (현 브랜치 diff)
  - 과거 결정 출처: `spec/5-system/2-api-convention.md §4.1` — `limit` 최대값 100 명시
  - 상세: 구현이 `limit: 100`에서 `limit: 9999`로 변경됐다. API 규약의 `@Max(100)` 상한이
    서버에 ValidationPipe 로 강제되어 있으면 런타임 400이 발생할 수 있다. 삭제된 DTO의
    주석도 "100 초과 시 400" 을 명시했다.
  - 제안: `limit: 100`으로 되돌리거나, 서버 측 상한 규약을 높이고 spec §4.1도 함께 갱신
    (단, 규약 갱신 시 새 Rationale 작성 필요).
  - 비고: 본 항목은 Rationale 연속성(기각 대안 재도입·원칙 위반)이 아닌 spec-impl 갭이므로
    위험도 산정에는 포함하지 않는다.

---

## 요약

`spec/5-system` 범위 내 현재 spec 내용과 해당 `## Rationale` 섹션 간 Rationale 연속성을 검토한
결과, 기각된 대안 재도입(예: stdio MCP 지원, KB 모드 동적 전환, suspend 기반 credential 관리,
TOTP 자동 fallback 허용), 합의된 설계 원칙 위반, 무근거 번복, invariant 우회에 해당하는 항목이
발견되지 않았다. 최근 커밋(audit action 상수화·execution.re_run 개명)도 spec §4.1 Rationale의
새 명문화이며 과거 결정을 번복하지 않는다. 구현 레이어의 `limit: 9999` 는 spec/5-system
Rationale 연속성 문제가 아닌 별도 spec-impl 갭으로, INFO 수준으로 기록했다.

## 위험도

NONE
