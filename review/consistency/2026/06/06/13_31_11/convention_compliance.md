# 정식 규약 준수 검토 결과

**검토 모드**: 구현 착수 전 검토 (`--impl-prep`)
**Target**: `spec/5-system/4-execution-engine.md`
**검토 일시**: 2026-06-06

---

## 발견사항

### 발견사항 1
- **[INFO]** 섹션 3.3 번호 누락 — `3.3 Background 실행` 이 `3.4 중첩 컨테이너 스코프` 다음에 배치되어 순서 역전
  - target 위치: `spec/5-system/4-execution-engine.md` §3 (컨테이너 실행) 절 내부. `### 3.4 중첩 컨테이너 스코프` 가 `### 3.3 Background 실행` 보다 앞에 배치되어 있음 (파일 내 라인 상: §3.4 가 §3.3 보다 먼저 등장)
  - 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장" 및 일반 spec 문서 섹션 번호 일관성 원칙
  - 상세: `### 3.3 Background 실행` 절이 `### 3.4 중첩 컨테이너 스코프` 절 뒤에 위치하여 번호 순서가 실제 파일 순서와 역전된다. 독자가 앞으로 스크롤해야 §3.3을 읽을 수 있다. 규약 위반이라기보다 유지보수 중 발생한 편집 오류다.
  - 제안: `### 3.3 Background 실행` 절 전체를 `### 3.2 ForEach / Map 실행` 뒤, `### 3.4 중첩 컨테이너 스코프` 앞으로 이동하거나, 반대로 §3.4 를 §3.3 뒤로 이동해 번호-위치 일치를 복원한다.

### 발견사항 2
- **[INFO]** `§1.3` 표의 `status` 값 목록이 `node-output.md` Principle 0 의 공식 enum 과 비교했을 때 `requires_integration` · `requires_playwright` 값이 표에만 있고 §1.3 본문 흐름 설명 외 다른 spec 참조가 없음
  - target 위치: `spec/5-system/4-execution-engine.md` §1.3 "블로킹/재개 컨트랙트" 표 (`requires_integration`, `requires_playwright` 행)
  - 위반 규약: `spec/conventions/node-output.md` Principle 0 (5필드 불변 + status 열거) 참조 일관성
  - 상세: `node-output.md` Principle 0 의 주석에서 `status` 의 값으로 `'waiting_for_input' | 'requires_integration' | 'requires_playwright'` 를 언급하고 있으나, 해당 spec 의 §1.3 표는 두 값을 포함하면서 CONVENTIONS 참조를 "CONVENTIONS Principle 4" 로만 걸어 두어 독자가 소스를 추적하기 어렵다. `node-output.md` 의 Principle 4 는 현재 파일에 존재하지 않는 번호다(최종 파일에서 확인된 Principle 은 0·1·1.1·2·3 까지임). 이는 out-of-date 참조 가능성이 있다.
  - 제안: `node-output.md` 의 실제 Principle 번호를 확인해 §1.3 의 `(CONVENTIONS Principle 4)` 참조를 정확한 번호로 수정한다. 또는 `node-output.md` 에 Principle 4 가 실제 존재하는지 재확인한다.

### 발견사항 3
- **[WARNING]** `spec/conventions/node-output.md` Principle 3.2 가 `code` 는 `UPPER_SNAKE_CASE` 를 SoT 로 선언하는데, §7.5.1 에서 REST 진입점이 `INVALID_STATE` 를 반환하고 WS 진입점이 `INVALID_EXECUTION_STATE` 를 반환한다고 기술하며 의도적 분리로 설명하나, 동일 의미의 같은 조건에 두 코드가 존재하는 점은 `error-codes.md §1` (의미 기반 명명 원칙)과의 긴장을 일으킴
  - target 위치: `spec/5-system/4-execution-engine.md` §7.5.1 "Publisher 측 사전 검증 — `INVALID_EXECUTION_STATE`"
  - 위반 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명) 및 §2 (rename = breaking change, 신규 코드 신설 원칙)
  - 상세: `INVALID_EXECUTION_STATE`(WS) 와 `INVALID_STATE`(REST) 는 동일한 조건("기대 상태가 아님")을 표현하면서 코드 이름이 다르다. §7.5.1 Rationale 은 "routing 분기 혼동 회피"를 이유로 분리를 명시하나, `error-codes.md §1` 은 "클라이언트는 코드의 의미로 분기하며 이름 토큰을 파싱하지 않는다"고 기술한다. 두 레이어가 같은 조건에 다른 이름을 쓰는 것은 규약 정신과 거리가 있다. `error-codes.md §3` historical-artifact 레지스트리에 이 쌍이 등록되지 않은 것은 의도적 역사적 예외가 아니라 설계 선택이 규약 명시를 앞선 경우다.
  - 제안: (a) `INVALID_EXECUTION_STATE` 를 `error-codes.md §3` historical-artifact 레지스트리에 등재하고 의도적 분리 이유를 기록한다. 또는 (b) 본 spec §7.5.1 Rationale 에 `error-codes.md §1` 와의 관계("의도적 예외, 레지스트리 등재 예정") 를 명시한다. 규약 자체 갱신이 필요한 경우: `error-codes.md §1` 에 "multi-layer 동일 조건 다른 코드" 허용 패턴을 신설하면 된다.

