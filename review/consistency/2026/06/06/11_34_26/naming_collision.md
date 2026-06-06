# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/` 변경 분 (diff-base=origin/main)
변경 파일: `spec/5-system/7-llm-client.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/9-rag-search.md`, `spec/5-system/17-agent-memory.md`, `spec/2-navigation/5-knowledge-base.md`

---

## 발견사항

### 1. 요구사항 ID 충돌

신규 도입 요구사항 ID 없음. 변경 사항은 기존 섹션에 설명·Rationale·주석을 추가하는 방식이며, 새로운 `KB-*` / `NAV-*` / `AGM-*` 형태의 ID 를 부여하지 않는다. 충돌 없음.

### 2. 엔티티/타입명

- **[INFO]** `EmbedInputType` 신규 TypeScript 타입
  - target 신규 식별자: `EmbedInputType = 'query' | 'document'` (`codebase/backend/src/modules/llm/embedding-input-type.ts` export)
  - 기존 사용처: 기존 spec 및 코드베이스에 동일 이름 없음. `input_type` 은 `spec/5-system/11-mcp-client.md` 에서 MCP Integration 설정의 일반 영어로만 등장하며 TypeScript 심볼과 무관.
  - 상세: 이름이 겹치는 기존 심볼 없음. `'query'`/`'document'` 리터럴은 여러 곳에서 다른 의미로 사용되지만 TypeScript 유니언 타입 내 격리 — 혼용 위험 없음.
  - 제안: 없음.

- **[INFO]** `isKoreanRecommendedEmbeddingModel` 함수 + `KOREAN_RECOMMENDED_PATTERNS` 상수
  - target 신규 식별자: `codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts`
  - 기존 사용처: 코드베이스 전체에서 동일 이름 없음.
  - 상세: `spec/2-navigation/5-knowledge-base.md` frontmatter `code:` 목록에 `.ts` 확장자로 별도 등재. 기존 `*.tsx` 와일드카드에서 제외된 파일이라 의도적 등재이며 중복 아님.
  - 제안: 없음.

- **[INFO]** `EmbeddingModelCombobox` 컴포넌트
  - target 신규 식별자: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx`
  - 기존 사용처: 기존 `ModelCombobox` (`codebase/frontend/src/components/llm-config/model-combobox.tsx`) 가 LLM 설정 화면에서 사용된다. 이름과 위치가 달라 충돌 없음. 공유 `ModelSelectField` 기반으로 내부 로직을 재사용한다.
  - 제안: 없음.

### 3. API endpoint 충돌

신규 endpoint 없음. 기존 `POST /re-embed` 참조만 갱신. 충돌 없음.

### 4. 이벤트/메시지명 충돌

신규 WebSocket/webhook/queue 이벤트 없음. 충돌 없음.

### 5. 환경변수·설정키 충돌

신규 ENV var / config key 없음. 충돌 없음.

### 6. 파일 경로

- **[INFO]** `spec/5-system/8-embedding-pipeline.md §5.4` 섹션 신설
  - target 신규 식별자: `### 5.4 비대칭 입력 (input_type / prefix)` (신규 하위 섹션)
  - 기존 사용처: origin/main 에 `§5.4` 없음. diff 내 다른 spec 파일들(`9-rag-search.md`, `17-agent-memory.md`, `7-llm-client.md`)이 `§5.4` 를 참조 — 이번 PR 이 함께 추가한 참조이므로 dead-link 가 아닌 정상 도입.
  - 제안: 없음.

- **[INFO]** `codebase/backend/src/modules/llm/embedding-input-type.ts` 신규 파일
  - target 신규 식별자: 새 순수함수 모듈
  - 기존 사용처: 동일 경로·이름 파일 없음. 충돌 없음.
  - 제안: 없음.

### 7. 함수 시그니처 위치 인자 삽입

- **[WARNING]** `LlmService.embed` 시그니처에 `opts?` 인자 삽입
  - target 신규 식별자: `embed(config, texts, model?, opts?, inputType?)` — origin/main 대비 `opts` 와 `inputType` 두 인자 추가
  - 기존 사용처: origin/main 의 `LlmService.embed` 는 `(config, texts, model?)` 3인자 시그니처. 기존 3인자 호출부는 `opts`/`inputType` 생략 시 하위 호환 유지.
  - 상세: `opts` 를 건너뛰고 `inputType` 만 전달해야 하는 신규 호출부는 `opts: undefined` 를 명시해야 한다. `spec/5-system/7-llm-client.md §8.3` Rationale 에 위치 인자 선택 이유는 있으나, `opts` skip 패턴 예시가 없어 호출자가 `embed(config, texts, model, 'query')` 로 잘못 호출할 위험이 있다(4번째 인자가 `opts` 로 해석됨).
  - 제안: `7-llm-client.md §8.3` 시그니처 설명에 "검색 경로에서 `opts` 불필요 시 `embed(config, texts, model, undefined, 'query')` 형태로 `undefined` 를 명시" 예시 한 줄 추가 권장.

---

## 요약

임베딩 비대칭 입력(`EmbedInputType`/`inputType`), 한국어 추천 배지(`embedding-model-recommendation.ts`, `isKoreanRecommendedEmbeddingModel`), `EmbeddingModelCombobox` 신설, `LlmService.embed` 시그니처 확장 등 신규 식별자가 기존 spec·코드베이스의 동일 이름과 실질적으로 충돌하는 경우는 발견되지 않았다. 유일한 주의 사항은 `LlmService.embed` 에 위치 인자 `opts?` 가 삽입되어 `inputType` 만 전달하려는 호출자가 `opts: undefined` 를 누락할 경우 인자가 잘못 해석될 수 있다는 점이며, spec 주석 보강으로 충분히 해소 가능하다.

---

## 위험도

LOW
