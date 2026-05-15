# Code Review 통합 보고서

## 전체 위험도
**HIGH** - `timeout` 포트 제거 및 Multi Turn 0-조건 포트 구조 변경은 기존 워크플로우 엣지를 직접 파손하는 Breaking Change이며, 마이그레이션 전략 부재와 테스트 회귀 위험이 동반됨

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 / 부작용 | **`timeout` 포트 제거 — Breaking Change**: 기존 워크플로우에서 `timeout` 포트에 연결된 엣지가 dangling 상태가 됨. 스펙에 마이그레이션 전략 없음 | `spec/4-nodes/3-ai-nodes.md` 포트 섹션 | 마이그레이션 가이드 또는 자동 리맵 로직(`timeout` → `error` 포트) 명시. DB에 저장된 `timeout` 엣지를 `error`로 변환하는 마이그레이션 스크립트 필요 여부 결정 |
| 2 | API 계약 / 부작용 | **Multi Turn 0-조건 하위 호환 처리 불완전**: 기존 포트(`timeout` + `user_ended` + `max_turns` + `error`) → `out` 1개로 축소. "하위 호환"이라고 명시했으나 실제로는 포트 4개 → 1개로 축소되는 Breaking Change | `spec/4-nodes/3-ai-nodes.md` 공통 섹션, `prd/3-node-system.md` ND-AG-24 | `out` 추가는 유지하되 기존 포트(`user_ended`, `max_turns`, `error`)도 유지하거나, Breaking Change로 명확히 분류하고 마이그레이션 전략 기술 |
| 3 | 테스트 | **`timeout` 포트 제거로 인한 테스트 회귀**: `timeout` 포트 라우팅을 검증하던 테스트 즉시 실패. LLM 타임아웃/rate limit → `error` 포트 라우팅 경로 테스트 업데이트 필요 | 기존 구현 코드 및 테스트 전체 | `LLM_TIMEOUT`, `LLM_RATE_LIMIT`, `turnTimeout` → `error` 포트 라우팅 테스트 업데이트/추가 |
| 4 | 테스트 | **도구 이름 규칙 변경으로 인한 테스트 파괴**: 순수 UUID → `cond_`/`tool_` 접두사 방식으로 변경. LLM API payload의 `tools[].name` 검증 테스트 전체 실패 예상 | `spec/4-nodes/3-ai-nodes.md` Tool Area 연동 섹션 | `sanitizeId` 단위 테스트, 도구 이름 생성 테스트, LLM API payload 스냅샷 테스트 신규 작성 및 기존 테스트 업데이트 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 / 유지보수성 | **`endReason` enum과 포트 라우팅 간 단일 책임 위반**: `endReason`에 `timeout`이 여전히 유효한 값으로 존재하나 `timeout` 포트는 제거됨. 진단 코드(data field)와 라우팅 결정(port)이 혼재 | `spec/4-nodes/3-ai-nodes.md` `endReason` enum 정의 | (A) `endReason`에서 `timeout` 제거 후 `error`로 통합, 또는 (B) `endReason`은 내부 진단 코드로 유지하고 별도 `routeTo` 필드로 포트 결정 분리 |
| 2 | API 계약 | **유효성 검증 규칙 예약 포트 목록에 삭제된 `timeout` 잔존**: 존재하지 않는 포트 ID가 예약 목록에 남아 불필요한 제약과 혼란 야기 | `spec/4-nodes/3-ai-nodes.md` 유효성 검증 규칙 섹션 | 예약 포트 목록에서 `timeout` 제거 (`out`, `in`, `error`, `user_ended`, `max_turns`로 수정) |
| 3 | 아키텍처 | **Multi Turn 0-조건 케이스에서 `error` 포트 누락으로 인한 오류 처리 불가**: LLM 오류 발생 시 라우팅 경로 없어 워크플로우 비정상 종료 위험 | `spec/4-nodes/3-ai-nodes.md`, `prd/3-node-system.md` ND-AG-24 | Multi Turn 0-조건 케이스도 `out + error` 최소 포함, 또는 0-조건 미지원 정책 명시 |
| 4 | 문서화 | **PRD와 Spec 간 Multi Turn 0-조건 표현 불일치**: 세 곳(`prd/3-node-system.md`, `prd/6-phase2-ai.md`, `spec/4-nodes/3-ai-nodes.md`)의 기술 방식이 미묘하게 다름 | 세 문서 전체 | Spec을 Single Source of Truth로 지정하고, PRD는 `> 상세: spec/4-nodes/3-ai-nodes.md 참조` 패턴으로 위임 |
| 5 | 보안 | **`_turnDebugHistory`의 민감 데이터 노출 위험**: `requestPayload`에 시스템 프롬프트, 도구 설정, 전체 대화 이력 포함. 접근 제어 정책 미명시 | `spec/4-nodes/3-ai-nodes.md` `_turnDebugHistory` 섹션 | 워크플로우 소유자/관리자 권한에서만 조회 가능하도록 접근 제어 정책 명시. 기본 응답에서 제외하고 `?debug=true`로만 포함하거나 별도 엔드포인트 분리 |
| 6 | 보안 | **`condition.prompt`의 프롬프트 인젝션 벡터**: 사용자 입력이 검증 없이 LLM 도구 `description`으로 직접 사용됨 | `spec/4-nodes/3-ai-nodes.md` 조건 도구 등록 섹션 | 서버사이드 새니타이징 정책 명시. 주입 패턴 필터링 또는 LLM 레이어에서의 이스케이핑 정책 추가 |
| 7 | 테스트 | **Single Turn 포트 순서 변경으로 인한 인덱스 기반 테스트 실패**: `out → conditions → timeout → error` → `conditions → out → error` 순서 변경 | `spec/4-nodes/3-ai-nodes.md` Single Turn 포트 구조 | 포트 검증 테스트를 배열 인덱스가 아닌 포트 ID/key 기반으로 재작성 |
| 8 | 테스트 | **Multi Turn 0-조건 하위 호환 로직 테스트 누락**: 조건 0개 → `out`, 조건 1개 추가 시 포트 구조 변환 동작 미검증 | `spec/4-nodes/3-ai-nodes.md` 하위 호환 섹션 | `conditions=[]` / `conditions=[{...}]` 포트 구조 변환 테스트 신규 작성 |
| 9 | 테스트 | **신규 유효성 검증 규칙 테스트 부재**: 최대 20개 조건, 예약 포트 ID 충돌, `prompt` 2000자, `reason` 500자 잘림 처리 테스트 없음 | `spec/4-nodes/3-ai-nodes.md` 유효성 검증 규칙 섹션 | 각 유효성 규칙에 대한 경계값 테스트 케이스 신규 작성 |
| 10 | 테스트 | **`_turnDebugHistory` 출력 스키마 테스트 누락**: function calling 시 `llmCalls` 누적, `totalDurationMs` 합산 정확성 미검증 | `spec/4-nodes/3-ai-nodes.md` 디버그 데이터 섹션 | `llmCalls` 배열 누적 로직, `totalDurationMs` 계산 테스트 신규 작성 |
| 11 | API 계약 | **도구 이름 변경으로 인한 실행 중 Multi Turn 세션 히스토리 불일치**: 기존 UUID 형식 tool call이 저장된 진행 중 세션 재개 시 도구 이름 불일치 발생 가능 | `spec/4-nodes/3-ai-nodes.md` 도구 이름 규칙 섹션 | 실행 재개 시 히스토리 마이그레이션 처리 또는 "진행 중 세션 미적용" 정책 명시 |
| 12 | 요구사항 | **`ToolOverride.toolName`의 접두사 규칙 우회 가능성**: 사용자가 직접 도구 이름 지정 시 `cond_` 충돌 또는 접두사 규칙 우회 가능 | `spec/4-nodes/3-ai-nodes.md` ToolOverride 구조 섹션 | override 시에도 `tool_` 접두사 자동 적용하거나, 예약 접두사 사용 제한 규칙을 유효성 검증에 추가 |
| 13 | 부작용 | **신규 유효성 검증 규칙의 기존 데이터 소급 영향**: 저장된 조건 20개 초과 또는 prompt 2000자 초과 워크플로우가 로드/편집 시 오류 발생 가능 | `spec/4-nodes/3-ai-nodes.md` 유효성 검증 규칙 섹션 | 기존 데이터 소급 적용 여부 명시. 편집 시에만 적용하는 "soft validation" 방식 채택 여부 결정 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 | **`_turnDebugHistory` 누적 페이로드 크기**: Multi Turn 20턴 × 복수 LLM 호출 시 `messages` 배열이 누적되어 메모리/직렬화 비용 급증 | `spec/4-nodes/3-ai-nodes.md` 디버그 데이터 섹션 | 해당 턴에서 추가된 메시지 델타만 저장하는 구조로 개정 권장, 또는 별도 비동기 저장소에 기록 |
| 2 | 성능 | **도구 이름 sanitize 연산 캐싱 미명시**: 매 LLM 호출마다 UUID sanitize 재계산 | `spec/4-nodes/3-ai-nodes.md` 도구 이름 규칙 섹션 | 노드 설정 저장 시 1회 계산하여 캐싱(`_toolName` 파생 필드) 후 재사용 |
| 3 | 문서화 | **`endReason: "timeout"` 백엔드/프론트엔드 처리 차이 모호**: 인라인 주석으로만 설명되어 구현 계약 불분명 | `spec/4-nodes/3-ai-nodes.md` `endReason` enum 이후 주석 | 백엔드(`timeout` 허용) / 포트 라우팅(`timeout` → `error` 포트) 처리를 별도 항목으로 분리 명시 |
| 4 | 문서화 | **`_turnDebugHistory` 포함 조건 미명시**: 항상 포함인지 opt-in인지, 환경별 차이 불명확 | `spec/4-nodes/3-ai-nodes.md` 디버그 데이터 섹션 | config 테이블에 `includeDebugHistory: Boolean` 추가 여부 결정 및 포함 조건 명시 |
| 5 | 문서화 | **`sanitizeId` 결과 길이 제한 미명시**: 일부 LLM 프로바이더의 함수명 길이 제한 고려 없음 (OpenAI 64자) | `spec/4-nodes/3-ai-nodes.md` 도구 이름 규칙 섹션 | 전체 UUID 예시 및 최대 길이 보장 방법 명시 |
| 6 | 문서화 | **PRD와 Spec 간 유효성 제약 동기화 부재**: PRD만 읽는 독자는 최대 조건 수 등 제약 미인지 | `prd/3-node-system.md`, `prd/6-phase2-ai.md` | PRD에 "유효성 제약은 Spec 참조" 링크 추가 또는 핵심 제약 간략 기재 |
| 7 | 아키텍처 | **유효성 검증 규칙이 실행 로직 섹션에 혼재**: 입력 경계 검증과 실행 흐름 설명 분리 필요 | `spec/4-nodes/3-ai-nodes.md` 유효성 검증 규칙 섹션 | config 섹션 또는 별도 `### 검증 규칙` 섹션으로 분리 |
| 8 | 아키텍처 | **`reason` 500자 잘림 처리 레이어 미명시**: 백엔드 실행 엔진, LLM 응답 파서, 출력 직렬화 중 어느 레이어에서 처리할지 불명확 | `spec/4-nodes/3-ai-nodes.md` 유효성 검증 규칙, `reason` 응답 | 실행 로직 섹션의 tool call 처리 단계에 명시 |
| 9 | 동시성 | **`_turnDebugHistory` 누적 배열의 경쟁 조건**: Multi Turn WebSocket 비동기 환경에서 배열 append 직렬화 보장 미명시 | `spec/4-nodes/3-ai-nodes.md` 디버그 데이터 섹션 | 직렬화된 컨텍스트에서 업데이트, 동시 메시지 수신은 큐잉 처리한다는 제약 명시 |
| 10 | 동시성 | **AI Agent 종료 first-wins 정책 미명시**: `timeout`/`error` 이중 종료 시나리오 처리 불명확 | `spec/4-nodes/3-ai-nodes.md` Multi Turn 종료 조건 | "종료는 first-wins 방식, 이후 종료 이벤트는 무시(idempotent)" 규칙 추가 |
| 11 | 범위 | **`_turnDebugHistory` 섹션이 핵심 변경과 함께 묵시적 추가**: 별도 변경으로 분리하거나 의도 명시 필요 | `spec/4-nodes/3-ai-nodes.md` 디버그 데이터 섹션 | PR/커밋 설명에 명시적 기술 또는 별도 변경으로 분리 |
| 12 | 보안 | **`error.code` 내부 시스템 상태 노출**: `LLM_RATE_LIMIT` 등 내부 오류 분류가 클라이언트에 직접 전달 | `spec/4-nodes/3-ai-nodes.md` `error` 포트 출력 구조 | 사용자 대면 오류 메시지와 내부 코드 분리, 내부 코드는 서버 로그에만 기록 고려 |
| 13 | 요구사항 | **ND-AG-13 종료 조건 설명과 실제 포트 구조 미세 불일치**: "타임아웃"이 독립 종료 조건처럼 기술되나 `error`로 통합됨 | `prd/3-node-system.md` ND-AG-13, `prd/6-phase2-ai.md` ND-AG-13 | "(타임아웃은 error 포트로 통합)" 보충 문구 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| api_contract | HIGH | `timeout` 포트 제거 Breaking Change, 마이그레이션 전략 부재 |
| side_effect | HIGH | `timeout` 포트 제거 및 Multi Turn 0-조건 변경으로 기존 엣지 파손 |
| testing | HIGH | `timeout` 포트 제거 및 도구 이름 규칙 변경으로 기존 테스트 즉시 실패 |
| architecture | MEDIUM | `endReason` enum과 라우팅 포트 간 단일 책임 위반, `_turnDebugHistory` 레이어 혼재 |
| security | MEDIUM | `_turnDebugHistory` 접근 제어 미명시, `condition.prompt` 프롬프트 인젝션 벡터 |
| requirement | MEDIUM | Multi Turn 0-조건 오류 라우팅 경로 미정의, `ToolOverride` 접두사 우회 가능 |
| maintainability | LOW | `endReason` enum과 포트 불일치, Multi Turn 0-조건 비대칭 |
| documentation | LOW | 예약 포트 목록에 삭제된 `timeout` 잔존, PRD-Spec 간 표현 불일치 |
| dependency | LOW | 구현 코드와의 동기화 미확인 (문서 내부 일관성은 양호) |
| performance | LOW | `_turnDebugHistory` 페이로드 누적 크기, sanitize 캐싱 미명시 |
| concurrency | LOW | 비동기 환경에서의 first-wins 및 직렬화 정책 미명시 |
| scope | LOW | `_turnDebugHistory` 범위 이탈 가능성 |
| database | NONE | 해당 없음 (DB 코드 미포함) |