### 발견사항 4
- **[INFO]** frontmatter `status: partial` 이지만 `pending_plans:` 에 등재된 4개 plan 중 일부가 관련 구현 영역과 연결이 충분히 기술되어 있어 규약 가드 통과는 예상되나, 검토 범위(spec 규약 준수)에서 `spec-impl-evidence.md §2.1` 의 `id` 값이 파일 basename 과 일치하는지 확인 필요
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter (라인 2: `id: execution-engine`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` (`id` 필드: "파일 basename(확장자 제외) 기반 권장")
  - 상세: `id: execution-engine` 은 파일 basename `4-execution-engine` 과 정확히 일치하지 않는다 — basename 에서 `4-` prefix 를 제거한 값이다. `spec-impl-evidence.md §2.1` 은 "파일 basename 기반 **권장**" 이라 명시하므로 강제 규약은 아니다. 가드(`spec-frontmatter.test.ts`)도 `id` 와 basename 일치를 검사하지 않고 id 유효성(string)만 검사한다. 위반은 아니나 다른 spec 파일들의 관행 확인 없이 단정할 수 없어 INFO 로 기록한다.
  - 제안: 동일 영역의 다른 spec 파일(`1-auth.md → id: 1-auth` 또는 `id: auth` 등)과 패턴을 맞추면 일관성이 높아진다. `4-` prefix 생략 패턴이 다른 파일에서도 통용되면 현행 유지가 적절하다.

### 발견사항 5
- **[INFO]** §6.2 저장 전략 표의 `실행 중` 행이 "Redis에 저장 (TTL: 실행 타임아웃 × 2)" 라고 기술하나, §8 에서 `waiting_for_input` 은 무기한 보존이라 TTL 규약과 충돌 가능성 있음 — 단, 이는 Redis 컨텍스트 캐시의 TTL 이고 DB park 와 별개이므로 실질 위반은 아님
  - target 위치: `spec/5-system/4-execution-engine.md` §6.2 "저장 전략" 표의 `실행 중` 행
  - 위반 규약: 규약 위반이 아닌 잠재적 독자 혼동 포인트. `spec/conventions/execution-context.md` 와의 정합은 해당 문서 미검토로 확인 불가.
  - 상세: "TTL: 실행 타임아웃 × 2" 문구는 `waiting_for_input` 의 무기한 park(`§4.x`, §7.4 "park 상태: TTL 없음") 와 다소 혼동을 줄 수 있다. 실제로는 Redis 의 ExecutionContext (in-memory 캐시) 의 TTL 이고, DB 의 Execution row 는 별개로 무기한 보존된다.
  - 제안: 해당 행에 "(Redis ExecutionContext 캐시 — DB Execution row 는 별도 무기한 보존)" 주석을 추가해 독자 혼동을 방지한다.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 `spec/conventions/spec-impl-evidence.md` 의 frontmatter 필수 필드(`id`, `status`, `code`, `pending_plans`)를 모두 보유하고 있으며, 에러 코드 표기(`UPPER_SNAKE_CASE`)·출력 포맷 규약(`node-output.md` Principle 0~3 cross-link)·문서 구조(본문 + Rationale 섹션 완비)가 전반적으로 정식 규약을 준수한다. 주요 발견사항은 세 가지다: (1) §3.3 Background 절이 §3.4 뒤에 배치되어 섹션 번호와 파일 순서가 역전된 편집 오류(INFO), (2) §1.3 의 `CONVENTIONS Principle 4` 참조가 `node-output.md` 내 실존하지 않는 Principle 번호를 가리킬 가능성(INFO), (3) `INVALID_EXECUTION_STATE`(WS) 와 `INVALID_STATE`(REST) 의 동의어 코드 분리가 `error-codes.md §1` 의미 기반 명명·단일 코드 원칙과 긴장 관계에 있으나 §7.5.1 Rationale 에 설계 의도가 설명되어 있어 CRITICAL 보다는 WARNING 수준이며, `error-codes.md §3` historical-artifact 레지스트리 등재로 명시적 처리를 권장한다. API 문서 규약(OpenAPI/Swagger 데코레이터)은 이 spec 파일의 직접 적용 대상이 아니다. 구현 착수를 차단할 CRITICAL 위반은 없다.

---

## 위험도

LOW
