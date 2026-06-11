# Convention Compliance Review — spec/4-nodes/5-data/2-code.md (isolated-vm draft)

검토 모드: spec draft (--spec)
검토 대상: `spec/4-nodes/5-data/2-code.md` — isolated-vm 전환 개정안 (prompt payload 기준)

---

## 발견사항

### WARNING 1 — §5 intro 에 구현 기술 stale 참조 (`vm.Script`)
- **target 위치**: §5 출력 구조 도입부 blockquote ("컴파일 실패 (vm.Script 구문 오류) …")
- **위반 규약**: `spec/conventions/node-output.md` Principle 11 — 출력 예시 문서화 규칙 (단일 진실 원칙). 더 근본적으로는 문서 내 일관성.
- **상세**: 같은 draft 의 §4 step 2 는 `isolate compileScript` 로 올바르게 갱신됐고, §6 표도 `` `isolate` `compileScript` 구문 오류 `` 로 갱신됐다. 그러나 §5 intro blockquote 만 `vm.Script 구문 오류` 라는 구 구현 용어가 남아 있다. 독자가 §5 와 §4/§6 사이에서 구현 기반이 다르게 읽힌다.
- **제안**: §5 intro blockquote 내 `vm.Script 구문 오류` → `isolate compileScript 구문 오류` 로 교체.

---

### INFO 1 — Rationale 에 구 구현 선택 근거(`node:vm`) 잔류 여부
- **target 위치**: `## Rationale` — `### 격리 방식 isolated-vm 전환 — 위협 모델과 결정 (2026-06-11)` 신규 추가됨
- **위반 규약**: 직접 위반은 아님. CLAUDE.md "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 원칙에는 부합.
- **상세**: 기존 파일에서 §7.1 inline `> 선택 근거` blockquote (`node:vm` 선택 이유)는 isolated-vm 전환 Rationale 로 교체·승격됐다. Draft 의 §7.1 에는 `isolated-vm` 선택 근거가 inline blockquote 로 다시 작성돼 있으며, Rationale 섹션에도 동일 결정이 상세히 기술돼 있어 약간 중복된다. 필수 문제는 아니지만 §7.1 inline 근거와 Rationale 신규 섹션 사이 중복 수준이 높다.
- **제안**: §7.1 inline `> 선택 근거` blockquote 를 "상세: §Rationale 참조" 한 줄로 축약하거나, 현재처럼 §7.1 에 기술적 요약 + Rationale 에 결정 경위 상세로 역할 분리를 명시해도 무방. 현재 draft 는 두 곳 모두 상세 기술이라 독자에게 SoT 가 불명확할 수 있다.

---

### INFO 2 — `CODE_MEMORY_LIMIT` 에러 케이스 출력 예시 미제공
- **target 위치**: §5.3 케이스 목록. §5.3.1 (throw), §5.3.2 (타임아웃) 는 JSON 예시 있음. `CODE_MEMORY_LIMIT` 케이스 없음.
- **위반 규약**: `spec/conventions/node-output.md` Principle 11 — "Case별로 분리 (성공 / 에러 / 재개 등)". `CODE_MEMORY_LIMIT` 는 §7.2 기준 이제 정식 하드 리밋으로 격상됐으나 출력 예시가 없다.
- **상세**: `CODE_MEMORY_LIMIT` 는 에러 매핑 표에는 등장하지만 §5.3 케이스로 전개되지 않는다. 타임아웃과 유사하게 `port: 'error'` + `output.error.code: 'CODE_MEMORY_LIMIT'` 패턴이 예측 가능하나 문서화 공백이 있다.
- **제안**: `#### 5.3.3 메모리 초과 (`CODE_MEMORY_LIMIT`)` 케이스를 추가. 또는 로드맵 항목으로 유지한다면 §7.2 메모리 행과 동일하게 "(로드맵)" 주석 부여. 현재 §7.2 는 "128MB 하드 리밋" 으로 정식 기능으로 기술하므로 출력 예시 누락이 더 눈에 띈다.

---

### INFO 3 — §8 캔버스 요약 포맷 설명이 0-common.md §3 과 불일치 (기존 문제, 본 draft 미수정)
- **target 위치**: §8 캔버스 요약 — `` `Code` 행 인용 (`{language} · {N} lines`) ``
- **위반 규약**: 단일 진실 원칙 (CLAUDE.md). `spec/4-nodes/5-data/0-common.md §3` SoT.
- **상세**: `0-common.md §3` 표는 Code 노드 요약 포맷을 `{language}` (대문자, `summaryTemplate: {{language|upper}}`) 로 정의하며 "코드 줄 수(`N lines`)는 summaryTemplate DSL 이 개행 카운트를 지원하지 않아 요약에 포함하지 않는다" 고 명시한다. 본 draft §8 은 여전히 `{language} · {N} lines` 로 기술해 0-common 과 모순된다. 이 불일치는 본 draft 이전부터 존재하지만 isolated-vm 개정에서 수정되지 않았다.
- **제안**: §8 의 `{language} · {N} lines` → `{language}` 로 수정 (0-common §3 와 일치). 또는 0-common §3 을 갱신. 어느 쪽이 SoT 인지 결정 필요.

---

## 요약

정식 규약 준수 관점에서 대체로 양호하다. Frontmatter (`id`/`status`/`code:`) 는 `spec-impl-evidence.md` 요건을 충족하고, 출력 구조는 `node-output.md` Principle 0·2·3.2·7·8.2 를 정확히 반영하며, 에러 코드 표기(`UPPER_SNAKE_CASE`)는 `error-codes.md §1` 에 부합한다. 신규 Rationale 섹션은 CLAUDE.md 의 3섹션 구조(Overview/본문/Rationale)를 올바르게 보강한다. 주요 지적은 §5 intro blockquote 에 구 구현 용어(`vm.Script`)가 §4/§6 갱신에도 불구하고 잔류하는 내부 불일치(WARNING)와, `CODE_MEMORY_LIMIT` 케이스 출력 예시 미제공(INFO), §8 캔버스 요약 포맷의 기존 0-common 불일치(INFO) 세 건이다. 채택 시 invariant 를 깨는 CRITICAL 위반은 없다.

## 위험도

LOW