---

## 발견 없는 에이전트

- **database** — 변경된 파일이 PRD/Spec 문서이며 DB 코드 미포함

---

## 권장 조치사항

1. **[즉시] Breaking Change 마이그레이션 전략 수립**: `timeout` 포트 → `error` 자동 리맵 로직 및 DB 엣지 마이그레이션 스크립트 작성 여부 결정. "하위 호환"으로 표기된 Multi Turn 0-조건 케이스를 Breaking Change로 재분류하고 기존 엣지 처리 방안 명시

2. **[즉시] Multi Turn 0-조건 포트 구조 수정**: `out`만 제공 → `out + error` 최소 포함으로 변경하거나, `user_ended`/`max_turns`/`error` 포트도 유지하는 방향으로 스펙 수정

3. **[즉시] 기존 테스트 업데이트**: `timeout` 포트 참조 테스트를 `error` 포트로 전환, `cond_`/`tool_` 접두사 기반 도구 이름 테스트로 업데이트, 포트 순서 의존 테스트를 ID 기반으로 재작성

4. **[높음] `endReason` enum 정리**: `timeout` 값을 enum에서 제거하고 `error.code: LLM_TIMEOUT`으로만 구분하거나, 포트 라우팅과 진단 코드를 명확히 분리하는 설계 결정

5. **[높음] 신규 유효성 검증 규칙 테스트 작성**: `sanitizeId` 단위 테스트, 조건 20개 제한, `prompt` 2000자, `reason` 500자 잘림 처리 경계값 테스트 신규 작성

6. **[중간] `_turnDebugHistory` 보안/접근 제어 정책 명시**: 기본 응답 제외 및 권한 기반 접근 제어 정책을 스펙에 추가. 시스템 프롬프트 포함 여부 및 노출 범위 결정

7. **[중간] 예약 포트 목록 정리**: 유효성 검증 규칙에서 `timeout` 제거 → `[out, in, error, user_ended, max_turns]`로 수정

8. **[중간] PRD-Spec 단일 진실 공급원 정립**: ND-AG-13/23/24 항목을 Spec 위임 패턴으로 통일, `_turnDebugHistory` 포함 조건 및 `sanitizeId` 전체 UUID 예시 문서화